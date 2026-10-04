import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
  it('appelle onSelect avec l\'orgId au clic sur la ligne', () => {
    const onSelect = vi.fn();
    render(<WatchlistFaritany rows={rows} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Analamanga'));
    expect(onSelect).toHaveBeenCalledWith('a');
  });
  it('utilise niveauLabel comme en-tête de première colonne', () => {
    render(<WatchlistFaritany rows={rows} niveauLabel="Région" />);
    expect(screen.getByText('Région')).toBeInTheDocument();
  });

  it('colonne Appui : chip « En appui » pour un Faritany appuyé, tiret sinon', () => {
    const org = (id: string, code: string) => ({ id, nom: `Far ${id}`, code, type: 'ASN' as const, actif: true, poids: 1 });
    render(<WatchlistFaritany rows={[
      { org: org('1', 'ANT-01'), statut: 'en_souffrance', essentielsKoCount: 1, actionsTotal: 2, actionsRetard: 1, actionsBloque: 0, enAppui: true },
      { org: org('2', 'ANT-02'), statut: 'sous_controle', essentielsKoCount: 0, actionsTotal: 1, actionsRetard: 0, actionsBloque: 0 },
    ]} />);
    expect(screen.getByText('Appui')).toBeInTheDocument();
    const ligne1 = screen.getByText('Far 1').closest('tr')!;
    const ligne2 = screen.getByText('Far 2').closest('tr')!;
    expect(within(ligne1).getByText('En appui')).toBeInTheDocument();
    expect(within(ligne2).queryByText('En appui')).toBeNull();
  });
});
