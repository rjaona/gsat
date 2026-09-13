import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
