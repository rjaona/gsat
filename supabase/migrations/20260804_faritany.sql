-- =============================================================================
-- GSAT Digital V2 — Migration « GSAT-Faritany »
-- Date    : 2026-08-04
-- Réf.    : docs/GSAT-Faritany_Note-de-conception.md v0.3
-- Cible   : Supabase / PostgreSQL (self-hosted VPS)
--
-- Cette migration est ADDITIVE : aucune colonne existante n'est modifiée ni
-- supprimée, aucune donnée existante n'est touchée. Elle est réversible
-- (bloc de rollback commenté en fin de fichier).
--
-- ORDRE D'EXÉCUTION — IMPORTANT
--   PARTIE 0 : ALTER TYPE ... ADD VALUE. À exécuter SEULE et à committer avant
--              la suite : PostgreSQL interdit d'utiliser une valeur d'ENUM
--              ajoutée dans la même transaction.
--   PARTIES 1 à 7 : peuvent s'exécuter dans une seule transaction.
-- =============================================================================


-- =============================================================================
-- PARTIE 0 — Nouvelles valeurs d'ENUM (À EXÉCUTER SEULE, PUIS COMMIT)
-- =============================================================================

-- Rôle du comité Faritany habilité à auto-valider SA PROPRE évaluation.
ALTER TYPE user_role  ADD VALUE IF NOT EXISTS 'responsable_asn';

-- Notifications produites par le module Pilotage & alertes.
ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'alerte_critique';
ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'alerte_incoherence';
ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'snapshot_erp_recu';
ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'evaluation_auto_validee';
ALTER TYPE notif_type ADD VALUE IF NOT EXISTS 'revue_echeance_proche';

-- >>> COMMIT ICI avant de continuer <<<


-- =============================================================================
-- PARTIE 1 — Référentiel : traçabilité GSAT, socle/extension, malgache
-- =============================================================================

BEGIN;

-- 1.1 Versions de référentiel : niveau visé + filiation vers le standard parent
ALTER TABLE referentiel_versions
  ADD COLUMN IF NOT EXISTS niveau         org_type,   -- 'OSN' = GSAT national, 'ASN' = GSAT-Faritany
  ADD COLUMN IF NOT EXISTS parent_version TEXT,       -- 'v3_0' pour far_v1_0
  ADD COLUMN IF NOT EXISTS nom_mg         TEXT;

COMMENT ON COLUMN referentiel_versions.niveau IS
  'Niveau d''organisation auquel ce référentiel s''applique. NULL = OSN (rétrocompatibilité).';
COMMENT ON COLUMN referentiel_versions.parent_version IS
  'Version du référentiel dont celui-ci dérive. Permet de détecter les critères orphelins lors d''un changement de standard (GSAT V3.0 → V4.0).';

-- Le référentiel GSAT existant est un référentiel de niveau OSN.
UPDATE referentiel_versions SET niveau = 'OSN' WHERE niveau IS NULL;

-- 1.2 Dimensions : libellé malgache
ALTER TABLE dimensions
  ADD COLUMN IF NOT EXISTS nom_mg TEXT;

-- 1.3 Critères : filiation, socle/extension, indicateur ERP, malgache
ALTER TABLE criteres
  ADD COLUMN IF NOT EXISTS source_codes   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS socle          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS indicateur_erp TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS libelle_mg     TEXT,
  ADD COLUMN IF NOT EXISTS guide_mg       TEXT;

COMMENT ON COLUMN criteres.source_codes IS
  'Codes des critères du référentiel parent dont ce critère dérive. C''est la colonne qui rend calculable l''Indice de Déploiement (note §6).';
COMMENT ON COLUMN criteres.socle IS
  'TRUE = critère du socle obligatoire. FALSE = extension, saisissable mais hors score quand la campagne est en mode socle.';
COMMENT ON COLUMN criteres.indicateur_erp IS
  'Clés d''indicateurs ERP éclairant ce critère. Noms provisoires — à rapprocher du modèle ERPTEM réel au moment de l''import.';

