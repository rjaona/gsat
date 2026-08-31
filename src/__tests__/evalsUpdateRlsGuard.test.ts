import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Gardes de régression sécurité — B1 de l'audit go-live 2026-08-30.
// La policy evals_update avait une 3e branche non bornée
//   ((responsable_region|responsable_osn|evaluateur) AND statut IN ('soumise','validee'))
// SANS contrainte d'org + WITH CHECK vide → écriture cross-tenant.
// Le fix : (1) evals_update borné par org (USING + WITH CHECK) ; (2) la SEULE
// capacité légitime portée par la branche retirée pour 'soumise' — la validation
// hiérarchique — est ré-ajoutée BORNÉE via evals_update_soumission (migration).
// Ces tests verrouillent les fichiers SOURCE contre une réintroduction du trou.
// La preuve d'exécution est le smoke prod sous vrais JWT (cf. AUDIT_GO_LIVE.md).

const ROOT = process.cwd();
const baseline = readFileSync(resolve(ROOT, 'supabase/reference/rls_policies.sql'), 'utf8');
const migrationB1Raw = readFileSync(
  resolve(ROOT, 'supabase/migrations/20260830_fix_evals_update_crosstenant.sql'),
  'utf8',
);
// SQL exécutable seul : on retire les lignes de commentaire (le bloc rollback
// commenté contient volontairement l'ancienne forme non bornée, à titre d'exemple).
const migrationB1 = migrationB1Raw
  .split('\n')
  .filter((l) => !/^\s*--/.test(l))
  .join('\n');

function extractPolicy(sql: string, name: string): string {
  const marker = `CREATE POLICY ${name} `;
  const start = sql.indexOf(marker);
  if (start === -1) throw new Error(`policy ${name} introuvable`);
  const end = sql.indexOf(';', start);
  if (end === -1) throw new Error(`fin de la policy ${name} introuvable`);
  return sql.slice(start, end);
}

// Une branche autorisant l'écriture sur la seule base du statut, sans contrainte
// d'org, ouvre l'isolation multi-tenant. On couvre les DEUX formes SQL :
//   statut IN ('soumise', 'validee')        (baseline, forme lisible)
//   statut = ANY (ARRAY['soumise'...])       (forme flatten Postgres, migrations)
const FLAT_STATUT_BRANCH =
  /statut\s+IN\s*\(\s*'soumise'\s*,\s*'validee'\s*\)|statut\s*=\s*ANY\s*\(\s*ARRAY\[\s*'soumise'/;

describe('RLS evals_update — isolation cross-tenant (audit B1)', () => {
  it("baseline evals_update : plus de branche non bornée soumise/validee", () => {
    expect(extractPolicy(baseline, 'evals_update')).not.toMatch(FLAT_STATUT_BRANCH);
  });

  it("baseline evals_update : borné par un WITH CHECK explicite", () => {
    expect(extractPolicy(baseline, 'evals_update')).toMatch(/WITH CHECK/);
  });

  it("migration B1 : n'introduit aucune branche statut non bornée", () => {
    // Garde contre une future ré-écriture flatten qui rouvrirait le trou.
    expect(migrationB1).not.toMatch(FLAT_STATUT_BRANCH);
  });

  it("migration B1 : restaure la validation 'soumise' BORNÉE par hiérarchie", () => {
    // La capacité légitime doit revenir, mais bornée (EXISTS sur organisations)
    // et jamais à plat.
    expect(migrationB1).toMatch(/CREATE POLICY evals_update_soumission/);
    expect(migrationB1).toMatch(/statut = 'soumise'/);
    expect(migrationB1).toMatch(/EXISTS \(\s*SELECT 1 FROM organisations/);
    expect(migrationB1).toMatch(/WITH CHECK\s*\(\s*statut IN \('validee', 'en_cours'\)/);
  });
});
