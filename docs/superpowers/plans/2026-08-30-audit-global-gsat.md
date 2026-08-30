# Audit global GSAT (pré-montée en charge) — Plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire `AUDIT_GO_LIVE.md` (diagnostic 4 axes, constats prouvés en prod, classés par sévérité) et corriger les bloquants, pour étayer une décision go/no-go de montée en charge nationale.

**Architecture:** 3 phases (Approche A du spec). Phase 1 = fan-out de 4 sous-agents lecture seule (un par axe) → constats candidats. Phase 2 = preuves prod centralisées lecture seule (moi). Phase 3 = rapport + correction des bloquants. Les tâches de correctif (Task 5) sont un **gabarit instancié à l'exécution** — les bugs ne sont pas connus avant que l'audit tourne.

**Tech Stack:** React 19 / Vite 6 / TS strict, Supabase self-hosted (Postgres + GoTrue + PostgREST + Storage + Edge), RLS + hook JWT, VPS Hostinger.

## Global Constraints

- Repo : `/mnt/d/Mes Documents/GSAT/gsat-v2` (remote `origin` = github.com/rjaona/gsat, branche par défaut `master`).
- ⚠️ **Edit/Write revertés sur `/mnt/d`** (OneDrive/watcher) → toute écriture de fichier via `cat > f <<'EOF'` heredoc ou `sed -i`, jamais les outils Edit/Write.
- ⚠️ **Commits par chemin explicite** (`git add <path>`), working tree non fiable (OneDrive re-matérialise).
- Gates de code : `node node_modules/typescript/bin/tsc -b` (PAS `-p`) + `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'` + `node node_modules/vite/bin/vite.js build`.
- Accès prod (lecture) : `ssh -i ~/.ssh/id_ed25519 root@76.13.37.209` puis `docker exec -i supabase_db_gsat psql -U postgres -d postgres`. WARP off ; si egress bloqué → firewall hPanel (user rouvre le `/24`).
- RLS live sous vrais JWT via kong `127.0.0.1:54331` ; credentials des 33 comptes dans `/root/gsat_faritany_accounts.md` (root-only).
- **Sonde prod = lecture seule stricte** ; seul écrit toléré = smoke RLS `INSERT` + `DELETE` de cleanup immédiat. Backup `pg_dump` avant tout correctif DB.
- Sévérité : 🔴 Bloquant (isolation cassée / corruption / workflow go-live bloqué) → corrigé ; 🟠 Majeur / 🟡 Mineur → backlog.

---

### Task 1: Phase 1 — Fan-out analyse statique (4 axes en parallèle)

**Files:**
- Create: `docs/superpowers/audit/candidats-axe1-rls.md`
- Create: `docs/superpowers/audit/candidats-axe2-donnees.md`
- Create: `docs/superpowers/audit/candidats-axe3-perf.md`
- Create: `docs/superpowers/audit/candidats-axe4-infra.md`

**Interfaces:**
- Produces: 4 fichiers de constats candidats, format ligne par constat : `- [SEV présumée] <fichier:ligne> — <risque> — scénario d'échec : <…>`. Consommés par Task 2.

- [ ] **Step 1: Dispatcher 4 sous-agents lecture seule en un seul message (parallèle)**

Utiliser le tool Agent (subagent_type `general-purpose` ou `reviewer`), `run_in_background` par défaut. Un agent par axe. Prompt commun + section spécifique. Chaque agent doit : lire uniquement (pas d'écriture, pas d'accès prod), citer `fichier:ligne`, donner un scénario d'échec concret, proposer une sévérité, ET signaler explicitement quand il ne trouve rien de probant (pas de faux positif de complaisance).

Axe 1 (RLS/sécu) — cibler : `supabase/rls_policies.sql`, `supabase/hook_custom_access_token.sql`, `supabase/migrations/*.sql`, `src/services/*Service.ts` (auth), `.env*`, `functions/`. Chercher : policies lisant `role` (claim système) au lieu de `user_role` (claim app), WITH CHECK nul, catch-all trop larges, secrets committés, CORS, endpoints anon.

Axe 2 (intégrité données) — cibler : `src/services/*/scoring.ts` + `parite-sql.diff.test.ts`, trigger `fn_recalculate_scores`, seeds `supabase/seeds/`, `src/data/far_v1_0.json`/`referentiel_v3_0.json`, mappers `rowTo*`. Chercher : divergence scoring TS↔SQL, `?? null` réintroduisant le bug N/A≠absent≠0, NOT NULL manquants, `parent_version` non-FK, incohérences de mapping.

Axe 3 (perf/scale) — cibler : `src/services/indiceService.ts`, `dashboardService`, `src/stores/*`, requêtes `.select()`/`.in()`, souscriptions realtime, `vite.config`, chunks. Chercher : N+1, agrégations non bornées sur toutes campagnes, absence d'index sur colonnes filtrées, souscriptions multiples, gros bundles non lazy.

