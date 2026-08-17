import { describe, it, expect } from 'vitest';
import { calculerComparaisonFaritany } from '@/services/indice/calculerComparaisonFaritany';
import type { Referentiel, CritereDef, DimensionDef } from '@/types';

function crit(code: string, actif = true): CritereDef {
  return { code, libelle: { fr: code, en: code }, essentiel: false, actif, ordre: 0, sourceCodes: [], socle: true, indicateurErp: [] };
}
function dim(code: string, criteres: CritereDef[], ordre = 1): DimensionDef {
  return { code, nom: { fr: code, en: code }, ordre, criteres };
}
function ref(dimensions: DimensionDef[]): Referentiel {
  return { version: 'far_v1_0', nom: { fr: 'far', en: 'far' }, niveau: 'ASN', actif: true, dimensions };
}
const orgInfo = {
  A: { nom: 'Antananarivo I', code: 'ANT-01' },
  B: { nom: 'Fianarantsoa', code: 'FIA-07' },
};

describe('calculerComparaisonFaritany', () => {
  it('ID par dimension et global rendus en 0-100 (scoreSurCriteres, pas de x100/3)', () => {
    const r = ref([dim('D01', [crit('F1'), crit('F2')])]);
    const res = calculerComparaisonFaritany(r, [{ orgId: 'A', scores: { F1: 3, F2: 3 } }], orgInfo);
    const a = res.find((l) => l.asnId === 'A')!;
    expect(a.scoreParDimension['D01']).toBe(100);
    expect(a.scoreGlobal).toBe(100);
    expect(a.nom).toBe('Antananarivo I');
    expect(a.code).toBe('ANT-01');
  });

  it('idGlobal = moyenne des IDs par dimension (mean-of-means), PAS moyenne plate des criteres', () => {
    // D01 : 1 crit=3 -> 100 ; D02 : 3 crits=0 -> 0.
    // mean-of-means = (100+0)/2 = 50 ; moyenne plate serait (3+0+0+0)/(4*3)*100 = 25.
    const r = ref([dim('D01', [crit('F1')], 1), dim('D02', [crit('G1'), crit('G2'), crit('G3')], 2)]);
    const res = calculerComparaisonFaritany(r, [{ orgId: 'A', scores: { F1: 3, G1: 0, G2: 0, G3: 0 } }], orgInfo);
    const a = res.find((l) => l.asnId === 'A')!;
    expect(a.scoreParDimension['D01']).toBe(100);
    expect(a.scoreParDimension['D02']).toBe(0);
    expect(a.scoreGlobal).toBe(50);
  });

  it('exclut absent ET N/A du calcul de dimension (lentille ID)', () => {
    const r = ref([dim('D01', [crit('F1'), crit('F2'), crit('F3')])]);
    // F1=3 note, F2 ABSENT (hors scores), F3=null N/A -> seul F1 compte -> 100.
    const res = calculerComparaisonFaritany(r, [{ orgId: 'A', scores: { F1: 3, F3: null } }], orgInfo);
    expect(res.find((l) => l.asnId === 'A')!.scoreParDimension['D01']).toBe(100);
  });

  it('dimension sans critere scoré -> 0 en cellule mais EXCLUE de la moyenne globale', () => {
    const r = ref([dim('D01', [crit('F1')], 1), dim('D02', [crit('G1')], 2)]);
    const res = calculerComparaisonFaritany(r, [{ orgId: 'A', scores: { F1: 3 } }], orgInfo);
    const a = res.find((l) => l.asnId === 'A')!;
    expect(a.scoreParDimension['D02']).toBe(0);
    expect(a.scoreGlobal).toBe(100); // = D01 seul, PAS (100+0)/2 = 50
  });

  it('ligne exclue si TOUTES les dimensions sont nulles', () => {
    const r = ref([dim('D01', [crit('F1')], 1), dim('D02', [crit('G1')], 2)]);
    const res = calculerComparaisonFaritany(r, [{ orgId: 'B', scores: { X: 3 } }], orgInfo);
    expect(res.find((l) => l.asnId === 'B')).toBeUndefined();
  });

  it('ignore les criteres inactifs', () => {
    const r = ref([dim('D01', [crit('F1'), crit('F2', false)])]);
    const res = calculerComparaisonFaritany(r, [{ orgId: 'A', scores: { F1: 3, F2: 0 } }], orgInfo);
    // F2 inactif exclu -> score = F1 seul = 100 (non dilué).
    expect(res.find((l) => l.asnId === 'A')!.scoreParDimension['D01']).toBe(100);
  });

  it('une ligne par Faritany participant', () => {
    const r = ref([dim('D01', [crit('F1')])]);
    const res = calculerComparaisonFaritany(
      r,
      [{ orgId: 'A', scores: { F1: 3 } }, { orgId: 'B', scores: { F1: 0 } }],
      orgInfo,
    );
    expect(res).toHaveLength(2);
    expect(res.find((l) => l.asnId === 'A')!.scoreGlobal).toBe(100);
    expect(res.find((l) => l.asnId === 'B')!.scoreGlobal).toBe(0);
  });
});
