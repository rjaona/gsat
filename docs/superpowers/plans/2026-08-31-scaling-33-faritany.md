# Mise à l'échelle GSAT — 33 Faritany

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préparer GSAT pour l'usage terrain simultané de 33 Faritany (debounce écriture scores, suppression channels Realtime globaux, backup cron automatisé, index composite).

**Architecture:** 4 changements chirurgicaux indépendants. Le debounce est dans le store Zustand (pas le service). Les channels Realtime globaux sont remplacés par des refetch à l'entrée de page. Le backup est un script ops VPS. L'index est une migration SQL.

**Tech Stack:** React 19, Zustand 5, Supabase JS v2, PostgreSQL 17, Bash (VPS)

## Global Constraints

- Build : `node node_modules/typescript/bin/tsc -b` (PAS `-p`, PAS `.bin/tsc` sur /mnt/d)
- Tests : `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'` — actuellement 382 verts
- i18n : `src/i18n/fr.ts` et `src/i18n/en.ts` (PAS .json, mg absent = fallback fr)
- Repo sur /mnt/d (OneDrive) : utiliser `sed -i` ou `cat heredoc` via Bash pour les fichiers sensibles, jamais Edit/Write si réversion observée
- Ne JAMAIS `supabase db push` contre la prod

---

### Task 1: Index composite `evaluations(campagne_id, org_id)`

**Files:**
- Create: `supabase/migrations/20260831_index_eval_campagne_org.sql`

**Interfaces:**
- Consumes: rien
- Produces: index DB `idx_eval_campagne_org` (transparent pour le code applicatif)

- [ ] **Step 1: Créer la migration**

```sql
-- supabase/migrations/20260831_index_eval_campagne_org.sql
-- Index composite pour le pattern de requête Faritany :
-- WHERE campagne_id = ? AND org_id = ?
-- CONCURRENTLY pour ne pas bloquer les écritures en prod.
-- ⚠️ CONCURRENTLY ne fonctionne pas dans une transaction —
-- appliquer via psql direct (pas ON_ERROR_STOP wrapper).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eval_campagne_org
  ON evaluations(campagne_id, org_id);
```

- [ ] **Step 2: Vérifier tsc + tests**

Run: `cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts' 2>&1 | tail -5`
Expected: tsc clean, 382 tests pass

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260831_index_eval_campagne_org.sql
git commit -m "perf(db): index composite evaluations(campagne_id, org_id)"
```

---

### Task 2: Backup cron automatisé (runbook + script)

**Files:**
- Create: `docs/superpowers/runbooks/2026-08-31-backup-cron.md`

**Interfaces:**
- Consumes: rien (ops VPS uniquement)
- Produces: runbook documentant le script `/root/gsat_backup.sh` + crontab

- [ ] **Step 1: Écrire le runbook avec le script embarqué**

```markdown
# Backup cron GSAT — Runbook d'installation

## Script `/root/gsat_backup.sh`

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/root/gsat_backups"
DAILY_DIR="$BACKUP_DIR/daily"
MONTHLY_DIR="$BACKUP_DIR/monthly"
LOG="$BACKUP_DIR/backup.log"
CONTAINER="supabase_db_gsat"
DATE=$(date +%Y%m%d_%H%M%S)
DAY_OF_MONTH=$(date +%d)

mkdir -p "$DAILY_DIR" "$MONTHLY_DIR"

DUMP_FILE="$DAILY_DIR/gsat_${DATE}.dump"

echo -n "[$(date -Iseconds)] Backup... " >> "$LOG"

if docker exec "$CONTAINER" pg_dump -U postgres -Fc postgres > "$DUMP_FILE" 2>>"$LOG"; then
  chmod 0600 "$DUMP_FILE"
  SIZE=$(stat -c%s "$DUMP_FILE")
  if [ "$SIZE" -lt 1024 ]; then
    echo "FAILED (dump ${SIZE}B < 1KB)" >> "$LOG"
    exit 1
  fi
  echo "OK (${SIZE}B) -> $(basename "$DUMP_FILE")" >> "$LOG"

  # Copie mensuelle le 1er du mois
  if [ "$DAY_OF_MONTH" = "01" ]; then
    cp "$DUMP_FILE" "$MONTHLY_DIR/"
    echo "[$(date -Iseconds)] Monthly copy -> monthly/$(basename "$DUMP_FILE")" >> "$LOG"
  fi

  # Rotation : daily > 7 jours, monthly > 90 jours
  find "$DAILY_DIR" -name "gsat_*.dump" -mtime +7 -delete
  find "$MONTHLY_DIR" -name "gsat_*.dump" -mtime +90 -delete
