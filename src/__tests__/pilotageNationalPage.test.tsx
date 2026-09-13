import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

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
    const s = { orgId: 'osn-1' };
    return sel ? sel(s) : s;
  },
}));
vi.mock('@/services/organisationService', () => ({
  listOrganisations: vi.fn().mockResolvedValue([{ id: 'f1', code: 'ANT-01', nom: 'Analamanga', type: 'ASN' }]),
  getLibelleNiveauLocal: vi.fn().mockResolvedValue('Faritany'),
}));
vi.mock('@/services/dashboardService', () => ({ getDashboardStatsByOrgIds: vi.fn().mockResolvedValue({}) }));
vi.mock('@/services/planActionService', () => ({ listActionAggByOrgIds: vi.fn().mockResolvedValue({}) }));

import { PilotageNationalPage } from '@/pages/dashboard/PilotageNationalPage';

describe('PilotageNationalPage (dégradation)', () => {
  beforeEach(() => vi.clearAllMocks());
  it('affiche « X évalués / N » et la ligne non évalué sans faux « tout va bien »', async () => {
    render(<PilotageNationalPage />);
    await waitFor(() => expect(screen.getByText('Analamanga')).toBeInTheDocument());
    // stats vides → Faritany non évalué
    expect(screen.getByText('non évalué')).toBeInTheDocument();
    expect(screen.getByText(/0.*\/.*1/)).toBeInTheDocument(); // « 0 évalués / 1 »
  });
});
