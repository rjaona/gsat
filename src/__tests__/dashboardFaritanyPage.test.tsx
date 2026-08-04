/**
 * Tests RTL — DashboardFaritanyPage (P6).
 * Garde l'exigence binaire de la passation : le bandeau ERP est MASQUÉ
 * ENTIÈREMENT s'il n'y a aucun snapshot ; présent sinon. Garde aussi le rendu
 * des alertes ouvertes.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DashboardFaritanyPage } from '@/pages/dashboard/DashboardFaritanyPage';
import type { Alerte } from '@/types';

const store = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ orgId: 'ant' }) }));
vi.mock('@/stores/dashboardFaritanyStore', () => ({
  useDashboardFaritanyStore: () => store.current,
}));
vi.mock('@/components/dashboard/KpiStrip', () => ({ KpiStrip: () => <div data-testid="kpis" /> }));
vi.mock('@/components/dashboard/DimensionRadarChart', () => ({ DimensionRadarChart: () => <div data-testid="radar" /> }));
vi.mock('@/components/plan/ActionKanban', () => ({ ActionKanban: () => <div data-testid="kanban" /> }));

function baseState(over: Record<string, unknown> = {}) {
  return {
    stats: { orgId: 'ant', scoreGlobal: 50, scoreParDimension: {}, criteresEssentielsKO: [], updatedAt: '' },
    moyenne: null, alertes: [], actions: [], erp: null,
    loading: false, load: vi.fn(), reset: vi.fn(),
    ...over,
  };
}

afterEach(cleanup);

describe('DashboardFaritanyPage — bandeau ERP', () => {
  it('est ABSENT quand aucun snapshot (erp = null)', () => {
    store.current = baseState({ erp: null });
    render(<DashboardFaritanyPage />);
    expect(screen.queryByText('pages.dashboardFaritany.erp')).toBeNull();
  });

  it('est ABSENT quand snapshot sans indicateur', () => {
    store.current = baseState({ erp: { orgId: 'ant', periode: '2026-06-01', indicateurs: {} } });
    render(<DashboardFaritanyPage />);
    expect(screen.queryByText('pages.dashboardFaritany.erp')).toBeNull();
  });

  it('est PRÉSENT quand snapshot avec indicateurs', () => {
    store.current = baseState({ erp: { orgId: 'ant', periode: '2026-06-01', indicateurs: { pct_adultes: 29 } } });
    render(<DashboardFaritanyPage />);
    expect(screen.getByText('pages.dashboardFaritany.erp')).toBeTruthy();
    expect(screen.getByText('29')).toBeTruthy();
  });
});

describe('DashboardFaritanyPage — alertes', () => {
  it('affiche les alertes ouvertes avec leur sévérité', () => {
    const alertes: Alerte[] = [
      { id: '1', orgId: 'ant', type: 'conformite', severite: 'critique', titre: 'Essentiel KO', statut: 'ouverte', createdAt: '2026-01-01' },
    ];
    store.current = baseState({ alertes });
    render(<DashboardFaritanyPage />);
    expect(screen.getByText('Essentiel KO')).toBeTruthy();
    expect(screen.getByText('pages.dashboardFaritany.severites.critique')).toBeTruthy();
  });

  it('affiche l’état vide sans alerte', () => {
    store.current = baseState({ alertes: [] });
    render(<DashboardFaritanyPage />);
    expect(screen.getByText('pages.dashboardFaritany.aucuneAlerte')).toBeTruthy();
  });
});