Axe 4 (infra/résilience) — cibler : `supabase/config.toml`, edge functions, `docs/superpowers/runbooks/`, nginx/deploy notes, `supabase/migrations/` vs objets attendus. Chercher : restart policy manquante, SMTP inbucket, `API_EXTERNAL_URL=127.0.0.1`, drift migrations repo↔prod, absence de monitoring/backup automatisé.

- [ ] **Step 2: Collecter les 4 retours et matérialiser les 4 fichiers candidats**

À réception, écrire chaque liste via heredoc :
```bash
cat > docs/superpowers/audit/candidats-axe1-rls.md <<'EOF'
# Candidats — Axe 1 RLS/sécu
<constats de l'agent, un par ligne>
EOF
```
(idem axes 2/3/4). Ne rien filtrer à ce stade — Task 2 tranche par la preuve.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/audit/candidats-axe*.md
git commit -m "audit(phase1): constats candidats 4 axes (fan-out lecture seule)"
```

---

### Task 2: Phase 2 — Preuves prod centralisées (lecture seule)

**Files:**
- Create: `docs/superpowers/audit/preuves-prod.md`

**Interfaces:**
- Consumes: les 4 fichiers `candidats-axe*.md` de Task 1.
- Produces: `preuves-prod.md` = pour chaque candidat : `CONFIRMÉ | RÉFUTÉ | N/A` + commande exacte + sortie observée + sévérité arbitrée. Consommé par Task 3.

- [ ] **Step 1: Vérifier la connectivité VPS (WARP off, firewall ouvert)**

Run:
```bash
timeout 20 ssh -i ~/.ssh/id_ed25519 -o ConnectTimeout=12 root@76.13.37.209 'echo SSH_OK && docker ps --format "{{.Names}} {{.Status}}" | grep gsat'
```
Expected: `SSH_OK` + conteneurs `supabase_*_gsat` Up. Si timeout → demander au user de rouvrir le firewall hPanel (`/24` egress dev).

- [ ] **Step 2: Sondes Axe 1 (RLS/sécu) — lecture seule**

Pour chaque candidat RLS, prouver contre la prod. Exemples de sondes :
```bash
# policies lisant 'role' au lieu de 'user_role'
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"select policyname, qual, with_check from pg_policies where schemaname='public' and (qual like '%''role''%' or with_check like '%''role''%');\""
# isolation cross-Faritany : login ant.01 via kong, tenter de lire une éval d'un AUTRE Faritany → attendu 0 ligne / 403
```
Le smoke RLS écrivant (INSERT) doit être suivi d'un `DELETE` de cleanup immédiat. Consigner commande + sortie.

- [ ] **Step 3: Sondes Axe 2 (intégrité données)**
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"select (select count(*) from referentiel_versions) refver, (select count(*) from organisations where org_type='ASN') asn, (select count(*) from auth.users) users, (select count(*) from criteres) crit;\""
```
Prouver la parité scoring en rejouant le `parite-sql.diff.test` si une base est joignable, sinon comparer `fn_recalculate_scores` (dump `pg_get_functiondef`) au `scoring.ts`. Vérifier NOT NULL réels via `\d+ <table>`.

- [ ] **Step 4: Sondes Axe 3 (perf) et Axe 4 (infra)**
```bash
# index présents
ssh … "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"\\di+ public.*\""
# EXPLAIN d'une requête chaude (ex: agrégation indice) si reproductible
# edge/restart/SMTP
ssh … "docker inspect supabase_edge_runtime_gsat --format '{{.HostConfig.RestartPolicy.Name}} {{.State.Status}}'"
ssh … "docker exec supabase_auth_gsat printenv | grep -E 'SMTP|API_EXTERNAL_URL|MAILER'"
# drift migrations repo↔prod : lister objets clés attendus vs présents
```

- [ ] **Step 5: Matérialiser `preuves-prod.md` et committer**
```bash
cat > docs/superpowers/audit/preuves-prod.md <<'EOF'
# Preuves prod (lecture seule) — 2026-08-30
## Axe 1 …  (par candidat : verdict + commande + sortie + sévérité)
EOF
git add docs/superpowers/audit/preuves-prod.md
git commit -m "audit(phase2): preuves prod lecture seule + verdicts par candidat"
```

---

### Task 3: Phase 3a — Rapport `AUDIT_GO_LIVE.md`

**Files:**
- Create: `AUDIT_GO_LIVE.md` (racine repo, comme `AUDIT_LOT1.md`/`AUDIT_INDICE.md`)

**Interfaces:**
- Consumes: `preuves-prod.md` (Task 2).
- Produces: rapport final structuré : résumé exécutif + décision go/no-go préliminaire ; par axe, tableau des constats `CONFIRMÉS` classés 🔴/🟠/🟡 avec preuve et remédiation ; annexe des candidats réfutés (traçabilité).

- [ ] **Step 1: Écrire le rapport via heredoc**

Structure imposée :
```bash
cat > AUDIT_GO_LIVE.md <<'EOF'
# Audit go-live élargi GSAT — 2026-08-30
## Résumé exécutif  (verdict global, nb bloquants/majeurs/mineurs)
## Décision go/no-go  (conditionnée à la résolution des 🔴)
## Axe 1 — Sécurité & RLS  (tableau : constat | sévérité | preuve | remédiation)
## Axe 2 — Intégrité données
## Axe 3 — Perf & scale
## Axe 4 — Résilience & infra
## Backlog priorisé (🟠/🟡)
## Annexe — candidats réfutés
EOF
```

