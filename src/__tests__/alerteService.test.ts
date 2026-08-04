/**
 * Tests unitaires — tri des alertes (logique pure de P6, bandeau 4).
 * Garde « triées par sévérité » + plafond 5.
 */

import { describe, it, expect } from 'vitest';
import { trierAlertes } from '@/services/alerteService';
import type { Alerte, AlerteSeverite } from '@/types';

function a(id: string, severite: AlerteSeverite, createdAt: string): Alerte {
  return { id, orgId: 'o', type: 'conformite', severite, titre: id, statut: 'ouverte', createdAt };
}

describe('trierAlertes', () => {
  it('classe critique > vigilance > info', () => {
    const out = trierAlertes([
      a('i', 'info', '2026-01-03'),
      a('c', 'critique', '2026-01-01'),
      a('v', 'vigilance', '2026-01-02'),
    ]);
    expect(out.map(x => x.id)).toEqual(['c', 'v', 'i']);
  });

  it('à sévérité égale, la plus récente d’abord', () => {
    const out = trierAlertes([
      a('vieux', 'critique', '2026-01-01'),
      a('recent', 'critique', '2026-06-01'),
    ]);
    expect(out.map(x => x.id)).toEqual(['recent', 'vieux']);
  });

  it('plafonne à 5 (et garde les plus graves)', () => {
    const many: Alerte[] = [
      ...Array.from({ length: 6 }, (_, i) => a(`info${i}`, 'info', '2026-01-01')),
      a('crit', 'critique', '2026-01-01'),
    ];
    const out = trierAlertes(many);
    expect(out).toHaveLength(5);
    expect(out[0]?.id).toBe('crit');
  });

  it('ne mute pas le tableau d’entrée', () => {
    const input = [a('i', 'info', '2026-01-01'), a('c', 'critique', '2026-01-01')];
    trierAlertes(input);
    expect(input[0]?.id).toBe('i');
  });
});
