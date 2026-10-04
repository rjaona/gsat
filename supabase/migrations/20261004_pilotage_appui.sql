-- =============================================================================
-- Cockpits de pilotage — Phase 2 (CAPTURER) : appui national aux Faritany.
-- Spec : docs/superpowers/specs/2026-09-13-cockpits-pilotage-design.md §5
-- Plan : docs/superpowers/plans/2026-10-04-cockpits-pilotage-phase2.md
--
-- 1. Enums appui_statut + action_origine.
-- 2. plan_actions.origine (défaut 'regionale' : toutes les lignes existantes).
-- 3. Table appui_faritany + index unique PARTIEL (un seul appui ouvert par
--    Faritany ; une contrainte UNIQUE ... WHERE n'existe pas en PG).
-- 4. RLS appui_faritany : select / insert / update. Pas de DELETE : on clôt.
-- 5. RLS descendantes (osn/region sur Faritany ENFANT DIRECT, même portée que
--    plans_select/plans_update) : plans_insert_descendant,
--    pactions_insert_descendant, pactions_update_descendant. Le national ne
--    crée/modifie QUE des actions origine='nationale' ; les actions du
--    Faritany restent à lui.
-- 6. Garde fn_garde_origine_action : origine immuable ; création ET suppression
--    d'une action 'nationale' réservées au niveau national. Nécessaire car pactions_write (FOR ALL, own org) ne
--    contraint pas l'origine et les policies permissives sont OR-ées : seule
--    une garde trigger empêche un Faritany de fabriquer/retirer le badge.
--
-- Écart de nommage vs spec §5 : une policy PG couvre UNE commande (ou ALL, qui
-- inclurait DELETE). appui_write = appui_insert + appui_update ;
-- pactions_write_descendant = pactions_insert_descendant + pactions_update_descendant.
-- Claims : TOUJOURS user_role / org_id (jamais 'role' = 'authenticated').
-- IDEMPOTENT : rejouable (IF NOT EXISTS, DROP ... IF EXISTS, CREATE OR REPLACE).
-- =============================================================================

BEGIN;

-- 1. Enums (création + usage dans la même transaction : OK, seul ADD VALUE pose problème)
DO $$ BEGIN
  CREATE TYPE appui_statut AS ENUM ('ouvert', 'clos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE action_origine AS ENUM ('regionale', 'nationale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tag d'origine des actions
ALTER TABLE plan_actions
  ADD COLUMN IF NOT EXISTS origine action_origine NOT NULL DEFAULT 'regionale';

-- 3. Table d'état de l'appui national
CREATE TABLE IF NOT EXISTS appui_faritany (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID          NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  statut           appui_statut  NOT NULL DEFAULT 'ouvert',
  referent_user_id UUID          REFERENCES users(id) ON DELETE SET NULL,
  note             TEXT,
  ouvert_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  ouvert_par       UUID          DEFAULT auth.uid() REFERENCES users(id) ON DELETE SET NULL,
  clos_at          TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT appui_clos_coherent CHECK ((statut = 'clos') = (clos_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_appui_ouvert_par_org
  ON appui_faritany (org_id) WHERE statut = 'ouvert';
CREATE INDEX IF NOT EXISTS idx_appui_org ON appui_faritany (org_id);

DROP TRIGGER IF EXISTS set_updated_at_appui_faritany ON appui_faritany;
CREATE TRIGGER set_updated_at_appui_faritany
  BEFORE UPDATE ON appui_faritany
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE appui_faritany ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON appui_faritany TO authenticated;

-- 4. RLS appui_faritany
DROP POLICY IF EXISTS appui_select ON appui_faritany;
CREATE POLICY appui_select ON appui_faritany
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = appui_faritany.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

DROP POLICY IF EXISTS appui_insert ON appui_faritany;
CREATE POLICY appui_insert ON appui_faritany
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = appui_faritany.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

DROP POLICY IF EXISTS appui_update ON appui_faritany;
CREATE POLICY appui_update ON appui_faritany
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = appui_faritany.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = appui_faritany.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- 5. RLS descendantes plans / actions
DROP POLICY IF EXISTS plans_insert_descendant ON plans_action;
CREATE POLICY plans_insert_descendant ON plans_action
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organisations o
      WHERE o.id = plans_action.org_id
      AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
    )
    AND EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = plans_action.eval_id
      AND e.org_id = plans_action.org_id
    )
  );

DROP POLICY IF EXISTS pactions_insert_descendant ON plan_actions;
CREATE POLICY pactions_insert_descendant ON plan_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
    AND origine = 'nationale'
    AND EXISTS (
      SELECT 1 FROM plans_action p
      JOIN organisations o ON o.id = p.org_id
      WHERE p.id = plan_actions.plan_id
      AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

DROP POLICY IF EXISTS pactions_update_descendant ON plan_actions;
CREATE POLICY pactions_update_descendant ON plan_actions
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
    AND origine = 'nationale'
    AND EXISTS (
      SELECT 1 FROM plans_action p
      JOIN organisations o ON o.id = p.org_id
      WHERE p.id = plan_actions.plan_id
      AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
    AND origine = 'nationale'
    AND EXISTS (
      SELECT 1 FROM plans_action p
      JOIN organisations o ON o.id = p.org_id
      WHERE p.id = plan_actions.plan_id
      AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- 6. Garde d'intégrité du tag d'origine
CREATE OR REPLACE FUNCTION fn_garde_origine_action()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_role TEXT := auth.jwt() ->> 'user_role';
BEGIN
  -- v_role NULL = pas de JWT applicatif (superuser, service_role, seeds) : autorisé.
  IF TG_OP = 'DELETE' THEN
    -- Un Faritany ne peut pas effacer une action d'appui nationale (pactions_write
    -- est FOR ALL) : sinon badge, compteur et boucle d'appui disparaissent.
    IF OLD.origine = 'nationale' AND v_role IS NOT NULL
       AND v_role NOT IN ('admin_global', 'responsable_osn', 'responsable_region') THEN
      RAISE EXCEPTION 'Seul le niveau national peut supprimer une action d''appui nationale.';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.origine IS DISTINCT FROM OLD.origine THEN
    RAISE EXCEPTION 'L''origine d''une action est immuable.';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.origine = 'nationale' AND v_role IS NOT NULL
     AND v_role NOT IN ('admin_global', 'responsable_osn', 'responsable_region') THEN
    RAISE EXCEPTION 'Seul le niveau national peut créer une action d''appui nationale.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS garde_origine_action ON plan_actions;
CREATE TRIGGER garde_origine_action
  BEFORE INSERT OR UPDATE OR DELETE ON plan_actions
  FOR EACH ROW EXECUTE FUNCTION fn_garde_origine_action();

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- ROLLBACK (manuel, NE PAS exécuter sauf retour arrière décidé) :
-- BEGIN;
-- DROP TRIGGER IF EXISTS garde_origine_action ON plan_actions;
-- DROP FUNCTION IF EXISTS fn_garde_origine_action();
-- DROP POLICY IF EXISTS pactions_update_descendant ON plan_actions;
-- DROP POLICY IF EXISTS pactions_insert_descendant ON plan_actions;
-- DROP POLICY IF EXISTS plans_insert_descendant ON plans_action;
-- DROP TABLE IF EXISTS appui_faritany;
-- ALTER TABLE plan_actions DROP COLUMN IF EXISTS origine;
-- DROP TYPE IF EXISTS action_origine;
-- DROP TYPE IF EXISTS appui_statut;
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
-- ⚠️ le frontend Phase 2 lit plan_actions.origine : restaurer d'abord le
--    frontend précédent, sinon 400 PostgREST sur les cockpits.
-- =============================================================================
