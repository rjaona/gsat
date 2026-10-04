# Cockpits de pilotage GSAT — Phase 2 (Capturer) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fermer la boucle d'appui national → Faritany : le national marque un Faritany « en appui », lui assigne un référent, crée des actions d'appui taguées `origine='nationale'` dans le plan du Faritany ; la région voit le chip « en appui national » et le badge « National » sur ces actions.

**Architecture:** Une migration additive (2 enums, colonne `plan_actions.origine`, table `appui_faritany`, 6 policies RLS, 1 trigger de garde) ; un service `appuiService` (lecture/écriture appui + création d'action d'appui avec résolution du plan cible par une fonction pure partagée avec le régional) ; extension des stores/pages Phase 1 (pas de nouvelle page). Libellés des essentiels KO résolus via le référentiel (fin du placeholder `libelle: code`).

**Tech Stack:** PostgreSQL (Supabase self-hosted, RLS), React 19 + Vite 6 + TypeScript strict, Zustand 5, react-i18next, vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-09-13-cockpits-pilotage-design.md` (§3 drill-down, §4 régional, §5 Phase 2, §6, §8). Plan Phase 1 (patrons de code/tests) : `docs/superpowers/plans/2026-09-13-cockpits-pilotage-phase1.md`.

**Branche :** `feat/cockpits-pilotage-phase2`, créée depuis `feat/cockpits-pilotage` @ `ac5c29a` (PR #9 pas encore mergée). Après merge de #9 : `git rebase origin/master` avant d'ouvrir la PR Phase 2.

## Global Constraints

- TypeScript strict : `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`. Ne JAMAIS passer `undefined` explicite à une prop optionnelle `x?: T` → spread conditionnel `...(v ? { x: v } : {})` ou typer `x?: T | undefined`.
- Gate typecheck : `node node_modules/typescript/bin/tsc -b` (JAMAIS `-p`). Build : `node node_modules/vite/bin/vite.js build`.
- Tests : `node node_modules/vitest/vitest.mjs run <fichier>` ; utils/services purs → ajouter `--environment=node` (cold-start jsdom ~4 min sur `/mnt/d`, lancer en arrière-plan avec `timeout 590`). Suite complète : `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'`.
- Dépôt sur `/mnt/d` : après toute écriture, vérifier `git status`/`git diff --stat` que le fichier a bien persisté (watcher OneDrive). Si revert : réécrire via `cat <<'EOF' > fichier`.
- Commits : `git add` par chemins EXPLICITES (jamais `-A`/`.`). Un commit par tâche. Fin de message : `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- RLS : claims applicatifs lus via `auth.jwt() ->> 'user_role'` et `auth.jwt() ->> 'org_id'` — JAMAIS `->> 'role'` (vaut `authenticated`, piège du drift 20260806).
- Portée descendante = enfant DIRECT (`organisations.parent_id = jwt.org_id`), identique à `plans_select`/`plans_update` existants. `responsable_region` n'atteint donc pas les petits-enfants (limitation préexistante, hors périmètre).
- i18n : `src/i18n/fr.ts` + `src/i18n/en.ts` (objets TS). Composants : `t('clé', 'défaut fr', opts)`. mg = fallback fr.
- Mocks i18n dans les tests RTL : TOUJOURS le mock interpolant (`{{x}}` remplacé par `opts.x`), sinon faux positifs (leçon Phase 1 T7).
- §6 dégradation honnête : un échec de lecture « cœur » (appuis, plans) remonte en bannière d'erreur ; seuls les enrichissements cosmétiques (libellés KO, libellé niveau, liste des référents) ont le droit de `.catch(() => fallback)`.
- Notification à la création d'action nationale : HORS périmètre (spec §9, optionnelle).
- Aucune action prod (lecture comprise) sans autorisation explicite de l'utilisateur (Task 10 est gated).

## Review Focus

1. **Le national crée une action alors que le Faritany a déjà un ou plusieurs plans** → l'action doit atterrir dans le plan que le cockpit régional lit (le plus récent par `createdAt`), sinon la boucle d'appui est silencieusement cassée. Couvert : Task 3 (`choisirCiblePlan`, plusieurs plans) + Task 4 (`creerActionAppui` n'appelle PAS `createPlan` si un plan existe).
2. **Faritany sans aucune évaluation** (`plans_action.eval_id NOT NULL`) → création d'action impossible : bouton remplacé par un message honnête, pas d'erreur SQL. Couvert : Task 3 (`impossible`), Task 4 (`CreationActionImpossibleError`), Task 7 (RTL message).
3. **Double « Marquer en appui »** (deux onglets / double clic) → l'index unique partiel lève 23505 ; l'utilisateur voit « Un appui est déjà ouvert pour ce Faritany. », pas une erreur brute. Couvert : Task 1 (SQL [9]), Task 4 (mapping 23505).
4. **Un compte Faritany tente de fabriquer/retirer le tag `nationale`** (via `pactions_write`, FOR ALL, sans contrainte d'origine) ou à SUPPRIMER une action nationale → le trigger de garde rejette (INSERT, UPDATE, DELETE ; décision user 2026-10-04 : garde étendue à DELETE). Couvert : Task 1 (statique + SQL [16][17][17b]).
5. **`admin_global` dont l'`org_id` est la racine OMMS** (cas réel prod : seul compte national) → le cockpit national doit résoudre l'OSN au lieu d'afficher 0 Faritany. Couvert : Task 3 (`resoudreOsnPilotage`) + Task 5 (store, test admin).

---

## Structure des fichiers

- **Créer** `supabase/migrations/20261004_pilotage_appui.sql` — enums, colonne, table, 6 policies, trigger.
- **Créer** `docs/superpowers/verif/appui-rls.sql` — vérif RLS/garde sous claims forgés, tout en ROLLBACK (fixtures autonomes).
- **Créer** `src/__tests__/pilotageAppuiMigration.test.ts` — garde statique du SQL.
- **Modifier** `src/types/supabase.generated.ts` — édition manuelle (stack locale arrêtée) : table `appui_faritany`, `plan_actions.origine`, 2 enums.
- **Modifier** `src/types/index.ts` — `ActionOrigine`, `AppuiStatut`, `AppuiFaritany`, `Action.origine`.
- **Modifier** `src/services/planActionService.ts` — `rowToAction` (origine), `addAction` (origine), `OrgActionAgg.actionsNationalesEnCours`.
- **Modifier** `src/utils/pilotage.ts` — `choisirPlanCourant`, `choisirCiblePlan`, `resoudreOsnPilotage`, `indexerLibellesCriteres` ; `PrioriteItem` action gagne `origine?`.
- **Créer** `src/services/appuiService.ts` — CRUD appui + `creerActionAppui`.
- **Modifier** `src/stores/pilotageNationalStore.ts` (réécriture) et `src/stores/pilotageRegionalStore.ts`.
- **Modifier** `src/components/dashboard/pilotage/WatchlistFaritany.tsx` (colonne Appui), `DrilldownFaritany.tsx` (libellés + liste d'actions + slot), `FilePriorites.tsx` (badge National).
- **Créer** `src/components/dashboard/pilotage/CaptureAppui.tsx` — capture d'appui (drill-down).
- **Modifier** `src/pages/dashboard/PilotageNationalPage.tsx`, `PilotageRegionalPage.tsx`.
- **Modifier** `src/i18n/fr.ts`, `src/i18n/en.ts`.
- **Tests** sous `src/__tests__/` (voir chaque tâche).

---

### Task 1 : Migration Phase 2 + garde statique + script de vérif RLS

**Files:**
- Create: `supabase/migrations/20261004_pilotage_appui.sql`
- Create: `docs/superpowers/verif/appui-rls.sql`
- Test: `src/__tests__/pilotageAppuiMigration.test.ts`

**Interfaces:**
- Produces (DB) : type `action_origine ('regionale','nationale')`, type `appui_statut ('ouvert','clos')`, colonne `plan_actions.origine action_origine NOT NULL DEFAULT 'regionale'`, table `appui_faritany(id, org_id, statut, referent_user_id, note, ouvert_at, ouvert_par, clos_at, updated_at)`, index `uq_appui_ouvert_par_org`, policies `appui_select|appui_insert|appui_update|plans_insert_descendant|pactions_insert_descendant|pactions_update_descendant`, trigger `garde_origine_action` → `fn_garde_origine_action()`.

- [ ] **Step 1 : Écrire le test statique qui échoue**

Créer `src/__tests__/pilotageAppuiMigration.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Garde statique de la migration Phase 2 (appui national). La preuve
// d'exécution est docs/superpowers/verif/appui-rls.sql (claims forgés, ROLLBACK).
const raw = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261004_pilotage_appui.sql'), 'utf8');
// SQL exécutable seul (le bloc rollback est commenté).
const sql = raw.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');

function extractPolicy(name: string): string {
  const start = sql.indexOf(`CREATE POLICY ${name} `);
  if (start === -1) throw new Error(`policy ${name} introuvable`);
  return sql.slice(start, sql.indexOf(';', start));
}

const DESCENDANT = /o\.parent_id = \(auth\.jwt\(\) ->> 'org_id'\)::uuid/;

describe('migration 20261004_pilotage_appui', () => {
  it('ne lit jamais le claim système role (piège user_role)', () => {
    expect(sql).not.toMatch(/->>\s*'role'/);
  });

  it("n'ouvre ni DELETE ni FOR ALL", () => {
    expect(sql).not.toMatch(/FOR DELETE/);
    expect(sql).not.toMatch(/FOR ALL/);
  });

  it('table appui_faritany sous RLS + un seul appui ouvert par Faritany (index partiel)', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS appui_faritany/);
    expect(sql).toMatch(/ALTER TABLE appui_faritany ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_appui_ouvert_par_org\s+ON appui_faritany \(org_id\) WHERE statut = 'ouvert'/);
  });

  it('écritures appui réservées au national, bornées au Faritany enfant', () => {
    for (const p of ['appui_insert', 'appui_update']) {
      const body = extractPolicy(p);
      expect(body).toMatch(DESCENDANT);
      expect(body).not.toMatch(/responsable_asn/);
    }
    expect(extractPolicy('appui_update')).toMatch(/WITH CHECK/);
  });

  it('région lit sa propre ligne (chip) via appui_select', () => {
    expect(extractPolicy('appui_select')).toMatch(/org_id = \(auth\.jwt\(\) ->> 'org_id'\)::uuid/);
  });

  it('plans_insert_descendant : enfant direct + created_by = auth.uid() + éval du même Faritany', () => {
    const body = extractPolicy('plans_insert_descendant');
    expect(body).toMatch(DESCENDANT);
    expect(body).toMatch(/created_by = auth\.uid\(\)/);
    expect(body).toMatch(/e\.org_id = plans_action\.org_id/);
  });

  it("pactions_*_descendant : bornés à l'enfant direct et à origine='nationale'", () => {
    for (const p of ['pactions_insert_descendant', 'pactions_update_descendant']) {
      const body = extractPolicy(p);
      expect(body).toMatch(DESCENDANT);
      expect(body).toMatch(/origine = 'nationale'/);
    }
    expect(extractPolicy('pactions_update_descendant')).toMatch(/WITH CHECK/);
  });

  it('garde origine : immuable en UPDATE, nationale réservée au national en INSERT et DELETE', () => {
    expect(sql).toMatch(/NEW\.origine IS DISTINCT FROM OLD\.origine/);
    expect(sql).toMatch(/v_role NOT IN \('admin_global', 'responsable_osn', 'responsable_region'\)/);
    expect(sql).toMatch(/IF TG_OP = 'DELETE' THEN[\s\S]*OLD\.origine = 'nationale'[\s\S]*RETURN OLD;/);
    expect(sql).toMatch(/CREATE TRIGGER garde_origine_action\s+BEFORE INSERT OR UPDATE OR DELETE ON plan_actions/);
  });
});
```

- [ ] **Step 2 : Vérifier qu'il échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageAppuiMigration.test.ts --environment=node`
Expected: FAIL — `ENOENT ... 20261004_pilotage_appui.sql`.

- [ ] **Step 3 : Écrire la migration**

Créer `supabase/migrations/20261004_pilotage_appui.sql` :
```sql
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
```

- [ ] **Step 4 : Vérifier que le test statique passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageAppuiMigration.test.ts --environment=node`
Expected: PASS (8 tests).

- [ ] **Step 5 : Écrire le script de vérif RLS (exécuté en Step 6 en local, puis en Task 10 en prod)**

Créer `docs/superpowers/verif/appui-rls.sql` :
```sql
-- Vérif RLS + garde origine — cockpits Phase 2. TOUT en transaction ROLLBACK.
-- Fixtures AUTONOMES (UUID a99e…) : 2 OSN, 3 Faritany, 3 users. Aucune donnée réelle lue ni modifiée.
-- Claims forgés au format du hook : role='authenticated' + user_role=<rôle app> + org_id.
-- Exécution : psql -U postgres -d postgres -v ON_ERROR_STOP=0 -f appui-rls.sql
-- Les cas « ATTENDU: ERROR » sont isolés par SAVEPOINT ; lire la sortie ligne à ligne.
--
-- OSN_A  = a99e0000-0000-4000-8000-000000000001   FarA1 = …0002   FarA2 = …0003
-- OSN_B  = a99e0000-0000-4000-8000-000000000004   FarB1 = …0005
-- U_OSN  = …0011 (responsable_osn @ OSN_A)  U_ASN1 = …0012 (responsable_asn @ FarA1)
-- U_ASN2 = …0013 (responsable_asn @ FarA2)
begin;

-- ── Fixtures (superuser) ─────────────────────────────────────────────────────
insert into organisations(id, type, nom, code, parent_id) values
 ('a99e0000-0000-4000-8000-000000000001','OSN','OSN test A','TA',   null),
 ('a99e0000-0000-4000-8000-000000000002','ASN','Far A1',   'TA-01','a99e0000-0000-4000-8000-000000000001'),
 ('a99e0000-0000-4000-8000-000000000003','ASN','Far A2',   'TA-02','a99e0000-0000-4000-8000-000000000001'),
 ('a99e0000-0000-4000-8000-000000000004','OSN','OSN test B','TB',  null),
 ('a99e0000-0000-4000-8000-000000000005','ASN','Far B1',   'TB-01','a99e0000-0000-4000-8000-000000000004');

insert into auth.users(id, email) values
 ('a99e0000-0000-4000-8000-000000000011','osn.test@verif.local'),
 ('a99e0000-0000-4000-8000-000000000012','asn1.test@verif.local'),
 ('a99e0000-0000-4000-8000-000000000013','asn2.test@verif.local');

insert into users(id, org_id, org_type, parent_org_id, nom, prenom, email, role) values
 ('a99e0000-0000-4000-8000-000000000011','a99e0000-0000-4000-8000-000000000001','OSN',null,'Osn','Test','osn.test@verif.local','responsable_osn'),
 ('a99e0000-0000-4000-8000-000000000012','a99e0000-0000-4000-8000-000000000002','ASN','a99e0000-0000-4000-8000-000000000001','Asn1','Test','asn1.test@verif.local','responsable_asn'),
 ('a99e0000-0000-4000-8000-000000000013','a99e0000-0000-4000-8000-000000000003','ASN','a99e0000-0000-4000-8000-000000000001','Asn2','Test','asn2.test@verif.local','responsable_asn');

