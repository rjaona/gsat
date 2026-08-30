-- =============================================================================
-- Audit go-live B1 — Fix isolation cross-tenant sur evals_update (+ restauration
-- bornee de la validation hierarchique des evaluations 'soumise').
--
-- PROBLEME : la policy evals_update avait une 3e branche
--   ((user_role IN (responsable_region, responsable_osn, evaluateur))
--     AND statut IN ('soumise','validee'))
-- SANS aucune contrainte d'org/hierarchie, et un WITH CHECK vide (PostgreSQL
-- reutilise alors le USING). Effet : un compte evaluateur (ou region/osn)
-- pouvait UPDATE l'evaluation soumise/validee de N'IMPORTE quel Faritany —
-- modifier ses champs, changer son statut, voire reassigner org_id.
--
-- FIX EN 2 TEMPS :
--   1. evals_update : retirer la 3e branche non bornee + WITH CHECK explicite
--      borne par org (empeche l'ecriture ET le deplacement cross-org).
--   2. evals_update_soumission : RE-AJOUTER la SEULE capacite legitime que la
--      branche retiree portait pour statut='soumise' — la validation
--      hierarchique (responsable_osn sur son org/enfant direct, responsable_region
--      sur son petit-enfant), calquee EXACTEMENT sur evals_update_revue (qui, lui,
--      ne couvre que statut='validee'). Sans cette policy, la transition
--      soumise -> validee/en_cours du parcours "evaluation accompagnee" est
--      bloquee au niveau RLS (echec silencieux). Les cas own-org (responsable_asn,
--      evaluateur, responsable_osn, utilisateur_asn sur LEUR org) restent couverts
--      par evals_update (branche 2) et evals_update_resp_asn.
--
-- CAVEAT (audit go-live, constat separe) : cette policy retablit l'AUTORISATION
-- RLS. La branche "approuver" (soumise -> validee) reste, en plus, gatee par le
-- trigger fn_garde_auto_validation (migration 20260804) qui exige un PV comite
-- sur toute transition -> validee — regle concue pour l'auto-validation Faritany
-- (OLD='en_cours'), qui capture par effet de bord la validation hierarchique OSN
-- (OLD='soumise', sans PV). CORRIGE par la migration soeur
-- 20260830_fix_garde_pv_soumise.sql (PV exige seulement si OLD='en_cours').
-- Decision produit : la validation OSN ne requiert pas de PV. Voir AUDIT_GO_LIVE.md.
--
-- IDEMPOTENT : ALTER POLICY + DROP POLICY IF EXISTS/CREATE, DDL pur, rejouable.
-- =============================================================================

BEGIN;

-- 1. Fermer le trou cross-tenant.
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

-- 2. Restaurer la validation hierarchique BORNEE des evaluations 'soumise'.
DROP POLICY IF EXISTS evals_update_soumission ON evaluations;
CREATE POLICY evals_update_soumission ON evaluations
  FOR UPDATE TO authenticated
  USING (
    statut = 'soumise'
    AND (
      ((auth.jwt() ->> 'user_role') = 'responsable_osn' AND EXISTS (
            SELECT 1 FROM organisations o
            WHERE o.id = evaluations.org_id
              AND (o.id = (auth.jwt() ->> 'org_id')::uuid
                   OR o.parent_id = (auth.jwt() ->> 'org_id')::uuid)))
      OR ((auth.jwt() ->> 'user_role') = 'responsable_region' AND EXISTS (
            SELECT 1 FROM organisations o
            JOIN organisations p ON p.id = o.parent_id
            WHERE o.id = evaluations.org_id
              AND p.parent_id = (auth.jwt() ->> 'org_id')::uuid))
    )
  )
  WITH CHECK (
    statut IN ('validee', 'en_cours')   -- issues de la validation : approuve / renvoye
  );

COMMIT;

-- Rollback (NE PAS appliquer sauf regression) :
-- DROP POLICY IF EXISTS evals_update_soumission ON evaluations;
-- ALTER POLICY evals_update ON evaluations USING (
--   (((auth.jwt() ->> 'user_role') = 'admin_global')
--    OR (((auth.jwt() ->> 'user_role') = ANY (ARRAY['responsable_osn','evaluateur','utilisateur_asn'])) AND (org_id = ((auth.jwt() ->> 'org_id')::uuid)))
--    OR (((auth.jwt() ->> 'user_role') = ANY (ARRAY['responsable_region','responsable_osn','evaluateur'])) AND (statut = ANY (ARRAY['soumise'::eval_statut,'validee'::eval_statut]))))
-- );  -- (WITH CHECK redevient nul)
