import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const h = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('react-router-dom', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock('@/services/authService', () => ({ requestPasswordReset: h.requestPasswordReset }));

import { ForgotPasswordPage } from '@/components/auth/ForgotPasswordPage';

beforeEach(() => { vi.clearAllMocks(); cleanup(); });

it('appelle requestPasswordReset et affiche le message neutre au succès', async () => {
  h.requestPasswordReset.mockResolvedValue(undefined);
  render(<ForgotPasswordPage />);
  fireEvent.change(screen.getByLabelText('auth.forgot.emailLabel'), { target: { value: 'a@tem.mg' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.forgot.submit' }));
  await waitFor(() => expect(h.requestPasswordReset).toHaveBeenCalledWith('a@tem.mg'));
  expect(await screen.findByText('auth.forgot.sent')).toBeTruthy();
});

it('affiche un message générique (pas de fuite) en cas d’erreur', async () => {
  h.requestPasswordReset.mockRejectedValue(new Error('rate limited'));
  render(<ForgotPasswordPage />);
  fireEvent.change(screen.getByLabelText('auth.forgot.emailLabel'), { target: { value: 'a@tem.mg' } });
  fireEvent.click(screen.getByRole('button', { name: 'auth.forgot.submit' }));
  expect(await screen.findByText('auth.forgot.error')).toBeTruthy();
  expect(screen.queryByText('auth.forgot.sent')).toBeNull();
});
