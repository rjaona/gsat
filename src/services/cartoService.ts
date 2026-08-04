import { supabase } from './supabase';
import type { Organisation, DashboardStats, RegionCode } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrgAvecScore {
  org: Organisation;
  stats: DashboardStats | null;
}

// ── Conversion DB → type applicatif ──────────────────────────────────────────

function rowToOrg(row: Record<string, unknown>): Organisation {
  const lat      = row['lat']          as number | null | undefined;
  const lng      = row['lng']          as number | null | undefined;
  const paysId   = row['pays_id']      as string | null | undefined;
  const regionCode = row['region_code'] as RegionCode | null | undefined;
  const parentId = row['parent_id']    as string | null | undefined;
  return {
    id:    row['id']    as string,
    nom:   row['nom']   as string,
    type:  row['type']  as Organisation['type'],
    actif: row['actif'] as boolean,
    ...(paysId    != null ? { paysId }    : {}),
    ...(regionCode != null ? { regionCode } : {}),
    ...(parentId  != null ? { parentId }  : {}),
    ...(lat != null && lng != null ? { coordonnees: { lat, lng } } : {}),
  };
}

function rowToStats(row: Record<string, unknown>): DashboardStats {
  const nbAsn             = row['nb_asn']              as number | null | undefined;
  const scoresAsn         = row['scores_asn']          as Record<string, number> | null | undefined;
  const tauxCompletionEval = row['taux_completion_eval'] as number | null | undefined;
  return {
    orgId:                row['org_id']                   as string,
    scoreGlobal:          ((row['score_global']           as number) ?? 0),
    scoreParDimension:    ((row['score_par_dimension']    as Record<string, number>) ?? {}),
    criteresEssentielsKO: ((row['criteres_essentiels_ko'] as string[]) ?? []),
    updatedAt:            row['updated_at']               as string,
    ...(nbAsn            != null ? { nbAsn }             : {}),
    ...(scoresAsn        != null ? { scoresAsn }         : {}),
    ...(tauxCompletionEval != null ? { tauxCompletionEval } : {}),
  };
}

// ── Lecture ponctuelle ────────────────────────────────────────────────────────

/**
 * Retourne toutes les organisations OSN actives avec leurs stats dashboard.
 */
export async function getOrganisationsAvecScores(): Promise<OrgAvecScore[]> {
  const { data: orgsData, error: orgsError } = await supabase
    .from('organisations')
    .select('*')
    .eq('type', 'OSN')
    .eq('actif', true);
  if (orgsError) throw orgsError;

  const orgs: Organisation[] = (orgsData ?? []).map(r => rowToOrg(r as Record<string, unknown>));
  const orgIds = orgs.map(o => o.id);

  const statsMap: Record<string, DashboardStats> = {};
  if (orgIds.length > 0) {
    const { data: statsData, error: statsError } = await supabase
      .from('dashboard_stats')
      .select('*')
      .in('org_id', orgIds);
    if (statsError) throw statsError;
    for (const row of statsData ?? []) {
      const s = rowToStats(row as Record<string, unknown>);
      statsMap[s.orgId] = s;
    }
  }

  return orgs.map(org => ({ org, stats: statsMap[org.id] ?? null }));
}

// ── Abonnement temps réel filtré par région ───────────────────────────────────

/**
 * Souscrit en temps réel aux organisations OSN d'une région WOSM donnée.
 * Stats chargées une fois au démarrage puis rafraîchies à chaque changement
 * dans la table organisations.
 */
export function subscribeOrganisationsRegion(
  regionWosm: RegionCode,
  onData: (orgs: OrgAvecScore[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const chargerOrgsAvecStats = async (): Promise<OrgAvecScore[]> => {
    const { data: orgsData, error: orgsError } = await supabase
      .from('organisations')
      .select('*')
      .eq('type', 'OSN')
      .eq('actif', true)
      .eq('region_code', regionWosm);
    if (orgsError) throw orgsError;

    const orgs: Organisation[] = (orgsData ?? []).map(r => rowToOrg(r as Record<string, unknown>));
    const orgIds = orgs.map(o => o.id);

    const statsMap: Record<string, DashboardStats> = {};
    if (orgIds.length > 0) {
      const { data: statsData, error: statsError } = await supabase
        .from('dashboard_stats')
        .select('*')
        .in('org_id', orgIds);
      if (statsError) throw statsError;
      for (const row of statsData ?? []) {
        const s = rowToStats(row as Record<string, unknown>);
        statsMap[s.orgId] = s;
      }
    }

    return orgs.map(org => ({ org, stats: statsMap[org.id] ?? null }));
  };

  void chargerOrgsAvecStats().then(onData).catch(err =>
    onError?.(err instanceof Error ? err : new Error(String(err)))
  );

  const channel = supabase
    .channel(`carto-region-${regionWosm}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'organisations' }, () => {
      void chargerOrgsAvecStats().then(onData).catch(err =>
        onError?.(err instanceof Error ? err : new Error(String(err)))
      );
    })
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
