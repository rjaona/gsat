-- =============================================================================
-- P4/P5 — Storage bucket « preuves » + RLS storage.objects + RPC notification
--         « validée avec essentiels KO ».
--
-- Contexte : ces deux objets étaient différés « à valider en staging » (P4/P5).
--   Un `supabase start` neuf n'a NI le bucket `preuves` NI de policy
--   storage.objects → l'upload du PV de comité (P4) n'a jamais tourné.
--   La notification (P5) ne pouvait pas partir côté client : `notif_insert`
--   exclut `responsable_asn` ET `users_select` ne laisse pas une ASN lire le
--   `responsable_osn` de son OSN parent. D'où une RPC SECURITY DEFINER, sur le
--   même patron que `fn_moyenne_nationale` (P6).
--
-- ⚠️ Les policies storage lisent le claim applicatif `user_role`, JAMAIS `role`
--    (= le drift corrigé par la migration 20260806). Un snippet Supabase standard
--    (`auth.role()` / `role`) réintroduirait le bug : échec fermé pour tout login.
--
-- Idempotent : bucket ON CONFLICT DO NOTHING ; DROP POLICY IF EXISTS avant CREATE ;
-- CREATE OR REPLACE FUNCTION. Applicable plusieurs fois sans effet de bord.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Bucket privé « preuves »
--    Clé objet : preuves/{orgId}/{campagneId}/{evalId}/{critereCode|pv-comite}/{fichier}
--    → (storage.foldername(name))[1] = 'preuves', [2] = orgId.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('preuves', 'preuves', false)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. RLS storage.objects (bucket 'preuves')
--    Miroir des policies de la table evaluation_preuves, exprimé par le path.
--    Le PV de comité est uploadé SANS ligne evaluation_preuves (ValidationPage
--    pose seulement evaluations.pv_comite_path) → matching par path obligatoire.
-- -----------------------------------------------------------------------------

-- SELECT : own org + descendants (OSN/région lisent les Faritany enfants) + admin.
-- Requis pour createSignedUrl : le relecteur national doit voir le PV (cross-org).
DROP POLICY IF EXISTS preuves_storage_select ON storage.objects;
CREATE POLICY preuves_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'preuves'
    AND (
      (auth.jwt() ->> 'user_role') = 'admin_global'
      OR (storage.foldername(name))[2] = (auth.jwt() ->> 'org_id')
      OR (
        (auth.jwt() ->> 'user_role') IN ('responsable_osn', 'responsable_region')
        AND EXISTS (
          SELECT 1 FROM organisations o
          WHERE o.id = ((storage.foldername(name))[2])::uuid
            AND o.parent_id = (auth.jwt() ->> 'org_id')::uuid
        )
      )
    )
  );

-- INSERT : upload dans sa propre org (couvre PV du responsable_asn ET preuves
-- de critère uploadées par OSN/utilisateur_asn/evaluateur via uploadPreuve) + admin.
DROP POLICY IF EXISTS preuves_storage_insert ON storage.objects;
CREATE POLICY preuves_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'preuves'
    AND (
      (auth.jwt() ->> 'user_role') = 'admin_global'
      OR (storage.foldername(name))[2] = (auth.jwt() ->> 'org_id')
    )
  );

-- (La policy DELETE est volontairement placée EN FIN de fichier : elle référence
--  la colonne storage.objects.owner, dont le nom peut varier selon la version du
--  service Storage (`owner` vs `owner_id`). En dernier, une éventuelle erreur de
--  colonne n'empêche pas le bucket + SELECT/INSERT + RPC — le chemin P4/P5 =
--  upload + lecture seule — d'être appliqués.)

-- -----------------------------------------------------------------------------
-- 3. RPC fn_notifier_validation_essentiels_ko (SECURITY DEFINER)
--    Résout le destinataire (responsable_osn de l'OSN parente → fallback
--    admin_global) et insère la notification. Contourne notif_insert (exclut
--    responsable_asn) et users_select (own-org only) de façon contrôlée.
--
--    Garde sécu (le cœur de la sûreté d'un SECURITY DEFINER ouvert à
--    `authenticated`) : le caller DOIT être admin_global OU le responsable de
--    l'org de l'évaluation, et l'évaluation DOIT être `validee`.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_notifier_validation_essentiels_ko(
  p_eval_id       uuid,
  p_essentiels_ko text[],
  p_org_name      text DEFAULT NULL
)
RETURNS uuid           -- id du destinataire notifié, ou NULL si personne / rien à notifier
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eval_org  uuid;
  v_statut    text;
  v_parent    uuid;
  v_recipient uuid;
  v_org_name  text;
