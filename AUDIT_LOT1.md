# Audit pré-go-live — Lot 1 (P1→P8)

**2026-08-05 · branche `feat/gsat-faritany` · base `aad1fcc..HEAD`.**
Méthode : lecture du diff + vérification empirique sous vrais JWT (psql,
`set local role authenticated` + `request.jwt.claims`, en transaction rollback)
sur Supabase local. Aucune correction appliquée — décisions à prendre ensuite.

**Verdict : aucun BLOQUANT. A1 (majeur) RÉSOLU, C1 (parité) RÉSOLU+PROUVÉ.
Audit COMPLÉTÉ exhaustivement (A/B/D) → aucun constat supplémentaire. 2 mineurs
documentés non bloquants (E1 migration one-shot, G1 couverture). Isolation
Faritany A≠B vérifiée et tient. Seul résidu : `responsable_region` non prouvé en
local (hiérarchie REGION non seedée) → à valider en staging.**

---

## Constats

### A1 — MAJEUR · `responsable_asn` exclu de l'écriture des scores → ✅ RÉSOLU
**Résolution (2026-08-05)** : CLAUDE.md attribue bien « saisie » à `responsable_asn`.
Ajout d'une policy additive `scores_write_resp_asn` (evaluation_scores, FOR ALL,
sa propre org + statut brouillon/en_cours). Vérifié sous JWT : (A) resp_asn écrit
sur sa propre éval en_cours = OK ; (B) resp_asn d'un AUTRE Faritany = bloqué
(isolation préservée) ; (C) éval validée = bloqué (statut guard). Changement
SQL-only (migration), tsc/tests inchangés.

<details><summary>Constat initial</summary>
La policy `scores_write` (`ALL`) autorise
`admin_global | responsable_osn | utilisateur_asn | evaluateur` — **pas
`responsable_asn`**. Or `CLAUDE.md` (table des rôles) dit que `responsable_asn`
fait « **saisie** + auto-validation ». Vérifié sous JWT : un `responsable_asn` ne
peut PAS écrire de score (RLS violation), même sur sa propre éval en_cours.
- **Repro** : JWT `role=responsable_asn, org_id=ANT` → `insert into
  evaluation_scores(...)` → `new row violates row-level security policy`.
- **Impact** : si le comité (responsable_asn) doit saisir, l'écran de saisie (P3)
  échoue à l'enregistrement pour lui. Si la saisie est réservée à `utilisateur_asn`
  (qui, lui, EST autorisé) et que `responsable_asn` ne fait qu'auto-valider des
  scores saisis par d'autres, c'est correct.
- **Nature** : policy PRÉ-EXISTANTE (pas dans mes ajouts Lot 1) ; le chantier a
  ajouté le rôle `responsable_asn` (policies `evals_*_resp_asn`) mais **pas** de
  droit d'écriture des scores pour lui.
- **Reco** : trancher le rôle de saisie. Si `responsable_asn` doit saisir →
  l'ajouter à `scores_write`. Sinon → corriger la description CLAUDE.md et
  s'assurer que l'UI de saisie n'est ouverte qu'aux rôles autorisés.
</details>

### E1 — MINEUR · migration non ré-applicable pour les policies
Les 15 `CREATE POLICY` de la migration (et les 40 de `rls_policies.sql`) n'ont
**aucun `DROP POLICY IF EXISTS`** → un ré-apply échoue (`policy already exists`,
prouvé sur `evals_update_revue`). Mes 2 ajouts (`evals_update_revue`,
`sysconfig_select_own`) suivent le même pattern one-shot ; ce n'est donc pas une
régression Lot 1, mais une propriété de tout le fichier.
- **Reco go-live** : appliquer la migration **exactement une fois** sur base
  fraîche (les `CREATE TABLE/COLUMN IF NOT EXISTS` couvrent la reprise partielle,
  mais pas les policies). Pour la rendre ré-entrante, préfixer chaque `CREATE
  POLICY` d'un `DROP POLICY IF EXISTS`.

### C1 — ✅ RÉSOLU + PROUVÉ · parité scoring machine-vérifiée
**Résolution (2026-08-05)** : cible PG du test rendue paramétrable
(`PGHOST/PGPORT/PGUSER/PGDATABASE`, défauts 5433/gsat conservés). Test exécuté
contre l'instance locale (`PGPORT=54322 PGDATABASE=postgres PGPASSWORD=postgres`)
→ **12/12 verts** : `scoring.ts` ≡ `fn_recalculate_scores` sur 12 tirages
aléatoires (socle + complet, N/A / non répondu / notes 0-3). Le trap n°1 de la
passation (scoring à deux endroits) est prouvé cohérent. À câbler tel quel dans un
job CI (le test reste exclu des runs par défaut).

