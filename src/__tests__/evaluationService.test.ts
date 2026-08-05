/**
 * Tests unitaires — evaluationService.ts
 * Couvre : canTransitionTo (logique pure, pas de Firebase)
 */

import { describe, it, expect } from 'vitest';
import { canTransitionTo } from '@/services/evaluationService';
import type { EvaluationStatut } from '@/types';

// ── canTransitionTo ───────────────────────────────────────────────────────────

describe('canTransitionTo — transitions valides', () => {
  it('autorise brouillon → en_cours', () => {
    expect(canTransitionTo('brouillon', 'en_cours')).toBe(true);
  });

  it('autorise en_cours → soumise', () => {
    expect(canTransitionTo('en_cours', 'soumise')).toBe(true);
  });

  it('autorise soumise → validee', () => {
    expect(canTransitionTo('soumise', 'validee')).toBe(true);
  });

  it('autorise soumise → en_cours (renvoi en cours de saisie)', () => {
    expect(canTransitionTo('soumise', 'en_cours')).toBe(true);
  });

  it('autorise validee → cloturee', () => {
    expect(canTransitionTo('validee', 'cloturee')).toBe(true);
  });

  // Arbitrage du 4 août 2026 (voir evaluationWorkflow.ts) : deux transitions
  // autrefois interdites sont désormais valides.
  it('autorise en_cours → validee (auto-validation Faritany, sans étape soumise)', () => {
    // Le responsable_asn auto-valide SA PROPRE évaluation sans passer par 'soumise'.
    expect(canTransitionTo('en_cours', 'validee')).toBe(true);
  });

  it('autorise validee → en_cours (renvoi en révision par la revue nationale)', () => {
    expect(canTransitionTo('validee', 'en_cours')).toBe(true);
  });
});

describe('canTransitionTo — transitions invalides', () => {
  it('refuse brouillon → soumise (saute l\'étape en_cours)', () => {
    expect(canTransitionTo('brouillon', 'soumise')).toBe(false);
  });

  it('refuse brouillon → validee', () => {
    expect(canTransitionTo('brouillon', 'validee')).toBe(false);
  });

  it('refuse brouillon → cloturee', () => {
    expect(canTransitionTo('brouillon', 'cloturee')).toBe(false);
  });

  it('refuse en_cours → cloturee', () => {
    expect(canTransitionTo('en_cours', 'cloturee')).toBe(false);
  });

  it('refuse en_cours → brouillon (retour en arrière non autorisé)', () => {
    expect(canTransitionTo('en_cours', 'brouillon')).toBe(false);
  });

  it('refuse soumise → brouillon', () => {
    expect(canTransitionTo('soumise', 'brouillon')).toBe(false);
  });

  it('refuse soumise → cloturee (saute l\'étape validee)', () => {
    expect(canTransitionTo('soumise', 'cloturee')).toBe(false);
  });

  it('refuse validee → brouillon', () => {
    expect(canTransitionTo('validee', 'brouillon')).toBe(false);
  });

  it('refuse validee → soumise', () => {
    expect(canTransitionTo('validee', 'soumise')).toBe(false);
  });

  it('refuse cloturee → brouillon (état terminal)', () => {
    expect(canTransitionTo('cloturee', 'brouillon')).toBe(false);
  });

  it('refuse cloturee → en_cours (état terminal)', () => {
    expect(canTransitionTo('cloturee', 'en_cours')).toBe(false);
  });

  it('refuse cloturee → soumise (état terminal)', () => {
    expect(canTransitionTo('cloturee', 'soumise')).toBe(false);
  });

  it('refuse cloturee → validee (état terminal)', () => {
    expect(canTransitionTo('cloturee', 'validee')).toBe(false);
  });
});

describe('canTransitionTo — même statut (auto-transition)', () => {
  const statuts: EvaluationStatut[] = ['brouillon', 'en_cours', 'soumise', 'validee', 'cloturee'];

  statuts.forEach(statut => {
    it(`refuse ${statut} → ${statut} (pas de transition vers soi-même)`, () => {
      expect(canTransitionTo(statut, statut)).toBe(false);
    });
  });
});
