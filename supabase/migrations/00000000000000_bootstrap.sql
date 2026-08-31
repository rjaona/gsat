-- =============================================================================
-- BOOTSTRAP MIGRATION: Baseline schema as deployed to prod April 2026.
-- This migration exists solely so that `supabase db reset` produces a
-- working local database. It was NOT applied via `supabase migration`
-- on prod. Do NOT run `supabase db push` against prod.
--
-- Contents (in order):
--   1. schema.sql      — DDL: extensions, enums, tables, indexes, updated_at triggers
--   2. hook            — custom_access_token_hook (JWT claims injection)
--   3. trigger         — fn_recalculate_scores (original April version, replaced by
--                        20260804_faritany.sql with corrected socle/N-A version)
--   4. rls_policies    — Row Level Security policies + guard + audit RPC
-- =============================================================================

-- =============================================================================
-- GSAT Digital V2 — Schéma PostgreSQL (migration Firebase → Supabase)
-- Instance : self-hosted VPS Hostinger KVM2
-- Auteur   : architecture-agent
-- Date     : 2026-04-10
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";       -- pour onCampagneClose scheduled
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- recherche textuelle si besoin

-- ---------------------------------------------------------------------------
-- Types ENUM
-- ---------------------------------------------------------------------------

CREATE TYPE org_type         AS ENUM ('OMMS', 'REGION', 'OSN', 'ASN');
CREATE TYPE region_code      AS ENUM ('AFRICA', 'ASIA_PACIFIC', 'ARAB', 'INTERAMERICA', 'EUROPE', 'EURASIA');
CREATE TYPE user_role        AS ENUM ('admin_global', 'responsable_region', 'responsable_osn', 'utilisateur_asn', 'evaluateur', 'lecteur');
CREATE TYPE campagne_statut  AS ENUM ('planifiee', 'ouverte', 'fermee', 'archivee');
CREATE TYPE eval_statut      AS ENUM ('brouillon', 'en_cours', 'soumise', 'validee', 'cloturee');
CREATE TYPE eval_type        AS ENUM ('auto', 'accompagnee');
CREATE TYPE plan_statut      AS ENUM ('brouillon', 'actif', 'cloture');
CREATE TYPE action_statut    AS ENUM ('a_faire', 'en_cours', 'termine', 'bloque');
CREATE TYPE action_priorite  AS ENUM ('basse', 'moyenne', 'haute', 'critique');
CREATE TYPE audit_action     AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'submit', 'validate', 'close');
CREATE TYPE reviewer_verdict AS ENUM ('approved', 'approved_with_conditions', 'revision_requested');
CREATE TYPE notif_type       AS ENUM (
  'evaluation_created', 'evaluation_submitted', 'evaluation_validated', 'evaluation_rejected',
  'campagne_opened', 'campagne_closed',
  'workflow_assigned', 'workflow_approved', 'workflow_renvoye',
  'action_overdue', 'user_created', 'comment_added', 'system'
);