- [ ] **Step 2: Commit**
```bash
git add AUDIT_GO_LIVE.md
git commit -m "audit(phase3): rapport AUDIT_GO_LIVE.md — constats classés + go/no-go"
```

- [ ] **Step 3: Checkpoint user**

Présenter le rapport au user. Lister les 🔴 bloquants et **demander validation** de la liste des correctifs à mener (Task 5) avant de toucher au code/prod. Un 🔴 nécessitant une refonte → différé à son propre spec (noté dans le backlog, pas corrigé ici).

---

### Task 4: Nettoyage artefacts intermédiaires (optionnel)

**Files:**
- Delete: `docs/superpowers/audit/candidats-axe*.md`, `docs/superpowers/audit/preuves-prod.md` (si le user veut garder le repo propre — sinon conservés pour traçabilité).

- [ ] **Step 1: Décider avec le user** si les fichiers de travail restent (traçabilité) ou sont supprimés (seul `AUDIT_GO_LIVE.md` fait foi). Par défaut : **conserver**.

---

### Task 5: GABARIT — Correctif d'un bloquant 🔴 (instancié par bloquant trouvé)

> Répéter ce gabarit pour chaque 🔴 validé au checkpoint Task 3. Un bloquant = une branche = une PR (ou groupe cohérent). Ne PAS exécuter tant que la liste n'est pas validée.

**Files:** (dépend du constat)
- Modify/Create: fichier(s) source ou migration `supabase/migrations/YYYYMMDD_fix_<slug>.sql`
- Test: `src/__tests__/<slug>.test.ts`

**Interfaces:**
- Consumes: le constat 🔴 (fichier:ligne + preuve) du rapport.

- [ ] **Step 1: Créer la branche**
```bash
git checkout master && git checkout -b fix/audit-<slug>
```

- [ ] **Step 2: Écrire le test qui échoue** (reproduit le bug ; pour RLS/DB → test de policy sous JWT `user_role` dans `rlsPolicies.test.ts` ; pour logique → test unitaire).

- [ ] **Step 3: Lancer le test → vérifier qu'il ÉCHOUE**
```bash
node node_modules/vitest/vitest.mjs run <path> 
```
Expected: FAIL reproduisant le constat.

- [ ] **Step 4: Implémenter le correctif minimal** (via heredoc/sed si /mnt/d ; migration idempotente : `DROP POLICY IF EXISTS`/`CREATE OR REPLACE`/`ON CONFLICT`).

- [ ] **Step 5: Gates verts**
```bash
node node_modules/typescript/bin/tsc -b
node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'
node node_modules/vite/bin/vite.js build
```
Expected: tsc exit 0, tests verts, build OK.

- [ ] **Step 6: Apply prod (si changement DB)** — backup d'abord :
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 "docker exec supabase_db_gsat pg_dump -U postgres postgres > /root/gsat_backup_pre_fix_<slug>_$(date +%Y%m%d-%H%M%S).sql"
cat supabase/migrations/YYYYMMDD_fix_<slug>.sql | ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -v ON_ERROR_STOP=1"
ssh … "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"NOTIFY pgrst, 'reload schema';\""
```
Puis **smoke prod réel** prouvant le fix (même sonde que Task 2, verdict maintenant CONFIRMÉ-corrigé).

- [ ] **Step 7: Commit + push + PR**
```bash
git add <paths explicites>
git commit -m "fix(audit): <constat> (bloquant go-live)"
git push origin fix/audit-<slug>
gh pr create --fill --base master
```

- [ ] **Step 8: Mettre à jour `AUDIT_GO_LIVE.md`** — marquer le 🔴 comme RÉSOLU (PR + preuve prod). Commit.

---

### Task 6: Synthèse finale + mémoire

- [ ] **Step 1:** Vérifier que tous les 🔴 sont RÉSOLUS ou explicitement différés (avec spec dédié référencé). Mettre à jour le verdict go/no-go de `AUDIT_GO_LIVE.md`.
- [ ] **Step 2:** Mettre à jour la mémoire projet (`project_gsat.md` + `MEMORY.md`) : audit go-live fait, bloquants traités, backlog majeurs/mineurs.
- [ ] **Step 3:** Commit final du rapport.

## Self-review (couverture spec)
- Axe 1/2/3/4 → Task 1 (analyse) + Task 2 (preuve) + Task 3 (rapport) : couverts.
- Preuve prod lecture seule → Task 2 + contrainte globale : couvert.
- Correctifs bloquants (TDD/gates/apply/PR) → Task 5 gabarit : couvert.
- Refonte différée → Task 3 Step 3 + Task 6 Step 1 : couvert.
- Classification sévérité / backlog → Task 3 structure : couvert.
- Hors périmètre (pas de restore, pas de load-test synthétique) → respecté (EXPLAIN statique en Task 2 Step 4).
