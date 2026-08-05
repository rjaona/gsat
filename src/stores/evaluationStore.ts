import { create } from 'zustand';
import type { Evaluation, EvaluationStatut, Score, Referentiel } from '@/types';
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
import { getCampagne } from '@/services/campagneService';
import {
  calculerAvancement,
  getCriteresEssentielsKO,
  type ScoreMap,
  type ModeCampagne,
} from '@/services/scoring';
import type { ValeurScore } from '@/components/evaluation/ScorePicker';

// ── Types internes ────────────────────────────────────────────────────────────

/**
 * Charge utile d'écriture d'un score, avant timestamp/auteur. `note` peut valoir
 * undefined — « pas répondu », qui supprime la ligne côté DB (voir writeScore),
 * distinct de null (« non applicable »). Type partagé par toute la chaîne de
 * saisie (CritereItem → DimensionSection → EvaluationForm → enregistrerScore).
 */
export type ScoreInput = Omit<Score, 'updatedBy' | 'updatedAt' | 'note'> & { note: ValeurScore };

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

  // Contexte de scoring propagé depuis la campagne
  /** Mode de la campagne de l'évaluation courante (défaut 'complet'). */
  campagneMode: ModeCampagne;
  /** Référentiel courant — mémorisé pour recalculer l'avancement à chaque saveScore. */
  referentielCourant: Referentiel | null;

  // État UI
  loading: boolean;
  loadingScore: Record<string, boolean>;
  error: string | null;

  // ── Abonnements ──────────────────────────────────────────────────────────
  subscribeToEvaluation: (evalId: string) => () => void;
  subscribeToScores: (evalId: string, referentiel: Referentiel, mode: ModeCampagne) => () => void;

  // ── Actions ───────────────────────────────────────────────────────────────
  create: (payload: EvaluationPayload, createdBy: string, options?: CreateEvaluationOptions) => Promise<string>;
  load: (evalId: string) => Promise<void>;
  updateStatut: (statut: EvaluationStatut, options?: UpdateStatutOptions) => Promise<void>;
  saveScore: (score: ScoreInput, updatedBy: string) => Promise<void>;
  clearEvaluation: () => void;

  // ── Selectors ─────────────────────────────────────────────────────────────
  getScore: (critereCode: string) => Score | undefined;
  canTransition: (to: EvaluationStatut) => boolean;
  progressionPercent: () => number;
}

// ── Helpers internes ──────────────────────────────────────────────────────────

function scoresToMap(scores: Record<string, Score>): ScoreMap {
  const map: ScoreMap = {};
  for (const [code, s] of Object.entries(scores)) map[code] = s.note;
  return map;
}

/**
 * Essentiels non conformes (mode-aware via scoring.ts) + info « commentaire
 * manquant » nécessaire à la garde de soumission.
 */
function computeKO(scores: Record<string, Score>, referentiel: Referentiel, mode: ModeCampagne): CritereKO[] {
  return getCriteresEssentielsKO(scoresToMap(scores), referentiel, mode).map(code => ({
    critereCode: code,
    commentaireManquant: !scores[code]?.commentaire?.trim(),
  }));
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useEvaluationStore = create<EvaluationState>((set, get) => ({
  evaluation: null,
  scores: {},
  nbCriteresRenseignes: 0,
  nbCriteresTotal: 0,
  criteresKO: [],
  campagneMode: 'complet',
  referentielCourant: null,
  loading: false,
  loadingScore: {},
  error: null,

  subscribeToEvaluation: (evalId: string) => {
    set({ loading: true, error: null });
    let retried = false;
    let modeFetchedFor: string | null = null;
    // Le mode de scoring vient de la campagne de l'évaluation (une seule lecture).
    const applyMode = (ev: Evaluation | null) => {
      if (ev && ev.campagneId !== modeFetchedFor) {
        modeFetchedFor = ev.campagneId;
        void getCampagne(ev.campagneId)
          .then(c => { if (c) set({ campagneMode: c.mode }); })
          .catch(() => { /* défaut 'complet' conservé */ });
      }
    };
    const unsubscribe = subscribeEvaluation(
      evalId,
      evaluation => {
        if (!evaluation && !retried) {
          // First null snapshot may be a timing issue — retry once via getDoc
          retried = true;
          getEvaluation(evalId)
            .then(ev => { set({ evaluation: ev, loading: false }); applyMode(ev); })
            .catch(() => set({ evaluation: null, loading: false }));
          return;
        }
        set({ evaluation, loading: false });
        applyMode(evaluation);
      },
      err => set({ error: err.message, loading: false })
    );
    return unsubscribe;
  },

  subscribeToScores: (evalId: string, referentiel: Referentiel, mode: ModeCampagne) => {
    set({ referentielCourant: referentiel });
    const unsubscribe = subscribeEvaluationScores(
      evalId,
      scores => {
        const map: Record<string, Score> = {};
        for (const s of scores) {
          map[s.critereCode] = s;
        }
        // Avancement mode-aware : un N/A (note null) compte comme répondu.
        const av = calculerAvancement(scoresToMap(map), referentiel, mode);
        set({
          scores: map,
          nbCriteresTotal: av.total,
          nbCriteresRenseignes: av.repondus,
          criteresKO: computeKO(map, referentiel, mode),
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

  saveScore: async (score: ScoreInput, updatedBy: string) => {
    const { evaluation } = get();
    if (!evaluation) throw new Error('Aucune évaluation chargée');

    set(state => ({
      loadingScore: { ...state.loadingScore, [score.critereCode]: true },
    }));
    try {
      await writeScore(evaluation.id, score, updatedBy);
      set(state => {
        const newScores = { ...state.scores };
        // Miroir de writeScore : note undefined sans commentaire = ligne supprimée.
        if (score.note === undefined && !score.commentaire) {
          delete newScores[score.critereCode];
        } else {
          newScores[score.critereCode] = {
            critereCode: score.critereCode,
            note: score.note ?? null,
            ...(score.commentaire !== undefined ? { commentaire: score.commentaire } : {}),
            updatedBy,
            updatedAt: new Date().toISOString(),
          };
        }
        const ref = state.referentielCourant;
        return {
          scores: newScores,
          // Recalcul optimiste mode-aware (N/A compte) ; la souscription confirmera.
          nbCriteresRenseignes: ref
            ? calculerAvancement(scoresToMap(newScores), ref, state.campagneMode).repondus
            : state.nbCriteresRenseignes,
          criteresKO: ref ? computeKO(newScores, ref, state.campagneMode) : state.criteresKO,
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
      campagneMode: 'complet',
      referentielCourant: null,
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
