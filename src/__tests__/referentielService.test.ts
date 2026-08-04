/**
 * Tests unitaires — referentielService.ts
 * Couvre : calculerScoreDimension, calculerScoreGlobal, getCriteresEssentielsKO
 * Ces fonctions sont pures : aucun mock Firebase nécessaire.
 */

import { describe, it, expect } from 'vitest';
import {
  calculerScoreDimension,
  calculerScoreGlobal,
  getCriteresEssentielsKO,
} from '@/services/referentielService';
import type { DimensionDef, Referentiel } from '@/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDimension(criteres: { code: string; actif: boolean }[]): DimensionDef {
  return {
    code: 'D01',
    nom: { fr: 'Dimension test', en: 'Test dimension' },
    ordre: 1,
    criteres: criteres.map(c => ({
      code: c.code,
      libelle: { fr: `Critère ${c.code}`, en: `Criterion ${c.code}` },
      essentiel: false,
      actif: c.actif,
      ordre: 1,
      socle: true,
      sourceCodes: [],
      indicateurErp: [],
    })),
  };
}

function makeReferentiel(dimensions: DimensionDef[]): Referentiel {
  return {
    version: '3.0',
    nom: { fr: 'Référentiel test', en: 'Test referential' },
    actif: true,
    dimensions,
  };
}

// ── calculerScoreDimension ────────────────────────────────────────────────────

describe('calculerScoreDimension', () => {
  it('retourne 0 quand toutes les notes sont à 0', () => {
    // Arrange
    const dim = makeDimension([
      { code: '101', actif: true },
      { code: '102', actif: true },
    ]);
    const scores: Record<string, number | null> = { '101': 0, '102': 0 };

    // Act
    const result = calculerScoreDimension(scores, dim);

    // Assert
    expect(result).toBe(0);
  });

  it('retourne 100 quand toutes les notes sont à 3 (note maximale)', () => {
    // Arrange
    const dim = makeDimension([
      { code: '101', actif: true },
      { code: '102', actif: true },
    ]);
    const scores: Record<string, number | null> = { '101': 3, '102': 3 };

    // Act
    const result = calculerScoreDimension(scores, dim);

    // Assert
    expect(result).toBe(100);
  });

  it('calcule correctement un score avec des notes mixtes', () => {
    // Arrange : 2 critères, notes 0 et 3 → total = 3, max = 6 → 50%
    const dim = makeDimension([
      { code: '101', actif: true },
      { code: '102', actif: true },
    ]);
    const scores: Record<string, number | null> = { '101': 0, '102': 3 };

    // Act
    const result = calculerScoreDimension(scores, dim);

    // Assert
    expect(result).toBe(50);
  });

  it('exclut du dénominateur un critère N/A (note null)', () => {
    // Arrange : notes 1 et null → total = 1, max = 6 → 17% (arrondi)
    const dim = makeDimension([
      { code: '101', actif: true },
      { code: '102', actif: true },
    ]);
    const scores: Record<string, number | null> = { '101': 1, '102': null };

    // Act
    const result = calculerScoreDimension(scores, dim);

    // Assert : Math.round(1/6*100) = Math.round(16.67) = 17
    // C4 — le N/A sort du numérateur ET du dénominateur : 1/3, et non 1/6.
    expect(result).toBe(33.33);
  });

  it('traite les critères non présents dans scores comme note 0', () => {
    // Arrange : critère absent du map scores → vaut 0
    const dim = makeDimension([
      { code: '101', actif: true },
      { code: '102', actif: true },
    ]);
    const scores: Record<string, number | null> = { '101': 3 }; // '102' absent

    // Act
    const result = calculerScoreDimension(scores, dim);

    // Assert : total = 3, max = 6 → 50%
    expect(result).toBe(50);
  });

  it('retourne null quand aucun critère n\'est comptable (division par zéro évitée)', () => {
    // Arrange : tous les critères sont inactifs
    const dim = makeDimension([
      { code: '101', actif: false },
      { code: '102', actif: false },
    ]);
    const scores: Record<string, number | null> = { '101': 3, '102': 3 };

    // Act
    const result = calculerScoreDimension(scores, dim);

    // Assert
    // null = dimension non comptable, exclue de la moyenne globale — et non notée 0.
    expect(result).toBeNull();
  });

  it('retourne null quand la dimension n\'a aucun critère', () => {
    // Arrange
    const dim = makeDimension([]);
    const scores: Record<string, number | null> = {};

    // Act
    const result = calculerScoreDimension(scores, dim);

    // Assert
    expect(result).toBeNull();
  });

  it('ignore les critères inactifs dans le calcul', () => {
    // Arrange : 1 actif à 3, 1 inactif à 0 → total = 3, max = 3 → 100%
    const dim = makeDimension([
      { code: '101', actif: true },
      { code: '102', actif: false },
    ]);
    const scores: Record<string, number | null> = { '101': 3, '102': 0 };

    // Act
    const result = calculerScoreDimension(scores, dim);

    // Assert
    expect(result).toBe(100);
  });

  it('arrondit au centième, comme le ROUND(x, 2) du trigger SQL', () => {
    // Arrange : 3 critères, notes 1/1/1 → total = 3, max = 9 → 33.33% → arrondi à 33
    const dim = makeDimension([
      { code: '101', actif: true },
      { code: '102', actif: true },
      { code: '103', actif: true },
    ]);
    const scores: Record<string, number | null> = { '101': 1, '102': 1, '103': 1 };

    // Act
    const result = calculerScoreDimension(scores, dim);

    // Assert
    // La précision vit dans la donnée ; formatScore() arrondit à l’affichage.
    expect(result).toBe(33.33);
  });
});

