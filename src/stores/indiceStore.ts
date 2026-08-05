import { create } from 'zustand';
import { getIndiceDeploiement } from '@/services/indiceService';
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement';

/**
 * Indice de Déploiement (§6) — store fin : délègue tout calcul au service
 * (lecture seule sous le JWT utilisateur), ne tient que l'état UI.
 */
interface IndiceState {
  resultats: IndiceCritereNational[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  reset: () => void;
}

export const useIndiceStore = create<IndiceState>((set) => ({
  resultats: [],
  loading: true,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const resultats = await getIndiceDeploiement();
      set({ resultats, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
  reset: () => set({ resultats: [], loading: false, error: null }),
}));
