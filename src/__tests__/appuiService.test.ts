import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  insertResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: [{ id: 'ap1' }] as unknown, error: null as unknown },
  updateCalls: [] as { patch: Record<string, unknown>; eqs: [string, unknown][] }[],
}));
vi.mock('@/services/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve(h.insertResult) }) }),
      update: (patch: Record<string, unknown>) => {
        const call = { patch, eqs: [] as [string, unknown][] };
        h.updateCalls.push(call);
        const chain = {
          eq: (col: string, val: unknown) => { call.eqs.push([col, val]); return chain; },
          select: () => Promise.resolve(h.updateResult),
        };
        return chain;
      },
    }),
  },
}));
vi.mock('@/services/planActionService', () => ({
  listPlansByOrg: vi.fn(),
  createPlan: vi.fn().mockResolvedValue('plan-neuf'),
  addAction: vi.fn().mockResolvedValue('action-1'),
}));
vi.mock('@/services/evaluationService', () => ({ listEvaluationsByOrg: vi.fn() }));

import {
  rowToAppui, estConflitUnique, ouvrirAppui, creerActionAppui, cloreAppui, mettreAJourAppui,
  AppuiDejaOuvertError, CreationActionImpossibleError,
} from '@/services/appuiService';
import { listPlansByOrg, createPlan, addAction } from '@/services/planActionService';
import { listEvaluationsByOrg } from '@/services/evaluationService';

const form = { objectif: 'Former le trésorier', domaineAmelioration: 'Finances', dateEcheance: '2026-12-01', priorite: 'haute' as const, responsable: 'Rakoto' };

beforeEach(() => {
  vi.clearAllMocks();
  h.insertResult = { data: null, error: null };
  h.updateResult = { data: [{ id: 'ap1' }], error: null };
  h.updateCalls = [];
});

describe('rowToAppui', () => {
  it('mappe les colonnes et omet les null', () => {
    expect(rowToAppui({ id: 'a', org_id: 'f1', statut: 'ouvert', referent_user_id: null, note: 'n', ouvert_at: '2026-10-04T00:00:00Z', ouvert_par: 'u1', clos_at: null }))
      .toEqual({ id: 'a', orgId: 'f1', statut: 'ouvert', note: 'n', ouvertAt: '2026-10-04T00:00:00Z', ouvertPar: 'u1' });
  });
});

describe('ouvrirAppui', () => {
  it('conflit 23505 (appui déjà ouvert) → AppuiDejaOuvertError lisible', async () => {
    h.insertResult = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_appui_ouvert_par_org"' } };
    await expect(ouvrirAppui('f1', {})).rejects.toBeInstanceOf(AppuiDejaOuvertError);
    expect(estConflitUnique({ code: '23505' })).toBe(true);
    expect(estConflitUnique(new Error('x'))).toBe(false);
  });
  it('autre erreur → relancée telle quelle', async () => {
    h.insertResult = { data: null, error: { code: '42501', message: 'rls' } };
    await expect(ouvrirAppui('f1', {})).rejects.toMatchObject({ code: '42501' });
  });
});

describe('creerActionAppui', () => {
  it('plan existant → ajoute au plan COURANT (le plus récent), sans créer de plan', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([
      { id: 'vieux', evalId: 'e0', orgId: 'f1', statut: 'cloture', createdBy: 'u', createdAt: '2026-01-01' },
      { id: 'courant', evalId: 'e1', orgId: 'f1', statut: 'actif', createdBy: 'u', createdAt: '2026-06-01' },
    ]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e1', statut: 'validee' } as never]);
    await creerActionAppui('f1', { ...form, critereCode: 'F401' }, 'u-nat');
    expect(createPlan).not.toHaveBeenCalled();
    expect(addAction).toHaveBeenCalledWith('courant', {
      objectif: 'Former le trésorier', domaineAmelioration: 'Finances', dateEcheance: '2026-12-01', priorite: 'haute',
      responsable: 'Rakoto', description: '', statut: 'a_faire', origine: 'nationale', critereCode: 'F401',
    });
  });
  it('aucun plan mais une éval validée → crée le plan sur la DERNIÈRE éval validée puis ajoute', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e-recente', statut: 'validee' } as never, { id: 'e-ancienne', statut: 'validee' } as never]);
    await creerActionAppui('f1', form, 'u-nat');
    expect(createPlan).toHaveBeenCalledWith({ evalId: 'e-recente', orgId: 'f1', statut: 'actif', createdBy: 'u-nat' }, 'u-nat');
    expect(addAction).toHaveBeenCalledWith('plan-neuf', expect.objectContaining({ origine: 'nationale' }));
    expect(vi.mocked(addAction).mock.calls[0]?.[1]).not.toHaveProperty('critereCode');
  });
  it('aucun plan, évals = [en_cours récente, validee ancienne] → plan sur la validee', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e-cours', statut: 'en_cours' } as never, { id: 'e-val', statut: 'validee' } as never]);
    await creerActionAppui('f1', form, 'u-nat');
    expect(createPlan).toHaveBeenCalledWith({ evalId: 'e-val', orgId: 'f1', statut: 'actif', createdBy: 'u-nat' }, 'u-nat');
  });
  it('aucun plan, évals = [en_cours] → CreationActionImpossibleError, aucune écriture', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e-cours', statut: 'en_cours' } as never]);
    const err = await creerActionAppui('f1', form, 'u-nat').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CreationActionImpossibleError);
    expect((err as Error).message).toBe('Aucune évaluation validée : impossible de créer une action d’appui.');
    expect(createPlan).not.toHaveBeenCalled();
    expect(addAction).not.toHaveBeenCalled();
  });
  it('ni plan ni éval → CreationActionImpossibleError, aucune écriture', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([]);
    await expect(creerActionAppui('f1', form, 'u-nat')).rejects.toBeInstanceOf(CreationActionImpossibleError);
    expect(createPlan).not.toHaveBeenCalled();
    expect(addAction).not.toHaveBeenCalled();
  });
});

describe('garde statut ouvert (clore / mettre à jour)', () => {
  it('cloreAppui filtre sur statut = ouvert ; 0 ligne → erreur lisible', async () => {
    await cloreAppui('ap1');
    expect(h.updateCalls[0]?.eqs).toEqual([['id', 'ap1'], ['statut', 'ouvert']]);
    h.updateResult = { data: [], error: null };
    await expect(cloreAppui('ap1')).rejects.toThrow('Appui introuvable ou non modifiable.');
  });
  it('mettreAJourAppui filtre sur statut = ouvert ; 0 ligne → erreur lisible', async () => {
    await mettreAJourAppui('ap1', { note: 'n' });
    expect(h.updateCalls[0]?.patch).toEqual({ note: 'n' });
    expect(h.updateCalls[0]?.eqs).toEqual([['id', 'ap1'], ['statut', 'ouvert']]);
    h.updateResult = { data: [], error: null };
    await expect(mettreAJourAppui('ap1', { note: 'n' })).rejects.toThrow('Appui introuvable ou non modifiable.');
  });
  it('mettreAJourAppui avec patch vide → aucune requête', async () => {
    await mettreAJourAppui('ap1', {});
    expect(h.updateCalls).toHaveLength(0);
  });
});
