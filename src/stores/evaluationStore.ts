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
import { createDebouncedScoreWriter } from '@/utils/debouncedScoreWriter';

// ── Score Writer singleton ─────────────────────────────────────────────────────
// Un seul writer pour toute l'app (keyed par critereCode).
let _scoreWriter: ReturnType<typeof createDebouncedScoreWriter> | null = null;

function getScoreWriter(onError: (err: Error) => void, onStatus: (s: 'idle' | 'pending' | 'saving' | 'saved' | 'error') => void) {
  if (!_scoreWriter) {
    _scoreWriter = createDebouncedScoreWriter(writeScore, onError);
    _scoreWriter.onStatusChange(onStatus);
  }
  return _scoreWriter;
}

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
  /** Statut de l'écrivain de score debouncé — 'idle'|'pending'|'saving'|'saved'|'error'. */
  scoreWriterStatus: 'idle' | 'pending' | 'saving' | 'saved' | 'error';

  // ── Abonnements ──────────────────────────────────────────────────────────
  subscribeToEvaluation: (evalId: string) => () => void;
  subscribeToScores: (evalId: string, referentiel: Referentiel, mode: ModeCampagne) => () => void;

  // ── Actions ───────────────────────────────────────────────────────────────
  create: (payload: EvaluationPayload, createdBy: string, options?: CreateEvaluationOptions) => Promise<string>;
  load: (evalId: string) => Promise<void>;
  updateStatut: (statut: EvaluationStatut, options?: UpdateStatutOptions) => Promise<void>;
  saveScore: (score: ScoreInput, updatedBy: string) => Promise<void>;
  clearEvaluation: () => void;
  flushPendingScores: () => Promise<void>;

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
  scoreWriterStatus: 'idle' as const,

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

    // Optimistic update local immédiat (avant le debounce réseau).
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
      };
    });

    // Debounce l'écriture réseau (800ms) — réduit la charge trigger sur 33 Faritany.
    const writer = getScoreWriter(err => set({ error: err.message }), s => set({ scoreWriterStatus: s }));
    writer.schedule(evaluation.id, score, updatedBy);
  },

  clearEvaluation: () => {
    // Flush les écritures en attente avant de quitter l'évaluation.
    void _scoreWriter?.flush();
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
    });
  },

  flushPendingScores: async () => {
    await _scoreWriter?.flush();
  },

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
