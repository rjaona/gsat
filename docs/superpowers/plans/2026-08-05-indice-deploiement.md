# Indice de Déploiement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher, sur une page dédiée réservée OSN/région/admin, l'Indice de Déploiement — l'écart, critère national par critère national, entre la note nationale GSAT (v3_0) et le score territorial constaté sur les Faritany (far_v1_0).

**Architecture:** Un atome de scoring pur (`scoreSurCriteres`) ajouté à `scoring.ts` ; une fonction pure `calculerIndiceDeploiement` qui l'utilise pour agréger par critère national ; un service `indiceService` qui fait les 4 lectures Supabase et délègue tout le calcul ; un store Zustand fin + une page tableau. Aucune écriture DB, aucune modification du score GSAT.

**Tech Stack:** React 19, Vite 6, TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`), Zustand 5, react-router-dom v7, react-i18next, Supabase (PostgREST), Vitest 3 + Testing Library.

## Global Constraints

- **L'ID ne modifie JAMAIS le score GSAT national** (précaution §6). Aucun trigger, aucune écriture, aucune RPC de recalcul. Lecture seule.
- **Isolation Faritany préservée** : la page et ses données sont réservées à `admin_global | responsable_osn | responsable_region`. Le `responsable_asn` n'y a jamais accès (RoleGuard + nav roles identiques).
- **Pas de troisième implémentation du scoring** : `score_f(X)` passe par `scoring.ts`. Ne jamais dupliquer la logique de note.
- **`score_f(X)` (définition unifiée)** : moyenne 0–100 des notes **réellement attribuées** aux enfants de X ; enfant **absent** ET enfant **N/A** exclus ; aucun enfant scoré ⇒ `null`. **Différent** de `calculerScoreDimension` (absent = 0). Ne jamais harmoniser les deux.
- **TS strict** : les champs optionnels (`ecart`, `interpretation`) sont `field?: T` et **spreadés conditionnellement** (`...(x !== undefined ? { field: x } : {})`), jamais assignés `undefined`.
- **Sur `/mnt/d`, les binaires `.bin` sont cassés** : lancer Vitest via `node node_modules/vitest/vitest.mjs run <fichier>` (pas `npm test`). Machine lente : cibler le fichier de test précis, pas toute la suite.
- **i18n** : toute clé `t('…')` ajoutée doit exister dans `src/i18n/fr.json` **et** `src/i18n/en.json` (le fallback mg→fr est voulu).

---

### Task 1: Atome de scoring `scoreSurCriteres`

Ajoute à `scoring.ts` le calcul de score sur un **sous-ensemble arbitraire** de critères (les enfants d'un critère national, à cheval sur plusieurs dimensions), avec la sémantique ID (absent ET N/A exclus). Réutilise les helpers privés `estNA` et `round2` déjà dans le fichier.

**Files:**
- Modify: `src/services/scoring.ts` (ajout d'une fonction exportée, après `calculerScoreDimension`)
- Test: `src/__tests__/scoreSurCriteres.test.ts` (créer)

**Interfaces:**
- Consumes: `ScoreMap` (`Record<string, number | null>`), `CritereDef` (`{ code: string; actif: boolean; … }`), helpers privés `estNA(scores, code)`, `round2(n)` — tous déjà dans `scoring.ts`.
- Produces: `export function scoreSurCriteres(scores: ScoreMap, criteres: CritereDef[]): number | null`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/__tests__/scoreSurCriteres.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { scoreSurCriteres } from '@/services/scoring';
import type { CritereDef } from '@/types';

function crit(code: string): CritereDef {
  return { code, libelle: code, description: '', essentiel: false, actif: true, sourceCodes: [] } as CritereDef;
}

describe('scoreSurCriteres — sémantique ID (absent ET N/A exclus)', () => {
  const cs = [crit('F1'), crit('F2'), crit('F3')];

  it('moyenne sur les seuls critères réellement notés', () => {
    // F1=3, F2=0, F3 absent → dénominateur = 2 (F1,F2) → (3+0)/(2*3)*100 = 50
    expect(scoreSurCriteres({ F1: 3, F2: 0 }, cs)).toBe(50);
  });

  it('exclut les N/A (note null) du dénominateur', () => {
    // F1=3, F2=null(N/A), F3=3 → dénom = 2 → (3+3)/6*100 = 100
    expect(scoreSurCriteres({ F1: 3, F2: null, F3: 3 }, cs)).toBe(100);
  });

  it('exclut les critères absents (non pénalisés comme 0)', () => {
    // seul F1=3 présent → dénom = 1 → 3/3*100 = 100 (F2,F3 absents exclus)
    expect(scoreSurCriteres({ F1: 3 }, cs)).toBe(100);
  });

  it('rend null si aucun critère réellement noté (tous absents ou N/A)', () => {
    expect(scoreSurCriteres({ F2: null }, cs)).toBeNull();
    expect(scoreSurCriteres({}, cs)).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/scoreSurCriteres.test.ts`
Expected: FAIL — `scoreSurCriteres is not a function` / export introuvable.

- [ ] **Step 3: Implémenter**

Dans `src/services/scoring.ts`, juste après `calculerScoreDimension` (avant `calculerScoreGlobal`), ajouter :

