-- =============================================================================
-- GSAT Digital V2 — RLS Policies (Row Level Security)
-- Remplace les Firestore Security Rules
-- Les claims JWT sont injectés via le Custom Access Token Hook (voir hook.sql)
-- =============================================================================

-- Helpers JWT inline (plus performant que des fonctions SQL appelées par row)
-- auth.jwt() ->> 'user_role'         → UserRole
-- auth.jwt() ->> 'org_id'       → UUID (orgId de l'utilisateur)
-- auth.jwt() ->> 'org_type'     → OrgType
-- auth.jwt() ->> 'parent_org_id'→ UUID | null

-- =============================================================================
-- Activer RLS sur toutes les tables
-- =============================================================================

ALTER TABLE pays                ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE referentiel_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimensions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteres            ENABLE ROW LEVEL SECURITY;
ALTER TABLE referentiel_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE campagnes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_preuves  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans_action        ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_actions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_suivis       ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits         ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Politique commune : les service_role (Edge Functions, triggers) passent RLS
-- Note : service_role bypasse RLS nativement sous Supabase — pas de policy nécessaire.
-- =============================================================================

-- =============================================================================
-- PAYS — lecture publique pour tous les utilisateurs authentifiés
-- =============================================================================

CREATE POLICY pays_select_auth ON pays
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY pays_write_admin ON pays
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- ORGANISATIONS
-- =============================================================================

-- Lecture : tous les utilisateurs authentifiés voient toutes les orgs actives
CREATE POLICY orgs_select_auth ON organisations
  FOR SELECT TO authenticated
  USING (TRUE);

-- Écriture : admin_global uniquement
CREATE POLICY orgs_write_admin ON organisations
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- USERS
-- =============================================================================

-- SELECT : chacun voit son propre profil + les règles de visibilité par rôle
CREATE POLICY users_select_self ON users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()                                              -- soi-même
    OR (auth.jwt() ->> 'user_role') = 'admin_global'                  -- admin voit tout
    OR (                                                         -- responsable_region : sa région + ses enfants
      (auth.jwt() ->> 'user_role') = 'responsable_region'
      AND (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        OR parent_org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
    OR (                                                         -- responsable_osn : son OSN + ASN enfants
      (auth.jwt() ->> 'user_role') = 'responsable_osn'
      AND (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        OR parent_org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
    OR org_id = (auth.jwt() ->> 'org_id')::uuid                  -- même org
  );

-- INSERT/UPDATE/DELETE : admin_global via Edge Function createUser/updateUserClaims/deleteUser
-- La Edge Function tourne en service_role → bypasse RLS
-- On n'expose PAS de policy d'écriture directe pour les clients
CREATE POLICY users_update_self ON users
  FOR UPDATE TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Le client peut uniquement modifier ses champs non-sensibles (pas role, pas org_id)
    -- La vérification exhaustive est dans la Edge Function
  );

-- =============================================================================
-- REFERENTIEL — lecture pour tous, écriture admin_global
-- =============================================================================

CREATE POLICY refver_select_auth ON referentiel_versions
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY refver_write_admin ON referentiel_versions
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

CREATE POLICY dim_select_auth ON dimensions
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY dim_write_admin ON dimensions
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

CREATE POLICY crit_select_auth ON criteres
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY crit_write_admin ON criteres
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

CREATE POLICY refhist_select_admin ON referentiel_history
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- CAMPAGNES
-- =============================================================================

-- SELECT : tous les utilisateurs authentifiés voient les campagnes
CREATE POLICY campagnes_select_auth ON campagnes
  FOR SELECT TO authenticated
  USING (TRUE);

-- INSERT : admin_global et responsable_region
CREATE POLICY campagnes_insert ON campagnes
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_region')
  );

-- UPDATE : admin_global et responsable_region (propriétaire)
CREATE POLICY campagnes_update ON campagnes
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') = 'responsable_region'
      AND organisateur_id = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') = 'responsable_region'
      AND organisateur_id = auth.uid()
    )
  );

-- DELETE : admin_global uniquement (et seulement si 0 évaluations — géré en application)
CREATE POLICY campagnes_delete ON campagnes
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- EVALUATIONS
-- =============================================================================

-- SELECT :
--   admin_global : tout
--   responsable_region : évals des orgs de sa région
--   responsable_osn : évals de son OSN + ses ASN enfants
--   utilisateur_asn / evaluateur : évals de sa propre org
--   lecteur : évals validées/clôturées de sa propre org
CREATE POLICY evals_select ON evaluations
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') = 'responsable_region'
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = evaluations.org_id
        AND (o.parent_id = (auth.jwt() ->> 'org_id')::uuid
             OR o.id = (auth.jwt() ->> 'org_id')::uuid)
      )
    )
    OR (
      (auth.jwt() ->> 'user_role') = 'responsable_osn'
      AND (
        org_id = (auth.jwt() ->> 'org_id')::uuid
        OR EXISTS (
          SELECT 1 FROM organisations o
          WHERE o.id = evaluations.org_id
          AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
        )
      )
    )
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
  );

