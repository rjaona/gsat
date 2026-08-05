import { describe, it, expect, vi, beforeEach } from 'vitest';

const refFar = {
  version: 'far_v1_0', libelle: 'far', niveau: 'ASN', actif: true,
  dimensions: [{ code: 'D01', libelle: 'D01', description: '', actif: true, criteres: [
    { code: 'F1', libelle: 'F1', description: '', essentiel: false, actif: true, sourceCodes: ['401'] },
    { code: 'F2', libelle: 'F2', description: '', essentiel: false, actif: true, sourceCodes: ['401'] },
  ] }],
};

const db = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]> }));

vi.mock('@/services/referentielService', () => ({
  getReferentiel: vi.fn(async (v: string) => (v === 'far_v1_0' ? refFar : null)),
}));

// Builder mock : select/eq/in/order (tri réel) + thenable (list). Pas de single/limit.
vi.mock('@/services/supabase', () => {
  function from(table: string) {
    let rows = (db.tables[table] ?? []).slice();
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (col: string, val: unknown) => { rows = rows.filter((r) => (r as Record<string, unknown>)[col] === val); return api; },
      in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes((r as Record<string, unknown>)[col])); return api; },
      order: (col: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending ?? true;
        rows = rows.slice().sort((a, b) => {
          const av = (a as Record<string, unknown>)[col] as string;
          const bv = (b as Record<string, unknown>)[col] as string;
          return (av > bv ? 1 : av < bv ? -1 : 0) * (asc ? 1 : -1);
        });
        return api;
      },
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return api;
  }
  return { supabase: { from } };
});

import { getIndiceDeploiement } from '@/services/indiceService';

beforeEach(() => {
  db.tables = {
    campagnes: [
      { id: 'campF1', referentiel_version: 'far_v1_0' },
      { id: 'campF2', referentiel_version: 'far_v1_0' },
      { id: 'campN',  referentiel_version: 'v3_0' },
    ],
    evaluations: [
      // A évaluée 2 fois : ancienne (campF1, score 0) et récente (campF2, score 100) → dédup garde la récente
      { id: 'eA_old', campagne_id: 'campF1', org_id: 'A', created_at: '2026-01-01' },
      { id: 'eA_new', campagne_id: 'campF2', org_id: 'A', created_at: '2026-06-01' },
      { id: 'eB',     campagne_id: 'campF1', org_id: 'B', created_at: '2026-01-01' },
      { id: 'eC',     campagne_id: 'campF2', org_id: 'C', created_at: '2026-06-01' }, // AUCUN score
      // National : validée (ancienne, 401=3) + en_cours (récente, 401=1) → préférer la VALIDÉE
      { id: 'nVal', campagne_id: 'campN', org_id: 'OSN', statut: 'validee',  created_at: '2026-02-01' },
      { id: 'nCur', campagne_id: 'campN', org_id: 'OSN', statut: 'en_cours', created_at: '2026-07-01' },
    ],
    evaluation_scores: [
      { eval_id: 'eA_old', critere_code: 'F1', note: 0 }, { eval_id: 'eA_old', critere_code: 'F2', note: 0 },
      { eval_id: 'eA_new', critere_code: 'F1', note: 3 }, { eval_id: 'eA_new', critere_code: 'F2', note: 3 },
      { eval_id: 'eB',     critere_code: 'F1', note: 0 }, { eval_id: 'eB',     critere_code: 'F2', note: 0 },
      { eval_id: 'nVal', critere_code: '401', note: 3 },
      { eval_id: 'nCur', critere_code: '401', note: 1 },
    ],
    organisations: [{ id: 'A', poids: 3 }, { id: 'B', poids: 1 }, { id: 'C', poids: 100 }],
  };
});

describe('getIndiceDeploiement', () => {
  it('agrège toutes les campagnes far, dédup dernière éval/Faritany, préfère la note nationale validée', async () => {
    const res = await getIndiceDeploiement();
    const c401 = res.find((r) => r.code === '401')!;
    // dédup A → eA_new (100), pas eA_old (0) ; C sans score exclue (poids 100 ne dilue pas)
    // ID = (100*3 + 0*1) / (3+1) = 75
    expect(c401.id).toBe(75);
    expect(c401.nbFaritanyContributeurs).toBe(2);
    // note nationale = validée (3), PAS en_cours la plus récente (1) → écart = 3*100/3 − 75 = 25
    expect(c401.noteNationale).toBe(3);
    expect(c401.ecart).toBe(25);
  });

  it('rend ID-only (écart indéfini) sans campagne nationale v3_0', async () => {
    db.tables['campagnes'] = [{ id: 'campF1', referentiel_version: 'far_v1_0' }];
    const res = await getIndiceDeploiement();
    const c401 = res.find((r) => r.code === '401');
    // A (eA_old=0), B (0) dans campF1 → ID = 0 ; aucune note nationale
    expect(c401?.noteNationale).toBeNull();
    expect(c401?.ecart).toBeUndefined();
  });
});
