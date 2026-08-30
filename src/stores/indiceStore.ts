import { create } from 'zustand';
import { getIndiceComplet } from '@/services/indiceService';
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement';
import type { LigneAsn } from '@/utils/asnTableau';

const INDICE_TTL_MS = 60_000; // fenêtre de cache entre deux montages de la page

/**
 * Indice de Déploiement (§6) — store fin : délègue tout calcul au service
 * (lecture seule sous le JWT utilisateur), ne tient que l'état UI. National et
 * comparaison par Faritany proviennent d'un seul chargement (getIndiceComplet).
 */
interface IndiceState {
  resultats: IndiceCritereNational[];
  faritany: LigneAsn[];
  dimensionCodes: string[];
  niveauLabel: string | null;
  loading: boolean;
  error: string | null;
  loadedAt: number | null;
  load: (force?: boolean) => Promise<void>;
  reset: () => void;
}

export const useIndiceStore = create<IndiceState>((set, get) => ({
  resultats: [],
  faritany: [],
  dimensionCodes: [],
  niveauLabel: null,
  loading: true,
  error: null,
  loadedAt: null,
  // Audit M8 : cache TTL — évite un refetch complet (5 A/R) à chaque visite de
  // la page. `force` contourne le cache (rafraîchissement explicite).
  load: async (force = false) => {
    const st = get();
    if (!force && st.loadedAt !== null && Date.now() - st.loadedAt < INDICE_TTL_MS && st.resultats.length > 0) {
      if (st.loading) set({ loading: false });
      return;
    }
    set({ loading: true, error: null });
    try {
      const { national, faritany, dimensionCodes, niveauLabel } = await getIndiceComplet();
      set({ resultats: national, faritany, dimensionCodes, niveauLabel, loadedAt: Date.now(), loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
  reset: () =>
    set({ resultats: [], faritany: [], dimensionCodes: [], niveauLabel: null, loadedAt: null, loading: false, error: null }),
}));
