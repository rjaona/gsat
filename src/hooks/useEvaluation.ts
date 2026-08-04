import { useEffect, useCallback } from 'react';
import { useEvaluationStore, type ScoreInput } from '@/stores/evaluationStore';
import { useAuthStore } from '@/stores/authStore';
import { useReferentielStore } from '@/stores/referentielStore';
import type { EvaluationStatut } from '@/types';
import type { EvaluationPayload, UpdateStatutOptions, CreateEvaluationOptions } from '@/services/evaluationService';
import { VALIDATION_ROLES } from '@/types/roles';

// ── Hook détail évaluation ────────────────────────────────────────────────────

export function useEvaluationDetail(evalId: string | undefined) {
  const {
    evaluation,
    loading,
    error,
    subscribeToEvaluation,
    clearEvaluation,
  } = useEvaluationStore();

  useEffect(() => {
    if (!evalId) {
      clearEvaluation();
      return;
    }
    const unsubscribe = subscribeToEvaluation(evalId);
    return () => {
      unsubscribe();
      clearEvaluation();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalId]);

  return { evaluation, loading, error };
}

// ── Hook scores avec abonnement temps réel ────────────────────────────────────

export function useScores(evalId: string | undefined) {
  const {
    scores,
    nbCriteresRenseignes,
    nbCriteresTotal,
    criteresKO,
    loadingScore,
    subscribeToScores,
    getScore,
    progressionPercent,
  } = useEvaluationStore();

  const referentiel = useReferentielStore(s => s.referentiel());
  const campagneMode = useEvaluationStore(s => s.campagneMode);

  useEffect(() => {
    if (!evalId || !referentiel) return;
    // Le scoring (avancement, essentiels KO) suit le mode de la campagne.
    const unsubscribe = subscribeToScores(evalId, referentiel, campagneMode);
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalId, referentiel, campagneMode]);

  return {
    scores,
    nbCriteresRenseignes,
    nbCriteresTotal,
    criteresKO,
    loadingScore,
    getScore,
    progressionPercent: progressionPercent(),
  };
}

// ── Hook actions évaluation (canSubmit, canValidate selon rôle) ───────────────

export function useEvaluationActions() {
  const {
    evaluation,
    scores,
    criteresKO,
    loading,
    error,
    create,
    updateStatut,
    saveScore,
    canTransition,
  } = useEvaluationStore();

  const { user, role } = useAuthStore();

  // Peut soumettre : statut en_cours, pas de critères essentiels KO sans commentaire
  const canSubmit = useCallback((): boolean => {
    if (!canTransition('soumise')) return false;
    const bloques = criteresKO.filter(k => k.commentaireManquant);
    return bloques.length === 0;
  }, [canTransition, criteresKO]);

  // Peut valider : rôle dans VALIDATION_ROLES et statut soumise
  const canValidate = useCallback((): boolean => {
    if (!canTransition('validee')) return false;
    return role != null && (VALIDATION_ROLES as readonly string[]).includes(role);
  }, [canTransition, role]);

  // Peut modifier : statut brouillon ou en_cours
  const canEdit = useCallback((): boolean => {
    if (!evaluation) return false;
    return evaluation.statut === 'brouillon' || evaluation.statut === 'en_cours';
  }, [evaluation]);

  const creerEvaluation = useCallback(
    async (payload: EvaluationPayload, options?: CreateEvaluationOptions): Promise<string> => {
      if (!user) throw new Error('Non authentifié');
      return create(payload, user.id, options);
    },
    [create, user]
  );

  const changerStatut = useCallback(
    async (statut: EvaluationStatut) => {
      return updateStatut(statut);
    },
    [updateStatut]
  );

  const enregistrerScore = useCallback(
    async (score: ScoreInput) => {
      if (!user) throw new Error('Non authentifié');
      return saveScore(score, user.id);
    },
    [saveScore, user]
  );

  const soumettre = useCallback(async () => {
    if (!canSubmit()) throw new Error('Soumission bloquée : critères essentiels KO non justifiés');
    return changerStatut('soumise');
  }, [canSubmit, changerStatut]);

  const valider = useCallback(async () => {
    if (!canValidate()) throw new Error('Validation non autorisée');
    return changerStatut('validee');
  }, [canValidate, changerStatut]);

  const demarrer = useCallback(async () => {
    return changerStatut('en_cours');
  }, [changerStatut]);

  return {
    evaluation,
    scores,
    criteresKO,
    loading,
    error,
    canSubmit: canSubmit(),
    canValidate: canValidate(),
    canEdit: canEdit(),
    creerEvaluation,
    enregistrerScore,
    soumettre,
    valider,
    demarrer,
    changerStatut,
  };
}
