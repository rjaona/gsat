import { create } from 'zustand';
import { listOrganisations, getLibelleNiveauLocal } from '@/services/organisationService';
import { getDashboardStatsByOrgIds } from '@/services/dashboardService';
import { listActionAggByOrgIds } from '@/services/planActionService';
import { deriverStatutFaritany, bucketiser2x2, type Bucket2x2, type FaritanySignals } from '@/utils/pilotage';
import type { WatchlistRow } from '@/components/dashboard/pilotage/WatchlistFaritany';
import type { DashboardStats } from '@/types';

interface PilotageNationalState {
  rows: WatchlistRow[];
  statsById: Record<string, DashboardStats>;
  buckets: Bucket2x2;
  niveauLabel: string | undefined;
  nbEvalues: number;
  loading: boolean;
  error: string | null;
  load: (osnId: string) => Promise<void>;
  reset: () => void;
}

const EMPTY_BUCKETS: Bucket2x2 = { appuiUrgent: 0, conformite: 0, execution: 0, sain: 0, nonEvalue: 0 };

export const usePilotageNationalStore = create<PilotageNationalState>((set) => ({
  rows: [], statsById: {}, buckets: EMPTY_BUCKETS, niveauLabel: undefined, nbEvalues: 0, loading: false, error: null,

  load: async (osnId) => {
    set({ loading: true, error: null });
    try {
      const orgs = await listOrganisations('ASN', osnId);
      const ids = orgs.map(o => o.id);
      const [stats, aggs, niveauLabel] = await Promise.all([
        getDashboardStatsByOrgIds(ids),
        listActionAggByOrgIds(ids),
        getLibelleNiveauLocal(osnId).catch(() => null),
      ]);
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
        };
      });
      const signalsList: FaritanySignals[] = rows.map(r => ({
        evalue: r.statut !== 'non_evalue',
        essentielsKoCount: r.essentielsKoCount,
        actionsTotal: r.actionsTotal,
        actionsRetard: r.actionsRetard,
        actionsBloque: r.actionsBloque,
      }));
      set({
        rows,
        statsById: stats,
        buckets: bucketiser2x2(signalsList),
        niveauLabel: niveauLabel ?? undefined,
        nbEvalues: rows.filter(r => r.statut !== 'non_evalue').length,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  reset: () => set({ rows: [], statsById: {}, buckets: EMPTY_BUCKETS, niveauLabel: undefined, nbEvalues: 0, loading: false, error: null }),
}));
