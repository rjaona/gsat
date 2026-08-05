/**
 * Tests RTL — RevuePage (P5).
 * Garde les deux actions de verdict : approuver appelle revoirEvaluation(approved) ;
 * le renvoi en révision exige un motif (bouton confirmer désactivé sans motif),
 * puis appelle revoirEvaluation(revision_requested, motif).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { RevuePage } from '@/pages/admin/RevuePage';
import type { Evaluation } from '@/types';

const h = vi.hoisted(() => ({
  listEvaluationsARevoir: vi.fn(),
  revoirEvaluation: vi.fn(),
  getDashboardStats: vi.fn(),
  listAlertesOuvertes: vi.fn(),
  getOrganisation: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k) }),
}));
vi.mock('@/stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1' }, role: 'responsable_osn' }) }));
vi.mock('@/services/evaluationService', () => ({
  listEvaluationsARevoir: h.listEvaluationsARevoir, revoirEvaluation: h.revoirEvaluation,
}));
vi.mock('@/services/dashboardService', () => ({ getDashboardStats: h.getDashboardStats }));
vi.mock('@/services/alerteService', () => ({ listAlertesOuvertes: h.listAlertesOuvertes }));
vi.mock('@/services/organisationService', () => ({ getOrganisation: h.getOrganisation }));

const evln: Evaluation = {
  id: 'e1', campagneId: 'c', orgId: 'ant', type: 'auto', statut: 'validee',
  scoreGlobal: 40, clotureeAuto: false, createdBy: 'u', createdAt: '2026-01-01', updatedAt: '2026-01-01',
  revueEcheanceAt: '2026-12-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  h.listEvaluationsARevoir.mockResolvedValue([evln]);
  h.getDashboardStats.mockResolvedValue({ criteresEssentielsKO: ['F401', 'F402'] });
  h.listAlertesOuvertes.mockResolvedValue([]);
  h.getOrganisation.mockResolvedValue({ id: 'ant', nom: 'Antananarivo I' });
  h.revoirEvaluation.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('RevuePage — verdicts', () => {
  it('approuver appelle revoirEvaluation avec verdict approved', async () => {
    render(<RevuePage />);
    await screen.findByText('Antananarivo I');
    fireEvent.click(screen.getByText('revue.approuver'));
    await waitFor(() => expect(h.revoirEvaluation).toHaveBeenCalledTimes(1));
    expect(h.revoirEvaluation.mock.calls[0]![1]).toMatchObject({ verdict: 'approved', revuePar: 'u1', role: 'responsable_osn' });
  });

  it('renvoi en révision : confirmer désactivé sans motif, actif avec motif', async () => {
    const { container } = render(<RevuePage />);
    await screen.findByText('Antananarivo I');
    fireEvent.click(screen.getByText('revue.demanderRevision'));
    const confirmer = screen.getByText('revue.confirmerRevision').closest('button')!;
    expect(confirmer.disabled).toBe(true);           // pas de motif
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'Reprendre D04' } });
    expect(confirmer.disabled).toBe(false);
    fireEvent.click(confirmer);
    await waitFor(() => expect(h.revoirEvaluation).toHaveBeenCalledTimes(1));
    expect(h.revoirEvaluation.mock.calls[0]![1]).toMatchObject({ verdict: 'revision_requested', motif: 'Reprendre D04' });
  });
});
