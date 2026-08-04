# GSAT-Faritany — Passation à Claude Code

**4 août 2026** · dépôt `gsat-v2` · réf. `docs/GSAT-Faritany_Note-de-conception.md` v0.3

Ce document est le point d'entrée. Il dit ce qui est déjà fait, ce qui reste, dans
quel ordre, et ce sur quoi se casser les dents.

---

## 0. Trois choses à régler avant de lancer quoi que ce soit

### 0.1 — `gsat-v2` n'est pas un dépôt git

Vérifié : pas de `.git`. Une quinzaine de fichiers ont été modifiés le 4 août,
dont le scoring et les types, **sans aucun filet**.

```bash
cd gsat-v2
git init && git add -A && git commit -m "État au 4 août 2026, avant chantier Faritany"
git checkout -b feat/gsat-faritany
```

Le `.gitignore` existe et exclut déjà `node_modules`, `dist`, `.env.local`.

### 0.2 — Le test de référence

```bash
node node_modules/vitest/vitest.mjs run    # les liens node_modules/.bin sont cassés
```

Notez le nombre de tests verts **avant** de continuer. Sans cette référence, on ne
sait plus distinguer ce qu'on casse de ce qui était déjà rouge.

> Attendu : les 4 fichiers de tests livrés (`scoring`, `referentielService`,
> `evaluationWorkflow`, `scorePicker`) passent — 77 tests vérifiés en isolation.
> `parite-sql.diff.test.ts` exige un PostgreSQL joignable : à exclure du run par
> défaut (`--exclude '**/*.diff.test.ts'`) et à réserver à un job CI dédié.

### 0.3 — La base

```bash
./scripts/setup_base_gsat_faritany.sh "postgresql://…"
```

Enchaîne migration (partie 0 isolée, obligatoire), régénération des types, seed du
référentiel et des 33 Faritany. Meurt à la première incohérence plutôt que de finir
en silence sur une base à moitié migrée.

**Rien de ce qui suit ne peut être vérifié avant que ce script soit passé.**

---

## 1. État des lieux

### Livré, testé, en place

| Fichier | Nature |
|---|---|
| `CLAUDE.md` | Réécrit — décrivait Firebase alors que le code est sur Supabase |
| `src/services/scoring.ts` | **Nouveau.** Logique pure, miroir exact du trigger SQL |
| `src/services/evaluationWorkflow.ts` | **Nouveau.** Machine à états, rôles, périmètre, file de revue par le risque |
| `src/services/referentielService.ts` | Réécrit — version obligatoire, nouvelles colonnes, `listReferentiels()` |
| `src/services/evaluationService.ts` | `writeScore` sait supprimer · `autoValiderEvaluation` · `revoirEvaluation` · `rowToEval` complet |
| `src/types/index.ts` | `responsable_asn`, `CampagneMode`, champs de workflow, `poids`, `socle`/`sourceCodes`/`indicateurErp` |
| `src/stores/referentielStore.ts` | Indexé par version — deux référentiels ouverts simultanément |
| `src/hooks/useReferentiel.ts` | `version: string \| null`, plus de défaut |
| `src/components/evaluation/ScorePicker.tsx` | **Trois** états : note / N/A / pas répondu |
| `src/components/evaluation/CritereItem.tsx` | Ne collapse plus `undefined` en `null` |
| `src/i18n/{fr,en,mg}.ts` + `index.ts` | Clés `naAide`, `effacer`, `essentielSansReponse` · locale `mg` branchée |
| `src/__tests__/` ×5 | 77 tests + 12 tests de parité SQL |
| `supabase/migrations/20260804_faritany.sql` | Migration additive, appliquée et testée sur PostgreSQL 16 |
| `scripts/seed_33_faritany.sql` · `seed-referentiel-faritany.ts` · `setup_base_gsat_faritany.sh` | Seeds idempotents |
| `src/data/far_v1_0.json` | Les 76 critères |

**89 tests verts, `tsc --noEmit` propre** — en isolation. Le balayage sur le dépôt
complet reste à faire, c'est la tâche P1 ci-dessous.

### Documents à lire avant de coder

