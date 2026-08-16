-- =============================================================================
-- Fix RLS : claim 'role' → 'user_role' pour les 14 policies créées par
-- 20260804_faritany.sql.
--
-- POURQUOI : le custom_access_token_hook injecte le rôle applicatif sous le
-- claim 'user_role'. Le claim 'role' reste le rôle Postgres ('authenticated'),
-- utilisé par PostgREST pour SET ROLE — on ne peut pas l'écraser. Les 14
-- policies ci-dessous comparaient `auth.jwt() ->> 'role'` à un rôle applicatif
-- (responsable_asn, responsable_osn, …) → toujours faux pour un vrai login →
-- workflow responsable_asn (saisie évals/scores/preuves) entièrement bloqué.
-- Les tests de logique pure ne l'ont pas vu ; prouvé par décodage d'un vrai JWT
-- (role='authenticated', user_role='admin_global').
--
-- IDEMPOTENT : ALTER POLICY, DDL pur, aucune donnée touchée, rejouable.
-- Appliquée en prod le 2026-08-06.
-- =============================================================================

BEGIN;

ALTER POLICY action_tpl_write ON action_templates USING (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['admin_global'::text, 'responsable_osn'::text]))) WITH CHECK (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['admin_global'::text, 'responsable_osn'::text])));
ALTER POLICY alerte_regles_select ON alerte_regles USING (((org_id IS NULL) OR (org_id = ((auth.jwt() ->> 'org_id'::text))::uuid) OR ((auth.jwt() ->> 'user_role'::text) = 'admin_global'::text)));
ALTER POLICY alerte_regles_write ON alerte_regles USING (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['admin_global'::text, 'responsable_osn'::text]))) WITH CHECK (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['admin_global'::text, 'responsable_osn'::text])));
ALTER POLICY alertes_select ON alertes USING ((((auth.jwt() ->> 'user_role'::text) = 'admin_global'::text) OR (org_id = ((auth.jwt() ->> 'org_id'::text))::uuid) OR (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['responsable_osn'::text, 'responsable_region'::text])) AND (EXISTS ( SELECT 1
   FROM organisations o
  WHERE ((o.id = alertes.org_id) AND (o.parent_id = ((auth.jwt() ->> 'org_id'::text))::uuid)))))));
ALTER POLICY alertes_update_statut ON alertes USING ((((auth.jwt() ->> 'user_role'::text) = 'admin_global'::text) OR (org_id = ((auth.jwt() ->> 'org_id'::text))::uuid)));
ALTER POLICY erp_snap_select ON erp_snapshots USING ((((auth.jwt() ->> 'user_role'::text) = 'admin_global'::text) OR (org_id = ((auth.jwt() ->> 'org_id'::text))::uuid) OR (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['responsable_osn'::text, 'responsable_region'::text])) AND (EXISTS ( SELECT 1
   FROM organisations o
  WHERE ((o.id = erp_snapshots.org_id) AND (o.parent_id = ((auth.jwt() ->> 'org_id'::text))::uuid)))))));
ALTER POLICY erp_snap_write ON erp_snapshots USING (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['admin_global'::text, 'responsable_osn'::text]))) WITH CHECK (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['admin_global'::text, 'responsable_osn'::text])));
ALTER POLICY preuves_resp_asn ON evaluation_preuves USING ((((auth.jwt() ->> 'user_role'::text) = 'responsable_asn'::text) AND (EXISTS ( SELECT 1
   FROM evaluations e
  WHERE ((e.id = evaluation_preuves.eval_id) AND (e.org_id = ((auth.jwt() ->> 'org_id'::text))::uuid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM evaluations e
  WHERE ((e.id = evaluation_preuves.eval_id) AND (e.org_id = ((auth.jwt() ->> 'org_id'::text))::uuid)))));
ALTER POLICY scores_resp_asn ON evaluation_scores USING ((((auth.jwt() ->> 'user_role'::text) = 'responsable_asn'::text) AND (EXISTS ( SELECT 1
   FROM evaluations e
  WHERE ((e.id = evaluation_scores.eval_id) AND (e.org_id = ((auth.jwt() ->> 'org_id'::text))::uuid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM evaluations e
  WHERE ((e.id = evaluation_scores.eval_id) AND (e.org_id = ((auth.jwt() ->> 'org_id'::text))::uuid) AND (e.statut = ANY (ARRAY['brouillon'::eval_statut, 'en_cours'::eval_statut]))))));
ALTER POLICY scores_write_resp_asn ON evaluation_scores USING ((((auth.jwt() ->> 'user_role'::text) = 'responsable_asn'::text) AND (EXISTS ( SELECT 1
   FROM evaluations e
  WHERE ((e.id = evaluation_scores.eval_id) AND (e.org_id = ((auth.jwt() ->> 'org_id'::text))::uuid) AND (e.statut = ANY (ARRAY['brouillon'::eval_statut, 'en_cours'::eval_statut]))))))) WITH CHECK ((((auth.jwt() ->> 'user_role'::text) = 'responsable_asn'::text) AND (EXISTS ( SELECT 1
   FROM evaluations e
  WHERE ((e.id = evaluation_scores.eval_id) AND (e.org_id = ((auth.jwt() ->> 'org_id'::text))::uuid) AND (e.statut = ANY (ARRAY['brouillon'::eval_statut, 'en_cours'::eval_statut])))))));
ALTER POLICY evals_insert_resp_asn ON evaluations WITH CHECK ((((auth.jwt() ->> 'user_role'::text) = 'responsable_asn'::text) AND (org_id = ((auth.jwt() ->> 'org_id'::text))::uuid)));
ALTER POLICY evals_select_resp_asn ON evaluations USING ((((auth.jwt() ->> 'user_role'::text) = 'responsable_asn'::text) AND (org_id = ((auth.jwt() ->> 'org_id'::text))::uuid)));
ALTER POLICY evals_update_resp_asn ON evaluations USING ((((auth.jwt() ->> 'user_role'::text) = 'responsable_asn'::text) AND (org_id = ((auth.jwt() ->> 'org_id'::text))::uuid) AND (statut = ANY (ARRAY['brouillon'::eval_statut, 'en_cours'::eval_statut])))) WITH CHECK (((org_id = ((auth.jwt() ->> 'org_id'::text))::uuid) AND (statut = ANY (ARRAY['brouillon'::eval_statut, 'en_cours'::eval_statut, 'validee'::eval_statut]))));
ALTER POLICY evals_update_revue ON evaluations USING (((statut = 'validee'::eval_statut) AND (((auth.jwt() ->> 'user_role'::text) = 'admin_global'::text) OR (((auth.jwt() ->> 'user_role'::text) = 'responsable_osn'::text) AND (EXISTS ( SELECT 1
   FROM organisations o
  WHERE ((o.id = evaluations.org_id) AND ((o.id = ((auth.jwt() ->> 'org_id'::text))::uuid) OR (o.parent_id = ((auth.jwt() ->> 'org_id'::text))::uuid)))))) OR (((auth.jwt() ->> 'user_role'::text) = 'responsable_region'::text) AND (EXISTS ( SELECT 1
   FROM (organisations o
     JOIN organisations p ON ((p.id = o.parent_id)))
  WHERE ((o.id = evaluations.org_id) AND (p.parent_id = ((auth.jwt() ->> 'org_id'::text))::uuid)))))))) WITH CHECK ((statut = ANY (ARRAY['cloturee'::eval_statut, 'en_cours'::eval_statut])));

COMMIT;