CREATE INDEX IF NOT EXISTS idx_crit_socle  ON criteres(socle)  WHERE actif = TRUE;
CREATE INDEX IF NOT EXISTS idx_crit_source ON criteres USING GIN (source_codes);


-- =============================================================================
-- PARTIE 2 — Campagnes : mode socle / complet
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campagne_mode') THEN
    CREATE TYPE campagne_mode AS ENUM ('socle', 'complet');
  END IF;
END $$;

ALTER TABLE campagnes
  ADD COLUMN IF NOT EXISTS mode campagne_mode NOT NULL DEFAULT 'complet';

COMMENT ON COLUMN campagnes.mode IS
  'socle = seuls les critères socle=TRUE entrent dans le score ; les autres restent saisissables et stockés. Cycle 1 Faritany = socle.';


-- =============================================================================
-- PARTIE 3 — Workflow : auto-validation Faritany + revue nationale a posteriori
-- =============================================================================

ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS validee_par        UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validee_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pv_comite_path     TEXT,          -- PV de comité justifiant l'auto-validation
  ADD COLUMN IF NOT EXISTS revue_echeance_at  TIMESTAMPTZ,   -- validee_at + délai de revue
  ADD COLUMN IF NOT EXISTS revue_par          UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revue_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revue_motif        TEXT,          -- obligatoire si verdict = revision_requested
  ADD COLUMN IF NOT EXISTS cloturee_auto      BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN evaluations.revue_echeance_at IS
  'Date au-delà de laquelle l''évaluation se clôture automatiquement faute de revue nationale. Le national ne peut pas bloquer un Faritany par son inaction.';

CREATE INDEX IF NOT EXISTS idx_eval_revue_due
  ON evaluations(revue_echeance_at)
  WHERE statut = 'validee' AND revue_at IS NULL;

-- Délai de revue configurable par organisation (défaut 60 jours)
ALTER TABLE system_config
  ADD COLUMN IF NOT EXISTS revue_delai_jours     INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS libelle_niveau_local  TEXT    NOT NULL DEFAULT 'ASN';

COMMENT ON COLUMN system_config.libelle_niveau_local IS
  'Nom affiché du niveau ASN pour cette OSN. TEM Madagascar : "Faritany".';

-- Pondération des organisations pour la consolidation (effectif, ou 1 par défaut).
-- Alimentée par l'ERP quand il est branché ; sans ERP la moyenne reste simple.
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS poids NUMERIC(10,2) NOT NULL DEFAULT 1;

COMMENT ON COLUMN organisations.poids IS
  'Poids de consolidation (typiquement l''effectif). Défaut 1 = moyenne simple.';


-- =============================================================================
-- PARTIE 4 — Snapshots ERP
-- =============================================================================

CREATE TABLE IF NOT EXISTS erp_snapshots (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID        NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  source       TEXT        NOT NULL DEFAULT 'csv',   -- 'erptem' | 'csv' | 'manuel'
  periode      DATE        NOT NULL,                 -- 1er du mois de référence
  indicateurs  JSONB       NOT NULL DEFAULT '{}',    -- { "pct_adultes_formes_sfh": 29, ... }
  completude   NUMERIC(5,2),                         -- % d'indicateurs attendus réellement renseignés
  importe_par  UUID        REFERENCES users(id) ON DELETE SET NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, source, periode)
);

CREATE INDEX IF NOT EXISTS idx_erp_snap_org ON erp_snapshots(org_id, periode DESC);

COMMENT ON TABLE erp_snapshots IS
  'Photo périodique des indicateurs ERP par organisation. JSONB délibéré : le catalogue bougera, et une OSN sans ERP doit pouvoir en renseigner 3 sur 20.';
