# Indice de Déploiement — Design (L4, cœur)

**2026-08-05 · GSAT-Faritany · référentiel `far_v1_0`**
Source normative : `docs/GSAT-Faritany_Note-de-conception.md` §6.

## 1. Objectif et périmètre

L'Indice de Déploiement (ID) croise les évaluations Faritany (`far_v1_0`, 33 ASN)
avec l'évaluation nationale OSN (`v3_0`) pour rendre visible, critère national par
critère national, l'**écart entre ce que le national déclare et ce que le terrain
constate**. C'est la finalité du chantier Faritany (§6), pas un simple sous-produit.

**Dans le périmètre de ce lot :**
- Une fonction pure de calcul de l'ID et de l'écart déclaratif.
- Un service qui rassemble les données (évals Faritany participantes, éval nationale,
  poids, mapping des enfants) et délègue tout le calcul à la fonction pure.
- Une page dédiée réservée à OSN / région / admin, affichant le tableau par critère
  national.

**Hors périmètre (différé, YAGNI) :** carte des 33 Faritany, comparaison
inter-campagnes, export PDF. Ils réutiliseront la même fonction pure plus tard.

**Contrainte absolue (§6, précaution d'usage) :** l'ID ne modifie **jamais** le score
GSAT national. Le GSAT reste le standard OMMS ; l'ID est un indicateur complémentaire
affiché **à côté, dans une couleur différente**.

## 2. Formule (fidèle au §6)

Pour un critère national X :

```
enfants(X) = { critères far_v1_0 c | X ∈ c.sourceCodes }        (multi-parent géré)

score_f(X) = score du Faritany f sur enfants(X), via scoring.ts (logique N/A)

ID(X)      = Σ_f  score_f(X) × poids(f)  /  Σ_f  poids(f)        échelle 0–100

Écart(X)   = note_nationale(X) × 100/3  −  ID(X)

poids(f)   = effectif du Faritany f (organisations.poids)
```

Bandes d'interprétation (§6) :

| Écart | Interprétation | Réaction |
|---|---|---|
| **> +30** | Le national déclare bien plus que le terrain ne constate | Diffusion, pas rédaction |
| **−10 à +30** | Cohérent | RAS |
| **< −10** | Le terrain fait mieux que ce que le national déclare | Bonne pratique non capitalisée |

## 3. Le cœur : `calculerIndiceDeploiement` (pur, testable)

```
calculerIndiceDeploiement(refFar, evalsParticipantes, poids, notesNationales)
  → pour chaque critère national X :
      { code, noteNationale, id, ecart, interpretation, nbEnfants, nbFaritanyContributeurs }
```

Réutilise `scoring.ts` (`calculerScoreDimension`) pour `score_f(X)` — **pas de troisième
implémentation du scoring** (le trap n°1 de la passation ; parité `scoring.ts` ≡
`fn_recalculate_scores` déjà prouvée 12/12).

**Définition de `score_f(X)` (unifiée, non ambiguë).**
`score_f(X)` = moyenne, ramenée sur 0–100, des notes que le Faritany f a **réellement
attribuées** aux enfants de X. Un enfant **absent** de la saisie de f (non présenté en
mode socle, ou simplement non renseigné) **et** un enfant **N/A** sont **tous deux
exclus** du calcul — ni l'un ni l'autre n'est une preuve de déploiement, dans un sens
ou dans l'autre. Si f n'a scoré **aucun** enfant de X ⇒ `score_f(X) = null` ⇒ f ne
contribue pas à `ID(X)`.
C'est **différent** du score de conformité GSAT (`calculerScoreDimension`, où un enfant
absent compte **0** = non-conformité). Deux questions, deux dénominateurs — d'où un
**atome séparé** `scoreSurCriteres`, à ne jamais « harmoniser » avec
`calculerScoreDimension`.

**Cinq garde-fous, explicites dans le contrat de la fonction :**