-- ---------------------------------------------------------------------------
-- Table : pays
-- Correspond à : pays/{paysId}
-- ---------------------------------------------------------------------------
CREATE TABLE pays (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code_iso    CHAR(2)     NOT NULL UNIQUE,             -- ISO 3166-1 alpha-2
  nom_fr      TEXT        NOT NULL,
  nom_en      TEXT        NOT NULL,
  region_code region_code NOT NULL,
  actif       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pays_region ON pays(region_code);

-- ---------------------------------------------------------------------------
-- Table : organisations
-- Correspond à : organisations/{orgId}
-- ---------------------------------------------------------------------------
CREATE TABLE organisations (
  id           UUID      PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         org_type  NOT NULL,
  nom          TEXT      NOT NULL,
  code         TEXT,                                  -- ex: 'TEM'
  parent_id    UUID      REFERENCES organisations(id) ON DELETE RESTRICT,
  pays_id      UUID      REFERENCES pays(id)          ON DELETE SET NULL,
  region_code  region_code,
  actif        BOOLEAN   NOT NULL DEFAULT TRUE,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_org_type       ON organisations(type);
CREATE INDEX idx_org_parent     ON organisations(parent_id);
CREATE INDEX idx_org_pays       ON organisations(pays_id);
CREATE INDEX idx_org_actif      ON organisations(actif);

-- ---------------------------------------------------------------------------
-- Table : users
-- Étend auth.users de Supabase (même UUID que auth.uid)
-- Correspond à : users/{uid}
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        UUID        NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  org_type      org_type    NOT NULL,
  parent_org_id UUID        REFERENCES organisations(id) ON DELETE SET NULL,
  nom           TEXT        NOT NULL,
  prenom        TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'lecteur',
  actif         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_org      ON users(org_id);
CREATE INDEX idx_users_role     ON users(role);
CREATE INDEX idx_users_actif    ON users(actif);

-- ---------------------------------------------------------------------------
-- Référentiel — tables normalisées
-- Correspond à : referentiel/{version} (objet imbriqué dimensions[].criteres[])
-- ---------------------------------------------------------------------------

CREATE TABLE referentiel_versions (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  version    TEXT        NOT NULL UNIQUE,             -- '3.0'
  nom_fr     TEXT        NOT NULL,
  nom_en     TEXT        NOT NULL,
  actif      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dimensions (
  id           UUID   PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref_id       UUID   NOT NULL REFERENCES referentiel_versions(id) ON DELETE CASCADE,
  code         TEXT   NOT NULL,                       -- 'D01' … 'D10'
  nom_fr       TEXT   NOT NULL,
  nom_en       TEXT   NOT NULL,
  ordre        SMALLINT NOT NULL DEFAULT 0,
  UNIQUE(ref_id, code)
);

CREATE INDEX idx_dim_ref ON dimensions(ref_id);

CREATE TABLE criteres (
  id                    UUID     PRIMARY KEY DEFAULT uuid_generate_v4(),
  dimension_id          UUID     NOT NULL REFERENCES dimensions(id) ON DELETE CASCADE,
  code                  TEXT     NOT NULL,            -- '101', '217'
  libelle_fr            TEXT     NOT NULL,
  libelle_en            TEXT     NOT NULL,
  guide_fr              TEXT,
  guide_en              TEXT,
  essentiel             BOOLEAN  NOT NULL DEFAULT FALSE,
  actif                 BOOLEAN  NOT NULL DEFAULT TRUE,
  ordre                 SMALLINT NOT NULL DEFAULT 0,
  UNIQUE(dimension_id, code)
);

CREATE INDEX idx_crit_dimension  ON criteres(dimension_id);
CREATE INDEX idx_crit_essentiel  ON criteres(essentiel) WHERE actif = TRUE;

-- Historique des modifications du référentiel
-- Correspond à : referentiel/{version}/history/{docId}
CREATE TABLE referentiel_history (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref_id      UUID        NOT NULL REFERENCES referentiel_versions(id) ON DELETE CASCADE,
  modified_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  diff        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Table : campagnes
-- Correspond à : campagnes/{campagneId}
-- ---------------------------------------------------------------------------
CREATE TABLE campagnes (
  id                   UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisateur_id      UUID             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  referentiel_version  TEXT             NOT NULL,
  nom                  TEXT             NOT NULL,
  description          TEXT,
  date_ouverture       TIMESTAMPTZ      NOT NULL,
  date_fermeture       TIMESTAMPTZ      NOT NULL,
  statut               campagne_statut  NOT NULL DEFAULT 'planifiee',
  perimetre            UUID[]           NOT NULL DEFAULT '{}',   -- orgIds ciblés, vide = toutes ASN
  evaluateur_id        UUID             REFERENCES users(id) ON DELETE SET NULL,
  evaluateur_name      TEXT,
  reviewer_id          UUID             REFERENCES users(id) ON DELETE SET NULL,
  reviewer_name        TEXT,
  approbateur_id       UUID             REFERENCES users(id) ON DELETE SET NULL,
  approbateur_name     TEXT,
  created_by           UUID             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_dates CHECK (date_fermeture > date_ouverture)
);

CREATE INDEX idx_campagne_statut    ON campagnes(statut);
CREATE INDEX idx_campagne_ouverture ON campagnes(date_ouverture DESC);

-- ---------------------------------------------------------------------------
-- Table : evaluations
-- Correspond à : evaluations/{evalId}
-- ---------------------------------------------------------------------------
CREATE TABLE evaluations (
  id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  campagne_id              UUID          NOT NULL REFERENCES campagnes(id)     ON DELETE RESTRICT,
  org_id                   UUID          NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  type                     eval_type     NOT NULL,
  statut                   eval_statut   NOT NULL DEFAULT 'brouillon',
  score_global             NUMERIC(5,2),                -- 0–100, calculé par trigger
  score_par_dimension      JSONB,                       -- {"D01": 75.5, "D02": 60.0, ...}
  submitted_by             UUID          REFERENCES users(id) ON DELETE SET NULL,
  submitted_at             TIMESTAMPTZ,
  reviewer_name            TEXT,
  reviewer_title           TEXT,
  reviewer_avatar          TEXT,
  reviewer_recommendation  TEXT,
  reviewer_verdict         reviewer_verdict,
  created_by               UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Remplace la collection evaluation_locks : unicité org × campagne enforced par UNIQUE
  UNIQUE(org_id, campagne_id)
);

CREATE INDEX idx_eval_campagne  ON evaluations(campagne_id);
CREATE INDEX idx_eval_org       ON evaluations(org_id);
CREATE INDEX idx_eval_statut    ON evaluations(statut);
CREATE INDEX idx_eval_created   ON evaluations(created_at DESC);

-- ---------------------------------------------------------------------------
-- Table : evaluation_scores
-- Correspond à : evaluations/{evalId}/scores/{critereCode}
-- ---------------------------------------------------------------------------
CREATE TABLE evaluation_scores (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  eval_id      UUID        NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  critere_code TEXT        NOT NULL,
  note         SMALLINT    CHECK (note BETWEEN 0 AND 3),
  commentaire  TEXT,
  updated_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(eval_id, critere_code)
);

CREATE INDEX idx_scores_eval ON evaluation_scores(eval_id);

-- ---------------------------------------------------------------------------
-- Table : evaluation_preuves
-- Fusionne : evaluations/{evalId}/preuves/{id} + preuves/{id}
-- Correspond à : Supabase Storage pour le fichier physique
-- ---------------------------------------------------------------------------
CREATE TABLE evaluation_preuves (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  eval_id      UUID        NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  critere_code TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,   -- chemin dans Supabase Storage bucket 'preuves'
  nom          TEXT        NOT NULL,
  type_mime    TEXT        NOT NULL,
  taille       BIGINT      NOT NULL,   -- octets
  uploaded_by  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preuves_eval        ON evaluation_preuves(eval_id);
CREATE INDEX idx_preuves_critere     ON evaluation_preuves(eval_id, critere_code);

-- ---------------------------------------------------------------------------
-- Table : plans_action
-- Correspond à : plansAction/{planId}
-- ---------------------------------------------------------------------------
CREATE TABLE plans_action (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  eval_id    UUID         NOT NULL REFERENCES evaluations(id) ON DELETE RESTRICT,
  org_id     UUID         NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  statut     plan_statut  NOT NULL DEFAULT 'brouillon',
  created_by UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE(eval_id)   -- B13 : un seul plan par évaluation
);

CREATE INDEX idx_plan_org  ON plans_action(org_id);
CREATE INDEX idx_plan_eval ON plans_action(eval_id);

-- ---------------------------------------------------------------------------
-- Table : plan_actions
-- Correspond à : plansAction/{planId}/actions/{actionId}
-- ---------------------------------------------------------------------------
CREATE TABLE plan_actions (
  id                    UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id               UUID            NOT NULL REFERENCES plans_action(id) ON DELETE CASCADE,
  critere_code          TEXT,
  domaine_amelioration  TEXT            NOT NULL,
  objectif              TEXT            NOT NULL,
  description           TEXT            NOT NULL DEFAULT '',
  responsable           TEXT            NOT NULL DEFAULT '',
  date_debut            TIMESTAMPTZ,
  date_echeance         TIMESTAMPTZ     NOT NULL,
  ressources_disponibles TEXT,
  ressources_necessaires TEXT,
  kpis                  TEXT,
  statut                action_statut   NOT NULL DEFAULT 'a_faire',
  priorite              action_priorite NOT NULL DEFAULT 'moyenne',
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_action_plan    ON plan_actions(plan_id);
CREATE INDEX idx_action_statut  ON plan_actions(statut);

-- ---------------------------------------------------------------------------
-- Table : action_suivis
-- Correspond à : plansAction/{planId}/actions/{actionId}/suivis/{suiviId}
-- ---------------------------------------------------------------------------
CREATE TABLE action_suivis (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_id      UUID          NOT NULL REFERENCES plan_actions(id) ON DELETE CASCADE,
  commentaire    TEXT          NOT NULL,
  ancien_statut  action_statut NOT NULL,
  nouveau_statut action_statut NOT NULL,
  preuve_path    TEXT,
  created_by     UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suivi_action ON action_suivis(action_id);

-- ---------------------------------------------------------------------------
-- Table : dashboard_stats
-- Correspond à : dashboardStats/{orgId} — anciennement écrit par Cloud Functions
-- Désormais maintenu par trigger on_score_write
-- ---------------------------------------------------------------------------
CREATE TABLE dashboard_stats (
  org_id                UUID        PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  score_global          NUMERIC(5,2),
  score_par_dimension   JSONB       NOT NULL DEFAULT '{}',
  criteres_essentiels_ko TEXT[]     NOT NULL DEFAULT '{}',
  nb_asn                INTEGER,
  scores_asn            JSONB       NOT NULL DEFAULT '{}',  -- { asnId: score }
  taux_completion_eval  NUMERIC(5,2),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Table : audit_log
-- Correspond à : auditLog/{entryId}
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email  TEXT         NOT NULL,
  action      audit_action NOT NULL,
  resource    TEXT         NOT NULL,
  resource_id TEXT         NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user     ON audit_log(user_id);
CREATE INDEX idx_audit_action   ON audit_log(action);
CREATE INDEX idx_audit_resource ON audit_log(resource, resource_id);
CREATE INDEX idx_audit_created  ON audit_log(created_at DESC);

-- ---------------------------------------------------------------------------
-- Table : notifications
-- Correspond à : notifications/{notifId}
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id            UUID       PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          notif_type NOT NULL,
  title         TEXT       NOT NULL,
  message       TEXT       NOT NULL,
  recipient_id  UUID       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id     UUID       REFERENCES users(id) ON DELETE SET NULL,
  sender_name   TEXT,
  resource_type TEXT,
  resource_id   TEXT,
  read          BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_recipient ON notifications(recipient_id, read, created_at DESC);

-- ---------------------------------------------------------------------------
-- Table : system_config
-- Une ligne par organisation avec toutes les préférences en colonnes plates.
-- ---------------------------------------------------------------------------
CREATE TABLE system_config (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID        NOT NULL UNIQUE REFERENCES organisations(id) ON DELETE CASCADE,
  site_name       TEXT        NOT NULL DEFAULT 'GSAT Enterprise Global',
  primary_lang    TEXT        NOT NULL DEFAULT 'fr',
  timezone        TEXT        NOT NULL DEFAULT 'UTC+3',
  email_alerts    BOOLEAN     NOT NULL DEFAULT TRUE,
  critical_only   BOOLEAN     NOT NULL DEFAULT FALSE,
  digest_freq     TEXT        NOT NULL DEFAULT 'weekly',
  mfa             BOOLEAN     NOT NULL DEFAULT TRUE,
  session_timeout TEXT        NOT NULL DEFAULT '120',
  audit_log       BOOLEAN     NOT NULL DEFAULT TRUE,
  ip_whitelist    BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Table : rate_limits
-- Correspond à : rateLimits/{docId} — implémenté en base pour cohérence
-- ---------------------------------------------------------------------------
CREATE TABLE rate_limits (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  key        TEXT        NOT NULL UNIQUE,   -- ex: 'chatWithAi:{userId}'
  count      INTEGER     NOT NULL DEFAULT 0,
  window_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TRIGGERS updated_at automatiques
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_organisations  BEFORE UPDATE ON organisations  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_users          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_campagnes      BEFORE UPDATE ON campagnes      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_evaluations    BEFORE UPDATE ON evaluations    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_plans_action   BEFORE UPDATE ON plans_action   FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_plan_actions   BEFORE UPDATE ON plan_actions   FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- Custom Access Token Hook — Supabase
-- Injecte user_role, org_id, org_type, parent_org_id dans le JWT à chaque
-- émission de token (login + refresh). Le rôle applicatif est exposé sous
-- 'user_role' (le claim 'role' reste le rôle Postgres 'authenticated').
--
-- Enregistrement dans Supabase Dashboard :
--   Auth > Hooks > Custom Access Token
--   Function : public.custom_access_token_hook
--
-- Référence : https://supabase.com/docs/guides/auth/auth-hooks#custom-access-token-hook
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
-- La fonction doit être SECURITY DEFINER pour lire public.users sans contrainte RLS
-- Elle s'exécute en tant que son propriétaire (qui a accès à auth.users)
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_claims   JSONB;
  v_role     TEXT;
  v_org_id   TEXT;
  v_org_type TEXT;
  v_parent   TEXT;
BEGIN
  -- Extraire l'uid depuis l'event
  v_user_id := (event ->> 'user_id')::UUID;

  -- Lire le profil depuis public.users
  SELECT
    u.role::TEXT,
    u.org_id::TEXT,
    u.org_type::TEXT,
    u.parent_org_id::TEXT
  INTO
    v_role, v_org_id, v_org_type, v_parent
  FROM public.users u
  WHERE u.id = v_user_id
    AND u.actif = TRUE;

  -- Si l'utilisateur n'existe pas encore dans public.users (ex: juste après création auth),
  -- retourner le token sans claims custom pour éviter un échec d'auth.
  IF NOT FOUND THEN
    RETURN event;
  END IF;

  -- Construire les claims additionnels
  -- NB : le rôle applicatif est exposé sous 'user_role', PAS 'role'. Le claim
  -- 'role' est réservé par PostgREST/GoTrue au rôle Postgres (authenticated) et
  -- sert au SET ROLE ; l'écraser avec un rôle applicatif casserait toute l'API.
  -- Les policies RLS lisent donc auth.jwt() ->> 'user_role'.
  v_claims := jsonb_build_object(
    'user_role',     COALESCE(v_role,     'lecteur'),
    'org_id',        COALESCE(v_org_id,   ''),
    'org_type',      COALESCE(v_org_type, ''),
    'parent_org_id', COALESCE(v_parent,   '')
  );

  -- Fusionner dans event.claims (Supabase attend la modification de event -> claims)
  RETURN jsonb_set(
    event,
    '{claims}',
    COALESCE(event -> 'claims', '{}'::JSONB) || v_claims
  );

EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur inattendue, laisser passer sans claims plutôt que bloquer l'auth
    RAISE WARNING '[custom_access_token_hook] Error for user %: %', v_user_id, SQLERRM;
    RETURN event;
END;
$$;

-- Accorder l'exécution au rôle supabase_auth_admin (appelant du hook)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Révoquer l'accès public par défaut
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;

-- =============================================================================
-- NOTE D'ENREGISTREMENT
-- =============================================================================
-- Dans le Dashboard Supabase :
--   1. Auth > Hooks > "Custom Access Token"
--   2. Hook type : PostgreSQL Function
--   3. Schema : public
--   4. Function : custom_access_token_hook
--
-- Après un changement de rôle côté admin (updateUserClaims Edge Function),
-- le client doit forcer un refresh du token :
--   const { data } = await supabase.auth.refreshSession()
-- C'est l'équivalent de auth.currentUser.getIdToken(true) en Firebase.
-- =============================================================================

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

-- =============================================================================
-- GSAT Digital V2 — RLS Policies (Row Level Security)
-- Remplace les Firestore Security Rules
-- Les claims JWT sont injectés via le Custom Access Token Hook (voir hook.sql)
-- =============================================================================

-- Helpers JWT inline (plus performant que des fonctions SQL appelées par row)
-- auth.jwt() ->> 'user_role'         → UserRole
-- auth.jwt() ->> 'org_id'       → UUID (orgId de l'utilisateur)
-- auth.jwt() ->> 'org_type'     → OrgType
-- auth.jwt() ->> 'parent_org_id'→ UUID | null

-- =============================================================================
-- Activer RLS sur toutes les tables
-- =============================================================================

ALTER TABLE pays                ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE referentiel_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimensions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteres            ENABLE ROW LEVEL SECURITY;
ALTER TABLE referentiel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE campagnes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_preuves  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans_action        ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_actions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_suivis       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits         ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Politique commune : les service_role (Edge Functions, triggers) passent RLS
-- Note : service_role bypasse RLS nativement sous Supabase — pas de policy nécessaire.
-- =============================================================================

-- =============================================================================
-- PAYS — lecture publique pour tous les utilisateurs authentifiés
-- =============================================================================

CREATE POLICY pays_select_auth ON pays
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY pays_write_admin ON pays
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- ORGANISATIONS
-- =============================================================================

-- Lecture : tous les utilisateurs authentifiés voient toutes les orgs actives
CREATE POLICY orgs_select_auth ON organisations
  FOR SELECT TO authenticated
  USING (TRUE);

-- Écriture : admin_global uniquement
CREATE POLICY orgs_write_admin ON organisations
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- USERS
-- =============================================================================

-- SELECT : chacun voit son propre profil + les règles de visibilité par rôle
CREATE POLICY users_select_self ON users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()                                              -- soi-même
    OR (auth.jwt() ->> 'user_role') = 'admin_global'                  -- admin voit tout
    OR (                                                         -- responsable_region : sa région + ses enfants
      (auth.jwt() ->> 'user_role') = 'responsable_region'
      AND (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        OR parent_org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
    OR (                                                         -- responsable_osn : son OSN + ASN enfants
      (auth.jwt() ->> 'user_role') = 'responsable_osn'
      AND (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        OR parent_org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
    OR org_id = (auth.jwt() ->> 'org_id')::uuid                  -- même org
  );

-- INSERT/UPDATE/DELETE : admin_global via Edge Function createUser/updateUserClaims/deleteUser
-- La Edge Function tourne en service_role → bypasse RLS
-- On n'expose PAS de policy d'écriture directe pour les clients
CREATE POLICY users_update_self ON users
  FOR UPDATE TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Le client peut uniquement modifier ses champs non-sensibles (pas role, pas org_id)
    -- La vérification exhaustive est dans la Edge Function
  );

-- =============================================================================
-- REFERENTIEL — lecture pour tous, écriture admin_global
-- =============================================================================

CREATE POLICY refver_select_auth ON referentiel_versions
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY refver_write_admin ON referentiel_versions
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

CREATE POLICY dim_select_auth ON dimensions
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY dim_write_admin ON dimensions
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

CREATE POLICY crit_select_auth ON criteres
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY crit_write_admin ON criteres
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

CREATE POLICY refhist_select_admin ON referentiel_history
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- CAMPAGNES
-- =============================================================================

-- SELECT : tous les utilisateurs authentifiés voient les campagnes
CREATE POLICY campagnes_select_auth ON campagnes
  FOR SELECT TO authenticated
  USING (TRUE);

-- INSERT : admin_global et responsable_region
CREATE POLICY campagnes_insert ON campagnes
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_region')
  );

-- UPDATE : admin_global et responsable_region (propriétaire)
CREATE POLICY campagnes_update ON campagnes
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') = 'responsable_region'
      AND organisateur_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') = 'responsable_region'
      AND organisateur_id = auth.uid()
    )
  );

-- DELETE : admin_global uniquement (et seulement si 0 évaluations — géré en application)
CREATE POLICY campagnes_delete ON campagnes
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- EVALUATIONS
-- =============================================================================

-- SELECT :
--   admin_global : tout
--   responsable_region : évals des orgs de sa région
--   responsable_osn : évals de son OSN + ses ASN enfants
--   utilisateur_asn / evaluateur : évals de sa propre org
--   lecteur : évals validées/clôturées de sa propre org
CREATE POLICY evals_select ON evaluations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') = 'responsable_region'
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = evaluations.org_id
        AND (o.parent_id = (auth.jwt() ->> 'org_id')::uuid
             OR o.id = (auth.jwt() ->> 'org_id')::uuid)
      )
    )
    OR (
      (auth.jwt() ->> 'user_role') = 'responsable_osn'
      AND (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        OR EXISTS (
          SELECT 1 FROM organisations o
          WHERE o.id = evaluations.org_id
          AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
        )
      )
    )
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- INSERT : utilisateurs autorisés à évaluer, pour leur propre org ou orgs gérées
CREATE POLICY evals_insert ON evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND (
      (auth.jwt() ->> 'user_role') = 'admin_global'
      OR org_id = (auth.jwt() ->> 'org_id')::uuid
      OR (
        (auth.jwt() ->> 'user_role') = 'responsable_osn'
        AND EXISTS (
          SELECT 1 FROM organisations o
          WHERE o.id = evaluations.org_id
          AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
        )
      )
    )
  );

-- UPDATE : auteur + rôles de validation selon statut
-- Note : la vérification des transitions de statut reste en couche service (TypeScript)
--        RLS garantit seulement qu'on ne peut modifier que les évals accessibles
CREATE POLICY evals_update ON evaluations
  FOR UPDATE TO authenticated
  -- Audit B1 (2026-08-30) : 3e branche non bornee retiree (ecriture cross-tenant).
  -- Elle autorisait responsable_region/responsable_osn/evaluateur a modifier toute
  -- eval soumise/validee SANS contrainte d'org, et le WITH CHECK vide (= USING)
  -- laissait meme reassigner org_id. Cas legitimes restants : own-org couvert
  -- par la branche 2 ci-dessous + evals_update_resp_asn (saisie ASN) ; validation
  -- hierarchique cross-org bornee par evals_update_soumission (statut 'soumise',
  -- migration 20260830) et evals_update_revue (statut 'validee', migration
  -- 20260804). WITH CHECK explicite = pas de deplacement cross-org.
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'evaluateur', 'utilisateur_asn')
      AND org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'evaluateur', 'utilisateur_asn')
      AND org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- =============================================================================
-- EVALUATION_SCORES
-- =============================================================================

CREATE POLICY scores_select ON evaluation_scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e WHERE e.id = evaluation_scores.eval_id
      -- hérite des rules de la table evaluations via la jointure
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
        OR (
          (auth.jwt() ->> 'user_role') = 'responsable_osn'
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = e.org_id AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid)
        )
        OR (
          (auth.jwt() ->> 'user_role') = 'responsable_region'
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = e.org_id AND (o.parent_id = (auth.jwt() ->> 'org_id')::uuid OR o.id = (auth.jwt() ->> 'org_id')::uuid))
        )
      )
    )
  );

