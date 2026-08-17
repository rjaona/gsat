import { describe, it, expect, vi, beforeEach } from 'vitest';

// P4/P5 — la notification « validée avec essentiels KO » part désormais par une
// RPC SECURITY DEFINER (le client responsable_asn ne peut ni lire le destinataire
// ni insérer la notif : cf. notif_insert / users_select). On vérifie ici le
// contrat côté service : appel RPC ssi des essentiels sont KO, jamais sinon.

const h = vi.hoisted(() => ({
  rpc: vi.fn(async () => ({ data: 'recipient-id', error: null })),
  evalStatut: 'en_cours' as string,
}));

vi.mock('@/services/supabase', () => {
  function makeChain() {
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: () => chain,
      eq: () => chain,
      single: async () => ({ data: { statut: h.evalStatut }, error: null }),
      then: (resolve: (v: { data: null; error: null }) => void) => resolve({ data: null, error: null }),
    };
    return chain;
  }
  return { supabase: { from: () => makeChain(), rpc: h.rpc } };
});

import { autoValiderEvaluation } from '@/services/evaluationService';

const baseOpts = {
  pvComitePath: 'preuves/ORG_A/camp1/eval1/pv-comite/pv.pdf',
  valideePar: 'user-asn',
  role: 'responsable_asn' as const,
  userOrgId: 'ORG_A',
  evalOrgId: 'ORG_A',
};

beforeEach(() => {
  h.rpc.mockClear();
  h.evalStatut = 'en_cours';
});

describe('autoValiderEvaluation → notification RPC', () => {
  it('appelle la RPC de notification quand des essentiels sont KO', async () => {
    await autoValiderEvaluation('eval1', {
      ...baseOpts,
      essentielsKO: ['E01', 'E07'],
      confirmeMalgreEssentiels: true,
    });

    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith('fn_notifier_validation_essentiels_ko', {
      p_eval_id: 'eval1',
      p_essentiels_ko: ['E01', 'E07'],
    });
  });

  it('n\'appelle PAS la RPC quand aucun essentiel n\'est KO', async () => {
    await autoValiderEvaluation('eval1', {
      ...baseOpts,
      essentielsKO: [],
    });

    expect(h.rpc).not.toHaveBeenCalled();
  });
});