```ts
/**
 * Score sur un sous-ensemble ARBITRAIRE de critères (les enfants d'un critère
 * national pour l'Indice de Déploiement, §6). Sémantique DIFFÉRENTE de
 * `calculerScoreDimension` : ici un critère ABSENT de la saisie est EXCLU (pas
 * compté 0), au même titre qu'un N/A — seules les notes réellement attribuées
 * comptent. Rend `null` si aucun critère n'a été noté. NE PAS harmoniser avec
 * `calculerScoreDimension` : ce sont deux questions distinctes (déploiement du
 * standard national vs conformité GSAT).
 */
export function scoreSurCriteres(scores: ScoreMap, criteres: CritereDef[]): number | null {
  const notes = criteres
    .filter((c) => c.code in scores && !estNA(scores, c.code))
    .map((c) => scores[c.code] as number);
  if (notes.length === 0) return null;
  const total = notes.reduce((sum, n) => sum + n, 0);
  return round2((total / (notes.length * 3)) * 100);
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/scoreSurCriteres.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add src/services/scoring.ts src/__tests__/scoreSurCriteres.test.ts
git commit -m "feat(indice): scoreSurCriteres — atome de score sur sous-ensemble (absent ET N/A exclus)"
```

---

### Task 2: Fonction pure `calculerIndiceDeploiement`

Le cœur : à partir du référentiel far, des évals participantes, des poids et des notes nationales, produit un tableau par critère national avec ID, écart et interprétation. Aucune I/O.

**Files:**
- Create: `src/services/indice/calculerIndiceDeploiement.ts`
- Test: `src/__tests__/calculerIndiceDeploiement.test.ts`

**Interfaces:**
- Consumes: `scoreSurCriteres` (Task 1), `Referentiel`/`CritereDef` (`@/types`), `ScoreMap` (`@/services/scoring`).
- Produces:
  ```ts
  export interface EvalFaritanyParticipante { orgId: string; scores: ScoreMap }
  export interface IndiceCritereNational {
    code: string;
    noteNationale: number | null;   // 0..3, null = N/A national
    id: number | null;              // 0..100, null si aucun contributeur
    ecart?: number;                 // défini SSI noteNationale ET id définis
    interpretation?: 'alerte' | 'coherent' | 'bonne_pratique';
    nbEnfants: number;
    nbFaritanyContributeurs: number;
  }
  export function calculerIndiceDeploiement(
    refFar: Referentiel,
    evalsParticipantes: EvalFaritanyParticipante[],
    poids: Record<string, number>,
    notesNationales: Record<string, number | null>,
  ): IndiceCritereNational[]
  ```

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/__tests__/calculerIndiceDeploiement.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { calculerIndiceDeploiement } from '@/services/indice/calculerIndiceDeploiement';
import type { Referentiel, CritereDef, DimensionDef } from '@/types';

function crit(code: string, sourceCodes: string[], actif = true): CritereDef {
  return { code, libelle: code, description: '', essentiel: false, actif, sourceCodes } as CritereDef;
}
function ref(criteres: CritereDef[]): Referentiel {
  const dim = { code: 'D01', libelle: 'D01', description: '', actif: true, criteres } as DimensionDef;
  return { version: 'far_v1_0', libelle: 'far', niveau: 'ASN', actif: true, dimensions: [dim] } as Referentiel;
}

// Réf : critère national 401 a 2 enfants far (F1,F2) ; 706 a 1 enfant (F3).
const refFar = ref([crit('F1', ['401']), crit('F2', ['401']), crit('F3', ['706'])]);

