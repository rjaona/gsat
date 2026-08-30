import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Garde de régression — M5 de l'audit go-live 2026-08-30.
// supabase/trigger_on_score_write.sql est appliqué EN DERNIER au bootstrap et
// redéfinissait fn_recalculate_scores avec le corps d'avril BUGGÉ (N/A compté 0,
// pas de mode socle) → il clobbait la version corrigée du migration. Il porte
// désormais une copie verbatim de la version corrigée. Ce test verrouille les
// marqueurs de la version corrigée pour empêcher un retour au corps buggé.

const trig = readFileSync(
  resolve(process.cwd(), 'supabase/trigger_on_score_write.sql'),
  'utf8',
);

describe('fn_recalculate_scores baseline = version corrigée (M5)', () => {
  it("exclut les N/A du dénominateur (FILTER)", () => {
    expect(trig).toMatch(
      /3 \* COUNT\(\*\) FILTER \(WHERE NOT \(es\.id IS NOT NULL AND es\.note IS NULL\)\)/,
    );
  });

  it("applique le mode socle", () => {
    expect(trig).toMatch(/v_mode <> 'socle' OR c\.socle = TRUE/);
  });

  it("crée toujours le trigger on_score_write", () => {
    expect(trig).toMatch(/CREATE TRIGGER on_score_write/);
  });
});
