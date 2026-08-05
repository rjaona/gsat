/**
 * Tests RTL — AsnComparisonTable (P7).
 * Garde : groupes par province repliables (lignes masquées par défaut, révélées
 * au clic) et mise en avant du quartile bas.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AsnComparisonTable } from '@/components/dashboard/osn/AsnComparisonTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: unknown) => {
      if (o && typeof o === 'object' && 'count' in o) return `${k}:${(o as { count: number }).count}`;
      if (typeof o === 'string') return o; // fallback string
      return k;
    },
  }),
}));

const rows = [
  { asnId: 'a', nom: 'ANT Faritany 1', code: 'ANT-01', scoreGlobal: 20, scoreParDimension: { D01: 30 } },
  { asnId: 'b', nom: 'ANT Faritany 2', code: 'ANT-02', scoreGlobal: 80, scoreParDimension: { D01: 90 } },
  { asnId: 'c', nom: 'TOA Faritany 1', code: 'TOA-01', scoreGlobal: 60, scoreParDimension: { D01: 55 } },
];

afterEach(cleanup);

describe('AsnComparisonTable — 33 lignes', () => {
  it('affiche les groupes par province ; un groupe sans quartile bas est replié', () => {
    render(<AsnComparisonTable rows={rows} dimensionCodes={['D01']} />);
    expect(screen.getByText('Antananarivo')).toBeTruthy();
    expect(screen.getByText('Toamasina')).toBeTruthy();
    expect(screen.queryByText('TOA Faritany 1')).toBeNull(); // TOA (60) pas quartile bas → replié
  });

  it('auto-ouvre le groupe contenant un Faritany du quartile bas', () => {
    render(<AsnComparisonTable rows={rows} dimensionCodes={['D01']} />);
    // ANT contient la ligne de score 20 (quartile bas) → visible sans clic.
    expect(screen.getByText('ANT Faritany 1')).toBeTruthy();
  });

  it('révèle un groupe replié au clic', () => {
    render(<AsnComparisonTable rows={rows} dimensionCodes={['D01']} />);
    fireEvent.click(screen.getByText('Toamasina'));
    expect(screen.getByText('TOA Faritany 1')).toBeTruthy();
  });

  it('signale le quartile bas (seuil 20 → 1 à surveiller)', () => {
    render(<AsnComparisonTable rows={rows} dimensionCodes={['D01']} />);
    // badge global « X à surveiller » (au moins un, la ligne de score 20)
    expect(screen.getAllByText(/pages\.dashboardOsn\.quartileBas:1/).length).toBeGreaterThan(0);
  });

  it('utilise le libellé de niveau fourni (jamais « ASN » en dur)', () => {
    render(<AsnComparisonTable rows={rows} dimensionCodes={['D01']} niveauLabel="Faritany" />);
    expect(screen.getByText('Faritany')).toBeTruthy();
  });
});
