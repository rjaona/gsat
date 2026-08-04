import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { calculerScoreDimension, calculerScoreGlobal, getCriteresEssentielsKO } from '@/services/scoring';
// Le référentiel far_v1_0 est déjà versionné dans le repo ; on en tire le tableau
// de dimensions (le JSON est un objet {meta, referentiel, dimensions}).
import raw from '../data/far_v1_0.json';
const ref_db = raw.dimensions;

const PG = ['-h','127.0.0.1','-p','5433','-U','postgres','-d','gsat','-tAc'];
const sql = (q: string) => execFileSync('psql', [...PG, q], { encoding: 'utf8' }).trim();

const ref: any = { version: 'far_v1_0', nom: { fr: '', en: '' }, actif: true, dimensions: ref_db };
const codes: string[] = ref_db.flatMap((d: any) => d.criteres.map((c: any) => c.code));

// PRNG déterministe — pas de Math.random, le test doit être reproductible
let seed = 20260804;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

function tirage() {
  const s: Record<string, number | null> = {};
  for (const c of codes) {
    const r = rnd();
    if (r < 0.15) continue;            // non répondu
    else if (r < 0.35) s[c] = null;    // N/A
    else s[c] = Math.floor(rnd() * 4); // 0..3
  }
  return s;
}

describe('Parité JS ↔ trigger PostgreSQL sur far_v1_0 (76 critères)', () => {
  // Fixture repartant de zéro : le test doit être rejouable tel quel.
  beforeAll(() => {
    sql(`DELETE FROM evaluation_scores; DELETE FROM evaluations;
         DELETE FROM campagnes; DELETE FROM dashboard_stats;`);
  });

  for (const mode of ['socle', 'complet'] as const) {
    for (let iter = 1; iter <= 6; iter++) {
      it(`mode ${mode} — tirage ${iter}`, () => {
        const scores = tirage();
        const evalId = `55555555-0000-4000-8000-${String(mode === 'socle' ? iter : iter + 50).padStart(12, '0')}`;
        const campId = `44444444-0000-4000-8000-${String(mode === 'socle' ? iter : iter + 50).padStart(12, '0')}`;

        const rows = Object.entries(scores)
          .map(([c, n]) => `('${evalId}','${c}',${n === null ? 'NULL' : n},'00000000-0000-0000-0000-000000000001')`)
          .join(',');

        sql(`
          INSERT INTO campagnes (id,organisateur_id,referentiel_version,nom,date_ouverture,date_fermeture,statut,mode,created_by)
          VALUES ('${campId}','00000000-0000-0000-0000-000000000001','far_v1_0','c',NOW(),NOW()+INTERVAL '1 day','ouverte','${mode}','00000000-0000-0000-0000-000000000001');
          INSERT INTO evaluations (id,campagne_id,org_id,type,statut,created_by)
          SELECT '${evalId}','${campId}',id,'auto','en_cours','00000000-0000-0000-0000-000000000001' FROM organisations WHERE code='ANT-01';
          INSERT INTO evaluation_scores (eval_id,critere_code,note,updated_by) VALUES ${rows};
        `);

        const [g, dims] = sql(
          `SELECT score_global::text || '|' || COALESCE(score_par_dimension::text,'{}') FROM evaluations WHERE id='${evalId}'`,
        ).split('|');
        const ko = sql(
          `SELECT COALESCE(array_to_string(criteres_essentiels_ko,','),'') FROM dashboard_stats WHERE org_id=(SELECT id FROM organisations WHERE code='ANT-01')`,
        );

        const sqlDims = JSON.parse(dims!);
        for (const d of ref.dimensions) {
          const js = calculerScoreDimension(scores, d, mode);
          const pg = sqlDims[d.code] === undefined ? null : Number(sqlDims[d.code]);
          expect(js, `dimension ${d.code}`).toBe(pg);
        }
        expect(calculerScoreGlobal(scores, ref, mode), 'score global').toBe(Number(g));
        expect(getCriteresEssentielsKO(scores, ref, mode).join(','), 'essentiels KO').toBe(ko);
      });
    }
  }
});
