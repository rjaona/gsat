-- =============================================================================
-- Custom Access Token Hook — Supabase
-- Injecte user_role, org_id, org_type, parent_org_id dans le JWT à chaque
-- émission de token (login + refresh). Le rôle applicatif est exposé sous
-- 'user_role' (le claim 'role' reste le rôle Postgres 'authenticated').
--
-- Enregistrement dans Supabase Dashboard :
--   Auth > Hooks > Custom Access Token
--   Function : public.custom_access_token_hook
--
-- Référence : https://supabase.com/docs/guides/auth/auth-hooks#custom-access-token-hook
-- =============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
-- La fonction doit être SECURITY DEFINER pour lire public.users sans contrainte RLS
-- Elle s'exécute en tant que son propriétaire (qui a accès à auth.users)
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_claims   JSONB;
  v_role     TEXT;
  v_org_id   TEXT;
  v_org_type TEXT;
  v_parent   TEXT;
BEGIN
  -- Extraire l'uid depuis l'event
  v_user_id := (event ->> 'user_id')::UUID;

  -- Lire le profil depuis public.users
  SELECT
    u.role::TEXT,
    u.org_id::TEXT,
    u.org_type::TEXT,
    u.parent_org_id::TEXT
  INTO
    v_role, v_org_id, v_org_type, v_parent
  FROM public.users u
  WHERE u.id = v_user_id
    AND u.actif = TRUE;

  -- Si l'utilisateur n'existe pas encore dans public.users (ex: juste après création auth),
  -- retourner le token sans claims custom pour éviter un échec d'auth.
  IF NOT FOUND THEN
    RETURN event;
  END IF;

  -- Construire les claims additionnels
  -- NB : le rôle applicatif est exposé sous 'user_role', PAS 'role'. Le claim
  -- 'role' est réservé par PostgREST/GoTrue au rôle Postgres (authenticated) et
  -- sert au SET ROLE ; l'écraser avec un rôle applicatif casserait toute l'API.
  -- Les policies RLS lisent donc auth.jwt() ->> 'user_role'.
  v_claims := jsonb_build_object(
    'user_role',     COALESCE(v_role,     'lecteur'),
    'org_id',        COALESCE(v_org_id,   ''),
    'org_type',      COALESCE(v_org_type, ''),
    'parent_org_id', COALESCE(v_parent,   '')
  );

  -- Fusionner dans event.claims (Supabase attend la modification de event -> claims)
  RETURN jsonb_set(
    event,
    '{claims}',
    COALESCE(event -> 'claims', '{}'::JSONB) || v_claims
  );

EXCEPTION
  WHEN OTHERS THEN
    -- En cas d'erreur inattendue, laisser passer sans claims plutôt que bloquer l'auth
    RAISE WARNING '[custom_access_token_hook] Error for user %: %', v_user_id, SQLERRM;
    RETURN event;
END;
$$;

-- Accorder l'exécution au rôle supabase_auth_admin (appelant du hook)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Révoquer l'accès public par défaut
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;

-- =============================================================================
-- NOTE D'ENREGISTREMENT
-- =============================================================================
-- Dans le Dashboard Supabase :
--   1. Auth > Hooks > "Custom Access Token"
--   2. Hook type : PostgreSQL Function
--   3. Schema : public
--   4. Function : custom_access_token_hook
--
-- Après un changement de rôle côté admin (updateUserClaims Edge Function),
-- le client doit forcer un refresh du token :
--   const { data } = await supabase.auth.refreshSession()
-- C'est l'équivalent de auth.currentUser.getIdToken(true) en Firebase.
-- =============================================================================
