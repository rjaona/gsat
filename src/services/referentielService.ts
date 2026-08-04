import { supabase } from './supabase';
import type { Referentiel, DimensionDef, CritereDef, OrgType } from '@/types';
import type { Database } from '@/types/supabase.generated';

// ── Scoring ───────────────────────────────────────────────────────────────────
// La logique de calcul vit désormais dans `scoring.ts` : pure, sans dépendance
// Supabase, donc testable sans mock. Réexportée ici pour ne pas casser les
// imports existants.
export {
  calculerScoreDimension,
  calculerScoreGlobal,
  getCriteresEssentielsKO,
  calculerAvancement,
  formatScore,
} from './scoring';
export type { ScoreMap, ModeCampagne } from './scoring';

// ── Reconstruction du référentiel depuis les tables normalisées ───────────────

async function fetchReferentiel(version: string): Promise<Referentiel | null> {
  const { data: ver, error: verErr } = await supabase
    .from('referentiel_versions')
    .select('*')
    .eq('version', version)
    .single();
  if (verErr || !ver) return null;

  const { data: dims, error: dimErr } = await supabase
    .from('dimensions')
    .select(`
      id,
      code,
      nom_fr,
      nom_en,
      nom_mg,
      ordre,
      criteres (
        code,
        libelle_fr,
        libelle_en,
        libelle_mg,
        guide_fr,
        guide_en,
        guide_mg,
        essentiel,
        actif,
        socle,
        source_codes,
        indicateur_erp,
        ordre
      )
    `)
    .eq('ref_id', ver.id as string)
    .order('ordre');

  if (dimErr) throw dimErr;

  const dimensions: DimensionDef[] = (dims ?? []).map((d) => {
    const row = d as Record<string, unknown>;
    const criteres = ((row['criteres'] as Record<string, unknown>[]) ?? [])
      .sort((a, b) => (a['ordre'] as number) - (b['ordre'] as number))
      .map((c): CritereDef => {
        const gFr = c['guide_fr'] as string | null;
        const gEn = c['guide_en'] as string | null;
        const gMg = c['guide_mg'] as string | null;
        return {
          code: c['code'] as string,
          libelle: {
            fr: c['libelle_fr'] as string,
            en: c['libelle_en'] as string,
            ...((c['libelle_mg'] as string | null) ? { mg: c['libelle_mg'] as string } : {}),
          },
          essentiel: c['essentiel'] as boolean,
          actif: c['actif'] as boolean,
          ordre: c['ordre'] as number,
          // Colonnes ajoutées par la migration Faritany. Les COALESCE protègent
          // les bases pas encore migrées.
          socle: (c['socle'] as boolean | null) ?? true,
          sourceCodes: (c['source_codes'] as string[] | null) ?? [],
          indicateurErp: (c['indicateur_erp'] as string[] | null) ?? [],
          ...(gFr || gEn || gMg
            ? {
                guideInterpretation: {
                  fr: gFr ?? '',
                  en: gEn ?? '',
                  ...(gMg ? { mg: gMg } : {}),
                },
              }
            : {}),
        };
      });

    return {
      code: row['code'] as string,
      nom: {
        fr: row['nom_fr'] as string,
        en: row['nom_en'] as string,
        ...((row['nom_mg'] as string | null) ? { mg: row['nom_mg'] as string } : {}),
      },
      ordre: row['ordre'] as number,
      criteres,
    };
  });

  const niveau = (ver as Record<string, unknown>)['niveau'] as OrgType | null;
  const parentVersion = (ver as Record<string, unknown>)['parent_version'] as string | null;

  return {
    version: ver.version as string,
    nom: { fr: ver.nom_fr as string, en: ver.nom_en as string },
    actif: ver.actif as boolean,
    dimensions,
    ...(niveau ? { niveau } : {}),
    ...(parentVersion ? { parentVersion } : {}),
  };
}

// ── Lecture ───────────────────────────────────────────────────────────────────

/**
 * ⚠️ `version` est OBLIGATOIRE — plus de défaut 'v3_0'.
 * Deux référentiels coexistent (v3_0 national, far_v1_0 Faritany) : la version
 * se lit toujours sur la campagne (`campagnes.referentiel_version`).
 */
export async function getReferentiel(version: string): Promise<Referentiel | null> {
  return fetchReferentiel(version);
}

/** Liste des référentiels disponibles, pour le wizard de campagne. */
export async function listReferentiels(niveau?: OrgType): Promise<
  { version: string; nom: string; niveau: OrgType | null; actif: boolean }[]
> {
  let q = supabase
    .from('referentiel_versions')
    .select('version, nom_fr, niveau, actif')
    .order('version');
  if (niveau) q = q.eq('niveau', niveau);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      version: row['version'] as string,
      nom: row['nom_fr'] as string,
      niveau: (row['niveau'] as OrgType | null) ?? null,
      actif: row['actif'] as boolean,
    };
  });
}

