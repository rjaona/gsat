import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { WatchlistFaritany, type WatchlistRow } from '@/components/dashboard/pilotage/WatchlistFaritany';
import type { Organisation } from '@/types';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }) }));

const org = (id: string, code: string, nom: string): Organisation =>
  ({ id, code, nom, type: 'ASN' } as unknown as Organisation);

const rows: WatchlistRow[] = [
  { org: org('a', 'ANT-01', 'Analamanga'), statut: 'en_souffrance', essentielsKoCount: 3, actionsTotal: 5, actionsRetard: 4, actionsBloque: 1 },
  { org: org('b', 'ANT-02', 'Bongolava'),  statut: 'rien_demarre', essentielsKoCount: 2, actionsTotal: 0, actionsRetard: 0, actionsBloque: 0 },
  { org: org('s', 'DIA-01', 'Sofia'),      statut: 'non_evalue',   essentielsKoCount: 0, actionsTotal: 0, actionsRetard: 0, actionsBloque: 0 },
];

describe('WatchlistFaritany', () => {
  it('affiche les Faritany avec leur statut, y compris non évalué', () => {
    render(<WatchlistFaritany rows={rows} />);
    expect(screen.getByText('Analamanga')).toBeInTheDocument();
    expect(screen.getByText('Sofia')).toBeInTheDocument();
    expect(screen.getByText('rien démarré')).toBeInTheDocument();
    expect(screen.getByText('non évalué')).toBeInTheDocument();
  });
  it('groupe par province (en-tête Antananarivo présent)', () => {
    render(<WatchlistFaritany rows={rows} />);
    expect(screen.getByText('Antananarivo')).toBeInTheDocument();
  });
});
