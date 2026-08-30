# Audit go-live élargi GSAT — 2026-08-30

Audit de pré-montée en charge nationale (33 Faritany/ASN + usage terrain réel), 4 axes : Sécurité/RLS · Intégrité données · Perf/scale · Résilience/infra. Méthode : fan-out d'analyse statique (4 sous-agents lecture seule) → **preuves prod réelles lecture seule** → classement par sévérité. Spec `docs/superpowers/specs/2026-08-30-audit-global-gsat-design.md`, candidats dans `docs/superpowers/audit/`.

## Résumé exécutif

L'analyse statique a levé **8 « bloquants » candidats**. Confrontés à la prod, **7 sur 8 se recadrent** : la prod a été réconciliée à la main sur presque tous les points (scorer corrigé vivant, trigger câblé, drift `role`→`user_role` complet, edge + tous les conteneurs en `unless-stopped` et up). Il reste **un seul vrai trou de sécurité structurel live (B1)**, trivial et sûr à corriger, plus un lot de majeurs opérationnels/perf et de la dette repo↔prod.

**État prod déterminant** : `scores=0`, `evals=1` (le seul = scaffolding OSN v3_0 `en_cours`), 34 comptes = 1 admin_global + 33 responsable_asn (0 evaluateur/région/OSN). **Aucune donnée d'évaluation terrain n'a encore été saisie** → le go-live est une première mise en usage réelle, et les risques perf/corruption ne sont pas encore exercés.

### Décompte (après preuve prod)
| Sévérité | Nombre | 
|---|---|
| 🔴 Bloquant | **1** (B1) |
| 🟠 Majeur | 8 |
| 🟡 Mineur | 6 |
| ✅ Corrigé pendant l'audit | 1 (B6) |
| ❌ Réfuté / recadré par la prod | 6 |

### Décision go/no-go
**NO-GO conditionnel — 1 seul correctif bloquant.** Le go-live élargi peut partir dès que **B1 est corrigé** (fix trivial : borner/retirer la 3e branche de `evals_update`). Fortement recommandés avant/juste après le lancement : désactiver l'auto-inscription (M2, 1 commande), et traiter le Chantier D SMTP (M1) puisqu'un rollout de 33 comptes sans recovery email est un point de friction opérationnel connu. Les majeurs perf ne bloquent pas (0 donnée saisie) mais doivent être planifiés avant l'usage terrain intensif.

---

## 🔴 Bloquant

### B1 — Trou d'écriture cross-tenant sur `evals_update`
- **Fichier** : `supabase/rls_policies.sql:250-253` — **CONFIRMÉ LIVE** (`pg_policies` prod).
- **Défaut** : la policy `evals_update` a une 3e branche `(user_role IN ('responsable_region','responsable_osn','evaluateur')) AND statut IN ('soumise','validee')` **sans aucune contrainte d'org/hiérarchie**, et son `WITH CHECK` est **vide** (PostgreSQL réutilise le `USING`). Les policies permissives étant OR-combinées, un compte au rôle `evaluateur` (ou region/osn) peut faire un `UPDATE` sur l'évaluation `soumise`/`validee` de **n'importe quel** Faritany — modifier ses champs, changer son statut, voire réassigner `org_id`.
- **Exploitabilité actuelle : nulle** (0 compte au rôle vulnérable, 0 éval `soumise`/`validee`). **Mais elle s'ouvre exactement quand le go-live scale** : dès qu'on crée un compte evaluateur/coordinateur régional, ou dès qu'une éval terrain atteint `soumise`/`validee`.
- **Pourquoi c'est un pur bug** : les cas légitimes sont déjà couverts ailleurs — `evals_update_resp_asn` (saisie ASN), branche 2 de `evals_update` (responsable_osn/evaluateur/utilisateur_asn bornés à leur org), `evals_update_revue` (revue OSN/région bornée par hiérarchie). La 3e branche n'ajoute qu'un trou.
- **Remédiation** : supprimer la 3e branche, OU la borner par org/hiérarchie ET ajouter un `WITH CHECK` explicite. Migration DDL idempotente + backup + smoke RLS sous JWT réels. Fix-avant-scale.
- **Cause racine** : le seul test « sécurité » (`src/__tests__/security/rlsPolicies.test.ts`) est une réimplémentation TS de la logique — il ne teste **pas** le SQL réel et ne contient même pas cette 3e branche. → tout correctif RLS doit s'accompagner d'un vrai test d'intégration (JWT `user_role` via kong, ou pgTAP).

---

## 🟠 Majeurs

