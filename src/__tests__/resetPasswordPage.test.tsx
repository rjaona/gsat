import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({
  ensureRecoverySession: vi.fn(),
  updatePassword: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => h.navigate,
}));
vi.mock('@/services/authService', () => ({
  ensureRecoverySession: h.ensureRecoverySession,
  updatePassword: h.updatePassword,
}));

import { ResetPasswordPage } from '@/components/auth/ResetPasswordPage';

beforeEach(() => { vi.clearAllMocks(); cleanup(); });

it('affiche le lien invalide si aucune session de recovery', async () => {
  h.ensureRecoverySession.mockResolvedValue(false);
  render(<ResetPasswordPage />);
  expect(await screen.findByText('auth.reset.invalidLink')).toBeTruthy();
  expect(screen.queryByLabelText('auth.reset.newPassword')).toBeNull();
});

it('refuse si les mots de passe ne correspondent pas', async () => {
  h.ensureRecoverySession.mockResolvedValue(true);
  render(<ResetPasswordPage />);
  await screen.findByLabelText('auth.reset.newPassword');
  fireEvent.change(screen.getByLabelText('auth.reset.newPassword'), { target: { value: 'longsecret1' } });
  fireEvent.change(screen.getByLabelText('auth.reset.confirmPassword'), { target: { value: 'different1' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.reset.submit' }));
  expect(await screen.findByText('auth.reset.mismatch')).toBeTruthy();
  expect(h.updatePassword).not.toHaveBeenCalled();
});

it('refuse si trop court', async () => {
  h.ensureRecoverySession.mockResolvedValue(true);
  render(<ResetPasswordPage />);
  await screen.findByLabelText('auth.reset.newPassword');
  fireEvent.change(screen.getByLabelText('auth.reset.newPassword'), { target: { value: 'short' } });
  fireEvent.change(screen.getByLabelText('auth.reset.confirmPassword'), { target: { value: 'short' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.reset.submit' }));
  expect(await screen.findByText('auth.reset.tooShort')).toBeTruthy();
  expect(h.updatePassword).not.toHaveBeenCalled();
});

it('met à jour puis redirige vers /login au succès', async () => {
  // Timers réels : la page enchaîne des microtasks async (ensureRecoverySession,
  // updatePassword) + un setTimeout de 1500 ms. Mélanger fake timers et
  // microtasks casse waitFor → on reste en timers réels avec un timeout élargi.
  h.ensureRecoverySession.mockResolvedValue(true);
  h.updatePassword.mockResolvedValue(undefined);
  render(<ResetPasswordPage />);
  await screen.findByLabelText('auth.reset.newPassword');
  fireEvent.change(screen.getByLabelText('auth.reset.newPassword'), { target: { value: 'longsecret1' } });
  fireEvent.change(screen.getByLabelText('auth.reset.confirmPassword'), { target: { value: 'longsecret1' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.reset.submit' }));
  await waitFor(() => expect(h.updatePassword).toHaveBeenCalledWith('longsecret1'));
  expect(await screen.findByText('auth.reset.success')).toBeTruthy();
  await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/login'), { timeout: 2000 });
});