describe('calculerIndiceDeploiement', () => {
  it('pondère par poids (poids VARIÉS — sinon indistinguable d’une moyenne simple)', () => {
    // A: F1=3,F2=3 → score_A(401)=100 ; B: F1=0,F2=0 → score_B(401)=0
    // poids A=3, B=1 → ID(401) = (100*3 + 0*1)/4 = 75
    const res = calculerIndiceDeploiement(
      refFar,
      [{ orgId: 'A', scores: { F1: 3, F2: 3 } }, { orgId: 'B', scores: { F1: 0, F2: 0 } }],
      { A: 3, B: 1 },
      { 401: 3, 706: 2 },
    );
    const c401 = res.find((r) => r.code === '401')!;
    expect(c401.id).toBe(75);
    expect(c401.nbEnfants).toBe(2);
    expect(c401.nbFaritanyContributeurs).toBe(2);
    // écart = 3*100/3 - 75 = 25 → cohérent
    expect(c401.ecart).toBe(25);
    expect(c401.interpretation).toBe('coherent');
  });

  it('un Faritany non participant est ABSENT (pas noté 0) : n’apparaît pas dans poids/evals', () => {
    // seul A participe ; C (poids 100) n’a pas d’éval → ID = score_A, pas dilué
    const res = calculerIndiceDeploiement(
      refFar,
      [{ orgId: 'A', scores: { F1: 3, F2: 3 } }],
      { A: 1, C: 100 },
      { 401: 3, 706: 2 },
    );
    expect(res.find((r) => r.code === '401')!.id).toBe(100);
    expect(res.find((r) => r.code === '401')!.nbFaritanyContributeurs).toBe(1);
  });

  it('note nationale N/A (null) → ecart et interpretation indéfinis', () => {
    const res = calculerIndiceDeploiement(
      refFar, [{ orgId: 'A', scores: { F1: 3, F2: 3 } }], { A: 1 }, { 401: null, 706: 2 },
    );
    const c401 = res.find((r) => r.code === '401')!;
    expect(c401.noteNationale).toBeNull();
    expect(c401.ecart).toBeUndefined();
    expect(c401.interpretation).toBeUndefined();
  });

  it('aucun enfant scoré pour X → id null, ecart indéfini', () => {
    const res = calculerIndiceDeploiement(
      refFar, [{ orgId: 'A', scores: { F1: 3, F2: 3 } }], { A: 1 }, { 401: 3, 706: 2 },
    );
    const c706 = res.find((r) => r.code === '706')!;
    expect(c706.id).toBeNull();          // F3 jamais scoré
    expect(c706.ecart).toBeUndefined();
  });

  it('bandes d’interprétation : >+30 alerte, <-10 bonne pratique', () => {
    // national 401=3 (→100), terrain nul → écart=100 → alerte
    const alerte = calculerIndiceDeploiement(refFar, [{ orgId: 'A', scores: { F1: 0, F2: 0 } }], { A: 1 }, { 401: 3 });
    expect(alerte.find((r) => r.code === '401')!.interpretation).toBe('alerte');
    // national 401=1 (→33.33), terrain excellent (100) → écart≈-66.67 → bonne pratique
    const bp = calculerIndiceDeploiement(refFar, [{ orgId: 'A', scores: { F1: 3, F2: 3 } }], { A: 1 }, { 401: 1 });
    expect(bp.find((r) => r.code === '401')!.interpretation).toBe('bonne_pratique');
  });

  it('multi-parent : un enfant far rattaché à 2 critères nationaux compte pour les deux', () => {
    const r2 = ref([crit('F1', ['401', '706'])]);
    const res = calculerIndiceDeploiement(r2, [{ orgId: 'A', scores: { F1: 3 } }], { A: 1 }, { 401: 3, 706: 3 });
    expect(res.find((r) => r.code === '401')!.id).toBe(100);
    expect(res.find((r) => r.code === '706')!.id).toBe(100);
  });

  it('ignore les enfants inactifs dans le mapping', () => {
    const r2 = ref([crit('F1', ['401']), crit('F2', ['401'], false)]); // F2 inactif
    const res = calculerIndiceDeploiement(r2, [{ orgId: 'A', scores: { F1: 3, F2: 0 } }], { A: 1 }, { 401: 3 });
    // F2 inactif exclu du mapping → score = F1 seul = 100
    expect(res.find((r) => r.code === '401')!.id).toBe(100);
    expect(res.find((r) => r.code === '401')!.nbEnfants).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/calculerIndiceDeploiement.test.ts`
Expected: FAIL — module `@/services/indice/calculerIndiceDeploiement` introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/services/indice/calculerIndiceDeploiement.ts` :

```ts
import type { Referentiel, CritereDef } from '@/types';
import { scoreSurCriteres, type ScoreMap } from '@/services/scoring';

export interface EvalFaritanyParticipante {
  orgId: string;
  scores: ScoreMap;
}

export interface IndiceCritereNational {
  code: string;
  noteNationale: number | null;
  id: number | null;
  ecart?: number;
  interpretation?: 'alerte' | 'coherent' | 'bonne_pratique';
  nbEnfants: number;
  nbFaritanyContributeurs: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function interpreter(ecart: number): 'alerte' | 'coherent' | 'bonne_pratique' {
  if (ecart > 30) return 'alerte';
  if (ecart < -10) return 'bonne_pratique';
  return 'coherent';
}

/**
 * Indice de Déploiement (§6). Pour chaque critère national X référencé par au
 * moins un `sourceCodes` d'un critère far ACTIF :
 *   ID(X)   = Σ_f score_f(X)·poids_f / Σ_f poids_f      (contributeurs = score_f non null)
 *   Écart(X)= noteNationale(X)·100/3 − ID(X)            (SSI note et ID définis)
 * Pure : aucune I/O. Ne modifie jamais le score GSAT.
 */
export function calculerIndiceDeploiement(
  refFar: Referentiel,
  evalsParticipantes: EvalFaritanyParticipante[],
  poids: Record<string, number>,
  notesNationales: Record<string, number | null>,
): IndiceCritereNational[] {
  // Mapping critère national → enfants far actifs (multi-parent géré).
  const enfantsParNational = new Map<string, CritereDef[]>();
  for (const dim of refFar.dimensions) {
    for (const c of dim.criteres) {
      if (!c.actif) continue;
      for (const nat of c.sourceCodes) {
        const liste = enfantsParNational.get(nat) ?? [];
        liste.push(c);
        enfantsParNational.set(nat, liste);
      }
    }
  }

  const codes = [...enfantsParNational.keys()].sort();
  return codes.map((code) => {
    const enfants = enfantsParNational.get(code) ?? [];

    let sommePondere = 0;
    let sommePoids = 0;
    let contributeurs = 0;
    for (const ev of evalsParticipantes) {
      const s = scoreSurCriteres(ev.scores, enfants);
      if (s === null) continue;           // f n'a scoré aucun enfant de X → non contributeur
      const p = poids[ev.orgId] ?? 1;
      sommePondere += s * p;
      sommePoids += p;
      contributeurs += 1;
    }
    const id = sommePoids > 0 ? round2(sommePondere / sommePoids) : null;

    const note = code in notesNationales ? notesNationales[code] : null;
    const ecart =
      note !== null && note !== undefined && id !== null
        ? round2((note * 100) / 3 - id)
        : undefined;

    return {
      code,
      noteNationale: note ?? null,
      id,
      nbEnfants: enfants.length,
      nbFaritanyContributeurs: contributeurs,
      ...(ecart !== undefined ? { ecart, interpretation: interpreter(ecart) } : {}),
    };
  });
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/calculerIndiceDeploiement.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Vérifier le typecheck strict**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
Expected: aucune erreur sur les nouveaux fichiers (notamment `exactOptionalPropertyTypes` sur `ecart`/`interpretation`).

- [ ] **Step 6: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add src/services/indice/calculerIndiceDeploiement.ts src/__tests__/calculerIndiceDeploiement.test.ts
git commit -m "feat(indice): calculerIndiceDeploiement — cœur pur (ID, écart, interprétation §6)"
```

---

### Task 3: Service I/O `indiceService`

Rassemble les 4 lectures Supabase sous le JWT de l'utilisateur et délègue tout le calcul à `calculerIndiceDeploiement`. Aucune arithmétique dans ce fichier.

**Files:**
- Create: `src/services/indiceService.ts`
- Test: `src/__tests__/indiceService.test.ts`

**Interfaces:**
- Consumes: `supabase` (`@/services/supabase`), `getReferentiel` (`@/services/referentielService`), `calculerIndiceDeploiement`/`EvalFaritanyParticipante`/`IndiceCritereNational` (Task 2).
- Produces: `export async function getIndiceDeploiement(): Promise<IndiceCritereNational[]>`

- [ ] **Step 1: Écrire le test qui échoue**

Le test mocke `supabase` et `getReferentiel`, et prouve que le service (a) ne prend que les évals **participantes** (celles qui ont des scores), (b) construit `notesNationales` à partir des scores de l'éval nationale v3_0, (c) délègue au calcul pur. Créer `src/__tests__/indiceService.test.ts` :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const refFar = {
  version: 'far_v1_0', libelle: 'far', niveau: 'ASN', actif: true,
  dimensions: [{ code: 'D01', libelle: 'D01', description: '', actif: true, criteres: [
    { code: 'F1', libelle: 'F1', description: '', essentiel: false, actif: true, sourceCodes: ['401'] },
    { code: 'F2', libelle: 'F2', description: '', essentiel: false, actif: true, sourceCodes: ['401'] },
  ] }],
};

// Table -> réponses PostgREST simulées (voir builder plus bas).
const db = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]> }));

