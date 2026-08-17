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
 *   - Chaque dimension far : `scoreSurCriteres` (0–100) — un critère ABSENT de la
 *     saisie est EXCLU au même titre qu'un N/A (seules les notes attribuées
 *     comptent). Une dimension sans aucun critère noté rend `null` → affichée 0
 *     mais HORS de la moyenne globale.
 *   - `scoreGlobal` (= ID global) = MOYENNE des IDs par dimension non-nuls
 *     (mean-of-means), pour rester cohérent intra-ligne avec les cellules
 *     dimension et aligné sur la sémantique de `calculerScoreGlobal`. Ce n'est
 *     PAS une moyenne plate sur tous les critères (dimensions inégales).
 *
 * ⚠️ Divergence assumée avec `score_global` du dashboard GSAT (qui compte un
 * critère absent = 0) : ce sont deux questions distinctes. Ne pas harmoniser.
 *
 * Une éval dont AUCUNE dimension n'a de critère noté est exclue du tableau.
 * Pure : aucune I/O. Ne modifie jamais le score GSAT.
 */
export function calculerComparaisonFaritany(
  refFar: Referentiel,
  evalsParticipantes: EvalFaritanyParticipante[],
  orgInfo: Record<string, OrgInfoFaritany>,
): LigneAsn[] {
  const lignes: LigneAsn[] = [];
  for (const ev of evalsParticipantes) {
    const scoreParDimension: Record<string, number> = {};
    const idsPresents: number[] = [];
    for (const dim of refFar.dimensions) {
      const criteresActifs = dim.criteres.filter((c) => c.actif);
      const id = scoreSurCriteres(ev.scores, criteresActifs); // 0–100 | null
      scoreParDimension[dim.code] = id ?? 0;
      if (id !== null) idsPresents.push(id);
    }
    if (idsPresents.length === 0) continue; // aucune dimension scorée → hors tableau
    const idGlobal = round2(idsPresents.reduce((s, v) => s + v, 0) / idsPresents.length);
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
