# Auto-évaluation OSN v3_0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed le référentiel v3_0 dans Supabase et créer le scaffolding (campagne + éval OSN) pour qu'une vraie auto-évaluation OSN débloque les écarts de l'Indice de Déploiement.

**Architecture:** Deux artefacts SQL idempotents appliqués par psql (patron Phases A/B). (1) Un générateur JS pur transforme `src/data/referentiel_v3_0.json` en SQL de seed. (2) Un SQL de scaffolding crée la campagne v3_0 + l'éval OSN `en_cours`. La saisie réelle et l'affichage des écarts passent par le formulaire et `indiceService` **existants** — aucun code applicatif runtime modifié.

**Tech Stack:** Node ESM (générateur), SQL/PostgreSQL (Supabase self-hosted), Vitest (tests du générateur).

## Global Constraints

- **`version='v3_0'`** dans tout le seed — JAMAIS `'3.0'` (le JSON dit `"3.0"` mais `indiceService.VERSION_NAT`, le formulaire et le reste du code attendent `'v3_0'`). Un mauvais nommage = écarts restent `—`.
- **Idempotent** : tous les INSERT en `ON CONFLICT ... DO UPDATE`. Ré-exécution = zéro erreur, zéro doublon.
- **Zéro code applicatif runtime modifié** (formulaire, `indiceService`, RLS, triggers inchangés). L'éval OSN reste **`en_cours`** (validation hors périmètre).
- **Portabilité local↔prod** : l'OSN et l'admin sont résolus par sous-requête (`organisations.type='OSN'`, `users.role='admin_global'`), pas par UUID prod codé en dur (prod=1 OSN, local=1 OSN).
- **Tests** : `node node_modules/vitest/vitest.mjs run <fichier>` (les `.bin` sont cassés sur `/mnt/d`). Typecheck : `node node_modules/typescript/bin/tsc -b`.
- Colonnes ajoutées par `supabase/migrations/20260804_faritany.sql` (`criteres.socle/source_codes/indicateur_erp/libelle_mg/guide_mg`, `referentiel_versions.niveau/parent_version/nom_mg`) — déjà en prod, pré-requis du seed.

---

### Task 1: Générateur SQL du référentiel v3_0

**Files:**
- Create: `src/services/seed/genV3Seed.ts` (fonction pure typée)
- Create: `scripts/gen_v3_0_seed.ts` (mince wrapper CLI, patron `scripts/seed-referentiel-faritany.ts`)
- Create: `supabase/seeds/referentiel_v3_0_seed.sql` (sortie générée, committée)
- Test: `src/__tests__/genV3Seed.test.ts`

**Note d'architecture (pourquoi 2 fichiers) :** la fonction pure vit dans `src/` (typée, importable proprement par un test TS strict — un `.mjs` non typé casserait `tsc -b`). Le wrapper CLI vit dans `scripts/` et importe la fonction en relatif via tsx, comme le seeder far.

**Interfaces:**
- Produces: `genV3Seed(json: V3ReferentielJson): string` — fonction pure exportée par `@/services/seed/genV3Seed`, rend le SQL complet. Types exportés : `V3ReferentielJson { version: string; nom: {fr:string; en:string}; actif: boolean; dimensions: V3Dimension[] }`, `V3Dimension { code: string; ordre: number; nom: {fr:string; en:string}; criteres: V3Critere[] }`, `V3Critere { code: string; ordre: number; essentiel: boolean; actif: boolean; libelle: {fr:string; en:string}; guideInterpretation?: {fr?: string; en?: string} }`.

