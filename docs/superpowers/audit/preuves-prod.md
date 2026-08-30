# Preuves prod (lecture seule) — 2026-08-30
Accès : `ssh -i ~/.ssh/id_ed25519 root@76.13.37.209` → `docker exec supabase_db_gsat psql`. Aucune mutation persistante.
État prod clé : **scores=0, evals=1** (uniquement le scaffolding OSN v3_0 en_cours), 33 ASN + 1 OSN + 1 OMMS, 34 comptes = 1 admin_global + 33 responsable_asn (0 evaluateur/region/osn), far_v1_0 & v3_0 actifs. → **aucune donnée d'éval terrain saisie ; go-live = 1re mise en usage réelle.**

## Verdicts par candidat

### CONFIRMÉS LIVE
- **[🔴 B1 CONFIRMÉ] evals_update — trou d'écriture cross-tenant.** `pg_policies` prod : `evals_update` a bien la 3e branche `(user_role IN (responsable_region,responsable_osn,evaluateur)) AND statut IN (soumise,validee)` SANS contrainte d'org, et `with_check` VIDE (=USING). Preuve : qual/with_check extraits. Exploitabilité AUJOURD'HUI = nulle (0 compte au rôle vulnérable, 0 éval soumise/validée) mais s'ouvre dès création d'un compte evaluateur/region/osn OU dès qu'une éval atteint soumise/validee. Les cas légitimes sont déjà couverts par `evals_update_resp_asn` + branche 2 + `evals_update_revue` → la 3e branche est purement le bug. FIX-AVANT-SCALE.
- **[🟠 SMTP CONFIRMÉ] GoTrue → inbucket.** `printenv` : `GOTRUE_SMTP_HOST=supabase_inbucket_gsat:1025`, `API_EXTERNAL_URL=http://127.0.0.1:54331`, `MAILER_URLPATHS_RECOVERY=127.0.0.1/...` → recovery mot de passe + notifs email non délivrés. Contournement : reset admin service_role. = Chantier D (connu, runbook prêt, bloqué App Password).
- **[🟠 Auto-signup CONFIRMÉ] `GOTRUE_DISABLE_SIGNUP=false` + `MAILER_AUTOCONFIRM=true`** → tout internaute crée un compte actif et lit les tables `USING(TRUE)` (annuaire OSN/ASN, référentiel, campagnes). Fix trivial : `GOTRUE_DISABLE_SIGNUP=true` (comptes provisionnés par admin via manage-user).
- **[🟡 audit_log] `relforcerowsecurity=f`** → service_role/owner bypass RLS (append-only garanti clients seulement). Confirmé.
- **[🟡 index] campagnes** : pas d'index sur `referentiel_version` (idx statut/ouverture/organisateur présents). Confirmé, impact faible tant que la table est petite.

### RÉFUTÉS / RECADRÉS par la prod
- **[B2 → 🟠 repo-hygiene] Scorer buggé NON vivant.** `pg_get_functiondef('fn_recalculate_scores')` prod contient `3 * COUNT(*) FILTER (WHERE NOT (es.id IS NOT NULL AND es.note IS NULL))` + `v_mode <> 'socle'` + `NOT (es.id IS NOT NULL AND es.note IS NULL) -- N/A ≠ KO` = **version CORRIGÉE**. Le `COALESCE(es.note,0)` du numérateur est bénin (N/A=0 au num mais exclu du dén). → le fichier `trigger_on_score_write.sql` buggé n'a PAS clobbé la prod (réconciliée main). Risque résiduel = artefact périmé + doc CLAUDE.md trompeuse (bombe si re-apply).
- **[B3 → 🟠 repo/bootstrap] Trigger présent.** `pg_trigger` : `on_score_write` existe, `tgenabled=O`. Recalcul câblé en prod. Risque résiduel = bootstrap par script ne câble pas le trigger.
- **[B4 → 🟠 drift config] Edge OK.** Les 10 conteneurs gsat = `restart=unless-stopped` + running (up 13j). `config.toml` PROD : `[edge_runtime] enabled=true`. → « edge tombé / RestartPolicy=no » PLUS VRAI. MAIS le `config.toml` REPO a `enabled=false` (+ inbucket/edge à des lignes différentes) → **drift repo↔prod : le config versionné ≠ prod** (déployer le repo casserait l'edge).
- **[rate-limit email → RÉFUTÉ] `GOTRUE_RATE_LIMIT_EMAIL_SENT=360000`** en prod (pas 2). La valeur `2` était le template repo stale.
- **[drift role → RÉFUTÉ] 0 policy** lisant `->> 'role'` en prod (regexp `>>\s*'role'`). Réconciliation `user_role` complète confirmée.
- **[B5 → 🟠 confirmé REPO] Bootstrap non reconstructible.** Fait repo : schema/rls/hook/trigger hors `migrations/` + config.toml prod ≠ repo (prouvé par lignes + `enabled`). DR/staging non fidèles depuis le repo.
- **[B6 → ✅ CORRIGÉ] dump** sorti du repo (~/gsat_backups 0600) + gitignore (commit 7c01b70). N'était PAS déjà sur le VPS (seule copie).

### PERF (axe 3) — non exercé (scores=0) mais réel au code
- [🟠] amplification écriture sans debounce (writeScore par frappe → recalc + UPDATE ligne OSN unique) ; [🟠] N+1 DashboardOsnPage:102-122 / PilotageOsnPage:92-118 (pattern batché existe à côté) ; [🟠] indiceService non caché/non borné ; [🟡] subscribe non filtrés. À traiter avant usage terrain intensif.
