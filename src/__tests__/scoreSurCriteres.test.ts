import { describe, it, expect } from 'vitest';
import { scoreSurCriteres } from '@/services/scoring';
import type { CritereDef } from '@/types';

function crit(code: string): CritereDef {
  return { code, libelle: code, description: '', essentiel: false, actif: true, sourceCodes: [] } as CritereDef;
}

describe('scoreSurCriteres — sémantique ID (absent ET N/A exclus)', () => {
  const cs = [crit('F1'), crit('F2'), crit('F3')];

  it('moyenne sur les seuls critères réellement notés', () => {
    // F1=3, F2=0, F3 absent → dénominateur = 2 (F1,F2) → (3+0)/(2*3)*100 = 50
    expect(scoreSurCriteres({ F1: 3, F2: 0 }, cs)).toBe(50);
  });

  it('exclut les N/A (note null) du dénominateur', () => {
    // F1=3, F2=null(N/A), F3=3 → dénom = 2 → (3+3)/6*100 = 100
    expect(scoreSurCriteres({ F1: 3, F2: null, F3: 3 }, cs)).toBe(100);
  });

  it('exclut les critères absents (non pénalisés comme 0)', () => {
    // seul F1=3 présent → dénom = 1 → 3/3*100 = 100 (F2,F3 absents exclus)
    expect(scoreSurCriteres({ F1: 3 }, cs)).toBe(100);
  });

  it('rend null si aucun critère réellement noté (tous absents ou N/A)', () => {
    expect(scoreSurCriteres({ F2: null }, cs)).toBeNull();
    expect(scoreSurCriteres({}, cs)).toBeNull();
  });
});
