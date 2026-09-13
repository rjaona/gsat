# Cockpits de pilotage GSAT — design

**Date** : 2026-09-13
**Statut** : validé (brainstorming) — prêt pour plan d'implémentation
**Périmètre** : deux nouvelles pages « cockpit » orientées décision (national + régional), phasées lecture→capture

---

## 1. Contexte & problème

GSAT possède déjà des dashboards **descriptifs** :
- `/dashboard/faritany` (région) : KPIs, radar vs moyenne nationale, ERP, alertes, plan d'action.
- `/dashboard/osn` (national) : score héro, participation, tableau comparatif 33 Faritany, essentiels KO, progression plans.
- `/dashboard/indice` : Indice de Déploiement + comparaison + export PDF.

Ils montrent **l'état**. Le besoin exprimé est un dashboard de **prise de décision** : « qu'est-ce qu'on doit faire, où, et en priorité ? ». Deux décisions cœur retenues :
1. **Où concentrer l'appui** (national → priorisation des Faritany/dimensions).
2. **Piloter les plans d'action** (exécution : retards, blocages).

Signaux de priorité retenus (décision produit) : **critères essentiels KO** + **santé des plans d'action** (retard/bloquées). *Pas* le score brut ni la stagnation comme axes de rang.

## 2. Approche retenue (A) — Révéler d'abord, capturer léger via le modèle existant

- **Deux cockpits** distincts des dashboards descriptifs : national + régional.
- **Lecture d'abord** (Phase 1), **capture** ensuite (Phase 2).
- **Deux signaux gardés séparés** (sévérité conformité × exécution) — **pas de score composite opaque**.
- **Boucle d'appui fermée via le plan d'action existant** : une « action d'appui » créée par le national = une action dans le plan du Faritany, taguée `origine='nationale'` → réapparaît automatiquement dans le cockpit régional. Seul reste-t-il une petite table d'état `appui_faritany`.
- **Correctifs RLS additifs** pour autoriser le national à créer plan+action dans un Faritany descendant.

Approches écartées : **B** (capture complète d'emblée — suppose un workflow d'appui national inexistant opérationnellement, valeur dormante pendant le pilote) ; **C** (enrichir les pages existantes — l'utilisateur veut deux cockpits séparés).

## 3. Cockpit National

- **Route** `/dashboard/pilotage-national` · **Accès** `responsable_osn`, `admin_global` (RoleGuard, calqué sur `/dashboard/osn`).
- **But** : « où concentrer l'appui ? », deux signaux lisibles séparés.

**Structure :**
1. **Bandeau synthèse** — 3 compteurs : `Faritany en zone appui` (essentiels KO **et** actions en souffrance), `Faritany avec essentiel KO`, `actions nationales en cours` (Phase 2). Affiche « X évalués / 33 ».
2. **Grille 2×2 (compteurs, pas un nuage)** — sévérité (KO oui/non) × exécution (souffrance oui/non), un nombre de Faritany par case ; case « appui urgent » mise en avant ; clic → filtre la watchlist. *(Un nuage à 33 points serait surtracé : petits entiers, quasi vide au pilote.)*
3. **Watchlist (instrument principal)** — 1 ligne / Faritany, groupée par province (repliable, patron `AsnComparisonTable`) :
   `Faritany | Essentiels KO | Actions (tot.) | Retard | Bloquées | Statut | Appui | →`
   - Colonne **Statut** dérivée : `rien démarré` (KO mais 0 action — angle mort à surfacer), `en souffrance` (retard/bloquées > 0), `sous contrôle` (actions existent, rien en souffrance), `non évalué`.
   - Tri par défaut : essentiels KO ↓ → « rien démarré » remonté → souffrance ↓. Colonnes triables.
4. **Drill-down** (panneau latéral) — le **pourquoi** : essentiels KO (codes + libellés), actions en retard/bloquées (échéance). En Phase 2 : capture d'appui ici (marquer *en appui*, assigner un référent national, créer une action d'appui).

## 4. Cockpit Régional

- **Route** `/dashboard/pilotage-regional` · **Accès** `responsable_asn` (+ `responsable_region`), scopé à son propre org (RLS `org_id = mon org` déjà en place).
- **But** : « mes priorités d'action » — une file ordonnée de ce que je dois traiter, avec accès direct pour agir.

**Structure :**
1. **Bandeau court** — 3 compteurs : `mes essentiels KO`, `mes actions en retard`, `mes actions bloquées`. Chip discret **« en appui national »** si applicable (pas une section).
2. **File de priorités unifiée (cœur)** — une liste ordonnée mêlant deux types :
   - 🔴 **Essentiel KO** (conformité) → lien profond `/evaluation/:id` au critère.
   - ⏳ **Action en retard/bloquée** (exécution) → lien `/action-plan`.
   - Les actions `origine='nationale'` portent un **badge « national »** (c'est ainsi que la boucle d'appui se manifeste côté région, sans section dédiée).
   - **Ordre** (util pur `ordonnerPrioritesRegionales`, testable) : essentiels KO → bloquées → retard (échéance la plus ancienne) → priorité haute.
3. **Agir = réutiliser l'existant** : liens profonds uniquement ; aucune nouvelle capacité d'édition dans le cockpit.

## 5. Modèle de données & RLS (tout additif)