insert into campagnes(id, organisateur_id, referentiel_version, nom, date_ouverture, date_fermeture, created_by, statut)
values ('a99e0000-0000-4000-8000-000000000021','a99e0000-0000-4000-8000-000000000011','far_v1_0','Camp verif',
        now(), now() + interval '30 days','a99e0000-0000-4000-8000-000000000011','ouverte');

insert into evaluations(id, campagne_id, org_id, type, statut, created_by) values
 ('a99e0000-0000-4000-8000-000000000031','a99e0000-0000-4000-8000-000000000021','a99e0000-0000-4000-8000-000000000002','auto','en_cours','a99e0000-0000-4000-8000-000000000012'),
 ('a99e0000-0000-4000-8000-000000000032','a99e0000-0000-4000-8000-000000000021','a99e0000-0000-4000-8000-000000000005','auto','en_cours','a99e0000-0000-4000-8000-000000000011'),
 ('a99e0000-0000-4000-8000-000000000033','a99e0000-0000-4000-8000-000000000021','a99e0000-0000-4000-8000-000000000003','auto','en_cours','a99e0000-0000-4000-8000-000000000013');

-- Plan existant du Faritany A2 (créé par lui-même)
insert into plans_action(id, eval_id, org_id, statut, created_by)
values ('a99e0000-0000-4000-8000-000000000041','a99e0000-0000-4000-8000-000000000033','a99e0000-0000-4000-8000-000000000003','actif','a99e0000-0000-4000-8000-000000000013');