`docs/GSAT-Faritany_Note-de-conception.md` (le pourquoi) ·
`docs/PLAN_TACHES_FARITANY.md` (le découpage) ·
`docs/T05_NOTE_APPLICATION.md` et `docs/T1_PATCH_evaluationService.md` (ce qui a
déjà été appliqué et pourquoi).

---

## 2. Les tâches, dans l'ordre

### P1 — Balayage de compilation

**Taille inconnue.** Cinq signatures publiques ont changé ; le compilateur est la
liste de courses.

| Ce qui a changé | Ce que ça casse chez les appelants |
|---|---|
| `getReferentiel(version)` — plus de défaut `'v3_0'` | Tout appel sans argument |
| `useReferentiel(version: string \| null)` | Idem |
| `useReferentielStore.referentiel` → **fonction** `referentiel()` | Toute lecture en propriété |
| `calculerScoreDimension` → `number \| null` | Toute arithmétique directe sur le résultat |
| `calculerScores().parDimension` → `Record<string, number \| null>` | Idem |
| `writeScore(evalId, { note: 0\|1\|2\|3\|null\|undefined }, by)` | Les appelants typés `null` uniquement |
| `ScorePicker` accepte `undefined` | Les parents qui passent `?? null` |

Suspects probables — à confirmer par `grep`, pas par supposition :
`stores/evaluationStore.ts` · `hooks/useEvaluation.ts` ·
`components/evaluation/{EvaluationForm,DimensionSection,ValidationFinale,ValidationSummary}.tsx` ·
`pages/evaluation/*` · `services/pdf/evaluationReport.ts` · `services/dashboardService.ts` ·
`components/dashboard/**`.

```
Fais passer `npx tsc --noEmit` sur tout le dépôt après les changements d'API du
4 août (voir docs/T05_NOTE_APPLICATION.md §« Trois changements d'API »).

Règles : ne tais aucune erreur avec `any`, `!` ou `as unknown as`. Là où un score
peut être null, décide explicitement ce que l'écran affiche — `formatScore()` rend
déjà « — » pour une dimension non comptable.

Puis `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'`.
Corrige les tests dont la sémantique a changé en documentant pourquoi ; ne
supprime aucun test.
```

**Fait quand** : `tsc` à zéro erreur et suite verte.

---

### P2 — T1.2 · Mode socle/complet dans les campagnes

**Fichiers** `src/services/campagneService.ts` · `src/components/campagnes/CampagneFormModal.tsx` ·
`src/pages/admin/CyclesPage.tsx` · `src/components/campagnes/CampagneStatutBadge.tsx`

Le champ `campagnes.mode` existe en base et dans le type `Campagne`. Il n'est ni lu
ni écrit.

```
Ajoute le choix du référentiel et du mode au wizard de campagne.

Étape 1 : sélecteur de référentiel alimenté par `listReferentiels()`
(referentielService). Le sélecteur de mode (socle / complet) n'apparaît QUE si le
référentiel choisi a `niveau === 'ASN'` — le GSAT national n'a pas de socle.

Étape 3 : le périmètre se choisit par province, en groupes repliables sur le
préfixe de `organisations.code` (ANT-, TOA-, MAH-, FIA-, TOL-, DIA-, DSP-).
Cocher 33 cases une par une n'est pas une interface.

`campagneService` : `mode` dans rowToCampagne et payloadToRow, défaut 'complet'.
Badge « Socle » dans la liste des cycles. Clés i18n dans fr, en ET mg.
```

**Fait quand** : une campagne `far_v1_0` en mode `socle` sur la province ANT crée
9 périmètres, et le mode se relit après rechargement.

---

### P3 — T1.3 · Finir l'écran de saisie

**Fichiers** `src/components/evaluation/{CritereItem,DimensionSection,EvaluationForm,EvaluationProgress}.tsx` ·
`src/stores/evaluationStore.ts`

`ScorePicker` et `CritereItem` sont faits. Reste le contexte autour.

```
1. Badge « Extension » sur les critères `socle === false`. En mode campagne
   `socle`, les regrouper dans une section repliée « Pour aller plus loin —
   n'entre pas dans le score ». Les notes y sont saisissables et stockées.

