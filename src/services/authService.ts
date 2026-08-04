import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile, UserRole } from '@/types';
import { writeAuditEntry } from './auditService';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TokenClaims {
  role?: UserRole;
  orgId?: string;
  orgType?: string;
  parentOrgId?: string;
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<User> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Login failed: no user returned');

  void writeAuditEntry({
    userId: data.user.id,
    userEmail: data.user.email ?? email,
    action: 'login',
    resource: 'auth',
    resourceId: data.user.id,
  });

  return data.user;
}

export async function logout(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    // Await avant signOut — le token est encore valide pour l'écriture de l'audit
    await writeAuditEntry({
      userId: session.user.id,
      userEmail: session.user.email ?? '',
      action: 'logout',
      resource: 'auth',
      resourceId: session.user.id,
    }).catch(() => {});
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Abonnement aux changements d'état d'authentification.
 * Retourne la fonction de désabonnement.
 * Remplace onAuthStateChanged de Firebase Auth.
 */
export function onAuthChanged(
  callback: (user: User | null, session: Session | null) => void
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => callback(session?.user ?? null, session)
  );
  return () => subscription.unsubscribe();
}

// ── Profil utilisateur ────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', uid)
    .single();

  if (error || !data) return null;
  return dataToProfile(data);
}

// ── Claims JWT (injectés par le custom_access_token_hook) ─────────────────────

/**
 * Lit les custom claims depuis le JWT Supabase.
 * Les claims role/org_id/org_type/parent_org_id sont injectés à chaque émission
 * de token par la fonction hook_custom_access_token.sql.
 */
export function getTokenClaims(session: Session): TokenClaims {
  try {
    const [, payloadBase64 = ''] = session.access_token.split('.');
    const payload = JSON.parse(
      atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'))
    ) as Record<string, unknown>;

    const role        = (payload['user_role'] ?? payload['role']) as UserRole | undefined;
    const orgId       = payload['org_id']        as string   | undefined;
    const orgType     = payload['org_type']      as string   | undefined;
    const parentOrgId = payload['parent_org_id'] as string   | undefined;
    return {
      ...(role        !== undefined ? { role }        : {}),
      ...(orgId       !== undefined ? { orgId }       : {}),
      ...(orgType     !== undefined ? { orgType }     : {}),
      ...(parentOrgId !== undefined ? { parentOrgId } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * Force le refresh du JWT pour que les nouveaux claims soient actifs.
 * Appeler après updateUserClaims (Edge Function manage-user).
 * Remplace auth.currentUser.getIdToken(true) de Firebase Auth.
 */
export async function refreshSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data.session;
}

// ── Helpers de rôle ───────────────────────────────────────────────────────────

export function isAdminGlobal(role?: UserRole): boolean {
  return role === 'admin_global';
}

export function isResponsableOSN(role?: UserRole): boolean {
  return role === 'admin_global' || role === 'responsable_region' || role === 'responsable_osn';
}

export function canWrite(role?: UserRole): boolean {
  return role !== 'lecteur';
}

export function canEvaluate(role?: UserRole): boolean {
  return role === 'admin_global'
    || role === 'responsable_osn'
    || role === 'utilisateur_asn'
    || role === 'evaluateur';
}

// ── Conversion DB → type applicatif ──────────────────────────────────────────

function dataToProfile(data: Record<string, unknown>): UserProfile {
  return {
    id:          data['id']            as string,
    email:       data['email']         as string,
    displayName: `${data['prenom']} ${data['nom']}`,
    nom:         data['nom']           as string,
    prenom:      data['prenom']        as string,
    role:        data['role']          as UserRole,
    orgId:       data['org_id']        as string,
    orgType:     data['org_type']      as string,
    parentOrgId: data['parent_org_id'] as string | undefined,
    actif:       data['actif']         as boolean,
    createdAt:   data['created_at']    as string,
  } as UserProfile;
}
