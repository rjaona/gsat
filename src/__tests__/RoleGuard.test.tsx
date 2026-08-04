// @vitest-environment jsdom
/**
 * Tests unitaires — RoleGuard.tsx
 * Couvre : filtrage par role, affichage conditionnel children / acces refuse
 *
 * Dependencies : @testing-library/react, @testing-library/jest-dom
 * Mock : useAuthStore (Zustand), react-i18next
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGuard } from '@/components/auth/RoleGuard';
import type { UserRole } from '@/types';

// ── Mock react-i18next ──────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

// ── Mock useAuthStore ───────────────────────────────────────────────────────

const mockAuthState: { role: UserRole | undefined } = {
  role: undefined,
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function setRole(role: UserRole | undefined) {
  mockAuthState.role = role;
}

function renderRoleGuard(roles: UserRole[]) {
  return render(
    <RoleGuard roles={roles}>
      <div data-testid="protected-content">Contenu protege</div>
    </RoleGuard>
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setRole(undefined);
});

describe('RoleGuard — role autorise', () => {
  it('affiche les children quand le role est dans la liste autorisee', () => {
    // Arrange
    setRole('admin_global');

    // Act
    renderRoleGuard(['admin_global', 'responsable_region']);

    // Assert
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByText('Access denied')).toBeNull();
  });

  it('affiche les children quand le role est le seul autorise', () => {
    // Arrange
    setRole('responsable_osn');

    // Act
    renderRoleGuard(['responsable_osn']);

    // Assert
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('affiche les children pour chaque role valide', () => {
    const roles: UserRole[] = [
      'admin_global',
      'responsable_region',
      'responsable_osn',
      'utilisateur_asn',
      'evaluateur',
      'lecteur',
    ];

    for (const role of roles) {
      setRole(role);
      const { unmount } = renderRoleGuard([role]);
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      unmount();
    }
  });
});

describe('RoleGuard — role non autorise', () => {
  it('affiche "Access denied" quand le role n\'est pas dans la liste', () => {
    // Arrange
    setRole('lecteur');

    // Act
    renderRoleGuard(['admin_global', 'responsable_region']);

    // Assert
    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });

  it('affiche "Access denied" quand le role est evaluateur et seul admin est autorise', () => {
    // Arrange
    setRole('evaluateur');

    // Act
    renderRoleGuard(['admin_global']);

    // Assert
    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });
});

describe('RoleGuard — sans profil (role undefined)', () => {
  it('affiche "Access denied" quand role est undefined', () => {
    // Arrange
    setRole(undefined);

    // Act
    renderRoleGuard(['admin_global', 'responsable_osn']);

    // Assert
    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });

  it('affiche le message explicatif pour l\'utilisateur', () => {
    // Arrange
    setRole(undefined);

    // Act
    renderRoleGuard(['admin_global']);

    // Assert
    expect(
      screen.getByText(/do not have the required permissions/)
    ).toBeInTheDocument();
  });
});

describe('RoleGuard — liste de roles vide', () => {
  it('affiche "Access denied" quand la liste de roles autorisee est vide', () => {
    // Arrange
    setRole('admin_global');

    // Act
    renderRoleGuard([]);

    // Assert
    expect(screen.queryByTestId('protected-content')).toBeNull();
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });
});
