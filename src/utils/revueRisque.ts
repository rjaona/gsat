import type { Evaluation } from '@/types';
import { scoreRisqueRevue } from '@/services/evaluationWorkflow';

/** Signaux de risque agrégés au niveau de l'organisation (source dashboard_stats / alertes / ERP). */
export interface SignauxOrg {
  nbEssentielsKO: number;
  nbAlertesCritiques: number;
  /** Incohérences note↔ERP — différé tant que L2 n'a pas peuplé erp_snapshots. */
  nbIncoherences?: number;
}

export interface EvalRevue {
  evaluation: Evaluation;
  risque: number;
  /** Jours avant clôture automatique (négatif = déjà dépassé), ou null si pas d'échéance. */
  joursAvantEcheance: number | null;
}

const MS_JOUR = 86_400_000;

function joursAvant(echeance: string | undefined, now: Date): number | null {
  if (!echeance) return null;
  return Math.ceil((new Date(echeance).getTime() - now.getTime()) / MS_JOUR);
}

/**
 * Assemble les signaux de risque par évaluation et trie la file par risque
 * DÉCROISSANT (via scoreRisqueRevue), et NON par date. À risque égal, l'échéance
 * la plus proche passe devant.
 */
export function trierParRisque(
  evals: Evaluation[],
  signauxParOrg: Record<string, SignauxOrg>,
  now: Date,
): EvalRevue[] {
  return evals
    .map((evaluation): EvalRevue => {
      const s = signauxParOrg[evaluation.orgId];
      const jours = joursAvant(evaluation.revueEcheanceAt, now);
      const risque = scoreRisqueRevue({
        nbEssentielsKO: s?.nbEssentielsKO ?? 0,
        nbIncoherences: s?.nbIncoherences ?? 0,
        nbAlertesCritiques: s?.nbAlertesCritiques ?? 0,
        progressionPoints: null,
        joursAvantEcheance: jours,
      });
      return { evaluation, risque, joursAvantEcheance: jours };
    })
    .sort((a, b) =>
      b.risque - a.risque ||
      (a.joursAvantEcheance ?? Infinity) - (b.joursAvantEcheance ?? Infinity),
    );
}

/** Nombre d'évaluations dont la clôture auto tombe dans `seuilJours` (échéance non dépassée incluse). */
export function compterEcheancesProches(file: EvalRevue[], seuilJours = 7): number {
  return file.filter(r => r.joursAvantEcheance !== null && r.joursAvantEcheance <= seuilJours).length;
}