CREATE POLICY scores_write ON evaluation_scores
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_scores.eval_id
      AND e.statut IN ('brouillon', 'en_cours')
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_scores.eval_id
      AND e.statut IN ('brouillon', 'en_cours')
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- =============================================================================
-- EVALUATION_PREUVES
-- =============================================================================

CREATE POLICY preuves_select ON evaluation_preuves
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e WHERE e.id = evaluation_preuves.eval_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
        OR (
          (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = e.org_id AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid)
        )
      )
    )
  );

CREATE POLICY preuves_insert ON evaluation_preuves
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_preuves.eval_id
      AND e.statut IN ('brouillon', 'en_cours')
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

CREATE POLICY preuves_delete ON evaluation_preuves
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR (auth.jwt() ->> 'user_role') = 'admin_global'
  );

-- =============================================================================
-- PLANS_ACTION
-- =============================================================================

CREATE POLICY plans_select ON plans_action
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = plans_action.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

CREATE POLICY plans_insert ON plans_action
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND (
      (auth.jwt() ->> 'user_role') = 'admin_global'
      OR org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

CREATE POLICY plans_update ON plans_action
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = plans_action.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- =============================================================================
-- PLAN_ACTIONS et ACTION_SUIVIS — héritent de la visibilité plans_action
-- =============================================================================

CREATE POLICY pactions_select ON plan_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans_action p WHERE p.id = plan_actions.plan_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
        OR (
          (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = p.org_id AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid)
        )
      )
    )
  );