COMMENT ON COLUMN erp_snapshots.completude IS
  'Sous le seuil configuré (70 % par défaut), aucune alerte de type derive_erp ou incoherence ne se déclenche. Une donnée absente n''est pas une donnée mauvaise.';

-- Vue pratique : dernier snapshot connu par organisation
CREATE OR REPLACE VIEW v_erp_snapshot_courant AS
SELECT DISTINCT ON (org_id)
  org_id, source, periode, indicateurs, completude, collected_at
FROM erp_snapshots
ORDER BY org_id, periode DESC, collected_at DESC;

-- security_invoker : sans cela la vue s'exécute avec les droits de son
-- propriétaire et CONTOURNE la RLS de erp_snapshots (elle exposerait les
-- snapshots d'un autre Faritany). La vue doit respecter erp_snap_select.
ALTER VIEW v_erp_snapshot_courant SET (security_invoker = on);

-- Moyenne nationale exposée aux ASN : la RLS de dashboard_stats interdit à une
-- ASN de lire la ligne consolidée de son OSN (lecture montante). Cette fonction
-- SECURITY DEFINER ne rend QUE l'agrégat non sensible (score global + par
-- dimension) de l'OSN parente — jamais scores_asn/essentiels_ko_par_org, qui
-- révéleraient les autres Faritany (cf. règle d'isolation Faritany A ≠ B).
CREATE OR REPLACE FUNCTION public.fn_moyenne_nationale(p_org_id uuid)
RETURNS TABLE (score_global numeric, score_par_dimension jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ds.score_global, ds.score_par_dimension
  FROM dashboard_stats ds
  JOIN organisations self ON self.parent_id = ds.org_id
  WHERE self.id = p_org_id
$$;
REVOKE ALL ON FUNCTION public.fn_moyenne_nationale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_moyenne_nationale(uuid) TO authenticated;


-- =============================================================================
-- PARTIE 5 — Moteur d'alertes et bibliothèque d'actions types
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alerte_type') THEN
    CREATE TYPE alerte_type AS ENUM ('conformite','derive_erp','incoherence','echeance','inactivite');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alerte_severite') THEN
    CREATE TYPE alerte_severite AS ENUM ('info','vigilance','critique');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alerte_statut') THEN
    CREATE TYPE alerte_statut AS ENUM ('ouverte','prise_en_compte','resolue','ignoree');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS action_templates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  critere_code TEXT            NOT NULL,
  objectif     TEXT            NOT NULL,
  description  TEXT            NOT NULL DEFAULT '',
  kpi_suggere  TEXT,                       -- idéalement une clé d'indicateur ERP → suivi automatique
  duree_jours  INTEGER         NOT NULL DEFAULT 180,
  priorite     action_priorite NOT NULL DEFAULT 'moyenne',
  actif        BOOLEAN         NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_action_tpl_critere ON action_templates(critere_code) WHERE actif = TRUE;

CREATE TABLE IF NOT EXISTS alerte_regles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id         UUID REFERENCES organisations(id) ON DELETE CASCADE,  -- NULL = règle globale
  code           TEXT            NOT NULL,
  type           alerte_type     NOT NULL,
  severite       alerte_severite NOT NULL DEFAULT 'vigilance',
  expression     JSONB           NOT NULL,   -- { indicateur, operateur, seuil } | { critere, condition }
  hysteresis     NUMERIC(5,2)    NOT NULL DEFAULT 10,  -- marge de réarmement, cf. note §5.4
  message_fr     TEXT            NOT NULL,
  message_mg     TEXT,
  action_template_id UUID REFERENCES action_templates(id) ON DELETE SET NULL,
  destinataires  TEXT[]          NOT NULL DEFAULT '{asn}',  -- 'asn' | 'osn'
  actif          BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  UNIQUE(org_id, code)
);

CREATE TABLE IF NOT EXISTS alertes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       UUID            NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  regle_id     UUID            REFERENCES alerte_regles(id) ON DELETE SET NULL,
  type         alerte_type     NOT NULL,
  severite     alerte_severite NOT NULL,
  titre        TEXT            NOT NULL,
  detail       TEXT,
  critere_code TEXT,
  valeur       JSONB,                       -- valeurs au moment du déclenchement
  statut       alerte_statut   NOT NULL DEFAULT 'ouverte',
  motif_ignore TEXT,                        -- obligatoire si statut = 'ignoree'
  action_id    UUID            REFERENCES plan_actions(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,

  CONSTRAINT chk_motif_ignore CHECK (statut <> 'ignoree' OR motif_ignore IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_alertes_org
  ON alertes(org_id, statut, severite, created_at DESC);

-- Une seule alerte ouverte par (org, règle) — évite le bruit répétitif
CREATE UNIQUE INDEX IF NOT EXISTS idx_alertes_unique_ouverte
  ON alertes(org_id, regle_id)
  WHERE statut IN ('ouverte', 'prise_en_compte');

COMMENT ON TABLE alertes IS
  'Au plus 5 alertes ouvertes affichées par organisation, triées par sévérité. Une liste de 30 alertes ne se traite pas, elle se referme.';


-- =============================================================================
-- PARTIE 6 — dashboard_stats : consolidation enrichie (défauts C1, C2, C3)
-- =============================================================================

ALTER TABLE dashboard_stats
  ADD COLUMN IF NOT EXISTS referentiel_version    TEXT,
  ADD COLUMN IF NOT EXISTS essentiels_ko_par_org  JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nb_asn_avec_essentiel_ko INTEGER,
  ADD COLUMN IF NOT EXISTS indice_vigilance       NUMERIC(5,2);

COMMENT ON COLUMN dashboard_stats.referentiel_version IS
  'C3 — la consolidation ne mélange que des évaluations partageant la même version de référentiel.';
COMMENT ON COLUMN dashboard_stats.essentiels_ko_par_org IS
  'C2 — { "<orgId>": ["F401","F405"] }. Remonte au niveau OSN quel Faritany est en défaut, et sur quoi.';

COMMIT;


-- =============================================================================
-- PARTIE 7 — fn_recalculate_scores corrigée (C1 à C4)
--
--   C1 : score_par_dimension consolidé au niveau OSN (était '{}' en dur)
--   C2 : critères essentiels KO remontés au niveau OSN, avec leur Faritany
--   C3 : consolidation restreinte à une même referentiel_version
--   C4 : un N/A (ligne de score présente, note NULL) sort du dénominateur
--        au lieu d'être compté comme un 0
--   + mode socle : seuls les critères socle=TRUE entrent dans le score
--   + pondération par organisations.poids (défaut 1 = moyenne simple)
-- =============================================================================

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

-- Le trigger on_score_write existant pointe déjà sur cette fonction — rien à refaire.


-- =============================================================================
-- PARTIE 7 bis — Clôture automatique des évaluations non revues
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_cloturer_evaluations_non_revues()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n INTEGER;
BEGIN
  UPDATE evaluations
  SET statut        = 'cloturee',
      cloturee_auto = TRUE,
      updated_at    = NOW()
  WHERE statut = 'validee'
    AND revue_at IS NULL
    AND revue_echeance_at IS NOT NULL
    AND revue_echeance_at < NOW();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

SELECT cron.schedule(
  'cloturer-evaluations-non-revues',
  '30 2 * * *',                     -- tous les jours à 02h30
  $$ SELECT fn_cloturer_evaluations_non_revues(); $$
);


-- =============================================================================
-- PARTIE 8 — RLS des nouvelles tables
-- =============================================================================

ALTER TABLE erp_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerte_regles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_templates ENABLE ROW LEVEL SECURITY;

-- ── erp_snapshots : on voit son org, l'OSN voit ses ASN, l'admin voit tout ──
CREATE POLICY erp_snap_select ON erp_snapshots
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
    OR (
      (auth.jwt() ->> 'role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = erp_snapshots.org_id
          AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

CREATE POLICY erp_snap_write ON erp_snapshots
  FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'role') IN ('admin_global', 'responsable_osn'))
  WITH CHECK ((auth.jwt() ->> 'role') IN ('admin_global', 'responsable_osn'));

-- ── alertes : mêmes règles de visibilité ; l'écriture passe par le moteur ───
CREATE POLICY alertes_select ON alertes
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
    OR (
      (auth.jwt() ->> 'role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = alertes.org_id
          AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- Seul le changement de statut est ouvert côté client : on ne fabrique pas
-- une alerte à la main, on la traite.
CREATE POLICY alertes_update_statut ON alertes
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- ── Règles et modèles d'action : lecture pour tous, écriture admin ─────────
CREATE POLICY alerte_regles_select ON alerte_regles
  FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = (auth.jwt() ->> 'org_id')::uuid
         OR (auth.jwt() ->> 'role') = 'admin_global');

CREATE POLICY alerte_regles_write ON alerte_regles
  FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'role') IN ('admin_global', 'responsable_osn'))
  WITH CHECK ((auth.jwt() ->> 'role') IN ('admin_global', 'responsable_osn'));

CREATE POLICY action_tpl_select ON action_templates
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY action_tpl_write ON action_templates
  FOR ALL TO authenticated
  USING      ((auth.jwt() ->> 'role') IN ('admin_global', 'responsable_osn'))
  WITH CHECK ((auth.jwt() ->> 'role') IN ('admin_global', 'responsable_osn'));


-- =============================================================================
-- PARTIE 9 — RLS : le rôle responsable_asn
--
-- Il peut TOUT faire sur les évaluations de SA PROPRE organisation, y compris
-- les faire passer en 'validee'. Il ne peut RIEN faire sur celles des autres,
-- et il ne peut pas clôturer — la clôture reste au national ou au cron.
-- =============================================================================

CREATE POLICY evals_select_resp_asn ON evaluations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'responsable_asn'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY evals_insert_resp_asn ON evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'responsable_asn'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
  );

CREATE POLICY evals_update_resp_asn ON evaluations
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'responsable_asn'
    AND org_id = (auth.jwt() ->> 'org_id')::uuid
    AND statut IN ('brouillon', 'en_cours')      -- on ne rouvre pas une éval validée
  )
  WITH CHECK (
    org_id = (auth.jwt() ->> 'org_id')::uuid
    AND statut IN ('brouillon', 'en_cours', 'validee')  -- validee = auto-validation autorisée
  );

