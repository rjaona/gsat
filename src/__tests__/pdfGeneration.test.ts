/**
 * Tests unitaires — generation PDF
 *
 * Verifie que generateEvaluationReport ne crash pas pour :
 * - Une evaluation complete (105 criteres, 10 dimensions)
 * - Une evaluation partielle (scores manquants)
 * - Une evaluation vide (aucun score)
 * - Une evaluation avec tous les essentiels KO
 * - FR et EN
 *
 * On ne valide pas le rendu visuel, seulement l'absence de crash
 * et la structure de base du PDF (nombre de pages, non-vide).
 */

import { describe, it, expect } from 'vitest';
import { generateEvaluationReport } from '@/services/pdf/evaluationReport';
import { generateValidationReportPdf } from '@/services/pdf/validationReport';
import type { ValidationReportInput, ValidatorInfo, ValidationStatus } from '@/services/pdf/validationReport';
import type { Referentiel, DimensionDef, Score, Evaluation } from '@/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCritere(code: string, essentiel = false) {
  return {
    code,
    libelle: { fr: `Critere ${code} description longue pour tester le wrapping du texte dans le PDF`, en: `Criterion ${code} long description to test text wrapping in PDF` },
    guideInterpretation: { fr: '', en: '' },
    essentiel,
    actif: true,
    ordre: parseInt(code.slice(-2), 10),
    socle: true,
    sourceCodes: [],
    indicateurErp: [],
  };
}

function makeDimension(code: string, nbCriteres: number, nbEssentiels = 2): DimensionDef {
  const criteres = [];
  for (let i = 1; i <= nbCriteres; i++) {
    const critCode = `${code.replace('D', '')}${String(i).padStart(2, '0')}`;
    criteres.push(makeCritere(critCode, i <= nbEssentiels));
  }
  return {
    code,
    nom: { fr: `Dimension ${code} - Nom complet en francais`, en: `Dimension ${code} - Full name in English` },
    ordre: parseInt(code.replace('D', ''), 10),
    criteres,
  };
}

function makeReferentiel(): Referentiel {
  // 10 dimensions avec des nombres varies de criteres (total ~105)
  const dims: DimensionDef[] = [];
  const nbCriteresParDim = [10, 11, 10, 10, 11, 10, 11, 10, 11, 11]; // = 105
  for (let i = 0; i < 10; i++) {
    dims.push(makeDimension(`D${String(i + 1).padStart(2, '0')}`, nbCriteresParDim[i]!, 2));
  }
  return {
    version: '3.0',
    nom: { fr: 'GSAT Version 3.0', en: 'GSAT Version 3.0' },
    actif: true,
    dimensions: dims,
  };
}

function makeEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
  return {
    id: 'eval-test-pdf-001',
    campagneId: 'campagne-test',
    orgId: 'tem-antananarivo',
    type: 'auto',
    statut: 'validee',
    scoreGlobal: 75,
    scoreParDimension: {},
    createdBy: 'user-1',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
    clotureeAuto: false,
    ...overrides,
  };
}

