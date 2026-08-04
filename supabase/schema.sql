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
