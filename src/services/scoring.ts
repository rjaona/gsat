/**
 * Scoring GSAT — logique pure, sans dépendance à Supabase.
 *
 * ⚠️  CE FICHIER EST LE MIROIR EXACT DE `fn_recalculate_scores()`
 *     (supabase/trigger_on_score_write.sql). Toute modification ici impose la
 *     même modification côté SQL, et inversement. Les deux implémentations
 *     doivent rendre la MÊME valeur, au centième près.
 *
 * Sémantique des notes — c'est là que se jouent les bugs :
 *
 *   scores[code] === undefined  → critère non répondu   → compte 0, plein poids
 *   scores[code] === null       → critère N/A           → hors numérateur ET
 *                                                          hors dénominateur
 *   scores[code] === 0..3       → note                  → compte normalement
 *
 * Une dimension dont tous les critères comptés sont N/A rend `null` : elle est
 * exclue de la moyenne globale, et non notée 0.
 */

import type { DimensionDef, Referentiel, CritereDef } from '@/types';

export type ScoreMap = Record<string, number | null>;
export type ModeCampagne = 'socle' | 'complet';

/** Un critère explicitement marqué non applicable pour cette évaluation. */
function estNA(scores: ScoreMap, code: string): boolean {
  return code in scores && scores[code] === null;
}

/** Critères entrant dans le calcul, selon le mode de campagne. */
function criteresComptes(dimension: DimensionDef, mode: ModeCampagne): CritereDef[] {
  return dimension.criteres.filter(
    (c) => c.actif && (mode !== 'socle' || c.socle !== false),
  );
}

/** Arrondi à deux décimales — identique au ROUND(x, 2) de PostgreSQL. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Score d'une dimension, sur 100.
 * Rend `null` si aucun critère n'est comptable (dimension vide, entièrement
 * inactive, ou entièrement N/A) — auquel cas la dimension sort de la moyenne.
 */
export function calculerScoreDimension(
  scores: ScoreMap,
  dimension: DimensionDef,
  mode: ModeCampagne = 'complet',
): number | null {
  const comptes = criteresComptes(dimension, mode).filter((c) => !estNA(scores, c.code));
  if (comptes.length === 0) return null;

  const total = comptes.reduce((sum, c) => sum + (scores[c.code] ?? 0), 0);
  return round2((total / (comptes.length * 3)) * 100);
}

/**
 * Score sur un sous-ensemble ARBITRAIRE de critères (les enfants d'un critère
 * national pour l'Indice de Déploiement, §6). Sémantique DIFFÉRENTE de
 * `calculerScoreDimension` : ici un critère ABSENT de la saisie est EXCLU (pas
 * compté 0), au même titre qu'un N/A — seules les notes réellement attribuées
 * comptent. Rend `null` si aucun critère n'a été noté. NE PAS harmoniser avec
 * `calculerScoreDimension` : ce sont deux questions distinctes (déploiement du
 * standard national vs conformité GSAT).
 */
export function scoreSurCriteres(scores: ScoreMap, criteres: CritereDef[]): number | null {
  const notes = criteres
    .filter((c) => c.code in scores && !estNA(scores, c.code))
    .map((c) => scores[c.code] as number);
  if (notes.length === 0) return null;
  const total = notes.reduce((sum, n) => sum + n, 0);
  return round2((total / (notes.length * 3)) * 100);
}

/**
 * Score global : moyenne des dimensions comptables.
 * Les dimensions rendant `null` sont ignorées, pas comptées comme 0.
 */
export function calculerScoreGlobal(
  scores: ScoreMap,
  ref: Referentiel,
  mode: ModeCampagne = 'complet',
): number {
  const dims = ref.dimensions
    .map((d) => calculerScoreDimension(scores, d, mode))
    .filter((s): s is number => s !== null);

  if (dims.length === 0) return 0;
  return round2(dims.reduce((sum, s) => sum + s, 0) / dims.length);
}

/**
 * Critères essentiels non conformes.
 * Un essentiel N/A n'est PAS KO : seules une note 0 et l'absence de réponse
 * valent non-conformité.
 */
export function getCriteresEssentielsKO(
  scores: ScoreMap,
  ref: Referentiel,
  mode: ModeCampagne = 'complet',
): string[] {
  return ref.dimensions
    .flatMap((d) => criteresComptes(d, mode))
    .filter((c) => c.essentiel && !estNA(scores, c.code) && (scores[c.code] ?? 0) === 0)
    .map((c) => c.code)
    .sort();
}

/** Nombre de critères réellement répondus (N/A compris) sur le total comptable. */
export function calculerAvancement(
  scores: ScoreMap,
  ref: Referentiel,
  mode: ModeCampagne = 'complet',
): { repondus: number; total: number; pourcentage: number } {
  const comptables = ref.dimensions.flatMap((d) => criteresComptes(d, mode));
  const repondus = comptables.filter((c) => c.code in scores).length;
  const total = comptables.length;
  return {
    repondus,
    total,
    pourcentage: total === 0 ? 0 : round2((repondus / total) * 100),
  };
}

/** Affichage : le score se lit en entier, il se stocke au centième. */
export function formatScore(score: number | null): string {
  return score === null ? '—' : `${Math.round(score)}%`;
}
