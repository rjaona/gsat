# Cockpits de pilotage GSAT — Phase 1 (Révéler) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer, en lecture seule, deux cockpits décisionnels — national (watchlist des 33 Faritany sur 2 axes séparés) et régional (file de priorités) — sans aucune migration DB.

**Architecture:** Logique métier isolée dans des utils purs testés (`src/utils/pilotage.ts`) ; agrégation de données réutilise les services existants (`getDashboardStatsByOrgIds`, `listActionAggByOrgIds` étendu, `listOrganisations`, `listPlansByOrg`/`listActions`) ; deux stores Zustand orchestrent le chargement ; pages + composants de présentation reçoivent des props pures. Routes protégées par `RoleGuard`, nav via une nouvelle section Sidebar.

**Tech Stack:** React 19 + Vite 6 + TypeScript strict, Zustand 5, react-router-dom v7, react-i18next (fr/en), Tailwind v4, vitest + React Testing Library.

## Global Constraints

- TypeScript strict : `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` — indexations d'array/record potentiellement `undefined`, propriétés optionnelles à typer `| undefined`.
- Build/gate : `node node_modules/typescript/bin/tsc -b` (JAMAIS `-p`), `node node_modules/vite/bin/vite.js build`.
- Tests : `node node_modules/vitest/vitest.mjs run <chemin>` (les `.bin` sont cassés sur `/mnt/d`).
- Dépôt sur `/mnt/d` → **écrire tout fichier via `cat` heredoc ou `sed`**, jamais Edit/Write (watcher OneDrive reverte).
- i18n = `src/i18n/fr.ts` et `src/i18n/en.ts` (objets TS, PAS de .json) ; mg = fallback fr accepté.
- Libellé du niveau local via `getLibelleNiveauLocal`, jamais « ASN »/« Faritany » en dur dans la logique.
- Aucune migration DB en Phase 1 (les policies SELECT descendantes existent déjà : `dash_select`, `pactions_select`).
- Frequent commits : un commit par tâche.

---

## Structure des fichiers

- **Modifier** `src/services/planActionService.ts` — étendre `OrgActionAgg` + `listActionAggByOrgIds` (colonne `date_echeance`, dérivation `actionsRetard`) ; ajouter helper pur `estEnRetard`.
- **Créer** `src/utils/pilotage.ts` — utils purs : `deriverStatutFaritany`, `bucketiser2x2`, `ordonnerPrioritesRegionales` + types.
- **Créer** `src/components/dashboard/pilotage/Grille2x2.tsx` — grille 2×2 à compteurs (national).
- **Créer** `src/components/dashboard/pilotage/WatchlistFaritany.tsx` — tableau watchlist groupé par province (national).
- **Créer** `src/components/dashboard/pilotage/DrilldownFaritany.tsx` — panneau détail lecture seule (national).
- **Créer** `src/components/dashboard/pilotage/FilePriorites.tsx` — file de priorités (régional).
- **Créer** `src/stores/pilotageNationalStore.ts` + `src/stores/pilotageRegionalStore.ts` — orchestration.
- **Créer** `src/pages/dashboard/PilotageNationalPage.tsx` + `src/pages/dashboard/PilotageRegionalPage.tsx`.
- **Modifier** `src/router.tsx` — 2 lazy + 2 routes (RoleGuard).
- **Modifier** `src/components/layout/Sidebar.tsx` — section « Pilotage » (role-filtered).
- **Modifier** `src/i18n/fr.ts` + `src/i18n/en.ts` — clés `nav.*` + `pages.pilotageNational.*` + `pages.pilotageRegional.*`.
- **Créer** les tests associés sous `src/__tests__/`.

---

### Task 1 : Étendre l'agrégation d'actions avec `actionsRetard`

**Files:**
- Modify: `src/services/planActionService.ts` (interface `OrgActionAgg` ~l.296-304 ; fonction `listActionAggByOrgIds` ~l.311-342)
- Test: `src/__tests__/estEnRetard.test.ts`

**Interfaces:**
- Produces: `export function estEnRetard(statut: string, dateEcheance: string | null, today: string): boolean` ; `OrgActionAgg` gagne `actionsRetard: number`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/__tests__/estEnRetard.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { estEnRetard } from '@/services/planActionService';

const TODAY = '2026-09-13';