export function subscribeReferentiel(
  version: string,
  onData: (ref: Referentiel) => void,
  onError?: (err: Error) => void,
): () => void {
  void fetchReferentiel(version)
    .then((r) => {
      if (r) onData(r);
    })
    .catch(onError);

  const channel = supabase
    .channel(`referentiel-${version}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'criteres' }, () => {
      void fetchReferentiel(version).then((r) => { if (r) onData(r); }).catch(onError);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dimensions' }, () => {
      void fetchReferentiel(version).then((r) => { if (r) onData(r); }).catch(onError);
    })
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

// ── Helpers (logique pure) ────────────────────────────────────────────────────

export function getDimension(ref: Referentiel, code: string): DimensionDef | undefined {
  return ref.dimensions.find((d) => d.code === code);
}

export function getCritere(ref: Referentiel, code: string): CritereDef | undefined {
  for (const dim of ref.dimensions) {
    const c = dim.criteres.find((c) => c.code === code);
    if (c) return c;
  }
  return undefined;
}

export function getCriteresEssentiels(ref: Referentiel): CritereDef[] {
  return ref.dimensions.flatMap((d) => d.criteres.filter((c) => c.essentiel && c.actif));
}

export function getCriteresActifs(ref: Referentiel, mode: 'socle' | 'complet' = 'complet'): CritereDef[] {
  return ref.dimensions.flatMap((d) =>
    d.criteres.filter((c) => c.actif && (mode !== 'socle' || c.socle)),
  );
}

export function getDimensionDuCritere(ref: Referentiel, critereCode: string): DimensionDef | undefined {
  return ref.dimensions.find((d) => d.criteres.some((c) => c.code === critereCode));
}

/**
 * Critères du référentiel parent dont AUCUN critère local ne dérive.
 * Sert à détecter les orphelins lors d'un changement de standard (V3.0 → V4.0)
 * et à afficher la liste « niveau national exclusif » dans l'écran admin.
 */
export function getCriteresParentsNonCouverts(
  ref: Referentiel,
  codesParent: string[],
): string[] {
  const couverts = new Set(
    ref.dimensions.flatMap((d) => d.criteres.flatMap((c) => c.sourceCodes)),
  );
  return codesParent.filter((c) => !couverts.has(c));
}

// ── Admin — import complet d'un référentiel ───────────────────────────────────

export async function updateReferentiel(versionKey: string, ref: Referentiel): Promise<void> {
  const { data: ver, error: verErr } = await supabase
    .from('referentiel_versions')
    .upsert({
      version: versionKey,
      nom_fr: ref.nom.fr,
      nom_en: ref.nom.en,
      actif: ref.actif,
      niveau: ref.niveau ?? null,
      parent_version: ref.parentVersion ?? null,
    })
    .select('id')
    .single();
  if (verErr || !ver) throw verErr ?? new Error('Impossible de créer la version référentiel');

  const refId = (ver as Record<string, unknown>)['id'] as string;

  for (const dim of ref.dimensions) {
    const { data: dimRow, error: dimErr } = await supabase
      .from('dimensions')
      .upsert({
        ref_id: refId,
        code: dim.code,
        nom_fr: dim.nom.fr,
        nom_en: dim.nom.en,
        nom_mg: dim.nom.mg ?? null,
        ordre: dim.ordre,
      })
      .select('id')
      .single();
    if (dimErr || !dimRow) throw dimErr ?? new Error(`Impossible de créer la dimension ${dim.code}`);

    const dimId = (dimRow as Record<string, unknown>)['id'] as string;

    for (const critere of dim.criteres) {
      const { error: cErr } = await supabase.from('criteres').upsert({
        dimension_id: dimId,
        code: critere.code,
        libelle_fr: critere.libelle.fr,
        libelle_en: critere.libelle.en,
        libelle_mg: critere.libelle.mg ?? null,
        guide_fr: critere.guideInterpretation?.fr ?? null,
        guide_en: critere.guideInterpretation?.en ?? null,
        guide_mg: critere.guideInterpretation?.mg ?? null,
        essentiel: critere.essentiel,
        actif: critere.actif,
        socle: critere.socle,
        source_codes: critere.sourceCodes,
        indicateur_erp: critere.indicateurErp,
        ordre: critere.ordre,
      });
      if (cErr) throw cErr;
    }
  }
}

export async function updateCritere(
  critereCode: string,
  updates: Partial<
    Pick<
      CritereDef,
      'libelle' | 'guideInterpretation' | 'essentiel' | 'actif' | 'ordre' | 'socle' | 'sourceCodes' | 'indicateurErp'
    >
  >,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.libelle) {
    row['libelle_fr'] = updates.libelle.fr;
    row['libelle_en'] = updates.libelle.en;
    if (updates.libelle.mg !== undefined) row['libelle_mg'] = updates.libelle.mg;
  }
  if (updates.guideInterpretation) {
    row['guide_fr'] = updates.guideInterpretation.fr;
    row['guide_en'] = updates.guideInterpretation.en;
    if (updates.guideInterpretation.mg !== undefined) row['guide_mg'] = updates.guideInterpretation.mg;
  }
  if (updates.essentiel !== undefined) row['essentiel'] = updates.essentiel;
  if (updates.actif !== undefined) row['actif'] = updates.actif;
  if (updates.ordre !== undefined) row['ordre'] = updates.ordre;
  if (updates.socle !== undefined) row['socle'] = updates.socle;
  if (updates.sourceCodes !== undefined) row['source_codes'] = updates.sourceCodes;
  if (updates.indicateurErp !== undefined) row['indicateur_erp'] = updates.indicateurErp;

  const { error } = await supabase
    .from('criteres')
    .update(row as unknown as Database['public']['Tables']['criteres']['Update'])
    .eq('code', critereCode);
  if (error) throw error;
}