else
  echo "FAILED (pg_dump exit $?)" >> "$LOG"
  rm -f "$DUMP_FILE"
  exit 1
fi
```

## Installation

```bash
# 1. Copier le script
cat > /root/gsat_backup.sh << 'SCRIPT'
# (coller le contenu ci-dessus)
SCRIPT
chmod +x /root/gsat_backup.sh

# 2. Créer les répertoires
mkdir -p /root/gsat_backups/{daily,monthly}

# 3. Ajouter au crontab root
(crontab -l 2>/dev/null; echo "0 3 * * * /root/gsat_backup.sh") | crontab -

# 4. Test manuel
/root/gsat_backup.sh && cat /root/gsat_backups/backup.log

# 5. Vérifier le dump
pg_restore --list /root/gsat_backups/daily/gsat_*.dump | head -20
```

## Restauration

```bash
# Restaurer un dump (ATTENTION : écrase la base)
docker exec -i supabase_db_gsat pg_restore -U postgres -d postgres --clean --if-exists < /root/gsat_backups/daily/gsat_YYYYMMDD_HHMMSS.dump
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/2026-08-31-backup-cron.md
git commit -m "docs(ops): runbook backup cron GSAT quotidien + mensuel"
```

---

### Task 3: Supprimer les 3 channels Realtime globaux

**Files:**
- Modify: `src/services/evaluationService.ts:178-195` — remplacer `subscribeAllEvaluations` par `listAllEvaluations`
- Modify: `src/services/campagneService.ts:71-86` — supprimer `subscribeCampagnes`, garder `listCampagnes`
- Modify: `src/services/organisationService.ts:82-101` — supprimer `subscribeOrganisations`, garder `listOrganisations`
- Modify: `src/pages/evaluation/EvaluationListPage.tsx:108-120` — remplacer `subscribeAllEvaluations` par `listAllEvaluations`
- Modify: `src/stores/campagneStore.ts:50-58` — remplacer `subscribeCampagnes` par `listCampagnes` direct
- Modify: `src/components/admin/organisations/OrganisationsPage.tsx:18-31` — remplacer `subscribeOrganisations` par `listOrganisations`
- Test: `src/__tests__/realtimeChannels.test.ts` (nouveau)

**Interfaces:**
- Consumes: `listCampagnes`, `listOrganisations`, `listEvaluationsByOrg` (existants)
- Produces: `listAllEvaluations` (nouveau, remplace `subscribeAllEvaluations`)

- [ ] **Step 1: Écrire le test de non-régression**

Créer `src/__tests__/realtimeChannels.test.ts` — vérifie qu'aucun des 3 channels globaux n'est importé/utilisé dans le code :

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();

const readSrc = (path: string) =>
  readFileSync(resolve(ROOT, path), 'utf8');

describe('Channels Realtime globaux supprimés (scaling)', () => {
  it('evaluationService ne contient plus subscribeAllEvaluations', () => {
    const src = readSrc('src/services/evaluationService.ts');
    expect(src).not.toMatch(/channel\(['"]evaluations-all['"]\)/);
    expect(src).not.toMatch(/export function subscribeAllEvaluations/);
  });

  it('campagneService ne contient plus le channel campagnes-realtime', () => {
    const src = readSrc('src/services/campagneService.ts');
    expect(src).not.toMatch(/channel\(['"]campagnes-realtime['"]\)/);
  });

  it('organisationService ne contient plus le channel organisations-realtime', () => {
    const src = readSrc('src/services/organisationService.ts');
    expect(src).not.toMatch(/channel\(['"]organisations-realtime['"]\)/);
  });

  it('EvaluationListPage n importe plus subscribeAllEvaluations', () => {
    const src = readSrc('src/pages/evaluation/EvaluationListPage.tsx');
    expect(src).not.toMatch(/subscribeAllEvaluations/);
  });
});
```

