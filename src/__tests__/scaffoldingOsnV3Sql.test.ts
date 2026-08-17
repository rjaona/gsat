import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest s'exécute depuis la racine du repo (process.cwd()).
const sql = readFileSync(
  resolve(process.cwd(), 'supabase/seeds/campagne_eval_osn_v3_0.sql'),
  'utf8',
);

describe('scaffolding OSN v3_0 SQL', () => {
  it('campagne v3_0 ouverte, périmètre OSN, mode complet', () => {
    expect(sql).toContain('INSERT INTO campagnes');
    expect(sql).toContain("'v3_0'");
    expect(sql).toContain("'ouverte'");
    expect(sql).toContain("'complet'");
    expect(sql).toContain("FROM organisations WHERE type = 'OSN'");
  });

  it('éval OSN en_cours de type auto', () => {
    expect(sql).toContain('INSERT INTO evaluations');
    expect(sql).toContain("'en_cours'");
    expect(sql).toContain("'auto'");
  });

  it('idempotent et transactionnel', () => {
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE');
    expect(sql).toContain('ON CONFLICT (org_id, campagne_id) DO UPDATE');
    expect(sql).toContain('BEGIN;');
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true);
  });

  it('ne force jamais la validation (pas de statut validee ni de PV)', () => {
    expect(sql).not.toContain("'validee'");
    expect(sql).not.toContain('pv_comite_path');
  });
});