vi.mock('@/services/referentielService', () => ({
  getReferentiel: vi.fn(async (v: string) => (v === 'far_v1_0' ? refFar : null)),
}));

// Builder minimal qui couvre .select().eq().order()/.in()/.maybeSingle() utilisés par le service.
vi.mock('@/services/supabase', () => {
  function from(table: string) {
    let rows = (db.tables[table] ?? []).slice();
    const api: Record<string, unknown> = {
      select: () => api,
      order: () => api,
      eq: (col: string, val: unknown) => { rows = rows.filter((r) => (r as Record<string, unknown>)[col] === val); return api; },
      in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes((r as Record<string, unknown>)[col])); return api; },
      limit: () => api,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return api;
  }
  return { supabase: { from } };
});

import { getIndiceDeploiement } from '@/services/indiceService';

beforeEach(() => {
  db.tables = {
    campagnes: [{ id: 'camp-far', referentiel_version: 'far_v1_0', date_ouverture: '2026-01-01' }],
    // 2 évals far : e1 (org A, participante), e2 (org B, participante) + éval nationale n1 (OSN v3_0)
    evaluations: [
      { id: 'e1', campagne_id: 'camp-far', org_id: 'A', referentiel_version: 'far_v1_0' },
      { id: 'e2', campagne_id: 'camp-far', org_id: 'B', referentiel_version: 'far_v1_0' },
      { id: 'n1', campagne_id: 'camp-nat', org_id: 'OSN', referentiel_version: 'v3_0' },
    ],
    evaluation_scores: [
      { eval_id: 'e1', critere_code: 'F1', note: 3 }, { eval_id: 'e1', critere_code: 'F2', note: 3 },
      { eval_id: 'e2', critere_code: 'F1', note: 0 }, { eval_id: 'e2', critere_code: 'F2', note: 0 },
      { eval_id: 'n1', critere_code: '401', note: 3 },
    ],
    organisations: [{ id: 'A', poids: 3 }, { id: 'B', poids: 1 }],
  };
});