describe('estEnRetard', () => {
  it('vrai si échéance passée et non terminée/bloquée', () => {
    expect(estEnRetard('en_cours', '2026-09-12', TODAY)).toBe(true);
    expect(estEnRetard('a_faire', '2026-01-01T10:00:00Z', TODAY)).toBe(true);
  });
  it('faux si échéance aujourd’hui ou future', () => {
    expect(estEnRetard('en_cours', '2026-09-13', TODAY)).toBe(false);
    expect(estEnRetard('a_faire', '2026-12-01', TODAY)).toBe(false);
  });
  it('faux si terminée ou bloquée (bloquée comptée à part)', () => {
    expect(estEnRetard('termine', '2026-01-01', TODAY)).toBe(false);
    expect(estEnRetard('bloque', '2026-01-01', TODAY)).toBe(false);
  });
  it('faux si pas d’échéance', () => {
    expect(estEnRetard('en_cours', null, TODAY)).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test — il échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/estEnRetard.test.ts`
Expected: FAIL — `estEnRetard is not a function` / import introuvable.

- [ ] **Step 3 : Implémenter (helper + extension service)**

Dans `src/services/planActionService.ts`, ajouter le helper exporté au-dessus de `listActionAggByOrgIds` :
```ts
/**
 * Une action est « en retard » si son échéance est passée et qu'elle n'est ni
 * terminée ni bloquée (les bloquées sont comptées à part pour ne pas double-compter).
 * `today` et `dateEcheance` comparés sur leur partie date (ISO lexicographique).
 */
export function estEnRetard(statut: string, dateEcheance: string | null, today: string): boolean {
  if (!dateEcheance) return false;
  if (statut === 'termine' || statut === 'bloque') return false;
  return dateEcheance.slice(0, 10) < today;
}
```

Étendre l'interface `OrgActionAgg` (ajouter la ligne) :
```ts
  actionsBloque: number;
  actionsRetard: number;   // échéance passée, ni terminée ni bloquée
  latestUpdate: string | null;
```

Dans `listActionAggByOrgIds` : ajouter `date_echeance` au select, initialiser `actionsRetard` dans `empty()`, et le calculer dans la boucle. Remplacer les 3 zones :
```ts
    .select('org_id, plan_actions(statut, created_at, date_echeance)')
```
```ts
  const empty = (): OrgActionAgg => ({
    actionsTotal: 0, actionsDone: 0, actionsEnCours: 0, actionsBloque: 0, actionsRetard: 0, latestUpdate: null,
  });
```
```ts
    const actions = (plan['plan_actions'] as unknown as { statut: string; created_at: string | null; date_echeance: string | null }[]) ?? [];
    const today = new Date().toISOString().slice(0, 10);
    for (const a of actions) {
      agg.actionsTotal++;
      if (a.statut === 'termine') agg.actionsDone++;
      else if (a.statut === 'en_cours') agg.actionsEnCours++;
      else if (a.statut === 'bloque') agg.actionsBloque++;
      if (estEnRetard(a.statut, a.date_echeance, today)) agg.actionsRetard++;
      if (a.created_at && (agg.latestUpdate === null || a.created_at > agg.latestUpdate)) {
        agg.latestUpdate = a.created_at;
      }
    }
```

- [ ] **Step 4 : Lancer le test — il passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/estEnRetard.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5 : Vérifier le typecheck**

Run: `node node_modules/typescript/bin/tsc -b`
Expected: 0 erreur.

- [ ] **Step 6 : Commit**

```bash
git add src/services/planActionService.ts src/__tests__/estEnRetard.test.ts
git commit -m "feat(pilotage): actionsRetard dans l'agrégation d'actions par org"
```

---

### Task 2 : Util pur `deriverStatutFaritany`

**Files:**
- Create: `src/utils/pilotage.ts`
- Test: `src/__tests__/pilotage.deriverStatut.test.ts`

**Interfaces:**
- Produces:
```ts
export type StatutFaritany = 'non_evalue' | 'rien_demarre' | 'en_souffrance' | 'sous_controle';
export interface FaritanySignals {
  evalue: boolean;
  essentielsKoCount: number;
  actionsTotal: number;
  actionsRetard: number;
  actionsBloque: number;
}
export function deriverStatutFaritany(s: FaritanySignals): StatutFaritany;
```

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/__tests__/pilotage.deriverStatut.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { deriverStatutFaritany, type FaritanySignals } from '@/utils/pilotage';

const base: FaritanySignals = { evalue: true, essentielsKoCount: 0, actionsTotal: 0, actionsRetard: 0, actionsBloque: 0 };

describe('deriverStatutFaritany', () => {
  it('non évalué prime sur tout', () => {
    expect(deriverStatutFaritany({ ...base, evalue: false, essentielsKoCount: 3 })).toBe('non_evalue');
  });
  it('KO sans aucune action = rien démarré (angle mort de l’appui)', () => {
    expect(deriverStatutFaritany({ ...base, essentielsKoCount: 2, actionsTotal: 0 })).toBe('rien_demarre');
  });
  it('actions en retard ou bloquées = en souffrance', () => {
    expect(deriverStatutFaritany({ ...base, actionsTotal: 3, actionsRetard: 1 })).toBe('en_souffrance');
    expect(deriverStatutFaritany({ ...base, actionsTotal: 3, actionsBloque: 2 })).toBe('en_souffrance');
    expect(deriverStatutFaritany({ ...base, essentielsKoCount: 1, actionsTotal: 3, actionsBloque: 1 })).toBe('en_souffrance');
  });
  it('évalué, actions en cours, rien en souffrance = sous contrôle', () => {
    expect(deriverStatutFaritany({ ...base, actionsTotal: 4 })).toBe('sous_controle');
    expect(deriverStatutFaritany(base)).toBe('sous_controle');
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotage.deriverStatut.test.ts`
Expected: FAIL — module `@/utils/pilotage` introuvable.

- [ ] **Step 3 : Implémenter**

Créer `src/utils/pilotage.ts` :
```ts
export type StatutFaritany = 'non_evalue' | 'rien_demarre' | 'en_souffrance' | 'sous_controle';

export interface FaritanySignals {
  evalue: boolean;
  essentielsKoCount: number;
  actionsTotal: number;
  actionsRetard: number;
  actionsBloque: number;
}

/**
 * Statut décisionnel d'un Faritany. L'ordre des tests est intentionnel :
 * non évalué prime ; « KO + aucune action » (rien démarré) est distingué de
 * « sous contrôle » pour ne pas masquer le premier candidat à l'appui.
 */
export function deriverStatutFaritany(s: FaritanySignals): StatutFaritany {
  if (!s.evalue) return 'non_evalue';
  if (s.essentielsKoCount > 0 && s.actionsTotal === 0) return 'rien_demarre';
  if (s.actionsRetard > 0 || s.actionsBloque > 0) return 'en_souffrance';
  return 'sous_controle';
}
```

- [ ] **Step 4 : Lancer — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotage.deriverStatut.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/utils/pilotage.ts src/__tests__/pilotage.deriverStatut.test.ts
git commit -m "feat(pilotage): util deriverStatutFaritany (4 statuts décisionnels)"
```

---

### Task 3 : Util pur `bucketiser2x2`

**Files:**
- Modify: `src/utils/pilotage.ts`
- Test: `src/__tests__/pilotage.bucket.test.ts`

**Interfaces:**
- Consumes: `FaritanySignals` (Task 2).
- Produces:
```ts
export interface Bucket2x2 { appuiUrgent: number; conformite: number; execution: number; sain: number; nonEvalue: number }
export function bucketiser2x2(rows: FaritanySignals[]): Bucket2x2;
```

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/__tests__/pilotage.bucket.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { bucketiser2x2, type FaritanySignals } from '@/utils/pilotage';

const f = (p: Partial<FaritanySignals>): FaritanySignals => ({
  evalue: true, essentielsKoCount: 0, actionsTotal: 0, actionsRetard: 0, actionsBloque: 0, ...p,
});

describe('bucketiser2x2', () => {
  it('classe chaque Faritany dans une seule case, non évalués à part', () => {
    const rows = [
      f({ essentielsKoCount: 2, actionsBloque: 1 }),          // appui urgent (KO + souffrance)
      f({ essentielsKoCount: 3, actionsTotal: 0 }),           // conformité (KO, pas de souffrance)
      f({ actionsRetard: 2, actionsTotal: 3 }),               // exécution (souffrance, pas de KO)
      f({ actionsTotal: 5 }),                                 // sain
      f({ evalue: false }),                                   // non évalué
      f({ evalue: false, essentielsKoCount: 9 }),             // non évalué (prime)
    ];
    expect(bucketiser2x2(rows)).toEqual({ appuiUrgent: 1, conformite: 1, execution: 1, sain: 1, nonEvalue: 2 });
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotage.bucket.test.ts`
Expected: FAIL — `bucketiser2x2 is not a function`.

- [ ] **Step 3 : Implémenter (ajouter à `src/utils/pilotage.ts`)**

```ts
export interface Bucket2x2 {
  appuiUrgent: number;  // sévérité (KO) ET exécution en souffrance
  conformite: number;   // KO seul (inclut « rien démarré »)
  execution: number;    // souffrance seule
  sain: number;         // évalué, ni KO ni souffrance
  nonEvalue: number;
}

/** Répartit les Faritany sur 2 axes bruts (sévérité × exécution) ; non évalués à part. */
export function bucketiser2x2(rows: FaritanySignals[]): Bucket2x2 {
  const b: Bucket2x2 = { appuiUrgent: 0, conformite: 0, execution: 0, sain: 0, nonEvalue: 0 };
  for (const r of rows) {
    if (!r.evalue) { b.nonEvalue++; continue; }
    const severite = r.essentielsKoCount > 0;
    const souffrance = r.actionsRetard > 0 || r.actionsBloque > 0;
    if (severite && souffrance) b.appuiUrgent++;
    else if (severite) b.conformite++;
    else if (souffrance) b.execution++;
    else b.sain++;
  }
  return b;
}
```

- [ ] **Step 4 : Lancer — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotage.bucket.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/utils/pilotage.ts src/__tests__/pilotage.bucket.test.ts
git commit -m "feat(pilotage): util bucketiser2x2 (grille sévérité × exécution)"
```

---

### Task 4 : Util pur `ordonnerPrioritesRegionales`

**Files:**
- Modify: `src/utils/pilotage.ts`
- Test: `src/__tests__/pilotage.priorites.test.ts`

**Interfaces:**
- Consumes: `ActionStatut`, `ActionPriorite` de `@/types`.
- Produces:
```ts
export type PrioriteItem =
  | { kind: 'essentiel_ko'; code: string; libelle: string }
  | { kind: 'action'; id: string; titre: string; statut: ActionStatut; dateEcheance: string; priorite: ActionPriorite };
export function ordonnerPrioritesRegionales(items: PrioriteItem[]): PrioriteItem[];
```

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/__tests__/pilotage.priorites.test.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { ordonnerPrioritesRegionales, type PrioriteItem } from '@/utils/pilotage';

describe('ordonnerPrioritesRegionales', () => {
  it('KO d’abord, puis bloquées, puis retard (échéance la plus ancienne), priorité en départage', () => {
    const items: PrioriteItem[] = [
      { kind: 'action', id: 'r2', titre: 'retard récent', statut: 'en_cours', dateEcheance: '2026-09-10', priorite: 'moyenne' },
      { kind: 'action', id: 'b1', titre: 'bloquée', statut: 'bloque', dateEcheance: '2026-12-01', priorite: 'basse' },
      { kind: 'essentiel_ko', code: 'F401', libelle: 'Assurance' },
      { kind: 'action', id: 'r1', titre: 'retard ancien', statut: 'en_cours', dateEcheance: '2026-01-05', priorite: 'basse' },
    ];
    const ordre = ordonnerPrioritesRegionales(items).map(i => i.kind === 'essentiel_ko' ? i.code : i.id);
    expect(ordre).toEqual(['F401', 'b1', 'r1', 'r2']);
  });

  it('départage deux bloquées par priorité (critique > haute > moyenne > basse)', () => {
    const items: PrioriteItem[] = [
      { kind: 'action', id: 'lo', titre: 'a', statut: 'bloque', dateEcheance: '2026-05-01', priorite: 'basse' },
      { kind: 'action', id: 'hi', titre: 'b', statut: 'bloque', dateEcheance: '2026-05-01', priorite: 'critique' },
    ];
    expect(ordonnerPrioritesRegionales(items).map(i => (i as { id: string }).id)).toEqual(['hi', 'lo']);
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotage.priorites.test.ts`
Expected: FAIL — `ordonnerPrioritesRegionales is not a function`.

- [ ] **Step 3 : Implémenter (ajouter à `src/utils/pilotage.ts`)**

Ajouter en tête du fichier l'import de type :
```ts
import type { ActionStatut, ActionPriorite } from '@/types';
```
Puis :
```ts
export type PrioriteItem =
  | { kind: 'essentiel_ko'; code: string; libelle: string }
  | { kind: 'action'; id: string; titre: string; statut: ActionStatut; dateEcheance: string; priorite: ActionPriorite };

const RANG_PRIORITE: Record<ActionPriorite, number> = { critique: 0, haute: 1, moyenne: 2, basse: 3 };

/** Rang de bloc : KO (0) < action bloquée (1) < action en retard (2). */
function rangBloc(it: PrioriteItem): number {
  if (it.kind === 'essentiel_ko') return 0;
  return it.statut === 'bloque' ? 1 : 2;
}

/**
 * Ordonne la file régionale : essentiels KO → actions bloquées → actions en
 * retard (échéance la plus ancienne d'abord) ; à bloc égal, priorité la plus
 * haute d'abord. Ne filtre pas : l'appelant ne passe que KO + actions en souffrance.
 */
export function ordonnerPrioritesRegionales(items: PrioriteItem[]): PrioriteItem[] {
  return [...items].sort((a, b) => {
    const ra = rangBloc(a), rb = rangBloc(b);
    if (ra !== rb) return ra - rb;
    if (a.kind === 'action' && b.kind === 'action') {
      if (a.statut !== 'bloque' && b.statut !== 'bloque') {
        // deux retards : échéance la plus ancienne d'abord
        if (a.dateEcheance !== b.dateEcheance) return a.dateEcheance < b.dateEcheance ? -1 : 1;
      }
      return RANG_PRIORITE[a.priorite] - RANG_PRIORITE[b.priorite];
    }
    return 0;
  });
}
```

- [ ] **Step 4 : Lancer — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotage.priorites.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5 : Typecheck + commit**

Run: `node node_modules/typescript/bin/tsc -b` → 0 erreur.
```bash
git add src/utils/pilotage.ts src/__tests__/pilotage.priorites.test.ts
git commit -m "feat(pilotage): util ordonnerPrioritesRegionales (KO→bloquées→retard)"
```

---

### Task 5 : Composant `Grille2x2` (national)

**Files:**
- Create: `src/components/dashboard/pilotage/Grille2x2.tsx`
- Test: `src/__tests__/grille2x2.test.tsx`

**Interfaces:**
- Consumes: `Bucket2x2` (Task 3).
- Produces: `export function Grille2x2(props: { buckets: Bucket2x2; onSelectCase?: (cle: keyof Bucket2x2) => void }): JSX.Element`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/__tests__/grille2x2.test.tsx` :
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Grille2x2 } from '@/components/dashboard/pilotage/Grille2x2';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }) }));

describe('Grille2x2', () => {
  const buckets = { appuiUrgent: 7, conformite: 2, execution: 3, sain: 18, nonEvalue: 3 };
  it('affiche le compteur d’appui urgent', () => {
    render(<Grille2x2 buckets={buckets} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });
  it('déclenche onSelectCase au clic sur la case appui urgent', () => {
    const onSelect = vi.fn();
    render(<Grille2x2 buckets={buckets} onSelectCase={onSelect} />);
    fireEvent.click(screen.getByTestId('case-appuiUrgent'));
    expect(onSelect).toHaveBeenCalledWith('appuiUrgent');
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/grille2x2.test.tsx`
Expected: FAIL — composant introuvable.

- [ ] **Step 3 : Implémenter**

Créer `src/components/dashboard/pilotage/Grille2x2.tsx` :
```tsx
import { useTranslation } from 'react-i18next';
import type { Bucket2x2 } from '@/utils/pilotage';

const CASES: { cle: keyof Bucket2x2; labelKey: string; defaut: string; urgent?: boolean }[] = [
  { cle: 'appuiUrgent', labelKey: 'pages.pilotageNational.cases.appuiUrgent', defaut: 'Appui urgent', urgent: true },
  { cle: 'conformite',  labelKey: 'pages.pilotageNational.cases.conformite',  defaut: 'Conformité à traiter' },
  { cle: 'execution',   labelKey: 'pages.pilotageNational.cases.execution',   defaut: 'Exécution en souffrance' },
  { cle: 'sain',        labelKey: 'pages.pilotageNational.cases.sain',        defaut: 'Sous contrôle' },
];

export function Grille2x2({ buckets, onSelectCase }: { buckets: Bucket2x2; onSelectCase?: (cle: keyof Bucket2x2) => void }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3">
      {CASES.map(c => (
        <button
          key={c.cle}
          type="button"
          data-testid={`case-${c.cle}`}
          onClick={() => onSelectCase?.(c.cle)}
          className={[
            'text-left rounded-xl p-4 transition-all border',
            c.urgent ? 'bg-[#ffdad6] border-[#ba1a1a]/30' : 'bg-[#f8f9ff] border-transparent',
            'hover:shadow-sm',
          ].join(' ')}
        >
          <p className="text-3xl font-extrabold tabular-nums text-[#15236e]">{buckets[c.cle]}</p>
          <p className={`text-xs font-semibold mt-1 ${c.urgent ? 'text-[#ba1a1a]' : 'text-[#454651]'}`}>
            {t(c.labelKey, c.defaut)}
          </p>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4 : Lancer — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/grille2x2.test.tsx`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/components/dashboard/pilotage/Grille2x2.tsx src/__tests__/grille2x2.test.tsx
git commit -m "feat(pilotage): composant Grille2x2 (compteurs par case, cliquable)"
```

---

### Task 6 : Composant `WatchlistFaritany` (national)

**Files:**
- Create: `src/components/dashboard/pilotage/WatchlistFaritany.tsx`
- Test: `src/__tests__/watchlistFaritany.test.tsx`

**Interfaces:**
- Consumes: `StatutFaritany` (Task 2), `grouperParProvince` de `@/utils/perimetreProvinces`, type `Organisation`.
- Produces:
```ts
export interface WatchlistRow {
  org: Organisation;
  statut: StatutFaritany;
  essentielsKoCount: number;
  actionsTotal: number;
  actionsRetard: number;
  actionsBloque: number;
}
export function WatchlistFaritany(props: { rows: WatchlistRow[]; niveauLabel?: string; onSelect?: (orgId: string) => void }): JSX.Element;
```

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/__tests__/watchlistFaritany.test.tsx` :
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { WatchlistFaritany, type WatchlistRow } from '@/components/dashboard/pilotage/WatchlistFaritany';
import type { Organisation } from '@/types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }) }));

const org = (id: string, code: string, nom: string): Organisation =>
  ({ id, code, nom, type: 'ASN' } as unknown as Organisation);

const rows: WatchlistRow[] = [
  { org: org('a', 'ANT-01', 'Analamanga'), statut: 'en_souffrance', essentielsKoCount: 3, actionsTotal: 5, actionsRetard: 4, actionsBloque: 1 },
  { org: org('b', 'ANT-02', 'Bongolava'),  statut: 'rien_demarre', essentielsKoCount: 2, actionsTotal: 0, actionsRetard: 0, actionsBloque: 0 },
  { org: org('s', 'DIA-01', 'Sofia'),      statut: 'non_evalue',   essentielsKoCount: 0, actionsTotal: 0, actionsRetard: 0, actionsBloque: 0 },
];

describe('WatchlistFaritany', () => {
  it('affiche les Faritany avec leur statut, y compris non évalué', () => {
    render(<WatchlistFaritany rows={rows} />);
    expect(screen.getByText('Analamanga')).toBeInTheDocument();
    expect(screen.getByText('Sofia')).toBeInTheDocument();
    expect(screen.getByText('rien démarré')).toBeInTheDocument();
    expect(screen.getByText('non évalué')).toBeInTheDocument();
  });
  it('groupe par province (en-tête Antananarivo présent)', () => {
    render(<WatchlistFaritany rows={rows} />);
    expect(screen.getByText('Antananarivo')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/watchlistFaritany.test.tsx`
Expected: FAIL — composant introuvable.

- [ ] **Step 3 : Implémenter**

Créer `src/components/dashboard/pilotage/WatchlistFaritany.tsx` :
```tsx
import { useTranslation } from 'react-i18next';
import type { Organisation } from '@/types';
import { grouperParProvince } from '@/utils/perimetreProvinces';
import type { StatutFaritany } from '@/utils/pilotage';

export interface WatchlistRow {
  org: Organisation;
  statut: StatutFaritany;
  essentielsKoCount: number;
  actionsTotal: number;
  actionsRetard: number;
  actionsBloque: number;
}

const STATUT_LABEL: Record<StatutFaritany, string> = {
  non_evalue: 'non évalué',
  rien_demarre: 'rien démarré',
  en_souffrance: 'en souffrance',
  sous_controle: 'sous contrôle',
};

const STATUT_STYLE: Record<StatutFaritany, string> = {
  non_evalue: 'bg-[#ecedef] text-[#767682]',
  rien_demarre: 'bg-[#ffe6c0] text-[#8a5a00]',
  en_souffrance: 'bg-[#ffdad6] text-[#ba1a1a]',
  sous_controle: 'bg-[#dcf5d3] text-[#256a1c]',
};

export function WatchlistFaritany({ rows, niveauLabel, onSelect }: { rows: WatchlistRow[]; niveauLabel?: string; onSelect?: (orgId: string) => void }) {
  const { t } = useTranslation();
  const byId = new Map(rows.map(r => [r.org.id, r]));
  const groupes = grouperParProvince(rows.map(r => r.org));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-[#767682] border-b border-[#eceef4]">
            <th className="py-2 pr-3">{niveauLabel ?? t('pages.pilotageNational.colFaritany', 'Faritany')}</th>
            <th className="py-2 px-2 text-center">{t('pages.pilotageNational.colKo', 'Essentiels KO')}</th>
            <th className="py-2 px-2 text-center">{t('pages.pilotageNational.colTotal', 'Actions')}</th>
            <th className="py-2 px-2 text-center">{t('pages.pilotageNational.colRetard', 'Retard')}</th>
            <th className="py-2 px-2 text-center">{t('pages.pilotageNational.colBloque', 'Bloquées')}</th>
            <th className="py-2 px-2">{t('pages.pilotageNational.colStatut', 'Statut')}</th>
            <th className="py-2 pl-2" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {groupes.map(g => (
            <>
              <tr key={`grp-${g.prefixe}`} className="bg-[#f0f4fd]">
                <td colSpan={7} className="py-1.5 px-3 text-xs font-bold text-[#15236e]">{g.nom}</td>
              </tr>
              {g.orgs.map(o => {
                const r = byId.get(o.id)!;
                return (
                  <tr
                    key={o.id}
                    onClick={() => onSelect?.(o.id)}
                    className={`border-b border-[#f2f3f7] ${onSelect ? 'cursor-pointer hover:bg-[#f8f9ff]' : ''} ${r.statut === 'non_evalue' ? 'opacity-60' : ''}`}
                  >
                    <td className="py-2 pr-3 font-medium text-[#171c22]">{o.nom}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{r.statut === 'non_evalue' ? '—' : (r.essentielsKoCount > 0 ? `🔴 ${r.essentielsKoCount}` : '0')}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{r.statut === 'non_evalue' ? '—' : r.actionsTotal}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{r.statut === 'non_evalue' ? '—' : r.actionsRetard}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{r.statut === 'non_evalue' ? '—' : r.actionsBloque}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUT_STYLE[r.statut]}`}>
                        {t(`pages.pilotageNational.statuts.${r.statut}`, STATUT_LABEL[r.statut])}
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-[#767682]">{onSelect ? '↗' : ''}</td>
                  </tr>
                );
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Note strict : `byId.get(o.id)!` est sûr (les groupes proviennent de `rows.map(r => r.org)`).

- [ ] **Step 4 : Lancer — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/watchlistFaritany.test.tsx`
Expected: PASS.

- [ ] **Step 5 : Typecheck + commit**

Run: `node node_modules/typescript/bin/tsc -b` → 0 erreur (corriger tout warning de clé `<>` en remplaçant le fragment par `<Fragment key=...>` importé de react si nécessaire).
```bash
git add src/components/dashboard/pilotage/WatchlistFaritany.tsx src/__tests__/watchlistFaritany.test.tsx
git commit -m "feat(pilotage): composant WatchlistFaritany (groupé province, statut, non évalué)"
```

---

### Task 7 : Composant `DrilldownFaritany` (national, lecture seule)

**Files:**
- Create: `src/components/dashboard/pilotage/DrilldownFaritany.tsx`
- Test: `src/__tests__/drilldownFaritany.test.tsx`

**Interfaces:**
- Produces:
```ts
export interface DrilldownData {
  nom: string;
  essentielsKO: { code: string; libelle: string }[];
  actionsRetard: number;
  actionsBloque: number;
}
export function DrilldownFaritany(props: { data: DrilldownData | null; onClose: () => void }): JSX.Element | null;
```

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/__tests__/drilldownFaritany.test.tsx` :
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrilldownFaritany } from '@/components/dashboard/pilotage/DrilldownFaritany';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }) }));

describe('DrilldownFaritany', () => {
  it('rend null si aucune donnée', () => {
    const { container } = render(<DrilldownFaritany data={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
  it('affiche le pourquoi : codes KO et résumé chiffré de la souffrance', () => {
    render(<DrilldownFaritany onClose={() => {}} data={{
      nom: 'Analamanga',
      essentielsKO: [{ code: 'F401', libelle: 'Assurance des membres' }],
      actionsRetard: 4,
      actionsBloque: 1,
    }} />);
    expect(screen.getByText('Analamanga')).toBeInTheDocument();
    expect(screen.getByText('F401 — Assurance des membres')).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/drilldownFaritany.test.tsx`
Expected: FAIL.

- [ ] **Step 3 : Implémenter**

Créer `src/components/dashboard/pilotage/DrilldownFaritany.tsx` :
```tsx
import { useTranslation } from 'react-i18next';

export interface DrilldownData {
  nom: string;
  essentielsKO: { code: string; libelle: string }[];
  actionsRetard: number;
  actionsBloque: number;
}

export function DrilldownFaritany({ data, onClose }: { data: DrilldownData | null; onClose: () => void }) {
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
          <p className="text-xs italic text-[#767682] mt-1">
            {t('pages.pilotageNational.drillPhase2', 'Détail par action et déclenchement de l’appui : Phase 2.')}
          </p>
        </section>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4 : Lancer — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/drilldownFaritany.test.tsx`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/components/dashboard/pilotage/DrilldownFaritany.tsx src/__tests__/drilldownFaritany.test.tsx
git commit -m "feat(pilotage): panneau DrilldownFaritany (lecture seule, le pourquoi)"
```

---

### Task 8 : Store + page cockpit national

**Files:**
- Create: `src/stores/pilotageNationalStore.ts`
- Create: `src/pages/dashboard/PilotageNationalPage.tsx`
- Test: `src/__tests__/pilotageNationalPage.test.tsx`

**Interfaces:**
- Consumes: `listOrganisations`, `getLibelleNiveauLocal` (`@/services/organisationService`), `getDashboardStatsByOrgIds` (`@/services/dashboardService`), `listActionAggByOrgIds` (`@/services/planActionService`), utils Task 2/3/6/7.
- Produces: `usePilotageNationalStore` (Zustand) exposant `{ rows: WatchlistRow[]; statsById: Record<string, DashboardStats>; buckets: Bucket2x2; niveauLabel?: string; nbEvalues: number; loading: boolean; error: string|null; load(osnId): Promise<void>; reset() }`.

- [ ] **Step 1 : Écrire le test qui échoue (page en état dégradé)**

Créer `src/__tests__/pilotageNationalPage.test.tsx` :
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }) }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ orgId: 'osn-1' }) }));
vi.mock('@/services/organisationService', () => ({
  listOrganisations: vi.fn().mockResolvedValue([{ id: 'f1', code: 'ANT-01', nom: 'Analamanga', type: 'ASN' }]),
  getLibelleNiveauLocal: vi.fn().mockResolvedValue('Faritany'),
}));
vi.mock('@/services/dashboardService', () => ({ getDashboardStatsByOrgIds: vi.fn().mockResolvedValue({}) }));
vi.mock('@/services/planActionService', () => ({ listActionAggByOrgIds: vi.fn().mockResolvedValue({}) }));

import { PilotageNationalPage } from '@/pages/dashboard/PilotageNationalPage';

describe('PilotageNationalPage (dégradation)', () => {
  beforeEach(() => vi.clearAllMocks());
  it('affiche « X évalués / N » et la ligne non évalué sans faux « tout va bien »', async () => {
    render(<PilotageNationalPage />);
    await waitFor(() => expect(screen.getByText('Analamanga')).toBeInTheDocument());
    // stats vides → Faritany non évalué
    expect(screen.getByText('non évalué')).toBeInTheDocument();
    expect(screen.getByText(/0.*\/.*1/)).toBeInTheDocument(); // « 0 évalués / 1 »
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageNationalPage.test.tsx`
Expected: FAIL — page introuvable.

- [ ] **Step 3 : Implémenter le store**

Créer `src/stores/pilotageNationalStore.ts` :
```ts
import { create } from 'zustand';
import { listOrganisations, getLibelleNiveauLocal } from '@/services/organisationService';
import { getDashboardStatsByOrgIds } from '@/services/dashboardService';
import { listActionAggByOrgIds } from '@/services/planActionService';
import { deriverStatutFaritany, bucketiser2x2, type Bucket2x2, type FaritanySignals } from '@/utils/pilotage';
import type { WatchlistRow } from '@/components/dashboard/pilotage/WatchlistFaritany';
import type { DashboardStats } from '@/types';

interface PilotageNationalState {
  rows: WatchlistRow[];
  statsById: Record<string, DashboardStats>;
  buckets: Bucket2x2;
  niveauLabel: string | undefined;
  nbEvalues: number;
  loading: boolean;
  error: string | null;
  load: (osnId: string) => Promise<void>;
  reset: () => void;
}

const EMPTY_BUCKETS: Bucket2x2 = { appuiUrgent: 0, conformite: 0, execution: 0, sain: 0, nonEvalue: 0 };

export const usePilotageNationalStore = create<PilotageNationalState>((set) => ({
  rows: [], statsById: {}, buckets: EMPTY_BUCKETS, niveauLabel: undefined, nbEvalues: 0, loading: false, error: null,

  load: async (osnId) => {
    set({ loading: true, error: null });
    try {
      const orgs = await listOrganisations('ASN', osnId);
      const ids = orgs.map(o => o.id);
      const [stats, aggs, niveauLabel] = await Promise.all([
        getDashboardStatsByOrgIds(ids),
        listActionAggByOrgIds(ids),
        getLibelleNiveauLocal(osnId).catch(() => null),
      ]);
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
        };
      });
      const signalsList: FaritanySignals[] = rows.map(r => ({
        evalue: r.statut !== 'non_evalue',
        essentielsKoCount: r.essentielsKoCount,
        actionsTotal: r.actionsTotal,
        actionsRetard: r.actionsRetard,
        actionsBloque: r.actionsBloque,
      }));
      set({
        rows,
        statsById: stats,
        buckets: bucketiser2x2(signalsList),
        niveauLabel: niveauLabel ?? undefined,
        nbEvalues: rows.filter(r => r.statut !== 'non_evalue').length,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  reset: () => set({ rows: [], statsById: {}, buckets: EMPTY_BUCKETS, niveauLabel: undefined, nbEvalues: 0, loading: false, error: null }),
}));
```

- [ ] **Step 4 : Implémenter la page**

Créer `src/pages/dashboard/PilotageNationalPage.tsx` :
```tsx
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { usePilotageNationalStore } from '@/stores/pilotageNationalStore';
import { Grille2x2 } from '@/components/dashboard/pilotage/Grille2x2';
import { WatchlistFaritany } from '@/components/dashboard/pilotage/WatchlistFaritany';
import { DrilldownFaritany, type DrilldownData } from '@/components/dashboard/pilotage/DrilldownFaritany';

export function PilotageNationalPage() {
  const { t } = useTranslation();
  const orgId = useAuthStore(s => s.orgId);
  const { rows, statsById, buckets, niveauLabel, nbEvalues, loading, error, load, reset } = usePilotageNationalStore();
  const [selection, setSelection] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    void load(orgId);
    return reset;
  }, [orgId, load, reset]);

  const drilldown: DrilldownData | null = useMemo(() => {
    if (!selection) return null;
    const r = rows.find(x => x.org.id === selection);
    if (!r) return null;
    return {
      nom: r.org.nom,
      essentielsKO: (statsById[selection]?.criteresEssentielsKO ?? []).map(code => ({ code, libelle: code })),
      actionsRetard: r.actionsRetard,
      actionsBloque: r.actionsBloque,
    };
  }, [selection, rows, statsById]);

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold tracking-widest text-[#454651] uppercase">{t('pages.pilotageNational.kicker', 'Cockpit décisionnel')}</span>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#15236e]">{t('pages.pilotageNational.title', 'Où concentrer l’appui')}</h1>
        <p className="text-[#454651] mt-1">
          {t('pages.pilotageNational.evalues', '{{n}} évalués / {{total}}', { n: nbEvalues, total: rows.length })}
        </p>
      </div>

      {error && <div className="p-4 bg-[#ffdad6] text-[#93000a] rounded-xl text-sm">{error}</div>}

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#454651] mb-4">{t('pages.pilotageNational.repartition', 'Répartition sévérité × exécution')}</h2>
        <Grille2x2 buckets={buckets} />
      </section>

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#454651] mb-4">{t('pages.pilotageNational.watchlist', 'Watchlist')}</h2>
        {loading && rows.length === 0 ? (
          <p className="text-sm text-[#767682]">{t('common.chargement', 'Chargement…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#767682]">{t('pages.pilotageNational.aucunFaritany', 'Aucun Faritany.')}</p>
        ) : (
          <WatchlistFaritany rows={rows} niveauLabel={niveauLabel} onSelect={setSelection} />
        )}
      </section>

      <DrilldownFaritany data={drilldown} onClose={() => setSelection(null)} />
    </div>
  );
}
```

- [ ] **Step 5 : Lancer — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageNationalPage.test.tsx`
Expected: PASS.

- [ ] **Step 6 : Typecheck + commit**

Run: `node node_modules/typescript/bin/tsc -b` → 0 erreur.
```bash
git add src/stores/pilotageNationalStore.ts src/pages/dashboard/PilotageNationalPage.tsx src/__tests__/pilotageNationalPage.test.tsx
git commit -m "feat(pilotage): cockpit national (store + page, dégradation honnête)"
```

---

### Task 9 : Composant `FilePriorites` (régional)

**Files:**
- Create: `src/components/dashboard/pilotage/FilePriorites.tsx`
- Test: `src/__tests__/filePriorites.test.tsx`

**Interfaces:**
- Consumes: `PrioriteItem` (Task 4).
- Produces: `export function FilePriorites(props: { items: PrioriteItem[]; evalue: boolean; actionsTerminees: number }): JSX.Element`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/__tests__/filePriorites.test.tsx` :
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FilePriorites } from '@/components/dashboard/pilotage/FilePriorites';
import type { PrioriteItem } from '@/utils/pilotage';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }) }));

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('FilePriorites', () => {
  it('non évalué → message dédié', () => {
    wrap(<FilePriorites items={[]} evalue={false} actionsTerminees={0} />);
    expect(screen.getByText(/Aucune évaluation en cours/)).toBeInTheDocument();
  });
  it('évalué et vide → « rien en attente » avec le nb terminées (pas « rien commencé »)', () => {
    wrap(<FilePriorites items={[]} evalue={true} actionsTerminees={4} />);
    expect(screen.getByText(/Aucune priorité/)).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });
  it('liste KO et actions', () => {
    const items: PrioriteItem[] = [
      { kind: 'essentiel_ko', code: 'F401', libelle: 'Assurance' },
      { kind: 'action', id: 'a1', titre: 'Recruter', statut: 'bloque', dateEcheance: '2026-05-01', priorite: 'haute' },
    ];
    wrap(<FilePriorites items={items} evalue={true} actionsTerminees={0} />);
    expect(screen.getByText('F401 — Assurance')).toBeInTheDocument();
    expect(screen.getByText('Recruter')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/filePriorites.test.tsx`
Expected: FAIL.

- [ ] **Step 3 : Implémenter**

Créer `src/components/dashboard/pilotage/FilePriorites.tsx` :
```tsx
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { PrioriteItem } from '@/utils/pilotage';

export function FilePriorites({ items, evalue, actionsTerminees }: { items: PrioriteItem[]; evalue: boolean; actionsTerminees: number }) {
  const { t } = useTranslation();

  if (!evalue) {
    return <p className="text-sm text-[#767682]">{t('pages.pilotageRegional.nonEvalue', 'Aucune évaluation en cours.')}</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-[#256a1c]">
        {t('pages.pilotageRegional.rienEnAttente', 'Aucune priorité en attente — {{n}} actions terminées.', { n: actionsTerminees })}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map(it => {
        if (it.kind === 'essentiel_ko') {
          return (
            <li key={`ko-${it.code}`} className="flex items-center gap-3 p-3 rounded-lg bg-[#fff5f5]">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a]">
                {t('pages.pilotageRegional.badgeKo', 'Essentiel KO')}
              </span>
              <span className="text-sm font-medium text-[#171c22]">{it.code} — {it.libelle}</span>
            </li>
          );
        }
        const badge = it.statut === 'bloque'
          ? { txt: t('pages.pilotageRegional.badgeBloque', 'Bloquée'), cls: 'bg-[#ffe6c0] text-[#8a5a00]' }
          : { txt: t('pages.pilotageRegional.badgeRetard', 'En retard'), cls: 'bg-[#ffdad6] text-[#ba1a1a]' };
        return (
          <li key={`ac-${it.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-[#f8f9ff]">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.txt}</span>
            <span className="text-sm font-medium text-[#171c22] flex-1">{it.titre}</span>
            <Link to="/action-plan" className="text-xs font-semibold text-[#15236e] hover:underline shrink-0">
              {t('pages.pilotageRegional.agir', 'Agir')} ↗
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4 : Lancer — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/filePriorites.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/components/dashboard/pilotage/FilePriorites.tsx src/__tests__/filePriorites.test.tsx
git commit -m "feat(pilotage): composant FilePriorites (KO+actions, états vides honnêtes)"
```

---

### Task 10 : Store + page cockpit régional

**Files:**
- Create: `src/stores/pilotageRegionalStore.ts`
- Create: `src/pages/dashboard/PilotageRegionalPage.tsx`
- Test: `src/__tests__/pilotageRegionalPage.test.tsx`

**Interfaces:**
- Consumes: `getDashboardStats` (`@/services/dashboardService`), `listPlansByOrg`, `listActions`, `estEnRetard` (`@/services/planActionService`), `ordonnerPrioritesRegionales` (Task 4).
- Produces: `usePilotageRegionalStore` exposant `{ items: PrioriteItem[]; evalue: boolean; actionsTerminees: number; koCount: number; retardCount: number; bloqueCount: number; loading: boolean; error: string|null; load(orgId): Promise<void>; reset() }`.

- [ ] **Step 1 : Écrire le test qui échoue (dégradation non évalué)**

Créer `src/__tests__/pilotageRegionalPage.test.tsx` :
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }) }));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ orgId: 'f1' }) }));
vi.mock('@/services/dashboardService', () => ({ getDashboardStats: vi.fn().mockResolvedValue(null) }));
vi.mock('@/services/planActionService', async () => ({
  listPlansByOrg: vi.fn().mockResolvedValue([]),
  listActions: vi.fn().mockResolvedValue([]),
  estEnRetard: (s: string, d: string | null, t: string) => !!d && s !== 'termine' && s !== 'bloque' && d.slice(0,10) < t,
}));

import { PilotageRegionalPage } from '@/pages/dashboard/PilotageRegionalPage';

describe('PilotageRegionalPage (dégradation)', () => {
  beforeEach(() => vi.clearAllMocks());
  it('non évalué → message dédié', async () => {
    render(<MemoryRouter><PilotageRegionalPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Aucune évaluation en cours/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageRegionalPage.test.tsx`
Expected: FAIL — page introuvable.

- [ ] **Step 3 : Implémenter le store**

Créer `src/stores/pilotageRegionalStore.ts` :
```ts
import { create } from 'zustand';
import { getDashboardStats } from '@/services/dashboardService';
import { listPlansByOrg, listActions, estEnRetard } from '@/services/planActionService';
import { ordonnerPrioritesRegionales, type PrioriteItem } from '@/utils/pilotage';
import type { Action } from '@/types';

interface PilotageRegionalState {
  items: PrioriteItem[];
  evalue: boolean;
  actionsTerminees: number;
  koCount: number;
  retardCount: number;
  bloqueCount: number;
  loading: boolean;
  error: string | null;
  load: (orgId: string) => Promise<void>;
  reset: () => void;
}

const INITIAL = { items: [] as PrioriteItem[], evalue: false, actionsTerminees: 0, koCount: 0, retardCount: 0, bloqueCount: 0 };

export const usePilotageRegionalStore = create<PilotageRegionalState>((set) => ({
  ...INITIAL, loading: false, error: null,

  load: async (orgId) => {
    set({ loading: true, error: null });
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [stats, plans] = await Promise.all([
        getDashboardStats(orgId),
        listPlansByOrg(orgId).catch(() => []),
      ]);
      const planRecent = [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const actions: Action[] = planRecent ? await listActions(planRecent.id).catch(() => []) : [];

      const koItems: PrioriteItem[] = (stats?.criteresEssentielsKO ?? []).map(code => ({
        kind: 'essentiel_ko', code, libelle: code,
      }));
      const actionItems: PrioriteItem[] = actions
        .filter(a => a.statut === 'bloque' || estEnRetard(a.statut, a.dateEcheance, today))
        .map(a => ({ kind: 'action', id: a.id, titre: a.objectif || a.description, statut: a.statut, dateEcheance: a.dateEcheance, priorite: a.priorite }));

      const items = ordonnerPrioritesRegionales([...koItems, ...actionItems]);
      set({
        items,
        evalue: stats != null,
        actionsTerminees: actions.filter(a => a.statut === 'termine').length,
        koCount: koItems.length,
        retardCount: actionItems.filter(i => i.kind === 'action' && i.statut !== 'bloque').length,
        bloqueCount: actionItems.filter(i => i.kind === 'action' && i.statut === 'bloque').length,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  reset: () => set({ ...INITIAL, loading: false, error: null }),
}));
```

Note : `titre` d'action = `objectif` (fallback `description`) — voir type `Action`.

- [ ] **Step 4 : Implémenter la page**

Créer `src/pages/dashboard/PilotageRegionalPage.tsx` :
```tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { usePilotageRegionalStore } from '@/stores/pilotageRegionalStore';
import { KpiStrip, type KpiItem } from '@/components/dashboard/KpiStrip';
import { FilePriorites } from '@/components/dashboard/pilotage/FilePriorites';

export function PilotageRegionalPage() {
  const { t } = useTranslation();
  const orgId = useAuthStore(s => s.orgId);
  const { items, evalue, actionsTerminees, koCount, retardCount, bloqueCount, loading, error, load, reset } = usePilotageRegionalStore();

  useEffect(() => {
    if (!orgId) return;
    void load(orgId);
    return reset;
  }, [orgId, load, reset]);

  const kpis: KpiItem[] = [
    { label: t('pages.pilotageRegional.koLabel', 'Essentiels KO'), value: koCount, variant: koCount > 0 ? 'danger' : 'success' },
    { label: t('pages.pilotageRegional.retardLabel', 'Actions en retard'), value: retardCount, variant: retardCount > 0 ? 'warning' : 'default' },
    { label: t('pages.pilotageRegional.bloqueLabel', 'Actions bloquées'), value: bloqueCount, variant: bloqueCount > 0 ? 'danger' : 'default' },
    { label: t('pages.pilotageRegional.termineesLabel', 'Terminées'), value: actionsTerminees, variant: 'default' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold tracking-widest text-[#454651] uppercase">{t('pages.pilotageRegional.kicker', 'Cockpit décisionnel')}</span>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#15236e]">{t('pages.pilotageRegional.title', 'Mes priorités d’action')}</h1>
      </div>

      {error && <div className="p-4 bg-[#ffdad6] text-[#93000a] rounded-xl text-sm">{error}</div>}

      <KpiStrip kpis={kpis} loading={loading && !evalue && items.length === 0} />

      <section className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#454651] mb-4">{t('pages.pilotageRegional.file', 'File de priorités')}</h2>
        <FilePriorites items={items} evalue={evalue} actionsTerminees={actionsTerminees} />
      </section>
    </div>
  );
}
```

- [ ] **Step 5 : Lancer — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageRegionalPage.test.tsx`
Expected: PASS.

- [ ] **Step 6 : Typecheck + commit**

Run: `node node_modules/typescript/bin/tsc -b` → 0 erreur.
```bash
git add src/stores/pilotageRegionalStore.ts src/pages/dashboard/PilotageRegionalPage.tsx src/__tests__/pilotageRegionalPage.test.tsx
git commit -m "feat(pilotage): cockpit régional (store + page, file de priorités)"
```

---

### Task 11 : Routes, RoleGuard, nav Sidebar, i18n

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/i18n/fr.ts`, `src/i18n/en.ts`
- Test: `src/__tests__/pilotageRoutes.test.tsx`

**Interfaces:**
- Consumes: `PilotageNationalPage`, `PilotageRegionalPage` (Task 8/10), `RoleGuard`.

- [ ] **Step 1 : Écrire le test qui échoue (route protégée)**

Créer `src/__tests__/pilotageRoutes.test.tsx` :
```tsx
import { describe, it, expect } from 'vitest';
import { router } from '@/router';

function paths(routes: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const r of routes as { path?: string; children?: unknown[] }[]) {
    if (r.path) out.push(r.path);
    if (r.children) out.push(...paths(r.children));
  }
  return out;
}

describe('routes pilotage', () => {
  it('déclare les deux cockpits', () => {
    const all = paths(router.routes);
    expect(all).toContain('dashboard/pilotage-national');
    expect(all).toContain('dashboard/pilotage-regional');
  });
});
```

- [ ] **Step 2 : Lancer — échoue**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageRoutes.test.tsx`
Expected: FAIL — routes absentes.

- [ ] **Step 3 : Ajouter les routes (`src/router.tsx`)**

Après la déclaration de `IndiceDeploiementPage` (~l.27), ajouter les lazy :
```tsx
const PilotageNationalPage = lazy(() =>
  import('@/pages/dashboard/PilotageNationalPage').then(m => ({ default: m.PilotageNationalPage }))
)
const PilotageRegionalPage = lazy(() =>
  import('@/pages/dashboard/PilotageRegionalPage').then(m => ({ default: m.PilotageRegionalPage }))
)
```
Après `const LazyIndice = withSuspense(IndiceDeploiementPage)` (~l.115), ajouter :
```tsx
const LazyPilotageNational = withSuspense(PilotageNationalPage)
const LazyPilotageRegional = withSuspense(PilotageRegionalPage)
```
Dans les `children` du layout, après la route `dashboard/indice` (~l.167), ajouter :
```tsx
      {
        path: 'dashboard/pilotage-national',
        element: <RoleGuard roles={['admin_global', 'responsable_osn', 'responsable_region']}><LazyPilotageNational /></RoleGuard>,
      },
      {
        path: 'dashboard/pilotage-regional',
        element: <LazyPilotageRegional />,
      },
```

- [ ] **Step 4 : Ajouter la section nav (`src/components/layout/Sidebar.tsx`)**

Après la déclaration de `NAV_ITEMS` (~l.21), ajouter :
```tsx
const PILOTAGE_ITEMS: NavItem[] = [
  { to: '/dashboard/pilotage-regional', icon: 'flag',        labelKey: 'nav.pilotageRegional' },
  { to: '/dashboard/pilotage-national', icon: 'hub',         labelKey: 'nav.pilotageNational', roles: ['admin_global', 'responsable_osn', 'responsable_region'] },
]
```
Dans le corps de `Sidebar`, après `visibleAdminItems` :
```tsx
  const visiblePilotageItems = PILOTAGE_ITEMS.filter(
    item => !item.roles || (role && item.roles.includes(role))
  )
```
Dans le JSX, juste après le bloc `{visibleAdminItems.length > 0 && (...)}` et avant la section AI, insérer :
```tsx
        {visiblePilotageItems.length > 0 && (
          <>
            <div className="my-3 mx-4" aria-hidden="true">
              <div className="h-px bg-gradient-to-r from-transparent via-wosm-purple-muted to-transparent" />
            </div>
            <SectionLabel>{t('nav.groupPilotage')}</SectionLabel>
            {visiblePilotageItems.map((item) => (
              <SideNavLink key={item.to} item={item} />
            ))}
          </>
        )}
```

- [ ] **Step 5 : Ajouter les clés i18n**

Dans `src/i18n/fr.ts`, sous l'objet `nav:` ajouter les 3 clés :
```ts
    groupPilotage: 'Pilotage',
    pilotageNational: 'Cockpit national',
    pilotageRegional: 'Cockpit régional',
```
Toujours dans `src/i18n/fr.ts`, sous l'objet `pages:` ajouter les deux sous-objets :
```ts
    pilotageNational: {
      kicker: 'Cockpit décisionnel',
      title: 'Où concentrer l’appui',
      evalues: '{{n}} évalués / {{total}}',
      repartition: 'Répartition sévérité × exécution',
      watchlist: 'Watchlist des Faritany',
      aucunFaritany: 'Aucun Faritany.',
      colFaritany: 'Faritany', colKo: 'Essentiels KO', colTotal: 'Actions',
      colRetard: 'Retard', colBloque: 'Bloquées', colStatut: 'Statut',
      statuts: { non_evalue: 'non évalué', rien_demarre: 'rien démarré', en_souffrance: 'en souffrance', sous_controle: 'sous contrôle' },
      cases: { appuiUrgent: 'Appui urgent', conformite: 'Conformité à traiter', execution: 'Exécution en souffrance', sain: 'Sous contrôle' },
      drillKo: 'Essentiels non conformes', drillAucunKo: 'Aucun essentiel KO.',
      drillActions: 'Actions en souffrance', drillResume: '{{retard}} en retard · {{bloque}} bloquées', drillPhase2: 'Détail par action et déclenchement de l’appui : Phase 2.',
    },
    pilotageRegional: {
      kicker: 'Cockpit décisionnel',
      title: 'Mes priorités d’action',
      file: 'File de priorités',
      nonEvalue: 'Aucune évaluation en cours.',
      rienEnAttente: 'Aucune priorité en attente — {{n}} actions terminées.',
      badgeKo: 'Essentiel KO', badgeBloque: 'Bloquée', badgeRetard: 'En retard', agir: 'Agir',
      koLabel: 'Essentiels KO', retardLabel: 'Actions en retard', bloqueLabel: 'Actions bloquées', termineesLabel: 'Terminées',
    },
```
Répliquer les MÊMES clés dans `src/i18n/en.ts` (traductions anglaises : « Where to focus support », « My action priorities », « not evaluated », « nothing started », « struggling », « under control », etc.). Structure identique, valeurs traduites.

- [ ] **Step 6 : Lancer le test de routes — passe**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/pilotageRoutes.test.tsx`
Expected: PASS.

- [ ] **Step 7 : Gate complet (typecheck + build + suite)**

Run: `node node_modules/typescript/bin/tsc -b`
Expected: 0 erreur.
Run: `node node_modules/vite/bin/vite.js build`
Expected: build OK (nouveaux chunks Pilotage*).
Run: `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'`
Expected: suite verte (tous les tests pilotage + non-régression).

- [ ] **Step 8 : Commit**

```bash
git add src/router.tsx src/components/layout/Sidebar.tsx src/i18n/fr.ts src/i18n/en.ts src/__tests__/pilotageRoutes.test.tsx
git commit -m "feat(pilotage): routes + nav + i18n des deux cockpits"
```

---

## Déploiement (après validation locale)

Phase 1 = frontend seul, zéro migration. Déployer comme d'habitude : `node node_modules/vite/bin/vite.js build` → rsync `dist/` → `/var/www/gsat-frontend/` (backup préalable), via SSH natif `~/.ssh/id_ed25519` root@76.13.37.209 (WARP off). Vérifier live `gsat.tily-digital.com` (HTTP 200 + hash bundle). Vérifier le rendu réel une fois le pilote seedé.

## Self-review (couverture spec)

- §3 Cockpit national : bandeau (Task 8), grille 2×2 (Task 3+5), watchlist statut/tri/province (Task 2+6), drill-down lecture (Task 7). ⚠️ Phase 1 = codes KO + résumé chiffré de souffrance ; détail par action + capture d'appui = Phase 2 (documenté).
- §4 Cockpit régional : file KO+actions, ordre, liens profonds, badge (Task 4+9+10). ⚠️ Badge « national » = Phase 2 (colonne `origine` inexistante en Phase 1) — hors périmètre Phase 1, documenté.
- §5 Phase 1 données : extension `actionsRetard` (Task 1), lectures existantes réutilisées. ✅
- §6 Dégradation pilote : « X évalués / N », ligne non évalué, états vides distinguant tout-fait/rien-commencé (Task 6, 8, 9, 10). ✅
- §7 Tests : utils purs (Task 2-4), estEnRetard (Task 1), RTL composants + pages + routes (Task 5-11). ✅ (RLS = Phase 2.)
- §8 Phasage : ce plan = Phase 1 uniquement ; Phase 2 (migration + capture) → plan séparé. ✅
