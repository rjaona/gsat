import { create } from 'zustand';
import { getDashboardStats } from '@/services/dashboardService';
import { listPlansByOrg, listActions, estEnRetard } from '@/services/planActionService';
import { ordonnerPrioritesRegionales, type PrioriteItem } from '@/utils/pilotage';
import type { Action } from '@/types';

interface PilotageRegionalState {
  items: PrioriteItem[];
  evalue: boolean;
  actionsTerminees: number;
  koCount: number;
  retardCount: number;
  bloqueCount: number;
  loading: boolean;
  error: string | null;
  load: (orgId: string) => Promise<void>;
  reset: () => void;
}

const INITIAL = { items: [] as PrioriteItem[], evalue: false, actionsTerminees: 0, koCount: 0, retardCount: 0, bloqueCount: 0 };

export const usePilotageRegionalStore = create<PilotageRegionalState>((set) => ({
  ...INITIAL, loading: false, error: null,

  load: async (orgId) => {
    set({ loading: true, error: null });
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [stats, plans] = await Promise.all([
        getDashboardStats(orgId),
        listPlansByOrg(orgId),
      ]);
      const planRecent = [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const actions: Action[] = planRecent ? await listActions(planRecent.id) : [];

      const koItems: PrioriteItem[] = (stats?.criteresEssentielsKO ?? []).map(code => ({
        kind: 'essentiel_ko', code, libelle: code,
      }));
      const actionItems: PrioriteItem[] = actions
        .filter(a => a.statut === 'bloque' || estEnRetard(a.statut, a.dateEcheance, today))
        .map(a => ({ kind: 'action', id: a.id, titre: a.objectif || a.description, statut: a.statut, dateEcheance: a.dateEcheance, priorite: a.priorite }));

      const items = ordonnerPrioritesRegionales([...koItems, ...actionItems]);
      set({
        items,
        evalue: stats != null,
        actionsTerminees: actions.filter(a => a.statut === 'termine').length,
        koCount: koItems.length,
        retardCount: actionItems.filter(i => i.kind === 'action' && i.statut !== 'bloque').length,
        bloqueCount: actionItems.filter(i => i.kind === 'action' && i.statut === 'bloque').length,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  reset: () => set({ ...INITIAL, loading: false, error: null }),
}));
