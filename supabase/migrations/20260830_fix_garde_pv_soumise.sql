-- =============================================================================
-- Audit go-live M9 — fn_garde_auto_validation : n'exiger le PV comite que pour
-- l'auto-validation Faritany (OLD.statut='en_cours'), pas pour la validation
-- hierarchique OSN (OLD.statut='soumise').
--
-- PROBLEME : la garde exigeait un PV comite sur TOUTE transition -> validee.
-- Regle concue pour l'auto-validation Faritany (responsable_asn : en_cours ->
-- validee, PV obligatoire). Elle capturait par effet de bord la validation
-- hierarchique OSN (responsable_osn/region : soumise -> validee, sans PV dans ce
-- parcours — updateStatutEvaluation ne pose jamais pv_comite_path), qui echouait
-- donc TOUJOURS avec un message trompeur "Auto-validation impossible". Latent en
-- prod (0 compte osn/region) mais bloquant des le provisioning de ces comptes.
-- Decision produit (2026-08-30) : la validation OSN ne requiert pas de PV.
--
-- FIX : ne lever l'exception PV que si OLD.statut = 'en_cours'. La population des
-- metadonnees de validation (validee_at/par/revue_echeance_at) reste appliquee a
-- TOUTE transition -> validee (l'echeance de revue doit exister quel que soit le
-- parcours). Le garde "renvoi en revision exige un motif" est inchange.
--
-- IDEMPOTENT : CREATE OR REPLACE FUNCTION, rejouable.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_garde_auto_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_delai INTEGER;
BEGIN
  IF NEW.statut = 'validee' AND COALESCE(OLD.statut, 'brouillon') <> 'validee' THEN
    -- PV comite obligatoire UNIQUEMENT pour l'auto-validation Faritany (en_cours).
    -- La validation hierarchique OSN (soumise -> validee) n'en exige pas.
    IF OLD.statut = 'en_cours'
       AND (NEW.pv_comite_path IS NULL OR NEW.pv_comite_path = '') THEN
      RAISE EXCEPTION 'Auto-validation impossible : le PV de comité est obligatoire.';
    END IF;

    SELECT COALESCE(sc.revue_delai_jours, 60) INTO v_delai
    FROM organisations o
    LEFT JOIN system_config sc ON sc.org_id = o.parent_id
    WHERE o.id = NEW.org_id;

    NEW.validee_at        := COALESCE(NEW.validee_at, NOW());
    NEW.validee_par       := COALESCE(NEW.validee_par, auth.uid());
    NEW.revue_echeance_at := NEW.validee_at + (COALESCE(v_delai, 60) || ' days')::INTERVAL;
  END IF;

  IF NEW.reviewer_verdict = 'revision_requested'
     AND (NEW.revue_motif IS NULL OR NEW.revue_motif = '') THEN
    RAISE EXCEPTION 'Un renvoi en révision exige un motif.';
  END IF;

  RETURN NEW;
END;
$$;

-- Rollback : re-CREATE OR REPLACE avec la condition d'origine
-- (IF NEW.pv_comite_path IS NULL OR NEW.pv_comite_path = '' THEN RAISE ...) sans
-- le garde OLD.statut = 'en_cours'.
