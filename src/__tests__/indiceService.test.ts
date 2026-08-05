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
