/**
 * Tests unitaires — logique de consolidation OSN
 *
 * La consolidation OSN (implementee dans onScoreWrite dans functions/src/index.ts)
 * calcule :
 * 1. Le score global OSN = moyenne des scores globaux des ASN
 * 2. Le scoreParDimension OSN = moyenne par dimension des ASN
 * 3. Le taux de completion = % d'ASN ayant des stats
 * 4. Les criteres essentiels KO au niveau OSN
 *
 * Ces tests verifient la logique pure de consolidation sans Firebase.
 */

import { describe, it, expect } from 'vitest';

// ── Replique locale de la logique de consolidation (alignee sur onScoreWrite) ─

interface AsnStats {
  orgId: string;
  scoreGlobal: number | null;
  scoreParDimension: Record<string, number>;
  criteresEssentielsKO: string[];
}

interface OsnConsolidation {
  scoreGlobal: number;
  scoreParDimension: Record<string, number>;
  nbAsn: number;
  scoresAsn: Record<string, number>;
  tauxCompletionEval: number;
}

function consolidateOsn(
  asnStatsList: AsnStats[],
  dimensionCodes: string[]
): OsnConsolidation {
  const nbAsn = asnStatsList.length;
  const scoresAsn: Record<string, number> = {};
  let totalScore = 0;
  let asnAvecScore = 0;

  for (const asn of asnStatsList) {
    if (asn.scoreGlobal !== null && asn.scoreGlobal !== undefined) {
      scoresAsn[asn.orgId] = asn.scoreGlobal;
      totalScore += asn.scoreGlobal;
      asnAvecScore++;
    }
  }

  const scoreGlobal = asnAvecScore > 0 ? Math.round(totalScore / asnAvecScore) : 0;
  const tauxCompletionEval = nbAsn > 0 ? Math.round((asnAvecScore / nbAsn) * 100) : 0;

  // Score par dimension : moyenne des ASN ayant des stats
  const scoreParDimension: Record<string, number> = {};
  for (const dimCode of dimensionCodes) {
    let dimTotal = 0;
    let dimCount = 0;
    for (const asn of asnStatsList) {
      const dimScore = asn.scoreParDimension[dimCode];
      if (dimScore !== undefined && dimScore !== null) {
        dimTotal += dimScore;
        dimCount++;
      }
    }
    scoreParDimension[dimCode] = dimCount > 0 ? Math.round(dimTotal / dimCount) : 0;
  }

  return { scoreGlobal, scoreParDimension, nbAsn, scoresAsn, tauxCompletionEval };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DIM_CODES = ['D01', 'D02', 'D03'];

function makeAsnStats(overrides: Partial<AsnStats> & { orgId: string }): AsnStats {
  return {
    scoreGlobal: null,
    scoreParDimension: {},
    criteresEssentielsKO: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Consolidation OSN — moyenne des scores ASN', () => {
  it('calcule la moyenne de 3 ASN avec des scores differents', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1', scoreGlobal: 80, scoreParDimension: { D01: 90, D02: 80, D03: 70 } }),
      makeAsnStats({ orgId: 'asn-2', scoreGlobal: 60, scoreParDimension: { D01: 70, D02: 60, D03: 50 } }),
      makeAsnStats({ orgId: 'asn-3', scoreGlobal: 40, scoreParDimension: { D01: 50, D02: 40, D03: 30 } }),
    ];

    const result = consolidateOsn(asnStats, DIM_CODES);

    expect(result.scoreGlobal).toBe(60); // (80+60+40)/3
    expect(result.scoreParDimension['D01']).toBe(70); // (90+70+50)/3
    expect(result.scoreParDimension['D02']).toBe(60); // (80+60+40)/3
    expect(result.scoreParDimension['D03']).toBe(50); // (70+50+30)/3
    expect(result.nbAsn).toBe(3);
    expect(result.tauxCompletionEval).toBe(100);
  });

  it('ignore les ASN sans score (scoreGlobal null) dans le calcul de la moyenne', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1', scoreGlobal: 80, scoreParDimension: { D01: 90, D02: 80, D03: 70 } }),
      makeAsnStats({ orgId: 'asn-2', scoreGlobal: null, scoreParDimension: {} }),
      makeAsnStats({ orgId: 'asn-3', scoreGlobal: 60, scoreParDimension: { D01: 70, D02: 60, D03: 50 } }),
    ];

    const result = consolidateOsn(asnStats, DIM_CODES);

    expect(result.scoreGlobal).toBe(70); // (80+60)/2, ASN-2 ignore
    expect(result.nbAsn).toBe(3);
    expect(result.tauxCompletionEval).toBe(67); // 2/3 = 66.67 -> 67%
  });

  it('retourne 0 quand aucune ASN n\'a de score', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1' }),
      makeAsnStats({ orgId: 'asn-2' }),
    ];

    const result = consolidateOsn(asnStats, DIM_CODES);

    expect(result.scoreGlobal).toBe(0);
    expect(result.tauxCompletionEval).toBe(0);
    expect(result.scoreParDimension['D01']).toBe(0);
  });

  it('retourne 0 quand la liste d\'ASN est vide', () => {
    const result = consolidateOsn([], DIM_CODES);

    expect(result.scoreGlobal).toBe(0);
    expect(result.nbAsn).toBe(0);
    expect(result.tauxCompletionEval).toBe(0);
  });
});

