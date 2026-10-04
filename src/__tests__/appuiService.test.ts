import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ insertResult: { data: null as unknown, error: null as unknown } }));
vi.mock('@/services/supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: () => Promise.resolve(h.insertResult) }) }),
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
  rowToAppui, estConflitUnique, ouvrirAppui, creerActionAppui,
  AppuiDejaOuvertError, CreationActionImpossibleError,
} from '@/services/appuiService';
import { listPlansByOrg, createPlan, addAction } from '@/services/planActionService';
import { listEvaluationsByOrg } from '@/services/evaluationService';

const form = { objectif: 'Former le trésorier', domaineAmelioration: 'Finances', dateEcheance: '2026-12-01', priorite: 'haute' as const, responsable: 'Rakoto' };

beforeEach(() => {
  vi.clearAllMocks();
  h.insertResult = { data: null, error: null };
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
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e1' } as never]);
    await creerActionAppui('f1', { ...form, critereCode: 'F401' }, 'u-nat');
    expect(createPlan).not.toHaveBeenCalled();
    expect(addAction).toHaveBeenCalledWith('courant', {
      objectif: 'Former le trésorier', domaineAmelioration: 'Finances', dateEcheance: '2026-12-01', priorite: 'haute',
      responsable: 'Rakoto', description: '', statut: 'a_faire', origine: 'nationale', critereCode: 'F401',
    });
  });
  it('aucun plan mais une éval → crée le plan sur la DERNIÈRE éval puis ajoute', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e-recente' } as never, { id: 'e-ancienne' } as never]);
    await creerActionAppui('f1', form, 'u-nat');
    expect(createPlan).toHaveBeenCalledWith({ evalId: 'e-recente', orgId: 'f1', statut: 'actif', createdBy: 'u-nat' }, 'u-nat');
    expect(addAction).toHaveBeenCalledWith('plan-neuf', expect.objectContaining({ origine: 'nationale' }));
    expect(vi.mocked(addAction).mock.calls[0]?.[1]).not.toHaveProperty('critereCode');
  });
  it('ni plan ni éval → CreationActionImpossibleError, aucune écriture', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([]);
    await expect(creerActionAppui('f1', form, 'u-nat')).rejects.toBeInstanceOf(CreationActionImpossibleError);
    expect(createPlan).not.toHaveBeenCalled();
    expect(addAction).not.toHaveBeenCalled();
  });
});