- [ ] **Step 1: Écrire le test qui échoue** — `src/__tests__/genV3Seed.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { genV3Seed, type V3ReferentielJson } from '@/services/seed/genV3Seed';
import v3 from '@/data/referentiel_v3_0.json';
import far from '@/data/far_v1_0.json';

const sql = genV3Seed(v3 as unknown as V3ReferentielJson);

const nbCrit = (v3 as { dimensions: { criteres: unknown[] }[] }).dimensions
  .reduce((n, d) => n + d.criteres.length, 0);

describe('genV3Seed', () => {
  it('seede version=v3_0 (PAS 3.0) dans referentiel_versions', () => {
    expect(sql).toContain('INSERT INTO referentiel_versions');
    expect(sql).toContain("VALUES ('v3_0',");
    expect(sql).toContain("'OSN'"); // niveau OSN
  });

  it('émet une ligne par dimension et par critère', () => {
    const nbDim = (sql.match(/INSERT INTO dimensions/g) ?? []).length;
    const nbC = (sql.match(/INSERT INTO criteres/g) ?? []).length;
    expect(nbDim).toBe((v3 as { dimensions: unknown[] }).dimensions.length);
    expect(nbC).toBe(nbCrit);
  });

  it('couvre les sourceCodes de far_v1_0 (sinon les écarts ne calculeront pas)', () => {
    const farCodes = new Set(
      (far as { dimensions: { criteres: { actif: boolean; sourceCodes: string[] }[] }[] }).dimensions
        .flatMap((d) => d.criteres).filter((c) => c.actif).flatMap((c) => c.sourceCodes),
    );
    const v3Codes = new Set(
      (v3 as { dimensions: { criteres: { code: string }[] }[] }).dimensions
        .flatMap((d) => d.criteres).map((c) => c.code),
    );
    expect(farCodes.size).toBeGreaterThan(0);
    for (const code of farCodes) expect(v3Codes.has(code)).toBe(true);
    // et chaque code apparaît bien dans un INSERT criteres
    for (const code of farCodes) expect(sql).toContain(`, '${code}', `);
  });

  it('échappe les apostrophes (SQL-safe)', () => {
    // le critère 101 contient "L'OSN"
    expect(sql).toContain("L''OSN");
    expect(sql).not.toMatch(/[^']'OSN/); // pas d'apostrophe simple non échappée
  });

  it('est idempotent (ON CONFLICT DO UPDATE) et transactionnel', () => {
    expect(sql).toContain('ON CONFLICT (version) DO UPDATE');
    expect(sql).toContain('ON CONFLICT (ref_id, code) DO UPDATE');
    expect(sql).toContain('ON CONFLICT (dimension_id, code) DO UPDATE');
    expect(sql.trimStart().startsWith('--')).toBe(true);
    expect(sql).toContain('BEGIN;');
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/genV3Seed.test.ts`
Expected: FAIL — `Cannot find module '@/services/seed/genV3Seed'`.

- [ ] **Step 3a: Écrire la fonction pure** — `src/services/seed/genV3Seed.ts`