1. **Σ_f = Faritany PARTICIPANTS uniquement.** On itère sur les évaluations
   **existantes**, jamais sur les 33 orgs. Un Faritany sans éval est **absent** de la
   moyenne, pas noté 0.
   *Piège :* `calculerScoreDimension` sur une map de scores vide renvoie **0, pas
   null** (absent = 0). Un Faritany non participant traité comme 33ᵉ org tirerait l'ID
   vers le bas comme un vrai zéro. La parade est structurelle : `evalsParticipantes` se
   construit **à partir des évals**, jamais des 33 orgs ; et `score_f` via
   `scoreSurCriteres` **exclut** les enfants non scorés (voir définition ci-dessus).

2. **Jointure des codes prouvée.** `X ∈ c.sourceCodes` ⇒ `note_nationale(X)` via les
   `evaluation_scores` de l'éval OSN v3_0. Vérifié : les **88/88** codes distincts
   référencés par les `sourceCodes` de `far_v1_0.json` existent dans
   `referentiel_v3_0.json`. `evaluation_scores.critere_code === criteres.code` par
   construction.

3. **Indépendant du gating socle/complet.** Aucune notion de mode dans `scoreSurCriteres` :
   le dénominateur = les enfants **réellement scorés** par f (voir définition unifiée).
   Un Faritany en socle qui n'a pas d'enfants extension dans sa saisie n'est donc ni
   pénalisé ni récompensé pour eux — ils sont simplement absents de son `score_f`. L'ID
   mesure le déploiement du standard **national**, pas la complétude d'une campagne.
   Les enfants **inactifs** (`c.actif === false`) sont exclus du mapping des enfants.

4. **Note nationale N/A ou absente ⇒ `ecart = undefined`** → afficher l'ID seul, pas de
   nombre bidon. De même, si aucun Faritany n'a scoré X ⇒ `id = null` (et `ecart`
   également indéfini).

5. **Poids variés obligatoires au test.** En local, tous les `poids` valent 1 (défaut de
   seed ; les effectifs réels sont différés à l'ERP), donc la moyenne pondérée est
   indistinguable d'une moyenne simple. Le test unitaire **doit** utiliser des poids
   différents pour réellement exercer `Σ(score×poids)/Σpoids`.

La fonction ne fait **aucune I/O** — que de l'arithmétique sur ses entrées.

## 4. Plombage : `indiceService.ts`

Un seul service, en **lecture seule sous le JWT de l'utilisateur** (OSN / région /
admin). Le service fetch et assemble ; il ne fait **aucune** arithmétique.

**⚠️ Schéma réel (vérifié en base).** `evaluations` **n'a pas** de colonne
`referentiel_version` — la version vit sur `campagnes.referentiel_version`. Toute
sélection par version passe donc **par la campagne**, jamais par `evaluations` en
direct.

**Côté Faritany — toutes les vagues.** L'ouverture se fait « par vagues, une province à
la fois » (§2.1) : un cycle est réparti sur **plusieurs campagnes** far_v1_0. L'ID doit
donc couvrir **toutes** les évals far_v1_0, pas une seule campagne (décision utilisateur
2026-08-05).
1. Ids des campagnes far_v1_0 : `campagnes.select('id').eq('referentiel_version','far_v1_0')`.
2. Évals de ces campagnes : `evaluations.in('campagne_id', farCampIds)` (id, org_id, created_at).
   **Dédup : dernière éval par Faritany** (max `created_at` par `org_id`) — un Faritany
   réévalué sur un cycle ultérieur n'est compté qu'une fois, avec son état le plus récent.
