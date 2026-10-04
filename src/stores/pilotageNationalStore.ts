import { create } from 'zustand';
import { listOrganisations, getLibelleNiveauLocal } from '@/services/organisationService';
import { getDashboardStatsByOrgIds } from '@/services/dashboardService';
import { listActionAggByOrgIds, listPlansByOrg, listActions, estEnRetard } from '@/services/planActionService';
import { listEvaluationsByOrg } from '@/services/evaluationService';
import { getReferentiel } from '@/services/referentielService';
import { listUsers } from '@/services/adminService';
import {
  listAppuisOuvertsByOrgIds,
  ouvrirAppui as svcOuvrirAppui,
  mettreAJourAppui as svcMettreAJourAppui,
  cloreAppui as svcCloreAppui,
  creerActionAppui as svcCreerActionAppui,
  type AppuiInput,
  type ActionAppuiForm,
} from '@/services/appuiService';
import {
  deriverStatutFaritany, bucketiser2x2, choisirCiblePlan, choisirPlanCourant, derniereEvalValidee, resoudreOsnPilotage, indexerLibellesCriteres,
  type Bucket2x2, type FaritanySignals,
} from '@/utils/pilotage';
import type { WatchlistRow } from '@/components/dashboard/pilotage/WatchlistFaritany';
import type { DrilldownAction } from '@/components/dashboard/pilotage/DrilldownFaritany';
import type { Action, AppuiFaritany, DashboardStats, UserRole } from '@/types';

export interface DetailFaritany {
  orgId: string;
  actionsSouffrance: DrilldownAction[];
  actionsNationales: DrilldownAction[];
  peutCreerAction: boolean;
}

export interface Referent { id: string; nom: string }

export interface ContexteUtilisateur {
  role: UserRole | undefined;
  orgId: string | undefined;
  orgType: string | undefined;
}

interface PilotageNationalState {
  osnId: string | null;
  rows: WatchlistRow[];
  statsById: Record<string, DashboardStats>;
  buckets: Bucket2x2;
  niveauLabel: string | undefined;
  nbEvalues: number;
  appuis: Record<string, AppuiFaritany>;
  nbActionsNationalesEnCours: number;
  libellesKo: Record<string, string>;
  referents: Referent[];
  detail: DetailFaritany | null;
  detailOrgId: string | null;
  captureBusy: boolean;
  captureError: string | null;
  loading: boolean;
  error: string | null;
  loadPourUtilisateur: (ctx: ContexteUtilisateur) => Promise<void>;
  load: (osnId: string) => Promise<void>;
  chargerDetail: (orgId: string) => Promise<void>;
  ouvrirAppui: (orgId: string, input: AppuiInput) => Promise<boolean>;
  majAppui: (orgId: string, input: AppuiInput) => Promise<boolean>;
  cloreAppui: (orgId: string) => Promise<boolean>;
  creerActionAppui: (orgId: string, form: ActionAppuiForm, userId: string) => Promise<boolean>;
  reset: () => void;
}

const EMPTY_BUCKETS: Bucket2x2 = { appuiUrgent: 0, conformite: 0, execution: 0, sain: 0, nonEvalue: 0 };

/** Rôles proposables comme référent national d'un appui. */
const ROLES_REFERENT: UserRole[] = ['admin_global', 'responsable_osn', 'responsable_region'];

const INITIAL = {
  osnId: null, rows: [] as WatchlistRow[], statsById: {} as Record<string, DashboardStats>, buckets: EMPTY_BUCKETS,
  niveauLabel: undefined, nbEvalues: 0, appuis: {} as Record<string, AppuiFaritany>, nbActionsNationalesEnCours: 0,
  libellesKo: {} as Record<string, string>, referents: [] as Referent[], detail: null, detailOrgId: null,
  captureBusy: false, captureError: null, loading: false, error: null,
};

function versDetail(a: Action): DrilldownAction {
  return { id: a.id, titre: a.objectif || a.description, statut: a.statut, dateEcheance: a.dateEcheance, origine: a.origine ?? 'regionale' };
}

