# Audit global GSAT — Pré-montée en charge / go-live élargi

- **Date** : 2026-08-30
- **Projet** : GSAT Digital V2 (React 19 / Vite / Supabase self-hosted, prod `gsat.tily-digital.com`)
- **But** : vérifier que le projet tient le passage à l'échelle nationale (33 Faritany + usage terrain réel)
- **Approche** : A — fan-out d'analyse statique (4 axes en parallèle) + preuves prod centralisées (lecture seule) + correction des bloquants
- **Livrable** : `AUDIT_GO_LIVE.md` (diagnostic + preuves reproductibles + plan priorisé) + PR de correctifs bloquants

## 1. Méthodologie (3 phases)

### Phase 1 — Fan-out analyse statique (parallèle, lecture seule)
4 sous-agents (Agent tool), un par axe. Chacun analyse `src/`, `supabase/`, config, migrations, et remonte des **constats candidats** structurés :
`{ axe, fichier:ligne, description du risque, scénario d'échec, sévérité présumée }`.
Aucun accès prod en phase 1. Sortie = liste de candidats à prouver.

### Phase 2 — Preuve prod centralisée (moi, lecture seule)
Je confirme ou réfute chaque candidat contre la **prod réelle**, en **lecture seule** :
- `psql` (via `ssh -i ~/.ssh/id_ed25519 root@76.13.37.209` → `docker exec -i supabase_db_gsat psql -U postgres -d postgres`) : état schéma (`\d`), policies (`pg_policies`), comptages/cohérence données.
- `curl` sous **vrais JWT** via kong (`127.0.0.1:54331`) : RLS live (isolation cross-Faritany), endpoints anon.
- `docker inspect`/`printenv` : edge functions, restart policy, SMTP GoTrue, secrets.
- `curl -I` HTTPS + nginx : exposition, SSL, routes.
Chaque constat retenu porte une **preuve reproductible** (commande + sortie observée).
**Règle de sécurité** : lecture seule stricte. Les seuls écrits tolérés = smoke RLS `INSERT` suivi d'un `DELETE` de cleanup immédiat (pattern déjà validé sur ce projet). Aucune mutation persistante hors correctifs approuvés.

### Phase 3 — Synthèse + correctifs bloquants
Rédaction de `AUDIT_GO_LIVE.md` : constats classés par sévérité, avec preuve et remédiation proposée.
Puis correction des **bloquants uniquement**, chacun selon les conventions du projet :
- TDD, gates `node node_modules/typescript/bin/tsc -b` + `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'` + `node node_modules/vite/bin/vite.js build`.
- Changement DB → migration idempotente appliquée en prod via `ssh … docker exec -i psql -v ON_ERROR_STOP=1`, backup préalable (`pg_dump`).
- Branche + PR par bloquant (ou groupe cohérent).
Majeurs / mineurs → backlog priorisé dans le rapport, non corrigés dans cette campagne.
**Garde-fou** : un bloquant nécessitant une vraie refonte est **différé à son propre spec** (l'audit ne devient pas un chantier de dev déguisé).

## 2. Les 4 axes et contrôles

### Axe 1 — Sécurité & isolation RLS
- Isolation multi-tenant : un `responsable_asn` d'un Faritany ne lit/écrit rien d'un autre (test croisé live sous JWT réels).
- Drift `role` vs `user_role` : re-scan des policies prod + hook `custom_access_token_hook` ; prouver qu'aucune policy « ferme-faux » ne subsiste (bug historique des 14 policies réconciliées à la main).
- Auth/secrets : JWT secret, ANON key, exposition `.env`/`functions/.env`, CORS des edge functions, `GOTRUE_MAILER_AUTOCONFIRM`, surface publique (endpoints joignables en anon).
- Storage `preuves` : les 3 policies `storage.objects` lisent `user_role` (pas `role`) ; isolation par path `foldername(name)[2]`=orgId.

### Axe 2 — Intégrité & robustesse données
- Cohérence prod : référentiels (`far_v1_0` actif, `v3_0` seedé), 33 Faritany + OSN parent + racine OMMS, 34 comptes auth, campagnes ; comptages et cohérence FK logiques (`referentiel_versions.parent_version` = TEXT non-FK, dégradation connue).
- Scoring : parité `src/services/…/scoring.ts` ↔ trigger `fn_recalculate_scores` (test de parité), cas `N/A` ≠ absent ≠ 0, échelle 0-100 (`score_dimension`, `score_global`).
- Contraintes/triggers : NOT NULL (`users`, `evaluation_scores.updated_by`), uniques, immutabilité audit (`fn_write_audit_log`).
- Backups : existence + fraîcheur des `pg_dump` sur le VPS ; restaurabilité théorique (pas de restore réel).

### Axe 3 — Performance & scale
- Requêtes lourdes / N+1 dans les services (dashboards, `indiceService` agrège toutes les campagnes `far_v1_0`), coût des vues (`v_erp_snapshot_courant`, `fn_moyenne_nationale`).
- Index DB : présence des index attendus (`idx_campagnes_statut_date`, `idx_campagnes_organisateur`) ; EXPLAIN sur les requêtes chaudes si accessible.
- Realtime : nombre de souscriptions par écran, comportement plausible à 33 ASN concurrents.
- Bundle : taille (`index-CvzaUPHs.js` ~477 kB brut), lazy-loading des routes, découpage vendor.

### Axe 4 — Résilience opérationnelle & infra
- Edge functions : restart policy (`unless-stopped`), santé `manage-user` / `chat-with-ai`.
- SMTP : état réel (inbucket vs Gmail — chantier D bloqué sur App Password) ; impact sur recovery mot de passe et notifications.
- Firewall hPanel Hostinger récurrent (bloque l'egress dev par intermittence) ; renouvellement SSL Let's Encrypt ; monitoring/alerting (existe-t-il ?).
- Cohérence repo↔prod : migrations `supabase/migrations/` = objets réellement appliqués en prod ? drift schéma résiduel.

## 3. Classification de sévérité

- 🔴 **Bloquant** — casse l'isolation multi-tenant, corruption/perte de données, ou empêche le workflow go-live. → corrigé dans cette campagne.
- 🟠 **Majeur** — risque réel à l'échelle mais contournable. → backlog priorisé.
- 🟡 **Mineur** — dette technique / amélioration. → backlog.

## 4. Hors périmètre
- Restore réel d'un backup (destructif).
- Refactoring non lié aux constats.
- Correction des majeurs/mineurs (backlog, campagnes ultérieures).
- Tests de charge synthétiques réels (pas d'outil de load-testing déployé ; analyse de scalabilité = statique + EXPLAIN).

## 5. Critères de succès
- Les 4 axes couverts, chaque constat retenu prouvé par une commande/sortie reproductible.
- Constats classés par sévérité dans `AUDIT_GO_LIVE.md` avec remédiation.
- Tous les bloquants corrigés (gates verts + apply prod + PR) ou explicitement différés à un spec dédié avec justification.
- Décision go/no-go go-live élargi étayée par le rapport.
