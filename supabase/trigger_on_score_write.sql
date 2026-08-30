-- =============================================================================
-- Trigger on_score_write — Recalcul des scores en cascade
-- Remplace la Cloud Function Firebase "onScoreWrite"
--
-- Déclenchement : AFTER INSERT OR UPDATE OR DELETE ON evaluation_scores
-- Effet :
--   1. Recalcule score_global + score_par_dimension pour l'évaluation
--   2. Met à jour dashboard_stats pour l'ASN propriétaire
--   3. Propage vers dashboard_stats de l'OSN parent (score agrégé ASN)
--
-- Algorithme de scoring (identique à referentielService.ts côté client) :
--   score_dimension = round((sum_notes_dim / (nb_criteres_actifs * 3)) * 100)
--   score_global    = round(mean(score_dim_1, ..., score_dim_N))
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fonction principale du trigger
-- ---------------------------------------------------------------------------

-- ⚠️ AUDIT M5 (2026-08-30) : ce corps est la COPIE VERBATIM de la version
-- CORRIGEE canonique (migration 20260804_faritany.sql). Il remplace l'ancien
-- corps d'avril buggé (N/A compté 0, pas de mode socle) qui, applique en
-- dernier au bootstrap, clobbait la version corrigée. NE PAS diverger : la
-- source de vérité TS est src/services/scoring.ts, testée par parite-sql.diff.

