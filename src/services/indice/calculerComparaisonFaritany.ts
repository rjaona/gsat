import type { Referentiel } from '@/types';
import { scoreSurCriteres } from '@/services/scoring';
import type { EvalFaritanyParticipante } from './calculerIndiceDeploiement';
import type { LigneAsn } from '@/utils/asnTableau';

/** Infos d'affichage d'une organisation Faritany (résolues côté service). */
export interface OrgInfoFaritany {
  nom: string;
  code?: string | undefined;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Comparaison par Faritany pour l'Indice de Déploiement (§6). Lentille ID
 * (déploiement du standard national), DISTINCTE du score GSAT :
 *
 *   - Chaque dimension far : `scoreSurCriteres` (0–100) — DANS une dimension, un
 *     critère ABSENT de la saisie est EXCLU au même titre qu'un N/A (seules les
 *     notes attribuées comptent). Une dimension sans AUCUN critère noté rend
 *     `null` → affichée 0.
 *   - `scoreGlobal` (= ID global) = MOYENNE sur TOUTES les dimensions, une
 *     dimension non évaluée comptant 0. Le global reste ainsi cohérent avec les
 *     cellules affichées (ce qu'on voit est ce qui est moyenné) : une dimension
 *     non encore couverte tire l'indice vers le bas (déploiement incomplet).
 *
 * Une éval dont AUCUNE dimension n'a de critère noté (0 signal) est exclue du
 * tableau. Pure : aucune I/O. Ne modifie jamais le score GSAT.
 */
export function calculerComparaisonFaritany(
  refFar: Referentiel,
  evalsParticipantes: EvalFaritanyParticipante[],
  orgInfo: Record<string, OrgInfoFaritany>,
): LigneAsn[] {
  const lignes: LigneAsn[] = [];
  for (const ev of evalsParticipantes) {
    const scoreParDimension: Record<string, number> = {};
    let nbDimensionsEvaluees = 0;
    for (const dim of refFar.dimensions) {
      const criteresActifs = dim.criteres.filter((c) => c.actif);
      const id = scoreSurCriteres(ev.scores, criteresActifs); // 0–100 | null
      scoreParDimension[dim.code] = id ?? 0; // dimension non évaluée → 0 (comptée)
      if (id !== null) nbDimensionsEvaluees += 1;
    }
    if (nbDimensionsEvaluees === 0) continue; // aucune dimension scorée → hors tableau
    // Moyenne sur TOUTES les dimensions (non évaluée = 0) → cohérent avec l'affichage.
    const somme = refFar.dimensions.reduce((s, dim) => s + (scoreParDimension[dim.code] ?? 0), 0);
    const idGlobal = refFar.dimensions.length > 0 ? round2(somme / refFar.dimensions.length) : 0;
    const info = orgInfo[ev.orgId];
    lignes.push({
      asnId: ev.orgId,
      nom: info?.nom ?? ev.orgId,
      scoreGlobal: idGlobal,
      scoreParDimension,
      code: info?.code,
    });
  }
  return lignes;
}
