/**
 * Tests — rapport PDF de l'Indice de Déploiement (§6).
 * Vérifie que la génération ne casse pas et produit les 2 sections
 * (section 2 sur une page paysage dédiée).
 */

import { describe, it, expect } from 'vitest';
import { generateIndiceReport } from '@/services/pdf/indiceReport';
import type { IndiceCritereNational } from '@/services/indice/calculerIndiceDeploiement';
import type { LigneAsn } from '@/utils/asnTableau';

const national: IndiceCritereNational[] = [
  { code: '401', noteNationale: 3, id: 75, ecart: 25, interpretation: 'coherent', nbEnfants: 2, nbFaritanyContributeurs: 3 },
  { code: '706', noteNationale: null, id: 40, nbEnfants: 1, nbFaritanyContributeurs: 2 },
];
const faritany: LigneAsn[] = [
  { asnId: 'A', nom: 'Antananarivo I', scoreGlobal: 80, scoreParDimension: { D01: 80, D02: 60 }, code: 'ANT-01' },
  { asnId: 'B', nom: 'Fianarantsoa II', scoreGlobal: 30, scoreParDimension: { D01: 30, D02: 20 }, code: 'FIA-07' },
];
const dimensionCodes = ['D01', 'D02'];

describe('generateIndiceReport', () => {
  it('génère un rapport à 2 sections (page nationale + page comparaison paysage)', () => {
    const doc = generateIndiceReport({ national, faritany, dimensionCodes, niveauLabel: 'Faritany', date: '17/08/2026' });
    // Section 2 est forcée sur une nouvelle page → au moins 2 pages.
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('ne casse pas avec des données vides', () => {
    const doc = generateIndiceReport({ national: [], faritany: [], dimensionCodes: [] });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
  });

  it('la page comparaison est en paysage (largeur > hauteur)', () => {
    const doc = generateIndiceReport({ national, faritany, dimensionCodes });
    // La dernière page (comparaison) doit être plus large que haute.
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    expect(w).toBeGreaterThan(h);
  });
});
