import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  actions: [] as unknown[],
  scores: [] as unknown[],
  inserted: [] as Record<string, unknown>[],
}));
vi.mock('@/services/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        if (table === 'plan_actions') {
          return { eq: () => ({ order: () => Promise.resolve({ data: h.actions, error: null }) }) };
        }
        // evaluation_scores : .eq('eval_id').eq('note', 0)
        return { eq: () => ({ eq: () => Promise.resolve({ data: h.scores, error: null }) }) };
      },
      insert: (row: Record<string, unknown>) => {
        h.inserted.push({ table, ...row });
        return { select: () => ({ single: () => Promise.resolve({ data: { id: `new-${h.inserted.length}` }, error: null }) }) };
      },
    }),
  },
}));

import { completerPlanCreeParNational } from '@/services/planActionService';
import type { PlanAction } from '@/types';

const plan: PlanAction = { id: 'p1', evalId: 'e1', orgId: 'far-1', statut: 'actif', createdBy: 'u-nat', createdAt: '2026-10-01' };
const action = (id: string, origine: string | null) => ({
  id, plan_id: 'p1', domaine_amelioration: 'D', objectif: 'O', description: '', responsable: '',
  date_echeance: '2026-11-01T00:00:00Z', statut: 'a_faire', priorite: 'haute', created_at: '2026-10-01T00:00:00Z', origine,
});

beforeEach(() => {
  h.actions = [action('n1', 'nationale')];
  h.scores = [{ critere_code: 'F101' }, { critere_code: 'F205' }];
  h.inserted = [];
});

describe('completerPlanCreeParNational', () => {
  it('plan créé par le national, seulement des actions nationales, user du Faritany → pré-remplit', async () => {
    const n = await completerPlanCreeParNational(plan, { id: 'u-far', orgId: 'far-1' });
    expect(n).toBe(2);
    expect(h.inserted).toHaveLength(2);
    expect(h.inserted.map(r => r['critere_code'])).toEqual(['F101', 'F205']);
    expect(h.inserted.every(r => r['table'] === 'plan_actions' && r['plan_id'] === 'p1' && r['origine'] === 'regionale')).toBe(true);
  });

  it('plan créé par l user lui-même → 0, aucune insertion', async () => {
    const n = await completerPlanCreeParNational({ ...plan, createdBy: 'u-far' }, { id: 'u-far', orgId: 'far-1' });
    expect(n).toBe(0);
    expect(h.inserted).toHaveLength(0);
  });

  it('plan contenant déjà une action régionale → 0', async () => {
    h.actions = [action('n1', 'nationale'), action('r1', null)];
    const n = await completerPlanCreeParNational(plan, { id: 'u-far', orgId: 'far-1' });
    expect(n).toBe(0);
    expect(h.inserted).toHaveLength(0);
  });

  it('user d une autre org (national) → 0', async () => {
    const n = await completerPlanCreeParNational(plan, { id: 'u-osn', orgId: 'osn-mg' });
    expect(n).toBe(0);
    expect(h.inserted).toHaveLength(0);
  });

  it('orgId inconnu → 0', async () => {
    expect(await completerPlanCreeParNational(plan, { id: 'u-far', orgId: undefined })).toBe(0);
    expect(h.inserted).toHaveLength(0);
  });
});
