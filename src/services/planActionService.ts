import { supabase } from './supabase';
import type { PlanAction, PlanStatut, Action, ActionStatut, ActionPriorite, Suivi } from '@/types';
import type { Database } from '@/types/supabase.generated';
import { getEvaluation } from './evaluationService';
import { createNotification } from './notificationService';

// ── Types de payload ──────────────────────────────────────────────────────────

export type PlanActionPayload = Omit<PlanAction, 'id' | 'createdAt'>;
export type ActionPayload     = Omit<Action,     'id' | 'createdAt'>;
export type SuiviPayload      = Omit<Suivi,      'id' | 'createdAt'>;

// ── Conversion DB → type applicatif ──────────────────────────────────────────

function rowToPlan(row: Record<string, unknown>): PlanAction {
  return {
    id:        row['id']         as string,
    evalId:    row['eval_id']    as string,
    orgId:     row['org_id']     as string,
    statut:    row['statut']     as PlanStatut,
    createdBy: row['created_by'] as string,
    createdAt: row['created_at'] as string,
  };
}

function rowToAction(row: Record<string, unknown>): Action {
  const critereCode           = row['critere_code']           as string | null | undefined;
  const dateDebut             = row['date_debut']             as string | null | undefined;
  const ressourcesDisponibles = row['ressources_disponibles'] as string | null | undefined;
  const ressourcesNecessaires = row['ressources_necessaires'] as string | null | undefined;
  const kpis                  = row['kpis']                   as string | null | undefined;
  return {
    id:                  row['id']                   as string,
    planId:              row['plan_id']              as string,
    domaineAmelioration: row['domaine_amelioration'] as string,
    objectif:            row['objectif']             as string,
    description:         row['description']          as string,
    responsable:         row['responsable']          as string,
    dateEcheance:        row['date_echeance']        as string,
    statut:              row['statut']               as ActionStatut,
    priorite:            row['priorite']             as ActionPriorite,
    createdAt:           row['created_at']           as string,
    ...(critereCode           != null ? { critereCode }           : {}),
    ...(dateDebut             != null ? { dateDebut }             : {}),
    ...(ressourcesDisponibles != null ? { ressourcesDisponibles } : {}),
    ...(ressourcesNecessaires != null ? { ressourcesNecessaires } : {}),
    ...(kpis                  != null ? { kpis }                  : {}),
  };
}

function rowToSuivi(row: Record<string, unknown>): Suivi {
  const preuvePath = row['preuve_path'] as string | null | undefined;
  return {
    id:            row['id']             as string,
    actionId:      row['action_id']      as string,
    commentaire:   row['commentaire']    as string,
    ancienStatut:  row['ancien_statut']  as ActionStatut,
    nouveauStatut: row['nouveau_statut'] as ActionStatut,
    createdBy:     row['created_by']     as string,
    createdAt:     row['created_at']     as string,
    ...(preuvePath != null ? { preuvePath } : {}),
  };
}

// ── CRUD Plans d'action ───────────────────────────────────────────────────────

export async function getPlan(planId: string): Promise<PlanAction | null> {
  const { data, error } = await supabase
    .from('plans_action')
    .select('*')
    .eq('id', planId)
    .single();
  if (error || !data) return null;
  return rowToPlan(data as Record<string, unknown>);
}