export const usePilotageNationalStore = create<PilotageNationalState>((set, get) => {
  /** Exécute une capture : busy + erreur lisible, puis recharge cockpit et détail. */
  async function capturer(orgId: string, op: () => Promise<unknown>): Promise<boolean> {
    set({ captureBusy: true, captureError: null });
    try {
      await op();
      const osnId = get().osnId;
      if (osnId) await get().load(osnId);
      // Ne recharger le détail que si ce Faritany est toujours sélectionné.
      if (get().detailOrgId === orgId) await get().chargerDetail(orgId);
      return true;
    } catch (err) {
      set({ captureError: (err as Error).message });
      return false;
    } finally {
      set({ captureBusy: false });
    }
  }

  return {
    ...INITIAL,

    loadPourUtilisateur: async (ctx) => {
      set({ loading: true, error: null });
      try {
        const osns = ctx.orgType === 'OSN' ? [] : await listOrganisations('OSN');
        const osnId = resoudreOsnPilotage(ctx, osns);
        if (!osnId) {
          set({ loading: false, error: 'Aucune organisation nationale rattachée à ce compte.' });
          return;
        }
        set({ osnId });
        await get().load(osnId);
      } catch (err) {
        set({ error: (err as Error).message, loading: false });
      }
    },

    load: async (osnId) => {
      set({ loading: true, error: null, osnId });
      try {
        const orgs = await listOrganisations('ASN', osnId);
        const ids = orgs.map(o => o.id);
        const [stats, aggs, appuis, niveauLabel, users] = await Promise.all([
          getDashboardStatsByOrgIds(ids),
          listActionAggByOrgIds(ids),
          listAppuisOuvertsByOrgIds(ids),
          getLibelleNiveauLocal(osnId).catch(() => null),
          listUsers().catch(() => []),
        ]);
        // Libellés KO (cosmétique : repli sur le code si le référentiel est illisible).
        const versions = [...new Set(Object.values(stats).map(s => s.referentielVersion).filter((v): v is string => !!v))];
        const refs = await Promise.all(versions.map(v => getReferentiel(v).catch(() => null)));
        const libellesKo: Record<string, string> = Object.assign({}, ...refs.map(r => indexerLibellesCriteres(r)));

        const rows: WatchlistRow[] = orgs.map(org => {
          const st = stats[org.id];
          const ag = aggs[org.id];
          const signals: FaritanySignals = {
            evalue: st != null,
            essentielsKoCount: st?.criteresEssentielsKO?.length ?? 0,
            actionsTotal: ag?.actionsTotal ?? 0,
            actionsRetard: ag?.actionsRetard ?? 0,
            actionsBloque: ag?.actionsBloque ?? 0,
          };
          return {
            org,
            statut: deriverStatutFaritany(signals),
            essentielsKoCount: signals.essentielsKoCount,
            actionsTotal: signals.actionsTotal,
            actionsRetard: signals.actionsRetard,
            actionsBloque: signals.actionsBloque,
            enAppui: appuis[org.id] != null,
          };
        });
        const signalsList: FaritanySignals[] = rows.map(r => ({
          evalue: r.statut !== 'non_evalue',
          essentielsKoCount: r.essentielsKoCount,
          actionsTotal: r.actionsTotal,
          actionsRetard: r.actionsRetard,
          actionsBloque: r.actionsBloque,
        }));
        const referents: Referent[] = users
          .filter(u => ROLES_REFERENT.includes(u.role) && (u.orgId === osnId || u.role === 'admin_global'))
          .map(u => ({ id: u.id, nom: `${u.prenom} ${u.nom}`.trim() }));
        set({
          rows,
          statsById: stats,
          buckets: bucketiser2x2(signalsList),
          niveauLabel: niveauLabel ?? undefined,
          nbEvalues: rows.filter(r => r.statut !== 'non_evalue').length,
          appuis,
          nbActionsNationalesEnCours: Object.values(aggs).reduce((n, a) => n + (a.actionsNationalesEnCours ?? 0), 0),
          libellesKo,
          referents,
          loading: false,
        });
      } catch (err) {
        set({ error: (err as Error).message, loading: false });
      }
    },

    chargerDetail: async (orgId) => {
      set({ detailOrgId: orgId, detail: null, captureError: null });
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [plans, evals] = await Promise.all([listPlansByOrg(orgId), listEvaluationsByOrg(orgId)]);
        const courant = choisirPlanCourant(plans);
        const actions = courant ? await listActions(courant.id) : [];
        if (get().detailOrgId !== orgId) return; // sélection changée entre-temps
        set({
          detail: {
            orgId,
            actionsSouffrance: actions.filter(a => a.statut === 'bloque' || estEnRetard(a.statut, a.dateEcheance, today)).map(versDetail),
            actionsNationales: actions.filter(a => a.origine === 'nationale').map(versDetail),
            peutCreerAction: choisirCiblePlan(plans, derniereEvalValidee(evals)).kind !== 'impossible',
          },
        });
      } catch (err) {
        if (get().detailOrgId === orgId) set({ captureError: (err as Error).message });
      }
    },

    ouvrirAppui: (orgId, input) => capturer(orgId, () => svcOuvrirAppui(orgId, input)),

    majAppui: (orgId, input) => capturer(orgId, async () => {
      const appui = get().appuis[orgId];
      if (!appui) throw new Error('Aucun appui ouvert pour ce Faritany.');
      await svcMettreAJourAppui(appui.id, input);
    }),

    cloreAppui: (orgId) => capturer(orgId, async () => {
      const appui = get().appuis[orgId];
      if (!appui) throw new Error('Aucun appui ouvert pour ce Faritany.');
      await svcCloreAppui(appui.id);
    }),

    creerActionAppui: (orgId, form, userId) => capturer(orgId, () => svcCreerActionAppui(orgId, form, userId)),

    reset: () => set({ ...INITIAL }),
  };
});
