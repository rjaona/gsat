/**
 * Tests unitaires — scoring GSAT.
 *
 * Ce fichier remplace l'ancien src/__tests__/scoring.test.ts. Trois cas ont été
 * RÉÉCRITS DÉLIBÉRÉMENT parce qu'ils encodaient la sémantique fautive « N/A = 0 »
 * (défaut C4 de la note de conception). Ils sont signalés par « ⚠️ SÉMANTIQUE
 * CHANGÉE » ci-dessous.
 *
 * Rappel de la sémantique :
 *   clé absente        → non répondu → 0, plein poids
 *   valeur null        → N/A         → hors numérateur ET hors dénominateur
 *   valeur 0..3        → note
 */

import { describe, it, expect } from 'vitest';
import {
  calculerScoreDimension,
  calculerScoreGlobal,
  getCriteresEssentielsKO,
  calculerAvancement,
  formatScore,
} from '@/services/scoring';
import type { DimensionDef, Referentiel } from '@/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDimension(
  code: string,
  criteres: { code: string; actif: boolean; essentiel?: boolean; socle?: boolean }[],
): DimensionDef {
  return {
    code,
    nom: { fr: `Dimension ${code}`, en: `Dimension ${code}` },
    ordre: 1,
    criteres: criteres.map((c, i) => ({
      code: c.code,
      libelle: { fr: `Critere ${c.code}`, en: `Criterion ${c.code}` },
      essentiel: c.essentiel ?? false,
      socle: c.socle ?? true,
      actif: c.actif,
      ordre: i + 1,
      sourceCodes: [],
      indicateurErp: [],
    })),
  } as unknown as DimensionDef;
}

function makeReferentiel(dimensions: DimensionDef[]): Referentiel {
  return {
    version: 'far_v1_0',
    nom: { fr: 'Referentiel test', en: 'Test referential' },
    actif: true,
    dimensions,
  };
}

// ── C4 — le cœur du correctif : N/A ≠ 0 ──────────────────────────────────────

describe('C4 — un N/A sort du dénominateur', () => {
  it('7 critères, 6 notés 3 et 1 en N/A → 100 (et non 85,71)', () => {
    const dim = makeDimension('D04', [
      { code: 'F401', actif: true }, { code: 'F402', actif: true },
      { code: 'F403', actif: true }, { code: 'F404', actif: true },
      { code: 'F405', actif: true }, { code: 'F406', actif: true },
      { code: 'F407', actif: true },
    ]);
    const scores = {
      F401: 3, F402: 3, F403: 3, F404: 3, F405: 3, F406: 3, F407: null,
    };
    expect(calculerScoreDimension(scores, dim)).toBe(100);
  });

  it('distingue « non répondu » (0, plein poids) de « N/A » (exclu)', () => {
    const dim = makeDimension('D01', [
      { code: 'F101', actif: true }, { code: 'F102', actif: true },
    ]);
    // F102 absent = pas répondu → 3/6 = 50
    expect(calculerScoreDimension({ F101: 3 }, dim)).toBe(50);
    // F102 explicitement N/A → 3/3 = 100
    expect(calculerScoreDimension({ F101: 3, F102: null }, dim)).toBe(100);
  });

  it('⚠️ SÉMANTIQUE CHANGÉE — dimension entièrement N/A rend null, plus 0', () => {
    const dim = makeDimension('D05', [
      { code: 'F501', actif: true }, { code: 'F502', actif: true },
    ]);
    expect(calculerScoreDimension({ F501: null, F502: null }, dim)).toBeNull();
  });

  it('une dimension N/A est exclue de la moyenne globale, pas comptée 0', () => {
    const ref = makeReferentiel([
      makeDimension('D01', [{ code: 'F101', actif: true }]),
      makeDimension('D02', [{ code: 'F201', actif: true }]),
      makeDimension('D03', [{ code: 'F301', actif: true }]),
    ]);
    // D01 = 100, D02 = 100, D03 entièrement N/A → moyenne sur 2 dimensions
    expect(calculerScoreGlobal({ F101: 3, F201: 3, F301: null }, ref)).toBe(100);
    // contrôle : si D03 était comptée 0, on aurait 66,67
  });

  it('⚠️ SÉMANTIQUE CHANGÉE — un essentiel N/A n\'est pas KO', () => {
    const ref = makeReferentiel([
      makeDimension('D01', [
        { code: 'F101', actif: true, essentiel: true },
        { code: 'F102', actif: true, essentiel: true },
        { code: 'F103', actif: true, essentiel: false },
      ]),
    ]);
    expect(getCriteresEssentielsKO({ F101: null, F102: null, F103: null }, ref)).toEqual([]);
  });

  it('un essentiel non répondu reste KO', () => {
    const ref = makeReferentiel([
      makeDimension('D01', [
        { code: 'F101', actif: true, essentiel: true },
        { code: 'F102', actif: true, essentiel: true },
      ]),
    ]);
    expect(getCriteresEssentielsKO({}, ref)).toEqual(['F101', 'F102']);
  });

  it('un essentiel noté 0 est KO', () => {
    const ref = makeReferentiel([
      makeDimension('D01', [
        { code: 'F101', actif: true, essentiel: true },
        { code: 'F102', actif: true, essentiel: false },
      ]),
    ]);
    expect(getCriteresEssentielsKO({ F101: 0, F102: 0 }, ref)).toEqual(['F101']);
  });

  it('⚠️ SÉMANTIQUE CHANGÉE — score global 0 quand TOUTES les dimensions sont N/A', () => {
    const ref = makeReferentiel([
      makeDimension('D01', [{ code: 'F101', actif: true }]),
      makeDimension('D02', [{ code: 'F201', actif: true }]),
    ]);
    // aucune dimension comptable → 0 par convention (et non NaN)
    expect(calculerScoreGlobal({ F101: null, F201: null }, ref)).toBe(0);
  });
});

