/**
 * Tests — fiche de préparation PDF (P8, mesure 1).
 * Garde le filtrage socle (les 42 critères du socle en mode socle) et vérifie
 * que la génération ne casse pas.
 */

import { describe, it, expect } from 'vitest';
import { critParDimension, generatePrepSheet } from '@/services/pdf/prepSheet';
import type { Referentiel, CritereDef } from '@/types';

function crit(code: string, socle: boolean, actif = true): CritereDef {
  return { code, libelle: { fr: code, en: code }, essentiel: false, actif, ordre: 1, sourceCodes: [], socle, indicateurErp: [] };
}

const ref: Referentiel = {
  version: 'far_v1_0', nom: { fr: 'Far', en: 'Far' }, actif: true,
  dimensions: [
    { code: 'D01', nom: { fr: 'D1', en: 'D1' }, ordre: 1, criteres: [crit('F1', true), crit('F2', false), crit('F3', true, false)] },
    { code: 'D02', nom: { fr: 'D2', en: 'D2' }, ordre: 2, criteres: [crit('F4', false)] }, // que des extensions
  ],
};

describe('critParDimension', () => {
  it('mode socle : ne garde que les critères socle actifs, groupés par dimension', () => {
    const g = critParDimension(ref, 'socle');
    expect(g).toHaveLength(1);                 // D02 (que extensions) exclue
    expect(g[0]?.dim.code).toBe('D01');
    expect(g[0]?.criteres.map(c => c.code)).toEqual(['F1']); // F2 hors socle, F3 inactif
  });

  it('mode complet : tous les critères actifs', () => {
    const g = critParDimension(ref, 'complet');
    expect(g.map(x => x.dim.code)).toEqual(['D01', 'D02']);
    expect(g[0]?.criteres.map(c => c.code)).toEqual(['F1', 'F2']); // F3 inactif exclu
  });
});

describe('generatePrepSheet', () => {
  it('génère un document sans erreur (au moins une page)', () => {
    const doc = generatePrepSheet(ref, 'socle', { orgName: 'ANT-01', date: '01/09/2026' });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
