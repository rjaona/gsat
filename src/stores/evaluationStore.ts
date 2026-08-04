import { create } from 'zustand';
import type { Evaluation, EvaluationStatut, Score } from '@/types';
import {
  getEvaluation,
  subscribeEvaluation,
  subscribeEvaluationScores,
  createEvaluation,
  updateStatutEvaluation,
  writeScore,
  canTransitionTo,
  type EvaluationPayload,
  type UpdateStatutOptions,
  type CreateEvaluationOptions,
} from '@/services/evaluationService';

// ── Types internes ────────────────────────────────────────────────────────────

/**
 * Critère KO : essentiel avec note 0 et sans commentaire justificatif.
 */
export interface CritereKO {
  critereCode: string;
  commentaireManquant: boolean;
}

interface EvaluationState {
  // Évaluation courante
  evaluation: Evaluation | null;

  // Scores indexés par critereCode
  scores: Record<string, Score>;

  // Métriques de progression
  nbCriteresRenseignes: number;
  nbCriteresTotal: number;
  criteresKO: CritereKO[];

  // État UI
  loading: boolean;
  loadingScore: Record<string, boolean>;
  error: string | null;

  // ── Abonnements ──────────────────────────────────────────────────────────
  subscribeToEvaluation: (evalId: string) => () => void;
  subscribeToScores: (evalId: string, nbTotal: number, essentiels: string[]) => () => void;

  // ── Actions ───────────────────────────────────────────────────────────────
  create: (payload: EvaluationPayload, createdBy: string, options?: CreateEvaluationOptions) => Promise<string>;
  load: (evalId: string) => Promise<void>;
  updateStatut: (statut: EvaluationStatut, options?: UpdateStatutOptions) => Promise<void>;
  saveScore: (score: Score, updatedBy: string) => Promise<void>;
  clearEvaluation: () => void;

  // ── Selectors ─────────────────────────────────────────────────────────────
  getScore: (critereCode: string) => Score | undefined;
  canTransition: (to: EvaluationStatut) => boolean;
  progressionPercent: () => number;
}

// ── Helpers internes ──────────────────────────────────────────────────────────

function computeKO(scores: Record<string, Score>, essentiels: string[]): CritereKO[] {
  return essentiels
    .filter(code => {
      const s = scores[code];
      return s?.note === 0;
    })
    .map(code => ({
      critereCode: code,
      commentaireManquant: !scores[code]?.commentaire?.trim(),
    }));
}

function countRenseignes(scores: Record<string, Score>): number {
  return Object.values(scores).filter(s => s.note !== null && s.note !== undefined).length;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  evaluation: null,
  scores: {},
  nbCriteresRenseignes: 0,
  nbCriteresTotal: 0,
  criteresKO: [],
  loading: false,
  loadingScore: {},
  error: null,

  subscribeToEvaluation: (evalId: string) => {
    set({ loading: true, error: null });
    let retried = false;
    const unsubscribe = subscribeEvaluation(
      evalId,
      evaluation => {
        if (!evaluation && !retried) {
          // First null snapshot may be a timing issue — retry once via getDoc
          retried = true;
          getEvaluation(evalId)
            .then(ev => set({ evaluation: ev, loading: false }))
            .catch(() => set({ evaluation: null, loading: false }));
          return;
        }
        set({ evaluation, loading: false });
      },
      err => set({ error: err.message, loading: false })
    );
    return unsubscribe;
  },

  subscribeToScores: (evalId: string, nbTotal: number, essentiels: string[]) => {
    const unsubscribe = subscribeEvaluationScores(
      evalId,
      scores => {
        const map: Record<string, Score> = {};
        for (const s of scores) {
          map[s.critereCode] = s;
        }
        set({
          scores: map,
          nbCriteresTotal: nbTotal,
          nbCriteresRenseignes: countRenseignes(map),
          criteresKO: computeKO(map, essentiels),
        });
      },
      err => set({ error: err.message })
    );
    return unsubscribe;
  },

  create: async (payload: EvaluationPayload, createdBy: string, options?: CreateEvaluationOptions): Promise<string> => {
    set({ loading: true, error: null });
    try {
      const id = await createEvaluation(payload, createdBy, options);
      set({ loading: false });
      return id;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  load: async (evalId: string) => {
    set({ loading: true, error: null });
    try {
      const evaluation = await getEvaluation(evalId);
      set({ evaluation, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateStatut: async (statut: EvaluationStatut, options?: UpdateStatutOptions) => {
    const { evaluation } = get();
    if (!evaluation) throw new Error('Aucune évaluation chargée');
    if (!canTransitionTo(evaluation.statut, statut)) {
      throw new Error(`Transition ${evaluation.statut} → ${statut} non autorisée`);
    }
    set({ loading: true, error: null });
    try {
      await updateStatutEvaluation(evaluation.id, statut, {
        ...options,
        ancienStatut: evaluation.statut,
      });
      set({ evaluation: { ...evaluation, statut }, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  saveScore: async (score: Score, updatedBy: string) => {
    const { evaluation } = get();
    if (!evaluation) throw new Error('Aucune évaluation chargée');

    set(state => ({
      loadingScore: { ...state.loadingScore, [score.critereCode]: true },
    }));
    try {
      await writeScore(evaluation.id, score, updatedBy);
      set(state => {
        const newScores = { ...state.scores, [score.critereCode]: score };
        return {
          scores: newScores,
          nbCriteresRenseignes: countRenseignes(newScores),
          loadingScore: { ...state.loadingScore, [score.critereCode]: false },
        };
      });
    } catch (err) {
      set(state => ({
        error: (err as Error).message,
        loadingScore: { ...state.loadingScore, [score.critereCode]: false },
      }));
      throw err;
    }
  },

  clearEvaluation: () =>
    set({
      evaluation: null,
      scores: {},
      nbCriteresRenseignes: 0,
      nbCriteresTotal: 0,
      criteresKO: [],
      loading: false,
      loadingScore: {},
      error: null,
    }),

  getScore: (critereCode: string) => get().scores[critereCode],

  canTransition: (to: EvaluationStatut) => {
    const { evaluation } = get();
    if (!evaluation) return false;
    return canTransitionTo(evaluation.statut, to);
  },

  progressionPercent: () => {
    const { nbCriteresRenseignes, nbCriteresTotal } = get();
    if (nbCriteresTotal === 0) return 0;
    return Math.round((nbCriteresRenseignes / nbCriteresTotal) * 100);
  },
}));
