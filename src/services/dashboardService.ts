import { supabase } from './supabase';
import type { DashboardStats, Evaluation, EvaluationStatut } from '@/types';

// ── Conversion DB → type applicatif ──────────────────────────────────────────

function rowToStats(row: Record<string, unknown>): DashboardStats {
  const nbAsn              = row['nb_asn']               as number | null | undefined;
  const scoresAsn          = row['scores_asn']           as Record<string, number> | null | undefined;
  const tauxCompletionEval = row['taux_completion_eval'] as number | null | undefined;
  return {
    orgId:                row['org_id']                   as string,
    scoreGlobal:          ((row['score_global']           as number) ?? 0),
    scoreParDimension:    ((row['score_par_dimension']    as Record<string, number>) ?? {}),
    criteresEssentielsKO: ((row['criteres_essentiels_ko'] as string[]) ?? []),
    updatedAt:            row['updated_at']               as string,
    // Version du référentiel consolidé : source de vérité pour DashboardAsnPage
    // (qui s'abonne au référentiel via stats.referentielVersion).
    ...(row['referentiel_version'] != null ? { referentielVersion: row['referentiel_version'] as string } : {}),
    ...(nbAsn              != null ? { nbAsn }              : {}),
    ...(scoresAsn          != null ? { scoresAsn }          : {}),
    ...(tauxCompletionEval != null ? { tauxCompletionEval } : {}),
  };
}

function rowToEvaluation(row: Record<string, unknown>): Evaluation {
  return {
    id:                  row['id']                  as string,
    campagneId:          row['campagne_id']          as string,
    orgId:               row['org_id']               as string,
    type:                row['type']                 as Evaluation['type'],
    statut:              row['statut']               as EvaluationStatut,
    scoreGlobal:         row['score_global']         as number | undefined,
    scoreParDimension:   row['score_par_dimension']  as Record<string, number> | undefined,
    submittedBy:         row['submitted_by']         as string | undefined,
    submittedAt:         row['submitted_at']         as string | undefined,
    reviewerName:        row['reviewer_name']        as string | undefined,
    reviewerTitle:       row['reviewer_title']       as string | undefined,
    reviewerAvatar:      row['reviewer_avatar']      as string | undefined,
    reviewerRecommendation: row['reviewer_recommendation'] as string | undefined,
    reviewerVerdict:     row['reviewer_verdict']     as Evaluation['reviewerVerdict'],
    clotureeAuto:        (row['cloturee_auto'] as boolean | undefined) ?? false,
    createdBy:           row['created_by']           as string,
    createdAt:           row['created_at']           as string,
    updatedAt:           row['updated_at']           as string,
  };
}

// ── Abonnement temps réel ─────────────────────────────────────────────────────

export function subscribeDashboardStats(
  orgId: string,
  onData: (stats: DashboardStats | null) => void,
  onError?: (err: Error) => void
): () => void {
  const fetch = () =>
    supabase
      .from('dashboard_stats')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        onData(data ? rowToStats(data as Record<string, unknown>) : null);
      });

  void fetch();

  const channel = supabase
    .channel(`dashboard-stats-${orgId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'dashboard_stats',
      filter: `org_id=eq.${orgId}`,
    }, () => void fetch())
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

// ── Lecture ponctuelle ────────────────────────────────────────────────────────

export async function getDashboardStats(orgId: string): Promise<DashboardStats | null> {
  const { data, error } = await supabase
    .from('dashboard_stats')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToStats(data as Record<string, unknown>) : null;
}

/**
 * Version batchée de getDashboardStats : une SEULE requête `.in('org_id', ...)`
 * au lieu de N requêtes individuelles (évite le N+1 sur DashboardOsnPage à 33
 * Faritany). Retourne une map org_id → stats (orgs sans ligne absentes).
 */
export async function getDashboardStatsByOrgIds(
  orgIds: string[],
): Promise<Record<string, DashboardStats>> {
  if (orgIds.length === 0) return {};
  const { data, error } = await supabase
    .from('dashboard_stats')
    .select('*')
    .in('org_id', orgIds);
  if (error) throw error;
  return (data ?? []).reduce<Record<string, DashboardStats>>((acc, row) => {
    const stats = rowToStats(row as Record<string, unknown>);
    acc[stats.orgId] = stats;
    return acc;
  }, {});
}

export interface MoyenneNationale {
  scoreGlobal: number;
  scoreParDimension: Record<string, number>;
}

/**
 * Agrégat national (score global + par dimension) de l'OSN parente d'une org.
 * Passe par la fonction SECURITY DEFINER `fn_moyenne_nationale` : la RLS de
 * dashboard_stats interdit à une ASN la lecture directe de la ligne de son OSN,
 * et la fonction ne rend QUE l'agrégat non sensible (pas les scores par Faritany).
 */
export async function getMoyenneNationale(orgId: string): Promise<MoyenneNationale | null> {
  const { data, error } = await supabase.rpc('fn_moyenne_nationale', { p_org_id: orgId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    scoreGlobal: (row['score_global'] as number) ?? 0,
    scoreParDimension: (row['score_par_dimension'] as Record<string, number> | null) ?? {},
  };
}

// ── Évaluations récentes ──────────────────────────────────────────────────────

export async function getEvaluationsRecentes(
  orgId: string,
  limitCount = 5
): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(limitCount);
  if (error) throw error;
  return (data ?? []).map(r => rowToEvaluation(r as Record<string, unknown>));
}

export async function getEvaluationsRecentesGlobal(
  limitCount = 10
): Promise<Evaluation[]> {
  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limitCount);
  if (error) throw error;
  return (data ?? []).map(r => rowToEvaluation(r as Record<string, unknown>));
}