```ts
export interface V3Critere {
  code: string;
  ordre: number;
  essentiel: boolean;
  actif: boolean;
  libelle: { fr: string; en: string };
  guideInterpretation?: { fr?: string; en?: string };
}
export interface V3Dimension {
  code: string;
  ordre: number;
  nom: { fr: string; en: string };
  criteres: V3Critere[];
}
export interface V3ReferentielJson {
  version: string;
  nom: { fr: string; en: string };
  actif: boolean;
  dimensions: V3Dimension[];
}

/** Échappe une valeur pour un littéral SQL, ou NULL si null/undefined. */
function q(s: string | null | undefined): string {
  return s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
}
const bool = (b: boolean): string => (b ? 'true' : 'false');

/**
 * Transforme le JSON du référentiel v3_0 en SQL de seed idempotent (pur, sans I/O).
 * ⚠ Pose version='v3_0' (le JSON dit '3.0', mais tout le code attend 'v3_0').
 */
export function genV3Seed(json: V3ReferentielJson): string {
  const L: string[] = [];
  L.push('-- Généré par scripts/gen_v3_0_seed.ts — NE PAS éditer à la main.');
  L.push('-- Seed idempotent du référentiel v3_0 (niveau OSN) dans Supabase.');
  L.push('BEGIN;');

  L.push(
    'INSERT INTO referentiel_versions (version, nom_fr, nom_en, nom_mg, niveau, parent_version, actif) ' +
      `VALUES ('v3_0', ${q(json.nom.fr)}, ${q(json.nom.en)}, NULL, 'OSN', NULL, true) ` +
      'ON CONFLICT (version) DO UPDATE SET nom_fr=EXCLUDED.nom_fr, nom_en=EXCLUDED.nom_en, ' +
      'niveau=EXCLUDED.niveau, actif=EXCLUDED.actif;',
  );

  for (const dim of json.dimensions) {
    L.push(
      'INSERT INTO dimensions (ref_id, code, nom_fr, nom_en, nom_mg, ordre) VALUES (' +
        `(SELECT id FROM referentiel_versions WHERE version='v3_0'), ${q(dim.code)}, ` +
        `${q(dim.nom.fr)}, ${q(dim.nom.en)}, NULL, ${Number(dim.ordre)}) ` +
        'ON CONFLICT (ref_id, code) DO UPDATE SET nom_fr=EXCLUDED.nom_fr, nom_en=EXCLUDED.nom_en, ordre=EXCLUDED.ordre;',
    );
    for (const c of dim.criteres) {
      const gFr = c.guideInterpretation?.fr ?? '';
      const gEn = c.guideInterpretation?.en ?? '';
      L.push(
        'INSERT INTO criteres (dimension_id, code, libelle_fr, libelle_en, libelle_mg, ' +
          'guide_fr, guide_en, guide_mg, essentiel, socle, actif, ordre, source_codes, indicateur_erp) VALUES (' +
          '(SELECT d.id FROM dimensions d JOIN referentiel_versions r ON d.ref_id=r.id ' +
          `WHERE r.version='v3_0' AND d.code=${q(dim.code)}), ` +
          `${q(c.code)}, ${q(c.libelle.fr)}, ${q(c.libelle.en)}, NULL, ` +
          `${q(gFr)}, ${q(gEn)}, NULL, ${bool(c.essentiel)}, true, ${bool(c.actif)}, ${Number(c.ordre)}, '{}', '{}') ` +
          'ON CONFLICT (dimension_id, code) DO UPDATE SET libelle_fr=EXCLUDED.libelle_fr, ' +
          'libelle_en=EXCLUDED.libelle_en, guide_fr=EXCLUDED.guide_fr, guide_en=EXCLUDED.guide_en, ' +
          'essentiel=EXCLUDED.essentiel, actif=EXCLUDED.actif, ordre=EXCLUDED.ordre;',
      );
    }
  }

  L.push('COMMIT;');
  return L.join('\n') + '\n';
}
```

- [ ] **Step 3b: Écrire le wrapper CLI** — `scripts/gen_v3_0_seed.ts`

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { genV3Seed, type V3ReferentielJson } from '../src/services/seed/genV3Seed';

const here = dirname(fileURLToPath(import.meta.url));
const json = JSON.parse(
  readFileSync(resolve(here, '../src/data/referentiel_v3_0.json'), 'utf8'),
) as V3ReferentielJson;
mkdirSync(resolve(here, '../supabase/seeds'), { recursive: true });
writeFileSync(resolve(here, '../supabase/seeds/referentiel_v3_0_seed.sql'), genV3Seed(json));
console.log('Wrote supabase/seeds/referentiel_v3_0_seed.sql');
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/genV3Seed.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Générer le SQL committé**

Run: `npx tsx scripts/gen_v3_0_seed.ts`
(Si `npx` tente un fetch réseau : `node node_modules/tsx/dist/cli.mjs scripts/gen_v3_0_seed.ts`.)
Expected: `Wrote supabase/seeds/referentiel_v3_0_seed.sql`.
Contrôle : `grep -c "INSERT INTO criteres" supabase/seeds/referentiel_v3_0_seed.sql` = nombre de critères (= `nbCrit` du test).

- [ ] **Step 6: Commit**