// ── calculerScoreGlobal ───────────────────────────────────────────────────────

describe('calculerScoreGlobal', () => {
  it('retourne 0 quand toutes les notes sont à 0 sur toutes les dimensions', () => {
    // Arrange
    const dim1 = makeDimension([{ code: '101', actif: true }]);
    const dim2 = { ...makeDimension([{ code: '201', actif: true }]), code: 'D02' };
    const ref = makeReferentiel([dim1, dim2]);
    const scores: Record<string, number | null> = { '101': 0, '201': 0 };

    // Act
    const result = calculerScoreGlobal(scores, ref);

    // Assert
    expect(result).toBe(0);
  });

  it('retourne 100 quand toutes les notes sont à 3 sur toutes les dimensions', () => {
    // Arrange
    const dim1 = makeDimension([{ code: '101', actif: true }]);
    const dim2 = { ...makeDimension([{ code: '201', actif: true }]), code: 'D02' };
    const ref = makeReferentiel([dim1, dim2]);
    const scores: Record<string, number | null> = { '101': 3, '201': 3 };

    // Act
    const result = calculerScoreGlobal(scores, ref);

    // Assert
    expect(result).toBe(100);
  });

  it('calcule le score global comme moyenne des scores de dimensions', () => {
    // Arrange : D01 → 100%, D02 → 0% → moyenne = 50%
    const dim1 = makeDimension([{ code: '101', actif: true }]);
    const dim2 = { ...makeDimension([{ code: '201', actif: true }]), code: 'D02' };
    const ref = makeReferentiel([dim1, dim2]);
    const scores: Record<string, number | null> = { '101': 3, '201': 0 };

    // Act
    const result = calculerScoreGlobal(scores, ref);

    // Assert
    expect(result).toBe(50);
  });

  it('arrondit le score global au centième, comme le trigger SQL', () => {
    // Arrange : D01 → 100%, D02 → 0%, D03 → 0% → moyenne = 33.33% → 33
    const dim1 = makeDimension([{ code: '101', actif: true }]);
    const dim2 = { ...makeDimension([{ code: '201', actif: true }]), code: 'D02' };
    const dim3 = { ...makeDimension([{ code: '301', actif: true }]), code: 'D03' };
    const ref = makeReferentiel([dim1, dim2, dim3]);
    const scores: Record<string, number | null> = { '101': 3, '201': 0, '301': 0 };

    // Act
    const result = calculerScoreGlobal(scores, ref);

    // Assert
    expect(result).toBe(33.33);
  });

  it('exclut de la moyenne globale une dimension entièrement N/A', () => {
    // Arrange : D01 → note null → 0%, D02 → note 3 → 100% → moyenne = 50%
    const dim1 = makeDimension([{ code: '101', actif: true }]);
    const dim2 = { ...makeDimension([{ code: '201', actif: true }]), code: 'D02' };
    const ref = makeReferentiel([dim1, dim2]);
    const scores: Record<string, number | null> = { '101': null, '201': 3 };

    // Act
    const result = calculerScoreGlobal(scores, ref);

    // Assert
    // C4 — D01 entièrement N/A : non comptable, retirée de la moyenne. Reste D02 = 100.
    expect(result).toBe(100);
  });
});

