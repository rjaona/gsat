import { create } from 'zustand';
import type { Referentiel, DimensionDef, CritereDef } from '@/types';
import {
  subscribeReferentiel,
  getCritere,
  getDimension,
  getCriteresEssentiels,
} from '@/services/referentielService';

/**
 * Plusieurs référentiels peuvent être ouverts dans la même session : une
 * évaluation Faritany (far_v1_0) et une évaluation nationale (v3_0). Le store
 * les indexe par version et expose la version « courante ».
 *
 * ATTENTION : aucune version par défaut. Elle vient toujours de la campagne
 * (campagnes.referentiel_version).
 */
interface ReferentielState {
  byVersion: Record<string, Referentiel>;
  versionCourante: string | null;
  loading: boolean;
  error: string | null;

  subscribe: (version: string) => () => void;
  setVersionCourante: (version: string) => void;

  referentiel: () => Referentiel | null;
  getDimension: (code: string) => DimensionDef | undefined;
  getCritere: (code: string) => CritereDef | undefined;
  getCriteresEssentiels: () => CritereDef[];
  isEssentiel: (critereCode: string) => boolean;
  isSocle: (critereCode: string) => boolean;
}

export const useReferentielStore = create<ReferentielState>((set, get) => ({
  byVersion: {},
  versionCourante: null,
  loading: false,
  error: null,

  subscribe: (version) => {
    set({ loading: true, error: null, versionCourante: version });
    return subscribeReferentiel(
      version,
      (ref) =>
        set((s) => ({
          byVersion: { ...s.byVersion, [version]: ref },
          loading: false,
        })),
      (err) => set({ error: err.message, loading: false }),
    );
  },

  setVersionCourante: (version) => set({ versionCourante: version }),

  referentiel: () => {
    const { byVersion, versionCourante } = get();
    return versionCourante ? byVersion[versionCourante] ?? null : null;
  },

  getDimension: (code) => {
    const ref = get().referentiel();
    return ref ? getDimension(ref, code) : undefined;
  },

  getCritere: (code) => {
    const ref = get().referentiel();
    return ref ? getCritere(ref, code) : undefined;
  },

  getCriteresEssentiels: () => {
    const ref = get().referentiel();
    return ref ? getCriteresEssentiels(ref) : [];
  },

  isEssentiel: (critereCode) => get().getCritere(critereCode)?.essentiel ?? false,
  isSocle: (critereCode) => get().getCritere(critereCode)?.socle ?? true,
}));