export async function getPlanByEvalId(evalId: string): Promise<PlanAction | null> {
  const { data, error } = await supabase
    .from('plans_action')
    .select('*')
    .eq('eval_id', evalId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToPlan(data as Record<string, unknown>) : null;
}

export async function listPlansByOrg(orgId: string): Promise<PlanAction[]> {
  const { data, error } = await supabase
    .from('plans_action')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(r => rowToPlan(r as Record<string, unknown>));
}

export async function createPlan(
  payload: PlanActionPayload,
  createdBy: string
): Promise<string> {
  const { data, error } = await supabase
    .from('plans_action')
    .insert({
      eval_id:    payload.evalId,
      org_id:     payload.orgId,
      statut:     payload.statut,
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updatePlanStatut(planId: string, statut: PlanStatut): Promise<void> {
  const { error } = await supabase
    .from('plans_action')
    .update({ statut })
    .eq('id', planId);
  if (error) throw error;
}

export async function deletePlan(planId: string): Promise<void> {
  const { error } = await supabase.from('plans_action').delete().eq('id', planId);
  if (error) throw error;
}

// ── CRUD Actions ──────────────────────────────────────────────────────────────

export async function getAction(actionId: string): Promise<Action | null> {
  const { data, error } = await supabase
    .from('plan_actions')
    .select('*')
    .eq('id', actionId)
    .single();
  if (error || !data) return null;
  return rowToAction(data as Record<string, unknown>);
}

export async function listActions(planId: string): Promise<Action[]> {
  const { data, error } = await supabase
    .from('plan_actions')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => rowToAction(r as Record<string, unknown>));
}

export async function addAction(
  planId: string,
  payload: Omit<ActionPayload, 'planId'>
): Promise<string> {
  const { data, error } = await supabase
    .from('plan_actions')
    .insert({
      plan_id:               planId,
      critere_code:          payload.critereCode           ?? null,
      domaine_amelioration:  payload.domaineAmelioration,
      objectif:              payload.objectif,
      description:           payload.description,
      responsable:           payload.responsable,
      date_debut:            payload.dateDebut             ?? null,
      date_echeance:         payload.dateEcheance,
      ressources_disponibles: payload.ressourcesDisponibles ?? null,
      ressources_necessaires: payload.ressourcesNecessaires ?? null,
      kpis:                  payload.kpis                  ?? null,
      statut:                payload.statut,
      priorite:              payload.priorite,
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateAction(
  actionId: string,
  updates: Partial<Omit<Action, 'id' | 'planId' | 'createdAt'>>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.critereCode           !== undefined) row['critere_code']           = updates.critereCode ?? null;
  if (updates.domaineAmelioration   !== undefined) row['domaine_amelioration']   = updates.domaineAmelioration;
  if (updates.objectif              !== undefined) row['objectif']               = updates.objectif;
  if (updates.description           !== undefined) row['description']            = updates.description;
  if (updates.responsable           !== undefined) row['responsable']            = updates.responsable;
  if (updates.dateDebut             !== undefined) row['date_debut']             = updates.dateDebut ?? null;
  if (updates.dateEcheance          !== undefined) row['date_echeance']          = updates.dateEcheance;
  if (updates.ressourcesDisponibles !== undefined) row['ressources_disponibles'] = updates.ressourcesDisponibles ?? null;
  if (updates.ressourcesNecessaires !== undefined) row['ressources_necessaires'] = updates.ressourcesNecessaires ?? null;
  if (updates.kpis                  !== undefined) row['kpis']                   = updates.kpis ?? null;
  if (updates.statut                !== undefined) row['statut']                 = updates.statut;
  if (updates.priorite              !== undefined) row['priorite']               = updates.priorite;

  const { error } = await supabase.from('plan_actions').update(row as unknown as Database['public']['Tables']['plan_actions']['Update']).eq('id', actionId);
  if (error) throw error;
}

export async function deleteAction(actionId: string): Promise<void> {
  const { error } = await supabase.from('plan_actions').delete().eq('id', actionId);
  if (error) throw error;
}

// ── Suivi ─────────────────────────────────────────────────────────────────────

export async function addSuivi(
  _planId: string,
  actionId: string,
  suivi: Omit<SuiviPayload, 'actionId'>,
  createdBy: string,
  options?: { recipientId?: string; actionTitle?: string }
): Promise<string> {
  // Met à jour le statut de l'action
  await updateAction(actionId, { statut: suivi.nouveauStatut });

  const { data, error } = await supabase
    .from('action_suivis')
    .insert({
      action_id:      actionId,
      commentaire:    suivi.commentaire,
      ancien_statut:  suivi.ancienStatut,
      nouveau_statut: suivi.nouveauStatut,
      preuve_path:    suivi.preuvePath ?? null,
      created_by:     createdBy,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (suivi.nouveauStatut === 'bloque' && options?.recipientId) {
    void createNotification({
      type: 'action_overdue', title: 'Action en retard',
      message: `L'action "${options.actionTitle ?? actionId}" est en retard et nécessite une attention.`,
      recipientId: options.recipientId, resourceType: 'action', resourceId: actionId,
    }).catch(() => {});
  }

  return (data as { id: string }).id;
}

export async function listSuivis(actionId: string): Promise<Suivi[]> {
  const { data, error } = await supabase
    .from('action_suivis')
    .select('*')
    .eq('action_id', actionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(r => rowToSuivi(r as Record<string, unknown>));
}

// ── Abonnement temps réel ─────────────────────────────────────────────────────

export function subscribePlan(
  planId: string,
  onData: (plan: PlanAction | null, actions: Action[]) => void,
  onError?: (err: Error) => void
): () => void {
  let cachedPlan: PlanAction | null = null;
  let cachedActions: Action[] = [];

  const fetchPlan = () =>
    supabase.from('plans_action').select('*').eq('id', planId).maybeSingle()
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        cachedPlan = data ? rowToPlan(data as Record<string, unknown>) : null;
        onData(cachedPlan, cachedActions);
      });

  const fetchActions = () =>
    supabase.from('plan_actions').select('*').eq('plan_id', planId).order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) { onError?.(error); return; }
        cachedActions = (data ?? []).map(r => rowToAction(r as Record<string, unknown>));
        onData(cachedPlan, cachedActions);
      });

  void fetchPlan();
  void fetchActions();

  const channel = supabase
    .channel(`plan-${planId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plans_action', filter: `id=eq.${planId}` },
      () => void fetchPlan())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_actions', filter: `plan_id=eq.${planId}` },
      () => void fetchActions())
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

// ── Agrégation stats plans pour plusieurs orgs ────────────────────────────────

export interface OrgPlanStats {
  actionsTotal: number;
  actionsDone:  number;
}

export interface OrgActionAgg {
  actionsTotal: number;
  actionsDone: number;
  actionsEnCours: number;
  actionsBloque: number;
  latestUpdate: string | null; // ISO8601 du plus récent created_at d'action
}

/**
 * Audit M7 : agrège en UNE requête (plans + actions jointes) les compteurs
 * d'actions par org, sur TOUS les plans de l'org — remplace le N+1 de
 * PilotageOsnPage (33 ASN × plans × listActions séquentiel).
 */
export async function listActionAggByOrgIds(
  orgIds: string[],
): Promise<Record<string, OrgActionAgg>> {
  if (orgIds.length === 0) return {};
  const { data, error } = await supabase
    .from('plans_action')
    .select('org_id, plan_actions(statut, created_at)')
    .in('org_id', orgIds);
  if (error) throw error;

  const empty = (): OrgActionAgg => ({
    actionsTotal: 0, actionsDone: 0, actionsEnCours: 0, actionsBloque: 0, latestUpdate: null,
  });
  const byOrg: Record<string, OrgActionAgg> = {};
  for (const id of orgIds) byOrg[id] = empty();

  for (const plan of data ?? []) {
    const orgId = plan['org_id'] as string;
    const agg = byOrg[orgId] ?? (byOrg[orgId] = empty());
    const actions = (plan['plan_actions'] as unknown as { statut: string; created_at: string | null }[]) ?? [];
    for (const a of actions) {
      agg.actionsTotal++;
      if (a.statut === 'termine') agg.actionsDone++;
      else if (a.statut === 'en_cours') agg.actionsEnCours++;
      else if (a.statut === 'bloque') agg.actionsBloque++;
      if (a.created_at && (agg.latestUpdate === null || a.created_at > agg.latestUpdate)) {
        agg.latestUpdate = a.created_at;
      }
    }
  }
  return byOrg;
}

export async function listPlanStatsByOrgIds(
  orgIds: string[],
): Promise<Record<string, OrgPlanStats>> {
  if (orgIds.length === 0) return {};

  // Requête unique : plans actifs/brouillon + leurs actions en une jointure
  const { data, error } = await supabase
    .from('plans_action')
    .select(`id, org_id, plan_actions(statut)`)
    .in('org_id', orgIds)
    .neq('statut', 'cloture')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Pour chaque org, prendre le plan le plus récent (premier résultat après tri DESC)
  const byOrg = new Map<string, OrgPlanStats>();
  for (const plan of data ?? []) {
    const orgId = plan['org_id'] as string;
    if (byOrg.has(orgId)) continue; // déjà le plan le plus récent pour cet org

    const actions = (plan['plan_actions'] as unknown as { statut: string }[]) ?? [];
    byOrg.set(orgId, {
      actionsTotal: actions.length,
      actionsDone:  actions.filter(a => a.statut === 'termine').length,
    });
  }

  // Compléter les orgs sans plan
  for (const orgId of orgIds) {
    if (!byOrg.has(orgId)) byOrg.set(orgId, { actionsTotal: 0, actionsDone: 0 });
  }

  return Object.fromEntries(byOrg);
}

// ── Création depuis une évaluation ────────────────────────────────────────────

export async function createPlanFromEvaluation(
  evalId: string,
  createdBy: string
): Promise<string> {
  const evaluation = await getEvaluation(evalId);
  if (!evaluation) throw new Error(`Évaluation ${evalId} introuvable`);

  const STATUTS_VALIDES: readonly string[] = ['validee', 'cloturee'];
  if (!STATUTS_VALIDES.includes(evaluation.statut)) {
    throw new Error(
      `Impossible de créer un plan d'action : l'évaluation est au statut "${evaluation.statut}". ` +
      `Un statut "validee" ou "cloturee" est requis.`
    );
  }

  const planExistant = await getPlanByEvalId(evalId);
  if (planExistant) {
    throw new Error(`Un plan d'action existe déjà pour cette évaluation (planId: ${planExistant.id}).`);
  }

  const planId = await createPlan({ evalId, orgId: evaluation.orgId, statut: 'brouillon', createdBy }, createdBy);

  // Scores à 0 → actions pré-remplies
  const { data: scores } = await supabase
    .from('evaluation_scores')
    .select('critere_code')
    .eq('eval_id', evalId)
    .eq('note', 0);

  const echeanceDefaut = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // E1: rollback applicatif — si l'insertion des actions échoue, supprimer le plan créé
  try {
    await Promise.all(
      (scores ?? []).map(s =>
        addAction(planId, {
          critereCode:          s['critere_code'] as string,
          domaineAmelioration:  `Critère ${s['critere_code']} — non conforme`,
          objectif:             `Atteindre la conformité sur le critère ${s['critere_code']}`,
          description:          '',
          responsable:          '',
          dateDebut:            new Date().toISOString(),
          dateEcheance:         echeanceDefaut,
          statut:               'a_faire' as ActionStatut,
          priorite:             'haute'   as ActionPriorite,
        })
      )
    );
  } catch (err) {
    // Rollback : supprimer le plan vide pour éviter un état corrompu
    await deletePlan(planId).catch(() => {});
    throw err;
  }

  return planId;
}
