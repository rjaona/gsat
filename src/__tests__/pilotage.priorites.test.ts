import { describe, it, expect } from 'vitest';
import { ordonnerPrioritesRegionales, type PrioriteItem } from '@/utils/pilotage';

describe('ordonnerPrioritesRegionales', () => {
  it('KO d\'abord, puis bloquées, puis retard (échéance la plus ancienne), priorité en départage', () => {
    const items: PrioriteItem[] = [
      { kind: 'action', id: 'r2', titre: 'retard récent', statut: 'en_cours', dateEcheance: '2026-09-10', priorite: 'moyenne' },
      { kind: 'action', id: 'b1', titre: 'bloquée', statut: 'bloque', dateEcheance: '2026-12-01', priorite: 'basse' },
      { kind: 'essentiel_ko', code: 'F401', libelle: 'Assurance' },
      { kind: 'action', id: 'r1', titre: 'retard ancien', statut: 'en_cours', dateEcheance: '2026-01-05', priorite: 'basse' },
    ];
    const ordre = ordonnerPrioritesRegionales(items).map(i => i.kind === 'essentiel_ko' ? i.code : i.id);
    expect(ordre).toEqual(['F401', 'b1', 'r1', 'r2']);
  });

  it('départage deux bloquées par priorité (critique > haute > moyenne > basse)', () => {
    const items: PrioriteItem[] = [
      { kind: 'action', id: 'lo', titre: 'a', statut: 'bloque', dateEcheance: '2026-05-01', priorite: 'basse' },
      { kind: 'action', id: 'hi', titre: 'b', statut: 'bloque', dateEcheance: '2026-05-01', priorite: 'critique' },
    ];
    expect(ordonnerPrioritesRegionales(items).map(i => (i as { id: string }).id)).toEqual(['hi', 'lo']);
  });
});