function makeScores(referentiel: Referentiel, noteGenerator: (code: string) => 0 | 1 | 2 | 3 | null): Score[] {
  const scores: Score[] = [];
  for (const dim of referentiel.dimensions) {
    for (const critere of dim.criteres) {
      scores.push({
        critereCode: critere.code,
        note: noteGenerator(critere.code),
        commentaire: `Commentaire pour ${critere.code}`,
        updatedBy: 'user-1',
        updatedAt: '2025-05-15T00:00:00.000Z',
      });
    }
  }
  return scores;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PDF Generation — evaluationReport', () => {
  const referentiel = makeReferentiel();

  it('genere un PDF sans crash pour une evaluation complete (105 criteres)', async () => {
    const scores = makeScores(referentiel, () => 2);

    const doc = await generateEvaluationReport({
      evaluation: makeEvaluation(),
      referentiel,
      scores,
      orgName: 'TEM Antananarivo',
      campagneName: 'Evaluation Nationale TEM 2024-2025',
      lang: 'fr',
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3); // au moins 3 pages pour 105 criteres
  });

  it('genere un PDF sans crash pour une evaluation partielle (30% remplie)', async () => {
    let count = 0;
    const scores = makeScores(referentiel, () => {
      count++;
      return count <= 30 ? 2 : null; // 30 premiers remplis, le reste null
    });

    const doc = await generateEvaluationReport({
      evaluation: makeEvaluation({ statut: 'en_cours' }),
      referentiel,
      scores,
      orgName: 'TEM Fianarantsoa',
      campagneName: 'Evaluation Nationale TEM 2024-2025',
      lang: 'fr',
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('genere un PDF sans crash pour une evaluation vide (aucun score)', async () => {
    const doc = await generateEvaluationReport({
      evaluation: makeEvaluation({ statut: 'brouillon', scoreGlobal: undefined }),
      referentiel,
      scores: [], // aucun score
      orgName: 'TEM Toliara',
      campagneName: 'Evaluation Nationale TEM 2024-2025',
      lang: 'fr',
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('genere un PDF sans crash quand tous les essentiels sont a 0 (KO)', async () => {
    const scores = makeScores(referentiel, (code) => {
      // Les essentiels (les 2 premiers de chaque dimension) a 0, le reste a 3
      const numInDim = parseInt(code.slice(-2), 10);
      return numInDim <= 2 ? 0 : 3;
    });

    const doc = await generateEvaluationReport({
      evaluation: makeEvaluation(),
      referentiel,
      scores,
      orgName: 'TEM Mahajanga',
      campagneName: 'Evaluation Nationale TEM 2024-2025',
      lang: 'fr',
    });

    expect(doc).toBeDefined();
    // Il devrait y avoir des criteres essentiels KO affiches
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('genere un PDF en anglais sans crash', async () => {
    const scores = makeScores(referentiel, () => 2);

    const doc = await generateEvaluationReport({
      evaluation: makeEvaluation(),
      referentiel,
      scores,
      orgName: 'TEM Antananarivo',
      campagneName: 'TEM National Evaluation 2024-2025',
      validatorName: 'External Validator',
      lang: 'en',
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  });

  it('genere un PDF sans crash avec des commentaires tres longs', async () => {
    const scores: Score[] = [];
    for (const dim of referentiel.dimensions) {
      for (const critere of dim.criteres) {
        scores.push({
          critereCode: critere.code,
          note: 2,
          commentaire: `Commentaire detaille pour le critere ${critere.code}. Ce commentaire est volontairement tres long pour tester le comportement du PDF quand les cellules de commentaire depassent la largeur de colonne disponible. Il devrait etre tronque ou wrape correctement sans causer de crash ou de debordement.`,
          updatedBy: 'user-1',
          updatedAt: '2025-05-15T00:00:00.000Z',
        });
      }
    }

    const doc = await generateEvaluationReport({
      evaluation: makeEvaluation(),
      referentiel,
      scores,
      orgName: 'TEM Antananarivo',
      campagneName: 'Evaluation Nationale TEM 2024-2025',
      lang: 'fr',
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  });

  it('genere un PDF avec des notes mixtes (0, 1, 2, 3, null)', async () => {
    const notes: (0 | 1 | 2 | 3 | null)[] = [0, 1, 2, 3, null];
    let idx = 0;

    const scores = makeScores(referentiel, () => {
      const note = notes[idx % notes.length]!;
      idx++;
      return note;
    });

    const doc = await generateEvaluationReport({
      evaluation: makeEvaluation(),
      referentiel,
      scores,
      orgName: 'TEM Toamasina',
      campagneName: 'Evaluation Nationale TEM 2024-2025',
      lang: 'fr',
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  });
});

// ── Tests — validationReport ─────────────────────────────────────────────────

describe('PDF Generation — validationReport', () => {
  const referentiel = makeReferentiel();

  const defaultValidator: ValidatorInfo = {
    name: 'Jean Dupont',
    role: 'Responsable Region Afrique',
    email: 'jean.dupont@wosm.org',
    date: '15 mars 2025',
  };

  function makeValidationInput(
    overrides: Partial<ValidationReportInput> = {}
  ): ValidationReportInput {
    return {
      evaluation: makeEvaluation(),
      referentiel,
      scores: makeScores(referentiel, () => 2),
      orgName: 'TEM Antananarivo',
      campagneName: 'Evaluation Nationale TEM 2024-2025',
      validator: defaultValidator,
      validationStatus: 'approved',
      lang: 'fr',
      ...overrides,
    };
  }

  it('genere un validationReport sans crash pour une evaluation complete (105 criteres)', async () => {
    // Arrange
    const input = makeValidationInput();

    // Act
    const doc = await generateValidationReportPdf(input);

    // Assert
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('genere un validationReport sans crash avec donnees vides (aucun score)', async () => {
    // Arrange
    const input = makeValidationInput({
      scores: [],
      evaluation: makeEvaluation({ scoreGlobal: undefined }),
    });

    // Act
    const doc = await generateValidationReportPdf(input);

    // Assert
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('genere un validationReport sans crash avec 105 criteres et tous essentiels KO', async () => {
    // Arrange
    const scores = makeScores(referentiel, (code) => {
      const numInDim = parseInt(code.slice(-2), 10);
      return numInDim <= 2 ? 0 : 3;
    });
    const input = makeValidationInput({ scores });

    // Act
    const doc = await generateValidationReportPdf(input);

    // Assert
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('genere un validationReport en anglais sans crash', async () => {
    // Arrange
    const input = makeValidationInput({ lang: 'en' });

    // Act
    const doc = await generateValidationReportPdf(input);

    // Assert
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('genere un validationReport avec statut "approved_with_conditions"', async () => {
    // Arrange
    const input = makeValidationInput({
      validationStatus: 'approved_with_conditions',
      validator: {
        ...defaultValidator,
        conclusion: 'L\'association doit ameliorer la dimension D05 avant la prochaine evaluation.',
      },
    });

    // Act
    const doc = await generateValidationReportPdf(input);

    // Assert
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('genere un validationReport avec statut "rejected"', async () => {
    // Arrange
    const input = makeValidationInput({
      validationStatus: 'rejected',
      validator: {
        ...defaultValidator,
        conclusion: 'L\'evaluation ne repond pas aux criteres minimaux du referentiel GSAT V3.0.',
      },
    });

    // Act
    const doc = await generateValidationReportPdf(input);

    // Assert
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('genere un validationReport sans date de validation (utilise la date du jour)', async () => {
    // Arrange
    const validatorSansDate: ValidatorInfo = {
      name: 'Marie Martin',
      role: 'Evaluatrice OMMS',
      email: 'marie.martin@wosm.org',
    };
    const input = makeValidationInput({ validator: validatorSansDate });

    // Act
    const doc = await generateValidationReportPdf(input);

    // Assert
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
