# GSAT-Faritany — Passation Lot 1 (P1→P8)

**État au 2026-08-05.** Branche `feat/gsat-faritany`. Lot 1 **terminé et vérifié en
local** : `tsc --noEmit` = 0, **260 tests verts**, **build de production OK**
(`vite build`). ⚠️ **Vérifié sur Supabase LOCAL, jamais poussé, jamais déployé.**

## Ce qui est fait

| Tâche | Objet | Commits |
|---|---|---|
| P1 | Balayage tsc après refonte API 4 août | `0a3c38d` |
| 0.3 | Bootstrap base + migration + régen types → tsc=0 | `95fdbf5`, `634e5c7` |
| P2 | Mode socle/complet + sélecteur référentiel/périmètre | `4e5b205`, `7d992bd` |
| P3 | Écran de saisie fini (mode-aware, badge extension, ERP) | `3b6f587`, `07cc16a`, `6f9bbb7` |
| P6 | Tableau de bord Faritany (5 bandeaux) | `d61f9d3`, `9c0af48` |
| P4 | Écran d'auto-validation | `d82f79a`, `1568903` |
| P5 | Revue nationale | `e7a008c`, `6236cba` |
| P7 | Écran national → 33 lignes | `961d2f8`, `e624cad` |
| P8 | 5 mesures du 100 % en ligne | `f3d61b3` |

## 1. À APPLIQUER EN PROD, dans l'ordre (le local part d'une base vide)

`supabase start` neuf = base VIDE. L'ordre de bootstrap est :

1. **Base** : `psql "$DB" -f supabase/schema.sql` → `rls_policies.sql` →
   `hook_custom_access_token.sql` → `trigger_on_score_write.sql`.
2. **Données de base** : au moins l'OSN `code='TEM' type='OSN'` (prérequis du seed
   des 33 Faritany). ⚠️ **Il n'existe PAS de seed d'org de base dans le repo** —
   à créer, ou la prod TEM l'a déjà.
3. **Migration Faritany** : `supabase/migrations/20260804_faritany.sql`. Elle
   contient désormais, EN PLUS de l'original, **4 objets ajoutés pendant le Lot 1
   qui DOIVENT partir en prod** :
   - `ALTER VIEW v_erp_snapshot_courant SET (security_invoker = on)` — sinon la vue
     ERP contourne la RLS (fuite inter-Faritany). [P3]
   - `fn_moyenne_nationale(uuid)` SECURITY DEFINER — la moyenne du dashboard Faritany
     (la RLS interdit à une ASN de lire la ligne dashboard_stats de son OSN). [P6]
   - policy `evals_update_revue` — sans elle le verdict de revue nationale
     (validee → cloturee/en_cours) est rejeté par RLS. [P5]
   - policy `sysconfig_select_own` — sans elle un responsable_osn ne lit pas son
     `libelle_niveau_local` (label du tableau national retombe en i18n). [P7]
4. **Types** : `supabase gen types typescript --db-url "$DB" > src/types/supabase.generated.ts`.
5. **Seeds** : `scripts/setup_base_gsat_faritany.sh` (référentiel far_v1_0 = 76
   critères, 33 Faritany). Nécessite `SERVICE_ROLE_KEY` + `SUPABASE_URL`.

Toutes les vérifs « fait quand » ont été faites sous **vrais JWT** (isolation
Faritany A≠B, verdicts, garde PV/motif). Détails dans les messages de commit.

## 2. NON vérifiable en local → À VALIDER EN STAGING

- **Upload du PV de comité (P4)** : un `supabase start` neuf n'a **ni le bucket
  `preuves` ni de policy `storage.objects`**. Le chemin d'upload a été aligné sur
  `uploadPreuve` pour hériter de la même RLS Storage, mais le flux réel (upload +
  `pvUploaded` → validation) n'a jamais tourné. À tester sur staging.
- **Notification « validée avec essentiels KO » au national (P4)** : `recipientId`
  non résolu (TODO P5) → sans destinataire, `autoValiderEvaluation` n'émet pas la
  notification. Résoudre le relecteur OSN destinataire.
- **Mesures runtime P8** : scroll de reprise (#3) et indicateur réseau (#5) sont
  du comportement client, testés au niveau logique/smoke seulement.

## 3. Environnement / CI

- **`.bin` cassés sur /mnt/d** : NE PAS lancer `npm run build`/`npm test` (résout
  `.bin/tsc` cassé). Utiliser `node node_modules/typescript/bin/tsc --noEmit -p
  tsconfig.app.json`, `node node_modules/vitest/vitest.mjs run --exclude
  '**/*.diff.test.ts'`, `node node_modules/vite/bin/vite.js build`.
- **Suite ~260 tests, machine LENTE** (timeouts >120 s observés) → **CI a besoin
  d'un timeout généreux** ; un run lent ≠ un échec.
- `parite-sql.diff.test.ts` reste exclu (job PostgreSQL dédié).
- Config locale : `supabase/config.toml` a `edge_runtime = false` (healthcheck
  502) → **le RÉACTIVER en staging** pour tester l'auth à rôles (manage-user pose
  les claims JWT).

## 4. Git

⚠️ **Dépôt git SANS REMOTE, jamais poussé.** Tout le Lot 1 vit sur la branche
locale `feat/gsat-faritany`. Créer un remote + `git push` avant toute PR/déploiement.

## Reste (hors Lot 1)

L2 (import CSV → erp_snapshots), L3 (détection incohérence note↔ERP + moteur de
règles d'alertes), L4 (Indice de Déploiement + carte 33 Faritany). Voir
`docs/GSAT-Faritany_Note-de-conception.md`.
