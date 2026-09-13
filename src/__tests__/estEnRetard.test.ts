import { describe, it, expect } from 'vitest';
import { estEnRetard } from '@/services/planActionService';

const TODAY = '2026-09-13';

describe('estEnRetard', () => {
  it('vrai si echéance passée et non terminée/bloquée', () => {
    expect(estEnRetard('en_cours', '2026-09-12', TODAY)).toBe(true);
    expect(estEnRetard('a_faire', '2026-01-01T10:00:00Z', TODAY)).toBe(true);
  });
  it('faux si echéance aujourd hui ou future', () => {
    expect(estEnRetard('en_cours', '2026-09-13', TODAY)).toBe(false);
    expect(estEnRetard('a_faire', '2026-12-01', TODAY)).toBe(false);
  });
  it('faux si terminée ou bloquée (bloquée comptée à part)', () => {
    expect(estEnRetard('termine', '2026-01-01', TODAY)).toBe(false);
    expect(estEnRetard('bloque', '2026-01-01', TODAY)).toBe(false);
  });
  it('faux si pas d echéance', () => {
    expect(estEnRetard('en_cours', null, TODAY)).toBe(false);
  });
});