// ── Mode socle ────────────────────────────────────────────────────────────────

describe('Mode campagne socle', () => {
  const dim = makeDimension('D05', [
    { code: 'F501', actif: true, socle: true },
    { code: 'F502', actif: true, socle: false },
    { code: 'F503', actif: true, socle: false },
    { code: 'F504', actif: true, socle: false },
    { code: 'F505', actif: true, socle: false },
  ]);

  it('ne compte que les critères du socle', () => {
    // socle : 3/3 = 100
    expect(calculerScoreDimension({ F501: 3 }, dim, 'socle')).toBe(100);
    // complet : 3/15 = 20
    expect(calculerScoreDimension({ F501: 3 }, dim, 'complet')).toBe(20);
  });

  it('une note d\'extension est stockée mais n\'influence pas le score en mode socle', () => {
    const avecExtension = { F501: 3, F502: 0, F503: 0, F504: 0, F505: 0 };
    expect(calculerScoreDimension(avecExtension, dim, 'socle')).toBe(100);
  });

  it('un essentiel hors socle n\'est pas KO en mode socle', () => {
    const ref = makeReferentiel([
      makeDimension('D01', [
        { code: 'F101', actif: true, essentiel: true, socle: true },
        { code: 'F102', actif: true, essentiel: true, socle: false },
      ]),
    ]);
    expect(getCriteresEssentielsKO({}, ref, 'socle')).toEqual(['F101']);
    expect(getCriteresEssentielsKO({}, ref, 'complet')).toEqual(['F101', 'F102']);
  });
});

// ── Parité avec le trigger SQL ────────────────────────────────────────────────

describe('Parité avec fn_recalculate_scores (PostgreSQL)', () => {
  it('arrondit au centième, comme ROUND(x, 2)', () => {
    const dim = makeDimension('D01', [
      { code: 'a', actif: true }, { code: 'b', actif: true }, { code: 'c', actif: true },
    ]);
    // 5 / 9 = 55,555… → 55.56
    expect(calculerScoreDimension({ a: 2, b: 2, c: 1 }, dim)).toBe(55.56);
  });

  it('reproduit le cas vérifié en base : D04 socle, F401 à 0, reste à 3 → 85,71', () => {
    const dim = makeDimension('D04', [
      { code: 'F401', actif: true }, { code: 'F402', actif: true },
      { code: 'F403', actif: true }, { code: 'F404', actif: true },
      { code: 'F405', actif: true }, { code: 'F406', actif: true },
      { code: 'F407', actif: true },
    ]);
    const scores = { F401: 0, F402: 3, F403: 3, F404: 3, F405: 3, F406: 3, F407: 3 };
    expect(calculerScoreDimension(scores, dim)).toBe(85.71);
  });

  it('reproduit le score global vérifié en base : 9 dimensions à 100 + 1 à 85,71 → 98,57', () => {
    const dims = Array.from({ length: 9 }, (_, i) =>
      makeDimension(`D0${i + 1}`, [{ code: `X${i}`, actif: true }]),
    );
    dims.push(makeDimension('D10', [
      { code: 'F401', actif: true }, { code: 'F402', actif: true },
      { code: 'F403', actif: true }, { code: 'F404', actif: true },
      { code: 'F405', actif: true }, { code: 'F406', actif: true },
      { code: 'F407', actif: true },
    ]));
    const scores: Record<string, number | null> = {};
    for (let i = 0; i < 9; i++) scores[`X${i}`] = 3;
    Object.assign(scores, { F401: 0, F402: 3, F403: 3, F404: 3, F405: 3, F406: 3, F407: 3 });
    expect(calculerScoreGlobal(scores, makeReferentiel(dims))).toBe(98.57);
  });
});

