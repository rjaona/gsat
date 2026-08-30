-- =============================================================================
-- Audit go-live B1 — Fix isolation cross-tenant sur evals_update.
--
-- POURQUOI : la policy evals_update avait une 3e branche
--   ((user_role IN (responsable_region, responsable_osn, evaluateur))
--     AND statut IN ('soumise','validee'))
-- SANS aucune contrainte d'org ni de hierarchie, et un WITH CHECK vide
-- (PostgreSQL reutilise alors le USING). Effet : un compte evaluateur (ou
-- region/osn) pouvait UPDATE l'evaluation soumise/validee de N'IMPORTE quel
-- Faritany — modifier ses champs, changer son statut, voire reassigner org_id.
-- Rupture d'isolation multi-tenant en ecriture.
--
-- FIX : retirer la 3e branche et poser un WITH CHECK explicite identique au
-- USING (empeche tout deplacement cross-org). Les cas legitimes restent
-- couverts par evals_update_resp_asn (saisie ASN, own org) et evals_update_revue
-- (revue OSN/region bornee par hierarchie) — policies distinctes, OR-combinees.
--
-- IDEMPOTENT : ALTER POLICY, DDL pur, aucune donnee touchee, rejouable.
-- =============================================================================

BEGIN;

ALTER POLICY evals_update ON evaluations
  USING (
    (((auth.jwt() ->> 'user_role'::text) = 'admin_global'::text)
     OR (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['responsable_osn'::text, 'evaluateur'::text, 'utilisateur_asn'::text]))
         AND (org_id = ((auth.jwt() ->> 'org_id'::text))::uuid)))
  )
  WITH CHECK (
    (((auth.jwt() ->> 'user_role'::text) = 'admin_global'::text)
     OR (((auth.jwt() ->> 'user_role'::text) = ANY (ARRAY['responsable_osn'::text, 'evaluateur'::text, 'utilisateur_asn'::text]))
         AND (org_id = ((auth.jwt() ->> 'org_id'::text))::uuid)))
  );

COMMIT;

-- Rollback (NE PAS appliquer sauf regression) :
-- ALTER POLICY evals_update ON evaluations USING (
--   (((auth.jwt() ->> 'user_role') = 'admin_global')
--    OR (((auth.jwt() ->> 'user_role') = ANY (ARRAY['responsable_osn','evaluateur','utilisateur_asn'])) AND (org_id = ((auth.jwt() ->> 'org_id')::uuid)))
--    OR (((auth.jwt() ->> 'user_role') = ANY (ARRAY['responsable_region','responsable_osn','evaluateur'])) AND (statut = ANY (ARRAY['soumise'::eval_statut,'validee'::eval_statut]))))
-- );  -- (WITH CHECK redevient nul)