describe('getIndiceDeploiement', () => {
  it('agrège les évals far participantes, pondère, et calcule l’écart vs note nationale', async () => {
    const res = await getIndiceDeploiement();
    const c401 = res.find((r) => r.code === '401')!;
    // ID = (100*3 + 0*1)/4 = 75 ; écart = 3*100/3 - 75 = 25
    expect(c401.id).toBe(75);
    expect(c401.noteNationale).toBe(3);
    expect(c401.ecart).toBe(25);
    expect(c401.nbFaritanyContributeurs).toBe(2);
  });
});
```

> Note d'implémentation : le builder mock renvoie une API « thenable » (via `then`) pour les requêtes list, et `maybeSingle()` pour l'unitaire. Le service **doit** donc terminer ses requêtes list par `await supabase.from(...).select(...)....` (sans `.single()`), et l'éval nationale par `.maybeSingle()`.

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/indiceService.test.ts`
Expected: FAIL — module `@/services/indiceService` introuvable.

- [ ] **Step 3: Implémenter**

Créer `src/services/indiceService.ts` :

```ts
import { supabase } from './supabase';
import { getReferentiel } from './referentielService';
import {
  calculerIndiceDeploiement,
  type EvalFaritanyParticipante,
  type IndiceCritereNational,
} from './indice/calculerIndiceDeploiement';
import type { ScoreMap } from './scoring';

const VERSION_FAR = 'far_v1_0';
const VERSION_NAT = 'v3_0';

type Row = Record<string, unknown>;

/**
 * Indice de Déploiement (§6) — lecture seule, sous le JWT de l'utilisateur.
 * Réservé côté route/UI à admin_global | responsable_osn | responsable_region :
 * ces rôles lisent l'éval nationale et les évals des Faritany descendants sans
 * SECURITY DEFINER. Ne modifie jamais le score GSAT.
 */
export async function getIndiceDeploiement(): Promise<IndiceCritereNational[]> {
  const refFar = await getReferentiel(VERSION_FAR);
  if (!refFar) return [];

  // 1. Campagne far la plus récente.
  const { data: camps, error: eCamp } = await supabase
    .from('campagnes').select('id, date_ouverture')
    .eq('referentiel_version', VERSION_FAR)
    .order('date_ouverture', { ascending: false });
  if (eCamp) throw eCamp;
  const campFar = (camps ?? [])[0] as Row | undefined;
  if (!campFar) return [];

  // 2. Évals far de cette campagne + poids des orgs.
  const { data: evalsFarRaw, error: eEv } = await supabase
    .from('evaluations').select('id, org_id')
    .eq('campagne_id', campFar['id'] as string);
  if (eEv) throw eEv;
  const evalsFar = (evalsFarRaw ?? []) as Row[];
  if (evalsFar.length === 0) return [];

  const orgIds = [...new Set(evalsFar.map((e) => e['org_id'] as string))];
  const { data: orgsRaw, error: eOrg } = await supabase
    .from('organisations').select('id, poids').in('id', orgIds);
  if (eOrg) throw eOrg;
  const poids: Record<string, number> = {};
  for (const o of (orgsRaw ?? []) as Row[]) poids[o['id'] as string] = (o['poids'] as number | null) ?? 1;

  // 3. Scores far en batch (un seul appel).
  const evalIds = evalsFar.map((e) => e['id'] as string);
  const { data: scoresRaw, error: eSc } = await supabase
    .from('evaluation_scores').select('eval_id, critere_code, note')
    .in('eval_id', evalIds);
  if (eSc) throw eSc;
  const scoresParEval = new Map<string, ScoreMap>();
  for (const r of (scoresRaw ?? []) as Row[]) {
    const evalId = r['eval_id'] as string;
    const map = scoresParEval.get(evalId) ?? {};
    map[r['critere_code'] as string] = (r['note'] as number | null);
    scoresParEval.set(evalId, map);
  }
  // Participantes = évals qui ont au moins un score.
  const evalsParticipantes: EvalFaritanyParticipante[] = evalsFar
    .filter((e) => scoresParEval.has(e['id'] as string))
    .map((e) => ({ orgId: e['org_id'] as string, scores: scoresParEval.get(e['id'] as string) as ScoreMap }));

  // 4. Éval nationale v3_0 → notes par critère.
  const notesNationales: Record<string, number | null> = {};
  const { data: evalNat, error: eNat } = await supabase
    .from('evaluations').select('id')
    .eq('referentiel_version', VERSION_NAT)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eNat) throw eNat;
  if (evalNat) {
    const { data: natScores, error: eNs } = await supabase
      .from('evaluation_scores').select('critere_code, note')
      .eq('eval_id', (evalNat as Row)['id'] as string);
    if (eNs) throw eNs;
    for (const r of (natScores ?? []) as Row[]) {
      notesNationales[r['critere_code'] as string] = (r['note'] as number | null);
    }
  }

  return calculerIndiceDeploiement(refFar, evalsParticipantes, poids, notesNationales);
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/indiceService.test.ts`
Expected: PASS (1 test).

> Si le mock échoue sur une méthode non gérée (ex. `created_at` order + `maybeSingle`), c'est que le builder mock ne couvre pas un enchaînement : ajuster le builder du test (pas le service) pour refléter l'API réellement appelée.