// ── getCriteresEssentielsKO ───────────────────────────────────────────────────

describe('getCriteresEssentielsKO', () => {
  function makeDimensionAvecEssentiels(
    criteres: { code: string; essentiel: boolean; actif: boolean }[]
  ): DimensionDef {
    return {
      code: 'D01',
      nom: { fr: 'Dimension test', en: 'Test dimension' },
      ordre: 1,
      criteres: criteres.map(c => ({
        code: c.code,
        libelle: { fr: `Critère ${c.code}`, en: `Criterion ${c.code}` },
        essentiel: c.essentiel,
        actif: c.actif,
        ordre: 1,
        socle: true,
        sourceCodes: [],
        indicateurErp: [],
      })),
    };
  }

  it('inclut dans la liste KO un critère essentiel avec note 0', () => {
    // Arrange
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: true, actif: true },
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = { '101': 0 };

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    expect(result).toContain('101');
    expect(result).toHaveLength(1);
  });

  it('n\'inclut pas un critère essentiel avec note 1', () => {
    // Arrange
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: true, actif: true },
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = { '101': 1 };

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    expect(result).not.toContain('101');
    expect(result).toHaveLength(0);
  });

  it('n\'inclut pas un critère essentiel avec note 2', () => {
    // Arrange
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: true, actif: true },
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = { '101': 2 };

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    expect(result).not.toContain('101');
  });

  it('n\'inclut pas un critère essentiel avec note 3 (note maximale)', () => {
    // Arrange
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: true, actif: true },
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = { '101': 3 };

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    expect(result).not.toContain('101');
  });

  it('n\'inclut pas un critère NON essentiel avec note 0', () => {
    // Arrange
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: false, actif: true },
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = { '101': 0 };

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    expect(result).not.toContain('101');
    expect(result).toHaveLength(0);
  });

  it('un critère essentiel en N/A n\'est PAS non conforme', () => {
    // Arrange : note null → ?? 0 → critère essentiel KO
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: true, actif: true },
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = { '101': null };

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    // « Non applicable » ne veut pas dire « non conforme ». Seules la note 0 et
    expect(result).not.toContain('101');
    expect(result).toHaveLength(0);
  });

  it('traite un critère essentiel absent du map scores comme note 0 → dans la liste KO', () => {
    // Arrange : code absent → note ?? 0 → KO
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: true, actif: true },
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = {};

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    expect(result).toContain('101');
  });

  it('n\'inclut pas un critère essentiel INACTIF avec note 0', () => {
    // Arrange : critère inactif → filtré par getCriteresEssentiels (actif: true requis)
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: true, actif: false },
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = { '101': 0 };

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    expect(result).not.toContain('101');
    expect(result).toHaveLength(0);
  });

  it('retourne une liste vide quand le référentiel n\'a aucun critère essentiel actif', () => {
    // Arrange
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: false, actif: true },
      { code: '102', essentiel: true, actif: false },
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = { '101': 0, '102': 0 };

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    expect(result).toHaveLength(0);
  });

  it('retourne uniquement les critères essentiels KO parmi un mélange', () => {
    // Arrange
    const dim = makeDimensionAvecEssentiels([
      { code: '101', essentiel: true, actif: true },  // note 0 → KO
      { code: '102', essentiel: true, actif: true },  // note 2 → OK
      { code: '103', essentiel: false, actif: true }, // note 0, non essentiel → ignoré
      { code: '104', essentiel: true, actif: true },  // note null (N/A) → PAS KO
    ]);
    const ref = makeReferentiel([dim]);
    const scores: Record<string, number | null> = {
      '101': 0,
      '102': 2,
      '103': 0,
      '104': null,
    };

    // Act
    const result = getCriteresEssentielsKO(scores, ref);

    // Assert
    expect(result).toContain('101');
    expect(result).not.toContain('104');
    expect(result).not.toContain('102');
    expect(result).not.toContain('103');
    expect(result).toHaveLength(1);
  });
});
