import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/services/organisationService', () => ({
  listOrganisations: vi.fn(),
  getLibelleNiveauLocal: vi.fn().mockResolvedValue('Faritany'),
}));
vi.mock('@/services/dashboardService', () => ({ getDashboardStatsByOrgIds: vi.fn() }));
vi.mock('@/services/planActionService', () => ({
  listActionAggByOrgIds: vi.fn(),
  listPlansByOrg: vi.fn().mockResolvedValue([]),
  listActions: vi.fn().mockResolvedValue([]),
  estEnRetard: (s: string, d: string | null, t: string) => !!d && s !== 'termine' && s !== 'bloque' && d.slice(0, 10) < t,
}));
vi.mock('@/services/evaluationService', () => ({ listEvaluationsByOrg: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/referentielService', () => ({ getReferentiel: vi.fn() }));
vi.mock('@/services/adminService', () => ({ listUsers: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/appuiService', () => ({
  listAppuisOuvertsByOrgIds: vi.fn(),
  ouvrirAppui: vi.fn(),
  mettreAJourAppui: vi.fn(),
  cloreAppui: vi.fn(),
  creerActionAppui: vi.fn(),
}));

import { usePilotageNationalStore } from '@/stores/pilotageNationalStore';
import { listOrganisations } from '@/services/organisationService';
import { getDashboardStatsByOrgIds } from '@/services/dashboardService';
import { listActionAggByOrgIds, listPlansByOrg, listActions } from '@/services/planActionService';
import { listEvaluationsByOrg } from '@/services/evaluationService';
import { getReferentiel } from '@/services/referentielService';
import { listUsers } from '@/services/adminService';
import { listAppuisOuvertsByOrgIds, ouvrirAppui, creerActionAppui } from '@/services/appuiService';

const far = (id: string) => ({ id, nom: id, code: `ANT-0${id}`, type: 'ASN', actif: true, poids: 1, parentId: 'osn-mg' });
const agg = (o: Partial<Record<string, number>> = {}) => ({ actionsTotal: 0, actionsDone: 0, actionsEnCours: 0, actionsBloque: 0, actionsRetard: 0, actionsNationalesEnCours: 0, latestUpdate: null, ...o });

beforeEach(() => {
  vi.clearAllMocks();
  usePilotageNationalStore.getState().reset();
  vi.mocked(listOrganisations).mockImplementation(async (type) => (type === 'OSN'
    ? [{ id: 'osn-mg', nom: 'TEM', type: 'OSN', actif: true, poids: 1 }]
    : [far('1'), far('2')]) as never);
  vi.mocked(getDashboardStatsByOrgIds).mockResolvedValue({
    '1': { orgId: '1', scoreGlobal: 40, scoreParDimension: {}, criteresEssentielsKO: ['F401'], referentielVersion: 'far_v1_0' },
  } as never);
  vi.mocked(listActionAggByOrgIds).mockResolvedValue({ '1': agg({ actionsTotal: 2, actionsNationalesEnCours: 1 }), '2': agg({ actionsNationalesEnCours: 2 }) } as never);
  vi.mocked(listAppuisOuvertsByOrgIds).mockResolvedValue({ '1': { id: 'ap1', orgId: '1', statut: 'ouvert', ouvertAt: '2026-10-04' } });
  vi.mocked(getReferentiel).mockResolvedValue({ version: 'far_v1_0', dimensions: [{ criteres: [{ code: 'F401', libelle: { fr: 'Assurance des membres', en: '' } }] }] } as never);
  vi.mocked(listUsers).mockResolvedValue([
    { id: 'u-admin', orgId: 'omms', role: 'admin_global', nom: 'Admin', prenom: 'Gsat' },
    { id: 'u-osn', orgId: 'osn-mg', role: 'responsable_osn', nom: 'Rabe', prenom: 'Hery' },
    { id: 'u-far', orgId: '1', role: 'responsable_asn', nom: 'Far', prenom: 'Un' },
  ] as never);
});

describe('pilotageNationalStore — Phase 2', () => {
  it('admin_global rattaché à OMMS → résout l OSN et charge ses Faritany', async () => {
    await usePilotageNationalStore.getState().loadPourUtilisateur({ role: 'admin_global', orgId: 'omms', orgType: 'OMMS' });
    const s = usePilotageNationalStore.getState();
    expect(listOrganisations).toHaveBeenCalledWith('OSN');
    expect(listOrganisations).toHaveBeenCalledWith('ASN', 'osn-mg');
    expect(s.osnId).toBe('osn-mg');
    expect(s.rows).toHaveLength(2);
    expect(s.error).toBeNull();
  });

  it('aucune OSN résoluble → erreur explicite, pas un cockpit vide', async () => {
    vi.mocked(listOrganisations).mockResolvedValue([]);
    await usePilotageNationalStore.getState().loadPourUtilisateur({ role: 'admin_global', orgId: 'omms', orgType: 'OMMS' });
    expect(usePilotageNationalStore.getState().error).toMatch(/Aucune organisation nationale/);
  });

  it('appuis, compteur national, libellés KO et référents nationaux', async () => {
    await usePilotageNationalStore.getState().load('osn-mg');
    const s = usePilotageNationalStore.getState();
    expect(s.rows.find(r => r.org.id === '1')?.enAppui).toBe(true);
    expect(s.rows.find(r => r.org.id === '2')?.enAppui).toBe(false);
    expect(s.nbActionsNationalesEnCours).toBe(3);
    expect(s.libellesKo).toEqual({ F401: 'Assurance des membres' });
    expect(s.referents).toEqual([{ id: 'u-admin', nom: 'Gsat Admin' }, { id: 'u-osn', nom: 'Hery Rabe' }]);
  });

  it('échec de lecture des appuis → erreur (§6), pas un faux « aucun appui »', async () => {
    vi.mocked(listAppuisOuvertsByOrgIds).mockRejectedValue(new Error('boom appui'));
    await usePilotageNationalStore.getState().load('osn-mg');
    expect(usePilotageNationalStore.getState().error).toBe('boom appui');
  });

  it('chargerDetail : actions en souffrance + nationales du plan courant ; impossible sans éval', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([{ id: 'p1', evalId: 'e1', orgId: '1', statut: 'actif', createdBy: 'u', createdAt: '2026-06-01' }]);
    vi.mocked(listActions).mockResolvedValue([
      { id: 'a1', planId: 'p1', objectif: 'Retard', description: '', domaineAmelioration: 'D', responsable: '', dateEcheance: '2020-01-01', statut: 'a_faire', priorite: 'haute', createdAt: '', origine: 'regionale' },
      { id: 'a2', planId: 'p1', objectif: 'Appui', description: '', domaineAmelioration: 'D', responsable: '', dateEcheance: '2099-01-01', statut: 'en_cours', priorite: 'haute', createdAt: '', origine: 'nationale' },
    ]);
    await usePilotageNationalStore.getState().chargerDetail('1');
    const d = usePilotageNationalStore.getState().detail;
    expect(d?.actionsSouffrance.map(a => a.id)).toEqual(['a1']);
    expect(d?.actionsNationales.map(a => a.id)).toEqual(['a2']);
    expect(d?.peutCreerAction).toBe(true);

    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([]);
    await usePilotageNationalStore.getState().chargerDetail('2');
    expect(usePilotageNationalStore.getState().detail?.peutCreerAction).toBe(false);
  });

  it('chargerDetail : sans plan, seule une éval en_cours → peutCreerAction false ; une validee → true', async () => {
    vi.mocked(listPlansByOrg).mockResolvedValue([]);
    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e-cours', statut: 'en_cours' } as never]);
    await usePilotageNationalStore.getState().chargerDetail('1');
    expect(usePilotageNationalStore.getState().detail?.peutCreerAction).toBe(false);

    vi.mocked(listEvaluationsByOrg).mockResolvedValue([{ id: 'e-cours', statut: 'en_cours' } as never, { id: 'e-val', statut: 'validee' } as never]);
    await usePilotageNationalStore.getState().chargerDetail('1');
    expect(usePilotageNationalStore.getState().detail?.peutCreerAction).toBe(true);
  });

  it('capture sur 1 pendant que la sélection passe à 2 → le détail reste celui de 2', async () => {
    await usePilotageNationalStore.getState().load('osn-mg');
    await usePilotageNationalStore.getState().chargerDetail('1');
    vi.mocked(ouvrirAppui).mockImplementation(async () => {
      await usePilotageNationalStore.getState().chargerDetail('2');
      return { id: 'ap2', orgId: '1', statut: 'ouvert', ouvertAt: '2026-10-04' };
    });
    const ok = await usePilotageNationalStore.getState().ouvrirAppui('1', {});
    expect(ok).toBe(true);
    expect(usePilotageNationalStore.getState().detailOrgId).toBe('2');
    expect(usePilotageNationalStore.getState().detail?.orgId).toBe('2');
  });

  it('ouvrirAppui en conflit → captureError lisible, false', async () => {
    await usePilotageNationalStore.getState().load('osn-mg');
    vi.mocked(ouvrirAppui).mockRejectedValue(new Error('Un appui est déjà ouvert pour ce Faritany.'));
    const ok = await usePilotageNationalStore.getState().ouvrirAppui('2', {});
    expect(ok).toBe(false);
    expect(usePilotageNationalStore.getState().captureError).toBe('Un appui est déjà ouvert pour ce Faritany.');
    expect(usePilotageNationalStore.getState().captureBusy).toBe(false);
  });

  it('creerActionAppui → appelle le service puis recharge cockpit + détail', async () => {
    await usePilotageNationalStore.getState().load('osn-mg');
    await usePilotageNationalStore.getState().chargerDetail('1'); // Faritany sélectionné
    vi.mocked(listPlansByOrg).mockClear();
    vi.mocked(creerActionAppui).mockResolvedValue('a-new');
    const form = { objectif: 'O', domaineAmelioration: 'D', dateEcheance: '2026-12-01', priorite: 'haute' as const, responsable: '' };
    const ok = await usePilotageNationalStore.getState().creerActionAppui('1', form, 'u-osn');
    expect(ok).toBe(true);
    expect(creerActionAppui).toHaveBeenCalledWith('1', form, 'u-osn');
    expect(listActionAggByOrgIds).toHaveBeenCalledTimes(2); // load initial + rechargement
    expect(listPlansByOrg).toHaveBeenCalledWith('1');      // détail rechargé
  });
});