```bash
git add src/services/seed/genV3Seed.ts scripts/gen_v3_0_seed.ts \
        supabase/seeds/referentiel_v3_0_seed.sql src/__tests__/genV3Seed.test.ts
git commit -m "feat(v3_0): générateur SQL idempotent du référentiel v3_0 (version=v3_0)"
```

---

### Task 2: Scaffolding SQL — campagne v3_0 + éval OSN

**Files:**
- Create: `supabase/seeds/campagne_eval_osn_v3_0.sql`
- Test: `src/__tests__/scaffoldingOsnV3Sql.test.ts`

**Interfaces:**
- Consumes: le référentiel v3_0 seedé (Task 1) — nécessaire pour que le formulaire résolve les critères ; la campagne peut néanmoins être créée avant.
- Produces: une campagne `referentiel_version='v3_0'` (statut `ouverte`, périmètre = OSN) et une évaluation `org_id=OSN`, `type='auto'`, `statut='en_cours'`, prêtes pour la saisie.

- [ ] **Step 1: Écrire le SQL de scaffolding** — `supabase/seeds/campagne_eval_osn_v3_0.sql`

```sql
-- Scaffolding auto-évaluation OSN v3_0 — idempotent.
-- Crée la campagne v3_0 (périmètre OSN) + l'éval OSN en_cours pour la saisie
-- réelle. Laisse l'éval en_cours (validation hors périmètre — écarts calculent
-- via le fallback "plus récente" de indiceService). Portable local↔prod :
-- l'OSN et l'admin sont résolus par sous-requête (1 seul OSN, 1 admin_global).
BEGIN;

-- Campagne v3_0 (UUID fixe → idempotent).
INSERT INTO campagnes (
  id, organisateur_id, referentiel_version, nom,
  date_ouverture, date_fermeture, statut, mode, perimetre, created_by
) VALUES (
  'd3000000-0000-4000-8000-0000000c0001',
  (SELECT id FROM users WHERE role = 'admin_global' ORDER BY created_at LIMIT 1),
  'v3_0',
  'Auto-évaluation OSN v3_0',
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '365 days',
  'ouverte',
  'complet',
  ARRAY[(SELECT id FROM organisations WHERE type = 'OSN' ORDER BY created_at LIMIT 1)]::uuid[],
  (SELECT id FROM users WHERE role = 'admin_global' ORDER BY created_at LIMIT 1)
)
ON CONFLICT (id) DO UPDATE SET
  statut = 'ouverte',
  date_fermeture = EXCLUDED.date_fermeture,
  perimetre = EXCLUDED.perimetre;

-- Évaluation OSN en_cours (UNIQUE(org_id, campagne_id) → idempotent).
INSERT INTO evaluations (
  id, campagne_id, org_id, type, statut, created_by
) VALUES (
  'd3000000-0000-4000-8000-0000000e0001',
  'd3000000-0000-4000-8000-0000000c0001',
  (SELECT id FROM organisations WHERE type = 'OSN' ORDER BY created_at LIMIT 1),
  'auto',
  'en_cours',
  (SELECT id FROM users WHERE role = 'admin_global' ORDER BY created_at LIMIT 1)
)
ON CONFLICT (org_id, campagne_id) DO UPDATE SET statut = 'en_cours';

COMMIT;
```

- [ ] **Step 2: Écrire le test de présence des littéraux** — `src/__tests__/scaffoldingOsnV3Sql.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../supabase/seeds/campagne_eval_osn_v3_0.sql', import.meta.url), 'utf8');

describe('scaffolding OSN v3_0 SQL', () => {
  it('campagne v3_0 ouverte, périmètre OSN, mode complet', () => {
    expect(sql).toContain("INSERT INTO campagnes");
    expect(sql).toContain("'v3_0'");
    expect(sql).toContain("'ouverte'");
    expect(sql).toContain("'complet'");
    expect(sql).toContain("FROM organisations WHERE type = 'OSN'");
  });

  it('éval OSN en_cours de type auto', () => {
    expect(sql).toContain("INSERT INTO evaluations");
    expect(sql).toContain("'en_cours'");
    expect(sql).toContain("'auto'");
  });

  it('idempotent et transactionnel', () => {
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
    expect(sql).toContain('ON CONFLICT (org_id, campagne_id) DO UPDATE');
    expect(sql).toContain('BEGIN;');
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });

  it('ne force jamais la validation (pas de statut validee ni de PV)', () => {
    expect(sql).not.toContain("'validee'");
    expect(sql).not.toContain('pv_comite_path');
  });
});
```