describe('Consolidation OSN — taux de completion', () => {
  it('100% quand toutes les ASN ont un score', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1', scoreGlobal: 80 }),
      makeAsnStats({ orgId: 'asn-2', scoreGlobal: 60 }),
    ];

    const result = consolidateOsn(asnStats, []);
    expect(result.tauxCompletionEval).toBe(100);
  });

  it('50% quand la moitie des ASN ont un score', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1', scoreGlobal: 80 }),
      makeAsnStats({ orgId: 'asn-2' }),
      makeAsnStats({ orgId: 'asn-3', scoreGlobal: 60 }),
      makeAsnStats({ orgId: 'asn-4' }),
    ];

    const result = consolidateOsn(asnStats, []);
    expect(result.tauxCompletionEval).toBe(50);
  });

  it('arrondit le taux de completion', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1', scoreGlobal: 80 }),
      makeAsnStats({ orgId: 'asn-2' }),
      makeAsnStats({ orgId: 'asn-3' }),
    ];

    const result = consolidateOsn(asnStats, []);
    expect(result.tauxCompletionEval).toBe(33); // 1/3 = 33.33 -> 33%
  });
});

describe('Consolidation OSN — scoresAsn (map orgId -> score)', () => {
  it('ne contient que les ASN avec un score', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1', scoreGlobal: 80 }),
      makeAsnStats({ orgId: 'asn-2' }),
      makeAsnStats({ orgId: 'asn-3', scoreGlobal: 60 }),
    ];

    const result = consolidateOsn(asnStats, []);

    expect(result.scoresAsn).toEqual({ 'asn-1': 80, 'asn-3': 60 });
    expect(result.scoresAsn['asn-2']).toBeUndefined();
  });
});

describe('Consolidation OSN — score par dimension', () => {
  it('calcule la moyenne par dimension en ignorant les ASN sans donnees pour cette dimension', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1', scoreGlobal: 80, scoreParDimension: { D01: 90, D02: 80 } }),
      makeAsnStats({ orgId: 'asn-2', scoreGlobal: 60, scoreParDimension: { D01: 70 } }), // pas de D02
      makeAsnStats({ orgId: 'asn-3', scoreGlobal: 40, scoreParDimension: { D01: 50, D02: 40 } }),
    ];

    const result = consolidateOsn(asnStats, ['D01', 'D02']);

    expect(result.scoreParDimension['D01']).toBe(70); // (90+70+50)/3
    expect(result.scoreParDimension['D02']).toBe(60); // (80+40)/2, ASN-2 pas de D02
  });

  it('retourne 0 pour une dimension sans aucune donnee ASN', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1', scoreGlobal: 80, scoreParDimension: { D01: 90 } }),
    ];

    const result = consolidateOsn(asnStats, ['D01', 'D02', 'D03']);

    expect(result.scoreParDimension['D01']).toBe(90);
    expect(result.scoreParDimension['D02']).toBe(0); // aucune ASN n'a D02
    expect(result.scoreParDimension['D03']).toBe(0);
  });

  it('arrondit les moyennes par dimension', () => {
    const asnStats = [
      makeAsnStats({ orgId: 'asn-1', scoreGlobal: 80, scoreParDimension: { D01: 90 } }),
      makeAsnStats({ orgId: 'asn-2', scoreGlobal: 60, scoreParDimension: { D01: 80 } }),
      makeAsnStats({ orgId: 'asn-3', scoreGlobal: 40, scoreParDimension: { D01: 70 } }),
    ];

    const result = consolidateOsn(asnStats, ['D01']);

    // (90+80+70)/3 = 80 exactement
    expect(result.scoreParDimension['D01']).toBe(80);
  });
});

describe('Consolidation OSN — scenario TEM Madagascar (donnees seed)', () => {
  it('reproduit les stats OSN TEM a partir des 6 ASN du seed', () => {
    const asnStats = [
      makeAsnStats({
        orgId: 'tem-antananarivo',
        scoreGlobal: 85,
        scoreParDimension: { D01: 92, D02: 88, D03: 84, D04: 90, D05: 78, D06: 85, D07: 82, D08: 88, D09: 80, D10: 83 },
      }),
      makeAsnStats({
        orgId: 'tem-fianarantsoa',
        scoreGlobal: 72,
        scoreParDimension: { D01: 78, D02: 70, D03: 74, D04: 76, D05: 65, D06: 72, D07: 68, D08: 75, D09: 70, D10: 68 },
      }),
      makeAsnStats({
        orgId: 'tem-toamasina',
        scoreGlobal: 61,
        scoreParDimension: { D01: 68, D02: 60, D03: 63, D04: 65, D05: 55, D06: 62, D07: 58, D08: 64, D09: 58, D10: 57 },
      }),
      makeAsnStats({
        orgId: 'tem-mahajanga',
        scoreGlobal: 54,
        scoreParDimension: { D01: 60, D02: 52, D03: 55, D04: 58, D05: 48, D06: 55, D07: 50, D08: 56, D09: 52, D10: 50 },
      }),
      makeAsnStats({ orgId: 'tem-toliara', scoreGlobal: null, scoreParDimension: {} }),
      makeAsnStats({ orgId: 'tem-antsiranana', scoreGlobal: null, scoreParDimension: {} }),
    ];

    const dimCodes = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10'];
    const result = consolidateOsn(asnStats, dimCodes);

    // 4 ASN avec scores, 2 sans
    expect(result.nbAsn).toBe(6);
    expect(result.tauxCompletionEval).toBe(67); // 4/6 = 66.67 -> 67%

    // Moyenne des 4 ASN : (85+72+61+54)/4 = 272/4 = 68
    expect(result.scoreGlobal).toBe(68);

    // D01 moyenne : (92+78+68+60)/4 = 298/4 = 74.5 -> 75
    expect(result.scoreParDimension['D01']).toBe(75);

    // Toliara et Antsiranana non incluses dans scoresAsn
    expect(Object.keys(result.scoresAsn)).toHaveLength(4);
    expect(result.scoresAsn['tem-toliara']).toBeUndefined();
    expect(result.scoresAsn['tem-antsiranana']).toBeUndefined();
  });
});
