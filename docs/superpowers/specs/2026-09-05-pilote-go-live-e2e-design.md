# Design — Pilote go-live bout-en-bout GSAT (preuve du flow en prod)

- **Date** : 2026-09-05
- **Statut** : proposé (en attente de revue user)
- **Type** : chantier vérification / go-live réel
- **Approche retenue** : Approche 1 — pilote en PROD, seed via API sous vrais JWT + spot-check UI manuel
- **Décision données** : 3 Faritany + auto-éval OSN v3_0, **données conservées** (démo/seed, aucun cleanup exécuté)

## 1. Contexte & objectif

Le backend GSAT-Faritany est monté en prod (référentiel `far_v1_0` actif, 33 comptes
`responsable_asn`, seed OSN v3_0 appliqué), mais **aucune évaluation terrain n'a jamais
été saisie** (`scores=0`, `evals=1` = le seul scaffolding OSN v3_0 `en_cours`). Conséquence :
les features livrées — Indice de Déploiement, comparaison Faritany (Chantier A), écarts v3_0
(Chantier C) — **n'ont jamais été vérifiées en runtime avec de vraies données**.

Le flow a deux moitiés au niveau de preuve inégal :

| Moitié | État |
|---|---|
| Backend : login → écrit scores → trigger `fn_recalculate_scores` → `dashboard_stats` | Déjà prouvé en prod via smoke API (POST sous JWT `ant.01` → 201) |
| Frontend : `dashboard_stats` → page Indice → comparaison Faritany → écarts v3_0 rendus | **Jamais vérifié avec de vraies données** |

**Objectif** : prouver le flow bout-en-bout en prod, en particulier la moitié frontend
(le rendu), sans dépendre de la saisie terrain TEM.

## 2. Approche

Pilote en PROD :
1. Seed d'un jeu de données pilote réaliste (campagne + évals + scores) — écriture des scores
   via l'API PostgREST sous **vrais JWT** pour prouver le chemin RLS d'écriture.
2. Vérif backend en psql (trigger → `dashboard_stats`).
3. Vérif frontend par l'utilisateur dans son navigateur (la seule partie qui exige de vrais yeux).
4. **Données conservées** comme jeu de démonstration ; teardown documenté mais non exécuté.

Alternatives écartées :
- *Pilote local automatisé (Playwright)* : zéro pollution prod et reproductible, mais ne prouve
  pas littéralement la prod et impose de construire une infra E2E inexistante dans le repo.
- *Pilote prod tout-manuel* : effort maximal pour l'utilisateur, rien de réutilisable.

## 3. Jeu de données pilote (S1)

- **1 campagne `far_v1_0` jetable/démo**, nommée explicitement `DÉMO — pilote go-live`,
  périmètre = **3 Faritany d'une même province** (exerce le regroupement par province et le
  quartile bas de la comparaison). Codes exacts à résoudre en step 0 (ex. 3 premiers `ANT-*`).
- Sur chaque Faritany : **sous-ensemble représentatif** de critères (pas les 76), couvrant
  plusieurs dimensions + quelques essentiels, avec :
  - au moins **1 N/A** et **1 absent** (prouve `N/A ≠ 0 ≠ absent`),
  - des **notes variées** (pas tout à 3) pour que quartile bas et écarts soient visibles,
  - des valeurs **plausibles** (données conservées et visibles par TEM).
  - notes différenciées entre les 3 Faritany pour peupler réellement le quartile bas.
- **Auto-éval OSN v3_0** (éval existante `d3000000-0000-4000-8000-0000000e0001`) : scorer les
  critères v3_0 dont les **codes sont référencés par les critères far scorés** (mapping
  `far.sourceCodes ⊂ v3_0.codes`, 88/88 selon la baseline) → condition d'apparition de la
  colonne écarts.

## 4. Mécanique d'écriture (S2)

- **Campagne + lignes d'éval** : seed direct psql (même méthode que le scaffolding v3_0 déjà
  appliqué), contrôlé et identifiable via le libellé `DÉMO — …`.
- **Scores** : POST via PostgREST (`/rest/v1/…` derrière kong `54331`) sous **vrais JWT** :
  - Faritany → tokens `responsable_asn` (récupérés depuis `/root/gsat_faritany_accounts.md`,
    root-only 0600, via SSH natif `id_ed25519`).
  - OSN v3_0 → writer à résoudre en step 0 (`admin_global` si la RLS `scores_write` l'autorise
    sur l'éval OSN, sinon créer un compte `responsable_osn` pour l'OSN TEM).