3. `poids` des orgs concernées : `organisations.in('id', orgIds)`.
4. Scores en **un seul batch** : `evaluation_scores.in('eval_id', [candidateEvalIds])`.
   `evalsParticipantes` = les évals dédupliquées ayant **≥ 1 score** (garde-fou #1).

**Côté national — auto-éval OSN v3_0, via la campagne.**
5. Ids des campagnes v3_0 : `campagnes.select('id').eq('referentiel_version','v3_0')`.
   Si aucune → `notesNationales` vide (ID-only, écarts indéfinis — garde-fou #4).
6. Éval nationale = éval de ces campagnes, **statut `validee` préféré**, sinon la plus
   récente (`created_at` desc). C'est l'« Évaluation nationale v3_0 existante » de l'OSN.
7. Ses `evaluation_scores` → `notesNationales` (note par critère, `null` = N/A préservé).

**Décision RLS clé.** `fn_moyenne_nationale` (Lot 1) ne renvoie qu'un **agrégat par
dimension** issu de `dashboard_stats`, **pas** de note par critère — inutilisable ici.
On lit donc les `evaluation_scores` de l'éval nationale **en clair**, légitime **parce
que la page est réservée à OSN / région / admin**, rôles qui possèdent déjà cette
évaluation et la lisent sous leur propre JWT. **Pas de nouvelle fonction SECURITY
DEFINER.** Le `responsable_asn` n'a **jamais** accès à cette page ni à ces données
(RoleGuard strict) — l'isolation Faritany prouvée au Lot 1 est préservée.

Le service assemble `{ refFar, evalsParticipantes, poids, notesNationales }` et délègue
à `calculerIndiceDeploiement`.

## 5. Page : `IndiceDeploiementPage.tsx`

- **Route** `/dashboard/indice`, `RoleGuard=[admin_global, responsable_osn,
  responsable_region]`, item Sidebar avec les mêmes rôles (cohérence route↔nav —
  cf. feedback route-nav-drift).
- **Tableau par critère national** : `code · libellé · note nationale (0–3) · ID (0–100)
  · Écart · interprétation`.
- **Couleur distincte du score GSAT** (§6) : l'ID n'est pas un score de conformité.
  Badge d'écart vert (`< −10`) / neutre (`−10..+30`) / ambre-rouge (`> +30`).
- Écart `undefined` (garde-fou #4) → cellule « — », pas un nombre.
- États vides : campagne far absente / aucune éval participante → message explicite.

## 6. Tests

- **Unitaire `calculerIndiceDeploiement`** (le cœur) — avec **poids variés** (#5), plus :
  Faritany non participant exclu (#1), enfant absent compté 0 dans une éval réelle,
  critère N/A national → écart indéfini (#4), multi-parent, X sans enfant scoré → id null.
- **RTL `IndiceDeploiementPage`** — rendu du tableau, état écart-manquant, couleur
  distincte du score GSAT, états vides.
- **DB (technique JWT du Lot 1)** — prouver que OSN / région **lisent** les
  évals + scores des 33 Faritany descendants ET leur propre éval nationale v3_0 ; que
  `responsable_asn` est **bloqué** sur ces données. Prérequis de seed : un référentiel
  v3_0 minimal + une éval nationale + re-seed des scores far (le test de parité
  `parite-sql.diff` vide `evaluations`/`evaluation_scores`/`campagnes`/`dashboard_stats`).

## 7. Fichiers

**Nouveaux :** `src/services/indice/calculerIndiceDeploiement.ts` (pur),
`src/services/indiceService.ts` (I/O), `src/pages/dashboard/IndiceDeploiementPage.tsx`,
tests associés.
**Modifiés :** `src/router.tsx` (route), `src/components/layout/Sidebar.tsx` (item),
i18n `fr`/`en` (namespace `indice`).
**Réutilisés sans modification :** `src/services/scoring.ts`,
`src/data/far_v1_0.json`, `src/data/referentiel_v3_0.json`.

## 8. Vérification (comment on prouve que c'est juste)

- Parité déjà acquise : `score_f(X)` passe par `scoring.ts`, prouvé ≡ SQL (12/12).
- Jointure des codes prouvée avant écriture : 88/88.
- Garde-fou #1 prouvé par test unitaire (Faritany non participant absent de Σ_f).
- Pondération prouvée par test à poids variés (#5).
- Lectures/isolation prouvées sous vrai JWT en transaction rollback (méthode Lot 1),
  pas déduites d'une lecture de policy.
