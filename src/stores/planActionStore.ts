import { create } from 'zustand';
import type { PlanAction, Action, ActionStatut, ActionPriorite } from '@/types';
import {
  subscribePlan,
  getPlan,
  listActions,
  addAction,
  updateAction,
  deleteAction,
  addSuivi,
  createPlanFromEvaluation,
  type ActionPayload,
  type SuiviPayload,
} from '@/services/planActionService';

// ── Types filtres ─────────────────────────────────────────────────────────────

export interface FiltresAction {
  statut: ActionStatut | 'tous';
  priorite: ActionPriorite | 'tous';
}

// ── Types d'état ──────────────────────────────────────────────────────────────

interface PlanActionState {
  // Plan courant
  plan: PlanAction | null;

  // Actions du plan courant
  actions: Action[];

  // Filtres actifs
  filtres: FiltresAction;

  // État UI
  loading: boolean;
  loadingAction: Record<string, boolean>;
  error: string | null;

  // ── Abonnements ──────────────────────────────────────────────────────────
  subscriberPlan: (planId: string) => () => void;

  // ── Chargement ────────────────────────────────────────────────────────────
  chargerPlan: (planId: string) => Promise<void>;

  // ── Actions CRUD ──────────────────────────────────────────────────────────
  ajouterAction: (
    payload: Omit<ActionPayload, 'planId'>
  ) => Promise<string>;
  modifierAction: (
    actionId: string,
    data: Partial<Omit<Action, 'id' | 'planId' | 'createdAt'>>
  ) => Promise<void>;
  supprimerAction: (actionId: string) => Promise<void>;
  ajouterSuivi: (
    actionId: string,
    suivi: Omit<SuiviPayload, 'actionId'>,
    createdBy: string
  ) => Promise<void>;

  // ── Création depuis évaluation ─────────────────────────────────────────────
  creerDepuisEvaluation: (evalId: string, createdBy: string) => Promise<string>;

  // ── Filtres ───────────────────────────────────────────────────────────────
  setFiltreStatut: (statut: ActionStatut | 'tous') => void;
  setFiltrePriorite: (priorite: ActionPriorite | 'tous') => void;
  resetFiltres: () => void;

  // ── Selectors ─────────────────────────────────────────────────────────────
  actionsFiltrees: () => Action[];
  reset: () => void;
}

// ── Valeur initiale ───────────────────────────────────────────────────────────

const initialState = {
  plan: null,
  actions: [],
  filtres: { statut: 'tous' as const, priorite: 'tous' as const },
  loading: false,
  loadingAction: {} as Record<string, boolean>,
  error: null,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const usePlanActionStore = create<PlanActionState>((set, get) => ({
  ...initialState,

  subscriberPlan: (planId: string) => {
    set({ loading: true, error: null });
    const unsubscribe = subscribePlan(
      planId,
      (plan, actions) => set({ plan, actions, loading: false }),
      err => set({ error: err.message, loading: false })
    );
    return unsubscribe;
  },

  chargerPlan: async (planId: string) => {
    set({ loading: true, error: null });
    try {
      const [plan, actions] = await Promise.all([getPlan(planId), listActions(planId)]);
      set({ plan, actions, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  ajouterAction: async (payload) => {
    const { plan } = get();
    if (!plan) throw new Error('Aucun plan chargé');
    set({ loading: true, error: null });
    try {
      const id = await addAction(plan.id, payload);
      set({ loading: false });
      return id;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  modifierAction: async (actionId, data) => {
    const { plan } = get();
    if (!plan) throw new Error('Aucun plan chargé');
    set(state => ({
      loadingAction: { ...state.loadingAction, [actionId]: true },
    }));
    try {
      await updateAction(actionId, data);
      set(state => ({
        actions: state.actions.map(a =>
          a.id === actionId ? { ...a, ...data } : a
        ),
        loadingAction: { ...state.loadingAction, [actionId]: false },
      }));
    } catch (err) {
      set(state => ({
        error: (err as Error).message,
        loadingAction: { ...state.loadingAction, [actionId]: false },
      }));
      throw err;
    }
  },

  supprimerAction: async (actionId) => {
    const { plan } = get();
    if (!plan) throw new Error('Aucun plan chargé');
    set(state => ({
      loadingAction: { ...state.loadingAction, [actionId]: true },
    }));
    try {
      await deleteAction(actionId);
      set(state => ({
        actions: state.actions.filter(a => a.id !== actionId),
        loadingAction: { ...state.loadingAction, [actionId]: false },
      }));
    } catch (err) {
      set(state => ({
        error: (err as Error).message,
        loadingAction: { ...state.loadingAction, [actionId]: false },
      }));
      throw err;
    }
  },

  ajouterSuivi: async (actionId, suivi, createdBy) => {
    const { plan } = get();
    if (!plan) throw new Error('Aucun plan chargé');
    set(state => ({
      loadingAction: { ...state.loadingAction, [actionId]: true },
    }));
    try {
      await addSuivi(plan.id, actionId, suivi, createdBy);
      // Mise à jour optimiste du statut de l'action
      set(state => ({
        actions: state.actions.map(a =>
          a.id === actionId ? { ...a, statut: suivi.nouveauStatut } : a
        ),
        loadingAction: { ...state.loadingAction, [actionId]: false },
      }));
    } catch (err) {
      set(state => ({
        error: (err as Error).message,
        loadingAction: { ...state.loadingAction, [actionId]: false },
      }));
      throw err;
    }
  },

  creerDepuisEvaluation: async (evalId, createdBy) => {
    set({ loading: true, error: null });
    try {
      const planId = await createPlanFromEvaluation(evalId, createdBy);
      set({ loading: false });
      return planId;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  setFiltreStatut: (statut) =>
    set(state => ({ filtres: { ...state.filtres, statut } })),

  setFiltrePriorite: (priorite) =>
    set(state => ({ filtres: { ...state.filtres, priorite } })),

  resetFiltres: () =>
    set({ filtres: { statut: 'tous', priorite: 'tous' } }),

  actionsFiltrees: () => {
    const { actions, filtres } = get();
    return actions.filter(a => {
      const matchStatut = filtres.statut === 'tous' || a.statut === filtres.statut;
      const matchPriorite =
        filtres.priorite === 'tous' || a.priorite === filtres.priorite;
      return matchStatut && matchPriorite;
    });
  },

  reset: () => set(initialState),
}));
