import { describe, it, expect } from 'vitest';
import { genV3Seed, type V3ReferentielJson } from '@/services/seed/genV3Seed';
import v3 from '@/data/referentiel_v3_0.json';
import far from '@/data/far_v1_0.json';

const sql = genV3Seed(v3 as unknown as V3ReferentielJson);

const nbCrit = (v3 as { dimensions: { criteres: unknown[] }[] }).dimensions
  .reduce((n, d) => n + d.criteres.length, 0);

describe('genV3Seed', () => {
  it('seede version=v3_0 (PAS 3.0) dans referentiel_versions', () => {
    expect(sql).toContain('INSERT INTO referentiel_versions');
    expect(sql).toContain("VALUES ('v3_0',");
    expect(sql).toContain("'OSN'"); // niveau OSN
  });

  it('émet une ligne par dimension et par critère', () => {
    const nbDim = (sql.match(/INSERT INTO dimensions/g) ?? []).length;
    const nbC = (sql.match(/INSERT INTO criteres/g) ?? []).length;
    expect(nbDim).toBe((v3 as { dimensions: unknown[] }).dimensions.length);
    expect(nbC).toBe(nbCrit);
  });

  it('couvre les sourceCodes de far_v1_0 (sinon les écarts ne calculeront pas)', () => {
    const farCodes = new Set(
      (far as { dimensions: { criteres: { actif: boolean; sourceCodes: string[] }[] }[] }).dimensions
        .flatMap((d) => d.criteres).filter((c) => c.actif).flatMap((c) => c.sourceCodes),
    );
    const v3Codes = new Set(
      (v3 as { dimensions: { criteres: { code: string }[] }[] }).dimensions
        .flatMap((d) => d.criteres).map((c) => c.code),
    );
    expect(farCodes.size).toBeGreaterThan(0);
    for (const code of farCodes) expect(v3Codes.has(code)).toBe(true);
    // et chaque code apparaît bien dans un INSERT criteres
    for (const code of farCodes) expect(sql).toContain(`, '${code}', `);
  });

  it('échappe les apostrophes (SQL-safe)', () => {
    // le critère 101 contient "L'OSN" → doit être doublé, jamais laissé simple.
    expect(sql).toContain("L''OSN");
    expect(sql).not.toContain("L'OSN"); // la version non échappée ne doit pas apparaître
  });

  it('est idempotent (ON CONFLICT DO UPDATE) et transactionnel', () => {
    expect(sql).toContain('ON CONFLICT (version) DO UPDATE');
    expect(sql).toContain('ON CONFLICT (ref_id, code) DO UPDATE');
    expect(sql).toContain('ON CONFLICT (dimension_id, code) DO UPDATE');
    expect(sql.trimStart().startsWith('--')).toBe(true);
    expect(sql).toContain('BEGIN;');
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });
});