CREATE OR REPLACE FUNCTION fn_recalculate_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval_id         UUID;
  v_org_id          UUID;
  v_campagne_id     UUID;
  v_ref_version     TEXT;
  v_mode            campagne_mode;
  v_score_global    NUMERIC(5,2);
  v_score_dim       JSONB   := '{}';
  v_ko_codes        TEXT[]  := '{}';

  v_dim             RECORD;
  v_dim_sum         NUMERIC;
  v_dim_max         NUMERIC;
  v_dim_score       NUMERIC(5,2);
  v_dim_scores_sum  NUMERIC := 0;
  v_dim_count       INTEGER := 0;

  v_parent_id       UUID;
  v_asn_scores      JSONB   := '{}';
  v_asn_score_val   NUMERIC;
  v_dim_agg         JSONB   := '{}';
  v_ko_par_org      JSONB   := '{}';
  v_nb_ko_org       INTEGER := 0;
  v_taux_completion NUMERIC(5,2);
  v_nb_asn          INTEGER;
  v_nb_soumis       INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_eval_id := OLD.eval_id;
  ELSE
    v_eval_id := NEW.eval_id;
  END IF;

  SELECT e.org_id, e.campagne_id, c.referentiel_version, c.mode
  INTO   v_org_id, v_campagne_id, v_ref_version, v_mode
  FROM evaluations e
  JOIN campagnes  c ON c.id = e.campagne_id
  WHERE e.id = v_eval_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- ── 1. Recalcul par dimension ──────────────────────────────────────────────
  FOR v_dim IN
    SELECT d.id AS dim_id, d.code AS dim_code
    FROM dimensions d
    JOIN referentiel_versions rv ON rv.id = d.ref_id
    WHERE rv.version = v_ref_version
    ORDER BY d.ordre
  LOOP
    SELECT
      COALESCE(SUM(COALESCE(es.note, 0)), 0),
      -- C4 : un critère explicitement N/A (ligne présente, note NULL) sort du
      -- dénominateur. Un critère jamais ouvert (aucune ligne) reste compté à 0.
      3 * COUNT(*) FILTER (WHERE NOT (es.id IS NOT NULL AND es.note IS NULL))
    INTO v_dim_sum, v_dim_max
    FROM criteres c
    LEFT JOIN evaluation_scores es
      ON es.eval_id      = v_eval_id
     AND es.critere_code = c.code
    WHERE c.dimension_id = v_dim.dim_id
      AND c.actif = TRUE
      AND (v_mode <> 'socle' OR c.socle = TRUE);   -- mode socle

    -- Dimension entièrement N/A ou vide : exclue de la moyenne, pas notée 0.
    IF COALESCE(v_dim_max, 0) = 0 THEN
      CONTINUE;
    END IF;

    v_dim_score      := ROUND((v_dim_sum / v_dim_max) * 100, 2);
    v_score_dim      := v_score_dim || jsonb_build_object(v_dim.dim_code, v_dim_score);
    v_dim_scores_sum := v_dim_scores_sum + v_dim_score;
    v_dim_count      := v_dim_count + 1;
  END LOOP;

  -- ── 2. Score global ────────────────────────────────────────────────────────
  v_score_global := CASE WHEN v_dim_count = 0 THEN 0
                         ELSE ROUND(v_dim_scores_sum / v_dim_count, 2) END;

  -- ── 3. Critères essentiels KO ──────────────────────────────────────────────
  -- Un essentiel N/A n'est pas KO : seule une note 0, ou l'absence de réponse,
  -- vaut non-conformité.
  SELECT COALESCE(ARRAY_AGG(c.code ORDER BY c.code), '{}')
  INTO v_ko_codes
  FROM criteres c
  JOIN dimensions d            ON d.id  = c.dimension_id
  JOIN referentiel_versions rv ON rv.id = d.ref_id
  LEFT JOIN evaluation_scores es
    ON es.eval_id      = v_eval_id
   AND es.critere_code = c.code
  WHERE rv.version = v_ref_version
    AND c.essentiel = TRUE
    AND c.actif     = TRUE
    AND (v_mode <> 'socle' OR c.socle = TRUE)
    AND NOT (es.id IS NOT NULL AND es.note IS NULL)   -- N/A ≠ KO
    AND COALESCE(es.note, 0) = 0;

  -- ── 4. Mise à jour de l'évaluation ────────────────────────────────────────
  UPDATE evaluations
  SET score_global        = v_score_global,
      score_par_dimension = v_score_dim,
      updated_at          = NOW()
  WHERE id = v_eval_id;

  -- ── 5. dashboard_stats de l'ASN (Faritany) ────────────────────────────────
  INSERT INTO dashboard_stats (
    org_id, score_global, score_par_dimension,
    criteres_essentiels_ko, referentiel_version, updated_at
  )
  VALUES (
    v_org_id, v_score_global, v_score_dim,
    v_ko_codes, v_ref_version, NOW()
  )
  ON CONFLICT (org_id) DO UPDATE SET
    score_global           = EXCLUDED.score_global,
    score_par_dimension    = EXCLUDED.score_par_dimension,
    criteres_essentiels_ko = EXCLUDED.criteres_essentiels_ko,
    referentiel_version    = EXCLUDED.referentiel_version,
    updated_at             = NOW();

  -- ── 6. Propagation vers l'OSN parent ──────────────────────────────────────
  SELECT parent_id INTO v_parent_id
  FROM organisations
  WHERE id = v_org_id AND type = 'ASN';

  IF v_parent_id IS NOT NULL THEN

    -- 6a. Scores des ASN sœurs — C3 : même version de référentiel uniquement
    SELECT
      COALESCE(jsonb_object_agg(o.id::TEXT, ds.score_global), '{}'),
      COUNT(DISTINCT o.id)
    INTO v_asn_scores, v_nb_asn
    FROM organisations o
    LEFT JOIN dashboard_stats ds
      ON ds.org_id = o.id
     AND ds.referentiel_version = v_ref_version
    WHERE o.parent_id = v_parent_id
      AND o.type  = 'ASN'
      AND o.actif = TRUE;

    -- 6b. Score OSN — moyenne pondérée par organisations.poids
    SELECT ROUND(
             SUM(ds.score_global * o.poids) / NULLIF(SUM(o.poids), 0), 2)
    INTO v_asn_score_val
    FROM organisations o
    JOIN dashboard_stats ds
      ON ds.org_id = o.id
     AND ds.referentiel_version = v_ref_version
    WHERE o.parent_id = v_parent_id
      AND o.type  = 'ASN'
      AND o.actif = TRUE
      AND ds.score_global IS NOT NULL;

    -- 6c. C1 — score par dimension consolidé (moyenne pondérée, dimension à dimension)
    SELECT COALESCE(jsonb_object_agg(k, v), '{}')
    INTO v_dim_agg
    FROM (
      SELECT d.key AS k,
             ROUND(SUM((d.value)::NUMERIC * o.poids) / NULLIF(SUM(o.poids), 0), 2) AS v
      FROM organisations o
      JOIN dashboard_stats ds
        ON ds.org_id = o.id
       AND ds.referentiel_version = v_ref_version
      CROSS JOIN LATERAL jsonb_each_text(ds.score_par_dimension) AS d(key, value)
      WHERE o.parent_id = v_parent_id
        AND o.type  = 'ASN'
        AND o.actif = TRUE
      GROUP BY d.key
    ) agg;

    -- 6d. C2 — essentiels KO remontés avec leur Faritany d'origine
    SELECT
      COALESCE(jsonb_object_agg(o.id::TEXT, to_jsonb(ds.criteres_essentiels_ko)), '{}'),
      COUNT(*)
    INTO v_ko_par_org, v_nb_ko_org
    FROM organisations o
    JOIN dashboard_stats ds
      ON ds.org_id = o.id
     AND ds.referentiel_version = v_ref_version
    WHERE o.parent_id = v_parent_id
      AND o.type  = 'ASN'
      AND o.actif = TRUE
      AND array_length(ds.criteres_essentiels_ko, 1) > 0;

    -- 6e. Taux de complétion de la campagne en cours
    SELECT COUNT(DISTINCT e.id) FILTER (
             WHERE e.statut IN ('soumise', 'validee', 'cloturee'))
    INTO v_nb_soumis
    FROM organisations o
    LEFT JOIN evaluations e
      ON e.org_id      = o.id
     AND e.campagne_id = v_campagne_id
    WHERE o.parent_id = v_parent_id
      AND o.type  = 'ASN'
      AND o.actif = TRUE;

    v_taux_completion := CASE WHEN COALESCE(v_nb_asn, 0) > 0
                              THEN ROUND((COALESCE(v_nb_soumis, 0)::NUMERIC / v_nb_asn) * 100, 2)
                              ELSE 0 END;

    INSERT INTO dashboard_stats (
      org_id, score_global, score_par_dimension,
      criteres_essentiels_ko, essentiels_ko_par_org, nb_asn_avec_essentiel_ko,
      nb_asn, scores_asn, taux_completion_eval, referentiel_version, updated_at
    )
    VALUES (
      v_parent_id,
      COALESCE(v_asn_score_val, 0),
      v_dim_agg,
      -- union dédupliquée des codes KO, tous Faritany confondus
      COALESCE((SELECT ARRAY(SELECT DISTINCT jsonb_array_elements_text(v)
                             FROM jsonb_each(v_ko_par_org) AS t(k, v)
                             ORDER BY 1)), '{}'),
      v_ko_par_org,
      COALESCE(v_nb_ko_org, 0),
      v_nb_asn,
      v_asn_scores,
      v_taux_completion,
      v_ref_version,
      NOW()
    )
    ON CONFLICT (org_id) DO UPDATE SET
      score_global             = EXCLUDED.score_global,
      score_par_dimension      = EXCLUDED.score_par_dimension,
      criteres_essentiels_ko   = EXCLUDED.criteres_essentiels_ko,
      essentiels_ko_par_org    = EXCLUDED.essentiels_ko_par_org,
      nb_asn_avec_essentiel_ko = EXCLUDED.nb_asn_avec_essentiel_ko,
      nb_asn                   = EXCLUDED.nb_asn,
      scores_asn               = EXCLUDED.scores_asn,
      taux_completion_eval     = EXCLUDED.taux_completion_eval,
      referentiel_version      = EXCLUDED.referentiel_version,
      updated_at               = NOW();
  END IF;

  RETURN COALESCE(NEW, OLD);

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[fn_recalculate_scores] eval_id=% error: %', v_eval_id, SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- Attacher le trigger à evaluation_scores
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS on_score_write ON evaluation_scores;

CREATE TRIGGER on_score_write
  AFTER INSERT OR UPDATE OR DELETE ON evaluation_scores
  FOR EACH ROW
  EXECUTE FUNCTION fn_recalculate_scores();

-- =============================================================================
-- pg_cron — Remplacement de onCampagneClose (Cloud Scheduler)
-- Vérifie toutes les heures les campagnes dont la date_fermeture est dépassée
-- et les passe au statut 'fermee' si elles sont encore 'ouverte'.
-- =============================================================================

SELECT cron.schedule(
  'close-expired-campagnes',
  '0 * * * *',    -- toutes les heures
  $$
    UPDATE campagnes
    SET statut = 'fermee', updated_at = NOW()
    WHERE statut = 'ouverte'
      AND date_fermeture < NOW();
  $$
);
