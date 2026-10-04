import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string, opts?: Record<string, unknown>) => {
      const s = d ?? k;
      return opts ? s.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(opts[key] ?? '')) : s;
    },
  }),
}));
const auth = vi.hoisted(() => ({ state: { orgId: 'osn-1', role: 'responsable_osn', orgType: 'OSN', user: { id: 'u1' } } as Record<string, unknown> }));
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: (s: Record<string, unknown>) => unknown) => (sel ? sel(auth.state) : auth.state),
}));
vi.mock('@/services/organisationService', () => ({
  listOrganisations: vi.fn(),
  getLibelleNiveauLocal: vi.fn().mockResolvedValue('Faritany'),
}));
vi.mock('@/services/dashboardService', () => ({ getDashboardStatsByOrgIds: vi.fn().mockResolvedValue({}) }));
vi.mock('@/services/planActionService', () => ({
  listActionAggByOrgIds: vi.fn().mockResolvedValue({}),
  listPlansByOrg: vi.fn().mockResolvedValue([]),
  listActions: vi.fn().mockResolvedValue([]),
  estEnRetard: () => false,
}));
vi.mock('@/services/evaluationService', () => ({ listEvaluationsByOrg: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/referentielService', () => ({ getReferentiel: vi.fn().mockResolvedValue(null) }));
vi.mock('@/services/adminService', () => ({ listUsers: vi.fn().mockResolvedValue([]) }));
vi.mock('@/services/appuiService', () => ({
  listAppuisOuvertsByOrgIds: vi.fn().mockResolvedValue({}),
  ouvrirAppui: vi.fn(), mettreAJourAppui: vi.fn(), cloreAppui: vi.fn(), creerActionAppui: vi.fn(),
}));

import { PilotageNationalPage } from '@/pages/dashboard/PilotageNationalPage';
import { listOrganisations } from '@/services/organisationService';

const FAR = [{ id: 'f1', code: 'ANT-01', nom: 'Analamanga', type: 'ASN', actif: true, poids: 1 }];

describe('PilotageNationalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.state = { orgId: 'osn-1', role: 'responsable_osn', orgType: 'OSN', user: { id: 'u1' } };
    vi.mocked(listOrganisations).mockImplementation(async (type) => (type === 'OSN' ? [{ id: 'osn-1', nom: 'TEM', type: 'OSN', actif: true, poids: 1 }] : FAR) as never);
  });

  it('dégradation : « X évalués / N » + ligne non évalué, sans faux « tout va bien »', async () => {
    render(<PilotageNationalPage />);
    await waitFor(() => expect(screen.getByText('Analamanga')).toBeInTheDocument());
    expect(screen.getByText('non évalué')).toBeInTheDocument();
    expect(screen.getByText('0 évalués / 1')).toBeInTheDocument();
  });

  it('bandeau synthèse : 3 compteurs dont « Actions nationales en cours »', async () => {
    render(<PilotageNationalPage />);
    await waitFor(() => expect(screen.getByText('Analamanga')).toBeInTheDocument());
    expect(screen.getByText('Faritany en zone appui')).toBeInTheDocument();
    expect(screen.getByText('Faritany avec essentiel KO')).toBeInTheDocument();
    expect(screen.getByText('Actions nationales en cours')).toBeInTheDocument();
  });

  it('admin_global rattaché à OMMS → voit les Faritany de l OSN résolue', async () => {
    auth.state = { orgId: 'omms', role: 'admin_global', orgType: 'OMMS', user: { id: 'u-admin' } };
    render(<PilotageNationalPage />);
    await waitFor(() => expect(screen.getByText('Analamanga')).toBeInTheDocument());
    expect(listOrganisations).toHaveBeenCalledWith('ASN', 'osn-1');
  });

  it('changer de Faritany dans le drill-down réinitialise le brouillon de capture', async () => {
    vi.mocked(listOrganisations).mockImplementation(async (type) => (type === 'OSN'
      ? [{ id: 'osn-1', nom: 'TEM', type: 'OSN', actif: true, poids: 1 }]
      : [...FAR, { id: 'f2', code: 'ANT-02', nom: 'Bongolava', type: 'ASN', actif: true, poids: 1 }]) as never);
    render(<PilotageNationalPage />);
    await waitFor(() => expect(screen.getByText('Analamanga')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Analamanga'));
    const noteA = await screen.findByLabelText('Note');
    fireEvent.change(noteA, { target: { value: 'brouillon A' } });
    expect(screen.getByLabelText('Note')).toHaveValue('brouillon A');
    fireEvent.click(screen.getAllByText('Bongolava')[0]!);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bongolava' })).toBeInTheDocument());
    expect(screen.getByLabelText('Note')).toHaveValue('');
  });
});
