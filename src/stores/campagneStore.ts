import { create } from 'zustand';
import type { Campagne, CampagneStatut } from '@/types';
import {
  listCampagnes,
  getCampagne,
  createCampagne,
  updateCampagne,
  updateStatutCampagne,
  deleteCampagne,
  type CampagnePayload,
} from '@/services/campagneService';

interface CampagneState {
  campagnes: Campagne[];
  selected: Campagne | null;
  loading: boolean;
  error: string | null;

  // Abonnement temps réel
  subscribe: (filtreStatut?: CampagneStatut) => Promise<() => void>;

  // Actions
  select: (id: string) => Promise<void>;
  clearSelected: () => void;
  create: (payload: CampagnePayload, createdBy: string) => Promise<string>;
  update: (id: string, data: Partial<Omit<Campagne, 'id' | 'createdAt' | 'createdBy'>>) => Promise<void>;
  updateStatut: (
    id: string,
    statut: CampagneStatut,
    options?: {
      actorId?: string | undefined;
      actorName?: string | undefined;
      recipientIds?: string[] | undefined;
      campagneName?: string | undefined;
    },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;

  // Selectors
  getById: (id: string) => Campagne | undefined;
  getCampagnesOuvertes: () => Campagne[];
}

export const useCampagneStore = create<CampagneState>((set, get) => ({
  campagnes: [],
  selected: null,
  loading: false,
  error: null,

  subscribe: async (filtreStatut?: CampagneStatut) => {
    set({ loading: true, error: null });
    try {
      const campagnes = await listCampagnes(filtreStatut);
      set({ campagnes, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
    // Retourne un no-op pour compatibilité avec les useEffect existants
    return () => {};
  },

  select: async (id: string) => {
    // Chercher d'abord dans le cache local
    const cached = get().campagnes.find(c => c.id === id);
    if (cached) {
      set({ selected: cached });
      return;
    }
    // Sinon charger depuis Supabase
    set({ loading: true });
    try {
      const campagne = await getCampagne(id);
      set({ selected: campagne, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clearSelected: () => set({ selected: null }),

  create: async (payload: CampagnePayload, createdBy: string): Promise<string> => {
    set({ loading: true, error: null });
    try {
      const id = await createCampagne(payload, createdBy);
      set({ loading: false });
      return id;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  update: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await updateCampagne(id, data);
      // Mettre à jour le selected si c'est la même campagne
      const current = get().selected;
      if (current?.id === id) {
        set({ selected: { ...current, ...data } as Campagne });
      }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  updateStatut: async (id, statut, options) => {
    set({ loading: true, error: null });
    try {
      await updateStatutCampagne(id, statut, options);
      const current = get().selected;
      if (current?.id === id) {
        set({ selected: { ...current, statut } });
      }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  remove: async (id) => {
    set({ loading: true, error: null });
    try {
      await deleteCampagne(id);
      const current = get().selected;
      if (current?.id === id) {
        set({ selected: null });
      }
      set({ loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  getById: (id) => get().campagnes.find(c => c.id === id),

  getCampagnesOuvertes: () => get().campagnes.filter(c => c.statut === 'ouverte'),
}));