-- ── responsable_osn @ OSN_A ─────────────────────────────────────────────────
select set_config('request.jwt.claims','{"sub":"a99e0000-0000-4000-8000-000000000011","role":"authenticated","user_role":"responsable_osn","org_id":"a99e0000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

\echo '[1] OSN crée le plan de FarA1 (enfant) — ATTENDU: INSERT 0 1'
insert into plans_action(eval_id, org_id, statut, created_by)
values ('a99e0000-0000-4000-8000-000000000031','a99e0000-0000-4000-8000-000000000002','actif','a99e0000-0000-4000-8000-000000000011');

savepoint t;
\echo '[2] OSN crée un plan dans FarB1 (autre arbre) — ATTENDU: ERROR row-level security'
insert into plans_action(eval_id, org_id, statut, created_by)
values ('a99e0000-0000-4000-8000-000000000032','a99e0000-0000-4000-8000-000000000005','actif','a99e0000-0000-4000-8000-000000000011');
rollback to savepoint t;

savepoint t;
\echo '[3] OSN crée un plan pour FarA2 sur l éval d un AUTRE Faritany — ATTENDU: ERROR row-level security'
insert into plans_action(eval_id, org_id, statut, created_by)
values ('a99e0000-0000-4000-8000-000000000032','a99e0000-0000-4000-8000-000000000003','actif','a99e0000-0000-4000-8000-000000000011');
rollback to savepoint t;

\echo '[4] OSN ajoute une action NATIONALE au plan de FarA2 — ATTENDU: INSERT 0 1'
insert into plan_actions(id, plan_id, domaine_amelioration, objectif, date_echeance, origine)
values ('a99e0000-0000-4000-8000-000000000051','a99e0000-0000-4000-8000-000000000041','Gouvernance','Appui test', now() + interval '10 days','nationale');

savepoint t;
\echo '[5] OSN ajoute une action REGIONALE au plan de FarA2 — ATTENDU: ERROR row-level security'
insert into plan_actions(plan_id, domaine_amelioration, objectif, date_echeance, origine)
values ('a99e0000-0000-4000-8000-000000000041','Gouvernance','Usurpation', now() + interval '10 days','regionale');
rollback to savepoint t;

\echo '[6] OSN met à jour le statut de SON action nationale — ATTENDU: n=1'
with u as (update plan_actions set statut = 'en_cours' where id = 'a99e0000-0000-4000-8000-000000000051' returning 1)
select '[6]' as chk, count(*) as n from u;

savepoint t;
\echo '[7] OSN change l origine de l action — ATTENDU: ERROR origine immuable'
update plan_actions set origine = 'regionale' where id = 'a99e0000-0000-4000-8000-000000000051';
rollback to savepoint t;

\echo '[8] OSN ouvre un appui pour FarA2 — ATTENDU: INSERT 0 1'
insert into appui_faritany(org_id, note) values ('a99e0000-0000-4000-8000-000000000003','test');

savepoint t;
\echo '[9] OSN ouvre un 2e appui pour FarA2 — ATTENDU: ERROR duplicate key uq_appui_ouvert_par_org'
insert into appui_faritany(org_id) values ('a99e0000-0000-4000-8000-000000000003');
rollback to savepoint t;

savepoint t;
\echo '[10] OSN ouvre un appui pour FarB1 (autre arbre) — ATTENDU: ERROR row-level security'
insert into appui_faritany(org_id) values ('a99e0000-0000-4000-8000-000000000005');
rollback to savepoint t;

\echo '[11] OSN modifie la note de l appui FarA2 — ATTENDU: n=1 ; ouvert_par = U_OSN'
with u as (update appui_faritany set note = 'maj' where org_id = 'a99e0000-0000-4000-8000-000000000003' returning ouvert_par)
select '[11]' as chk, count(*) as n, max(ouvert_par::text) as ouvert_par from u;

savepoint t;
\echo '[12] OSN supprime l appui (aucune policy DELETE) — ATTENDU: n=0 OU ERROR permission denied (selon les default privileges) ; JAMAIS n=1'
with d as (delete from appui_faritany where org_id = 'a99e0000-0000-4000-8000-000000000003' returning 1)
select '[12]' as chk, count(*) as n from d;
rollback to savepoint t;

-- ── responsable_asn @ FarA2 (le Faritany appuyé) ────────────────────────────
reset role;
select set_config('request.jwt.claims','{"sub":"a99e0000-0000-4000-8000-000000000013","role":"authenticated","user_role":"responsable_asn","org_id":"a99e0000-0000-4000-8000-000000000003"}', true);
set local role authenticated;

\echo '[13] FarA2 lit son appui (chip) — ATTENDU: n=1'
select '[13]' as chk, count(*) as n from appui_faritany where org_id = 'a99e0000-0000-4000-8000-000000000003';

\echo '[14] FarA2 tente de modifier son appui — ATTENDU: n=0'
with u as (update appui_faritany set note = 'hack' where org_id = 'a99e0000-0000-4000-8000-000000000003' returning 1)
select '[14]' as chk, count(*) as n from u;

\echo '[15] FarA2 ajoute une action REGIONALE à son plan (non-régression) — ATTENDU: INSERT 0 1'
insert into plan_actions(plan_id, domaine_amelioration, objectif, date_echeance)
values ('a99e0000-0000-4000-8000-000000000041','Gouvernance','Action locale', now() + interval '10 days');

savepoint t;
\echo '[16] FarA2 fabrique une action NATIONALE — ATTENDU: ERROR Seul le niveau national'
insert into plan_actions(plan_id, domaine_amelioration, objectif, date_echeance, origine)
values ('a99e0000-0000-4000-8000-000000000041','Gouvernance','Faux badge', now() + interval '10 days','nationale');
rollback to savepoint t;

savepoint t;
\echo '[17] FarA2 retire le tag national de l action d appui — ATTENDU: ERROR origine immuable'
update plan_actions set origine = 'regionale' where id = 'a99e0000-0000-4000-8000-000000000051';
rollback to savepoint t;

savepoint t;
\echo '[17b] FarA2 supprime l action d appui nationale — ATTENDU: ERROR Seul le niveau national peut supprimer'
delete from plan_actions where id = 'a99e0000-0000-4000-8000-000000000051';
rollback to savepoint t;

\echo '[18] FarA2 voit l action nationale (badge) — ATTENDU: n=1'
select '[18]' as chk, count(*) as n from plan_actions where plan_id = 'a99e0000-0000-4000-8000-000000000041' and origine = 'nationale';

-- ── responsable_asn @ FarA1 (voisin) ────────────────────────────────────────
reset role;
select set_config('request.jwt.claims','{"sub":"a99e0000-0000-4000-8000-000000000012","role":"authenticated","user_role":"responsable_asn","org_id":"a99e0000-0000-4000-8000-000000000002"}', true);
set local role authenticated;

\echo '[19] FarA1 lit l appui de FarA2 (voisin) — ATTENDU: n=0'
select '[19]' as chk, count(*) as n from appui_faritany where org_id = 'a99e0000-0000-4000-8000-000000000003';

rollback;
```

- [ ] **Step 6 : Exécuter la vérif en LOCAL (si la stack démarre)**

La stack locale est arrêtée (seuls des conteneurs Plane tournent). Tenter :
```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && supabase start
```
Si elle démarre (migrations rejouées automatiquement, dont `20261004_pilotage_appui.sql`) :
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=0 -f docs/superpowers/verif/appui-rls.sql
```
Si la base locale existait déjà (volume persistant, migration non rejouée), appliquer d'abord :
`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -f supabase/migrations/20261004_pilotage_appui.sql`, puis rejouer la migration une 2e fois pour prouver l'idempotence (attendu : 0 erreur).
Expected : chaque `[n]` conforme à sa ligne « ATTENDU ». Coller la sortie dans le rapport de tâche.
Si la stack ne démarre pas : le noter dans le rapport ; la vérif sera faite en Task 10 en prod (ROLLBACK, fixtures autonomes). Ne pas bloquer la suite.

- [ ] **Step 7 : Commit**

```bash
git add supabase/migrations/20261004_pilotage_appui.sql docs/superpowers/verif/appui-rls.sql src/__tests__/pilotageAppuiMigration.test.ts
git commit -m "feat(pilotage): migration Phase 2 — appui_faritany, origine des actions, RLS descendantes + garde

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Types + origine dans `planActionService` + compteur d'actions nationales

**Files:**
- Modify: `src/types/supabase.generated.ts` (table `plan_actions` ~l.969-1035, ajout table `appui_faritany` après `alertes`, `Enums` ~l.1351, `Constants` ~l.1539)
- Modify: `src/types/index.ts` (~l.215 `Action`)
- Modify: `src/services/planActionService.ts` (`rowToAction` l.26, `addAction` l.150, `OrgActionAgg` l.298, `listActionAggByOrgIds` l.323)
- Modify: `src/__tests__/planActionAgg.test.ts`
- Test: `src/__tests__/planActionOrigine.test.ts`

**Interfaces:**
- Consumes: colonnes DB de la Task 1.
- Produces:
  - `export type ActionOrigine = 'regionale' | 'nationale';`
  - `export type AppuiStatut = 'ouvert' | 'clos';`
  - `export interface AppuiFaritany { id: string; orgId: string; statut: AppuiStatut; referentUserId?: string | undefined; note?: string | undefined; ouvertAt: string; ouvertPar?: string | undefined; closAt?: string | undefined; }`
  - `Action.origine?: ActionOrigine | undefined` — TOUJOURS renseigné par `rowToAction` (défaut `'regionale'`).
  - `addAction(planId, payload)` écrit `origine: payload.origine ?? 'regionale'`.
  - `OrgActionAgg.actionsNationalesEnCours: number` (origine nationale ET statut ≠ termine).

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `src/__tests__/planActionOrigine.test.ts` :
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ rows: [] as unknown[], inserted: null as Record<string, unknown> | null }));
vi.mock('@/services/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: h.rows, error: null }) }) }),
      insert: (row: Record<string, unknown>) => {
        h.inserted = row;
        return { select: () => ({ single: () => Promise.resolve({ data: { id: 'new-id' }, error: null }) }) };
      },
    }),
  },
}));

import { listActions, addAction } from '@/services/planActionService';

const base = {
  id: 'a1', plan_id: 'p1', domaine_amelioration: 'D', objectif: 'O', description: '', responsable: '',
  date_echeance: '2026-11-01T00:00:00Z', statut: 'a_faire', priorite: 'haute', created_at: '2026-10-01T00:00:00Z',
};

beforeEach(() => { h.rows = []; h.inserted = null; });

describe('origine des actions', () => {
  it('rowToAction : nationale conservée, absente/null → regionale', async () => {
    h.rows = [{ ...base, id: 'n', origine: 'nationale' }, { ...base, id: 'r', origine: null }, { ...base, id: 'x' }];
    const actions = await listActions('p1');
    expect(actions.map(a => [a.id, a.origine])).toEqual([['n', 'nationale'], ['r', 'regionale'], ['x', 'regionale']]);
  });

  it('addAction écrit origine (défaut regionale, nationale si demandée)', async () => {
    const payload = { domaineAmelioration: 'D', objectif: 'O', description: '', responsable: '', dateEcheance: '2026-11-01', statut: 'a_faire' as const, priorite: 'haute' as const };
    await addAction('p1', payload);
    expect(h.inserted?.['origine']).toBe('regionale');
    await addAction('p1', { ...payload, origine: 'nationale' });
    expect(h.inserted?.['origine']).toBe('nationale');
  });
});
```

Dans `src/__tests__/planActionAgg.test.ts` : ajouter `actionsNationalesEnCours: 0,` aux DEUX objets attendus du 1er test (après `actionsRetard: 0,`), puis ajouter ce test dans le `describe` :
```ts
  it('compte les actions nationales non terminées (actionsNationalesEnCours)', async () => {
    h.rows = [{ org_id: 'A', plan_actions: [
      { statut: 'en_cours', created_at: null, date_echeance: null, origine: 'nationale' },
      { statut: 'termine',  created_at: null, date_echeance: null, origine: 'nationale' },
      { statut: 'a_faire',  created_at: null, date_echeance: null, origine: 'regionale' },
      { statut: 'bloque',   created_at: null, date_echeance: null, origine: 'nationale' },
    ] }];
    const r = await listActionAggByOrgIds(['A']);
    expect(r['A']?.actionsNationalesEnCours).toBe(2);
  });
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/planActionOrigine.test.ts src/__tests__/planActionAgg.test.ts --environment=node`
Expected: FAIL (origine `undefined`, `actionsNationalesEnCours` absent).

- [ ] **Step 3 : Types applicatifs**

Dans `src/types/index.ts`, juste avant `export interface Action {` :
```ts
/** Qui a créé l'action : le Faritany lui-même ou le national (action d'appui). */
export type ActionOrigine = 'regionale' | 'nationale';
export type AppuiStatut = 'ouvert' | 'clos';

/** État de l'appui national à un Faritany (un seul ouvert à la fois). */
export interface AppuiFaritany {
  id: string;
  orgId: string;
  statut: AppuiStatut;
  referentUserId?: string | undefined;
  note?: string | undefined;
  ouvertAt: string;
  ouvertPar?: string | undefined;
  closAt?: string | undefined;
}
```
et dans `interface Action`, après `priorite: ActionPriorite;` :
```ts
  /** Toujours renseigné à la lecture (défaut 'regionale'). Optionnel pour les payloads existants. */
  origine?: ActionOrigine | undefined;
```

- [ ] **Step 4 : Types générés (édition manuelle — la stack locale n'est pas up pour `supabase gen types`)**

Dans `src/types/supabase.generated.ts` :
1. Table `plan_actions` : ajouter `origine: Database["public"]["Enums"]["action_origine"]` dans `Row` (ordre alphabétique : après `objectif: string`), et `origine?: Database["public"]["Enums"]["action_origine"]` dans `Insert` et `Update` (même position).
2. Après le bloc `alertes: { ... }` (fermeture de sa clé, avant la table suivante), insérer :
```ts
      appui_faritany: {
        Row: {
          clos_at: string | null
          id: string
          note: string | null
          org_id: string
          ouvert_at: string
          ouvert_par: string | null
          referent_user_id: string | null
          statut: Database["public"]["Enums"]["appui_statut"]
          updated_at: string
        }
        Insert: {
          clos_at?: string | null
          id?: string
          note?: string | null
          org_id: string
          ouvert_at?: string
          ouvert_par?: string | null
          referent_user_id?: string | null
          statut?: Database["public"]["Enums"]["appui_statut"]
          updated_at?: string
        }
        Update: {
          clos_at?: string | null
          id?: string
          note?: string | null
          org_id?: string
          ouvert_at?: string
          ouvert_par?: string | null
          referent_user_id?: string | null
          statut?: Database["public"]["Enums"]["appui_statut"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appui_faritany_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appui_faritany_ouvert_par_fkey"
            columns: ["ouvert_par"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appui_faritany_referent_user_id_fkey"
            columns: ["referent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
```
3. `Enums` (public) : ajouter en tête `action_origine: "regionale" | "nationale"` et, après `alerte_type: ...`, `appui_statut: "ouvert" | "clos"`.
4. `Constants.public.Enums` : ajouter `action_origine: ["regionale", "nationale"],` en tête et `appui_statut: ["ouvert", "clos"],` après `alerte_type`.

- [ ] **Step 5 : Service**

Dans `src/services/planActionService.ts` :
- import : `import type { PlanAction, PlanStatut, Action, ActionStatut, ActionPriorite, ActionOrigine, Suivi } from '@/types';`
- `rowToAction`, dans l'objet retourné après `priorite: ...,` :
```ts
    origine:             (row['origine'] as ActionOrigine | null | undefined) ?? 'regionale',
```
- `addAction`, dans l'objet `insert`, après `priorite: payload.priorite,` :
```ts
      origine:               payload.origine ?? 'regionale',
```
- `OrgActionAgg`, après `actionsRetard: number; ...` :
```ts
  actionsNationalesEnCours: number; // origine 'nationale' et statut ≠ termine (actions d'appui actives)
```
- `listActionAggByOrgIds` : select → `'org_id, plan_actions(statut, created_at, date_echeance, origine)'` ; `empty()` → ajouter `actionsNationalesEnCours: 0,` ; type du cast des actions → `{ statut: string; created_at: string | null; date_echeance: string | null; origine?: string | null }[]` ; dans la boucle, après le test `estEnRetard` :
```ts
      if (a.origine === 'nationale' && a.statut !== 'termine') agg.actionsNationalesEnCours++;
```

- [ ] **Step 6 : Vérifier**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/planActionOrigine.test.ts src/__tests__/planActionAgg.test.ts --environment=node` → PASS.
Run: `node node_modules/typescript/bin/tsc -b` → 0 erreur. (Si une construction littérale d'`OrgActionAgg` casse ailleurs : `grep -rn "actionsRetard: 0" src` et ajouter `actionsNationalesEnCours: 0`.)

- [ ] **Step 7 : Commit**

```bash
git add src/types/supabase.generated.ts src/types/index.ts src/services/planActionService.ts src/__tests__/planActionAgg.test.ts src/__tests__/planActionOrigine.test.ts
git commit -m "feat(pilotage): origine des actions + compteur d'actions nationales en cours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Utils purs — plan courant, plan cible, résolution OSN, libellés KO

**Files:**
- Modify: `src/utils/pilotage.ts`
- Modify: `src/stores/pilotageRegionalStore.ts` (l.34 : utiliser `choisirPlanCourant`, aucun changement de comportement)
- Test: `src/__tests__/pilotage.phase2.test.ts`

**Interfaces:**
- Produces :
  - `choisirPlanCourant<T extends { id: string; createdAt: string }>(plans: T[]): T | undefined` — le plus récent par `createdAt`. **Règle unique** partagée régional (lecture) / national (écriture).
  - `type CiblePlan = { kind: 'plan'; planId: string } | { kind: 'creer'; evalId: string } | { kind: 'impossible' }`
  - `choisirCiblePlan(plans: { id: string; createdAt: string }[], derniereEvalId: string | null): CiblePlan`
  - `resoudreOsnPilotage(ctx: { role: UserRole | undefined; orgId: string | undefined; orgType: string | undefined }, osns: { id: string; parentId?: string | undefined }[]): string | null`
  - `indexerLibellesCriteres(ref: { dimensions: { criteres: { code: string; libelle: { fr: string } }[] }[] } | null): Record<string, string>`
  - `PrioriteItem` (variante `action`) gagne `origine?: ActionOrigine | undefined`.

- [ ] **Step 1 : Test qui échoue**

Créer `src/__tests__/pilotage.phase2.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { choisirPlanCourant, choisirCiblePlan, resoudreOsnPilotage, indexerLibellesCriteres } from '@/utils/pilotage';

const p = (id: string, createdAt: string) => ({ id, createdAt });

describe('choisirPlanCourant', () => {
  it('rend le plus récent par createdAt, sans muter l entrée', () => {
    const plans = [p('ancien', '2026-01-01T00:00:00Z'), p('recent', '2026-06-01T00:00:00Z'), p('milieu', '2026-03-01T00:00:00Z')];
    expect(choisirPlanCourant(plans)?.id).toBe('recent');
    expect(plans[0]?.id).toBe('ancien');
  });
  it('undefined si aucun plan', () => {
    expect(choisirPlanCourant([])).toBeUndefined();
  });
});

describe('choisirCiblePlan', () => {
  it('plusieurs plans → le plan courant (celui que lit le régional), jamais une création', () => {
    expect(choisirCiblePlan([p('a', '2026-01-01'), p('b', '2026-05-01')], 'ev9')).toEqual({ kind: 'plan', planId: 'b' });
  });
  it('aucun plan mais une évaluation → créer sur cette évaluation', () => {
    expect(choisirCiblePlan([], 'ev1')).toEqual({ kind: 'creer', evalId: 'ev1' });
  });
  it('ni plan ni évaluation → impossible', () => {
    expect(choisirCiblePlan([], null)).toEqual({ kind: 'impossible' });
  });
});

describe('resoudreOsnPilotage', () => {
  const osns = [{ id: 'osn-mg', parentId: 'region-af' }, { id: 'osn-sn', parentId: 'region-x' }];
  it('compte OSN → son org', () => {
    expect(resoudreOsnPilotage({ role: 'responsable_osn', orgId: 'osn-mg', orgType: 'OSN' }, [])).toBe('osn-mg');
  });
  it('admin_global rattaché à la racine OMMS → première OSN visible', () => {
    expect(resoudreOsnPilotage({ role: 'admin_global', orgId: 'omms', orgType: 'OMMS' }, osns)).toBe('osn-mg');
  });
  it('responsable_region → OSN enfant de sa région', () => {
    expect(resoudreOsnPilotage({ role: 'responsable_region', orgId: 'region-x', orgType: 'REGION' }, osns)).toBe('osn-sn');
  });
  it('aucune OSN résoluble → null (jamais un cockpit vide silencieux)', () => {
    expect(resoudreOsnPilotage({ role: 'admin_global', orgId: 'omms', orgType: 'OMMS' }, [])).toBeNull();
    expect(resoudreOsnPilotage({ role: 'responsable_asn', orgId: 'f1', orgType: 'ASN' }, osns)).toBeNull();
    expect(resoudreOsnPilotage({ role: undefined, orgId: undefined, orgType: undefined }, osns)).toBeNull();
  });
});

describe('indexerLibellesCriteres', () => {
  it('indexe code → libellé fr, toutes dimensions', () => {
    const ref = { dimensions: [
      { criteres: [{ code: 'F401', libelle: { fr: 'Assurance des membres' } }] },
      { criteres: [{ code: 'F105', libelle: { fr: '' } }] },
    ] };
    expect(indexerLibellesCriteres(ref)).toEqual({ F401: 'Assurance des membres', F105: 'F105' });
  });
  it('référentiel absent → {}', () => {
    expect(indexerLibellesCriteres(null)).toEqual({});
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotage.phase2.test.ts --environment=node`
Expected: FAIL (exports absents).

- [ ] **Step 3 : Implémenter**

Dans `src/utils/pilotage.ts` :
- import en tête : `import type { ActionStatut, ActionPriorite, ActionOrigine, UserRole } from '@/types';`
- variante action de `PrioriteItem` :
```ts
  | { kind: 'action'; id: string; titre: string; statut: ActionStatut; dateEcheance: string; priorite: ActionPriorite; origine?: ActionOrigine | undefined };
```
- ajouter en fin de fichier :
```ts
/**
 * Plan « courant » d'un Faritany = le plus récent par createdAt. Règle UNIQUE :
 * le cockpit régional LIT ce plan, le national ÉCRIT ses actions d'appui dedans
 * — sinon une action d'appui atterrirait dans un plan que la région ne voit pas.
 */
export function choisirPlanCourant<T extends { id: string; createdAt: string }>(plans: T[]): T | undefined {
  return [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export type CiblePlan =
  | { kind: 'plan'; planId: string }
  | { kind: 'creer'; evalId: string }
  | { kind: 'impossible' };

/**
 * Où déposer une action d'appui : plan courant s'il existe ; sinon créer un plan
 * sur la dernière évaluation (plans_action.eval_id est NOT NULL UNIQUE) ;
 * sinon impossible (Faritany jamais évalué).
 */
export function choisirCiblePlan(plans: { id: string; createdAt: string }[], derniereEvalId: string | null): CiblePlan {
  const courant = choisirPlanCourant(plans);
  if (courant) return { kind: 'plan', planId: courant.id };
  if (derniereEvalId) return { kind: 'creer', evalId: derniereEvalId };
  return { kind: 'impossible' };
}

/**
 * OSN dont le cockpit national affiche les Faritany. Un compte OSN pilote son org ;
 * admin_global (rattaché à la racine OMMS en prod) prend la première OSN visible ;
 * responsable_region prend l'OSN enfant de sa région. null = rien de pilotable.
 */
export function resoudreOsnPilotage(
  ctx: { role: UserRole | undefined; orgId: string | undefined; orgType: string | undefined },
  osns: { id: string; parentId?: string | undefined }[],
): string | null {
  if (!ctx.orgId) return null;
  if (ctx.orgType === 'OSN') return ctx.orgId;
  if (ctx.role === 'admin_global') return osns[0]?.id ?? null;
  if (ctx.role === 'responsable_region') return osns.find(o => o.parentId === ctx.orgId)?.id ?? null;
  return null;
}

/** code critère → libellé fr (repli sur le code si libellé vide). */
export function indexerLibellesCriteres(
  ref: { dimensions: { criteres: { code: string; libelle: { fr: string } }[] }[] } | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of ref?.dimensions ?? []) {
    for (const c of d.criteres) out[c.code] = c.libelle.fr || c.code;
  }
  return out;
}
```
- Dans `src/stores/pilotageRegionalStore.ts` : remplacer
`const planRecent = [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];`
par `const planRecent = choisirPlanCourant(plans);` et ajouter `choisirPlanCourant` à l'import depuis `@/utils/pilotage`.

- [ ] **Step 4 : Vérifier**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotage.phase2.test.ts src/__tests__/pilotage.priorites.test.ts --environment=node` → PASS.
Run: `node node_modules/typescript/bin/tsc -b` → 0.

- [ ] **Step 5 : Commit**

```bash
git add src/utils/pilotage.ts src/stores/pilotageRegionalStore.ts src/__tests__/pilotage.phase2.test.ts
git commit -m "feat(pilotage): utils plan courant/cible, résolution OSN, libellés KO

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : `appuiService` — état d'appui + création d'action d'appui

**Files:**
- Create: `src/services/appuiService.ts`
- Test: `src/__tests__/appuiService.test.ts`

**Interfaces:**
- Consumes : `listPlansByOrg(orgId): Promise<PlanAction[]>`, `createPlan(payload: { evalId; orgId; statut; createdBy }, createdBy): Promise<string>`, `addAction(planId, payload): Promise<string>` (planActionService) ; `listEvaluationsByOrg(orgId): Promise<Evaluation[]>` (evaluationService, trié `created_at` DESC) ; `choisirCiblePlan` (Task 3) ; types Task 2.
- Produces :
  - `class AppuiDejaOuvertError extends Error` (message `Un appui est déjà ouvert pour ce Faritany.`)
  - `class CreationActionImpossibleError extends Error` (message `Aucune évaluation : impossible de créer une action d’appui.`)
  - `rowToAppui(row: Record<string, unknown>): AppuiFaritany`
  - `estConflitUnique(err: unknown): boolean` (code PG `23505`)
  - `interface AppuiInput { referentUserId?: string | null | undefined; note?: string | null | undefined }`
  - `interface ActionAppuiForm { objectif: string; domaineAmelioration: string; dateEcheance: string; priorite: ActionPriorite; responsable: string; critereCode?: string | undefined }`
  - `listAppuisOuvertsByOrgIds(orgIds: string[]): Promise<Record<string, AppuiFaritany>>`
  - `getAppuiOuvert(orgId: string): Promise<AppuiFaritany | null>`
  - `ouvrirAppui(orgId: string, input: AppuiInput): Promise<AppuiFaritany>`
  - `mettreAJourAppui(appuiId: string, input: AppuiInput): Promise<void>`
  - `cloreAppui(appuiId: string): Promise<void>`
  - `creerActionAppui(orgId: string, form: ActionAppuiForm, userId: string): Promise<string>`

- [ ] **Step 1 : Test qui échoue**

Créer `src/__tests__/appuiService.test.ts` :
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ insertResult: { data: null as unknown, error: null as unknown } }));
vi.mock('@/services/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve(h.insertResult) }) }),
    }),
  },
}));
vi.mock('@/services/planActionService', () => ({
  listPlansByOrg: vi.fn(),
  createPlan: vi.fn().mockResolvedValue('plan-neuf'),
  addAction: vi.fn().mockResolvedValue('action-1'),
}));
vi.mock('@/services/evaluationService', () => ({ listEvaluationsByOrg: vi.fn() }));

import {
  rowToAppui, estConflitUnique, ouvrirAppui, creerActionAppui,
  AppuiDejaOuvertError, CreationActionImpossibleError,
} from '@/services/appuiService';
import { listPlansByOrg, createPlan, addAction } from '@/services/planActionService';
import { listEvaluationsByOrg } from '@/services/evaluationService';

const form = { objectif: 'Former le trésorier', domaineAmelioration: 'Finances', dateEcheance: '2026-12-01', priorite: 'haute' as const, responsable: 'Rakoto' };

beforeEach(() => {
  vi.clearAllMocks();
  h.insertResult = { data: null, error: null };
});

describe('rowToAppui', () => {
  it('mappe les colonnes et omet les null', () => {
    expect(rowToAppui({ id: 'a', org_id: 'f1', statut: 'ouvert', referent_user_id: null, note: 'n', ouvert_at: '2026-10-04T00:00:00Z', ouvert_par: 'u1', clos_at: null }))
      .toEqual({ id: 'a', orgId: 'f1', statut: 'ouvert', note: 'n', ouvertAt: '2026-10-04T00:00:00Z', ouvertPar: 'u1' });
  });
});

