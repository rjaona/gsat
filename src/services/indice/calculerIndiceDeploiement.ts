import type { Referentiel, CritereDef } from '@/types';
import { scoreSurCriteres, type ScoreMap } from '@/services/scoring';

export interface EvalFaritanyParticipante {
  orgId: string;
  scores: ScoreMap;
}

export interface IndiceCritereNational {
  code: string;
  noteNationale: number | null;
  id: number | null;
  ecart?: number;
  interpretation?: 'alerte' | 'coherent' | 'bonne_pratique';
  nbEnfants: number;
  nbFaritanyContributeurs: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function interpreter(ecart: number): 'alerte' | 'coherent' | 'bonne_pratique' {
  if (ecart > 30) return 'alerte';
  if (ecart < -10) return 'bonne_pratique';
  return 'coherent';
}

/**
 * Indice de Déploiement (§6). Pour chaque critère national X référencé par au
 * moins un `sourceCodes` d'un critère far ACTIF :
 *   ID(X)   = Σ_f score_f(X)·poids_f / Σ_f poids_f      (contributeurs = score_f non null)
 *   Écart(X)= noteNationale(X)·100/3 − ID(X)            (SSI note et ID définis)
 * Pure : aucune I/O. Ne modifie jamais le score GSAT.
 */
export function calculerIndiceDeploiement(
  refFar: Referentiel,
  evalsParticipantes: EvalFaritanyParticipante[],
  poids: Record<string, number>,
  notesNationales: Record<string, number | null>,
): IndiceCritereNational[] {
  // Mapping critère national → enfants far actifs (multi-parent géré).
  const enfantsParNational = new Map<string, CritereDef[]>();
  for (const dim of refFar.dimensions) {
    for (const c of dim.criteres) {
      if (!c.actif) continue;
      for (const nat of c.sourceCodes) {
        const liste = enfantsParNational.get(nat) ?? [];
        liste.push(c);
        enfantsParNational.set(nat, liste);
      }
    }
  }

  const codes = [...enfantsParNational.keys()].sort();
  return codes.map((code) => {
    const enfants = enfantsParNational.get(code) ?? [];

    let sommePondere = 0;
    let sommePoids = 0;
    let contributeurs = 0;
    for (const ev of evalsParticipantes) {
      const s = scoreSurCriteres(ev.scores, enfants);
      if (s === null) continue;           // f n'a scoré aucun enfant de X → non contributeur
      const p = poids[ev.orgId] ?? 1;
      sommePondere += s * p;
      sommePoids += p;
      contributeurs += 1;
    }
    const id = sommePoids > 0 ? round2(sommePondere / sommePoids) : null;

    const note = code in notesNationales ? notesNationales[code] : null;
    const ecart =
      note !== null && note !== undefined && id !== null
        ? round2((note * 100) / 3 - id)
        : undefined;

    return {
      code,
      noteNationale: note ?? null,
      id,
      nbEnfants: enfants.length,
      nbFaritanyContributeurs: contributeurs,
      ...(ecart !== undefined ? { ecart, interpretation: interpreter(ecart) } : {}),
    };
  });
}
