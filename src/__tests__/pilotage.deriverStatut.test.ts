import { describe, it, expect } from 'vitest';
import { deriverStatutFaritany, type FaritanySignals } from '@/utils/pilotage';

const base: FaritanySignals = { evalue: true, essentielsKoCount: 0, actionsTotal: 0, actionsRetard: 0, actionsBloque: 0 };

describe('deriverStatutFaritany', () => {
  it('non évalué prime sur tout', () => {
    expect(deriverStatutFaritany({ ...base, evalue: false, essentielsKoCount: 3 })).toBe('non_evalue');
  });
  it('KO sans aucune action = rien démarré (angle mort de l\'appui)', () => {
    expect(deriverStatutFaritany({ ...base, essentielsKoCount: 2, actionsTotal: 0 })).toBe('rien_demarre');
  });
  it('actions en retard ou bloquées = en souffrance', () => {
    expect(deriverStatutFaritany({ ...base, actionsTotal: 3, actionsRetard: 1 })).toBe('en_souffrance');
    expect(deriverStatutFaritany({ ...base, actionsTotal: 3, actionsBloque: 2 })).toBe('en_souffrance');
    expect(deriverStatutFaritany({ ...base, essentielsKoCount: 1, actionsTotal: 3, actionsBloque: 1 })).toBe('en_souffrance');
  });
  it('évalué, actions en cours, rien en souffrance = sous contrôle', () => {
    expect(deriverStatutFaritany({ ...base, actionsTotal: 4 })).toBe('sous_controle');
    expect(deriverStatutFaritany(base)).toBe('sous_controle');
  });
});
