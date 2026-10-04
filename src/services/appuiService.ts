import { supabase } from './supabase';
import type { AppuiFaritany, AppuiStatut, ActionPriorite } from '@/types';
import { listPlansByOrg, createPlan, addAction } from './planActionService';
import { listEvaluationsByOrg } from './evaluationService';
import { choisirCiblePlan, derniereEvalValidee } from '@/utils/pilotage';

// Requêtes à plat, SANS embed : appui_faritany a deux FK vers users
// (referent_user_id, ouvert_par) → un embed PostgREST serait ambigu (400).

export class AppuiDejaOuvertError extends Error {
  constructor() { super('Un appui est déjà ouvert pour ce Faritany.'); this.name = 'AppuiDejaOuvertError'; }
}

export class CreationActionImpossibleError extends Error {
  constructor() { super('Aucune évaluation validée : impossible de créer une action d’appui.'); this.name = 'CreationActionImpossibleError'; }
}

export interface AppuiInput {
  referentUserId?: string | null | undefined;
  note?: string | null | undefined;
}

export interface ActionAppuiForm {
  objectif: string;
  domaineAmelioration: string;
  dateEcheance: string;
  priorite: ActionPriorite;
  responsable: string;
  critereCode?: string | undefined;
}

export function rowToAppui(row: Record<string, unknown>): AppuiFaritany {
  const referentUserId = row['referent_user_id'] as string | null | undefined;
  const note           = row['note']             as string | null | undefined;
  const ouvertPar      = row['ouvert_par']       as string | null | undefined;
  const closAt         = row['clos_at']          as string | null | undefined;
  return {
    id:       row['id']        as string,
    orgId:    row['org_id']    as string,
    statut:   row['statut']    as AppuiStatut,
    ouvertAt: row['ouvert_at'] as string,
    ...(referentUserId != null ? { referentUserId } : {}),
    ...(note           != null ? { note }           : {}),
    ...(ouvertPar      != null ? { ouvertPar }      : {}),
    ...(closAt         != null ? { closAt }         : {}),
  };
}

/** Violation d'unicité PG — ici : l'index partiel « un seul appui ouvert ». */
export function estConflitUnique(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '23505';
}

export async function listAppuisOuvertsByOrgIds(orgIds: string[]): Promise<Record<string, AppuiFaritany>> {
  if (orgIds.length === 0) return {};
  const { data, error } = await supabase
    .from('appui_faritany')
    .select('*')
    .in('org_id', orgIds)
    .eq('statut', 'ouvert');
  if (error) throw error;
  const out: Record<string, AppuiFaritany> = {};
  for (const r of data ?? []) {
    const a = rowToAppui(r as Record<string, unknown>);
    out[a.orgId] = a;
  }
  return out;
}

export async function getAppuiOuvert(orgId: string): Promise<AppuiFaritany | null> {
  const { data, error } = await supabase
    .from('appui_faritany')
    .select('*')
    .eq('org_id', orgId)
    .eq('statut', 'ouvert')
    .maybeSingle();
  if (error) throw error;
  return data ? rowToAppui(data as Record<string, unknown>) : null;
}

export async function ouvrirAppui(orgId: string, input: AppuiInput): Promise<AppuiFaritany> {
  const { data, error } = await supabase
    .from('appui_faritany')
    .insert({ org_id: orgId, referent_user_id: input.referentUserId ?? null, note: input.note ?? null })
    .select('*')
    .single();
  if (error) {
    if (estConflitUnique(error)) throw new AppuiDejaOuvertError();
    throw error;
  }
  return rowToAppui(data as Record<string, unknown>);
}

export async function mettreAJourAppui(appuiId: string, input: AppuiInput): Promise<void> {
  const patch: { referent_user_id?: string | null; note?: string | null } = {};
  if (input.referentUserId !== undefined) patch.referent_user_id = input.referentUserId;
  if (input.note           !== undefined) patch.note             = input.note;
  if (Object.keys(patch).length === 0) return;
  const { data, error } = await supabase
    .from('appui_faritany')
    .update(patch)
    .eq('id', appuiId)
    .eq('statut', 'ouvert')
    .select('id');
  if (error) throw error;
  // 0 ligne = RLS a filtré (échec silencieux sinon) — patron updateStatutEvaluation.
  if (!data || data.length === 0) throw new Error('Appui introuvable ou non modifiable.');
}

export async function cloreAppui(appuiId: string): Promise<void> {
  const { data, error } = await supabase
    .from('appui_faritany')
    .update({ statut: 'clos', clos_at: new Date().toISOString() })
    .eq('id', appuiId)
    .eq('statut', 'ouvert')
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Appui introuvable ou non modifiable.');
}

/**
 * Crée une action d'appui (origine 'nationale') dans le plan COURANT du Faritany
 * — celui que lit le cockpit régional. Sans plan : en crée un sur la dernière
 * évaluation VALIDÉE (validee|cloturee). Sans évaluation validée : CreationActionImpossibleError.
 */
export async function creerActionAppui(orgId: string, form: ActionAppuiForm, userId: string): Promise<string> {
  const [plans, evals] = await Promise.all([listPlansByOrg(orgId), listEvaluationsByOrg(orgId)]);
  const cible = choisirCiblePlan(plans, derniereEvalValidee(evals));
  if (cible.kind === 'impossible') throw new CreationActionImpossibleError();
  const planId = cible.kind === 'plan'
    ? cible.planId
    : await createPlan({ evalId: cible.evalId, orgId, statut: 'actif', createdBy: userId }, userId);
  return addAction(planId, {
    objectif: form.objectif,
    domaineAmelioration: form.domaineAmelioration,
    dateEcheance: form.dateEcheance,
    priorite: form.priorite,
    responsable: form.responsable,
    description: '',
    statut: 'a_faire',
    origine: 'nationale',
    ...(form.critereCode ? { critereCode: form.critereCode } : {}),
  });
}
