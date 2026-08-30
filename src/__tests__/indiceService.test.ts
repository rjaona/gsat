import { describe, it, expect, vi, beforeEach } from 'vitest';

const refFar = {
  version: 'far_v1_0', libelle: 'far', niveau: 'ASN', actif: true,
  dimensions: [{ code: 'D01', libelle: 'D01', description: '', actif: true, criteres: [
    { code: 'F1', libelle: 'F1', description: '', essentiel: false, actif: true, sourceCodes: ['401'] },
    { code: 'F2', libelle: 'F2', description: '', essentiel: false, actif: true, sourceCodes: ['401'] },
  ] }],
};

const db = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]> }));

vi.mock('@/services/referentielService', () => ({
  getReferentiel: vi.fn(async (v: string) => (v === 'far_v1_0' ? refFar : null)),
}));

vi.mock('@/services/organisationService', () => ({
  getLibelleNiveauLocal: vi.fn(async () => 'Faritany'),
}));

// Builder mock : select/eq/in/order (tri réel) + thenable (list). Pas de single/limit.
vi.mock('@/services/supabase', () => {
  function from(table: string) {
    let rows = (db.tables[table] ?? []).slice();
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (col: string, val: unknown) => { rows = rows.filter((r) => (r as Record<string, unknown>)[col] === val); return api; },
      in: (col: string, vals: unknown[]) => { rows = rows.filter((r) => vals.includes((r as Record<string, unknown>)[col])); return api; },
      order: (col: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending ?? true;
        rows = rows.slice().sort((a, b) => {
          const av = (a as Record<string, unknown>)[col] as string;
          const bv = (b as Record<string, unknown>)[col] as string;
          return (av > bv ? 1 : av < bv ? -1 : 0) * (asc ? 1 : -1);
        });
        return api;
      },
      then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows, error: null }),
    };
    return api;
  }
  return { supabase: { from } };
});

import { getIndiceComplet } from '@/services/indiceService';

beforeEach(() => {
  db.tables = {
    campagnes: [
      { id: 'campF1', referentiel_version: 'far_v1_0' },
      { id: 'campF2', referentiel_version: 'far_v1_0' },
      { id: 'campN',  referentiel_version: 'v3_0' },
    ],
    evaluations: [
      // A évaluée 2 fois : ancienne (campF1, score 0) et récente (campF2, score 100) → dédup garde la récente
      { id: 'eA_old', campagne_id: 'campF1', org_id: 'A', created_at: '2026-01-01' },
      { id: 'eA_new', campagne_id: 'campF2', org_id: 'A', created_at: '2026-06-01' },
      { id: 'eB',     campagne_id: 'campF1', org_id: 'B', created_at: '2026-01-01' },
      { id: 'eC',     campagne_id: 'campF2', org_id: 'C', created_at: '2026-06-01' }, // AUCUN score
      // National : validée (ancienne, 401=3) + en_cours (récente, 401=1) → préférer la VALIDÉE
      { id: 'nVal', campagne_id: 'campN', org_id: 'OSN', statut: 'validee',  created_at: '2026-02-01' },
      { id: 'nCur', campagne_id: 'campN', org_id: 'OSN', statut: 'en_cours', created_at: '2026-07-01' },
    ],
    evaluation_scores: [
      { eval_id: 'eA_old', critere_code: 'F1', note: 0 }, { eval_id: 'eA_old', critere_code: 'F2', note: 0 },
      { eval_id: 'eA_new', critere_code: 'F1', note: 3 }, { eval_id: 'eA_new', critere_code: 'F2', note: 3 },
      { eval_id: 'eB',     critere_code: 'F1', note: 0 }, { eval_id: 'eB',     critere_code: 'F2', note: 0 },
      { eval_id: 'nVal', critere_code: '401', note: 3 },
      { eval_id: 'nCur', critere_code: '401', note: 1 },
    ],
    organisations: [
      { id: 'A', poids: 3, parent_id: 'OSN', nom: 'Antananarivo I', code: 'ANT-01' },
      { id: 'B', poids: 1, parent_id: 'OSN', nom: 'Fianarantsoa', code: 'FIA-07' },
      { id: 'C', poids: 100, parent_id: 'OSN', nom: 'Toamasina', code: 'TOA-06' },
    ],
  };
});

