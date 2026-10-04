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
