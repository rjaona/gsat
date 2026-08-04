import { create } from 'zustand';
import type { DashboardStats, Alerte, Action } from '@/types';
import { getDashboardStats } from '@/services/dashboardService';
import { getOrganisation } from '@/services/organisationService';
import { listAlertesOuvertes } from '@/services/alerteService';
import { listPlansByOrg, listActions } from '@/services/planActionService';
import { getErpSnapshotCourant, type ErpSnapshot } from '@/services/erpService';

/**
 * Données du tableau de bord d'un Faritany (ASN). Un seul `load(orgId)` orchestre
 * les cinq bandeaux ; chaque source secondaire dégrade en silence (une ASN sans
 * ERP, sans alerte ou sans plan reste affichable).
 */
interface DashboardFaritanyState {
  stats: DashboardStats | null;
  /** Stats de l'OSN parente = moyenne consolidée des Faritany (bandeau radar). */
  moyenne: DashboardStats | null;
  alertes: Alerte[];
  actions: Action[];
  erp: ErpSnapshot | null;
  loading: boolean;
  error: string | null;
  load: (orgId: string) => Promise<void>;
  reset: () => void;
}

export const useDashboardFaritanyStore = create<DashboardFaritanyState>((set) => ({
  stats: null,
  moyenne: null,
  alertes: [],
  actions: [],
  erp: null,
  loading: false,
  error: null,

  load: async (orgId) => {
    set({ loading: true, error: null });
    try {
      const [org, stats, alertes, plans, erp] = await Promise.all([
        getOrganisation(orgId),
        getDashboardStats(orgId),
        listAlertesOuvertes(orgId).catch(() => [] as Alerte[]),
        listPlansByOrg(orgId).catch(() => []),
        getErpSnapshotCourant(orgId).catch(() => null),
      ]);
      // Moyenne nationale = stats de l'OSN parente (peut ne pas être encore consolidée).
      const moyenne = org?.parentId
        ? await getDashboardStats(org.parentId).catch(() => null)
        : null;
      // Actions du plan le plus récent de l'organisation.
      const planRecent = [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const actions: Action[] = planRecent
        ? await listActions(planRecent.id).catch(() => [])
        : [];
      set({ stats, moyenne, alertes, actions, erp, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  reset: () => set({ stats: null, moyenne: null, alertes: [], actions: [], erp: null, loading: false, error: null }),
}));
