# Pilote go-live bout-en-bout GSAT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prouver en prod le flow bout-en-bout de GSAT-Faritany (login → saisie scores → trigger → dashboard_stats → Indice/comparaison/écarts rendus) en seedant un jeu de données pilote réaliste conservé.

**Architecture:** Seed direct psql pour la campagne DÉMO far_v1_0 + 3 évals Faritany ; écriture des scores via PostgREST sous **vrais JWT** (preuve du chemin RLS) exécutée depuis le VPS (curl 127.0.0.1:54331 pour contourner le firewall et atteindre kong) ; vérif backend en psql ; vérif frontend manuelle par l'utilisateur ; runbook comme livrable durable. **Données conservées** (pas de cleanup), teardown documenté seulement.

**Tech Stack:** Supabase self-hosted (PostgREST/kong 54331, GoTrue), PostgreSQL (`supabase_db_gsat`), SSH natif `id_ed25519`, curl, jq.

## Global Constraints

- Repo : `/mnt/d/Mes Documents/GSAT/gsat-v2` — ⚠️ Edit/Write revertés par OneDrive → éditer via heredoc/sed Bash, commiter par chemin explicite.
- VPS : `ssh -i ~/.ssh/id_ed25519 root@76.13.37.209`, **WARP off**. Firewall hPanel bloque parfois l'egress dev (`153.67.85.x/24`) → **exécuter les appels API SUR le VPS** (`ssh … curl 127.0.0.1:54331/…`).
- DB prod : `docker exec -i supabase_db_gsat psql -U postgres -d postgres`.
- Version far = `far_v1_0`, version nationale = `v3_0` (constantes `VERSION_FAR`/`VERSION_NAT` d'indiceService).
- `evaluation_scores` : note SMALLINT CHECK 0..3 (NULL autorisé), UNIQUE(eval_id,critere_code), `updated_by` NOT NULL. note 0-3=noté, ligne NULL=N/A, absence de ligne=absent.
- Campagne pilote nommée exactement `DÉMO — pilote go-live`.
- Aucune écriture prod avant validation user de la matrice de scores (Task 2).

---

## Task 0 : Reconnaissance prod (read-only, gate faisabilité)

**Files:**
- Modify (append recon): `docs/superpowers/runbooks/2026-09-05-pilote-go-live-e2e.md` (créé ici)

**Interfaces:**
- Produces (valeurs capturées, réutilisées par toutes les tâches) : `ADMIN_UID`, `OSN_ORG_ID`, `FAR_ORG_IDS[3]` + leurs `code`/`nom`, `FAR_EMAILS[3]`, `V3_EVAL_ID` (=`d3000000-0000-4000-8000-0000000e0001` à confirmer), `V3_CAMP_ID`, `ANON_KEY`, décision writer v3_0 (`admin_global` OU nouveau `responsable_osn`).

- [ ] **Step 1 : Vérifier joignabilité + baseline**

Run:
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -Atc \
 \"select (select count(*) from evaluation_scores) scores, (select count(*) from evaluations) evals, (select count(*) from campagnes where referentiel_version='far_v1_0') far_camps;\""
```
Expected : `0|1|0` (baseline vierge : aucun score, seule l'éval v3_0, aucune campagne far). Si far_camps>0 ou scores>0 : STOP, la baseline a changé → réévaluer avec l'utilisateur avant d'écrire.

- [ ] **Step 2 : Résoudre les IDs (admin, OSN, 3 Faritany même province, éval v3_0)**

Run:
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \
 \"select id, role, email from users where role='admin_global';
   select id, nom, type, code, parent_id from organisations where type='OSN';
   select id, nom, code, parent_id from organisations where type='ASN' and code like 'ANT%' order by code limit 3;
   select id, statut, org_id, campagne_id, type from evaluations;\""
```
Expected : 1 admin_global (→ `ADMIN_UID`) ; l'OSN TEM (→ `OSN_ORG_ID`, doit == `parent_id` des ASN) ; 3 Faritany ANT-* (→ `FAR_ORG_IDS`, `code`, `nom`) ; l'éval v3_0 `en_cours` (→ `V3_EVAL_ID`, `V3_CAMP_ID`). Noter les valeurs dans le runbook.
Note : si moins de 3 codes `ANT%`, prendre les 3 premiers d'un autre préfixe partagé (`select code from organisations where type='ASN' order by code`).

- [ ] **Step 3 : Récupérer ANON_KEY + emails/mdp des 3 responsable_asn**

Run:
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec supabase_kong_gsat printenv 2>/dev/null | grep -i anon; \
  grep -iE 'anon' /var/www/gsat/supabase/.env 2>/dev/null; \
  echo '--- comptes ---'; grep -iE 'ant\.0[1-3]|ADMIN' /root/gsat_faritany_accounts.md"
```
Expected : la clé ANON (→ `ANON_KEY`) ; les 3 lignes `code|email|password|uid` des Faritany choisis (→ `FAR_EMAILS`, mots de passe). Si l'ANON n'est pas là, la lire depuis `docker exec supabase_auth_gsat printenv | grep ANON` ou le `config.toml`/`.env.local` du repo.

- [ ] **Step 4 : Trancher le writer v3_0 (admin peut-il écrire un score sur l'éval OSN ?)**

Run (simulation RLS en psql, sans écrire) :
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \
 \"select polname, pg_get_expr(polqual,polrelid) using_expr, pg_get_expr(polwithcheck,polrelid) check_expr
   from pg_policy p join pg_class c on c.oid=p.polrelid
   where c.relname='evaluation_scores' and pg_get_expr(polwithcheck,polrelid) is not null;\""
```
Expected : lister les policies INSERT/UPDATE de `evaluation_scores`. **Décision** : si une policy autorise `admin_global` (claim `user_role='admin_global'`) à écrire sans borne d'org → writer v3_0 = **admin_global** (`ADMIN_UID`). Sinon → créer un `responsable_osn` pour `OSN_ORG_ID` via `manage-user` (documenté en Task 4, branche B). Noter la décision dans le runbook.

- [ ] **Step 5 : Consigner la recon dans le runbook**

Créer le runbook et y coller toutes les valeurs capturées :
```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2"
cat > docs/superpowers/runbooks/2026-09-05-pilote-go-live-e2e.md <<'RB'
# Runbook — Pilote go-live bout-en-bout GSAT (2026-09-05)

## 0. Recon (valeurs capturées)
- ADMIN_UID      = <à remplir Step 2>
- OSN_ORG_ID     = <…>
- FAR_ORG_IDS    = [<code1>=<uuid1>, <code2>=<uuid2>, <code3>=<uuid3>]
- FAR_EMAILS     = [<email1>, <email2>, <email3>]
- V3_EVAL_ID     = <…>   V3_CAMP_ID = <…>
- ANON_KEY       = <…>
- WRITER v3_0    = admin_global | responsable_osn(<uid>)
- Baseline       = scores=0, evals=1, far_camps=0 (Step 1)
RB
git add docs/superpowers/runbooks/2026-09-05-pilote-go-live-e2e.md
git commit -m "docs(runbook): recon pilote go-live e2e"
```
Expected : commit OK. **GATE** : ne pas continuer si un ID manque.

---

## Task 1 : Backup + campagne DÉMO far_v1_0 + 3 évals Faritany

**Files:**
- Create : `scripts/pilote/seed_pilote_campagne.sql` (SQL de seed, versionné)

**Interfaces:**
- Consumes : `ADMIN_UID`, `OSN_ORG_ID`, `FAR_ORG_IDS`, valeurs Task 0.
- Produces : `CAMP_ID` (campagne DÉMO), `FAR_EVAL_IDS[3]` (une éval par Faritany, statut `en_cours`).

- [ ] **Step 1 : pg_dump de sécurité (avant toute écriture)**

Run:
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec supabase_db_gsat pg_dump -U postgres -d postgres > /root/gsat_backup_pre_pilote_$(date +%Y%m%d-%H%M%S).sql && ls -la /root/gsat_backup_pre_pilote_*.sql | tail -1"
```
Expected : fichier `.sql` créé, taille ~1–2 Mo.

- [ ] **Step 2 : Écrire le SQL de seed (campagne ouverte + 3 évals)**

Remplacer les `<…>` par les valeurs Task 0 avant exécution.
```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && mkdir -p scripts/pilote && cat > scripts/pilote/seed_pilote_campagne.sql <<'SQL'
-- Pilote go-live : campagne DÉMO far_v1_0 + 3 évals Faritany (conservées).
-- IDs fixes pour idempotence/traçabilité.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO campagnes (id, organisateur_id, referentiel_version, nom, description,
                       date_ouverture, date_fermeture, statut, mode, perimetre, created_by)
VALUES ('d5000000-0000-4000-8000-0000000c0001',
        '<ADMIN_UID>', 'far_v1_0', 'DÉMO — pilote go-live',
        'Jeu de démonstration conservé (preuve du flow bout-en-bout).',
        NOW() - INTERVAL '1 day', NOW() + INTERVAL '365 days',
        'ouverte', 'socle',
        ARRAY['<FAR_ORG1>','<FAR_ORG2>','<FAR_ORG3>']::uuid[],
        '<ADMIN_UID>')
ON CONFLICT (id) DO NOTHING;

INSERT INTO evaluations (id, campagne_id, org_id, type, statut, created_by) VALUES
 ('d5000000-0000-4000-8000-0000000e0001','d5000000-0000-4000-8000-0000000c0001','<FAR_ORG1>','auto','en_cours','<ADMIN_UID>'),
 ('d5000000-0000-4000-8000-0000000e0002','d5000000-0000-4000-8000-0000000c0001','<FAR_ORG2>','auto','en_cours','<ADMIN_UID>'),
 ('d5000000-0000-4000-8000-0000000e0003','d5000000-0000-4000-8000-0000000c0001','<FAR_ORG3>','auto','en_cours','<ADMIN_UID>')
ON CONFLICT (org_id, campagne_id) DO NOTHING;

COMMIT;
SELECT count(*) AS camps FROM campagnes WHERE id='d5000000-0000-4000-8000-0000000c0001';
SELECT id, org_id, statut FROM evaluations WHERE campagne_id='d5000000-0000-4000-8000-0000000c0001' ORDER BY id;
SQL
echo "written"
```
Expected : fichier écrit. (⚠️ vérifier que `mode` existe bien sur `campagnes` — ajouté par la migration Faritany ; c'est le cas en prod.)

- [ ] **Step 3 : Appliquer le seed en prod**

Run:
```bash
cat "/mnt/d/Mes Documents/GSAT/gsat-v2/scripts/pilote/seed_pilote_campagne.sql" \
 | ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -v ON_ERROR_STOP=1"
```
Expected : `camps = 1` ; 3 lignes d'évals `en_cours` (→ `FAR_EVAL_IDS` = `…e0001/e0002/e0003`). `CAMP_ID = d5000000-…-0c0001`.

- [ ] **Step 4 : Recharger le cache PostgREST + commit du script**

Run:
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"NOTIFY pgrst, 'reload schema';\""
cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && git add scripts/pilote/seed_pilote_campagne.sql && git commit -m "chore(pilote): seed campagne DÉMO + 3 évals Faritany"
```
Expected : NOTIFY OK, commit OK.

---

## Task 2 : Matrice de scores (choix des critères + mapping far→v3_0) — GATE user

**Files:**
- Create : `scripts/pilote/matrice_scores.json` (source de vérité de la saisie)

**Interfaces:**
- Consumes : `src/data/far_v1_0.json` (dimensions/critères/sourceCodes/essentiel/socle).
- Produces : `matrice_scores.json` = pour chaque Faritany, liste `{critereCode, note|null|absent}` ; + liste des scores nationaux `{v3Code, note}`.

- [ ] **Step 1 : Générer une matrice représentative depuis far_v1_0.json**

Run:
```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && node -e '
const far=require("./src/data/far_v1_0.json");
const socle=[];
for(const d of far.dimensions) for(const c of d.criteres) if(c.socle&&c.actif) socle.push({dim:d.code,code:c.code,ess:!!c.essentiel,src:(c.sourceCodes||[])});
// ~12 critères couvrant >=4 dimensions, incluant essentiels + critères ayant un sourceCode (pour écarts)
const dims=[...new Set(socle.map(s=>s.dim))].slice(0,5);
const pick=[]; for(const dm of dims){ const inDim=socle.filter(s=>s.dim===dm&&s.src.length); pick.push(...inDim.slice(0,3)); }
const chosen=pick.slice(0,12);
// notes variées par Faritany (F1 fort, F2 moyen, F3 faible => quartile bas visible)
const rows=chosen.map((c,i)=>({dim:c.dim,code:c.code,ess:c.ess,src:c.src,
  F1:(i%4===0?"NA":3-(i%2)), F2:(i%3), F3:(i%5===0?"ABSENT":Math.max(0,3-(i%4)))}));
const natCodes=[...new Set(chosen.flatMap(c=>c.src))].map(code=>({v3Code:code, note:2}));
require("fs").writeFileSync("scripts/pilote/matrice_scores.json",JSON.stringify({faritany:rows,national:natCodes},null,2));
console.log("critères:",rows.length,"dims:",[...new Set(rows.map(r=>r.dim))].join(","));
console.log("codes nationaux v3_0:",natCodes.map(n=>n.v3Code).join(","));
console.log(JSON.stringify(rows.slice(0,4),null,1));
'
```
Expected : ~12 critères sur ≥4 dimensions ; F1 contient ≥1 `NA`, F3 contient ≥1 `ABSENT` ; codes nationaux listés. Fichier écrit.

- [ ] **Step 2 : GATE — faire valider la matrice par l'utilisateur**

Afficher `scripts/pilote/matrice_scores.json` à l'utilisateur (données visibles en prod, conservées). Attendre son OK ou ses ajustements de notes. Ne PAS écrire en prod avant validation.
Expected : accord utilisateur.

- [ ] **Step 3 : Commit de la matrice**

Run:
```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && git add scripts/pilote/matrice_scores.json && git commit -m "chore(pilote): matrice de scores validée"
```
Expected : commit OK.

---

## Task 3 : Écrire les scores Faritany via API sous vrais JWT (preuve RLS)

**Files:**
- Create : `scripts/pilote/ecrire_scores.sh` (exécuté SUR le VPS)

**Interfaces:**
- Consumes : `ANON_KEY`, `FAR_EMAILS`+mdp, `FAR_EVAL_IDS`, `matrice_scores.json`.
- Produces : lignes `evaluation_scores` pour les 3 évals Faritany.

- [ ] **Step 1 : Écrire le script d'écriture (login GoTrue → upsert PostgREST)**

```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && cat > scripts/pilote/ecrire_scores.sh <<'SH'
#!/usr/bin/env bash
# À exécuter SUR le VPS. Args: <ANON_KEY> <EMAIL> <PASSWORD> <EVAL_ID> <UID> <CODES_CSV>
# CODES_CSV = "F101:3,F102:NA,F103:ABSENT,..." (NA => note null ; ABSENT => on n'écrit rien)
set -euo pipefail
ANON="$1"; EMAIL="$2"; PW="$3"; EVAL="$4"; UID="$5"; CODES="$6"
BASE="http://127.0.0.1:54331"
JWT=$(curl -s "$BASE/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}" | jq -r .access_token)
[ "$JWT" != "null" ] && [ -n "$JWT" ] || { echo "LOGIN FAIL $EMAIL"; exit 1; }
IFS=',' read -ra PAIRS <<< "$CODES"
for p in "${PAIRS[@]}"; do
  code="${p%%:*}"; val="${p##*:}"
  [ "$val" = "ABSENT" ] && { echo "skip(absent) $code"; continue; }
  if [ "$val" = "NA" ]; then note='null'; else note="$val"; fi
  http=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/rest/v1/evaluation_scores" \
     -H "apikey: $ANON" -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
     -H "Prefer: resolution=merge-duplicates" \
     -d "{\"eval_id\":\"$EVAL\",\"critere_code\":\"$code\",\"note\":$note,\"updated_by\":\"$UID\"}")
  echo "$code -> $http"
done
SH
echo "written"
```
Expected : fichier écrit. Note : `Prefer: resolution=merge-duplicates` = upsert sur la contrainte UNIQUE(eval_id,critere_code), miroir de `writeScore`.

- [ ] **Step 2 : Copier le script + la matrice sur le VPS**

Run:
```bash
scp -i ~/.ssh/id_ed25519 "/mnt/d/Mes Documents/GSAT/gsat-v2/scripts/pilote/ecrire_scores.sh" \
    "/mnt/d/Mes Documents/GSAT/gsat-v2/scripts/pilote/matrice_scores.json" root@76.13.37.209:/root/pilote/
```
(Créer `/root/pilote` au besoin : `ssh … mkdir -p /root/pilote`.)
Expected : 2 fichiers copiés.

- [ ] **Step 3 : Exécuter pour les 3 Faritany**

Construire le CSV par Faritany depuis la matrice (colonnes F1/F2/F3) puis lancer, ex. Faritany 1 :
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "bash /root/pilote/ecrire_scores.sh '<ANON_KEY>' '<FAR_EMAIL1>' '<PW1>' 'd5000000-0000-4000-8000-0000000e0001' '<FAR_UID1>' '$(jq -r '[.faritany[]|.code+\":\"+(.F1|tostring)]|join(\",\")' /root/pilote/matrice_scores.json)'"
```
Répéter avec `.F2`/`e0002` et `.F3`/`e0003`.
Expected : chaque code → `201` (ou `200`) ; lignes `ABSENT` → `skip(absent)` ; `NA` → `201` avec note null.

- [ ] **Step 4 : (contrôle isolation, optionnel mais recommandé)**

Tenter d'écrire un score du Faritany 1 avec le JWT du Faritany 2 (doit être rejeté) :
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "bash /root/pilote/ecrire_scores.sh '<ANON_KEY>' '<FAR_EMAIL2>' '<PW2>' 'd5000000-0000-4000-8000-0000000e0001' '<FAR_UID2>' 'F101:1'"
```
Expected : `F101 -> 40x` (RLS bloque le cross-org). Prouve l'isolation.

- [ ] **Step 5 : Commit du script**

Run:
```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && git add scripts/pilote/ecrire_scores.sh && git commit -m "chore(pilote): script écriture scores API sous vrai JWT"
```
Expected : commit OK.

---

## Task 4 : Écrire les scores nationaux v3_0

**Files:** (réutilise `scripts/pilote/ecrire_scores.sh`)

**Interfaces:**
- Consumes : décision writer Task 0 (`admin_global` ou `responsable_osn`), `V3_EVAL_ID`, `matrice_scores.json.national`.
- Produces : lignes `evaluation_scores` sur l'éval v3_0.

- [ ] **Step 1 : Obtenir un JWT du writer v3_0**

Branche A (admin_global autorisé, Task 0 Step 4) : login `admin@gsat`… (mdp dans `/root/gsat_faritany_accounts.md` ligne `ADMIN`).
Branche B (créer responsable_osn) : via `manage-user` avec token admin, role=`responsable_osn`, orgId=`OSN_ORG_ID` ; récupérer email/mdp/uid. (Procédure `manage-user` identique à la création des 33 comptes, cf. mémoire projet.)
Expected : email/mdp/uid du writer disponibles.

- [ ] **Step 2 : Écrire les scores nationaux v3_0**

CSV national depuis la matrice (`note:2` par défaut) :
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "bash /root/pilote/ecrire_scores.sh '<ANON_KEY>' '<WRITER_EMAIL>' '<WRITER_PW>' '<V3_EVAL_ID>' '<WRITER_UID>' '$(jq -r '[.national[]|.v3Code+\":\"+(.note|tostring)]|join(\",\")' /root/pilote/matrice_scores.json)'"
```
Expected : chaque code v3_0 → `201`/`200`.

- [ ] **Step 3 : Vérifier l'écriture v3_0**

Run:
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -Atc \
 \"select count(*) from evaluation_scores where eval_id='<V3_EVAL_ID>';\""
```
Expected : count == nombre de codes nationaux de la matrice (>0).

---

## Task 5 : Vérif backend (trigger → dashboard_stats)

**Files:** aucun (assertions psql). Consigner les sorties dans le runbook.

- [ ] **Step 1 : Scores présents sur les 3 évals Faritany**

Run:
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \
 \"select eval_id, count(*) filter (where note is not null) notes, count(*) filter (where note is null) na, count(*) total
   from evaluation_scores where eval_id in
   ('d5000000-0000-4000-8000-0000000e0001','d5000000-0000-4000-8000-0000000e0002','d5000000-0000-4000-8000-0000000e0003')
   group by eval_id order by eval_id;\""
```
Expected : 3 lignes ; chaque éval a des `notes`>0 ; au moins une éval a `na`>0 (le N/A) ; `total` < nb critères écrits (car ABSENT non écrit).

- [ ] **Step 2 : Trigger → dashboard_stats peuplé en 0–100**

Run:
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \
 \"select ds.org_id, ds.referentiel_version, ds.score_global, jsonb_object_keys(ds.score_par_dimension) kd
   from dashboard_stats ds where ds.referentiel_version='far_v1_0' limit 20;\""
```
Expected : 3 org_id (les Faritany) ; `referentiel_version='far_v1_0'` ; `score_global` entre 0 et 100 (≠ 0–3) ; clés de dimensions présentes. Les scores diffèrent entre F1/F2/F3 (notes variées) → quartile bas exploitable.
(Si `dashboard_stats` n'a pas la colonne `referentiel_version`, adapter : `select * from dashboard_stats where org_id in (…)`.)

- [ ] **Step 3 : Ligne nationale v3_0 exploitable par indiceService**

Run:
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
 "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \
 \"select e.id, e.statut, o.type from evaluations e join organisations o on o.id=e.org_id
   where e.id='<V3_EVAL_ID>';
   select critere_code, note from evaluation_scores where eval_id='<V3_EVAL_ID>' order by critere_code;\""
```
Expected : éval v3_0 rattachée à l'OSN (`type='OSN'`), statut `en_cours` (sera prise comme note nationale) ; scores nationaux listés. Les codes ici == `sourceCodes` des critères far scorés → écarts calculables.

---

## Task 6 : Vérif frontend (utilisateur, navigateur)

**Files:** aucun. L'utilisateur exécute ; on consigne le résultat.

- [ ] **Step 1 : Fournir URLs + checklist à l'utilisateur**

L'utilisateur ouvre `https://gsat.tily-digital.com`, se connecte en `admin_global` (ou `responsable_osn`/`responsable_region`).
Checklist :
1. `/#/dashboard/indice` : table nationale peuplée ; **comparaison Faritany groupée par province** ; groupe avec Faritany à surveiller **auto-ouvert** ; **quartile bas surligné** ; **colonne écarts peuplée** (pas « — »).
2. Bouton export **PDF** du rapport Indice : PDF téléchargé, section nationale + comparaison en page paysage.
3. `/#/dashboard/faritany` (ou login `responsable_asn` d'un des 3 Faritany) : KPI/radar/alertes cohérents.
Expected : l'utilisateur confirme (captures si possible). Consigner OK/anomalies dans le runbook.

- [ ] **Step 2 : (si écarts = « — » ou comparaison vide) diagnostic**

Vérifier : (a) les 3 évals far ont ≥1 score (Task 5 Step 1) ; (b) l'éval v3_0 a des scores dont les codes == sourceCodes des critères far scorés (Task 5 Step 3) ; (c) `parent_id` des Faritany == org de l'éval v3_0 (osnOrgIds). Corriger la matrice si le mapping ne recouvre pas (rejouer Task 3/4 sur les codes manquants).
Expected : après correction, écarts affichés.

---

## Task 7 : Finaliser le runbook (livrable) + teardown documenté

**Files:**
- Modify : `docs/superpowers/runbooks/2026-09-05-pilote-go-live-e2e.md`

- [ ] **Step 1 : Compléter le runbook**

Ajouter au runbook : commandes exactes utilisées, matrice finale, sorties de vérif backend (Task 5), résultat de la checklist frontend (Task 6), et la section teardown ci-dessous.

- [ ] **Step 2 : Documenter le teardown (NON exécuté — données conservées)**

Ajouter au runbook :
```sql
-- TEARDOWN (à n'exécuter QUE si l'on veut retirer le pilote). pg_dump d'abord.
-- Retire scores v3_0 pilotes (garder l'éval vierge pour TEM) :
DELETE FROM evaluation_scores WHERE eval_id='<V3_EVAL_ID>';
-- Retire toute la campagne DÉMO (cascade scores via FK ON DELETE CASCADE sur evaluation_scores) :
DELETE FROM evaluations WHERE campagne_id='d5000000-0000-4000-8000-0000000c0001';
DELETE FROM campagnes  WHERE id='d5000000-0000-4000-8000-0000000c0001';
DELETE FROM dashboard_stats WHERE org_id IN ('<FAR_ORG1>','<FAR_ORG2>','<FAR_ORG3>') AND referentiel_version='far_v1_0';
-- Attendu post-teardown : scores=0, evals=1, far_camps=0 (retour baseline).
```

- [ ] **Step 3 : Commit final**

Run:
```bash
cd "/mnt/d/Mes Documents/GSAT/gsat-v2" && git add docs/superpowers/runbooks/2026-09-05-pilote-go-live-e2e.md && git commit -m "docs(runbook): pilote go-live e2e complet + teardown documenté"
```
Expected : commit OK.

---

## Notes de vérification (self-review)
- Écriture prod gatée par validation user (Task 2 Step 2) et par recon read-only (Task 0).
- Firewall contourné en exécutant les appels API sur le VPS (kong 127.0.0.1:54331).
- `mode` sur campagnes, `referentiel_version` sur dashboard_stats : à confirmer live (fallbacks notés).
- Écarts dépendent du recouvrement far.sourceCodes ⊂ codes scorés v3_0 (Task 6 Step 2 = filet).