| # | Constat | Preuve | Remédiation |
|---|---|---|---|
| M1 | **SMTP → inbucket** : recovery mot de passe + notifs email non délivrés (`SMTP_HOST=inbucket:1025`, `API_EXTERNAL_URL=127.0.0.1`) | prod `printenv` CONFIRMÉ | Chantier D (runbook prêt, bloqué App Password Gmail). Contournement = reset admin service_role |
| M2 | **Auto-inscription ouverte** (`GOTRUE_DISABLE_SIGNUP=false` + `MAILER_AUTOCONFIRM=true`) → tout internaute lit annuaire/référentiel/campagnes | prod `printenv` CONFIRMÉ | `GOTRUE_DISABLE_SIGNUP=true` (comptes provisionnés par admin). 1 var d'env + restart auth |
| M3 | **Drift config repo↔prod** : `config.toml` versionné (`edge_runtime enabled=false`, inbucket/edge à d'autres lignes) ≠ prod (`enabled=true`) → déployer le repo casse l'edge | prod `sed config.toml` | Réaligner le `config.toml` du repo sur l'état prod réel |
| M4 | **Bootstrap non reconstructible** : `schema.sql`/`rls_policies.sql`/`hook`/`trigger` hors `supabase/migrations/` → `supabase db reset` produit une base sans tables/RLS/hook | repo PROUVÉ | Convertir ces fichiers en migrations ordonnées, ou documenter+scripter un bootstrap fidèle |
| M5 | **Scorer buggé périmé au repo** : `trigger_on_score_write.sql` réinstalle la vieille fn (N/A=0, pas de socle) ; CLAUDE.md pointe les mauvais fichiers | prod = version corrigée vivante (non clobbée) | Supprimer/neutraliser le fichier, corriger CLAUDE.md, câbler la parité `parite-sql.diff.test` en CI |
| M6 | **Amplification d'écriture perf** : `writeScore` par frappe (pas de debounce) → recalc + UPDATE sur la ligne `dashboard_stats` OSN unique, 33 Faritany convergents | code PROUVÉ (non exercé, scores=0) | Debounce saisie + envisager recalcul asynchrone/agrégat OSN découplé |
| M7 | **N+1 pages OSN** : `DashboardOsnPage:102-122` (33 requêtes), `PilotageOsnPage:92-118` (33×plans×actions) | code PROUVÉ | Utiliser le pattern batché `listPlanStatsByOrgIds`/`.in()` déjà présent à côté |
| M8 | **Indice non borné/non caché** : `indiceService:44-57` charge toutes les évals de toutes les campagnes far, 5 A/R séquentiels, refetch à chaque visite | code PROUVÉ | Borne temporelle/pagination + cache store entre montages |

---

## 🟡 Mineurs (backlog)

| # | Constat | Preuve |
|---|---|---|
| m1 | `audit_log` sans `FORCE ROW LEVEL SECURITY` → altérable par service_role/owner | prod CONFIRMÉ (`relforcerowsecurity=f`) |
| m2 | Pas d'index sur `campagnes.referentiel_version` (scan quand la table grossit) | prod CONFIRMÉ |
| m3 | `updateReferentiel` (UI admin) upsert sans `onConflict` → 23505 au 2e import d'un référentiel | code PROUVÉ |
| m4 | Recalcul `EXCEPTION WHEN OTHERS…RETURN` avale les erreurs → score périmé silencieux (observabilité) | code PROUVÉ |
| m5 | Subscribe realtime non filtrés (`campagnes`, `referentiel`, `carto`, `subscribeAllEvaluations`) → refetch large sur événement | code PROUVÉ |
| m6 | `preuves_storage_insert` n'exige pas statut brouillon/en_cours ; hook `actif=TRUE` (user désactivé s'authentifie encore) ; `fn_moyenne_nationale`/`fn_write_audit_log` gardes minimales ; `MODEL` chat-with-ai figé sans fallback ; commentaire `parent_version='3.0'` vs data `'v3_0'` | code PROUVÉ |

**Pas de monitoring/alerting** ni de **backup automatisé** versionnés, et **firewall hPanel** qui bloque l'accès ops par intermittence : ce sont des lacunes opérationnelles réelles (majeures sur le principe) mais hors du périmètre « correctif code » — à porter comme chantiers ops dédiés (recommandation de gouvernance, pas de correctif dans cette campagne).

---

## ✅ Corrigé pendant l'audit
- **B6 — dump prod avec hash de mots de passe** (`gsat_backup_*.sql`, `auth.users`+`vault.secrets`) traînait à la racine, non gitignoré, et n'existait **plus sur le VPS** (seule copie). Sorti du repo/OneDrive vers `~/gsat_backups` (`0600`) + pattern `.gitignore` (commit `7c01b70`).

## ❌ Réfutés / recadrés par la preuve prod
- Scorer buggé vivant → **FAUX**, version corrigée en prod (`pg_get_functiondef` : FILTER N/A + mode socle). → devient M5 (repo).
- Trigger `on_score_write` absent → **FAUX**, présent et actif (`pg_trigger`).
- Edge runtime down / RestartPolicy=no → **FAUX**, edge `enabled=true`, running, et les 10 conteneurs en `unless-stopped` (up 13j). → devient M3 (drift config).
- Rate-limit email `2/h` → **FAUX**, prod = `360000`.
- Drift policies lisant `->> 'role'` → **FAUX**, 0 en prod (réconciliation `user_role` complète).

## Traçabilité
Constats candidats bruts : `docs/superpowers/audit/candidats-axe{1..4}-*.md`. Verdicts + commandes/sorties : `docs/superpowers/audit/preuves-prod.md`.