CREATE POLICY pactions_write ON plan_actions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans_action p WHERE p.id = plan_actions.plan_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans_action p WHERE p.id = plan_actions.plan_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

CREATE POLICY suivis_select ON action_suivis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plan_actions a
      JOIN plans_action p ON p.id = a.plan_id
      WHERE a.id = action_suivis.action_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
        OR (
          (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = p.org_id AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid)
        )
      )
    )
  );

CREATE POLICY suivis_insert ON action_suivis
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM plan_actions a
      JOIN plans_action p ON p.id = a.plan_id
      WHERE a.id = action_suivis.action_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- =============================================================================
-- DASHBOARD_STATS — lecture selon périmètre, pas d'écriture client
-- (écrit par trigger on_score_write via service_role)
-- =============================================================================

CREATE POLICY dash_select ON dashboard_stats
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = dashboard_stats.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- =============================================================================
-- AUDIT_LOG
-- =============================================================================

-- SELECT : admin_global voit tout; les autres voient leurs propres entrées
CREATE POLICY audit_select ON audit_log
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR user_id = auth.uid()
  );

-- INSERT : désactivé pour les clients directs — utiliser fn_write_audit_log (SECURITY DEFINER)
-- La fonction valide user_id = auth.uid() côté serveur et bypasse RLS.