- [ ] **Step 5: Typecheck**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add src/services/indiceService.ts src/__tests__/indiceService.test.ts
git commit -m "feat(indice): indiceService — 4 lectures + délégation au calcul pur (lecture seule)"
```

---

### Task 4: Store, page, route, nav et i18n

Store Zustand fin (charge via le service, tient l'état), page tableau (couleur distincte du GSAT, cellule « — » quand l'écart est indéfini), câblage route+nav cohérents (mêmes rôles), clés i18n fr/en. Test RTL sur les états clés.

**Files:**
- Create: `src/stores/indiceStore.ts`
- Create: `src/pages/dashboard/IndiceDeploiementPage.tsx`
- Modify: `src/router.tsx` (lazy import + route)
- Modify: `src/components/layout/Sidebar.tsx` (item admin, mêmes rôles)
- Modify: `src/i18n/fr.json`, `src/i18n/en.json` (namespace `pages.indice` + `nav.indice`)
- Test: `src/__tests__/indiceDeploiementPage.test.tsx`

**Interfaces:**
- Consumes: `getIndiceDeploiement`/`IndiceCritereNational` (Task 3), `create` de `zustand`, `RoleGuard`, `withSuspense` (patterns existants dans `router.tsx`).
- Produces: `useIndiceStore` (`{ resultats: IndiceCritereNational[]; loading: boolean; error: string | null; load(): Promise<void>; reset(): void }`), `IndiceDeploiementPage` (export nommé), route `/dashboard/indice`.

- [ ] **Step 1: Écrire le test RTL qui échoue**

Créer `src/__tests__/indiceDeploiementPage.test.tsx` (mocke le store, à l'image de `dashboardFaritanyPage.test.tsx`) :

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import { IndiceDeploiementPage } from '@/pages/dashboard/IndiceDeploiementPage';
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement';

const store = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@/stores/indiceStore', () => ({ useIndiceStore: () => store.current }));

function baseState(resultats: IndiceCritereNational[], over: Record<string, unknown> = {}) {
  return { resultats, loading: false, error: null, load: vi.fn(), reset: vi.fn(), ...over };
}
afterEach(cleanup);

describe('IndiceDeploiementPage', () => {
  it('affiche une ligne par critère national avec ID et écart', () => {
    store.current = baseState([
      { code: '401', noteNationale: 3, id: 45, ecart: 55, interpretation: 'alerte', nbEnfants: 2, nbFaritanyContributeurs: 5 },
    ]);
    render(<IndiceDeploiementPage />);
    expect(screen.getByText('401')).toBeTruthy();
    expect(screen.getByText('45')).toBeTruthy();
    expect(screen.getByText('55')).toBeTruthy();
    expect(screen.getByText('pages.indice.interpretation.alerte')).toBeTruthy();
  });

  it('affiche « — » quand l’écart est indéfini (note nationale N/A)', () => {
    store.current = baseState([
      { code: '706', noteNationale: null, id: 60, nbEnfants: 1, nbFaritanyContributeurs: 3 },
    ]);
    render(<IndiceDeploiementPage />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('état vide quand aucun résultat', () => {
    store.current = baseState([]);
    render(<IndiceDeploiementPage />);
    expect(screen.getByText('pages.indice.vide')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/indiceDeploiementPage.test.tsx`
Expected: FAIL — `IndiceDeploiementPage` / `useIndiceStore` introuvables.

- [ ] **Step 3: Créer le store**

Créer `src/stores/indiceStore.ts` :

```ts
import { create } from 'zustand';
import { getIndiceDeploiement } from '@/services/indiceService';
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement';

interface IndiceState {
  resultats: IndiceCritereNational[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  reset: () => void;
}

export const useIndiceStore = create<IndiceState>((set) => ({
  resultats: [],
  loading: false,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const resultats = await getIndiceDeploiement();
      set({ resultats, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
  reset: () => set({ resultats: [], loading: false, error: null }),
}));
```

- [ ] **Step 4: Créer la page**

Créer `src/pages/dashboard/IndiceDeploiementPage.tsx`. Couleur d'écart **distincte** du score GSAT (badge indigo/ambre/rouge selon la bande), cellule « — » quand `ecart`/`id` indéfini :

```tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIndiceStore } from '@/stores/indiceStore';
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement';

function badgeClass(interp: IndiceCritereNational['interpretation']): string {
  // Palette VOLONTAIREMENT distincte des scores GSAT (l'ID n'est pas une conformité).
  switch (interp) {
    case 'alerte':        return 'bg-rose-100 text-rose-800';
    case 'bonne_pratique':return 'bg-emerald-100 text-emerald-800';
    case 'coherent':      return 'bg-slate-100 text-slate-700';
    default:              return 'bg-slate-50 text-slate-400';
  }
}

export function IndiceDeploiementPage() {
  const { t } = useTranslation();
  const { resultats, loading, error, load } = useIndiceStore();

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">{t('pages.indice.titre')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('pages.indice.sousTitre')}</p>

      {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
      {loading && <p className="mt-4 text-sm text-slate-500">{t('pages.indice.chargement')}</p>}

      {!loading && resultats.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">{t('pages.indice.vide')}</p>
      )}

      {resultats.length > 0 && (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2">{t('pages.indice.col.critere')}</th>
              <th className="py-2">{t('pages.indice.col.noteNationale')}</th>
              <th className="py-2">{t('pages.indice.col.id')}</th>
              <th className="py-2">{t('pages.indice.col.ecart')}</th>
              <th className="py-2">{t('pages.indice.col.interpretation')}</th>
            </tr>
          </thead>
          <tbody>
            {resultats.map((r) => (
              <tr key={r.code} className="border-t border-slate-100">
                <td className="py-2 font-medium">{r.code}</td>
                <td className="py-2">{r.noteNationale ?? '—'}</td>
                <td className="py-2">{r.id ?? '—'}</td>
                <td className="py-2">{r.ecart ?? '—'}</td>
                <td className="py-2">
                  {r.interpretation ? (
                    <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(r.interpretation)}`}>
                      {t(`pages.indice.interpretation.${r.interpretation}`)}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Câbler la route**