- L'endpoint/format exact d'écriture des scores est calqué sur ce que fait l'app
  (`writeScore`/`evaluationStore`) — à confirmer en step 0. Le debounce 800 ms est purement
  client, sans effet sur l'écriture API directe.

## 5. Vérification backend (S3, moi/psql)

Accès lecture : `ssh -i ~/.ssh/id_ed25519 root@76.13.37.209` →
`docker exec -i supabase_db_gsat psql -U postgres -d postgres` (WARP off).

Confirmer :
- lignes `evaluation_scores` présentes pour les 3 évals Faritany + l'éval OSN v3_0 ;
- **trigger** exécuté → `dashboard_stats` peuplé : `score_global` / `score_dimension` en
  **0–100** (pas 0–3), `referentiel_version = far_v1_0` pour les Faritany, ligne OSN v3_0 présente ;
- N/A et absent correctement exclus du dénominateur (score cohérent).

## 6. Vérification frontend (S4, user/navigateur) — le vrai objectif

L'utilisateur ouvre `https://gsat.tily-digital.com`, se connecte avec un compte habilité
(Indice = RoleGuard `admin_global` / `responsable_osn` / `responsable_region`).

Checklist :
- `/dashboard/indice` : table nationale peuplée ; **comparaison Faritany groupée par province**
  avec le groupe contenant un Faritany à surveiller **auto-ouvert** et le **quartile bas surligné** ;
  **colonne écarts peuplée** (valeurs, pas « — »).
- Export **PDF** du rapport Indice (Chantier A) : section nationale + comparaison en page paysage.
- `/dashboard/faritany` (vue `responsable_asn`) : KPI/radar/alertes cohérents pour un des 3 Faritany.

Je fournis les URLs exactes + la checklist ; l'utilisateur confirme (captures si possible).

## 7. Données conservées — pas de cleanup (S5)

Décision user : **on garde tout**, y compris les scores fictifs de l'auto-éval OSN v3_0.

Implications acceptées et documentées :
- **Dédup par vagues** : l'Indice agrège toutes les campagnes far_v1_0 et garde la dernière
  éval par Faritany → une vraie campagne TEM ultérieure remplacera le démo pour les Faritany
  concernés ; le démo persiste pour les Faritany non encore scorés réellement.
- **Singleton OSN v3_0** : l'auto-éval nationale restera pré-remplie de scores fictifs ; TEM
  devra les effacer lorsqu'elle fera sa vraie auto-éval OSN.

Un **teardown** complet (delete scores pilotes + évals + campagne démo + `dashboard_stats`
résultantes ; retour baseline `scores=0, evals=1`) est **documenté dans le runbook mais non
exécuté**, pour pouvoir revenir en arrière si besoin. `pg_dump` de sécurité pris avant le seed.

## 8. Livrable (S6)

Runbook `docs/superpowers/runbooks/2026-09-05-pilote-go-live-e2e.md` :
récupération des JWT, commandes de seed exactes, requêtes de vérif backend, checklist de vérif
frontend, et procédure de teardown (au cas où). Reproductible.

## 9. Vérifications préalables (step 0 de l'impl — non structurantes)

1. Confirmer qu'aucune éval `far_v1_0` n'existe déjà (baseline `scores=0`).
2. Résoudre le writer OSN v3_0 : tester si `admin_global` peut écrire `evaluation_scores` sur
   l'éval OSN via la RLS `scores_write` ; sinon créer un `responsable_osn` pour l'OSN TEM.
3. Confirmer l'endpoint/format d'écriture des scores utilisé par l'app.
4. Confirmer la joignabilité VPS / firewall hPanel (egress dev `153.67.85.x/24` dans l'allowlist).
5. Résoudre les codes réels des 3 Faritany d'une même province et les critères far à scorer
   (+ leurs `sourceCodes` v3_0).

## 10. Hors périmètre

- Recovery mot de passe / SMTP réel (Chantier D), fermeture auto-signup (M2).
- Carte des 33 Faritany (Chantier B).
- Saisie terrain réelle par TEM (le pilote la simule, ne la remplace pas).
- Infra E2E automatisée (Playwright) — écartée dans l'approche.