- [ ] **Step 2: Vérifier que le test échoue (les channels existent encore)**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/realtimeChannels.test.ts`
Expected: 4 FAIL

- [ ] **Step 3: Remplacer `subscribeAllEvaluations` par `listAllEvaluations` dans evaluationService.ts**

Supprimer la fonction `subscribeAllEvaluations` (lignes 178-195) et la remplacer par :

```typescript
export async function listAllEvaluations(): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from('evaluations').select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => rowToEval(r as Record<string, unknown>));
}
```

- [ ] **Step 4: Mettre à jour EvaluationListPage.tsx — remplacer subscription par fetch**

Remplacer l'import `subscribeAllEvaluations` par `listAllEvaluations`. Remplacer le bloc useEffect (lignes 102-120) :

```typescript
  // Fetch evaluations based on role (no global realtime — scaling)
  useEffect(() => {
    setLoading(true)
    setError(null)

    const isOrgScoped = role === 'utilisateur_asn' || role === 'responsable_osn'

    const doFetch = isOrgScoped && orgId
      ? () => listEvaluationsByOrg(orgId)
      : () => listAllEvaluations()

    doFetch()
      .then(evals => { setEvaluations(evals); setLoading(false) })
      .catch(err => { setError((err as Error).message); setLoading(false) })
  }, [role, orgId])
