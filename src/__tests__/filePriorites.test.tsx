import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FilePriorites } from '@/components/dashboard/pilotage/FilePriorites';
import type { PrioriteItem } from '@/utils/pilotage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string, opts?: Record<string, unknown>) => {
      const s = d ?? k;
      return opts ? s.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(opts[key] ?? '')) : s;
    },
  }),
}));

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('FilePriorites', () => {
  it('non évalué → message dédié', () => {
    wrap(<FilePriorites items={[]} evalue={false} actionsTerminees={0} />);
    expect(screen.getByText(/Aucune évaluation en cours/)).toBeInTheDocument();
  });
  it('évalué et vide → « rien en attente » avec le nb terminées (pas « rien commencé »)', () => {
    wrap(<FilePriorites items={[]} evalue={true} actionsTerminees={4} />);
    expect(screen.getByText(/Aucune priorité/)).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });
  it('liste KO et actions', () => {
    const items: PrioriteItem[] = [
      { kind: 'essentiel_ko', code: 'F401', libelle: 'Assurance' },
      { kind: 'action', id: 'a1', titre: 'Recruter', statut: 'bloque', dateEcheance: '2026-05-01', priorite: 'haute' },
    ];
    wrap(<FilePriorites items={items} evalue={true} actionsTerminees={0} />);
    expect(screen.getByText('F401 — Assurance')).toBeInTheDocument();
    expect(screen.getByText('Recruter')).toBeInTheDocument();
  });
  it('badge « National » sur une action d appui, absent sur une action régionale', () => {
    wrap(<FilePriorites evalue actionsTerminees={0} items={[
      { kind: 'action', id: 'n', titre: 'Former le trésorier', statut: 'bloque', dateEcheance: '2026-09-01', priorite: 'haute', origine: 'nationale' },
      { kind: 'action', id: 'r', titre: 'Recenser', statut: 'a_faire', dateEcheance: '2026-08-01', priorite: 'basse', origine: 'regionale' },
    ]} />);
    const ligneN = screen.getByText('Former le trésorier').closest('li')!;
    const ligneR = screen.getByText('Recenser').closest('li')!;
    expect(within(ligneN).getByText('National')).toBeInTheDocument();
    expect(within(ligneR).queryByText('National')).toBeNull();
  });
});