<details><summary>Constat initial</summary>
`parite-sql.diff.test.ts` (scoring.ts ≡ `fn_recalculate_scores`) cible en dur
`psql -p 5433 -d gsat` ≠ instance locale (`54322/postgres`) → non exécutable ici
(il reste exclu des runs par défaut). L'import `ref_db` a été corrigé (P1) mais la
cible PG reste fausse.
- **Évidence de parité disponible** : spot-check P3 — passer un critère en N/A fait
  MONTER le score D01 20→25 via le trigger, conforme au calcul scoring.ts.
- **Reco** : aligner la cible PG du test (variable d'env) et l'exécuter dans un job
  CI dédié pour prouver la parité sur les 12 tirages aléatoires.
</details>

### G1 — MINEUR (info) · trous de couverture
Les tests ajoutés assertent un vrai comportement (pas tautologiques). Restent sans
test : comportement runtime P8 (#3 scroll de reprise, #5 dérivation de l'état
réseau), et l'orchestration `load()` de RevuePage / le câblage DashboardOsn. Non
bloquant ; à couvrir si l'on veut un filet plus serré.

---

## Vérifié OK (aucun défaut)

- **Isolation Faritany A≠B (règle de sécu clé)** : un `responsable_asn` de FIA-01
  voit **0** ligne des `dashboard_stats`, `evaluations`, `evaluation_scores`,
  `alertes` d'ANT-01. Écriture cross-org également bloquée (P4 + audit).
- **Correctifs RLS des tâches, re-confirmés** : `fn_moyenne_nationale` (agrégat
  national lisible par l'ASN, rien de sensible), `evals_update_revue` (verdict
  national), `sysconfig_select_own` (libellé niveau), vue ERP `security_invoker`.
- **Chemins de lecture de la saisie** : `responsable_asn` lit sa campagne, le
  référentiel (1) et les critères (76) → le contexte de saisie se charge.
- **Écriture de score par le rôle de saisie** : `utilisateur_asn` EST dans
  `scores_write` (statut brouillon/en_cours + même org) → la saisie fonctionne
  pour ce rôle.
- **Mappers** : `rowToStats` mappe bien `referentiel_version` (correctif P6) ; ses
  champs non mappés (`essentielsKoParOrg`, `indiceVigilance`, `nbAsnAvecEssentielKo`)
  ne sont utilisés par aucun composant Lot 1. Les autres `rowToX` portent les
  colonnes Faritany.
- **Route/nav** : `dashboard/faritany` et `admin/revue` atteignables via la Sidebar,
  RoleGuard cohérent route↔nav.
- **i18n** : toutes les clés référencées par les composants Lot 1 existent en `fr` ;
  le fallback mg→fr est volontaire (fichier mg partiel par design).
- **Items différés-staging** correctement tracés dans `PASSATION_LOT1.md` (upload PV
  storage, `recipientId` notification, réactivation `edge_runtime`).

## Complétion exhaustive A/B/D (2026-08-05) — aucun nouveau constat

La passe représentative a été complétée à la lettre du plan. Résultat : **rien de
neuf**, ce qui confirme que l'échantillonnage couvrait bien les classes à risque.

- **B (mappers)** — TOUS les mappers Lot 1 confrontés colonne↔type. Les champs
  optionnels utilisés par l'UI sont bien mappés (y compris en spread conditionnel :
  `detail`/`critereCode` (alerte), `code`/`parentId`/`paysId`/`regionCode`/`coordonnees`
  (org), `scoresAsn`/`nbAsn`/`tauxCompletionEval` (stats), `poids` (org). Les champs
  requis sont garantis par tsc. Seul drop historique = `rowToStats.referentiel_version`,
  déjà corrigé (P6). **Propre.**
- **A (matrice rôles)** — écriture de campagne cohérente (RLS `campagnes_insert` =
  `admin_global|responsable_region`, aligné sur `useCampagne.canManage`). `responsable_
  region` **non testable en local** (TEM sans parent REGION seedé) → policies de
  sous-arbre revues par lecture, à prouver en staging ou après seed de la hiérarchie
  OMMS→REGION. Isolation `responsable_asn` déjà prouvée. **Pas de nouveau bug.**
- **D (route/nav/i18n)** — aucun item de nav orphelin, aucun `navigate()` mort, toutes
  les clés i18n référencées présentes en fr. **Propre.**

## Hors périmètre (noté)
- Incohérence PRÉ-EXISTANTE : route `admin/cycles` RoleGuard=`[admin_global,
  responsable_osn]` vs Sidebar roles=`[admin_global, responsable_region]` (un
  `responsable_osn` voit-il l'item ? un `responsable_region` accède-t-il à la
  route ?). Mineur, non Lot 1.

## Prochaine étape
Trancher A1 (rôle de saisie) — seul point pouvant demander un correctif de policy
avant go-live. E1/C1 sont des ajustements go-live/CI ; G1 est optionnel.