-- INSERT : utilisateurs autorisés à évaluer, pour leur propre org ou orgs gérées
CREATE POLICY evals_insert ON evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND (
      (auth.jwt() ->> 'user_role') = 'admin_global'
      OR org_id = (auth.jwt() ->> 'org_id')::uuid
      OR (
        (auth.jwt() ->> 'user_role') = 'responsable_osn'
        AND EXISTS (
          SELECT 1 FROM organisations o
          WHERE o.id = evaluations.org_id
          AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
        )
      )
    )
  );

-- UPDATE : auteur + rôles de validation selon statut
-- Note : la vérification des transitions de statut reste en couche service (TypeScript)
--        RLS garantit seulement qu'on ne peut modifier que les évals accessibles
CREATE POLICY evals_update ON evaluations
  FOR UPDATE TO authenticated
  -- Audit B1 (2026-08-30) : 3e branche non bornee retiree (ecriture cross-tenant).
  -- Elle autorisait responsable_region/responsable_osn/evaluateur a modifier toute
  -- eval soumise/validee SANS contrainte d'org, et le WITH CHECK vide (= USING)
  -- laissait meme reassigner org_id. Cas legitimes restants : own-org couvert
  -- par la branche 2 ci-dessous + evals_update_resp_asn (saisie ASN) ; validation
  -- hierarchique cross-org bornee par evals_update_soumission (statut 'soumise',
  -- migration 20260830) et evals_update_revue (statut 'validee', migration
  -- 20260804). WITH CHECK explicite = pas de deplacement cross-org.
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'evaluateur', 'utilisateur_asn')
      AND org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'evaluateur', 'utilisateur_asn')
      AND org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

-- =============================================================================
-- EVALUATION_SCORES
-- =============================================================================

CREATE POLICY scores_select ON evaluation_scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e WHERE e.id = evaluation_scores.eval_id
      -- hérite des rules de la table evaluations via la jointure
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
        OR (
          (auth.jwt() ->> 'user_role') = 'responsable_osn'
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = e.org_id AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid)
        )
        OR (
          (auth.jwt() ->> 'user_role') = 'responsable_region'
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = e.org_id AND (o.parent_id = (auth.jwt() ->> 'org_id')::uuid OR o.id = (auth.jwt() ->> 'org_id')::uuid))
        )
      )
    )
  );

CREATE POLICY scores_write ON evaluation_scores
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_scores.eval_id
      AND e.statut IN ('brouillon', 'en_cours')
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_scores.eval_id
      AND e.statut IN ('brouillon', 'en_cours')
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- =============================================================================
-- EVALUATION_PREUVES
-- =============================================================================

CREATE POLICY preuves_select ON evaluation_preuves
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e WHERE e.id = evaluation_preuves.eval_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
        OR (
          (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = e.org_id AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid)
        )
      )
    )
  );

CREATE POLICY preuves_insert ON evaluation_preuves
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND EXISTS (
      SELECT 1 FROM evaluations e
      WHERE e.id = evaluation_preuves.eval_id
      AND e.statut IN ('brouillon', 'en_cours')
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR e.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

CREATE POLICY preuves_delete ON evaluation_preuves
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR (auth.jwt() ->> 'user_role') = 'admin_global'
  );

-- =============================================================================
-- PLANS_ACTION
-- =============================================================================

CREATE POLICY plans_select ON plans_action
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = plans_action.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

CREATE POLICY plans_insert ON plans_action
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_osn', 'utilisateur_asn', 'evaluateur')
    AND (
      (auth.jwt() ->> 'user_role') = 'admin_global'
      OR org_id = (auth.jwt() ->> 'org_id')::uuid
    )
  );

CREATE POLICY plans_update ON plans_action
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = plans_action.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- =============================================================================
-- PLAN_ACTIONS et ACTION_SUIVIS — héritent de la visibilité plans_action
-- =============================================================================

CREATE POLICY pactions_select ON plan_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans_action p WHERE p.id = plan_actions.plan_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
        OR (
          (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = p.org_id AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid)
        )
      )
    )
  );

CREATE POLICY pactions_write ON plan_actions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plans_action p WHERE p.id = plan_actions.plan_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans_action p WHERE p.id = plan_actions.plan_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

