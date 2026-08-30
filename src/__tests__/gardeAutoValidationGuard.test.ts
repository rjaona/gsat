import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Garde de régression — M9 de l'audit go-live 2026-08-30.
// fn_garde_auto_validation exigeait un PV comité sur TOUTE transition -> validee,
// bloquant par effet de bord la validation hiérarchique OSN (soumise -> validee,
// sans PV). Le fix ne lève l'exception PV que pour l'auto-validation Faritany
// (OLD.statut = 'en_cours'). Ce test verrouille la migration contre un retour à
// la garde trop large. Preuve d'exécution = smoke prod transactionnel.

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260830_fix_garde_pv_soumise.sql'),
  'utf8',
)
  .split('\n')
  .filter((l) => !/^\s*--/.test(l)) // SQL exécutable seul (le rollback est en commentaire)
  .join('\n');

describe('fn_garde_auto_validation — PV limité à l\'auto-validation (M9)', () => {
  it('gate l\'exigence de PV sur OLD.statut = en_cours', () => {
    // La RAISE "PV obligatoire" doit être conditionnée par OLD.statut = 'en_cours'.
    expect(migration).toMatch(/OLD\.statut\s*=\s*'en_cours'\s*\n?\s*AND\s*\(NEW\.pv_comite_path IS NULL/);
  });

  it('conserve le garde "renvoi en révision exige un motif"', () => {
    expect(migration).toMatch(/reviewer_verdict = 'revision_requested'/);
    expect(migration).toMatch(/Un renvoi en révision exige un motif/);
  });
});