Dans `src/router.tsx` : ajouter le lazy import près des autres (après `DashboardFaritanyPage`, ~L22) :

```tsx
const IndiceDeploiementPage = lazy(() =>
  import('@/pages/dashboard/IndiceDeploiementPage').then(m => ({ default: m.IndiceDeploiementPage }))
)
```

Ajouter le wrapper Suspense près des autres `Lazy*` (~L107) :

```tsx
const LazyIndice = withSuspense(IndiceDeploiementPage)
```

Ajouter la route dans le tableau des enfants, juste après la route `dashboard/osn` (mêmes rôles) :

```tsx
{
  path: 'dashboard/indice',
  element: <RoleGuard roles={['admin_global', 'responsable_osn', 'responsable_region']}><LazyIndice /></RoleGuard>,
},
```

- [ ] **Step 6: Câbler la nav (rôles IDENTIQUES au RoleGuard)**

Dans `src/components/layout/Sidebar.tsx`, ajouter dans le **groupe admin** (près de `admin/revue`, mêmes rôles pour éviter tout drift route↔nav) :

```tsx
{ to: '/dashboard/indice', icon: 'travel_explore', labelKey: 'nav.indice', roles: ['admin_global', 'responsable_osn', 'responsable_region'] },
```

- [ ] **Step 7: Ajouter les clés i18n (fr ET en)**

Dans `src/i18n/fr.json`, ajouter la clé `nav.indice` et le bloc `pages.indice` :

```json
"nav": { "indice": "Indice de déploiement" },
"pages": {
  "indice": {
    "titre": "Indice de déploiement",
    "sousTitre": "Écart entre la note nationale GSAT et le déploiement territorial constaté sur les Faritany.",
    "chargement": "Calcul en cours…",
    "vide": "Aucune donnée : campagne Faritany ou évaluation nationale absente.",
    "col": { "critere": "Critère national", "noteNationale": "Note nationale", "id": "Indice (0–100)", "ecart": "Écart", "interpretation": "Lecture" },
    "interpretation": { "alerte": "Déploiement défaillant", "coherent": "Cohérent", "bonne_pratique": "Bonne pratique locale" }
  }
}
```

> ⚠️ `nav` et `pages` existent déjà : **fusionner** les clés dans les objets existants, ne pas dupliquer les clés racines (sinon JSON invalide / écrasement). Faire la même fusion dans `src/i18n/en.json` avec les traductions anglaises (`"indice": "Deployment index"`, etc.).

- [ ] **Step 8: Lancer le test RTL, vérifier qu'il passe**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/vitest/vitest.mjs run src/__tests__/indiceDeploiementPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 9: Typecheck + build**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json && node node_modules/vite/bin/vite.js build`
Expected: tsc 0 erreur, build exit 0.

- [ ] **Step 10: Commit**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add src/stores/indiceStore.ts src/pages/dashboard/IndiceDeploiementPage.tsx src/router.tsx src/components/layout/Sidebar.tsx src/i18n/fr.json src/i18n/en.json src/__tests__/indiceDeploiementPage.test.tsx
git commit -m "feat(indice): store + page dédiée + route/nav OSN·région·admin + i18n"
```

---

### Task 5: Vérification RLS/isolation sous vrai JWT (technique Lot 1)

Prouver empiriquement, sur Supabase local, que les rôles cibles **lisent** les évals+scores des Faritany descendants ET leur propre éval nationale v3_0, et que le `responsable_asn` est **bloqué**. C'est le contre-pouvoir qui a attrapé tous les bugs du Lot 1 ; sans lui, un trou RLS rendrait la page vide en silence. Exclu des runs par défaut (comme `parite-sql.diff`).

**Files:**
- Create: `docs/superpowers/verif/indice-rls.sql` (script psql documenté)
- Modify: `AUDIT_LOT1.md` ou nouveau `AUDIT_INDICE.md` (consigner le verdict)

**Interfaces:**
- Consumes: instance Supabase locale up, fixtures (org TEM parent, Faritany ANT-01/FIA-01, une éval far avec scores, une éval nationale OSN v3_0 avec scores). Prérequis : re-seeder si le test `parite-sql.diff` a vidé `evaluations/evaluation_scores/campagnes`.

- [ ] **Step 1: Seeder le minimum manquant**

Vérifier la présence d'une éval **nationale v3_0** avec des scores et d'une campagne **far_v1_0** avec ≥1 éval Faritany scorée. Si absentes (le test de parité les vide), insérer un jeu minimal : 1 référentiel v3_0 (≥1 dimension, ≥1 critère dont le code est un `sourceCodes` far, ex. `401`), 1 éval nationale OSN avec `evaluation_scores(401, note)`, 1 campagne far_v1_0 + 1 éval ANT-01 avec quelques scores far dont un enfant de `401`.

Run (adapter le port/désignation à l'instance locale — cf. `parite-sql.diff` : `PGPORT=54322 PGDATABASE=postgres PGPASSWORD=postgres`) :

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "select referentiel_version, count(*) from evaluations group by 1;"
```
Expected: voir des lignes `v3_0` et `far_v1_0`. Sinon, seeder avant de continuer.

