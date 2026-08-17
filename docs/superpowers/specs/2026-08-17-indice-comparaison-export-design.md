# Indice de Déploiement — Comparaison par province + Export PDF

_LOT 4 · Chantier A · 2026-08-17_

## Problème

La page **Indice de Déploiement** (`/dashboard/indice`) n'affiche qu'une **table nationale par critère** (agrégat sur les 33 Faritany). Deux items du LOT 4 restent différés :
1. une **comparaison par province** — voir quels Faritany portent l'écart de déploiement ;
2. un **export PDF** du rapport.

## Décisions produit

- **Comparaison** : par Faritany → **ID global (0–100) + ID par dimension** far_v1_0, groupé par province, quartile bas mis en avant.
- **PDF** : rapport complet (table nationale + comparaison).
- **Placement** : section **sous** la table nationale, même page, mêmes rôles (`RoleGuard` admin / osn / région).
- **Pas de dépendance à v3_0** — la métrique est l'ID, pas l'écart national.

## Architecture

### Brique de données (fondation)

`getIndiceDeploiement()` calcule déjà les données par-Faritany (`evalsParticipantes`) puis ne renvoie que l'agrégat national. On expose le par-Faritany sans re-fetch :

- **`src/services/indice/calculerComparaisonFaritany.ts`** (pur) — lentille ID via `scoreSurCriteres` (`@/services/scoring`, exclut **absent ET N/A**, rend **déjà 0–100**) :
  - `idParDimension[dim.code]` = `scoreSurCriteres(scores, dim.criteres.filter(actif))` — DANS une dimension, absent+N/A exclus.
  - `idGlobal` = **moyenne sur TOUTES les dimensions**, une dimension non évaluée comptant **0** (décision produit) → global cohérent avec les cellules affichées (`0%`), une dimension non couverte tire l'indice vers le bas (déploiement incomplet).
  - Toutes dimensions nulles (0 signal) → ligne exclue.
  - Retourne `LigneAsn[]` (type existant).
- **`indiceService`** : loader interne partagé `chargerDonneesIndice()` (ajoute `nom, code` au select organisations) ; `getIndiceDeploiement()` inchangé côté API ; nouvelle `getIndiceComplet(): { national, faritany, dimensionCodes, niveauLabel }` (un seul chargement).

**Sémantique** : dans une dimension, un critère absent est exclu (lentille ID) ; mais une dimension entièrement non couverte compte 0 dans le global. Distinct du `score_global` GSAT (qui compte aussi les critères absents = 0 au sein des dimensions).

### UI (réutilisation)

`AsnComparisonTable` (déjà 0–100 : buckets 75/50/25, rendu `%`) est réutilisé, alimenté par les lignes ID. Groupage via `grouperAsnParProvince`/`seuilQuartileBas`/`PROVINCES`. Store : `faritany: LigneAsn[]`. `niveauLabel` via `getLibelleNiveauLocal`. i18n fr/en/mg sous `pages.indice`.

> Échelle confirmée par le trigger `fn_recalculate_scores` (`supabase/trigger_on_score_write.sql`) : `score_dimension = round((sum/(n*3))*100)`, `score_global = round(mean(dims))` → `dashboard_stats` est **déjà en 0–100**. `DashboardOsnPage` alimente donc `AsnComparisonTable` en 0–100 comme nous : **pas de bug d'échelle**. (Une note antérieure évoquait à tort du 0–3 côté OSN — corrigée.)

### Export PDF

`src/services/pdf/indiceReport.ts` sur le patron `prepSheet.ts` (jsPDF + `pdfTheme` + autoTable) : section 1 = table nationale, section 2 = comparaison (⚠️ ~13 colonnes → **landscape**). Bouton `ExportPdfButton` sur la page.

## Tests

- Pur `calculerComparaisonFaritany` : 0–100 sans ×100/3, exclusion absent+N/A, `idGlobal` mean-of-means, ligne exclue si toutes dimensions nulles, `code`/`nom` propagés.
  - Invariant vérifiable = sur **un seul critère** `ID national(X) == moyenne pondérée des score_f(X)`. **Ne pas** tester l'égalité rollup-global vs national (identité fausse).
- RTL page : section rend les lignes groupées + quartile bas.
- PDF : le doc contient les 2 sections.

## Hors périmètre

Carte des 33 Faritany (chantier B), auto-éval OSN v3_0 (chantier C), SMTP réel (chantier D). Zéro changement DB/RLS.
