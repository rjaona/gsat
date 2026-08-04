/**
 * Tests unitaires — logique campagne
 * Complement a campagneService.test.ts (qui teste isCampagneExpiree).
 *
 * Couvre :
 * - Statuts campagne et transitions autorisees
 * - Garde : une campagne fermee ne doit pas accepter de nouvelles evaluations
 * - Perimetre : verification qu'une ASN est dans le perimetre
 * - getCampagneActiveForOrg : logique de filtrage (testee en logique pure)
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Campagne, CampagneStatut } from '@/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCampagne(overrides: Partial<Campagne> = {}): Campagne {
  return {
    id: 'campagne-test',
    organisateurId: 'org-1',
    referentielVersion: 'v3_0',
    nom: 'Campagne de test',
    dateOuverture: '2025-01-01T00:00:00.000Z',
    dateFermeture: '2025-12-31T00:00:00.000Z',
    statut: 'ouverte',
    perimetre: [],
    createdBy: 'user-1',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── Logique de transition de statut (pure) ───────────────────────────────────

const TRANSITIONS_VALIDES: Record<CampagneStatut, CampagneStatut[]> = {
  planifiee: ['ouverte'],
  ouverte: ['fermee'],
  fermee: ['archivee'],
  archivee: [],
};

function canTransitionCampagne(from: CampagneStatut, to: CampagneStatut): boolean {
  return TRANSITIONS_VALIDES[from]?.includes(to) ?? false;
}

// ── Garde : campagne accepte-t-elle des evaluations ? ────────────────────────

function campagneAccepteEvaluations(campagne: Campagne): boolean {
  return campagne.statut === 'ouverte';
}

// ── Perimetre : ASN dans le perimetre ? ──────────────────────────────────────

function isOrgDansPerimetre(campagne: Campagne, orgId: string): boolean {
  // Perimetre vide = toutes les ASN
  if (campagne.perimetre.length === 0) return true;
  return campagne.perimetre.includes(orgId);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.useRealTimers();
});

describe('Transitions de statut campagne', () => {
  it('autorise planifiee -> ouverte', () => {
    expect(canTransitionCampagne('planifiee', 'ouverte')).toBe(true);
  });

  it('autorise ouverte -> fermee', () => {
    expect(canTransitionCampagne('ouverte', 'fermee')).toBe(true);
  });

  it('autorise fermee -> archivee', () => {
    expect(canTransitionCampagne('fermee', 'archivee')).toBe(true);
  });

  it('refuse planifiee -> fermee (saute ouverte)', () => {
    expect(canTransitionCampagne('planifiee', 'fermee')).toBe(false);
  });

  it('refuse planifiee -> archivee', () => {
    expect(canTransitionCampagne('planifiee', 'archivee')).toBe(false);
  });

  it('refuse ouverte -> planifiee (retour en arriere)', () => {
    expect(canTransitionCampagne('ouverte', 'planifiee')).toBe(false);
  });

  it('refuse ouverte -> archivee (saute fermee)', () => {
    expect(canTransitionCampagne('ouverte', 'archivee')).toBe(false);
  });

  it('refuse fermee -> ouverte (retour en arriere)', () => {
    expect(canTransitionCampagne('fermee', 'ouverte')).toBe(false);
  });

  it('refuse fermee -> planifiee', () => {
    expect(canTransitionCampagne('fermee', 'planifiee')).toBe(false);
  });

  it('refuse archivee -> tout (etat terminal)', () => {
    expect(canTransitionCampagne('archivee', 'planifiee')).toBe(false);
    expect(canTransitionCampagne('archivee', 'ouverte')).toBe(false);
    expect(canTransitionCampagne('archivee', 'fermee')).toBe(false);
  });

  it('refuse auto-transition sur chaque statut', () => {
    const statuts: CampagneStatut[] = ['planifiee', 'ouverte', 'fermee', 'archivee'];
    for (const statut of statuts) {
      expect(canTransitionCampagne(statut, statut)).toBe(false);
    }
  });
});

describe('Garde — campagne accepte des evaluations', () => {
  it('accepte quand statut est ouverte', () => {
    const campagne = makeCampagne({ statut: 'ouverte' });
    expect(campagneAccepteEvaluations(campagne)).toBe(true);
  });

  it('refuse quand statut est planifiee', () => {
    const campagne = makeCampagne({ statut: 'planifiee' });
    expect(campagneAccepteEvaluations(campagne)).toBe(false);
  });

  it('refuse quand statut est fermee', () => {
    const campagne = makeCampagne({ statut: 'fermee' });
    expect(campagneAccepteEvaluations(campagne)).toBe(false);
  });

  it('refuse quand statut est archivee', () => {
    const campagne = makeCampagne({ statut: 'archivee' });
    expect(campagneAccepteEvaluations(campagne)).toBe(false);
  });
});

describe('Perimetre — filtre ASN', () => {
  it('accepte toute ASN quand le perimetre est vide', () => {
    const campagne = makeCampagne({ perimetre: [] });
    expect(isOrgDansPerimetre(campagne, 'tem-antananarivo')).toBe(true);
    expect(isOrgDansPerimetre(campagne, 'n-importe-quelle-org')).toBe(true);
  });

  it('accepte une ASN listee dans le perimetre', () => {
    const campagne = makeCampagne({
      perimetre: ['tem-antananarivo', 'tem-fianarantsoa', 'tem-toamasina'],
    });
    expect(isOrgDansPerimetre(campagne, 'tem-antananarivo')).toBe(true);
    expect(isOrgDansPerimetre(campagne, 'tem-fianarantsoa')).toBe(true);
  });

  it('refuse une ASN non listee dans le perimetre', () => {
    const campagne = makeCampagne({
      perimetre: ['tem-antananarivo', 'tem-fianarantsoa'],
    });
    expect(isOrgDansPerimetre(campagne, 'tem-toamasina')).toBe(false);
    expect(isOrgDansPerimetre(campagne, 'tem-mahajanga')).toBe(false);
  });
});

describe('Selection campagne active pour une ASN', () => {
  // Logique pure extraite de getCampagneActiveForOrg

  function findCampagneActive(campagnes: Campagne[], orgId: string): Campagne | null {
    const ouvertes = campagnes.filter(c => c.statut === 'ouverte');
    // Tri par dateOuverture desc (la plus recente en premier)
    ouvertes.sort((a, b) => {
      const dateA = new Date(a.dateOuverture).getTime();
      const dateB = new Date(b.dateOuverture).getTime();
      return dateB - dateA;
    });
    return ouvertes.find(c => c.perimetre.length === 0 || c.perimetre.includes(orgId)) ?? null;
  }

  it('retourne la campagne ouverte qui contient l\'ASN dans son perimetre', () => {
    const campagnes = [
      makeCampagne({ id: 'c1', statut: 'ouverte', perimetre: ['tem-antananarivo'] }),
      makeCampagne({ id: 'c2', statut: 'fermee', perimetre: ['tem-antananarivo'] }),
    ];

    const result = findCampagneActive(campagnes, 'tem-antananarivo');
    expect(result?.id).toBe('c1');
  });

  it('retourne la campagne ouverte avec perimetre vide (toutes ASN)', () => {
    const campagnes = [
      makeCampagne({ id: 'c1', statut: 'ouverte', perimetre: [] }),
    ];

    const result = findCampagneActive(campagnes, 'n-importe-quelle-org');
    expect(result?.id).toBe('c1');
  });

  it('retourne null quand aucune campagne ouverte', () => {
    const campagnes = [
      makeCampagne({ id: 'c1', statut: 'fermee' }),
      makeCampagne({ id: 'c2', statut: 'archivee' }),
    ];

    const result = findCampagneActive(campagnes, 'tem-antananarivo');
    expect(result).toBeNull();
  });

  it('retourne null quand l\'ASN n\'est dans aucun perimetre ouvert', () => {
    const campagnes = [
      makeCampagne({ id: 'c1', statut: 'ouverte', perimetre: ['tem-fianarantsoa'] }),
    ];

    const result = findCampagneActive(campagnes, 'tem-antananarivo');
    expect(result).toBeNull();
  });

  it('prefere la campagne la plus recente quand plusieurs ouvertes couvrent l\'ASN', () => {
    const campagnes = [
      makeCampagne({
        id: 'c-old',
        statut: 'ouverte',
        perimetre: [],
        dateOuverture: '2024-01-01T00:00:00.000Z',
      }),
      makeCampagne({
        id: 'c-new',
        statut: 'ouverte',
        perimetre: [],
        dateOuverture: '2025-06-01T00:00:00.000Z',
      }),
    ];

    const result = findCampagneActive(campagnes, 'tem-antananarivo');
    expect(result?.id).toBe('c-new');
  });
});