-- Pas de UPDATE/DELETE sur audit_log (immuable)

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE POLICY notif_select ON notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY notif_update ON notifications
  FOR UPDATE TO authenticated
  USING  (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY notif_delete ON notifications
  FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

-- INSERT : rôles autorisés + sender_id doit être null ou égal à auth.uid() (anti-impersonation)
CREATE POLICY notif_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_region', 'responsable_osn', 'evaluateur')
    AND (sender_id IS NULL OR sender_id = auth.uid())
  );

-- =============================================================================
-- SYSTEM_CONFIG — admin_global uniquement
-- =============================================================================

CREATE POLICY sysconfig_admin ON system_config
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- RATE_LIMITS — géré par Edge Function en service_role
-- lecture pour authenticated (vérification quota côté client)
-- =============================================================================

CREATE POLICY ratelimit_select ON rate_limits
  FOR SELECT TO authenticated
  USING (key LIKE '%' || auth.uid()::text || '%');

-- =============================================================================
-- B4 — GUARD : bloquer l'élévation de privilèges via PATCH direct sur users
-- Les colonnes sensibles (role, org_id, org_type, parent_org_id) ne peuvent
-- être modifiées que par service_role (Edge Function manage-user).
-- PostgREST avec JWT authenticated utilise le rôle 'authenticated' → bloqué.
-- =============================================================================

