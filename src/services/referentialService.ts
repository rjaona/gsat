/**
 * referentialService.ts
 *
 * Couche admin du référentiel : mise à jour de critères, création de version.
 * La lecture courante (getReferentiel, subscribeReferentiel) est dans referentielService.ts.
 * Ce fichier ajoute les opérations d'administration réservées à admin_global.
 */

import { supabase } from './supabase';
import { updateCritere } from './referentielService';
import type { CritereDef } from '@/types';

// Statuts d'évaluation actifs — la modification du référentiel peut les affecter
const STATUTS_ACTIFS = ['brouillon', 'en_cours', 'soumise'] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpdateCriterionResult {
  /** Nombre d'évaluations actives (brouillon/en_cours/soumise) utilisant cette version */
  evaluationsActives: number;
  /** Nombre d'évaluations figées (validee/cloturee) — informationnel, non bloquant */
  evaluationsFigees: number;
}

// ── Mise à jour d'un critère ──────────────────────────────────────────────────

export async function updateCriterion(
  version: string,
  dimensionCode: string,
  criterionCode: string,
  updates: Partial<Pick<CritereDef, 'libelle' | 'guideInterpretation' | 'essentiel'>>,
): Promise<UpdateCriterionResult> {
  // Compte les évaluations actives (toutes campagnes — le filtre par version
  // nécessiterait une jointure sur campagnes.referentiel_version, non disponible ici)
  void version;
  const { count: countActives, error: errActives } = await supabase
    .from('evaluations')
    .select('id', { count: 'exact', head: true })
    .in('statut', [...STATUTS_ACTIFS]);
  if (errActives) throw errActives;

  // Évaluations figées — informationnel, non bloquant
  const { count: countFigees, error: errFigees } = await supabase
    .from('evaluations')
    .select('id', { count: 'exact', head: true })
    .in('statut', ['validee', 'cloturee']);
  if (errFigees) throw errFigees;

  // Mise à jour du critère via la couche référentiel
  await updateCritere(criterionCode, {
    ...(updates.libelle            !== undefined ? { libelle: updates.libelle }                       : {}),
    ...(updates.guideInterpretation !== undefined ? { guideInterpretation: updates.guideInterpretation } : {}),
    ...(updates.essentiel          !== undefined ? { essentiel: updates.essentiel }                   : {}),
  });

  // Suppress unused variable warning — dimensionCode used for future filtering
  void dimensionCode;

  return {
    evaluationsActives: countActives ?? 0,
    evaluationsFigees:  countFigees  ?? 0,
  };
}
