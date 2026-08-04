import { supabase } from './supabase';
import { refreshSession } from './authService';
import type { UserProfile, UserRole, OrgType } from '@/types';
import { createNotification } from './notificationService';
import { writeAuditEntry } from './auditService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  email:        string;
  password:     string;
  displayName:  string;
  nom:          string;
  prenom:       string;
  role:         UserRole;
  orgId:        string;
  orgType:      OrgType;
  parentOrgId?: string | undefined;
}

export interface UpdateUserClaimsPayload {
  uid:          string;
  role:         UserRole;
  orgId:        string;
  orgType:      OrgType;
  parentOrgId?: string;
}

// ── Conversion DB → type applicatif ──────────────────────────────────────────

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    id:           row['id']            as string,
    email:        row['email']         as string,
    displayName:  `${row['prenom']} ${row['nom']}`,
    nom:          row['nom']           as string,
    prenom:       row['prenom']        as string,
    role:         row['role']          as UserRole,
    orgId:        row['org_id']        as string,
    orgType:      row['org_type']      as OrgType,
    parentOrgId:  row['parent_org_id'] as string | undefined,
    actif:        row['actif']         as boolean,
    createdAt:    row['created_at']    as string,
  } as UserProfile;
}

// ── Appel Edge Function manage-user ──────────────────────────────────────────

async function callManageUser(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('manage-user', { body });
  if (error) throw error;
  return data as Record<string, unknown>;
}

// ── Lecture ───────────────────────────────────────────────────────────────────

/**
 * Liste les utilisateurs.
 * Le filtrage par rôle/org est entièrement géré par les RLS Supabase —
 * la requête retourne uniquement ce que le caller a le droit de voir.
 */
export async function listUsers(
  _callerRole?: UserRole,
  _callerOrgId?: string,
): Promise<UserProfile[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('actif', true)
    .order('nom');

  if (error) throw error;
  return (data ?? []).map(r => rowToProfile(r as Record<string, unknown>));
}

// ── Création via Edge Function manage-user ────────────────────────────────────

export async function createUser(
  payload: CreateUserPayload,
  adminId?: string | undefined,
  adminName?: string | undefined,
): Promise<string> {
  const result = await callManageUser({ action: 'create', ...payload });
  const uid = result['uid'] as string;

  if (adminId) {
    const { data: { session } } = await supabase.auth.getSession();
    void writeAuditEntry({
      userId:     adminId,
      userEmail:  session?.user?.email ?? adminId,
      action:     'create',
      resource:   'user',
      resourceId: uid,
      metadata:   { email: payload.email, role: payload.role, orgId: payload.orgId },
    });

    void createNotification({
      type:         'user_created',
      title:        'Nouvel utilisateur',
      message:      `${payload.displayName} (${payload.email}) a été créé avec le rôle ${payload.role}.`,
      recipientId:  adminId,
      senderId:     adminId,
      senderName:   adminName,
      resourceType: 'user',
      resourceId:   uid,
    }).catch(() => {});
  }

  return uid;
}

// ── Mise à jour du rôle via Edge Function manage-user ─────────────────────────

export async function updateUserRole(
  uid: string,
  role: UserRole,
  orgId: string,
  orgType: OrgType,
  parentOrgId?: string
): Promise<void> {
  await callManageUser({
    action: 'update_claims', uid, role, orgId, orgType,
    ...(parentOrgId ? { parentOrgId } : {}),
  });

  const { data: { session } } = await supabase.auth.getSession();
  const actor = session?.user;
  if (actor) {
    void writeAuditEntry({
      userId:     actor.id,
      userEmail:  actor.email ?? actor.id,
      action:     'update',
      resource:   'user',
      resourceId: uid,
      metadata:   { role, orgId, orgType },
    });
  }

  // Si c'est l'utilisateur courant : rafraîchir le token pour activer les nouveaux claims
  if (actor?.id === uid) {
    await refreshSession();
  }
}

// ── Suppression via Edge Function manage-user ─────────────────────────────────

export async function deleteUser(uid: string): Promise<void> {
  await callManageUser({ action: 'delete', uid });

  const { data: { session } } = await supabase.auth.getSession();
  const actor = session?.user;
  if (actor) {
    void writeAuditEntry({
      userId:     actor.id,
      userEmail:  actor.email ?? actor.id,
      action:     'delete',
      resource:   'user',
      resourceId: uid,
    });
  }
}

// ── Révocation de sessions (équivalent revokeRefreshTokens) ───────────────────

export async function revokeUserSessions(uid: string): Promise<void> {
  await callManageUser({ action: 'revoke_sessions', uid });
}