```

Le `return unsub` de cleanup n'est plus nécessaire — plus de subscription à démonter.

- [ ] **Step 5: Supprimer `subscribeCampagnes` de campagneService.ts**

Supprimer la fonction `subscribeCampagnes` (lignes 71-86). `listCampagnes` (lignes 60-67) reste inchangée. `subscribeCampagnesOrganisateur` (ligne 88+) reste aussi inchangée (elle est filtrée par organisateur).

- [ ] **Step 6: Mettre à jour campagneStore.ts — remplacer subscribe par fetch**

Remplacer la méthode `subscribe` du store :

```typescript
  subscribe: async (filtreStatut?: CampagneStatut) => {
    set({ loading: true, error: null });
    try {
      const campagnes = await listCampagnes(filtreStatut);
      set({ campagnes, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
    // Retourne un no-op pour compatibilité avec les useEffect existants
    return () => {};
  },
```

Mettre à jour l'import : remplacer `subscribeCampagnes` par `listCampagnes` (si pas déjà importé).

- [ ] **Step 7: Supprimer `subscribeOrganisations` de organisationService.ts**

Supprimer la fonction `subscribeOrganisations` (lignes 82-101). `listOrganisations` (ligne 70) reste inchangée.

- [ ] **Step 8: Mettre à jour OrganisationsPage.tsx — remplacer subscription par fetch**

Remplacer l'import `subscribeOrganisations` par `listOrganisations`. Remplacer le useEffect :

```typescript
  useEffect(() => {
    setLoading(true);
    listOrganisations()
      .then(orgs => {
        setOrganisations(orgs);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);
```

- [ ] **Step 9: Vérifier que le test passe + tsc + suite complète**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts' 2>&1 | tail -5`
Expected: tsc clean, tous tests verts (incluant le nouveau `realtimeChannels.test.ts`)

- [ ] **Step 10: Commit**

```bash
git add src/services/evaluationService.ts src/services/campagneService.ts \
  src/services/organisationService.ts src/pages/evaluation/EvaluationListPage.tsx \
  src/stores/campagneStore.ts src/components/admin/organisations/OrganisationsPage.tsx \
  src/__tests__/realtimeChannels.test.ts
git commit -m "perf(realtime): supprime 3 channels globaux non filtrés (scaling 33 Faritany)"
```

---

### Task 4: Debounce `writeScore` 800ms

**Files:**
- Create: `src/utils/debouncedScoreWriter.ts` — logique debounce pure, testable isolément
- Modify: `src/stores/evaluationStore.ts:211-252` — intégrer le debounce dans `saveScore`
- Modify: `src/components/ui/SaveStatusIndicator.tsx` — ajouter état `pending`
- Modify: `src/i18n/fr.ts:253` — ajouter clé `pending`
- Modify: `src/i18n/en.ts:253` — ajouter clé `pending`
- Test: `src/__tests__/debouncedScoreWriter.test.ts` (nouveau)

**Interfaces:**
- Consumes: `writeScore` de `evaluationService.ts` (inchangé)
- Produces: `DebouncedScoreWriter` — `{ schedule(evalId, score, updatedBy): void; flush(): Promise<void>; status: 'idle' | 'pending' | 'saving' | 'saved' | 'error' }`

- [ ] **Step 1: Écrire les tests du debounce**

Créer `src/__tests__/debouncedScoreWriter.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedScoreWriter } from '../utils/debouncedScoreWriter';

describe('createDebouncedScoreWriter', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('retarde l appel de 800ms', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    writer.schedule('eval1', { critereCode: 'C01', note: 2 }, 'user1');
    expect(writeFn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();
    expect(writeFn).toHaveBeenCalledOnce();
    expect(writeFn).toHaveBeenCalledWith('eval1', { critereCode: 'C01', note: 2 }, 'user1');
  });

  it('le dernier clic dans la fenêtre gagne', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    writer.schedule('eval1', { critereCode: 'C01', note: 1 }, 'user1');
    vi.advanceTimersByTime(300);
    writer.schedule('eval1', { critereCode: 'C01', note: 3 }, 'user1');
    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(writeFn).toHaveBeenCalledOnce();
    expect(writeFn).toHaveBeenCalledWith('eval1', { critereCode: 'C01', note: 3 }, 'user1');
  });

  it('critères différents sont indépendants', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    writer.schedule('eval1', { critereCode: 'C01', note: 1 }, 'user1');
    writer.schedule('eval1', { critereCode: 'C02', note: 2 }, 'user1');
    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(writeFn).toHaveBeenCalledTimes(2);
  });

  it('flush envoie immédiatement sans attendre le timer', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    writer.schedule('eval1', { critereCode: 'C01', note: 2 }, 'user1');
    expect(writeFn).not.toHaveBeenCalled();

    await writer.flush();
    expect(writeFn).toHaveBeenCalledOnce();
  });

  it('flush est un no-op si rien en attente', async () => {
    const writeFn = vi.fn().mockResolvedValue(undefined);
    const writer = createDebouncedScoreWriter(writeFn);

    await writer.flush();
    expect(writeFn).not.toHaveBeenCalled();
  });

  it('status passe de idle à pending puis saving puis saved', async () => {
    let resolveWrite!: () => void;
    const writeFn = vi.fn().mockImplementation(
      () => new Promise<void>(r => { resolveWrite = r; })
    );
    const writer = createDebouncedScoreWriter(writeFn);

    expect(writer.getStatus()).toBe('idle');

    writer.schedule('eval1', { critereCode: 'C01', note: 2 }, 'user1');
    expect(writer.getStatus()).toBe('pending');

    vi.advanceTimersByTime(800);
    // Le timer a fire, writeFn est appelée (promise en attente)
    await vi.advanceTimersByTimeAsync(0);
    expect(writer.getStatus()).toBe('saving');

    resolveWrite();
    await vi.advanceTimersByTimeAsync(0);
    expect(writer.getStatus()).toBe('saved');
  });

  it('status passe à error si writeScore échoue', async () => {
    const writeFn = vi.fn().mockRejectedValue(new Error('DB down'));
    const onError = vi.fn();
    const writer = createDebouncedScoreWriter(writeFn, onError);

    writer.schedule('eval1', { critereCode: 'C01', note: 2 }, 'user1');
    vi.advanceTimersByTime(800);
    await vi.runAllTimersAsync();

    expect(writer.getStatus()).toBe('error');
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/debouncedScoreWriter.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implémenter `createDebouncedScoreWriter`**

Créer `src/utils/debouncedScoreWriter.ts` :

```typescript
type ScoreInput = { critereCode: string; note?: 0 | 1 | 2 | 3 | null | undefined; commentaire?: string };
type WriteFn = (evalId: string, score: ScoreInput, updatedBy: string) => Promise<void>;
type Status = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 800;

export function createDebouncedScoreWriter(
  writeFn: WriteFn,
  onError?: (err: Error) => void,
) {
  // Pending writes keyed by critereCode
  const pending = new Map<string, { evalId: string; score: ScoreInput; updatedBy: string; timer: ReturnType<typeof setTimeout> }>();
  let status: Status = 'idle';
  let statusListeners: Array<(s: Status) => void> = [];

  function setStatus(s: Status) {
    status = s;
    statusListeners.forEach(fn => fn(s));
  }

  async function doWrite(evalId: string, score: ScoreInput, updatedBy: string) {
    setStatus('saving');
    try {
      await writeFn(evalId, score, updatedBy);
      // Only set saved if nothing else is pending
      if (pending.size === 0) setStatus('saved');
    } catch (err) {
      setStatus('error');
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  return {
    schedule(evalId: string, score: ScoreInput, updatedBy: string) {
      const key = score.critereCode;
      const existing = pending.get(key);
      if (existing) clearTimeout(existing.timer);

      const timer = setTimeout(() => {
        pending.delete(key);
        void doWrite(evalId, score, updatedBy);
      }, DEBOUNCE_MS);

      pending.set(key, { evalId, score, updatedBy, timer });
      setStatus('pending');
    },

    async flush(): Promise<void> {
      const entries = Array.from(pending.values());
      pending.forEach(e => clearTimeout(e.timer));
      pending.clear();
      if (entries.length === 0) return;
      await Promise.all(entries.map(e => doWrite(e.evalId, e.score, e.updatedBy)));
    },

    getStatus(): Status { return status; },

    onStatusChange(fn: (s: Status) => void): () => void {
      statusListeners.push(fn);
      return () => { statusListeners = statusListeners.filter(f => f !== fn); };
    },

    destroy() {
      pending.forEach(e => clearTimeout(e.timer));
      pending.clear();
      statusListeners = [];
    },
  };
}
```

- [ ] **Step 4: Vérifier que les tests du debounce passent**

Run: `node node_modules/vitest/vitest.mjs run src/__tests__/debouncedScoreWriter.test.ts`
Expected: 7 PASS

- [ ] **Step 5: Ajouter la clé i18n `pending`**

Dans `src/i18n/fr.ts` ligne 253, remplacer :
```typescript
    reseau: { saved: 'Enregistré', saving: 'Envoi…', error: 'Échec', retry: 'Réessayer' },
```
par :
```typescript
    reseau: { saved: 'Enregistré', saving: 'Envoi…', pending: 'En attente…', error: 'Échec', retry: 'Réessayer' },
```

Dans `src/i18n/en.ts` ligne 253, remplacer :
```typescript
    reseau: { saved: 'Saved', saving: 'Saving…', error: 'Failed', retry: 'Retry' },
```
par :
```typescript
    reseau: { saved: 'Saved', saving: 'Saving…', pending: 'Pending…', error: 'Failed', retry: 'Retry' },
```

- [ ] **Step 6: Ajouter l'état `pending` à SaveStatusIndicator**

Modifier `src/components/ui/SaveStatusIndicator.tsx` :

Changer le type :
```typescript
export type SaveStatus = 'saved' | 'saving' | 'pending' | 'error'
```

Ajouter dans `STYLE` :
```typescript
const STYLE: Record<SaveStatus, { icon: string; color: string; bg: string; spin?: boolean }> = {
  saved:   { icon: 'cloud_done',  color: 'var(--success)', bg: 'var(--success-light)' },
  saving:  { icon: 'cloud_sync',  color: 'var(--primary)', bg: 'var(--primary-light)', spin: true },
  pending: { icon: 'schedule',    color: 'var(--warning)', bg: 'var(--warning-light)' },
  error:   { icon: 'cloud_off',   color: 'var(--danger)',  bg: 'var(--danger-light)' },
}
```

- [ ] **Step 7: Intégrer le debounce dans evaluationStore**

Modifier `src/stores/evaluationStore.ts` :

Ajouter en haut du fichier (après les imports) :
```typescript
import { createDebouncedScoreWriter } from '../utils/debouncedScoreWriter';
import { writeScore } from '../services/evaluationService';

// Singleton — un seul writer pour toute l'app
let _scoreWriter: ReturnType<typeof createDebouncedScoreWriter> | null = null;

function getScoreWriter(onError: (err: Error) => void) {
  if (!_scoreWriter) {
    _scoreWriter = createDebouncedScoreWriter(writeScore, onError);
  }
  return _scoreWriter;
}
```

Remplacer la méthode `saveScore` (lignes 211-252) :

```typescript
  saveScore: async (score: ScoreInput, updatedBy: string) => {
    const { evaluation } = get();
    if (!evaluation) throw new Error('Aucune évaluation chargée');

    // Optimistic update local immédiat (avant le debounce)
    set(state => {
      const newScores = { ...state.scores };
      if (score.note === undefined && !score.commentaire) {
        delete newScores[score.critereCode];
      } else {
        newScores[score.critereCode] = {
          critereCode: score.critereCode,
          note: score.note ?? null,
          ...(score.commentaire !== undefined ? { commentaire: score.commentaire } : {}),
          updatedBy,
          updatedAt: new Date().toISOString(),
        };
      }
      const ref = state.referentielCourant;
      return {
        scores: newScores,
        nbCriteresRenseignes: ref
          ? calculerAvancement(scoresToMap(newScores), ref, state.campagneMode).repondus
          : state.nbCriteresRenseignes,
        criteresKO: ref ? computeKO(newScores, ref, state.campagneMode) : state.criteresKO,
      };
    });

    // Debounce l'écriture réseau (800ms)
    const writer = getScoreWriter(err => set({ error: err.message }));
    writer.schedule(evaluation.id, score, updatedBy);
  },
```

Ajouter dans `clearEvaluation` : le flush avant nettoyage :
```typescript
  clearEvaluation: () => {
    // Flush les écritures en attente avant de quitter l'évaluation
    _scoreWriter?.flush();
    set({ evaluation: null, scores: {}, /* ... existing resets ... */ });
  },
```

Note : `loadingScore` per-critère n'est plus piloté par `saveScore` (le debounce rend le timing incertain). Le statut global vient du `SaveStatusIndicator` via `writer.getStatus()`. Supprimer les lignes `loadingScore` de `saveScore`.

- [ ] **Step 8: Ajouter le flush au beforeunload**

Dans le composant qui monte `SaveStatusIndicator` (probablement `EvaluationForm` ou la page de saisie), ajouter :

```typescript
useEffect(() => {
  const handleBeforeUnload = () => { _scoreWriter?.flush(); };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, []);
```

Exporter `_scoreWriter` ou exposer un `flushPendingScores()` depuis le store pour que le composant y accède proprement. Approche recommandée — ajouter au store :

```typescript
  flushPendingScores: async () => {
    await _scoreWriter?.flush();
  },
```

- [ ] **Step 9: Vérifier tsc + suite complète**

Run: `node node_modules/typescript/bin/tsc -b && node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts' 2>&1 | tail -5`
Expected: tsc clean, tous tests verts

- [ ] **Step 10: Commit**

```bash
git add src/utils/debouncedScoreWriter.ts src/__tests__/debouncedScoreWriter.test.ts \
  src/stores/evaluationStore.ts src/components/ui/SaveStatusIndicator.tsx \
  src/i18n/fr.ts src/i18n/en.ts
git commit -m "perf(scoring): debounce writeScore 800ms + indicateur pending (scaling 33 Faritany)"
```

---

## Récapitulatif

| Task | Fichiers | Risque | Indépendante |
|------|----------|--------|-------------|
| 1. Index composite | 1 migration SQL | Nul | Oui |
| 2. Backup cron | 1 runbook | Nul (ops) | Oui |
| 3. Channels Realtime | 6 fichiers + 1 test | Faible | Oui |
| 4. Debounce writeScore | 5 fichiers + 1 test | Moyen | Oui |

## Gate finale

- `tsc -b` clean
- Suite de tests verte (382 + 2 nouveaux = ~384+)
- Smoke manuel (post-deploy) : saisir 5 notes rapidement → SaveStatusIndicator passe par pending → saving → saved (1 seul aller-retour réseau, pas 5)
- Backup : `ssh root@76.13.37.209 /root/gsat_backup.sh && cat /root/gsat_backups/backup.log`
- Index : `ssh … docker exec -i supabase_db_gsat psql -U postgres -c "\di idx_eval_campagne_org"`