- [ ] **Step 3: Lancer le test, vérifier le succès**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/scaffoldingOsnV3Sql.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add supabase/seeds/campagne_eval_osn_v3_0.sql src/__tests__/scaffoldingOsnV3Sql.test.ts
git commit -m "feat(v3_0): scaffolding SQL campagne + éval OSN en_cours (portable local/prod)"
```

---

### Task 3: Vérification d'intégration (stack locale) + runbook prod

**Files:**
- Create: `supabase/seeds/README-v3_0.md` (runbook d'application prod)

**But :** prouver que les deux SQL s'appliquent proprement et que la donnée est bien vue par `indiceService` ; documenter l'application prod (faite par l'ops/TEM). L'arithmétique de l'écart est déjà couverte par `src/__tests__/indiceService.test.ts` — cette tâche valide le **plombage** (SQL valide, lignes lisibles), pas le calcul.

**Prérequis stack locale** (cf. mémoire projet, bootstrap Phase 0.3) : stack Supabase locale up (`supabase status`), DB sur `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, contenant l'OSN TEM (`organisations.type='OSN'`), les 33 Faritany, `far_v1_0` seedé. Si aucun `admin_global` n'existe localement, en créer un pour satisfaire les FK NOT NULL (voir Step 2).

> Si la stack locale n'est pas disponible dans la session, **sauter les Steps 2–5** : Task 1/2 (tests unitaires verts) + la revue du SQL font foi, et l'application réelle se fait en prod via le runbook (Step 6). Le noter explicitement dans le rapport (« intégration locale non exécutée, X »).

- [ ] **Step 1: Vérifier la stack locale**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT id, type FROM organisations WHERE type='OSN';"`
Expected: 1 ligne (l'OSN TEM). Sinon → stack non prête, voir la note ci-dessus.

- [ ] **Step 2: Garantir un admin_global local (FK NOT NULL)**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE v_osn uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE role='admin_global') THEN
    SELECT id INTO v_osn FROM organisations WHERE type='OSN' ORDER BY created_at LIMIT 1;
    INSERT INTO auth.users (id, email) VALUES ('d3000000-0000-4000-8000-00000000ad01','admin.local@tem.mg')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO users (id, org_id, email, role)
      VALUES ('d3000000-0000-4000-8000-00000000ad01', v_osn, 'admin.local@tem.mg', 'admin_global')
      ON CONFLICT (id) DO NOTHING;
  END IF;
END \$\$;"
```
Expected: `DO` (aucune erreur).

- [ ] **Step 3: Appliquer les deux seeds**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/seeds/referentiel_v3_0_seed.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/seeds/campagne_eval_osn_v3_0.sql
```
Expected: deux `COMMIT`, aucune erreur.

- [ ] **Step 4: Post-conditions structurelles**

Run:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
SELECT (SELECT count(*) FROM referentiel_versions WHERE version='v3_0') AS refver,
       (SELECT count(*) FROM dimensions d JOIN referentiel_versions r ON d.ref_id=r.id WHERE r.version='v3_0') AS dims,
       (SELECT count(*) FROM criteres c JOIN dimensions d ON c.dimension_id=d.id JOIN referentiel_versions r ON d.ref_id=r.id WHERE r.version='v3_0') AS crit,
       (SELECT count(*) FROM campagnes WHERE referentiel_version='v3_0' AND statut='ouverte') AS camp,
       (SELECT count(*) FROM evaluations e JOIN campagnes ca ON e.campagne_id=ca.id WHERE ca.referentiel_version='v3_0' AND e.statut='en_cours') AS ev;"
