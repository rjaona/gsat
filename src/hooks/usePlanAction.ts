import { useEffect, useMemo } from 'react';
import { usePlanActionStore } from '@/stores/planActionStore';
import type { ActionStatut } from '@/types';

// ── usePlanDetail ─────────────────────────────────────────────────────────────

/**
 * Souscrit en temps réel au plan et à ses actions.
 * Retourne le plan courant, les actions, les états de chargement et l'erreur.
 */
export function usePlanDetail(planId: string | null) {
  const {
    plan,
    actions,
    loading,
    error,
    subscriberPlan,
    reset,
  } = usePlanActionStore();

  useEffect(() => {
    if (!planId) return;
    const unsubscribe = subscriberPlan(planId);
    return () => {
      unsubscribe();
      reset();
    };
  }, [planId, subscriberPlan, reset]);

  return { plan, actions, loading, error };
}

// ── useActions ────────────────────────────────────────────────────────────────

/**
 * Retourne les actions filtrées selon les filtres actifs du store.
 * Expose aussi les helpers pour modifier les filtres.
 */
export function useActions() {
  const {
    actions,
    filtres,
    loadingAction,
    actionsFiltrees,
    setFiltreStatut,
    setFiltrePriorite,
    resetFiltres,
    ajouterAction,
    modifierAction,
    supprimerAction,
    ajouterSuivi,
  } = usePlanActionStore();

  const filtrees = useMemo(() => actionsFiltrees(), [actionsFiltrees]);

  return {
    actions,
    actionsFiltrees: filtrees,
    filtres,
    loadingAction,
    setFiltreStatut,
    setFiltrePriorite,
    resetFiltres,
    ajouterAction,
    modifierAction,
    supprimerAction,
    ajouterSuivi,
  };
}

// ── usePlanActionStats ────────────────────────────────────────────────────────

/**
 * Calcule les statistiques du plan courant :
 * - nb actions par statut
 * - % de complétion (actions terminées / total)
 */
export function usePlanActionStats() {
  const { actions } = usePlanActionStore();

  const stats = useMemo(() => {
    const total = actions.length;

    const parStatut: Record<ActionStatut, number> = {
      a_faire: 0,
      en_cours: 0,
      termine: 0,
      bloque: 0,
    };

    for (const action of actions) {
      parStatut[action.statut] = (parStatut[action.statut] ?? 0) + 1;
    }

    const pourcentageCompletion =
      total === 0 ? 0 : Math.round((parStatut.termine / total) * 100);

    const nbActionsCritiques = actions.filter(a => a.priorite === 'critique').length;
    const nbActionsBloquees = parStatut.bloque;

    return {
      total,
      parStatut,
      pourcentageCompletion,
      nbActionsCritiques,
      nbActionsBloquees,
    };
  }, [actions]);

  return stats;
}