-- Revue nationale : un relecteur (OSN / région / admin) arbitre une évaluation
-- VALIDÉE de son sous-arbre → clôturée (approuvée) ou renvoyée en_cours (révision).
-- La policy evals_update de base a un WITH CHECK NUL (donc = USING, qui exige
-- statut IN soumise/validee ET l'org du relecteur) et rejette ce résultat :
-- d'où cette policy dédiée, sans laquelle revoirEvaluation échoue en RLS.
CREATE POLICY evals_update_revue ON evaluations
  FOR UPDATE TO authenticated
  USING (
    statut = 'validee'
    AND (
      (auth.jwt() ->> 'role') = 'admin_global'
      OR ((auth.jwt() ->> 'role') = 'responsable_osn' AND EXISTS (
            SELECT 1 FROM organisations o
            WHERE o.id = evaluations.org_id
              AND (o.id = (auth.jwt() ->> 'org_id')::uuid
                   OR o.parent_id = (auth.jwt() ->> 'org_id')::uuid)))
      OR ((auth.jwt() ->> 'role') = 'responsable_region' AND EXISTS (
            SELECT 1 FROM organisations o
            JOIN organisations p ON p.id = o.parent_id
            WHERE o.id = evaluations.org_id
              AND p.parent_id = (auth.jwt() ->> 'org_id')::uuid))
    )
  )
  WITH CHECK (
    statut IN ('cloturee', 'en_cours')   -- les deux issues de l'arbitrage
  );

-- Garde-fou serveur : le PV de comité est obligatoire pour auto-valider,
-- et l'échéance de revue est posée automatiquement.
CREATE OR REPLACE FUNCTION fn_garde_auto_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_delai INTEGER;
BEGIN
  IF NEW.statut = 'validee' AND COALESCE(OLD.statut, 'brouillon') <> 'validee' THEN
    IF NEW.pv_comite_path IS NULL OR NEW.pv_comite_path = '' THEN
      RAISE EXCEPTION 'Auto-validation impossible : le PV de comité est obligatoire.';
    END IF;

    SELECT COALESCE(sc.revue_delai_jours, 60) INTO v_delai
    FROM organisations o
    LEFT JOIN system_config sc ON sc.org_id = o.parent_id
    WHERE o.id = NEW.org_id;

    NEW.validee_at        := COALESCE(NEW.validee_at, NOW());
    NEW.validee_par       := COALESCE(NEW.validee_par, auth.uid());
    NEW.revue_echeance_at := NEW.validee_at + (COALESCE(v_delai, 60) || ' days')::INTERVAL;
  END IF;

  IF NEW.reviewer_verdict = 'revision_requested'
     AND (NEW.revue_motif IS NULL OR NEW.revue_motif = '') THEN
    RAISE EXCEPTION 'Un renvoi en révision exige un motif.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_garde_auto_validation ON evaluations;
CREATE TRIGGER trg_garde_auto_validation
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION fn_garde_auto_validation();

-- Scores et preuves : accès aligné sur l'évaluation
CREATE POLICY scores_resp_asn ON evaluation_scores
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'responsable_asn'
    AND EXISTS (SELECT 1 FROM evaluations e
                WHERE e.id = evaluation_scores.eval_id
                  AND e.org_id = (auth.jwt() ->> 'org_id')::uuid)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM evaluations e
            WHERE e.id = evaluation_scores.eval_id
              AND e.org_id = (auth.jwt() ->> 'org_id')::uuid
              AND e.statut IN ('brouillon', 'en_cours'))
  );