describe('ouvrirAppui', () => {
  it('conflit 23505 (appui déjà ouvert) → AppuiDejaOuvertError lisible', async () => {
    h.insertResult = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_appui_ouvert_par_org"' } };
    await expect(ouvrirAppui('f1', {})).rejects.toBeInstanceOf(AppuiDejaOuvertError);
    expect(estConflitUnique({ code: '23505' })).toBe(true);
    expect(estConflitUnique(new Error('x'))).toBe(false);
  });
  it('autre erreur → relancée telle quelle', async () => {
    h.insertResult = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(ouvrirAppui('f1', {})).rejects.toMatchObject({ code: '42501' });
  });
});

describe('creerActionAppui', () => {
  it('plan existant → ajoute au plan COURANT (le plus récent), sans créer de plan', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([
      { id: 'vieux', evalId: 'e0', orgId: 'f1', statut: 'cloture', createdBy: 'u', createdAt: '2026-01-01' },
      { id: 'courant', evalId: 'e1', orgId: 'f1', statut: 'actif', createdBy: 'u', createdAt: '2026-06-01' },
    ]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e1' } as never]);
    await creerActionAppui('f1', { ...form, critereCode: 'F401' }, 'u-nat');
    expect(createPlan).not.toHaveBeenCalled();
    expect(addAction).toHaveBeenCalledWith('courant', {
      objectif: 'Former le trésorier', domaineAmelioration: 'Finances', dateEcheance: '2026-12-01', priorite: 'haute',
      responsable: 'Rakoto', description: '', statut: 'a_faire', origine: 'nationale', critereCode: 'F401',
    });
  });
  it('aucun plan mais une éval → crée le plan sur la DERNIÈRE éval puis ajoute', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e-recente' } as never, { id: 'e-ancienne' } as never]);
    await creerActionAppui('f1', form, 'u-nat');
    expect(createPlan).toHaveBeenCalledWith({ evalId: 'e-recente', orgId: 'f1', statut: 'actif', createdBy: 'u-nat' }, 'u-nat');
    expect(addAction).toHaveBeenCalledWith('plan-neuf', expect.objectContaining({ origine: 'nationale' }));
    expect(vi.mocked(addAction).mock.calls[0]?.[1]).not.toHaveProperty('critereCode');
  });
  it('ni plan ni éval → CreationActionImpossibleError, aucune écriture', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([]);
    await expect(creerActionAppui('f1', form, 'u-nat')).rejects.toBeInstanceOf(CreationActionImpossibleError);
    expect(createPlan).not.toHaveBeenCalled();
    expect(addAction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/appuiService.test.ts --environment=node`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : Implémenter**

Créer `src/services/appuiService.ts` :
```ts
import { supabase } from './supabase';
import type { AppuiFaritany, AppuiStatut, ActionPriorite } from '@/types';
import { listPlansByOrg, createPlan, addAction } from './planActionService';
import { listEvaluationsByOrg } from './evaluationService';
import { choisirCiblePlan } from '@/utils/pilotage';

// Requêtes à plat, SANS embed : appui_faritany a deux FK vers users
// (referent_user_id, ouvert_par) → un embed PostgREST serait ambigu (400).

export class AppuiDejaOuvertError extends Error {
  constructor() { super('Un appui est déjà ouvert pour ce Faritany.'); this.name = 'AppuiDejaOuvertError'; }
}

export class CreationActionImpossibleError extends Error {
  constructor() { super('Aucune évaluation : impossible de créer une action d’appui.'); this.name = 'CreationActionImpossibleError'; }
}

export interface AppuiInput {
  referentUserId?: string | null | undefined;
  note?: string | null | undefined;
}

export interface ActionAppuiForm {
  objectif: string;
  domaineAmelioration: string;
  dateEcheance: string;
  priorite: ActionPriorite;
  responsable: string;
  critereCode?: string | undefined;
}

export function rowToAppui(row: Record<string, unknown>): AppuiFaritany {
  const referentUserId = row['referent_user_id'] as string | null | undefined;
  const note           = row['note']             as string | null | undefined;
  const ouvertPar      = row['ouvert_par']       as string | null | undefined;
  const closAt         = row['clos_at']          as string | null | undefined;
  return {
    id:       row['id']        as string,
    orgId:    row['org_id']    as string,
    statut:   row['statut']    as AppuiStatut,
    ouvertAt: row['ouvert_at'] as string,
    ...(referentUserId != null ? { referentUserId } : {}),
    ...(note           != null ? { note }           : {}),
    ...(ouvertPar      != null ? { ouvertPar }      : {}),
    ...(closAt         != null ? { closAt }         : {}),
  };
}

/** Violation d'unicité PG — ici : l'index partiel « un seul appui ouvert ». */
export function estConflitUnique(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505';
}

export async function listAppuisOuvertsByOrgIds(orgIds: string[]): Promise<Record<string, AppuiFaritany>> {
  if (orgIds.length === 0) return {};
  const { data, error } = await supabase
    .from('appui_faritany')
    .select('*')
    .in('org_id', orgIds)
    .eq('statut', 'ouvert');
  if (error) throw error;
  const out: Record<string, AppuiFaritany> = {};
  for (const r of data ?? []) {
    const a = rowToAppui(r as Record<string, unknown>);
    out[a.orgId] = a;
  }
  return out;
}

export async function getAppuiOuvert(orgId: string): Promise<AppuiFaritany | null> {
  const { data, error } = await supabase
    .from('appui_faritany')
    .select('*')
    .eq('org_id', orgId)
    .eq('statut', 'ouvert')
    .maybeSingle();
  if (error) throw error;
  return data ? rowToAppui(data as Record<string, unknown>) : null;
}

export async function ouvrirAppui(orgId: string, input: AppuiInput): Promise<AppuiFaritany> {
  const { data, error } = await supabase
    .from('appui_faritany')
    .insert({ org_id: orgId, referent_user_id: input.referentUserId ?? null, note: input.note ?? null })
    .select('*')
    .single();
  if (error) {
    if (estConflitUnique(error)) throw new AppuiDejaOuvertError();
    throw error;
  }
  return rowToAppui(data as Record<string, unknown>);
}

export async function mettreAJourAppui(appuiId: string, input: AppuiInput): Promise<void> {
  const patch: { referent_user_id?: string | null; note?: string | null } = {};
  if (input.referentUserId !== undefined) patch.referent_user_id = input.referentUserId;
  if (input.note           !== undefined) patch.note             = input.note;
  const { data, error } = await supabase.from('appui_faritany').update(patch).eq('id', appuiId).select('id');
  if (error) throw error;
  // 0 ligne = RLS a filtré (échec silencieux sinon) — patron updateStatutEvaluation.
  if (!data || data.length === 0) throw new Error('Appui introuvable ou non modifiable.');
}

export async function cloreAppui(appuiId: string): Promise<void> {
  const { data, error } = await supabase
    .from('appui_faritany')
    .update({ statut: 'clos', clos_at: new Date().toISOString() })
    .eq('id', appuiId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Appui introuvable ou non modifiable.');
}

/**
 * Crée une action d'appui (origine 'nationale') dans le plan COURANT du Faritany
 * — celui que lit le cockpit régional. Sans plan : en crée un sur la dernière
 * évaluation. Sans évaluation : CreationActionImpossibleError.
 */
export async function creerActionAppui(orgId: string, form: ActionAppuiForm, userId: string): Promise<string> {
  const [plans, evals] = await Promise.all([listPlansByOrg(orgId), listEvaluationsByOrg(orgId)]);
  const cible = choisirCiblePlan(plans, evals[0]?.id ?? null);
  if (cible.kind === 'impossible') throw new CreationActionImpossibleError();
  const planId = cible.kind === 'plan'
    ? cible.planId
    : await createPlan({ evalId: cible.evalId, orgId, statut: 'actif', createdBy: userId }, userId);
  return addAction(planId, {
    objectif: form.objectif,
    domaineAmelioration: form.domaineAmelioration,
    dateEcheance: form.dateEcheance,
    priorite: form.priorite,
    responsable: form.responsable,
    description: '',
    statut: 'a_faire',
    origine: 'nationale',
    ...(form.critereCode ? { critereCode: form.critereCode } : {}),
  });
}
```

- [ ] **Step 4 : Vérifier**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/appuiService.test.ts --environment=node` → PASS (6 tests).
Run: `node node_modules/typescript/bin/tsc -b` → 0.

- [ ] **Step 5 : Commit**

```bash
git add src/services/appuiService.ts src/__tests__/appuiService.test.ts
git commit -m "feat(pilotage): appuiService — état d'appui + action d'appui dans le plan courant

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Store national Phase 2

**Files:**
- Modify (réécriture complète) : `src/stores/pilotageNationalStore.ts`
- Modify: `src/components/dashboard/pilotage/WatchlistFaritany.tsx` (type `WatchlistRow` uniquement : `enAppui?`)
- Modify: `src/components/dashboard/pilotage/DrilldownFaritany.tsx` (type `DrilldownAction` exporté uniquement — le rendu change en Task 7)
- Test: `src/__tests__/pilotageNationalStore.test.ts`

**Interfaces:**
- Consumes : Tasks 2-4 ; `listUsers(): Promise<UserProfile[]>` (adminService, filtré par RLS) ; `getReferentiel(version): Promise<Referentiel | null>` ; `listEvaluationsByOrg` ; `listPlansByOrg`/`listActions`/`estEnRetard`.
- Produces :
  - `WatchlistRow.enAppui?: boolean | undefined`
  - `export interface DrilldownAction { id: string; titre: string; statut: ActionStatut; dateEcheance: string; origine: ActionOrigine }` (dans `DrilldownFaritany.tsx`)
  - `export interface DetailFaritany { orgId: string; actionsSouffrance: DrilldownAction[]; actionsNationales: DrilldownAction[]; peutCreerAction: boolean }`
  - `export interface Referent { id: string; nom: string }`
  - `export interface ContexteUtilisateur { role: UserRole | undefined; orgId: string | undefined; orgType: string | undefined }`
  - state ajouté : `osnId: string | null`, `appuis: Record<string, AppuiFaritany>`, `nbActionsNationalesEnCours: number`, `libellesKo: Record<string, string>`, `referents: Referent[]`, `detail: DetailFaritany | null`, `detailOrgId: string | null`, `captureBusy: boolean`, `captureError: string | null`
  - actions : `loadPourUtilisateur(ctx: ContexteUtilisateur): Promise<void>`, `load(osnId: string): Promise<void>` (conservée), `chargerDetail(orgId: string): Promise<void>`, `ouvrirAppui(orgId: string, input: AppuiInput): Promise<boolean>`, `majAppui(orgId: string, input: AppuiInput): Promise<boolean>`, `cloreAppui(orgId: string): Promise<boolean>`, `creerActionAppui(orgId: string, form: ActionAppuiForm, userId: string): Promise<boolean>`, `reset()`.

- [ ] **Step 1 : Test qui échoue**

Créer `src/__tests__/pilotageNationalStore.test.ts` :
```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/services/organisationService', () => ({
  listOrganisations: vi.fn(),
  getLibelleNiveauLocal: vi.fn().mockResolvedValue('Faritany'),
}));
vi.mock('@/services/dashboardService', () => ({ getDashboardStatsByOrgIds: vi.fn() }));
vi.mock('@/services/planActionService', () => ({
  listActionAggByOrgIds: vi.fn(),
  listPlansByOrg: vi.fn().mockResolvedValue([]),
  listActions: vi.fn().mockResolvedValue([]),
  estEnRetard: (s: string, d: string | null, t: string) => !!d && s !== 'termine' && s !== 'bloque' && d.slice(0, 10) < t,
}));
vi.mock('@/services/evaluationService', () => ({ listEvaluationsByOrg: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/referentielService', () => ({ getReferentiel: vi.fn() }));
vi.mock('@/services/adminService', () => ({ listUsers: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/appuiService', () => ({
  listAppuisOuvertsByOrgIds: vi.fn(),
  ouvrirAppui: vi.fn(),
  mettreAJourAppui: vi.fn(),
  cloreAppui: vi.fn(),
  creerActionAppui: vi.fn(),
}));

import { usePilotageNationalStore } from '@/stores/pilotageNationalStore';
import { listOrganisations } from '@/services/organisationService';
import { getDashboardStatsByOrgIds } from '@/services/dashboardService';
import { listActionAggByOrgIds, listPlansByOrg, listActions } from '@/services/planActionService';
import { listEvaluationsByOrg } from '@/services/evaluationService';
import { getReferentiel } from '@/services/referentielService';
import { listUsers } from '@/services/adminService';
import { listAppuisOuvertsByOrgIds, ouvrirAppui, creerActionAppui } from '@/services/appuiService';

const far = (id: string) => ({ id, nom: id, code: `ANT-0${id}`, type: 'ASN', actif: true, poids: 1, parentId: 'osn-mg' });
const agg = (o: Partial<Record<string, number>> = {}) => ({ actionsTotal: 0, actionsDone: 0, actionsEnCours: 0, actionsBloque: 0, actionsRetard: 0, actionsNationalesEnCours: 0, latestUpdate: null, ...o });

beforeEach(() => {
  vi.clearAllMocks();
  usePilotageNationalStore.getState().reset();
  vi.mocked(listOrganisations).mockImplementation(async (type) => (type === 'OSN'
    ? [{ id: 'osn-mg', nom: 'TEM', type: 'OSN', actif: true, poids: 1 }]
    : [far('1'), far('2')]) as never);
  vi.mocked(getDashboardStatsByOrgIds).mockResolvedValue({
    '1': { orgId: '1', scoreGlobal: 40, scoreParDimension: {}, criteresEssentielsKO: ['F401'], referentielVersion: 'far_v1_0' },
  } as never);
  vi.mocked(listActionAggByOrgIds).mockResolvedValue({ '1': agg({ actionsTotal: 2, actionsNationalesEnCours: 1 }), '2': agg({ actionsNationalesEnCours: 2 }) } as never);
  vi.mocked(listAppuisOuvertsByOrgIds).mockResolvedValue({ '1': { id: 'ap1', orgId: '1', statut: 'ouvert', ouvertAt: '2026-10-04' } });
  vi.mocked(getReferentiel).mockResolvedValue({ version: 'far_v1_0', dimensions: [{ criteres: [{ code: 'F401', libelle: { fr: 'Assurance des membres', en: '' } }] }] } as never);
  vi.mocked(listUsers).mockResolvedValue([
    { id: 'u-admin', orgId: 'omms', role: 'admin_global', nom: 'Admin', prenom: 'Gsat' },
    { id: 'u-osn', orgId: 'osn-mg', role: 'responsable_osn', nom: 'Rabe', prenom: 'Hery' },
    { id: 'u-far', orgId: '1', role: 'responsable_asn', nom: 'Far', prenom: 'Un' },
  ] as never);
});

describe('pilotageNationalStore — Phase 2', () => {
  it('admin_global rattaché à OMMS → résout l OSN et charge ses Faritany', async () => {
    await usePilotageNationalStore.getState().loadPourUtilisateur({ role: 'admin_global', orgId: 'omms', orgType: 'OMMS' });
    const s = usePilotageNationalStore.getState();
    expect(listOrganisations).toHaveBeenCalledWith('OSN');
    expect(listOrganisations).toHaveBeenCalledWith('ASN', 'osn-mg');
    expect(s.osnId).toBe('osn-mg');
    expect(s.rows).toHaveLength(2);
    expect(s.error).toBeNull();
  });

  it('aucune OSN résoluble → erreur explicite, pas un cockpit vide', async () => {
    vi.mocked(listOrganisations).mockResolvedValue([]);
    await usePilotageNationalStore.getState().loadPourUtilisateur({ role: 'admin_global', orgId: 'omms', orgType: 'OMMS' });
    expect(usePilotageNationalStore.getState().error).toMatch(/Aucune organisation nationale/);
  });

  it('appuis, compteur national, libellés KO et référents nationaux', async () => {
    await usePilotageNationalStore.getState().load('osn-mg');
    const s = usePilotageNationalStore.getState();
    expect(s.rows.find(r => r.org.id === '1')?.enAppui).toBe(true);
    expect(s.rows.find(r => r.org.id === '2')?.enAppui).toBe(false);
    expect(s.nbActionsNationalesEnCours).toBe(3);
    expect(s.libellesKo).toEqual({ F401: 'Assurance des membres' });
    expect(s.referents).toEqual([{ id: 'u-admin', nom: 'Gsat Admin' }, { id: 'u-osn', nom: 'Hery Rabe' }]);
  });

  it('échec de lecture des appuis → erreur (§6), pas un faux « aucun appui »', async () => {
    vi.mocked(listAppuisOuvertsByOrgIds).mockRejectedValue(new Error('boom appui'));
    await usePilotageNationalStore.getState().load('osn-mg');
    expect(usePilotageNationalStore.getState().error).toBe('boom appui');
  });

  it('chargerDetail : actions en souffrance + nationales du plan courant ; impossible sans éval', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([{ id: 'p1', evalId: 'e1', orgId: '1', statut: 'actif', createdBy: 'u', createdAt: '2026-06-01' }]);
    vi.mocked(listActions).mockResolvedValue([
      { id: 'a1', planId: 'p1', objectif: 'Retard', description: '', domaineAmelioration: 'D', responsable: '', dateEcheance: '2020-01-01', statut: 'a_faire', priorite: 'haute', createdAt: '', origine: 'regionale' },
      { id: 'a2', planId: 'p1', objectif: 'Appui', description: '', domaineAmelioration: 'D', responsable: '', dateEcheance: '2099-01-01', statut: 'en_cours', priorite: 'haute', createdAt: '', origine: 'nationale' },
    ]);
    await usePilotageNationalStore.getState().chargerDetail('1');
    const d = usePilotageNationalStore.getState().detail;
    expect(d?.actionsSouffrance.map(a => a.id)).toEqual(['a1']);
    expect(d?.actionsNationales.map(a => a.id)).toEqual(['a2']);
    expect(d?.peutCreerAction).toBe(true);

    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([]);
    await usePilotageNationalStore.getState().chargerDetail('2');
    expect(usePilotageNationalStore.getState().detail?.peutCreerAction).toBe(false);
  });

  it('ouvrirAppui en conflit → captureError lisible, false', async () => {
    await usePilotageNationalStore.getState().load('osn-mg');
    vi.mocked(ouvrirAppui).mockRejectedValue(new Error('Un appui est déjà ouvert pour ce Faritany.'));
    const ok = await usePilotageNationalStore.getState().ouvrirAppui('2', {});
    expect(ok).toBe(false);
    expect(usePilotageNationalStore.getState().captureError).toBe('Un appui est déjà ouvert pour ce Faritany.');
    expect(usePilotageNationalStore.getState().captureBusy).toBe(false);
  });

  it('creerActionAppui → appelle le service puis recharge cockpit + détail', async () => {
    await usePilotageNationalStore.getState().load('osn-mg');
    vi.mocked(creerActionAppui).mockResolvedValue('a-new');
    const form = { objectif: 'O', domaineAmelioration: 'D', dateEcheance: '2026-12-01', priorite: 'haute' as const, responsable: '' };
    const ok = await usePilotageNationalStore.getState().creerActionAppui('1', form, 'u-osn');
    expect(ok).toBe(true);
    expect(creerActionAppui).toHaveBeenCalledWith('1', form, 'u-osn');
    expect(listActionAggByOrgIds).toHaveBeenCalledTimes(2); // load initial + rechargement
    expect(listPlansByOrg).toHaveBeenCalledWith('1');      // détail rechargé
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageNationalStore.test.ts --environment=node`
Expected: FAIL (`loadPourUtilisateur is not a function`, etc.).

- [ ] **Step 3 : Types des composants**

Dans `src/components/dashboard/pilotage/WatchlistFaritany.tsx`, interface `WatchlistRow`, ajouter :
```ts
  enAppui?: boolean | undefined;
```
Dans `src/components/dashboard/pilotage/DrilldownFaritany.tsx`, en tête (après l'import) :
```ts
import type { ActionOrigine, ActionStatut } from '@/types';

export interface DrilldownAction {
  id: string;
  titre: string;
  statut: ActionStatut;
  dateEcheance: string;
  origine: ActionOrigine;
}
```

- [ ] **Step 4 : Réécrire le store**

Remplacer intégralement `src/stores/pilotageNationalStore.ts` par :
```ts
import { create } from 'zustand';
import { listOrganisations, getLibelleNiveauLocal } from '@/services/organisationService';
import { getDashboardStatsByOrgIds } from '@/services/dashboardService';
import { listActionAggByOrgIds, listPlansByOrg, listActions, estEnRetard } from '@/services/planActionService';
import { listEvaluationsByOrg } from '@/services/evaluationService';
import { getReferentiel } from '@/services/referentielService';
import { listUsers } from '@/services/adminService';
import {
  listAppuisOuvertsByOrgIds,
  ouvrirAppui as svcOuvrirAppui,
  mettreAJourAppui as svcMettreAJourAppui,
  cloreAppui as svcCloreAppui,
  creerActionAppui as svcCreerActionAppui,
  type AppuiInput,
  type ActionAppuiForm,
} from '@/services/appuiService';
import {
  deriverStatutFaritany, bucketiser2x2, choisirCiblePlan, choisirPlanCourant, resoudreOsnPilotage, indexerLibellesCriteres,
  type Bucket2x2, type FaritanySignals,
} from '@/utils/pilotage';
import type { WatchlistRow } from '@/components/dashboard/pilotage/WatchlistFaritany';
import type { DrilldownAction } from '@/components/dashboard/pilotage/DrilldownFaritany';
import type { Action, AppuiFaritany, DashboardStats, UserRole } from '@/types';

export interface DetailFaritany {
  orgId: string;
  actionsSouffrance: DrilldownAction[];
  actionsNationales: DrilldownAction[];
  peutCreerAction: boolean;
}

export interface Referent { id: string; nom: string }

export interface ContexteUtilisateur {
  role: UserRole | undefined;
  orgId: string | undefined;
  orgType: string | undefined;
}

interface PilotageNationalState {
  osnId: string | null;
  rows: WatchlistRow[];
  statsById: Record<string, DashboardStats>;
  buckets: Bucket2x2;
  niveauLabel: string | undefined;
  nbEvalues: number;
  appuis: Record<string, AppuiFaritany>;
  nbActionsNationalesEnCours: number;
  libellesKo: Record<string, string>;
  referents: Referent[];
  detail: DetailFaritany | null;
  detailOrgId: string | null;
  captureBusy: boolean;
  captureError: string | null;
  loading: boolean;
  error: string | null;
  loadPourUtilisateur: (ctx: ContexteUtilisateur) => Promise<void>;
  load: (osnId: string) => Promise<void>;
  chargerDetail: (orgId: string) => Promise<void>;
  ouvrirAppui: (orgId: string, input: AppuiInput) => Promise<boolean>;
  majAppui: (orgId: string, input: AppuiInput) => Promise<boolean>;
  cloreAppui: (orgId: string) => Promise<boolean>;
  creerActionAppui: (orgId: string, form: ActionAppuiForm, userId: string) => Promise<boolean>;
  reset: () => void;
}

const EMPTY_BUCKETS: Bucket2x2 = { appuiUrgent: 0, conformite: 0, execution: 0, sain: 0, nonEvalue: 0 };

/** Rôles proposables comme référent national d'un appui. */
const ROLES_REFERENT: UserRole[] = ['admin_global', 'responsable_osn', 'responsable_region'];

const INITIAL = {
  osnId: null, rows: [] as WatchlistRow[], statsById: {} as Record<string, DashboardStats>, buckets: EMPTY_BUCKETS,
  niveauLabel: undefined, nbEvalues: 0, appuis: {} as Record<string, AppuiFaritany>, nbActionsNationalesEnCours: 0,
  libellesKo: {} as Record<string, string>, referents: [] as Referent[], detail: null, detailOrgId: null,
  captureBusy: false, captureError: null, loading: false, error: null,
};

function versDetail(a: Action): DrilldownAction {
  return { id: a.id, titre: a.objectif || a.description, statut: a.statut, dateEcheance: a.dateEcheance, origine: a.origine ?? 'regionale' };
}

export const usePilotageNationalStore = create<PilotageNationalState>((set, get) => {
  /** Exécute une capture : busy + erreur lisible, puis recharge cockpit et détail. */
  async function capturer(orgId: string, op: () => Promise<unknown>): Promise<boolean> {
    set({ captureBusy: true, captureError: null });
    try {
      await op();
      const osnId = get().osnId;
      if (osnId) await get().load(osnId);
      await get().chargerDetail(orgId);
      return true;
    } catch (err) {
      set({ captureError: (err as Error).message });
      return false;
    } finally {
      set({ captureBusy: false });
    }
  }

  return {
    ...INITIAL,

    loadPourUtilisateur: async (ctx) => {
      set({ loading: true, error: null });
      try {
        const osns = ctx.orgType === 'OSN' ? [] : await listOrganisations('OSN');
        const osnId = resoudreOsnPilotage(ctx, osns);
        if (!osnId) {
          set({ loading: false, error: 'Aucune organisation nationale rattachée à ce compte.' });
          return;
        }
        set({ osnId });
        await get().load(osnId);
      } catch (err) {
        set({ error: (err as Error).message, loading: false });
      }
    },

    load: async (osnId) => {
      set({ loading: true, error: null, osnId });
      try {
        const orgs = await listOrganisations('ASN', osnId);
        const ids = orgs.map(o => o.id);
        const [stats, aggs, appuis, niveauLabel, users] = await Promise.all([
          getDashboardStatsByOrgIds(ids),
          listActionAggByOrgIds(ids),
          listAppuisOuvertsByOrgIds(ids),
          getLibelleNiveauLocal(osnId).catch(() => null),
          listUsers().catch(() => []),
        ]);
        // Libellés KO (cosmétique : repli sur le code si le référentiel est illisible).
        const versions = [...new Set(Object.values(stats).map(s => s.referentielVersion).filter((v): v is string => !!v))];
        const refs = await Promise.all(versions.map(v => getReferentiel(v).catch(() => null)));
        const libellesKo: Record<string, string> = Object.assign({}, ...refs.map(r => indexerLibellesCriteres(r)));

        const rows: WatchlistRow[] = orgs.map(org => {
          const st = stats[org.id];
          const ag = aggs[org.id];
          const signals: FaritanySignals = {
            evalue: st != null,
            essentielsKoCount: st?.criteresEssentielsKO?.length ?? 0,
            actionsTotal: ag?.actionsTotal ?? 0,
            actionsRetard: ag?.actionsRetard ?? 0,
            actionsBloque: ag?.actionsBloque ?? 0,
          };
          return {
            org,
            statut: deriverStatutFaritany(signals),
            essentielsKoCount: signals.essentielsKoCount,
            actionsTotal: signals.actionsTotal,
            actionsRetard: signals.actionsRetard,
            actionsBloque: signals.actionsBloque,
            enAppui: appuis[org.id] != null,
          };
        });
        const signalsList: FaritanySignals[] = rows.map(r => ({
          evalue: r.statut !== 'non_evalue',
          essentielsKoCount: r.essentielsKoCount,
          actionsTotal: r.actionsTotal,
          actionsRetard: r.actionsRetard,
          actionsBloque: r.actionsBloque,
        }));
        const referents: Referent[] = users
          .filter(u => ROLES_REFERENT.includes(u.role) && (u.orgId === osnId || u.role === 'admin_global'))
          .map(u => ({ id: u.id, nom: `${u.prenom} ${u.nom}`.trim() }));
        set({
          rows,
          statsById: stats,
          buckets: bucketiser2x2(signalsList),
          niveauLabel: niveauLabel ?? undefined,
          nbEvalues: rows.filter(r => r.statut !== 'non_evalue').length,
          appuis,
          nbActionsNationalesEnCours: Object.values(aggs).reduce((n, a) => n + (a.actionsNationalesEnCours ?? 0), 0),
          libellesKo,
          referents,
          loading: false,
        });
      } catch (err) {
        set({ error: (err as Error).message, loading: false });
      }
    },

    chargerDetail: async (orgId) => {
      set({ detailOrgId: orgId, detail: null, captureError: null });
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [plans, evals] = await Promise.all([listPlansByOrg(orgId), listEvaluationsByOrg(orgId)]);
        const courant = choisirPlanCourant(plans);
        const actions = courant ? await listActions(courant.id) : [];
        if (get().detailOrgId !== orgId) return; // sélection changée entre-temps
        set({
          detail: {
            orgId,
            actionsSouffrance: actions.filter(a => a.statut === 'bloque' || estEnRetard(a.statut, a.dateEcheance, today)).map(versDetail),
            actionsNationales: actions.filter(a => a.origine === 'nationale').map(versDetail),
            peutCreerAction: choisirCiblePlan(plans, evals[0]?.id ?? null).kind !== 'impossible',
          },
        });
      } catch (err) {
        if (get().detailOrgId === orgId) set({ captureError: (err as Error).message });
      }
    },

    ouvrirAppui: (orgId, input) => capturer(orgId, () => svcOuvrirAppui(orgId, input)),

    majAppui: (orgId, input) => capturer(orgId, async () => {
      const appui = get().appuis[orgId];
      if (!appui) throw new Error('Aucun appui ouvert pour ce Faritany.');
      await svcMettreAJourAppui(appui.id, input);
    }),

    cloreAppui: (orgId) => capturer(orgId, async () => {
      const appui = get().appuis[orgId];
      if (!appui) throw new Error('Aucun appui ouvert pour ce Faritany.');
      await svcCloreAppui(appui.id);
    }),

    creerActionAppui: (orgId, form, userId) => capturer(orgId, () => svcCreerActionAppui(orgId, form, userId)),

    reset: () => set({ ...INITIAL }),
  };
});
```

- [ ] **Step 5 : Vérifier**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageNationalStore.test.ts --environment=node` → PASS (7 tests).
Run: `node node_modules/typescript/bin/tsc -b` → 0. (La page Phase 1 appelle encore `load(orgId)` : toujours valide, la page est adaptée en Task 6.)

- [ ] **Step 6 : Commit**

```bash
git add src/stores/pilotageNationalStore.ts src/components/dashboard/pilotage/WatchlistFaritany.tsx src/components/dashboard/pilotage/DrilldownFaritany.tsx src/__tests__/pilotageNationalStore.test.ts
git commit -m "feat(pilotage): store national Phase 2 — résolution OSN, appuis, détail, capture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Watchlist (colonne Appui) + bandeau synthèse + page nationale câblée

**Files:**
- Modify: `src/components/dashboard/pilotage/WatchlistFaritany.tsx`
- Modify: `src/pages/dashboard/PilotageNationalPage.tsx` (en-tête, bandeau, chargement ; le drill-down enrichi arrive en Task 7)
- Modify: `src/__tests__/watchlistFaritany.test.tsx`
- Modify: `src/__tests__/pilotageNationalPage.test.tsx`

**Interfaces:**
- Consumes : store Task 5 (`loadPourUtilisateur`, `nbActionsNationalesEnCours`, `buckets`, `rows[].enAppui`) ; `KpiStrip`/`KpiItem` (`@/components/dashboard/KpiStrip`) ; `useAuthStore` champs `role`, `orgId`, `orgType`.
- Produces : colonne « Appui » (chip « En appui » si `enAppui`, sinon `—`) ; bandeau 3 KPI.

- [ ] **Step 1 : Tests qui échouent**

Dans `src/__tests__/watchlistFaritany.test.tsx`, ajouter ce test dans le `describe` principal (réutiliser le mock i18n interpolant et le helper de construction de lignes déjà présents dans le fichier ; si le helper s'appelle autrement, construire la ligne à la main avec les champs de `WatchlistRow`) :
```tsx
  it('colonne Appui : chip « En appui » pour un Faritany appuyé, tiret sinon', () => {
    const org = (id: string, code: string) => ({ id, nom: `Far ${id}`, code, type: 'ASN' as const, actif: true, poids: 1 });
    render(<WatchlistFaritany rows={[
      { org: org('1', 'ANT-01'), statut: 'en_souffrance', essentielsKoCount: 1, actionsTotal: 2, actionsRetard: 1, actionsBloque: 0, enAppui: true },
      { org: org('2', 'ANT-02'), statut: 'sous_controle', essentielsKoCount: 0, actionsTotal: 1, actionsRetard: 0, actionsBloque: 0 },
    ]} />);
    expect(screen.getByText('Appui')).toBeInTheDocument();
    const ligne1 = screen.getByText('Far 1').closest('tr')!;
    const ligne2 = screen.getByText('Far 2').closest('tr')!;
    expect(within(ligne1).getByText('En appui')).toBeInTheDocument();
    expect(within(ligne2).queryByText('En appui')).toBeNull();
  });
```
(ajouter `within` à l'import `@testing-library/react`).

Remplacer intégralement `src/__tests__/pilotageNationalPage.test.tsx` par :
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string, opts?: Record<string, unknown>) => {
      const s = d ?? k;
      return opts ? s.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(opts[key] ?? '')) : s;
    },
  }),
}));
const auth = vi.hoisted(() => ({ state: { orgId: 'osn-1', role: 'responsable_osn', orgType: 'OSN', user: { id: 'u1' } } as Record<string, unknown> }));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: (s: Record<string, unknown>) => unknown) => (sel ? sel(auth.state) : auth.state),
}));
vi.mock('@/services/organisationService', () => ({
  listOrganisations: vi.fn(),
  getLibelleNiveauLocal: vi.fn().mockResolvedValue('Faritany'),
}));
vi.mock('@/services/dashboardService', () => ({ getDashboardStatsByOrgIds: vi.fn().mockResolvedValue({}) }));
vi.mock('@/services/planActionService', () => ({
  listActionAggByOrgIds: vi.fn().mockResolvedValue({}),
  listPlansByOrg: vi.fn().mockResolvedValue([]),
  listActions: vi.fn().mockResolvedValue([]),
  estEnRetard: () => false,
}));
vi.mock('@/services/evaluationService', () => ({ listEvaluationsByOrg: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/referentielService', () => ({ getReferentiel: vi.fn().mockResolvedValue(null) }));
vi.mock('@/services/adminService', () => ({ listUsers: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/appuiService', () => ({
  listAppuisOuvertsByOrgIds: vi.fn().mockResolvedValue({}),
  ouvrirAppui: vi.fn(), mettreAJourAppui: vi.fn(), cloreAppui: vi.fn(), creerActionAppui: vi.fn(),
}));

import { PilotageNationalPage } from '@/pages/dashboard/PilotageNationalPage';
import { listOrganisations } from '@/services/organisationService';

const FAR = [{ id: 'f1', code: 'ANT-01', nom: 'Analamanga', type: 'ASN', actif: true, poids: 1 }];

describe('PilotageNationalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.state = { orgId: 'osn-1', role: 'responsable_osn', orgType: 'OSN', user: { id: 'u1' } };
    vi.mocked(listOrganisations).mockImplementation(async (type) => (type === 'OSN' ? [{ id: 'osn-1', nom: 'TEM', type: 'OSN', actif: true, poids: 1 }] : FAR) as never);
  });

  it('dégradation : « X évalués / N » + ligne non évalué, sans faux « tout va bien »', async () => {
    render(<PilotageNationalPage />);
    await waitFor(() => expect(screen.getByText('Analamanga')).toBeInTheDocument());
    expect(screen.getByText('non évalué')).toBeInTheDocument();
    expect(screen.getByText('0 évalués / 1')).toBeInTheDocument();
  });

  it('bandeau synthèse : 3 compteurs dont « Actions nationales en cours »', async () => {
    render(<PilotageNationalPage />);
    await waitFor(() => expect(screen.getByText('Analamanga')).toBeInTheDocument());
    expect(screen.getByText('Faritany en zone appui')).toBeInTheDocument();
    expect(screen.getByText('Faritany avec essentiel KO')).toBeInTheDocument();
    expect(screen.getByText('Actions nationales en cours')).toBeInTheDocument();
  });

  it('admin_global rattaché à OMMS → voit les Faritany de l OSN résolue', async () => {
    auth.state = { orgId: 'omms', role: 'admin_global', orgType: 'OMMS', user: { id: 'u-admin' } };
    render(<PilotageNationalPage />);
    await waitFor(() => expect(screen.getByText('Analamanga')).toBeInTheDocument());
    expect(listOrganisations).toHaveBeenCalledWith('ASN', 'osn-1');
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run (arrière-plan, jsdom lent) : `timeout 590 node node_modules/vitest/vitest.mjs run src/__tests__/watchlistFaritany.test.tsx src/__tests__/pilotageNationalPage.test.tsx`
Expected: FAIL (colonne Appui absente, bandeau absent, admin → 0 Faritany).

- [ ] **Step 3 : Watchlist**

Dans `src/components/dashboard/pilotage/WatchlistFaritany.tsx` :
- dans le `<thead>`, entre la colonne Statut et la colonne vide finale :
```tsx
            <th className="py-2 px-2">{t('pages.pilotageNational.colAppui', 'Appui')}</th>
```
- ligne de groupe province : `colSpan={7}` → `colSpan={8}`.
- dans chaque ligne, entre la cellule Statut et la cellule `↗` :
```tsx
                    <td className="py-2 px-2">
                      {r.enAppui ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#e0e3ff] text-[#15236e]">
                          {t('pages.pilotageNational.enAppui', 'En appui')}
                        </span>
                      ) : <span className="text-[#767682]">—</span>}
                    </td>
```

- [ ] **Step 4 : Page nationale (chargement + bandeau)**

Dans `src/pages/dashboard/PilotageNationalPage.tsx` :
- imports : ajouter `import { KpiStrip, type KpiItem } from '@/components/dashboard/KpiStrip';`
- remplacer le bloc auth + store + premier `useEffect` par :
```tsx
  const role = useAuthStore(s => s.role);
  const orgId = useAuthStore(s => s.orgId);
  const orgType = useAuthStore(s => s.orgType);
  const { rows, statsById, buckets, niveauLabel, nbEvalues, nbActionsNationalesEnCours, libellesKo, loading, error, loadPourUtilisateur, reset } = usePilotageNationalStore();
  const [selection, setSelection] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    void loadPourUtilisateur({ role, orgId, orgType });
    return reset;
  }, [role, orgId, orgType, loadPourUtilisateur, reset]);
```
- dans le `useMemo` du drill-down, libellé : `.map(code => ({ code, libelle: libellesKo[code] ?? code }))` et ajouter `libellesKo` aux dépendances.
- après le bloc `{error && ...}`, insérer :
```tsx
      <KpiStrip loading={loading && rows.length === 0} kpis={[
        { label: t('pages.pilotageNational.kpiZoneAppui', 'Faritany en zone appui'), value: buckets.appuiUrgent, variant: buckets.appuiUrgent > 0 ? 'danger' : 'default' },
        { label: t('pages.pilotageNational.kpiAvecKo', 'Faritany avec essentiel KO'), value: buckets.appuiUrgent + buckets.conformite, variant: buckets.appuiUrgent + buckets.conformite > 0 ? 'warning' : 'default' },
        { label: t('pages.pilotageNational.kpiActionsNationales', 'Actions nationales en cours'), value: nbActionsNationalesEnCours, variant: 'default' },
      ] satisfies KpiItem[]} />
```

- [ ] **Step 5 : Vérifier**

Run : `timeout 590 node node_modules/vitest/vitest.mjs run src/__tests__/watchlistFaritany.test.tsx src/__tests__/pilotageNationalPage.test.tsx` → PASS.
Run : `node node_modules/typescript/bin/tsc -b` → 0.

- [ ] **Step 6 : Commit**

```bash
git add src/components/dashboard/pilotage/WatchlistFaritany.tsx src/pages/dashboard/PilotageNationalPage.tsx src/__tests__/watchlistFaritany.test.tsx src/__tests__/pilotageNationalPage.test.tsx
git commit -m "feat(pilotage): colonne Appui, bandeau synthèse, OSN résolue pour admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Drill-down enrichi + composant `CaptureAppui`

**Files:**
- Modify: `src/components/dashboard/pilotage/DrilldownFaritany.tsx`
- Create: `src/components/dashboard/pilotage/CaptureAppui.tsx`
- Modify: `src/pages/dashboard/PilotageNationalPage.tsx` (composition drill-down + capture)
- Modify: `src/__tests__/drilldownFaritany.test.tsx`
- Test: `src/__tests__/captureAppui.test.tsx`

**Interfaces:**
- Consumes : `DrilldownAction` (Task 5), `AppuiFaritany`, `ActionAppuiForm`, `AppuiInput` (Task 4), store Task 5 (`detail`, `appuis`, `referents`, `captureBusy`, `captureError`, `chargerDetail`, `ouvrirAppui`, `majAppui`, `cloreAppui`, `creerActionAppui`) ; `useAuthStore(s => s.user?.id)`.
- Produces :
  - `DrilldownData` gagne `actionsSouffrance?: DrilldownAction[] | undefined`, `actionsNationales?: DrilldownAction[] | undefined` ; `DrilldownFaritany` accepte `children?: ReactNode` (zone de capture).
  - `CaptureAppui(props: CaptureAppuiProps)` avec
```ts
export interface CaptureAppuiProps {
  appui: AppuiFaritany | null;
  referents: { id: string; nom: string }[];
  essentielsKO: { code: string; libelle: string }[];
  /** null = détail en cours de chargement (ne PAS afficher « impossible » à tort). */
  peutCreerAction: boolean | null;
  busy: boolean;
  error: string | null;
  onOuvrir: (input: { referentUserId: string | null; note: string | null }) => void;
  onMettreAJour: (input: { referentUserId: string | null; note: string | null }) => void;
  onClore: () => void;
  onCreerAction: (form: ActionAppuiForm) => Promise<boolean>;
}
```

- [ ] **Step 1 : Tests qui échouent**

Dans `src/__tests__/drilldownFaritany.test.tsx`, ajouter :
```tsx
  it('liste les actions en souffrance et les actions nationales avec échéance', () => {
    render(<DrilldownFaritany onClose={() => {}} data={{
      nom: 'Analamanga', essentielsKO: [], actionsRetard: 1, actionsBloque: 0,
      actionsSouffrance: [{ id: 'a1', titre: 'Recenser les unités', statut: 'a_faire', dateEcheance: '2026-09-01T00:00:00Z', origine: 'regionale' }],
      actionsNationales: [{ id: 'a2', titre: 'Former le trésorier', statut: 'en_cours', dateEcheance: '2026-12-01T00:00:00Z', origine: 'nationale' }],
    }}><p>zone capture</p></DrilldownFaritany>);
    expect(screen.getByText('Recenser les unités')).toBeInTheDocument();
    expect(screen.getByText('Échéance 2026-09-01')).toBeInTheDocument();
    expect(screen.getByText('Former le trésorier')).toBeInTheDocument();
    expect(screen.getByText('zone capture')).toBeInTheDocument();
    expect(screen.queryByText(/Phase 2/)).toBeNull();
  });
```

Créer `src/__tests__/captureAppui.test.tsx` :
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaptureAppui, type CaptureAppuiProps } from '@/components/dashboard/pilotage/CaptureAppui';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string, opts?: Record<string, unknown>) => {
      const s = d ?? k;
      return opts ? s.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(opts[key] ?? '')) : s;
    },
  }),
}));

