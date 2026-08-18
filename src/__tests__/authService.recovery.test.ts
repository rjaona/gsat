/**
 * Tests unitaires — authService recovery (Chantier D).
 * requestPasswordReset / updatePassword / ensureRecoverySession.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getSession: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: h.resetPasswordForEmail,
      updateUser: h.updateUser,
      getSession: h.getSession,
      exchangeCodeForSession: h.exchangeCodeForSession,
    },
  },
}));

// auditService est importé par authService — le neutraliser
vi.mock('@/services/auditService', () => ({ writeAuditEntry: vi.fn() }));

import {
  requestPasswordReset,
  updatePassword,
  ensureRecoverySession,
} from '@/services/authService';

const ORIGIN = 'https://gsat.tily-digital.com';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { location: { origin: ORIGIN, search: '' } });
  h.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  h.updateUser.mockResolvedValue({ data: {}, error: null });
  h.getSession.mockResolvedValue({ data: { session: null }, error: null });
  h.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null });
});
afterEach(() => vi.unstubAllGlobals());

describe('requestPasswordReset', () => {
  it('appelle resetPasswordForEmail avec redirectTo = origin + /reset-password', async () => {
    await requestPasswordReset('user@tem.mg');
    expect(h.resetPasswordForEmail).toHaveBeenCalledWith('user@tem.mg', {
      redirectTo: `${ORIGIN}/reset-password`,
    });
  });
  it('throw si supabase renvoie une erreur', async () => {
    h.resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: 'rate limited' } });
    await expect(requestPasswordReset('user@tem.mg')).rejects.toBeTruthy();
  });
});

describe('updatePassword', () => {
  it('appelle updateUser avec le nouveau mot de passe', async () => {
    await updatePassword('nouveauSecret1');
    expect(h.updateUser).toHaveBeenCalledWith({ password: 'nouveauSecret1' });
  });
  it('throw si supabase renvoie une erreur', async () => {
    h.updateUser.mockResolvedValue({ data: {}, error: { message: 'weak' } });
    await expect(updatePassword('x')).rejects.toBeTruthy();
  });
});

describe('ensureRecoverySession', () => {
  it('retourne true si une session existe déjà (flow implicit)', async () => {
    h.getSession.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    await expect(ensureRecoverySession()).resolves.toBe(true);
    expect(h.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it('échange le code si ?code= présent et pas de session (flow PKCE)', async () => {
    vi.stubGlobal('window', { location: { origin: ORIGIN, search: '?code=abc123' } });
    h.exchangeCodeForSession.mockResolvedValue({ data: { session: { access_token: 't' } }, error: null });
    await expect(ensureRecoverySession()).resolves.toBe(true);
    expect(h.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
  });
  it('retourne false si ni session ni code exploitable', async () => {
    await expect(ensureRecoverySession()).resolves.toBe(false);
  });
});
