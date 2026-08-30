import { create } from 'zustand';
import { getIndiceComplet } from '@/services/indiceService';
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement';
import type { LigneAsn } from '@/utils/asnTableau';

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
  load: () => Promise<void>;
  reset: () => void;
}

export const useIndiceStore = create<IndiceState>((set) => ({
  resultats: [],
  faritany: [],
  dimensionCodes: [],
  niveauLabel: null,
  loading: true,
  error: null,
  load: async () => {
    set({ loading: true, error: null });
    try {
      const { national, faritany, dimensionCodes, niveauLabel } = await getIndiceComplet();
      set({ resultats: national, faritany, dimensionCodes, niveauLabel, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), loading: false });
    }
  },
  reset: () =>
    set({ resultats: [], faritany: [], dimensionCodes: [], niveauLabel: null, loading: false, error: null }),
}));