2. Encart indicateur ERP sous les critères dont `indicateurErp` est non vide ET
   pour lesquels un `erp_snapshots` existe. Sinon : rien du tout, pas de bloc vide.
   Format : « Données ERPTEM au JJ/MM/AAAA : <valeur> ». Aucun jugement, aucune
   couleur — l'utilisateur note, l'outil informe.

3. `EvaluationProgress` : compter avec `calculerAvancement()` de scoring.ts, qui
   compte un N/A comme une réponse et respecte le mode de campagne.

4. Le store propage `mode` depuis la campagne jusqu'aux appels de scoring.
```

**Fait quand** : cocher N/A, recharger, retrouver N/A — et le score de la dimension
monte au lieu de descendre.

---

### P4 — T1.4 · Écran d'auto-validation

**Fichiers** `src/pages/evaluation/ValidationPage.tsx` ·
`src/components/evaluation/{ValidationSignature,EssentialAlertPanel,WorkflowStatusStepper}.tsx` ·
`src/components/auth/RoleGuard.tsx`

Le service est fait (`autoValiderEvaluation`), les règles aussi
(`verifierAutoValidation`). Il manque l'écran.

```
`RoleGuard` ouvre ValidationPage à `responsable_asn` pour sa propre org uniquement.

ValidationSignature : dépôt OBLIGATOIRE du PV de comité (Storage → pv_comite_path).
Le trigger SQL le rejette de toute façon — dis-le avant l'appel, pas après.

Essentiels à 0 : avertissement à confirmer explicitement via une case, jamais un
refus. Utilise `verifierAutoValidation()` qui rend {erreurs, avertissements}.
Ne réimplémente pas la règle.

Après validation, afficher l'échéance : « Revue nationale attendue avant le … ».

Stepper : brouillon → en cours → validée (par le comité) → clôturée, avec la
branche « révision demandée » visible.
```

**Fait quand** : un `responsable_asn` valide la sienne ; la même action sur une
autre org est refusée par la RLS. À couvrir dans `src/__tests__/security/` — et
renommer `firestoreRules.test.ts` au passage, il ne teste plus Firestore.

---

### P5 — T1.5 · Revue nationale

**Fichiers** `src/pages/admin/RevuePage.tsx` (nouveau) · `src/router.tsx`

```
File des évaluations `validee` sans `revue_at`, triée par `scoreRisqueRevue()`
(evaluationWorkflow.ts) et NON par date : essentiels KO, incohérences ERP, alertes
critiques, progression anormale, échéance proche.

Verdict via `revoirEvaluation()` : approved → cloturee ; revision_requested →
en_cours avec motif obligatoire.