CREATE POLICY preuves_resp_asn ON evaluation_preuves
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'responsable_asn'
    AND EXISTS (SELECT 1 FROM evaluations e
                WHERE e.id = evaluation_preuves.eval_id
                  AND e.org_id = (auth.jwt() ->> 'org_id')::uuid)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM evaluations e
            WHERE e.id = evaluation_preuves.eval_id
              AND e.org_id = (auth.jwt() ->> 'org_id')::uuid)
  );


-- =============================================================================
-- ROLLBACK (à décommenter en cas de besoin)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_garde_auto_validation ON evaluations;
-- DROP FUNCTION IF EXISTS fn_garde_auto_validation();
-- SELECT cron.unschedule('cloturer-evaluations-non-revues');
-- DROP FUNCTION IF EXISTS fn_cloturer_evaluations_non_revues();
-- DROP VIEW  IF EXISTS v_erp_snapshot_courant;
-- DROP TABLE IF EXISTS alertes, alerte_regles, action_templates, erp_snapshots CASCADE;
-- DROP TYPE  IF EXISTS alerte_statut, alerte_severite, alerte_type, campagne_mode;
-- ALTER TABLE criteres      DROP COLUMN IF EXISTS source_codes, DROP COLUMN IF EXISTS socle,
--                           DROP COLUMN IF EXISTS indicateur_erp, DROP COLUMN IF EXISTS libelle_mg,
--                           DROP COLUMN IF EXISTS guide_mg;
-- ALTER TABLE campagnes     DROP COLUMN IF EXISTS mode;
-- ALTER TABLE organisations DROP COLUMN IF EXISTS poids;
-- (les valeurs d'ENUM ajoutées ne sont pas supprimables sans recréer le type)
