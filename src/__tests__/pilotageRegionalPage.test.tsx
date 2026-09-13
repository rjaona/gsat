import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string, opts?: Record<string, unknown>) => {
      const s = d ?? k;
      return opts ? s.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(opts[key] ?? '')) : s;
    },
  }),
}));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: (s: { orgId: string }) => unknown) => {
    const state = { orgId: 'f1' };
    return sel ? sel(state) : state;
  },
}));
vi.mock('@/services/dashboardService', () => ({ getDashboardStats: vi.fn().mockResolvedValue(null) }));
vi.mock('@/services/planActionService', async () => ({
  listPlansByOrg: vi.fn().mockResolvedValue([]),
  listActions: vi.fn().mockResolvedValue([]),
  estEnRetard: (s: string, d: string | null, t: string) => !!d && s !== 'termine' && s !== 'bloque' && d.slice(0,10) < t,
}));

import { PilotageRegionalPage } from '@/pages/dashboard/PilotageRegionalPage';

describe('PilotageRegionalPage (dégradation)', () => {
  beforeEach(() => vi.clearAllMocks());
  it('non évalué → message dédié', async () => {
    render(<MemoryRouter><PilotageRegionalPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Aucune évaluation en cours/)).toBeInTheDocument());
  });
});
