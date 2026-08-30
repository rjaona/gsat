# Candidats — Axe 1 Sécurité & isolation RLS (fan-out lecture seule 2026-08-30)
Décompte annoncé : 1 BLOQUANT · 2 MAJEUR · 5 MINEUR.

- [BLOQUANT] `supabase/rls_policies.sql:250-253` (`evals_update` 3e branche) — branche `user_role IN (responsable_region,responsable_osn,evaluateur) AND statut IN (soumise,validee)` SANS contrainte d'org/hiérarchie ; pas de WITH CHECK (=USING réutilisé) → écriture cross-tenant : un evaluateur du Faritany A modifie/valide/réassigne (`org_id`) l'éval `soumise` du Faritany B. VÉRIF PROD : `select policyname,qual,with_check from pg_policies where tablename='evaluations' and policyname like 'evals_update%';`
- [MAJEUR] `src/__tests__/security/rlsPolicies.test.ts` — test « sécu » = réimplémentation TS de la logique, ne teste PAS le SQL réel (ne contient même pas la 3e branche vulnérable). Suite verte ≠ isolation prouvée. PROUVÉ CODE.
- [MAJEUR] `supabase/config.toml:169,204,209,175` — `enable_signup=true` + `enable_confirmations=false` + `min_password=6` → compte auto-inscrit sans profil lit tables `USING(TRUE)` (pays/organisations/campagnes/référentiel). VÉRIF PROD : `GOTRUE_DISABLE_SIGNUP` sur le VPS (config.toml = CLI local, pas GoTrue self-hosté).
- [MINEUR] `supabase/migrations/20260804_faritany.sql:176-188` (`fn_moyenne_nationale`) — SECURITY DEFINER, `p_org_id` arbitraire, sans garde interne caller → bénin en 1 OSN, fuiterait l'agrégat d'un autre OSN si multi-OSN.
- [MINEUR] `supabase/migrations/20260816_p4p5_storage_notif.sql:61-69` (`preuves_storage_insert`) — n'exige pas statut brouillon/en_cours → upload/écrasement PV post-validation (borné own org).
- [MINEUR] `supabase/hook_custom_access_token.sql:44` (`AND u.actif=TRUE`) — user désactivé s'authentifie quand même (sans claims) → lit encore tables `USING(TRUE)` ; désactivation ≠ révocation.
- [MINEUR] `supabase/rls_policies.sql:583-602` (`fn_write_audit_log`) — metadata/action/resource arbitraires sur son propre uid → bruit/empoisonnement audit (pas d'usurpation d'un autre uid).
- [MINEUR/housekeeping] dump backup racine (cf axe 4).

POSITIF : drift `role`→`user_role` réconcilié (14 ALTER dans 20260806, 1:1) SI migrations rejouées dans l'ordre ; storage `preuves` lit `user_role` ; edge CORS restreint, pas de secret commité, garde `guard_users_sensitive_columns` anti-élévation, audit_log immuable côté client, vue ERP security_invoker.
