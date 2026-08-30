export interface V3Critere {
  code: string;
  ordre: number;
  essentiel: boolean;
  actif: boolean;
  libelle: { fr: string; en: string };
  guideInterpretation?: { fr?: string; en?: string };
}
export interface V3Dimension {
  code: string;
  ordre: number;
  nom: { fr: string; en: string };
  criteres: V3Critere[];
}
export interface V3ReferentielJson {
  version: string;
  nom: { fr: string; en: string };
  actif: boolean;
  dimensions: V3Dimension[];
}

/** Échappe une valeur pour un littéral SQL, ou NULL si null/undefined. */
function q(s: string | null | undefined): string {
  return s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
}
const bool = (b: boolean): string => (b ? 'true' : 'false');

/**
 * Transforme le JSON du référentiel v3_0 en SQL de seed idempotent (pur, sans I/O).
 * ⚠ Pose version='v3_0' (le JSON dit '3.0', mais tout le code attend 'v3_0').
 */
export function genV3Seed(json: V3ReferentielJson): string {
  const L: string[] = [];
  L.push('-- Généré par scripts/gen_v3_0_seed.ts — NE PAS éditer à la main.');
  L.push('-- Seed idempotent du référentiel v3_0 (niveau OSN) dans Supabase.');
  L.push('BEGIN;');

  L.push(
    'INSERT INTO referentiel_versions (version, nom_fr, nom_en, nom_mg, niveau, parent_version, actif) ' +
      `VALUES ('v3_0', ${q(json.nom.fr)}, ${q(json.nom.en)}, NULL, 'OSN', NULL, true) ` +
      'ON CONFLICT (version) DO UPDATE SET nom_fr=EXCLUDED.nom_fr, nom_en=EXCLUDED.nom_en, ' +
      'niveau=EXCLUDED.niveau, actif=EXCLUDED.actif;',
  );

  for (const dim of json.dimensions) {
    L.push(
      'INSERT INTO dimensions (ref_id, code, nom_fr, nom_en, nom_mg, ordre) VALUES (' +
        `(SELECT id FROM referentiel_versions WHERE version='v3_0'), ${q(dim.code)}, ` +
        `${q(dim.nom.fr)}, ${q(dim.nom.en)}, NULL, ${Number(dim.ordre)}) ` +
        'ON CONFLICT (ref_id, code) DO UPDATE SET nom_fr=EXCLUDED.nom_fr, nom_en=EXCLUDED.nom_en, ordre=EXCLUDED.ordre;',
    );
    for (const c of dim.criteres) {
      const gFr = c.guideInterpretation?.fr ?? '';
      const gEn = c.guideInterpretation?.en ?? '';
      L.push(
        'INSERT INTO criteres (dimension_id, code, libelle_fr, libelle_en, libelle_mg, ' +
          'guide_fr, guide_en, guide_mg, essentiel, socle, actif, ordre, source_codes, indicateur_erp) VALUES (' +
          '(SELECT d.id FROM dimensions d JOIN referentiel_versions r ON d.ref_id=r.id ' +
          `WHERE r.version='v3_0' AND d.code=${q(dim.code)}), ` +
          `${q(c.code)}, ${q(c.libelle.fr)}, ${q(c.libelle.en)}, NULL, ` +
          `${q(gFr)}, ${q(gEn)}, NULL, ${bool(c.essentiel)}, true, ${bool(c.actif)}, ${Number(c.ordre)}, '{}', '{}') ` +
          'ON CONFLICT (dimension_id, code) DO UPDATE SET libelle_fr=EXCLUDED.libelle_fr, ' +
          'libelle_en=EXCLUDED.libelle_en, guide_fr=EXCLUDED.guide_fr, guide_en=EXCLUDED.guide_en, ' +
          'essentiel=EXCLUDED.essentiel, actif=EXCLUDED.actif, ordre=EXCLUDED.ordre;',
      );
    }
  }

  L.push('COMMIT;');
  return L.join('\n') + '\n';
}