```
Expected: `refver=1, dims=10, crit=105, camp=1, ev=1`.

- [ ] **Step 5: Preuve de plombage — un score OSN v3_0 est sélectionnable par indiceService**

Run (insère un score de test sur le code national `101`, puis vérifie qu'il est visible côté « note nationale » — l'OSN est bien le parent des Faritany) :
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -c "
INSERT INTO evaluation_scores (eval_id, critere_code, note)
VALUES ('d3000000-0000-4000-8000-0000000e0001','101',3)
ON CONFLICT (eval_id, critere_code) DO UPDATE SET note=3;
SELECT es.critere_code, es.note
FROM evaluation_scores es
JOIN evaluations e ON es.eval_id=e.id
JOIN campagnes ca ON e.campagne_id=ca.id
WHERE ca.referentiel_version='v3_0'
  AND e.org_id IN (SELECT DISTINCT parent_id FROM organisations WHERE type='ASN' AND parent_id IS NOT NULL);"
```
Expected: 1 ligne `101 | 3` — l'éval OSN v3_0 est scopée au parent des Faritany, exactement ce que `indiceService` sélectionne pour `notesNationales`. (Nettoyage optionnel : `DELETE FROM evaluation_scores WHERE eval_id='d3000000-0000-4000-8000-0000000e0001' AND critere_code='101';`)

- [ ] **Step 6: Écrire le runbook prod** — `supabase/seeds/README-v3_0.md`

```markdown
# Auto-évaluation OSN v3_0 — application en prod

Prérequis : SSH natif `~/.ssh/id_ed25519` root@76.13.37.209 (WARP off). La migration
`20260804_faritany.sql` est déjà en prod (colonnes socle/source_codes/niveau…).

## 1. Backup
    ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
      "docker exec supabase_db_gsat pg_dump -U postgres postgres" > gsat_backup_pre_v3_0_$(date +%Y%m%d-%H%M%S).sql

## 2. Appliquer le seed du référentiel v3_0 (idempotent)
    cat supabase/seeds/referentiel_v3_0_seed.sql | ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
      "docker exec -i supabase_db_gsat psql -U postgres -d postgres -v ON_ERROR_STOP=1"

## 3. Appliquer le scaffolding campagne + éval OSN (idempotent)
    cat supabase/seeds/campagne_eval_osn_v3_0.sql | ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
      "docker exec -i supabase_db_gsat psql -U postgres -d postgres -v ON_ERROR_STOP=1"

## 4. Recharger le cache PostgREST
    ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
      "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"NOTIFY pgrst, 'reload schema';\""

## 5. Post-conditions (attendu refver=1, dims=10, crit=105, camp=1, ev=1)
    (même requête que Task 3 Step 4)

## 6. Saisie réelle (TEM)
Un utilisateur `responsable_osn` (org = OSN TEM) ouvre l'éval par lien direct
`/#/evaluation/d3000000-0000-4000-8000-0000000e0001`, saisit les 105 critères v3_0,
puis Enregistre. Les écarts apparaissent dans l'Indice de Déploiement (`/dashboard/indice`)
dès qu'au moins un critère mappé (parmi les 88) est noté. L'éval reste `en_cours`
(validation formelle = étape ultérieure, non requise pour les écarts).
```

- [ ] **Step 7: Commit**

```bash
git add supabase/seeds/README-v3_0.md
git commit -m "docs(v3_0): runbook d'application prod + vérif intégration OSN v3_0"
```

---

## Vérification finale (whole-branch)

- `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'` → tous verts (dont `genV3Seed`, `scaffoldingOsnV3Sql`).
- `node node_modules/typescript/bin/tsc -b` → clean (le `.mjs` n'est pas typé mais le test l'importe ; vérifier qu'aucune erreur TS n'apparaît).
- Revue whole-branch (opus) avant merge.
- Rappel : l'application prod + la **vraie** saisie des scores par TEM sont hors session (runbook Step 6).