function props(over: Partial<CaptureAppuiProps> = {}): CaptureAppuiProps {
  return {
    appui: null,
    referents: [{ id: 'u-osn', nom: 'Hery Rabe' }],
    essentielsKO: [{ code: 'F401', libelle: 'Assurance des membres' }],
    peutCreerAction: true,
    busy: false,
    error: null,
    onOuvrir: vi.fn(), onMettreAJour: vi.fn(), onClore: vi.fn(),
    onCreerAction: vi.fn().mockResolvedValue(true),
    ...over,
  };
}

describe('CaptureAppui', () => {
  it('sans appui : « Marquer en appui » transmet référent et note', () => {
    const p = props();
    render(<CaptureAppui {...p} />);
    fireEvent.change(screen.getByLabelText('Référent national'), { target: { value: 'u-osn' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Visite prévue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Marquer en appui' }));
    expect(p.onOuvrir).toHaveBeenCalledWith({ referentUserId: 'u-osn', note: 'Visite prévue' });
  });

  it('appui ouvert : affiche la date, permet de clore', () => {
    const p = props({ appui: { id: 'ap1', orgId: 'f1', statut: 'ouvert', ouvertAt: '2026-10-04T08:00:00Z', referentUserId: 'u-osn' } });
    render(<CaptureAppui {...p} />);
    expect(screen.getByText('En appui depuis le 2026-10-04')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clore l’appui' }));
    expect(p.onClore).toHaveBeenCalled();
  });

  it('Faritany jamais évalué : message honnête, pas de formulaire', () => {
    render(<CaptureAppui {...props({ peutCreerAction: false })} />);
    expect(screen.getByText('Aucune évaluation : impossible de créer une action d’appui.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer l’action d’appui' })).toBeNull();
  });

  it('détail en chargement : ni « impossible » ni formulaire', () => {
    render(<CaptureAppui {...props({ peutCreerAction: null })} />);
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText(/impossible de créer/)).toBeNull();
  });

  it('formulaire : désactivé tant que les champs requis manquent, puis payload exact', async () => {
    const p = props();
    render(<CaptureAppui {...p} />);
    const bouton = screen.getByRole('button', { name: 'Créer l’action d’appui' });
    expect(bouton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Objectif'), { target: { value: 'Former le trésorier' } });
    fireEvent.change(screen.getByLabelText('Domaine d’amélioration'), { target: { value: 'Finances' } });
    fireEvent.change(screen.getByLabelText('Échéance'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Critère essentiel visé'), { target: { value: 'F401' } });
    expect(bouton).not.toBeDisabled();
    fireEvent.click(bouton);
    await waitFor(() => expect(p.onCreerAction).toHaveBeenCalledWith({
      objectif: 'Former le trésorier', domaineAmelioration: 'Finances', dateEcheance: '2026-12-01',
      priorite: 'haute', responsable: '', critereCode: 'F401',
    }));
    await waitFor(() => expect(screen.getByLabelText('Objectif')).toHaveValue(''));
  });

  it('affiche l erreur de capture', () => {
    render(<CaptureAppui {...props({ error: 'Un appui est déjà ouvert pour ce Faritany.' })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Un appui est déjà ouvert pour ce Faritany.');
  });
});
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `timeout 590 node node_modules/vitest/vitest.mjs run src/__tests__/drilldownFaritany.test.tsx src/__tests__/captureAppui.test.tsx`
Expected: FAIL.

- [ ] **Step 3 : Drill-down**

Remplacer intégralement `src/components/dashboard/pilotage/DrilldownFaritany.tsx` par (le type `DrilldownAction` de la Task 5 est conservé tel quel) :
```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionOrigine, ActionStatut } from '@/types';

export interface DrilldownAction {
  id: string;
  titre: string;
  statut: ActionStatut;
  dateEcheance: string;
  origine: ActionOrigine;
}

export interface DrilldownData {
  nom: string;
  essentielsKO: { code: string; libelle: string }[];
  actionsRetard: number;
  actionsBloque: number;
  actionsSouffrance?: DrilldownAction[] | undefined;
  actionsNationales?: DrilldownAction[] | undefined;
}

function ListeActions({ actions }: { actions: DrilldownAction[] }) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-1.5 mt-2">
      {actions.map(a => (
        <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-[#171c22]">{a.titre}</span>
          <span className="text-xs text-[#767682] shrink-0">
            {t('pages.pilotageNational.echeance', 'Échéance {{date}}', { date: a.dateEcheance.slice(0, 10) })}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DrilldownFaritany({ data, onClose, children }: { data: DrilldownData | null; onClose: () => void; children?: ReactNode }) {
  const { t } = useTranslation();
  if (!data) return null;
  return (
    <aside className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-5 border-b border-[#eceef4]">
        <h3 className="text-lg font-extrabold text-[#15236e]">{data.nom}</h3>
        <button type="button" onClick={onClose} aria-label={t('common.fermer', 'Fermer')} className="text-[#767682] hover:text-[#171c22]">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="p-5 space-y-6 overflow-y-auto">
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-[#ba1a1a] mb-2">
            {t('pages.pilotageNational.drillKo', 'Essentiels non conformes')}
          </h4>
          {data.essentielsKO.length === 0 ? (
            <p className="text-sm text-[#767682]">{t('pages.pilotageNational.drillAucunKo', 'Aucun essentiel KO.')}</p>
          ) : (
            <ul className="space-y-1">
              {data.essentielsKO.map(k => (
                <li key={k.code} className="text-sm text-[#171c22]">{k.code} — {k.libelle}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-[#8a5a00] mb-2">
            {t('pages.pilotageNational.drillActions', 'Actions en souffrance')}
          </h4>
          <p className="text-sm text-[#171c22]">
            {t('pages.pilotageNational.drillResume', '{{retard}} en retard · {{bloque}} bloquées', { retard: data.actionsRetard, bloque: data.actionsBloque })}
          </p>
          {data.actionsSouffrance && data.actionsSouffrance.length > 0 && <ListeActions actions={data.actionsSouffrance} />}
        </section>
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-[#15236e] mb-2">
            {t('pages.pilotageNational.drillNationales', 'Actions d’appui nationales')}
          </h4>
          {data.actionsNationales && data.actionsNationales.length > 0
            ? <ListeActions actions={data.actionsNationales} />
            : <p className="text-sm text-[#767682]">{t('pages.pilotageNational.drillAucuneNationale', 'Aucune action d’appui.')}</p>}
        </section>
        {children}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4 : Composant `CaptureAppui`**

Créer `src/components/dashboard/pilotage/CaptureAppui.tsx` :
```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionPriorite, AppuiFaritany } from '@/types';
import type { ActionAppuiForm } from '@/services/appuiService';

export interface CaptureAppuiProps {
  appui: AppuiFaritany | null;
  referents: { id: string; nom: string }[];
  essentielsKO: { code: string; libelle: string }[];
  /** null = détail en cours de chargement. */
  peutCreerAction: boolean | null;
  busy: boolean;
  error: string | null;
  onOuvrir: (input: { referentUserId: string | null; note: string | null }) => void;
  onMettreAJour: (input: { referentUserId: string | null; note: string | null }) => void;
  onClore: () => void;
  onCreerAction: (form: ActionAppuiForm) => Promise<boolean>;
}

const PRIORITES: ActionPriorite[] = ['critique', 'haute', 'moyenne', 'basse'];
const VIDE = { objectif: '', domaine: '', echeance: '', priorite: 'haute' as ActionPriorite, responsable: '', critere: '' };
const champ = 'w-full rounded-lg border border-[#c6c5d4] px-3 py-2 text-sm';
const etiquette = 'block text-xs font-semibold text-[#454651] mb-1';

export function CaptureAppui(p: CaptureAppuiProps) {
  const { t } = useTranslation();
  const [referent, setReferent] = useState(p.appui?.referentUserId ?? '');
  const [note, setNote] = useState(p.appui?.note ?? '');
  const [f, setF] = useState(VIDE);

  // Resynchronise quand on change de Faritany / d'appui.
  useEffect(() => {
    setReferent(p.appui?.referentUserId ?? '');
    setNote(p.appui?.note ?? '');
  }, [p.appui?.id, p.appui?.referentUserId, p.appui?.note]);

  const etat = { referentUserId: referent || null, note: note.trim() || null };
  const formValide = f.objectif.trim() !== '' && f.domaine.trim() !== '' && f.echeance !== '';

  async function soumettre() {
    const ok = await p.onCreerAction({
      objectif: f.objectif.trim(),
      domaineAmelioration: f.domaine.trim(),
      dateEcheance: f.echeance,
      priorite: f.priorite,
      responsable: f.responsable.trim(),
      ...(f.critere ? { critereCode: f.critere } : {}),
    });
    if (ok) setF(VIDE);
  }

  return (
    <div className="space-y-6 border-t border-[#eceef4] pt-5">
      {p.error && <div role="alert" className="p-3 bg-[#ffdad6] text-[#93000a] rounded-lg text-sm">{p.error}</div>}

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-[#15236e]">{t('pages.pilotageNational.captureTitre', 'Appui national')}</h4>
        {p.appui && (
          <p className="text-sm font-semibold text-[#15236e]">
            {t('pages.pilotageNational.enAppuiDepuis', 'En appui depuis le {{date}}', { date: p.appui.ouvertAt.slice(0, 10) })}
          </p>
        )}
        <div>
          <label htmlFor="appui-referent" className={etiquette}>{t('pages.pilotageNational.referent', 'Référent national')}</label>
          <select id="appui-referent" className={champ} value={referent} onChange={e => setReferent(e.target.value)}>
            <option value="">{t('pages.pilotageNational.aucunReferent', '— Aucun —')}</option>
            {p.referents.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="appui-note" className={etiquette}>{t('pages.pilotageNational.note', 'Note')}</label>
          <textarea id="appui-note" rows={2} className={champ} value={note} onChange={e => setNote(e.target.value)} />
        </div>
        {p.appui ? (
          <div className="flex gap-2">
            <button type="button" disabled={p.busy} onClick={() => p.onMettreAJour(etat)} className="px-3 py-2 rounded-lg bg-[#15236e] text-white text-sm font-semibold disabled:opacity-50">
              {t('pages.pilotageNational.enregistrer', 'Enregistrer')}
            </button>
            <button type="button" disabled={p.busy} onClick={p.onClore} className="px-3 py-2 rounded-lg border border-[#c6c5d4] text-sm font-semibold disabled:opacity-50">
              {t('pages.pilotageNational.clore', 'Clore l’appui')}
            </button>
          </div>
        ) : (
          <button type="button" disabled={p.busy} onClick={() => p.onOuvrir(etat)} className="px-3 py-2 rounded-lg bg-[#15236e] text-white text-sm font-semibold disabled:opacity-50">
            {t('pages.pilotageNational.marquer', 'Marquer en appui')}
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wide text-[#15236e]">{t('pages.pilotageNational.actionTitre', 'Créer une action d’appui')}</h4>
        {p.peutCreerAction === null ? (
          <p className="text-sm text-[#767682]">{t('common.chargement', 'Chargement…')}</p>
        ) : !p.peutCreerAction ? (
          <p className="text-sm text-[#767682]">{t('pages.pilotageNational.actionImpossible', 'Aucune évaluation : impossible de créer une action d’appui.')}</p>
        ) : (
          <>
            <div>
              <label htmlFor="aa-objectif" className={etiquette}>{t('pages.pilotageNational.objectif', 'Objectif')}</label>
              <input id="aa-objectif" className={champ} value={f.objectif} onChange={e => setF({ ...f, objectif: e.target.value })} />
            </div>
            <div>
              <label htmlFor="aa-domaine" className={etiquette}>{t('pages.pilotageNational.domaine', 'Domaine d’amélioration')}</label>
              <input id="aa-domaine" className={champ} value={f.domaine} onChange={e => setF({ ...f, domaine: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="aa-echeance" className={etiquette}>{t('pages.pilotageNational.echeanceLabel', 'Échéance')}</label>
                <input id="aa-echeance" type="date" className={champ} value={f.echeance} onChange={e => setF({ ...f, echeance: e.target.value })} />
              </div>
              <div>
                <label htmlFor="aa-priorite" className={etiquette}>{t('pages.pilotageNational.priorite', 'Priorité')}</label>
                <select id="aa-priorite" className={champ} value={f.priorite} onChange={e => setF({ ...f, priorite: e.target.value as ActionPriorite })}>
                  {PRIORITES.map(pr => <option key={pr} value={pr}>{t(`pages.pilotageNational.priorites.${pr}`, pr)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="aa-responsable" className={etiquette}>{t('pages.pilotageNational.responsable', 'Responsable')}</label>
              <input id="aa-responsable" className={champ} value={f.responsable} onChange={e => setF({ ...f, responsable: e.target.value })} />
            </div>
            <div>
              <label htmlFor="aa-critere" className={etiquette}>{t('pages.pilotageNational.critere', 'Critère essentiel visé')}</label>
              <select id="aa-critere" className={champ} value={f.critere} onChange={e => setF({ ...f, critere: e.target.value })}>
                <option value="">{t('pages.pilotageNational.aucunCritere', '— Aucun —')}</option>
                {p.essentielsKO.map(k => <option key={k.code} value={k.code}>{k.code} — {k.libelle}</option>)}
              </select>
            </div>
            <button type="button" disabled={!formValide || p.busy} onClick={() => void soumettre()} className="px-3 py-2 rounded-lg bg-[#15236e] text-white text-sm font-semibold disabled:opacity-50">
              {t('pages.pilotageNational.creerAction', 'Créer l’action d’appui')}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 5 : Composer dans la page**

Dans `src/pages/dashboard/PilotageNationalPage.tsx` :
- imports : `import { CaptureAppui } from '@/components/dashboard/pilotage/CaptureAppui';`
- auth : `const userId = useAuthStore(s => s.user?.id);`
- déstructurer en plus du store : `appuis, referents, detail, captureBusy, captureError, chargerDetail, ouvrirAppui, majAppui, cloreAppui, creerActionAppui`.
- après le premier `useEffect` :
```tsx
  useEffect(() => {
    if (selection) void chargerDetail(selection);
  }, [selection, chargerDetail]);
```
- dans le `useMemo` du drill-down, ajouter au retour (et `detail` aux dépendances) :
```tsx
      actionsSouffrance: detail?.orgId === selection ? detail.actionsSouffrance : undefined,
      actionsNationales: detail?.orgId === selection ? detail.actionsNationales : undefined,
```
- remplacer `<DrilldownFaritany data={drilldown} onClose={() => setSelection(null)} />` par :
```tsx
      <DrilldownFaritany data={drilldown} onClose={() => setSelection(null)}>
        {selection && drilldown && (
          <CaptureAppui
            appui={appuis[selection] ?? null}
            referents={referents}
            essentielsKO={drilldown.essentielsKO}
            peutCreerAction={detail?.orgId === selection ? detail.peutCreerAction && !!userId : null}
            busy={captureBusy}
            error={captureError}
            onOuvrir={input => void ouvrirAppui(selection, input)}
            onMettreAJour={input => void majAppui(selection, input)}
            onClore={() => void cloreAppui(selection)}
            onCreerAction={form => (userId ? creerActionAppui(selection, form, userId) : Promise.resolve(false))}
          />
        )}
      </DrilldownFaritany>
```

- [ ] **Step 6 : Vérifier**

Run : `timeout 590 node node_modules/vitest/vitest.mjs run src/__tests__/drilldownFaritany.test.tsx src/__tests__/captureAppui.test.tsx src/__tests__/pilotageNationalPage.test.tsx` → PASS.
Run : `node node_modules/typescript/bin/tsc -b` → 0.

- [ ] **Step 7 : Commit**

```bash
git add src/components/dashboard/pilotage/DrilldownFaritany.tsx src/components/dashboard/pilotage/CaptureAppui.tsx src/pages/dashboard/PilotageNationalPage.tsx src/__tests__/drilldownFaritany.test.tsx src/__tests__/captureAppui.test.tsx
git commit -m "feat(pilotage): drill-down enrichi + capture d'appui (marquer, référent, action d'appui)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Cockpit régional — badge « National », chip « en appui », libellés KO

**Files:**
- Modify: `src/stores/pilotageRegionalStore.ts`
- Modify: `src/components/dashboard/pilotage/FilePriorites.tsx`
- Modify: `src/pages/dashboard/PilotageRegionalPage.tsx`
- Modify: `src/__tests__/filePriorites.test.tsx`
- Modify: `src/__tests__/pilotageRegionalPage.test.tsx`

**Interfaces:**
- Consumes : `getAppuiOuvert(orgId)` (Task 4), `getReferentiel`, `indexerLibellesCriteres`, `PrioriteItem.origine` (Task 3), `Action.origine` (Task 2).
- Produces : state régional `enAppui: boolean` ; badge « National » sur les items action `origine === 'nationale'` ; libellé KO réel.

- [ ] **Step 1 : Tests qui échouent**

Dans `src/__tests__/filePriorites.test.tsx`, ajouter (mock i18n interpolant déjà présent ; rendu sous `MemoryRouter` comme les autres tests du fichier) :
```tsx
  it('badge « National » sur une action d appui, absent sur une action régionale', () => {
    render(<MemoryRouter><FilePriorites evalue actionsTerminees={0} items={[
      { kind: 'action', id: 'n', titre: 'Former le trésorier', statut: 'bloque', dateEcheance: '2026-09-01', priorite: 'haute', origine: 'nationale' },
      { kind: 'action', id: 'r', titre: 'Recenser', statut: 'a_faire', dateEcheance: '2026-08-01', priorite: 'basse', origine: 'regionale' },
    ]} /></MemoryRouter>);
    const ligneN = screen.getByText('Former le trésorier').closest('li')!;
    const ligneR = screen.getByText('Recenser').closest('li')!;
    expect(within(ligneN).getByText('National')).toBeInTheDocument();
    expect(within(ligneR).queryByText('National')).toBeNull();
  });
```
(ajouter `within` à l'import ; ajouter `import { MemoryRouter } from 'react-router-dom';` si absent.)

Dans `src/__tests__/pilotageRegionalPage.test.tsx` :
- ajouter avant les imports du composant :
```tsx
vi.mock('@/services/appuiService', () => ({ getAppuiOuvert: vi.fn().mockResolvedValue(null) }));
vi.mock('@/services/referentielService', () => ({ getReferentiel: vi.fn().mockResolvedValue(null) }));
```
- ajouter les imports `import { getAppuiOuvert } from '@/services/appuiService';` et `import { getReferentiel } from '@/services/referentielService';`
- ajouter ce test :
```tsx
  it('chip « En appui national » + libellé réel du KO', async () => {
    vi.mocked(getDashboardStats).mockResolvedValueOnce({ criteresEssentielsKO: ['F401'], referentielVersion: 'far_v1_0' } as any);
    vi.mocked(getAppuiOuvert).mockResolvedValueOnce({ id: 'ap1', orgId: 'f1', statut: 'ouvert', ouvertAt: '2026-10-04' });
    vi.mocked(getReferentiel).mockResolvedValueOnce({ dimensions: [{ criteres: [{ code: 'F401', libelle: { fr: 'Assurance des membres', en: '' } }] }] } as any);
    render(<MemoryRouter><PilotageRegionalPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('En appui national')).toBeInTheDocument());
    expect(screen.getByText('F401 — Assurance des membres')).toBeInTheDocument();
  });
```

- [ ] **Step 2 : Vérifier l'échec**

Run : `timeout 590 node node_modules/vitest/vitest.mjs run src/__tests__/filePriorites.test.tsx src/__tests__/pilotageRegionalPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3 : Store régional**

Dans `src/stores/pilotageRegionalStore.ts` :
- imports : `import { getAppuiOuvert } from '@/services/appuiService';`, `import { getReferentiel } from '@/services/referentielService';`, et `indexerLibellesCriteres` dans l'import `@/utils/pilotage`.
- interface + `INITIAL` : ajouter `enAppui: boolean` / `enAppui: false`.
- dans `load`, remplacer le `Promise.all` par :
```ts
      const [stats, plans, appui] = await Promise.all([
        getDashboardStats(orgId),
        listPlansByOrg(orgId),
        // chip informatif : un échec ne doit pas masquer les priorités.
        getAppuiOuvert(orgId).catch(() => null),
      ]);
      const ref = stats?.referentielVersion ? await getReferentiel(stats.referentielVersion).catch(() => null) : null;
      const libelles = indexerLibellesCriteres(ref);
```
- `koItems` : `libelle: libelles[code] ?? code,`
- `actionItems` (map) : ajouter `origine: a.origine,` à l'objet.
- `set({...})` : ajouter `enAppui: appui != null,`.

- [ ] **Step 4 : FilePriorites + page**

Dans `src/components/dashboard/pilotage/FilePriorites.tsx`, dans le `<li>` d'une action, juste après le `<span>` du badge statut :
```tsx
            {it.origine === 'nationale' && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#e0e3ff] text-[#15236e]">
                {t('pages.pilotageRegional.badgeNational', 'National')}
              </span>
            )}
```
Dans `src/pages/dashboard/PilotageRegionalPage.tsx` : déstructurer `enAppui` du store, et sous le `<h1>` :
```tsx
        {enAppui && (
          <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#e0e3ff] text-[#15236e]">
            {t('pages.pilotageRegional.chipAppui', 'En appui national')}
          </span>
        )}
```

- [ ] **Step 5 : Vérifier**

Run : `timeout 590 node node_modules/vitest/vitest.mjs run src/__tests__/filePriorites.test.tsx src/__tests__/pilotageRegionalPage.test.tsx` → PASS.
Run : `node node_modules/typescript/bin/tsc -b` → 0.

- [ ] **Step 6 : Commit**

```bash
git add src/stores/pilotageRegionalStore.ts src/components/dashboard/pilotage/FilePriorites.tsx src/pages/dashboard/PilotageRegionalPage.tsx src/__tests__/filePriorites.test.tsx src/__tests__/pilotageRegionalPage.test.tsx
git commit -m "feat(pilotage): régional — badge National, chip en appui, libellés KO

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : i18n fr/en + gate complet

**Files:**
- Modify: `src/i18n/fr.ts`, `src/i18n/en.ts`
- Test: `src/__tests__/i18nPilotagePhase2.test.ts`

**Interfaces:**
- Consumes : toutes les clés `t()` introduites en Tasks 6-8.

- [ ] **Step 1 : Test de parité qui échoue**

Créer `src/__tests__/i18nPilotagePhase2.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { fr } from '@/i18n/fr';
import { en } from '@/i18n/en';

const NAT = ['colAppui', 'enAppui', 'kpiZoneAppui', 'kpiAvecKo', 'kpiActionsNationales', 'echeance', 'drillNationales',
  'drillAucuneNationale', 'captureTitre', 'enAppuiDepuis', 'referent', 'aucunReferent', 'note', 'enregistrer', 'clore',
  'marquer', 'actionTitre', 'actionImpossible', 'objectif', 'domaine', 'echeanceLabel', 'priorite', 'responsable',
  'critere', 'aucunCritere', 'creerAction'];
const REG = ['badgeNational', 'chipAppui'];

describe('i18n cockpits Phase 2', () => {
  it('clés présentes et non vides en fr et en', () => {
    for (const lang of [fr, en] as Record<string, any>[]) {
      for (const k of NAT) expect(lang.pages.pilotageNational[k], `pilotageNational.${k}`).toBeTruthy();
      for (const k of ['critique', 'haute', 'moyenne', 'basse']) expect(lang.pages.pilotageNational.priorites?.[k]).toBeTruthy();
      for (const k of REG) expect(lang.pages.pilotageRegional[k], `pilotageRegional.${k}`).toBeTruthy();
    }
  });
  it('placeholders Phase 1 retirés', () => {
    expect((fr as any).pages.pilotageNational.drillPhase2).toBeUndefined();
    expect((en as any).pages.pilotageNational.drillPhase2).toBeUndefined();
  });
});
```
(Les deux fichiers exportent des constantes nommées : `export const fr = {…}` / `export const en = {…}`.)

Run : `node node_modules/vitest/vitest.mjs run src/__tests__/i18nPilotagePhase2.test.ts --environment=node` → FAIL.

- [ ] **Step 2 : Ajouter les clés**

`src/i18n/fr.ts`, objet `pages.pilotageNational` : SUPPRIMER `drillPhase2`, ajouter :
```ts
      colAppui: 'Appui',
      enAppui: 'En appui',
      kpiZoneAppui: 'Faritany en zone appui',
      kpiAvecKo: 'Faritany avec essentiel KO',
      kpiActionsNationales: 'Actions nationales en cours',
      echeance: 'Échéance {{date}}',
      drillNationales: 'Actions d’appui nationales',
      drillAucuneNationale: 'Aucune action d’appui.',
      captureTitre: 'Appui national',
      enAppuiDepuis: 'En appui depuis le {{date}}',
      referent: 'Référent national',
      aucunReferent: '— Aucun —',
      note: 'Note',
      enregistrer: 'Enregistrer',
      clore: 'Clore l’appui',
      marquer: 'Marquer en appui',
      actionTitre: 'Créer une action d’appui',
      actionImpossible: 'Aucune évaluation : impossible de créer une action d’appui.',
      objectif: 'Objectif',
      domaine: 'Domaine d’amélioration',
      echeanceLabel: 'Échéance',
      priorite: 'Priorité',
      priorites: { critique: 'Critique', haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' },
      responsable: 'Responsable',
      critere: 'Critère essentiel visé',
      aucunCritere: '— Aucun —',
      creerAction: 'Créer l’action d’appui',
```
objet `pages.pilotageRegional`, ajouter :
```ts
      badgeNational: 'National',
      chipAppui: 'En appui national',
```
`src/i18n/en.ts`, mêmes emplacements (SUPPRIMER `drillPhase2`) :
```ts
      colAppui: 'Support',
      enAppui: 'Supported',
      kpiZoneAppui: 'Faritany needing support',
      kpiAvecKo: 'Faritany with a failed essential',
      kpiActionsNationales: 'National actions in progress',
      echeance: 'Due {{date}}',
      drillNationales: 'National support actions',
      drillAucuneNationale: 'No support action.',
      captureTitre: 'National support',
      enAppuiDepuis: 'Supported since {{date}}',
      referent: 'National focal point',
      aucunReferent: '— None —',
      note: 'Note',
      enregistrer: 'Save',
      clore: 'Close support',
      marquer: 'Mark as supported',
      actionTitre: 'Create a support action',
      actionImpossible: 'No evaluation: a support action cannot be created.',
      objectif: 'Objective',
      domaine: 'Improvement area',
      echeanceLabel: 'Due date',
      priorite: 'Priority',
      priorites: { critique: 'Critical', haute: 'High', moyenne: 'Medium', basse: 'Low' },
      responsable: 'Owner',
      critere: 'Targeted essential criterion',
      aucunCritere: '— None —',
      creerAction: 'Create support action',
```
```ts
      badgeNational: 'National',
      chipAppui: 'Nationally supported',
```

- [ ] **Step 3 : Gate complet (contrôleur — fait autorité)**

```bash
node node_modules/typescript/bin/tsc -b                                    # attendu : 0
node node_modules/vite/bin/vite.js build                                    # attendu : OK, chunks Pilotage émis
timeout 590 node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'   # attendu : 100 % vert
```
Le run COMPLET est obligatoire (leçon Phase 1 : les runs étroits par tâche ont raté une régression cross-tâche). Tout échec → corriger avant commit.

- [ ] **Step 4 : Commit**

```bash
git add src/i18n/fr.ts src/i18n/en.ts src/__tests__/i18nPilotagePhase2.test.ts
git commit -m "feat(pilotage): i18n fr/en Phase 2 (capture d'appui, badge national)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : Déploiement prod — ⛔ GATED (autorisation explicite de l'utilisateur à CHAQUE étape prod)

**Pré-requis :** revue whole-branch passée ; gate Task 9 vert ; l'utilisateur a dit explicitement « go deploy Phase 2 » (ou équivalent nommé). Aucune lecture prod avant ce go.

**Ordre IMPÉRATIF :** migration AVANT frontend. Le frontend Phase 2 sélectionne `plan_actions.origine` et lit `appui_faritany` : déployé avant, il casserait aussi les cockpits Phase 1 en ligne (400 PostgREST).

- [ ] **Step 1 : Intégration git**
  - PR #9 (Phase 1) mergée par l'utilisateur ; puis `git fetch && git rebase origin/master` sur `feat/cockpits-pilotage-phase2` ; re-gate Task 9 Step 3.
  - `git push -u origin feat/cockpits-pilotage-phase2` ; `gh pr create --base master` (corps terminé par `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). Merge = décision utilisateur.

- [ ] **Step 2 : Accès VPS + backup**
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 'echo ok'   # si timeout : firewall hPanel (bloc 153.67.85.x) → demander à l'utilisateur de le rouvrir
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 'TS=$(date +%Y%m%d-%H%M%S); docker exec supabase_db_gsat pg_dump -U postgres -d postgres > /root/gsat_backup_pre_pilotage_appui_$TS.sql && tail -3 /root/gsat_backup_pre_pilotage_appui_$TS.sql && ls -la /root/gsat_backup_pre_pilotage_appui_$TS.sql'
```
Attendu : marqueur de fin `-- PostgreSQL database dump complete`, taille ≥ 1 Mo.

- [ ] **Step 3 : Pré-check lecture seule**
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"select tablename, policyname, cmd from pg_policies where tablename in ('plans_action','plan_actions') order by 1,2;\" -c \"select to_regclass('public.appui_faritany') as appui, (select count(*) from information_schema.columns where table_name='plan_actions' and column_name='origine') as col_origine;\""
```
Attendu : `plans_select/plans_insert/plans_update` + `pactions_select/pactions_write` présents ; `appui = NULL`, `col_origine = 0`. Tout écart → STOP, rapporter.

- [ ] **Step 4 : Appliquer la migration**
```bash
cat supabase/migrations/20261004_pilotage_appui.sql | ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -v ON_ERROR_STOP=1"
```
Attendu : `COMMIT`, `NOTIFY`, exit 0. Post-conditions :
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"select policyname, cmd from pg_policies where policyname in ('appui_select','appui_insert','appui_update','plans_insert_descendant','pactions_insert_descendant','pactions_update_descendant') order by 1;\" -c \"select tgname from pg_trigger where tgname='garde_origine_action';\" -c \"select origine, count(*) from plan_actions group by 1;\""
```
Attendu : 6 policies, 1 trigger, toutes les actions existantes en `regionale`.

- [ ] **Step 5 : Smoke RLS (ROLLBACK, fixtures autonomes)**
```bash
cat docs/superpowers/verif/appui-rls.sql | ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -v ON_ERROR_STOP=0"
```
Attendu : [1..19] (+ [17b]) conformes à leurs lignes « ATTENDU » ; dernière ligne `ROLLBACK`. Puis prouver qu'aucune fixture ne reste :
`... psql -c "select count(*) from organisations where id::text like 'a99e0000%';"` → `0`.

- [ ] **Step 6 : Frontend**
```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 'cp -a /var/www/gsat-frontend /var/www/gsat-frontend.bak-$(date +%Y%m%d-%H%M%S) && grep -o "index-[A-Za-z0-9_-]*\.js" /var/www/gsat-frontend/index.html'
rsync -az --delete -e "ssh -i ~/.ssh/id_ed25519" dist/ root@76.13.37.209:/var/www/gsat-frontend/
curl -s https://gsat.tily-digital.com/ | grep -o 'index-[A-Za-z0-9_-]*\.js'   # doit = hash de dist/index.html
```

- [ ] **Step 7 : Vérif live + mémoire**
  - L'utilisateur (admin) ouvre `/dashboard/pilotage-national` : 33 Faritany visibles (OSN résolue), bandeau 3 KPI, drill-down avec capture. Créer puis clore un appui de test sur un Faritany, si l'utilisateur le souhaite, et vérifier le chip côté compte `ant.01`.
  - Mettre à jour la mémoire `project_gsat_cockpits.md` (état Phase 2, hash bundle, backups).
  - **Rollback** si besoin : restaurer d'abord le frontend (`/var/www/gsat-frontend.bak-…`), puis le bloc ROLLBACK commenté de la migration.

---

## Hors périmètre / dette tracée

- Notification au Faritany à la création d'une action nationale (spec §9, optionnelle).
- `pactions_update_descendant` borné aux actions `nationale` : le national ne modifie pas les actions propres du Faritany (lecture de la spec §5 « INSERT/UPDATE descendant » resserrée — à confirmer à la relecture du plan).
- Divergence Phase 1.5 : l'agrégat national (`listActionAggByOrgIds`) somme TOUS les plans, le régional lit le plan courant. Sans impact au pilote (1 cycle → 1 plan par Faritany) ; l'ÉCRITURE Phase 2 suit déjà la règle du plan courant. À aligner avant le 2e cycle.
- `responsable_region` n'atteint que les enfants directs (portée héritée des policies existantes).
- Liste des référents vide pour un Faritany : normal (aucun compte `responsable_osn` en prod à ce jour → seul l'admin est proposé).