describe('getIndiceComplet — table nationale', () => {
  it('agrège toutes les campagnes far, dédup dernière éval/Faritany, préfère la note nationale validée', async () => {
    const { national: res } = await getIndiceComplet();
    const c401 = res.find((r) => r.code === '401')!;
    // dédup A → eA_new (100), pas eA_old (0) ; C sans score exclue (poids 100 ne dilue pas)
    // ID = (100*3 + 0*1) / (3+1) = 75
    expect(c401.id).toBe(75);
    expect(c401.nbFaritanyContributeurs).toBe(2);
    // note nationale = validée (3), PAS en_cours la plus récente (1) → écart = 3*100/3 − 75 = 25
    expect(c401.noteNationale).toBe(3);
    expect(c401.ecart).toBe(25);
  });

  it('rend ID-only (écart indéfini) sans campagne nationale v3_0', async () => {
    db.tables['campagnes'] = [{ id: 'campF1', referentiel_version: 'far_v1_0' }];
    const { national: res } = await getIndiceComplet();
    const c401 = res.find((r) => r.code === '401');
    // A (eA_old=0), B (0) dans campF1 → ID = 0 ; aucune note nationale
    expect(c401?.noteNationale).toBeNull();
    expect(c401?.ecart).toBeUndefined();
  });

  it('replie vers l\'éval nationale la plus récente si aucune n\'est validée', async () => {
    // Remplace les évals nationales : nOld (en_cours, créée 2026-01-01, score 401=1) + nNew (soumise, créée 2026-09-01, score 401=3)
    db.tables['evaluations'] = [
      { id: 'eA_old', campagne_id: 'campF1', org_id: 'A', created_at: '2026-01-01' },
      { id: 'eA_new', campagne_id: 'campF2', org_id: 'A', created_at: '2026-06-01' },
      { id: 'eB',     campagne_id: 'campF1', org_id: 'B', created_at: '2026-01-01' },
      { id: 'eC',     campagne_id: 'campF2', org_id: 'C', created_at: '2026-06-01' },
      // National: AUCUN validée, fallback à la plus récente (nNew)
      { id: 'nOld', campagne_id: 'campN', org_id: 'OSN', statut: 'en_cours', created_at: '2026-01-01' },
      { id: 'nNew', campagne_id: 'campN', org_id: 'OSN', statut: 'soumise', created_at: '2026-09-01' },
    ];
    db.tables['evaluation_scores'] = [
      { eval_id: 'eA_old', critere_code: 'F1', note: 0 }, { eval_id: 'eA_old', critere_code: 'F2', note: 0 },
      { eval_id: 'eA_new', critere_code: 'F1', note: 3 }, { eval_id: 'eA_new', critere_code: 'F2', note: 3 },
      { eval_id: 'eB',     critere_code: 'F1', note: 0 }, { eval_id: 'eB',     critere_code: 'F2', note: 0 },
      { eval_id: 'nOld', critere_code: '401', note: 1 },
      { eval_id: 'nNew', critere_code: '401', note: 3 },
    ];
    const { national: res } = await getIndiceComplet();
    const c401 = res.find((r) => r.code === '401')!;
    // ID = (100*3 + 0*1) / (3+1) = 75 (même que le premier test)
    expect(c401.id).toBe(75);
    // Sans validée, fallback à nNew (la plus récente par created_at), donc note 3 (pas 1 de nOld)
    expect(c401.noteNationale).toBe(3);
    // écart = 3*100/3 − 75 = 25
    expect(c401.ecart).toBe(25);
  });

  it('préserve note nationale null (N/A) dans l\'écart', async () => {
    // Remplace les évals nationales : une seule validée avec score 401=null
    db.tables['evaluations'] = [
      { id: 'eA_old', campagne_id: 'campF1', org_id: 'A', created_at: '2026-01-01' },
      { id: 'eA_new', campagne_id: 'campF2', org_id: 'A', created_at: '2026-06-01' },
      { id: 'eB',     campagne_id: 'campF1', org_id: 'B', created_at: '2026-01-01' },
      { id: 'eC',     campagne_id: 'campF2', org_id: 'C', created_at: '2026-06-01' },
      // National: validée avec score null pour 401
      { id: 'nValNull', campagne_id: 'campN', org_id: 'OSN', statut: 'validee', created_at: '2026-02-01' },
    ];
    db.tables['evaluation_scores'] = [
      { eval_id: 'eA_old', critere_code: 'F1', note: 0 }, { eval_id: 'eA_old', critere_code: 'F2', note: 0 },
      { eval_id: 'eA_new', critere_code: 'F1', note: 3 }, { eval_id: 'eA_new', critere_code: 'F2', note: 3 },
      { eval_id: 'eB',     critere_code: 'F1', note: 0 }, { eval_id: 'eB',     critere_code: 'F2', note: 0 },
      { eval_id: 'nValNull', critere_code: '401', note: null },
    ];
    const { national: res } = await getIndiceComplet();
    const c401 = res.find((r) => r.code === '401')!;
    // ID = (100*3 + 0*1) / (3+1) = 75 (même que les autres tests)
    expect(c401.id).toBe(75);
    // Note nationale null (N/A)
    expect(c401.noteNationale).toBeNull();
    // écart indéfini quand note nationale est null
    expect(c401.ecart).toBeUndefined();
  });

  it('scope l\'éval nationale à l\'OSN parent des Faritany, ignore l\'éval plus récente d\'un autre OSN', async () => {
    // Deux évals nationales validées : celle de l'OSN (parent de A/B/C) et un leurre
    // d'un autre OSN (org_id différent), plus récente → ne doit PAS être choisie.
    db.tables['evaluations'] = [
      { id: 'eA_old', campagne_id: 'campF1', org_id: 'A', created_at: '2026-01-01' },
      { id: 'eA_new', campagne_id: 'campF2', org_id: 'A', created_at: '2026-06-01' },
      { id: 'eB',     campagne_id: 'campF1', org_id: 'B', created_at: '2026-01-01' },
      { id: 'eC',     campagne_id: 'campF2', org_id: 'C', created_at: '2026-06-01' },
      // National : OSN (validée, 401=3) + leurre OSN2 (validée, plus récente, 401=0)
      { id: 'nOSN',     campagne_id: 'campN', org_id: 'OSN',  statut: 'validee', created_at: '2026-02-01' },
      { id: 'nForeign', campagne_id: 'campN', org_id: 'OSN2', statut: 'validee', created_at: '2026-09-01' },
    ];
    db.tables['evaluation_scores'] = [
      { eval_id: 'eA_old', critere_code: 'F1', note: 0 }, { eval_id: 'eA_old', critere_code: 'F2', note: 0 },
      { eval_id: 'eA_new', critere_code: 'F1', note: 3 }, { eval_id: 'eA_new', critere_code: 'F2', note: 3 },
      { eval_id: 'eB',     critere_code: 'F1', note: 0 }, { eval_id: 'eB',     critere_code: 'F2', note: 0 },
      { eval_id: 'nOSN',     critere_code: '401', note: 3 },
      { eval_id: 'nForeign', critere_code: '401', note: 0 },
    ];
    const { national: res } = await getIndiceComplet();
    const c401 = res.find((r) => r.code === '401')!;
    // ID = (100*3 + 0*1) / (3+1) = 75 (même que les autres tests)
    expect(c401.id).toBe(75);
    // Note nationale = celle de l'OSN (3), PAS 0 du leurre OSN2 plus récent
    expect(c401.noteNationale).toBe(3);
    // écart = 3*100/3 − 75 = 25
    expect(c401.ecart).toBe(25);
  });
});

describe('getIndiceComplet', () => {
  it('rend national + comparaison par Faritany depuis le MÊME chargement', async () => {
    const { national, faritany, dimensionCodes, niveauLabel } = await getIndiceComplet();
    expect(dimensionCodes).toEqual(['D01']);
    expect(niveauLabel).toBe('Faritany');
    // National identique à la table nationale (même loader).
    expect(national.find((r) => r.code === '401')!.id).toBe(75);
    // Faritany : A (eA_new F1=F2=3 → 100) et B (0) ; C sans score exclu.
    expect(faritany).toHaveLength(2);
    const a = faritany.find((l) => l.asnId === 'A')!;
    expect(a.scoreGlobal).toBe(100);
    expect(a.nom).toBe('Antananarivo I');
    expect(a.code).toBe('ANT-01');
    expect(faritany.find((l) => l.asnId === 'B')!.scoreGlobal).toBe(0);
    expect(faritany.find((l) => l.asnId === 'C')).toBeUndefined();
  });
});
