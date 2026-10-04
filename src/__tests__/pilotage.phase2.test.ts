import { describe, it, expect } from 'vitest';
import { choisirPlanCourant, choisirCiblePlan, resoudreOsnPilotage, indexerLibellesCriteres } from '@/utils/pilotage';

const p = (id: string, createdAt: string) => ({ id, createdAt });

describe('choisirPlanCourant', () => {
  it('rend le plus récent par createdAt, sans muter l entrée', () => {
    const plans = [p('ancien', '2026-01-01T00:00:00Z'), p('recent', '2026-06-01T00:00:00Z'), p('milieu', '2026-03-01T00:00:00Z')];
    expect(choisirPlanCourant(plans)?.id).toBe('recent');
    expect(plans[0]?.id).toBe('ancien');
  });
  it('undefined si aucun plan', () => {
    expect(choisirPlanCourant([])).toBeUndefined();
  });
});

describe('choisirCiblePlan', () => {
  it('plusieurs plans → le plan courant (celui que lit le régional), jamais une création', () => {
    expect(choisirCiblePlan([p('a', '2026-01-01'), p('b', '2026-05-01')], 'ev9')).toEqual({ kind: 'plan', planId: 'b' });
  });
  it('aucun plan mais une évaluation → créer sur cette évaluation', () => {
    expect(choisirCiblePlan([], 'ev1')).toEqual({ kind: 'creer', evalId: 'ev1' });
  });
  it('ni plan ni évaluation → impossible', () => {
    expect(choisirCiblePlan([], null)).toEqual({ kind: 'impossible' });
  });
});

describe('resoudreOsnPilotage', () => {
  const osns = [{ id: 'osn-mg', parentId: 'region-af' }, { id: 'osn-sn', parentId: 'region-x' }];
  it('compte OSN → son org', () => {
    expect(resoudreOsnPilotage({ role: 'responsable_osn', orgId: 'osn-mg', orgType: 'OSN' }, [])).toBe('osn-mg');
  });
  it('admin_global rattaché à la racine OMMS → première OSN visible', () => {
    expect(resoudreOsnPilotage({ role: 'admin_global', orgId: 'omms', orgType: 'OMMS' }, osns)).toBe('osn-mg');
  });
  it('responsable_region → OSN enfant de sa région', () => {
    expect(resoudreOsnPilotage({ role: 'responsable_region', orgId: 'region-x', orgType: 'REGION' }, osns)).toBe('osn-sn');
  });
  it('aucune OSN résoluble → null (jamais un cockpit vide silencieux)', () => {
    expect(resoudreOsnPilotage({ role: 'admin_global', orgId: 'omms', orgType: 'OMMS' }, [])).toBeNull();
    expect(resoudreOsnPilotage({ role: 'responsable_asn', orgId: 'f1', orgType: 'ASN' }, osns)).toBeNull();
    expect(resoudreOsnPilotage({ role: undefined, orgId: undefined, orgType: undefined }, osns)).toBeNull();
  });
});

describe('indexerLibellesCriteres', () => {
  it('indexe code → libellé fr, toutes dimensions', () => {
    const ref = { dimensions: [
      { criteres: [{ code: 'F401', libelle: { fr: 'Assurance des membres' } }] },
      { criteres: [{ code: 'F105', libelle: { fr: '' } }] },
    ] };
    expect(indexerLibellesCriteres(ref)).toEqual({ F401: 'Assurance des membres', F105: 'F105' });
  });
  it('référentiel absent → {}', () => {
    expect(indexerLibellesCriteres(null)).toEqual({});
  });
});
