import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Garde de régression sécurité — B1 de l'audit go-live 2026-08-30.
// La policy evals_update avait une 3e branche non bornée
//   ((responsable_region|responsable_osn|evaluateur) AND statut IN ('soumise','validee'))
// SANS contrainte d'org, et un WITH CHECK vide (= USING réutilisé) → écriture
// cross-tenant : un evaluateur du Faritany A pouvait modifier/valider/réassigner
// l'évaluation soumise/validee du Faritany B.
// Ce test verrouille le fichier SOURCE (rls_policies.sql), là où le bug vit, pour
// empêcher toute réintroduction sur un bootstrap frais. La preuve d'exécution est
// le smoke prod sous vrais JWT (cf. AUDIT_GO_LIVE.md / docs/superpowers/audit/preuves-prod.md).

function extractPolicy(sql: string, name: string): string {
  const marker = `CREATE POLICY ${name} `;
  const start = sql.indexOf(marker);
  if (start === -1) throw new Error(`policy ${name} introuvable dans rls_policies.sql`);
  const end = sql.indexOf(';', start);
  if (end === -1) throw new Error(`fin de la policy ${name} introuvable`);
  return sql.slice(start, end);
}

describe('RLS evals_update — isolation cross-tenant (audit B1)', () => {
  const sql = readFileSync(resolve(process.cwd(), 'supabase/rls_policies.sql'), 'utf8');
  const policy = extractPolicy(sql, 'evals_update');

  it("ne contient plus de branche non bornée sur statut soumise/validee", () => {
    // Une branche autorisant l'écriture sur la seule base du statut, sans org,
    // ouvre l'isolation multi-tenant. Elle doit avoir disparu.
    expect(policy).not.toMatch(/statut\s+IN\s*\(\s*'soumise'\s*,\s*'validee'\s*\)/);
  });

  it("borne l'écriture par un WITH CHECK explicite (pas de fallback sur USING)", () => {
    expect(policy).toMatch(/WITH CHECK/);
  });
});
