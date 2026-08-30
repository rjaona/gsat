# Candidats — Axe 3 Performance & montée en charge (fan-out lecture seule 2026-08-30)
Décompte : 1 BLOQUANT · 5 MAJEUR · 6 MINEUR.

- [BLOQUANT] `supabase/trigger_on_score_write.sql:20-212` + UI sans debounce (`src/components/evaluation/CritereItem.tsx:254`, `EvaluationForm.tsx:82-95`) — chaque frappe/clic → `writeScore` → recalcul ~10 dims × ~100 critères + propagation vers la ligne UNIQUE `dashboard_stats` de l'OSN parente (JOIN sur 33 ASH). 33 Faritany convergent en écriture sur la même ligne. Amplification d'écriture par frappe clavier (commentaire obligatoire essentiel KO). VÉRIF PROD : contention lock/latence sous charge (à observer, non prouvable statiquement).
- [MAJEUR] `src/stores/dashboardOsnStore.ts:26-44` + `dashboardService.ts:50-77` (`subscribeDashboardStats`) — la ligne OSN maj à chaque frappe est diffusée realtime → chaque visualiseur national refait `fetch()` complet à chaque frappe d'un évaluateur.
- [MAJEUR] `src/services/indiceService.ts:44-57` — charge TOUTES évals de TOUTES campagnes far (`.in()` sans date/limit), 5 A/R séquentiels, AUCUN cache (refetch à chaque visite `/dashboard/indice`). Coût O(campagnes×orgs) croissant.
- [MAJEUR] `src/pages/dashboard/DashboardOsnPage.tsx:102-122` (`fetchAsnStats`) — 33 `getDashboardStats` individuels (Promise.all) au lieu d'un `.in('org_id',…)`. Le pattern batché existe 8 lignes plus haut (`listPlanStatsByOrgIds`).
- [MAJEUR] `src/components/plan/PilotageOsnPage.tsx:92-118` — N+1 : 33 ASN × plans × `listActions` séquentiel. `listPlanStatsByOrgIds` (planActionService.ts:298-329) existe et batche déjà.
- [MAJEUR] `src/services/evaluationService.ts:178-195` (`subscribeAllEvaluations`) — canal non filtré sur `evaluations` + refetch `select('*')` complet à chaque écriture de n'importe quelle org (rôles national). 
- [MINEUR] `campagneService.ts:71-86` / `referentielService.ts:152-174` / `cartoService.ts:124-131` — subscribe non filtrés (refetch complet sur tout changement) ; pattern répété.
- [MINEUR] `src/services/indiceService.ts:46,110` — filtre `referentiel_version` sans index dédié (scan si campagnes grossit). VÉRIF PROD volume.
- [MINEUR] `src/services/alerteService.ts:38-46` — pas de `.limit()` DB, plafond « 5 alertes » = invariant applicatif non garanti SQL.

POSITIF : routes 100% `React.lazy`+Suspense, chunks vendor manuels + gzip/brotli ; `dashboard_stats` matérialisée (lecture O(1)) ; pagination audit `range()` PAGE_SIZE+1 ; notifs `.limit(50)` filtré ; batch correct ailleurs (dashboardGlobalStore/cartoService/dashboardFaritanyStore) ; subscribe cleanup systématique ; index globalement corrects.
