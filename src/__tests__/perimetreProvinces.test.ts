/**
 * Tests unitaires — regroupement du périmètre par province (logique pure).
 * Couvre le « fait quand » de P2 : une campagne ASN sur la province ANT doit
 * exposer les 9 Faritany d'Antananarivo dans un seul groupe.
 */

import { describe, it, expect } from 'vitest';
import { grouperParProvince, PROVINCES } from '@/utils/perimetreProvinces';
import type { Organisation } from '@/types';

// Distribution réelle des 33 Faritany TEM (cf. scripts/seed_33_faritany.sql).
const DISTRIBUTION: Record<string, number> = {
  ANT: 9, TOA: 6, MAH: 4, FIA: 7, TOL: 4, DIA: 2, DSP: 1,
};

function makeAsn(): Organisation[] {
  const orgs: Organisation[] = [];
  for (const [prefixe, n] of Object.entries(DISTRIBUTION)) {
    for (let i = 1; i <= n; i++) {
      orgs.push({
        id: `${prefixe}-${i}`,
        type: 'ASN',
        nom: `${prefixe} Faritany ${i}`,
        code: `${prefixe}-${String(i).padStart(2, '0')}`,
        actif: true,
        poids: 1,
      });
    }
  }
  return orgs;
}

describe('grouperParProvince', () => {
  it('groupe les 33 Faritany en 7 provinces', () => {
    const groupes = grouperParProvince(makeAsn());
    expect(groupes).toHaveLength(7);
    expect(groupes.reduce((s, g) => s + g.orgs.length, 0)).toBe(33);
  });

  it('la province ANT contient exactement 9 Faritany (fait quand P2)', () => {
    const ant = grouperParProvince(makeAsn()).find(g => g.prefixe === 'ANT');
    expect(ant?.orgs).toHaveLength(9);
  });

  it('ordonne les provinces selon PROVINCES (ANT en premier)', () => {
    const groupes = grouperParProvince(makeAsn());
    expect(groupes[0]?.prefixe).toBe('ANT');
    expect(groupes.map(g => g.prefixe)).toEqual(PROVINCES.map(p => p.prefixe));
  });

  it('trie les Faritany par code au sein d’un groupe', () => {
    const ant = grouperParProvince(makeAsn()).find(g => g.prefixe === 'ANT');
    const codes = ant?.orgs.map(o => o.code);
    expect(codes).toEqual([...(codes ?? [])].sort());
  });

  it('range une organisation sans code sous le groupe « ?? »', () => {
    const orgs: Organisation[] = [
      { id: 'x', type: 'ASN', nom: 'Sans code', actif: true, poids: 1 },
    ];
    const groupes = grouperParProvince(orgs);
    expect(groupes.find(g => g.prefixe === '??')?.orgs).toHaveLength(1);
  });
});
