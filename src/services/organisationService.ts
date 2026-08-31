import { supabase } from './supabase';
import type { Organisation, OrgType } from '@/types';
import type { Database } from '@/types/supabase.generated';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrganisationPayload = Omit<Organisation, 'id'>;

// ── Conversion DB ↔ type applicatif ──────────────────────────────────────────

function rowToOrg(row: Record<string, unknown>): Organisation {
  const code       = row['code']        as string | null | undefined;
  const parentId   = row['parent_id']   as string | null | undefined;
  const paysId     = row['pays_id']     as string | null | undefined;
  const regionCode = row['region_code'] as Organisation['regionCode'] | null | undefined;
  const lat        = row['lat']         as number | null | undefined;
  const lng        = row['lng']         as number | null | undefined;
  return {
    id:    row['id']    as string,
    type:  row['type']  as OrgType,
    nom:   row['nom']   as string,
    actif: row['actif'] as boolean,
    poids: (row['poids'] as number | null) ?? 1,
    ...(code       != null ? { code }       : {}),
    ...(parentId   != null ? { parentId }   : {}),
    ...(paysId     != null ? { paysId }     : {}),
    ...(regionCode != null ? { regionCode } : {}),
    ...(lat != null && lng != null ? { coordonnees: { lat, lng } } : {}),
  };
}

function payloadToRow(p: OrganisationPayload): Record<string, unknown> {
  return {
    type:        p.type,
    nom:         p.nom,
    code:        p.code        ?? null,
    parent_id:   p.parentId   ?? null,
    pays_id:     p.paysId     ?? null,
    region_code: p.regionCode ?? null,
    actif:       p.actif,
    poids:       p.poids ?? 1,
    lat:         p.coordonnees?.lat ?? null,
    lng:         p.coordonnees?.lng ?? null,
  };
}

// ── Lecture ───────────────────────────────────────────────────────────────────

export async function getOrganisation(id: string): Promise<Organisation | null> {
  const { data, error } = await supabase
    .from('organisations')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return rowToOrg(data as Record<string, unknown>);
}

/** Libellé du niveau local d'une OSN (system_config.libelle_niveau_local, ex. 'Faritany'). */
export async function getLibelleNiveauLocal(orgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('system_config')
    .select('libelle_niveau_local')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { libelle_niveau_local?: string | null }).libelle_niveau_local ?? null;
}

export async function listOrganisations(type?: OrgType, parentId?: string): Promise<Organisation[]> {
  let q = supabase.from('organisations').select('*').order('nom');
  if (type)     q = q.eq('type', type);
  if (parentId) q = q.eq('parent_id', parentId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(r => rowToOrg(r as Record<string, unknown>));
}

// ── Abonnement temps réel ─────────────────────────────────────────────────────

// ── Création ──────────────────────────────────────────────────────────────────

export async function createOrganisation(payload: OrganisationPayload): Promise<string> {
  const { data, error } = await supabase
    .from('organisations')
    .insert(payloadToRow(payload) as unknown as Database['public']['Tables']['organisations']['Insert'])
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// ── Mise à jour ───────────────────────────────────────────────────────────────

export async function updateOrganisation(
  id: string,
  payload: Partial<Omit<Organisation, 'id'>>
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (payload.type        !== undefined) row['type']        = payload.type;
  if (payload.nom         !== undefined) row['nom']         = payload.nom;
  if (payload.code        !== undefined) row['code']        = payload.code ?? null;
  if (payload.parentId    !== undefined) row['parent_id']   = payload.parentId ?? null;
  if (payload.paysId      !== undefined) row['pays_id']     = payload.paysId ?? null;
  if (payload.regionCode  !== undefined) row['region_code'] = payload.regionCode ?? null;
  if (payload.actif       !== undefined) row['actif']       = payload.actif;
  if (payload.coordonnees !== undefined) {
    row['lat'] = payload.coordonnees?.lat ?? null;
    row['lng'] = payload.coordonnees?.lng ?? null;
  }

  const { error } = await supabase.from('organisations').update(row as unknown as Database['public']['Tables']['organisations']['Update']).eq('id', id);
  if (error) throw error;
}

// ── Suppression ───────────────────────────────────────────────────────────────

export async function deleteOrganisation(id: string): Promise<void> {
  // Vérifier les guards en parallèle — la contrainte ON DELETE RESTRICT en DB
  // est un filet de sécurité supplémentaire, mais les messages d'erreur ici
  // sont plus explicites pour l'UI.
  const [evalCheck, childCheck, usersCheck, plansCheck] = await Promise.all([
    supabase.from('evaluations').select('id', { count: 'exact', head: true }).eq('org_id', id),
    supabase.from('organisations').select('id', { count: 'exact', head: true }).eq('parent_id', id),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('org_id', id),
    supabase.from('plans_action').select('id', { count: 'exact', head: true }).eq('org_id', id),
  ]);

  if ((evalCheck.count ?? 0) > 0)
    throw new Error('Organisation liée à des évaluations existantes — suppression impossible.');
  if ((childCheck.count ?? 0) > 0)
    throw new Error('Impossible de supprimer : cette organisation a des sous-organisations.');
  if ((usersCheck.count ?? 0) > 0)
    throw new Error('Impossible de supprimer : des utilisateurs sont rattachés à cette organisation.');
  if ((plansCheck.count ?? 0) > 0)
    throw new Error("Impossible de supprimer : des plans d'action existent pour cette organisation.");

  const { error } = await supabase.from('organisations').delete().eq('id', id);
  if (error) throw error;
}
