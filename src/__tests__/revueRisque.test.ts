/**
 * Tests unitaires — tri de la file de revue nationale par RISQUE (P5), pas par date.
 */

import { describe, it, expect } from 'vitest';
import { trierParRisque, compterEcheancesProches, type SignauxOrg } from '@/utils/revueRisque';
import type { Evaluation } from '@/types';

const NOW = new Date('2026-09-01T00:00:00.000Z');

function ev(id: string, orgId: string, echeanceDansJours: number | null): Evaluation {
  return {
    id, campagneId: 'c', orgId, type: 'auto', statut: 'validee',
    clotureeAuto: false, createdBy: 'u', createdAt: '2026-01-01', updatedAt: '2026-01-01',
    ...(echeanceDansJours !== null
      ? { revueEcheanceAt: new Date(NOW.getTime() + echeanceDansJours * 86_400_000).toISOString() }
      : {}),
  };
}

describe('trierParRisque', () => {
  it('classe par risque décroissant, pas par date de création', () => {
    const evals = [ev('faible', 'orgA', 60), ev('grave', 'orgB', 60)];
    const signaux: Record<string, SignauxOrg> = {
      orgA: { nbEssentielsKO: 0, nbAlertesCritiques: 0 },
      orgB: { nbEssentielsKO: 3, nbAlertesCritiques: 2 }, // 3*10 + 2*5 = 40
    };
    const file = trierParRisque(evals, signaux, NOW);
    expect(file.map(r => r.evaluation.id)).toEqual(['grave', 'faible']);
    expect(file[0]?.risque).toBeGreaterThan(file[1]?.risque ?? 0);
  });

  it('à risque égal, l’échéance la plus proche passe devant', () => {
    const evals = [ev('loin', 'orgA', 40), ev('proche', 'orgA', 3)];
    // même org → mêmes signaux ; seule l'échéance diffère (proche ajoute +10).
    const signaux: Record<string, SignauxOrg> = { orgA: { nbEssentielsKO: 0, nbAlertesCritiques: 0 } };
    const file = trierParRisque(evals, signaux, NOW);
    expect(file[0]?.evaluation.id).toBe('proche');
  });

  it('une échéance dépassée pèse plus (risque +15) et jours négatifs', () => {
    const evals = [ev('depasse', 'orgA', -2)];
    const file = trierParRisque(evals, {}, NOW);
    expect(file[0]?.joursAvantEcheance).toBeLessThan(0);
    expect(file[0]?.risque).toBeGreaterThanOrEqual(15);
  });

  it('compterEcheancesProches compte les échéances ≤ seuil', () => {
    const file = trierParRisque([ev('a', 'o', 3), ev('b', 'o', 5), ev('c', 'o', 30)], {}, NOW);
    expect(compterEcheancesProches(file, 7)).toBe(2);
  });
});