CREATE POLICY suivis_select ON action_suivis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM plan_actions a
      JOIN plans_action p ON p.id = a.plan_id
      WHERE a.id = action_suivis.action_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
        OR (
          (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.id = p.org_id AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid)
        )
      )
    )
  );

CREATE POLICY suivis_insert ON action_suivis
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM plan_actions a
      JOIN plans_action p ON p.id = a.plan_id
      WHERE a.id = action_suivis.action_id
      AND (
        (auth.jwt() ->> 'user_role') = 'admin_global'
        OR p.org_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- =============================================================================
-- DASHBOARD_STATS — lecture selon périmètre, pas d'écriture client
-- (écrit par trigger on_score_write via service_role)
-- =============================================================================

CREATE POLICY dash_select ON dashboard_stats
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR org_id = (auth.jwt() ->> 'org_id')::uuid
    OR (
      (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
      AND EXISTS (
        SELECT 1 FROM organisations o
        WHERE o.id = dashboard_stats.org_id
        AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
      )
    )
  );

-- =============================================================================
-- AUDIT_LOG
-- =============================================================================

-- SELECT : admin_global voit tout; les autres voient leurs propres entrées
CREATE POLICY audit_select ON audit_log
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR user_id = auth.uid()
  );

-- INSERT : désactivé pour les clients directs — utiliser fn_write_audit_log (SECURITY DEFINER)
-- La fonction valide user_id = auth.uid() côté serveur et bypasse RLS.

-- Pas de UPDATE/DELETE sur audit_log (immuable)

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE POLICY notif_select ON notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

CREATE POLICY notif_update ON notifications
  FOR UPDATE TO authenticated
  USING  (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY notif_delete ON notifications
  FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

-- INSERT : rôles autorisés + sender_id doit être null ou égal à auth.uid() (anti-impersonation)
CREATE POLICY notif_insert ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'user_role') IN ('admin_global', 'responsable_region', 'responsable_osn', 'evaluateur')
    AND (sender_id IS NULL OR sender_id = auth.uid())
  );

-- =============================================================================
-- SYSTEM_CONFIG — admin_global uniquement
-- =============================================================================

CREATE POLICY sysconfig_admin ON system_config
  FOR ALL TO authenticated
  USING  ((auth.jwt() ->> 'user_role') = 'admin_global')
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin_global');

-- =============================================================================
-- RATE_LIMITS — géré par Edge Function en service_role
-- lecture pour authenticated (vérification quota côté client)
-- =============================================================================

CREATE POLICY ratelimit_select ON rate_limits
  FOR SELECT TO authenticated
  USING (key LIKE '%' || auth.uid()::text || '%');

-- =============================================================================
-- B4 — GUARD : bloquer l'élévation de privilèges via PATCH direct sur users
-- Les colonnes sensibles (role, org_id, org_type, parent_org_id) ne peuvent
-- être modifiées que par service_role (Edge Function manage-user).
-- PostgREST avec JWT authenticated utilise le rôle 'authenticated' → bloqué.
-- =============================================================================

CREATE OR REPLACE FUNCTION guard_users_sensitive_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'authenticated' AND (
    NEW.role          IS DISTINCT FROM OLD.role          OR
    NEW.org_id        IS DISTINCT FROM OLD.org_id        OR
    NEW.org_type      IS DISTINCT FROM OLD.org_type      OR
    NEW.parent_org_id IS DISTINCT FROM OLD.parent_org_id
  ) THEN
    RAISE EXCEPTION
      'Permission denied: role, org_id, org_type, parent_org_id cannot be modified directly. Use the manage-user Edge Function.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_users_sensitive
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION guard_users_sensitive_columns();

-- =============================================================================
-- I1 — RPC : fn_write_audit_log (SECURITY DEFINER)
-- Remplace l'INSERT direct sur audit_log depuis les clients authentifiés.
-- La fonction tourne en tant que son owner (postgres / service_role) → bypasse RLS.
-- Le caller ne peut écrire que pour son propre uid.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_write_audit_log(
  p_user_id     uuid,
  p_user_email  text,
  p_action      text,
  p_resource    text,
  p_resource_id text,
  p_metadata    jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vérifier que le caller écrit bien pour lui-même (pas d'usurpation)
  IF p_user_id <> auth.uid() AND (auth.jwt() ->> 'user_role') <> 'admin_global' THEN
    RAISE EXCEPTION 'Permission denied: cannot write audit entry for another user.';
  END IF;

  INSERT INTO audit_log (user_id, user_email, action, resource, resource_id, metadata)
  VALUES (p_user_id, p_user_email, p_action, p_resource, p_resource_id, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_write_audit_log TO authenticated;
