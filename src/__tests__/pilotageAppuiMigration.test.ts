import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Garde statique de la migration Phase 2 (appui national). La preuve
// d'exécution est docs/superpowers/verif/appui-rls.sql (claims forgés, ROLLBACK).
const raw = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261004_pilotage_appui.sql'), 'utf8');
// SQL exécutable seul (le bloc rollback est commenté).
const sql = raw.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');

function extractPolicy(name: string): string {
  const start = sql.indexOf(`CREATE POLICY ${name} `);
  if (start === -1) throw new Error(`policy ${name} introuvable`);
  return sql.slice(start, sql.indexOf(';', start));
}

const DESCENDANT = /o\.parent_id = \(auth\.jwt\(\) ->> 'org_id'\)::uuid/;

describe('migration 20261004_pilotage_appui', () => {
  it('ne lit jamais le claim système role (piège user_role)', () => {
    expect(sql).not.toMatch(/->>\s*'role'/);
  });

  it("n'ouvre ni DELETE ni FOR ALL", () => {
    expect(sql).not.toMatch(/FOR DELETE/);
    expect(sql).not.toMatch(/FOR ALL/);
  });

  it('table appui_faritany sous RLS + un seul appui ouvert par Faritany (index partiel)', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS appui_faritany/);
    expect(sql).toMatch(/ALTER TABLE appui_faritany ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_appui_ouvert_par_org\s+ON appui_faritany \(org_id\) WHERE statut = 'ouvert'/);
  });

  it('écritures appui réservées au national, bornées au Faritany enfant', () => {
    for (const p of ['appui_insert', 'appui_update']) {
      const body = extractPolicy(p);
      expect(body).toMatch(DESCENDANT);
      expect(body).not.toMatch(/responsable_asn/);
    }
    expect(extractPolicy('appui_update')).toMatch(/WITH CHECK/);
  });

  it('région lit sa propre ligne (chip) via appui_select', () => {
    expect(extractPolicy('appui_select')).toMatch(/org_id = \(auth\.jwt\(\) ->> 'org_id'\)::uuid/);
  });

  it('plans_insert_descendant : enfant direct + created_by = auth.uid() + éval du même Faritany', () => {
    const body = extractPolicy('plans_insert_descendant');
    expect(body).toMatch(DESCENDANT);
    expect(body).toMatch(/created_by = auth\.uid\(\)/);
    expect(body).toMatch(/e\.org_id = plans_action\.org_id/);
  });

  it("pactions_*_descendant : bornés à l'enfant direct et à origine='nationale'", () => {
    for (const p of ['pactions_insert_descendant', 'pactions_update_descendant']) {
      const body = extractPolicy(p);
      expect(body).toMatch(DESCENDANT);
      expect(body).toMatch(/origine = 'nationale'/);
    }
    expect(extractPolicy('pactions_update_descendant')).toMatch(/WITH CHECK/);
  });

  it('garde origine : immuable en UPDATE, nationale réservée au national en INSERT et DELETE', () => {
    expect(sql).toMatch(/NEW\.origine IS DISTINCT FROM OLD\.origine/);
    expect(sql).toMatch(/v_role NOT IN \('admin_global', 'responsable_osn', 'responsable_region'\)/);
    expect(sql).toMatch(/IF TG_OP = 'DELETE' THEN[\s\S]*OLD\.origine = 'nationale'[\s\S]*RETURN OLD;/);
    expect(sql).toMatch(/CREATE TRIGGER garde_origine_action\s+BEFORE INSERT OR UPDATE OR DELETE ON plan_actions/);
  });
});
