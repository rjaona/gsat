// @vitest-environment jsdom
/**
 * Tests d'intégration — PrivateRoute.tsx
 * Couvre : logique d'authentification et d'autorisation par rôle
 *
 * Dépendances : @testing-library/react, @testing-library/jest-dom
 * Mock : useAuthStore (Zustand), react-router-dom (Navigate)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrivateRoute } from '@/components/auth/PrivateRoute';

// ── Mock react-router-dom ─────────────────────────────────────────────────────
// On mock Navigate pour capturer la redirection sans avoir besoin d'un Router complet.

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="navigate-redirect" data-to={to} />
  ),
}));

// ── Mock useAuthStore ─────────────────────────────────────────────────────────

import type { UserRole } from '@/types';

// État initial par défaut du store (sera surchargé dans chaque test)
const mockAuthState = {
  user: null as object | null,
  role: undefined as UserRole | undefined,
  loading: false,
  initialized: true,
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPrivateRoute(requiredRoles?: UserRole[]) {
  return render(
    <PrivateRoute requiredRoles={requiredRoles}>
      <div data-testid="protected-content">Contenu protégé</div>
    </PrivateRoute>
  );
}

function setAuthState(overrides: Partial<typeof mockAuthState>) {
  Object.assign(mockAuthState, {
    user: null,
    role: undefined,
    loading: false,
    initialized: true,
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setAuthState({
    user: null,
    role: undefined,
    loading: false,
    initialized: true,
  });
});

describe('PrivateRoute — état de chargement', () => {
  it('affiche le loader quand initialized est false', () => {
    // Arrange
    setAuthState({ initialized: false, user: null });

    // Act
    renderPrivateRoute();

    // Assert : pas de redirection, pas de contenu protégé, loader affiché
    expect(screen.queryByTestId('navigate-redirect')).toBeNull();
    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('affiche le loader quand loading est true même si initialized est true', () => {
    // Arrange
    setAuthState({ loading: true, initialized: true, user: null });

    // Act
    renderPrivateRoute();

    // Assert
    expect(screen.queryByTestId('navigate-redirect')).toBeNull();
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });
});

describe('PrivateRoute — utilisateur non authentifié', () => {
  it('redirige vers /login quand user est null', () => {
    // Arrange
    setAuthState({ user: null, initialized: true });

    // Act
    renderPrivateRoute();

    // Assert
    const redirect = screen.getByTestId('navigate-redirect');
    expect(redirect).toBeInTheDocument();
    expect(redirect).toHaveAttribute('data-to', '/login');
  });

  it('redirige vers /login même si requiredRoles est défini', () => {
    // Arrange
    setAuthState({ user: null, initialized: true });

    // Act
    renderPrivateRoute(['admin_global']);

    // Assert
    const redirect = screen.getByTestId('navigate-redirect');
    expect(redirect).toHaveAttribute('data-to', '/login');
  });
});

describe('PrivateRoute — utilisateur authentifié sans requiredRoles', () => {
  it('donne accès au contenu quand user est connecté et aucun rôle requis', () => {
    // Arrange
    setAuthState({ user: { uid: 'user-1' }, initialized: true });

    // Act
    renderPrivateRoute(); // pas de requiredRoles

    // Assert
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('navigate-redirect')).toBeNull();
  });

  it('donne accès au contenu quel que soit le rôle quand requiredRoles est absent', () => {
    // Arrange
    setAuthState({ user: { uid: 'user-1' }, role: 'lecteur', initialized: true });

    // Act
    renderPrivateRoute();

    // Assert
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});

describe('PrivateRoute — vérification des rôles', () => {
  it('donne accès quand le rôle est inclus dans requiredRoles', () => {
    // Arrange
    setAuthState({
      user: { uid: 'user-1' },
      role: 'admin_global',
      initialized: true,
    });

    // Act
    renderPrivateRoute(['admin_global', 'responsable_region']);

    // Assert
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('donne accès quand le rôle est le seul autorisé', () => {
    // Arrange
    setAuthState({
      user: { uid: 'user-1' },
      role: 'responsable_osn',
      initialized: true,
    });

    // Act
    renderPrivateRoute(['responsable_osn']);

    // Assert
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('refuse l\'accès quand le rôle n\'est pas dans requiredRoles', () => {
    // Arrange
    setAuthState({
      user: { uid: 'user-1' },
      role: 'lecteur',
      initialized: true,
    });

    // Act
    renderPrivateRoute(['admin_global', 'responsable_region']);

    // Assert
    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(screen.getByText('Accès non autorisé.')).toBeInTheDocument();
  });

  it('refuse l\'accès quand role est undefined et requiredRoles est défini', () => {
    // Arrange
    setAuthState({
      user: { uid: 'user-1' },
      role: undefined,
      initialized: true,
    });

    // Act
    renderPrivateRoute(['admin_global']);

    // Assert
    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(screen.getByText('Accès non autorisé.')).toBeInTheDocument();
  });

  it('n\'affiche pas de redirection /login pour un accès refusé par rôle', () => {
    // Arrange : l'utilisateur est connecté mais n'a pas le bon rôle
    setAuthState({
      user: { uid: 'user-1' },
      role: 'lecteur',
      initialized: true,
    });

    // Act
    renderPrivateRoute(['admin_global']);

    // Assert : pas de redirect /login, mais message d'accès non autorisé
    expect(screen.queryByTestId('navigate-redirect')).toBeNull();
    expect(screen.getByText('Accès non autorisé.')).toBeInTheDocument();
  });

  it('donne accès à un utilisateur_asn quand le rôle est dans requiredRoles', () => {
    // Arrange
    setAuthState({
      user: { uid: 'user-1' },
      role: 'utilisateur_asn',
      initialized: true,
    });

    // Act
    renderPrivateRoute(['utilisateur_asn', 'evaluateur']);

    // Assert
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('refuse l\'accès à evaluateur quand seul admin_global est autorisé', () => {
    // Arrange
    setAuthState({
      user: { uid: 'user-1' },
      role: 'evaluateur',
      initialized: true,
    });

    // Act
    renderPrivateRoute(['admin_global']);

    // Assert
    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(screen.getByText('Accès non autorisé.')).toBeInTheDocument();
  });
});