### Phase 1 — lecture (aucun changement de schéma)
- **Étendre `listActionAggByOrgIds`** (`src/services/planActionService.ts`) : ajouter `date_echeance` (et `origine` en Phase 2) au `select`, dériver `actionsRetard` (`date_echeance < today` ET `statut != 'termine'`). `actionsBloque` déjà agrégé. SELECT descendant déjà autorisé par `pactions_select`.
- Essentiels KO par Faritany via `getDashboardStatsByOrgIds` (déjà OK, `dash_select` descendant).

### Phase 2 — capture

**Table `appui_faritany`** :
```
id uuid pk default gen_random_uuid()
org_id uuid not null references organisations(id)   -- le Faritany
statut appui_statut not null default 'ouvert'        -- enum ('ouvert','clos')
referent_user_id uuid references users(id)           -- référent national (nullable)
note text
ouvert_at timestamptz not null default now()
ouvert_par uuid
clos_at timestamptz
updated_at timestamptz default now()
UNIQUE (org_id) WHERE statut='ouvert'                -- un seul appui actif par Faritany
```

**Tag origine** : enum `action_origine ('regionale','nationale')` + colonne `origine action_origine not null default 'regionale'` sur `plan_actions`.

**RLS (4 policies additives) :**
| Policy | Table | Qui | Quoi |
|---|---|---|---|
| `appui_select` | appui_faritany | admin_global · org = mon org (chip région) · osn/region si org descendant | SELECT |
| `appui_write` | appui_faritany | admin_global · osn/region si org descendant | INSERT/UPDATE (région exclue) |
| `plans_insert_descendant` | plans_action | osn/region si `org.parent_id = mon org` | INSERT (créer plan si absent) |
| `pactions_write_descendant` | plan_actions | osn/region si plan.org descendant | INSERT/UPDATE (USING + WITH CHECK) |

**Justification RLS** : `plans_insert` actuel n'autorise le non-admin qu'à créer un plan sur son propre org (et exclut `responsable_region`) ; `pactions_write` n'a pas de clause descendant. Sans ces deux ajouts, le national ne peut ni créer un plan ni une action dans un Faritany → la capture d'appui est bloquée (aujourd'hui seul `admin_global` passe).

## 6. Dégradation pilote

La prod est quasi vide (pilote en cours de seed). Règle : **absence/zéros ne se rendent jamais comme « tout va bien »**.
- **National** : 33 Faritany toujours présents ; non évalués = ligne atténuée « non évalué » (jamais filtrés) ; grille 2×2 les compte à part ; bandeau « X évalués / 33 ».
- **Régional** : non évalué → « Aucune évaluation en cours » ; tout traité → « Aucune priorité — X actions terminées » (distinguer *tout fait* de *rien commencé*).

## 7. Tests (TDD, vitest)

- **Utils purs** : `ordonnerPrioritesRegionales` ; `deriverStatutFaritany` (dont angle mort KO + 0 action) ; `bucketiser2x2` ; extension `actionsRetard` (bornes hier/aujourd'hui/demain × statut).
- **RTL** : watchlist (tri, groupement province, ligne non évalué) ; cockpit régional (file, badge national, états vides).
- **RLS** (`rlsPolicies.test` étendu) : `appui_faritany` (région lit sa ligne, national écrit descendant, cross-arbre bloqué) ; `plans_insert_descendant` ; `pactions_write_descendant`. ⚠️ forger `user_role` (pas `role`) — piège harness documenté.
- Pas de scoring touché → pas de test de parité SQL.

## 8. Phasage (livrables)

- **Phase 1 — Révéler** : extension agrégation retard + 2 cockpits en lecture + routes/nav/i18n (fr/en, mg fallback) + RoleGuards + dégradation. **Zéro migration** → déployable frontend seul, valeur dès le seed pilote.
- **Phase 2 — Capturer** : migration (table + enum/colonne + 4 RLS) + drill-down national enrichi (marquer en appui / référent / créer action d'appui) + badge « national » & chip « en appui » régional + compteur actions nationales. Apply prod + smoke RLS (BEGIN/ROLLBACK sous vrai JWT).

## 9. Hors périmètre (YAGNI)

Évolution inter-cycles (pas de snapshot historique), score composite, accusé de réception d'appui côté région. *(Notif best-effort à la création d'action nationale via le module existant : optionnelle.)*

## 10. Fichiers — réutilisés / nouveaux (indicatif)

**Réutilisés** : `getDashboardStatsByOrgIds`, `listActionAggByOrgIds`/`listPlanStatsByOrgIds`, `grouperParProvince`, `KpiStrip`, `AsnComparisonTable` (patron groupement), `RoleGuard`, module notifications (Phase 2 optionnel), i18n `src/i18n/{fr,en}.ts`.
**Nouveaux (indicatif)** : pages `DashboardPilotageNationalPage` / `DashboardPilotageRegionalPage` ; utils `ordonnerPrioritesRegionales`, `deriverStatutFaritany`, `bucketiser2x2` ; store(s) de cockpit ; migration Phase 2 ; service appui (Phase 2).

## 11. Risques & vérifications

- **RLS descendant** : prouver en prod (smoke BEGIN/ROLLBACK JWT `responsable_osn`) avant de considérer la capture livrée — patron du projet (« prouver en prod avant de corriger/livrer »).
- **Build** : `tsc -b` (PAS `-p`), `node node_modules/vite/bin/vite.js build`, suite `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'`.
- **Persistance fichiers** : dépôt sur `/mnt/d` → écrire via `cat` heredoc / `sed`, pas Edit/Write (watcher OneDrive).
- **Pilote** : vérifier le rendu réel des cockpits une fois les données seedées (Phase 1 dépend de la saisie terrain).
