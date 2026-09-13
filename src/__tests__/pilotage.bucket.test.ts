import { describe, it, expect } from 'vitest';
import { bucketiser2x2, type FaritanySignals } from '@/utils/pilotage';

const f = (p: Partial<FaritanySignals>): FaritanySignals => ({
  evalue: true, essentielsKoCount: 0, actionsTotal: 0, actionsRetard: 0, actionsBloque: 0, ...p,
});

describe('bucketiser2x2', () => {
  it('classe chaque Faritany dans une seule case, non évalués à part', () => {
    const rows = [
      f({ essentielsKoCount: 2, actionsBloque: 1 }),          // appui urgent (KO + souffrance)
      f({ essentielsKoCount: 3, actionsTotal: 0 }),           // conformité (KO, pas de souffrance)
      f({ actionsRetard: 2, actionsTotal: 3 }),               // exécution (souffrance, pas de KO)
      f({ actionsTotal: 5 }),                                 // sain
      f({ evalue: false }),                                   // non évalué
      f({ evalue: false, essentielsKoCount: 9 }),             // non évalué (prime)
    ];
    expect(bucketiser2x2(rows)).toEqual({ appuiUrgent: 1, conformite: 1, execution: 1, sain: 1, nonEvalue: 2 });
  });
});
