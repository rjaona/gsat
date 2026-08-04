import { create } from 'zustand';
import type { DashboardStats, Evaluation } from '@/types';
import {
  subscribeDashboardStats,
  getDashboardStats,
  getEvaluationsRecentes,
  getEvaluationsRecentesGlobal,
} from '@/services/dashboardService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardState {
  // Stats courantes
  stats: DashboardStats | null;

  // Évaluations récentes
  evaluationsRecentes: Evaluation[];

  // orgId actif (peut être changé par admin_global)
  orgIdActif: string | null;

  // État UI
  loading: boolean;
  loadingEvals: boolean;
  error: string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  setOrgIdActif: (orgId: string) => void;
  subscriberStats: (orgId: string) => () => void;
  chargerStats: (orgId: string) => Promise<void>;
  chargerEvaluationsRecentes: (orgId: string, limitCount?: number) => Promise<void>;
  chargerEvaluationsRecentesGlobal: (limitCount?: number) => Promise<void>;
  reset: () => void;
}

// ── Valeur initiale ───────────────────────────────────────────────────────────

const initialState = {
  stats: null,
  evaluationsRecentes: [],
  orgIdActif: null,
  loading: false,
  loadingEvals: false,
  error: null,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDashboardStore = create<DashboardState>((set) => ({
  ...initialState,

  setOrgIdActif: (orgId: string) => set({ orgIdActif: orgId }),

  subscriberStats: (orgId: string) => {
    set({ loading: true, error: null, orgIdActif: orgId });
    const unsubscribe = subscribeDashboardStats(
      orgId,
      stats => set({ stats, loading: false }),
      err => set({ error: err.message, loading: false })
    );
    return unsubscribe;
  },

  chargerStats: async (orgId: string) => {
    set({ loading: true, error: null, orgIdActif: orgId });
    try {
      const stats = await getDashboardStats(orgId);
      set({ stats, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  chargerEvaluationsRecentes: async (orgId: string, limitCount = 5) => {
    set({ loadingEvals: true, error: null });
    try {
      const evaluationsRecentes = await getEvaluationsRecentes(orgId, limitCount);
      set({ evaluationsRecentes, loadingEvals: false });
    } catch (err) {
      set({ error: (err as Error).message, loadingEvals: false });
    }
  },

  chargerEvaluationsRecentesGlobal: async (limitCount = 10) => {
    set({ loadingEvals: true, error: null });
    try {
      const evaluationsRecentes = await getEvaluationsRecentesGlobal(limitCount);
      set({ evaluationsRecentes, loadingEvals: false });
    } catch (err) {
      set({ error: (err as Error).message, loadingEvals: false });
    }
  },

  reset: () => set(initialState),
}));