// ── Cas préservés de l'ancienne suite ─────────────────────────────────────────

describe('Cas historiques — comportement inchangé', () => {
  it('critères absents du map comptés 0', () => {
    const dim = makeDimension('D01', [
      { code: '101', actif: true }, { code: '102', actif: true },
      { code: '103', actif: true }, { code: '104', actif: true },
      { code: '105', actif: true },
    ]);
    expect(calculerScoreDimension({ '101': 3, '102': 3 }, dim)).toBe(40);
  });

  it('dimension à un seul critère : 0 / 33,33 / 66,67 / 100', () => {
    const dim = makeDimension('D01', [{ code: '101', actif: true }]);
    expect(calculerScoreDimension({ '101': 0 }, dim)).toBe(0);
    expect(calculerScoreDimension({ '101': 1 }, dim)).toBe(33.33);
    expect(calculerScoreDimension({ '101': 2 }, dim)).toBe(66.67);
    expect(calculerScoreDimension({ '101': 3 }, dim)).toBe(100);
  });

  it('dimension vide ou entièrement inactive rend null', () => {
    expect(calculerScoreDimension({}, makeDimension('D01', []))).toBeNull();
    expect(
      calculerScoreDimension({ '201': 3 }, makeDimension('D02', [{ code: '201', actif: false }])),
    ).toBeNull();
  });

  it('référentiel sans dimension : 0, pas NaN', () => {
    expect(calculerScoreGlobal({}, makeReferentiel([]))).toBe(0);
  });

  it('le score global peut être élevé même avec tous les essentiels à 0', () => {
    const ref = makeReferentiel([
      makeDimension('D01', [
        { code: '101', actif: true, essentiel: true },
        { code: '102', actif: true, essentiel: false },
      ]),
    ]);
    expect(calculerScoreGlobal({ '101': 0, '102': 3 }, ref)).toBe(50);
    expect(getCriteresEssentielsKO({ '101': 0, '102': 3 }, ref)).toEqual(['101']);
  });
});

// ── Avancement et affichage ───────────────────────────────────────────────────

describe('Avancement et affichage', () => {
  it('un N/A compte comme une réponse dans l\'avancement', () => {
    const ref = makeReferentiel([
      makeDimension('D01', [
        { code: 'F101', actif: true }, { code: 'F102', actif: true },
        { code: 'F103', actif: true }, { code: 'F104', actif: true },
      ]),
    ]);
    expect(calculerAvancement({ F101: 3, F102: null }, ref))
      .toEqual({ repondus: 2, total: 4, pourcentage: 50 });
  });

  it('l\'avancement suit le mode de campagne', () => {
    const ref = makeReferentiel([
      makeDimension('D01', [
        { code: 'F101', actif: true, socle: true },
        { code: 'F102', actif: true, socle: false },
      ]),
    ]);
    expect(calculerAvancement({ F101: 3 }, ref, 'socle').total).toBe(1);
    expect(calculerAvancement({ F101: 3 }, ref, 'complet').total).toBe(2);
  });

  it('formatScore arrondit pour l\'affichage et gère le null', () => {
    expect(formatScore(85.71)).toBe('86%');
    expect(formatScore(0)).toBe('0%');
    expect(formatScore(null)).toBe('—');
  });
});
