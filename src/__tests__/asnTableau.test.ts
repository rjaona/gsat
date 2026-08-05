/**
 * Tests unitaires — regroupement + quartile bas du tableau national ASN (P7).
 */

import { describe, it, expect } from 'vitest';
import { seuilQuartileBas, grouperAsnParProvince, type LigneAsn } from '@/utils/asnTableau';

function l(asnId: string, code: string, score: number, dims: Record<string, number> = {}): LigneAsn {
  return { asnId, nom: asnId, code, scoreGlobal: score, scoreParDimension: dims };
}

describe('seuilQuartileBas', () => {
  it('rend le 25e centile', () => {
    expect(seuilQuartileBas([0, 25, 50, 75, 100])).toBe(25);
  });
  it('liste vide → -Infinity', () => {
    expect(seuilQuartileBas([])).toBe(-Infinity);
  });
});

describe('grouperAsnParProvince', () => {
  const lignes = [
    l('a', 'ANT-01', 30), l('b', 'ANT-02', 70),
    l('c', 'TOA-01', 50), l('d', 'FIA-01', 90),
  ];

  it('groupe par province et ordonne selon PROVINCES (ANT avant TOA avant FIA)', () => {
    const g = grouperAsnParProvince(lignes);
    expect(g.map(x => x.prefixe)).toEqual(['ANT', 'TOA', 'FIA']);
  });

  it('trie par score global décroissant par défaut dans chaque groupe', () => {
    const ant = grouperAsnParProvince(lignes).find(g => g.prefixe === 'ANT');
    expect(ant?.lignes.map(x => x.asnId)).toEqual(['b', 'a']); // 70 avant 30
  });

  it('calcule la moyenne du groupe', () => {
    const ant = grouperAsnParProvince(lignes).find(g => g.prefixe === 'ANT');
    expect(ant?.moyenne).toBe(50); // (30+70)/2
  });

  it('peut trier par une dimension, ascendant', () => {
    const rows = [l('x', 'ANT-01', 0, { D01: 80 }), l('y', 'ANT-02', 0, { D01: 20 })];
    const ant = grouperAsnParProvince(rows, 'D01', true).find(g => g.prefixe === 'ANT');
    expect(ant?.lignes.map(r => r.asnId)).toEqual(['y', 'x']); // 20 avant 80
  });
});
