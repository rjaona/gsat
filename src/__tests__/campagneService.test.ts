/**
 * Tests unitaires — campagneService.ts
 * Couvre : isCampagneExpiree (logique pure, pas de Firebase)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isCampagneExpiree } from '@/services/campagneService';
import type { Campagne } from '@/types';

// ── Fixture ───────────────────────────────────────────────────────────────────

/**
 * Construit une Campagne minimale pour les tests.
 * dateFermeture est une string ISO 8601.
 */
function makeCampagne(overrides: Partial<Campagne> & { dateFermeture: string }): Campagne {
  return {
    id: 'campagne-test',
    organisateurId: 'org-1',
    referentielVersion: 'v3_0',
    nom: 'Campagne de test',
    dateOuverture: '2025-01-01T00:00:00.000Z',
    statut: overrides.statut ?? 'ouverte',
    perimetre: [],
    createdBy: 'user-1',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Date de référence fixe pour tous les tests : 2 avril 2026
const NOW = new Date('2026-04-02T12:00:00.000Z');

afterEach(() => {
  vi.useRealTimers();
});

// ── isCampagneExpiree ─────────────────────────────────────────────────────────

describe('isCampagneExpiree', () => {
  it('retourne true quand dateFermeture est dans le passé', () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const campagne = makeCampagne({
      dateFermeture: '2026-03-01T00:00:00.000Z',
      statut: 'ouverte',
    });

    // Act
    const result = isCampagneExpiree(campagne);

    // Assert
    expect(result).toBe(true);
  });

  it('retourne false quand dateFermeture est dans le futur', () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const campagne = makeCampagne({
      dateFermeture: '2026-12-31T23:59:59.000Z',
      statut: 'ouverte',
    });

    // Act
    const result = isCampagneExpiree(campagne);

    // Assert
    expect(result).toBe(false);
  });

  it('retourne true quand dateFermeture est exactement maintenant (limite stricte <)', () => {
    // Arrange : dateFermeture = NOW exactement → fermeture < new Date() est false
    // La fonction utilise `fermeture < new Date()` donc une date égale retourne false
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const campagne = makeCampagne({
      // 1 milliseconde dans le passé
      dateFermeture: new Date(NOW.getTime() - 1).toISOString(),
      statut: 'ouverte',
    });

    // Act
    const result = isCampagneExpiree(campagne);

    // Assert
    expect(result).toBe(true);
  });

  it('retourne false quand dateFermeture est exactement maintenant (pas encore expirée)', () => {
    // Arrange : dateFermeture = NOW → fermeture < new Date() est false
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const campagne = makeCampagne({
      dateFermeture: NOW.toISOString(),
      statut: 'ouverte',
    });

    // Act
    const result = isCampagneExpiree(campagne);

    // Assert
    expect(result).toBe(false);
  });

  it('retourne true pour une campagne fermée avec dateFermeture dans le passé', () => {
    // Arrange : la fonction teste uniquement la date, pas le statut
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const campagne = makeCampagne({
      dateFermeture: '2026-01-01T00:00:00.000Z',
      statut: 'fermee',
    });

    // Act
    const result = isCampagneExpiree(campagne);

    // Assert : isCampagneExpiree ne filtre pas sur le statut
    expect(result).toBe(true);
  });

  it('retourne false pour une campagne planifiée avec dateFermeture dans le futur', () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const campagne = makeCampagne({
      dateFermeture: '2027-01-01T00:00:00.000Z',
      statut: 'planifiee',
    });

    // Act
    const result = isCampagneExpiree(campagne);

    // Assert
    expect(result).toBe(false);
  });

  it('retourne false pour une campagne archivée avec dateFermeture dans le futur', () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const campagne = makeCampagne({
      dateFermeture: '2027-06-15T00:00:00.000Z',
      statut: 'archivee',
    });

    // Act
    const result = isCampagneExpiree(campagne);

    // Assert
    expect(result).toBe(false);
  });

  it('gère une dateFermeture passée en string ISO', () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const campagne = makeCampagne({
      dateFermeture: '2025-06-01T00:00:00.000Z',
      statut: 'ouverte',
    });

    // Act
    const result = isCampagneExpiree(campagne);

    // Assert
    expect(result).toBe(true);
  });

  it('gère une dateFermeture future en string ISO', () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const campagne = makeCampagne({
      dateFermeture: '2027-01-01T00:00:00.000Z',
      statut: 'ouverte',
    });

    // Act
    const result = isCampagneExpiree(campagne);

    // Assert
    expect(result).toBe(false);
  });
});
