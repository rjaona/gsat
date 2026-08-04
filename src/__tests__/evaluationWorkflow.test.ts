import { describe, it, expect } from 'vitest';
import {
  canTransitionTo, verifierTransition, verifierAutoValidation,
  calculerEcheanceRevue, statutRevue, scoreRisqueRevue,
} from '@/services/evaluationWorkflow';

const ctx = (role: any, same = true) => ({
  role, userOrgId: 'org-A', evalOrgId: same ? 'org-A' : 'org-B',
});

describe('Machine à états', () => {
  it('autorise l\'auto-validation directe en_cours → validee', () => {
    expect(canTransitionTo('en_cours', 'validee')).toBe(true);
  });
  it('conserve le chemin accompagné en_cours → soumise → validee', () => {
    expect(canTransitionTo('en_cours', 'soumise')).toBe(true);
    expect(canTransitionTo('soumise', 'validee')).toBe(true);
  });
  it('autorise le renvoi en révision depuis validee', () => {
    expect(canTransitionTo('validee', 'en_cours')).toBe(true);
  });
  it('interdit de rouvrir une évaluation clôturée', () => {
    expect(canTransitionTo('cloturee', 'en_cours')).toBe(false);
    expect(canTransitionTo('cloturee', 'validee')).toBe(false);
  });
  it('interdit de sauter de brouillon à validee', () => {
    expect(canTransitionTo('brouillon', 'validee')).toBe(false);
  });
});

describe('Périmètre et rôles', () => {
  it('un responsable_asn valide sa propre évaluation', () => {
    expect(verifierTransition('en_cours', 'validee', ctx('responsable_asn')).autorise).toBe(true);
  });
  it('un responsable_asn ne touche pas celle d\'un autre Faritany', () => {
    const v = verifierTransition('en_cours', 'validee', ctx('responsable_asn', false));
    expect(v.autorise).toBe(false);
    expect(v.raison).toContain('autre organisation');
  });
  it('un responsable_asn ne clôture pas', () => {
    const v = verifierTransition('validee', 'cloturee', ctx('responsable_asn'));
    expect(v.autorise).toBe(false);
    expect(v.raison).toContain('rôle');
  });
  it('un utilisateur_asn ne valide pas', () => {
    expect(verifierTransition('en_cours', 'validee', ctx('utilisateur_asn')).autorise).toBe(false);
  });
  it('le national clôture', () => {
    expect(verifierTransition('validee', 'cloturee', ctx('responsable_osn', false)).autorise).toBe(true);
  });
  it('un lecteur ne fait rien', () => {
    expect(verifierTransition('brouillon', 'en_cours', ctx('lecteur')).autorise).toBe(false);
  });
});

describe('Pré-conditions d\'auto-validation', () => {
  it('refuse sans PV de comité', () => {
    const v = verifierAutoValidation({ pvComitePath: '', essentielsKO: [] });
    expect(v.autorise).toBe(false);
    expect(v.erreurs[0]).toContain('procès-verbal');
  });
  it('accepte avec PV et aucun essentiel KO', () => {
    expect(verifierAutoValidation({ pvComitePath: 'pv.pdf', essentielsKO: [] }).autorise).toBe(true);
  });
  it('avertit sur les essentiels KO et exige une confirmation', () => {
    const v = verifierAutoValidation({ pvComitePath: 'pv.pdf', essentielsKO: ['F401', 'F405'] });
    expect(v.autorise).toBe(false);
    expect(v.avertissements[0]).toContain('F401, F405');
    expect(v.erreurs[0]).toContain('Confirmez');
  });
  it('valide malgré des essentiels KO une fois confirmé — on ne pousse pas à masquer', () => {
    const v = verifierAutoValidation({
      pvComitePath: 'pv.pdf', essentielsKO: ['F401'], confirmeMalgreEssentiels: true,
    });
    expect(v.autorise).toBe(true);
    expect(v.avertissements).toHaveLength(1);
  });
});

describe('Échéance de revue', () => {
  it('pose l\'échéance à 60 jours par défaut', () => {
    const d = calculerEcheanceRevue(new Date('2026-08-04T00:00:00Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2026-10-03');
  });
  it('respecte un délai configuré', () => {
    const d = calculerEcheanceRevue(new Date('2026-08-04T00:00:00Z'), 30);
    expect(d.toISOString().slice(0, 10)).toBe('2026-09-03');
  });
  it('classe l\'urgence', () => {
    const now = new Date('2026-08-04T00:00:00Z');
    expect(statutRevue(new Date('2026-08-01T00:00:00Z'), now).urgence).toBe('depassee');
    expect(statutRevue(new Date('2026-08-09T00:00:00Z'), now).urgence).toBe('imminente');
    expect(statutRevue(new Date('2026-10-03T00:00:00Z'), now).urgence).toBe('normale');
    expect(statutRevue(null, now).urgence).toBe('normale');
  });
});

describe('File de revue par le risque', () => {
  it('classe un Faritany à essentiels KO devant un Faritany propre', () => {
    const risque = scoreRisqueRevue({ nbEssentielsKO: 2, nbIncoherences: 0, nbAlertesCritiques: 0 });
    const propre = scoreRisqueRevue({ nbEssentielsKO: 0, nbIncoherences: 0, nbAlertesCritiques: 0 });
    expect(risque).toBeGreaterThan(propre);
  });
  it('traite une progression spectaculaire comme un signal, pas une bonne nouvelle', () => {
    const bond = scoreRisqueRevue({
      nbEssentielsKO: 0, nbIncoherences: 0, nbAlertesCritiques: 0, progressionPoints: 40,
    });
    expect(bond).toBeGreaterThan(0);
  });
  it('ne récompense pas une progression modérée', () => {
    expect(scoreRisqueRevue({
      nbEssentielsKO: 0, nbIncoherences: 0, nbAlertesCritiques: 0, progressionPoints: 10,
    })).toBe(0);
  });
  it('remonte une échéance dépassée', () => {
    expect(scoreRisqueRevue({
      nbEssentielsKO: 0, nbIncoherences: 0, nbAlertesCritiques: 0, joursAvantEcheance: -3,
    })).toBe(15);
  });
  it('ordonne une file de 4 Faritany de façon plausible', () => {
    const file = [
      { nom: 'propre',      s: { nbEssentielsKO: 0, nbIncoherences: 0, nbAlertesCritiques: 0, joursAvantEcheance: 50 } },
      { nom: 'incoherent',  s: { nbEssentielsKO: 0, nbIncoherences: 3, nbAlertesCritiques: 1, joursAvantEcheance: 50 } },
      { nom: 'essentielsKO',s: { nbEssentielsKO: 3, nbIncoherences: 0, nbAlertesCritiques: 2, joursAvantEcheance: 50 } },
      { nom: 'enRetard',    s: { nbEssentielsKO: 0, nbIncoherences: 0, nbAlertesCritiques: 0, joursAvantEcheance: -2 } },
    ].map(f => ({ ...f, r: scoreRisqueRevue(f.s) })).sort((a, b) => b.r - a.r);
    expect(file.map(f => f.nom)).toEqual(['essentielsKO', 'incoherent', 'enRetard', 'propre']);
  });
});
