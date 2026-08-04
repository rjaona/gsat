/**
 * Seed du référentiel GSAT-Faritany v1.0 (far_v1_0).
 *
 *   npx tsx scripts/seed-referentiel-faritany.ts            # local
 *   SUPABASE_URL=… SERVICE_ROLE_KEY=… npx tsx scripts/seed-referentiel-faritany.ts
 *
 * Idempotent : rejouable sans doublon (upsert sur (ref_id, code) puis
 * (dimension_id, code)). Un rejeu après modification du JSON met à jour les
 * libellés sans toucher aux évaluations existantes.
 *
 * PRÉREQUIS : la migration 20260804_faritany.sql doit être appliquée
 * (colonnes socle, source_codes, indicateur_erp, niveau, parent_version,
 * libelle_mg, nom_mg).
 *
 * Le service_role contourne la RLS — ne jamais exposer cette clé côté client.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env['SERVICE_ROLE_KEY'] ?? process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SERVICE_KEY) {
  console.error('SERVICE_ROLE_KEY manquante. Exporter la clé service_role avant de lancer le seed.');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Forme du JSON source ──────────────────────────────────────────────────────

interface I18n { fr: string; en: string; mg: string }
interface CritereJson {
  code: string;
  ordre: number;
  libelle: I18n;
  guideInterpretation: I18n;
  essentiel: boolean;
  socle: boolean;
  actif: boolean;
  sourceCodes: string[];
  indicateurErp: string[];
}
interface DimensionJson { code: string; ordre: number; nom: I18n; criteres: CritereJson[] }
interface SeedJson {
  meta: { version: string; parentVersion: string; niveau: string };
  referentiel: { version: string; nom: I18n; parentVersion: string; niveau: string; actif: boolean };
  dimensions: DimensionJson[];
}

const nn = (s: string): string | null => (s.trim() === '' ? null : s);

async function main(): Promise<void> {
  const path = resolve(__dirname, '../src/data/far_v1_0.json');
  const seed = JSON.parse(readFileSync(path, 'utf8')) as SeedJson;

  const total = seed.dimensions.reduce((n, d) => n + d.criteres.length, 0);
  const socle = seed.dimensions.reduce((n, d) => n + d.criteres.filter((c) => c.socle).length, 0);
  const essentiels = seed.dimensions.reduce((n, d) => n + d.criteres.filter((c) => c.essentiel).length, 0);

  console.log(`Référentiel ${seed.referentiel.version} — ${seed.dimensions.length} dimensions, ` +
              `${total} critères (${socle} socle, ${essentiels} essentiels)`);

  // Garde-fou : ne pas seeder un référentiel incohérent avec la note de conception.
  if (total !== 76 || socle !== 42 || essentiels !== 17) {
    console.warn(`⚠️  Comptes inattendus (attendu 76 / 42 / 17). ` +
                 `Si le comité TEM a arbitré des changements, mettre à jour ce garde-fou.`);
  }

  // ── 1. Version ──────────────────────────────────────────────────────────────
  const { data: ver, error: verErr } = await db
    .from('referentiel_versions')
    .upsert(
      {
        version: seed.referentiel.version,
        nom_fr: seed.referentiel.nom.fr,
        nom_en: seed.referentiel.nom.en,
        nom_mg: nn(seed.referentiel.nom.mg),
        niveau: seed.referentiel.niveau,          // 'ASN'
        parent_version: seed.referentiel.parentVersion, // 'v3_0'
        actif: seed.referentiel.actif,
      },
      { onConflict: 'version' },
    )
    .select('id')
    .single();

  if (verErr || !ver) throw verErr ?? new Error('Échec upsert referentiel_versions');
  const refId = (ver as { id: string }).id;

  // ── 2. Dimensions et critères ───────────────────────────────────────────────
  let nbDim = 0;
  let nbCrit = 0;

  for (const dim of seed.dimensions) {
    const { data: dimRow, error: dimErr } = await db
      .from('dimensions')
      .upsert(
        {
          ref_id: refId,
          code: dim.code,
          nom_fr: dim.nom.fr,
          nom_en: dim.nom.en,
          nom_mg: nn(dim.nom.mg),
          ordre: dim.ordre,
        },
        { onConflict: 'ref_id,code' },
      )
      .select('id')
      .single();

    if (dimErr || !dimRow) throw dimErr ?? new Error(`Échec upsert dimension ${dim.code}`);
    const dimId = (dimRow as { id: string }).id;
    nbDim++;

    const rows = dim.criteres.map((c) => ({
      dimension_id: dimId,
      code: c.code,
      libelle_fr: c.libelle.fr,
      libelle_en: c.libelle.en,
      libelle_mg: nn(c.libelle.mg),
      guide_fr: nn(c.guideInterpretation.fr),
      guide_en: nn(c.guideInterpretation.en),
      guide_mg: nn(c.guideInterpretation.mg),
      essentiel: c.essentiel,
      socle: c.socle,
      actif: c.actif,
      ordre: c.ordre,
      source_codes: c.sourceCodes,
      indicateur_erp: c.indicateurErp,
    }));

    const { error: cErr } = await db
      .from('criteres')
      .upsert(rows, { onConflict: 'dimension_id,code' });
    if (cErr) throw cErr;
    nbCrit += rows.length;

    console.log(`  ${dim.code} — ${dim.nom.fr} : ${rows.length} critères`);
  }

  // ── 3. Vérification ─────────────────────────────────────────────────────────
  const { count, error: cntErr } = await db
    .from('criteres')
    .select('id, dimensions!inner(ref_id)', { count: 'exact', head: true })
    .eq('dimensions.ref_id', refId);
  if (cntErr) throw cntErr;

  console.log(`\n${nbDim} dimensions, ${nbCrit} critères écrits. En base : ${count}.`);

  if (count !== total) {
    console.error(`❌ Incohérence : ${count} en base pour ${total} attendus. ` +
                  `Des critères d'une exécution précédente ont peut-être été renommés — ` +
                  `vérifier avant de lancer une campagne.`);
    process.exit(1);
  }

  const orphelins = seed.dimensions
    .flatMap((d) => d.criteres)
    .filter((c) => c.sourceCodes.length === 0)
    .map((c) => c.code);
  if (orphelins.length > 0) {
    console.warn(`⚠️  ${orphelins.length} critère(s) sans source_codes : ${orphelins.join(', ')}. ` +
                 `L'Indice de Déploiement les ignorera.`);
  }

  console.log('✅ Seed far_v1_0 terminé.');
}

main().catch((e: unknown) => {
  console.error('❌ Seed échoué :', e);
  process.exit(1);
});
