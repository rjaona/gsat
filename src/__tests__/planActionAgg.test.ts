import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase : chaîne .from().select().in() résolue vers {data, error}.
const h = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@/services/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({ data: h.rows, error: null }),
      }),
    }),
  },
}));

import { listActionAggByOrgIds } from '@/services/planActionService';

beforeEach(() => { h.rows = []; });

describe('listActionAggByOrgIds (audit M7)', () => {
  it('agrège total/done/enCours/bloqué + latestUpdate sur TOUS les plans d\'un org', async () => {
    h.rows = [
      { org_id: 'A', plan_actions: [
        { statut: 'termine', created_at: '2026-01-01T00:00:00Z' },
        { statut: 'en_cours', created_at: '2026-03-01T00:00:00Z' },
      ] },
      { org_id: 'A', plan_actions: [
        { statut: 'bloque', created_at: '2026-02-01T00:00:00Z' },
      ] },
    ];
    const r = await listActionAggByOrgIds(['A', 'B']);
    expect(r['A']).toEqual({
      actionsTotal: 3, actionsDone: 1, actionsEnCours: 1, actionsBloque: 1,
      latestUpdate: '2026-03-01T00:00:00Z',
    });
    // org sans plan → compteurs à 0, présent dans la map
    expect(r['B']).toEqual({
      actionsTotal: 0, actionsDone: 0, actionsEnCours: 0, actionsBloque: 0,
      latestUpdate: null,
    });
  });

  it('court-circuite une liste vide sans requête', async () => {
    expect(await listActionAggByOrgIds([])).toEqual({});
  });

  it('ignore les actions sans created_at pour latestUpdate', async () => {
    h.rows = [{ org_id: 'A', plan_actions: [
      { statut: 'termine', created_at: null },
      { statut: 'termine', created_at: '2026-05-01T00:00:00Z' },
    ] }];
    const r = await listActionAggByOrgIds(['A']);
    expect(r['A']?.actionsTotal).toBe(2);
    expect(r['A']?.latestUpdate).toBe('2026-05-01T00:00:00Z');
  });
});
