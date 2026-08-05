import { describe, it, expect } from 'vitest';
import { calculerIndiceDeploiement } from '@/services/indice/calculerIndiceDeploiement';
import type { Referentiel, CritereDef, DimensionDef } from '@/types';

function crit(code: string, sourceCodes: string[], actif = true): CritereDef {
  return { code, libelle: code, description: '', essentiel: false, actif, sourceCodes } as CritereDef;
}
function ref(criteres: CritereDef[]): Referentiel {
  const dim = { code: 'D01', libelle: 'D01', description: '', actif: true, criteres } as DimensionDef;
  return { version: 'far_v1_0', libelle: 'far', niveau: 'ASN', actif: true, dimensions: [dim] } as Referentiel;
}

// Réf : critère national 401 a 2 enfants far (F1,F2) ; 706 a 1 enfant (F3).
const refFar = ref([crit('F1', ['401']), crit('F2', ['401']), crit('F3', ['706'])]);

describe('calculerIndiceDeploiement', () => {
  it('pondere par poids (poids VARIES - sinon indistinguable d une moyenne simple)', () => {
    // A: F1=3,F2=3 → score_A(401)=100 ; B: F1=0,F2=0 → score_B(401)=0
    // poids A=3, B=1 → ID(401) = (100*3 + 0*1)/4 = 75
    const res = calculerIndiceDeploiement(
      refFar,
      [{ orgId: 'A', scores: { F1: 3, F2: 3 } }, { orgId: 'B', scores: { F1: 0, F2: 0 } }],
      { A: 3, B: 1 },
      { 401: 3, 706: 2 },
    );
    const c401 = res.find((r) => r.code === '401')!;
    expect(c401.id).toBe(75);
    expect(c401.nbEnfants).toBe(2);
    expect(c401.nbFaritanyContributeurs).toBe(2);
    // écart = 3*100/3 - 75 = 25 → cohérent
    expect(c401.ecart).toBe(25);
    expect(c401.interpretation).toBe('coherent');
  });

  it('un Faritany non participant est ABSENT (pas note 0) : n apparait pas dans poids/evals', () => {
    // seul A participe ; C (poids 100) n'a pas d'éval → ID = score_A, pas dilué
    const res = calculerIndiceDeploiement(
      refFar,
      [{ orgId: 'A', scores: { F1: 3, F2: 3 } }],
      { A: 1, C: 100 },
      { 401: 3, 706: 2 },
    );
    expect(res.find((r) => r.code === '401')!.id).toBe(100);
    expect(res.find((r) => r.code === '401')!.nbFaritanyContributeurs).toBe(1);
  });

  it('note nationale N/A (null) - ecart et interpretation indefinis', () => {
    const res = calculerIndiceDeploiement(
      refFar, [{ orgId: 'A', scores: { F1: 3, F2: 3 } }], { A: 1 }, { 401: null, 706: 2 },
    );
    const c401 = res.find((r) => r.code === '401')!;
    expect(c401.noteNationale).toBeNull();
    expect(c401.ecart).toBeUndefined();
    expect(c401.interpretation).toBeUndefined();
  });

  it('aucun enfant score pour X - id null, ecart indefini', () => {
    const res = calculerIndiceDeploiement(
      refFar, [{ orgId: 'A', scores: { F1: 3, F2: 3 } }], { A: 1 }, { 401: 3, 706: 2 },
    );
    const c706 = res.find((r) => r.code === '706')!;
    expect(c706.id).toBeNull();          // F3 jamais scoré
    expect(c706.ecart).toBeUndefined();
  });

  it('bandes d interprétation : >+30 alerte, <-10 bonne pratique', () => {
    // national 401=3 (→100), terrain nul → écart=100 → alerte
    const alerte = calculerIndiceDeploiement(refFar, [{ orgId: 'A', scores: { F1: 0, F2: 0 } }], { A: 1 }, { 401: 3 });
    expect(alerte.find((r) => r.code === '401')!.interpretation).toBe('alerte');
    // national 401=1 (→33.33), terrain excellent (100) → écart≈-66.67 → bonne pratique
    const bp = calculerIndiceDeploiement(refFar, [{ orgId: 'A', scores: { F1: 3, F2: 3 } }], { A: 1 }, { 401: 1 });
    expect(bp.find((r) => r.code === '401')!.interpretation).toBe('bonne_pratique');
  });

  it('multi-parent : un enfant far rattache a 2 criteres nationaux compte pour les deux', () => {
    const r2 = ref([crit('F1', ['401', '706'])]);
    const res = calculerIndiceDeploiement(r2, [{ orgId: 'A', scores: { F1: 3 } }], { A: 1 }, { 401: 3, 706: 3 });
    expect(res.find((r) => r.code === '401')!.id).toBe(100);
    expect(res.find((r) => r.code === '706')!.id).toBe(100);
  });

  it('ignore les enfants inactifs dans le mapping', () => {
    const r2 = ref([crit('F1', ['401']), crit('F2', ['401'], false)]); // F2 inactif
    const res = calculerIndiceDeploiement(r2, [{ orgId: 'A', scores: { F1: 3, F2: 0 } }], { A: 1 }, { 401: 3 });
    // F2 inactif exclu du mapping → score = F1 seul = 100
    expect(res.find((r) => r.code === '401')!.id).toBe(100);
    expect(res.find((r) => r.code === '401')!.nbEnfants).toBe(1);
  });
});
