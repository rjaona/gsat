// =============================================================================
// Edge Function : manage-user
// Remplace les Cloud Functions Firebase : createUser, updateUserClaims, deleteUser
// Actions disponibles : 'create' | 'update_claims' | 'delete' | 'revoke_sessions'
// Requires : Authorization header (JWT caller) avec role = admin_global
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CreateUserPayload {
  action: 'create'
  email: string
  password: string
  displayName: string
  nom: string
  prenom: string
  role: string
  orgId: string
  orgType: string
  parentOrgId?: string
}

interface UpdateClaimsPayload {
  action: 'update_claims'
  uid: string
  role: string
  orgId: string
  orgType: string
  parentOrgId?: string
}

interface DeleteUserPayload {
  action: 'delete'
  uid: string
}

interface RevokeSessionsPayload {
  action: 'revoke_sessions'
  uid: string
}

type Payload = CreateUserPayload | UpdateClaimsPayload | DeleteUserPayload | RevokeSessionsPayload

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        // M4: CORS restreint à l'origine frontend configurée (pas wildcard sur fonction admin)
        'Access-Control-Allow-Origin': Deno.env.get('CORS_ORIGIN') ?? 'https://gsat.tily-digital.com',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  // ── Auth : vérifier que le caller est authentifié ───────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonError('Missing Authorization', 401)

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user: caller }, error: authErr } = await supabaseClient.auth.getUser()
  if (authErr || !caller) return jsonError('Unauthorized', 401)

  // ── Service client (bypasse RLS) ────────────────────────────────────────────
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // I8 : lire le rôle depuis public.users (source de vérité DB, non falsifiable)
  // au lieu de décoder le JWT côté client (sujet à token replay si révocation en cours)
  const { data: callerProfile, error: profileErr } = await admin
    .from('users')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (profileErr || !callerProfile) return jsonError('Profile not found', 401)
  const callerRole = (callerProfile as { role: string }).role

  if (callerRole !== 'admin_global') {
    return jsonError('Forbidden: admin_global role required', 403)
  }

  let body: Payload
  try {
    body = await req.json() as Payload
  } catch {
    return jsonError('Invalid JSON', 400)
  }

  // ── Router ──────────────────────────────────────────────────────────────────
  switch (body.action) {

    case 'create': {
      const p = body as CreateUserPayload

      // Créer l'utilisateur dans auth.users
      const { data: authData, error: createErr } = await admin.auth.admin.createUser({
        email: p.email,
        password: p.password,
        email_confirm: true,
        user_metadata: { displayName: p.displayName },
      })
      if (createErr || !authData.user) {
        return jsonError(createErr?.message ?? 'Failed to create auth user', 400)
      }

      const uid = authData.user.id

      // Créer le profil dans public.users
      const { error: profileErr } = await admin.from('users').insert({
        id:            uid,
        org_id:        p.orgId,
        org_type:      p.orgType,
        parent_org_id: p.parentOrgId ?? null,
        nom:           p.nom,
        prenom:        p.prenom,
        email:         p.email,
        role:          p.role,
        actif:         true,
      })

      if (profileErr) {
        // Rollback : supprimer l'auth user créé
        await admin.auth.admin.deleteUser(uid)
        return jsonError(`Profile creation failed: ${profileErr.message}`, 500)
      }

      return Response.json({ uid })
    }

    case 'update_claims': {
      const p = body as UpdateClaimsPayload

      // Mettre à jour public.users
      const { error: updateErr } = await admin.from('users').update({
        role:          p.role,
        org_id:        p.orgId,
        org_type:      p.orgType,
        parent_org_id: p.parentOrgId ?? null,
        updated_at:    new Date().toISOString(),
      }).eq('id', p.uid)

      if (updateErr) {
        return jsonError(`Update failed: ${updateErr.message}`, 500)
      }

      // Forcer la révocation des sessions pour que le hook réémette le token
      // avec les nouveaux claims au prochain refresh
      await admin.auth.admin.signOut(p.uid, 'others')

      return Response.json({ success: true })
    }

    case 'delete': {
      const p = body as DeleteUserPayload

      // I7 : empêcher l'auto-suppression (évite un admin de se verrouiller)
      if (p.uid === caller.id) {
        return jsonError('Cannot delete your own account', 400)
      }

      // C3 : supprimer l'auth user en premier — si la FK a ON DELETE CASCADE,
      // public.users sera supprimé automatiquement. Si l'auth delete échoue,
      // le profil est préservé (pas de donnée orpheline sans auth).
      const { error: deleteErr } = await admin.auth.admin.deleteUser(p.uid)
      if (deleteErr) {
        return jsonError(`Auth delete failed: ${deleteErr.message}`, 500)
      }

      // Belt-and-suspenders : nettoyage explicite du profil si CASCADE non configuré
      await admin.from('users').delete().eq('id', p.uid)

      return Response.json({ success: true })
    }

    case 'revoke_sessions': {
      const p = body as RevokeSessionsPayload
      // Équivalent de admin.auth().revokeRefreshTokens(uid)
      await admin.auth.admin.signOut(p.uid, 'global')
      return Response.json({ success: true })
    }

    default:
      return jsonError('Unknown action', 400)
  }
})

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}
