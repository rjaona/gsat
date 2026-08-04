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
  v_score_global    NUMERIC(5,2);
  v_score_dim       JSONB := '{}';
  v_ko_codes        TEXT[] := '{}';

  -- Pour le calcul par dimension
  v_dim             RECORD;
  v_dim_sum         NUMERIC;
  v_dim_max         NUMERIC;
  v_dim_score       NUMERIC(5,2);
  v_dim_scores_sum  NUMERIC := 0;
  v_dim_count       INTEGER := 0;

  -- Pour la propagation OSN
  v_parent_id       UUID;
  v_asn_scores      JSONB := '{}';
  v_asn_score_val   NUMERIC;
  v_taux_completion NUMERIC(5,2);
  v_nb_asn          INTEGER;
  v_nb_soumis       INTEGER;
BEGIN
  -- Déterminer l'eval_id selon l'opération
  IF TG_OP = 'DELETE' THEN
    v_eval_id := OLD.eval_id;
  ELSE
    v_eval_id := NEW.eval_id;
  END IF;

  -- Récupérer les métadonnées de l'évaluation
  SELECT e.org_id, e.campagne_id, c.referentiel_version
  INTO v_org_id, v_campagne_id, v_ref_version
  FROM evaluations e
  JOIN campagnes c ON c.id = e.campagne_id
  WHERE e.id = v_eval_id;

  IF NOT FOUND THEN
    -- L'évaluation a été supprimée — ignorer
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
    -- Somme des notes pour cette dimension
    SELECT
      COALESCE(SUM(COALESCE(es.note, 0)), 0),
      COUNT(c.id) * 3  -- max possible
    INTO v_dim_sum, v_dim_max
    FROM criteres c
    LEFT JOIN evaluation_scores es
      ON es.eval_id = v_eval_id
      AND es.critere_code = c.code
    WHERE c.dimension_id = v_dim.dim_id
      AND c.actif = TRUE;

    IF v_dim_max = 0 THEN
      v_dim_score := 0;
    ELSE
      v_dim_score := ROUND((v_dim_sum / v_dim_max) * 100, 2);
    END IF;

    v_score_dim := v_score_dim || jsonb_build_object(v_dim.dim_code, v_dim_score);
    v_dim_scores_sum := v_dim_scores_sum + v_dim_score;
    v_dim_count := v_dim_count + 1;
  END LOOP;

  -- ── 2. Score global (moyenne des dimensions) ───────────────────────────────
  IF v_dim_count = 0 THEN
    v_score_global := 0;
  ELSE
    v_score_global := ROUND(v_dim_scores_sum / v_dim_count, 2);
  END IF;

  -- ── 3. Critères essentiels KO (note = 0 sur critère essentiel) ────────────
  SELECT ARRAY_AGG(c.code)
  INTO v_ko_codes
  FROM criteres c
  JOIN dimensions d ON d.id = c.dimension_id
  JOIN referentiel_versions rv ON rv.id = d.ref_id
  LEFT JOIN evaluation_scores es
    ON es.eval_id = v_eval_id
    AND es.critere_code = c.code
  WHERE rv.version = v_ref_version
    AND c.essentiel = TRUE
    AND c.actif = TRUE
    AND COALESCE(es.note, 0) = 0;

  v_ko_codes := COALESCE(v_ko_codes, '{}');

  -- ── 4. Mise à jour de l'évaluation ────────────────────────────────────────
  UPDATE evaluations
  SET
    score_global        = v_score_global,
    score_par_dimension = v_score_dim,
    updated_at          = NOW()
  WHERE id = v_eval_id;

  -- ── 5. Mise à jour dashboard_stats pour l'ASN ─────────────────────────────
  INSERT INTO dashboard_stats (
    org_id, score_global, score_par_dimension,
    criteres_essentiels_ko, updated_at
  )
  VALUES (
    v_org_id, v_score_global, v_score_dim,
    v_ko_codes, NOW()
  )
  ON CONFLICT (org_id) DO UPDATE SET
    score_global          = EXCLUDED.score_global,
    score_par_dimension   = EXCLUDED.score_par_dimension,
    criteres_essentiels_ko = EXCLUDED.criteres_essentiels_ko,
    updated_at            = NOW();

  -- ── 6. Propagation vers le dashboard_stats de l'OSN parent ────────────────
  SELECT parent_id INTO v_parent_id
  FROM organisations
  WHERE id = v_org_id AND type = 'ASN';

  IF v_parent_id IS NOT NULL THEN
    -- Agréger les scores de toutes les ASN de cet OSN
    SELECT
      jsonb_object_agg(ds.org_id::TEXT, ds.score_global),
      COUNT(DISTINCT o.id),
      COUNT(DISTINCT e.id) FILTER (WHERE e.statut IN ('soumise', 'validee', 'cloturee'))
    INTO v_asn_scores, v_nb_asn, v_nb_soumis
    FROM organisations o
    LEFT JOIN dashboard_stats ds ON ds.org_id = o.id
    LEFT JOIN evaluations e
      ON e.org_id = o.id
      AND e.campagne_id = v_campagne_id
    WHERE o.parent_id = v_parent_id
      AND o.type = 'ASN'
      AND o.actif = TRUE;

    -- Score moyen de l'OSN
    SELECT AVG(value::NUMERIC)
    INTO v_asn_score_val
    FROM jsonb_each_text(COALESCE(v_asn_scores, '{}'));

    -- Taux de complétion
    IF COALESCE(v_nb_asn, 0) > 0 THEN
      v_taux_completion := ROUND((COALESCE(v_nb_soumis, 0)::NUMERIC / v_nb_asn) * 100, 2);
    ELSE
      v_taux_completion := 0;
    END IF;

    INSERT INTO dashboard_stats (
      org_id, score_global, score_par_dimension,
      criteres_essentiels_ko,
      nb_asn, scores_asn, taux_completion_eval,
      updated_at
    )
    VALUES (
      v_parent_id,
      COALESCE(v_asn_score_val, 0),
      '{}',                -- score_par_dimension OSN = agrégat non requis pour MVP
      '{}',
      v_nb_asn,
      COALESCE(v_asn_scores, '{}'),
      v_taux_completion,
      NOW()
    )
    ON CONFLICT (org_id) DO UPDATE SET
      score_global         = COALESCE(v_asn_score_val, 0),
      nb_asn               = v_nb_asn,
      scores_asn           = COALESCE(v_asn_scores, '{}'),
      taux_completion_eval = v_taux_completion,
      updated_at           = NOW();
  END IF;

  RETURN COALESCE(NEW, OLD);

EXCEPTION
  WHEN OTHERS THEN
    -- Ne jamais bloquer l'écriture d'un score pour une erreur de calcul
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