CREATE OR REPLACE FUNCTION guard_users_sensitive_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'authenticated' AND (
    NEW.role          IS DISTINCT FROM OLD.role          OR
    NEW.org_id        IS DISTINCT FROM OLD.org_id        OR
    NEW.org_type      IS DISTINCT FROM OLD.org_type      OR
    NEW.parent_org_id IS DISTINCT FROM OLD.parent_org_id
  ) THEN
    RAISE EXCEPTION
      'Permission denied: role, org_id, org_type, parent_org_id cannot be modified directly. Use the manage-user Edge Function.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_users_sensitive
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION guard_users_sensitive_columns();

-- =============================================================================
-- I1 — RPC : fn_write_audit_log (SECURITY DEFINER)
-- Remplace l'INSERT direct sur audit_log depuis les clients authentifiés.
-- La fonction tourne en tant que son owner (postgres / service_role) → bypasse RLS.
-- Le caller ne peut écrire que pour son propre uid.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_write_audit_log(
  p_user_id     uuid,
  p_user_email  text,
  p_action      text,
  p_resource    text,
  p_resource_id text,
  p_metadata    jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vérifier que le caller écrit bien pour lui-même (pas d'usurpation)
  IF p_user_id <> auth.uid() AND (auth.jwt() ->> 'user_role') <> 'admin_global' THEN
    RAISE EXCEPTION 'Permission denied: cannot write audit entry for another user.';
  END IF;

  INSERT INTO audit_log (user_id, user_email, action, resource, resource_id, metadata)
  VALUES (p_user_id, p_user_email, p_action, p_resource, p_resource_id, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_write_audit_log TO authenticated;