BEGIN
  -- Rien à signaler.
  IF p_essentiels_ko IS NULL OR array_length(p_essentiels_ko, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT e.org_id, e.statut::text INTO v_eval_org, v_statut
  FROM evaluations e WHERE e.id = p_eval_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Évaluation introuvable : %', p_eval_id;
  END IF;

  -- Garde : caller autorisé + évaluation réellement validée.
  IF NOT (
    (auth.jwt() ->> 'user_role') = 'admin_global'
    OR (auth.jwt() ->> 'org_id')::uuid = v_eval_org
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF v_statut <> 'validee' THEN
    RAISE EXCEPTION 'Évaluation non validée (statut=%)', v_statut;
  END IF;

  -- Destinataire : responsable_osn de l'OSN parente, sinon admin_global.
  SELECT parent_id, nom INTO v_parent, v_org_name FROM organisations WHERE id = v_eval_org;

  SELECT id INTO v_recipient
  FROM users
  WHERE org_id = v_parent AND role = 'responsable_osn' AND actif
  ORDER BY nom
  LIMIT 1;

  IF v_recipient IS NULL THEN
    SELECT id INTO v_recipient
    FROM users
    WHERE role = 'admin_global' AND actif
    ORDER BY nom
    LIMIT 1;
  END IF;

  IF v_recipient IS NULL THEN
    RETURN NULL;   -- aucun relecteur national à notifier
  END IF;

  INSERT INTO notifications (
    type, title, message, recipient_id, sender_id, resource_type, resource_id, read
  )
  VALUES (
    'alerte_critique',
    'Évaluation validée avec des critères essentiels non conformes',
    coalesce(p_org_name, v_org_name, 'Un Faritany')
      || ' a validé son évaluation avec '
      || array_length(p_essentiels_ko, 1)
      || ' critère(s) essentiel(s) à 0 : '
      || array_to_string(p_essentiels_ko, ', ') || '.',
    v_recipient,
    auth.uid(),
    'evaluation',
    p_eval_id::text,
    false
  );

  RETURN v_recipient;
END;
$$;

REVOKE ALL ON FUNCTION fn_notifier_validation_essentiels_ko(uuid, text[], text) FROM public;
GRANT EXECUTE ON FUNCTION fn_notifier_validation_essentiels_ko(uuid, text[], text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4. DELETE storage (placée en dernier — cf. note §2). Propriétaire ou admin.
--    ⚠️ Si prod nomme la colonne `owner_id`, remplacer `owner` ci-dessous.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS preuves_storage_delete ON storage.objects;
CREATE POLICY preuves_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'preuves'
    AND (
      owner = auth.uid()
      OR (auth.jwt() ->> 'user_role') = 'admin_global'
    )
  );

-- -----------------------------------------------------------------------------
-- Rollback (manuel) :
--   DROP FUNCTION IF EXISTS fn_notifier_validation_essentiels_ko(uuid, text[], text);
--   DROP POLICY IF EXISTS preuves_storage_select ON storage.objects;
--   DROP POLICY IF EXISTS preuves_storage_insert ON storage.objects;
--   DROP POLICY IF EXISTS preuves_storage_delete ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'preuves';  -- seulement si vide
-- -----------------------------------------------------------------------------