Bandeau : « X évaluations se clôtureront automatiquement dans N jours ».
Le job pg_cron tourne à 02h30 — la revue ne bloque personne, elle arbitre.
```

---

### P6 — T1.6 · Tableau de bord Faritany

**Fichiers** `src/pages/dashboard/DashboardFaritanyPage.tsx` ·
`src/stores/dashboardFaritanyStore.ts` · `src/router.tsx`

Cinq bandeaux, lisibles sur téléphone. Réutiliser `DimensionRadarChart`,
`KpiStrip`, `ActionKanban` — ne pas réécrire ce qui existe.

1. Score, évolution vs cycle précédent, nombre d'alertes critiques
2. Radar 10 dimensions vs moyenne des Faritany
3. Bandeau ERP — **masqué entièrement** s'il n'y a aucun snapshot
4. Alertes, 5 maximum, triées par sévérité
5. Plan d'action

---

### P7 — T1.7 · L'écran national passe à 33 lignes

**Fichiers** `src/components/dashboard/osn/{AsnComparisonTable,AsnProgressList}.tsx`

Conçus pour une poignée de lignes. Une heatmap 33 × 10 n'est pas lisible : groupes
repliables par province, tri par colonne, mise en avant du quartile bas plutôt
qu'affichage exhaustif. Le libellé de colonne vient de
`system_config.libelle_niveau_local`, jamais « ASN » en dur.

---

### P8 — T1.8 · Les cinq mesures du 100 % en ligne

**Fichiers** `src/components/evaluation/EvaluationForm.tsx` ·
`src/components/ui/` (indicateur réseau) · `src/services/pdf/prepSheet.ts` (nouveau)

Décision projet : aucun mode offline. Le risque ne disparaît pas, il se compense.

1. **Fiche de préparation PDF** : les 42 critères du socle, une case par note, une
   ligne de commentaire. Le comité travaille sur papier là où la discussion a lieu,
   une personne saisit ensuite depuis un point connecté. Réutilise `pdfTheme.ts`.
2. Écriture serveur à chaque note — jamais de bouton « Enregistrer » global.
3. Reprise au critère exact, pas en haut de la dimension.
4. Dimensions chargées à la demande.
5. État réseau permanent : Enregistré / Envoi… / Échec — réessayer.

---

### Après le lot 1

| Lot | Contenu |
|---|---|
| **L2** | Import CSV `{org_id, periode, cle, valeur}` → `erp_snapshots` · calcul de `completude` · encart contextuel. Connecteur ERPTEM **plus tard**, et via `resolveLegacyFaritany()` |
| **L3** | **Détection d'incohérence note ↔ ERP en priorité** — c'est le seul contre-pouvoir à l'auto-validation · moteur de règles avec hystérésis et plafond de 5 · `action_templates` · plan pré-rempli |
| **L4** | Indice de Déploiement via `criteres.source_codes` · comparaison nationale groupée par province · carte des 33 Faritany (géoréférencement à produire) · export PDF |

---

## 3. Les pièges

| Piège | Ce qu'il faut savoir |
|---|---|
| **Le scoring vit à deux endroits** | `scoring.ts` et `fn_recalculate_scores()`. Modifier l'un impose l'autre **et** `parite-sql.diff.test.ts`. La parité a été prouvée par 12 tirages aléatoires — ne la casse pas en silence |
| **N/A ≠ 0 ≠ absent** | `null` = non applicable (hors dénominateur) · absent = pas répondu (0, plein poids). Un `?? null` de trop et le bug revient. C'est déjà arrivé deux fois : dans `ScorePicker` et dans `CritereItem` |
| **ENUM PostgreSQL** | Une valeur ajoutée n'est pas utilisable dans la même transaction. D'où la partie 0 isolée |
| **`exactOptionalPropertyTypes`** | Colonnes nullables → `prop?: T \| undefined`, jamais `prop?: T` |
| **RLS avant UI** | Une table sans policy est ouverte ou fermée à tort. Toujours tester l'isolation entre deux Faritany |
| **`dashboard_stats`** | Écrit par trigger uniquement. Aucune écriture client, jamais |
| **Libellé du niveau** | `system_config.libelle_niveau_local`. Ni « ASN » ni « Faritany » en dur |
| **Branches TEM** | Fandaharana dit Mavo/Maitso/Mena/Menafify, ERPTEM dit Lovatoky/Antsamy/Resa/Antsainy. Personne n'a établi la correspondance — `couverture_branches` est inexploitable tant que le Foibe n'a pas tranché |
| **Trois référentiels territoriaux** | Types ERPTEM (en prod), référentiel 2026 (retenu ici), table `units` Firaketana (annoncée comme source de vérité). Si `units` fait autorité, le seed devra lire l'API |

---

## 4. En parallèle, hors Claude Code

- **`docs/Fiche_validation_GSAT-Faritany.xlsx` → comité TEM.** Les 76 libellés à
  valider, les 17 essentiels à confirmer, la colonne malgache à remplir. C'est ce
  qui alimentera `criteres.libelle_mg` — pas une traduction automatique.
- **Catalogue d'indicateurs ERP** : différé, sans échéance à ce jour. Tant qu'il
  n'arrive pas, L3 n'a rien à croiser et l'auto-validation reste sans
  contre-pouvoir. C'est le risque RF9.
- **La question `units`** à trancher avec l'équipe Firaketana.

---

## 5. Ordre recommandé

```
0.1 → 0.2 → 0.3          git, baseline, base — séquentiel, bloquant
P1                        balayage tsc — rien d'autre avant que ce soit vert
P2 ─┐
P3 ─┼─ parallélisables
P6 ─┘
P4 → P5                   workflow, séquentiel
P7, P8                    finition
```

**Ne pas démarrer P2 avant que P1 soit vert.** Construire des écrans sur un dépôt
qui ne compile pas, c'est empiler des erreurs qu'on n'attribuera plus.