- [ ] **Step 2: Écrire le script de vérification JWT**

Créer `docs/superpowers/verif/indice-rls.sql` — chaque bloc en transaction rollback, sous un rôle simulé. Modèle (adapter les UUID aux fixtures locales) :

```sql
-- responsable_osn : DOIT lire l'éval nationale v3_0 ET les évals far descendantes.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"osn-user","role":"responsable_osn","org_id":"<UUID_TEM>"}';
select 'nat_scores' as check, count(*) from evaluation_scores es
  join evaluations e on e.id = es.eval_id where e.referentiel_version = 'v3_0';   -- attendu > 0
select 'far_evals' as check, count(*) from evaluations where referentiel_version = 'far_v1_0'; -- attendu > 0
rollback;

-- responsable_region : même attendu (sous-arbre).
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"reg-user","role":"responsable_region","org_id":"<UUID_TEM>"}';
select 'far_scores' as check, count(*) from evaluation_scores es
  join evaluations e on e.id = es.eval_id where e.referentiel_version = 'far_v1_0'; -- attendu > 0
rollback;

-- responsable_asn (ANT-01) : NE DOIT PAS lire l'éval nationale v3_0 (isolation).
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"asn-user","role":"responsable_asn","org_id":"<UUID_ANT01>"}';
select 'nat_scores_asn' as check, count(*) from evaluation_scores es
  join evaluations e on e.id = es.eval_id where e.referentiel_version = 'v3_0'; -- attendu = 0
rollback;
```

- [ ] **Step 3: Exécuter et constater**

Run : `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f docs/superpowers/verif/indice-rls.sql`
Expected : `nat_scores > 0`, `far_evals > 0`, `far_scores > 0`, **`nat_scores_asn = 0`**.

- [ ] **Step 4: Si le responsable_osn/région ne lit PAS les scores far descendants**

Alors la page sera vide pour eux → trou RLS à combler par une **policy additive** de lecture de sous-arbre sur `evaluation_scores`/`evaluations` (même pattern que `evals_*_resp_asn` du Lot 1, mais montant/sous-arbre pour OSN/région). Écrire la policy dans une migration additive, la prouver sous JWT (le compte passe de 0 à >0), et **NE PAS** élargir l'accès du `responsable_asn`. Documenter dans `AUDIT_INDICE.md`.

> Si le tout passe du premier coup, ne rien ajouter — la décision RLS du spec (lecture en clair par OSN/région/admin) est validée.

- [ ] **Step 5: Consigner le verdict et committer**

Créer/mettre à jour `AUDIT_INDICE.md` avec : rôles testés, comptes obtenus, verdict isolation (asn = 0), et toute policy ajoutée. Puis :

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
git add docs/superpowers/verif/indice-rls.sql AUDIT_INDICE.md
git commit -m "test(indice): vérification RLS/isolation sous JWT (OSN/région lisent, ASN bloqué)"
```

---

## Self-Review

**Spec coverage :**
- §2 formule → Task 2 (ID, écart, bandes) ✓
- §3 cœur pur + 5 garde-fous → Task 1 (atome absent/N-A exclus) + Task 2 (Σ_f participants, poids variés au test, note N/A→écart indéfini, id null, multi-parent, inactifs) ✓
- §4 plombage (4 lectures, pas de SECURITY DEFINER, participantes only) → Task 3 ✓
- §5 page dédiée, route/nav mêmes rôles, couleur distincte, cellule « — » → Task 4 ✓
- §6 tests (unitaire poids variés, RTL, DB JWT) → Tasks 1–2 (unit), 4 (RTL), 5 (DB) ✓
- §7 fichiers → tous couverts (scoring.ts, indice/, indiceService, page, store, router, Sidebar, i18n) ✓
- Contrainte « ID ne touche pas le GSAT » → aucune écriture/trigger/RPC dans tout le plan ✓

**Placeholder scan :** aucun TODO/TBD ; chaque step de code montre le code complet ; commandes exactes avec attendu. ✓

**Type consistency :** `scoreSurCriteres(scores, criteres): number | null` (Task 1) consommé tel quel par Task 2 ; `IndiceCritereNational`/`EvalFaritanyParticipante` définis en Task 2, importés à l'identique en Tasks 3 et 4 ; `getIndiceDeploiement(): Promise<IndiceCritereNational[]>` (Task 3) consommé par le store (Task 4) ; `useIndiceStore` shape identique entre store (Task 4 step 3) et mock RTL (Task 4 step 1). ✓
