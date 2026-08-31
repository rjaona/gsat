# GSAT Digital V2 — Conventions du projet

Dernière mise à jour : 2026-08-04
Base de données : **Supabase / PostgreSQL** (instance self-hosted, VPS Hostinger KVM2)

> ⚠️ **Ce fichier a été corrigé le 2026-08-04.** Les versions précédentes décrivaient
> une stack Firebase / Firestore. **Le projet a migré sur Supabase** : le code utilise
> `services/supabase.ts`, `supabase/reference/schema.sql` et `types/supabase.generated.ts`.
> N'écris **jamais** de `collection()`, `doc()`, `onSnapshot()`, `serverTimestamp()`
> ni d'import `firebase/*` : il n'y a plus de Firestore derrière.

---

## Stack

| Couche | Choix |
|---|---|
| Frontend | React 19 + Vite 6 + TypeScript strict |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"` dans `index.css`) — **pas de `tailwind.config.js`** |
| Backend | **Supabase** : PostgreSQL, Auth (JWT + custom access token hook), Storage, Edge Functions (Deno) |
| Client DB | `@supabase/supabase-js` — requêtes SQL typées, Realtime via `postgres_changes` |
| State | Zustand 5 |
| Cartographie | Leaflet + react-leaflet 5 |
| Graphiques | Recharts |
| Icônes | Lucide React |
| i18n | react-i18next + i18next-browser-languagedetector — **fr (défaut), en, mg** |
| Routing | react-router-dom v7 |
| Export | jsPDF + jspdf-autotable |
| Tests | Vitest + @testing-library/react + @testing-library/jest-dom |

TypeScript strict : `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
`noPropertyAccessFromIndexSignature`. Donc :

- props optionnelles → `prop?: T | undefined`
- `array[i]` retourne `T | undefined`
- variables d'env → `import.meta.env['VITE_*']` (notation crochets)
- pas de `any` sauf cas extrême documenté

---

## Accès aux données — règles non négociables

1. **Tout passe par `services/`.** Un composant n'importe jamais `supabase` directement.
2. **Un service = une table ou un domaine**, avec deux fonctions de conversion
   `rowToX()` / `payloadToRow()` (snake_case en base ↔ camelCase côté app).
   Voir `organisationService.ts` comme modèle de référence.
3. **Realtime** : `supabase.channel(...).on('postgres_changes', ...)`, et la fonction
   d'abonnement **retourne toujours son unsubscribe** :
   ```ts
   return () => { void supabase.removeChannel(channel); };
   ```
4. **Jamais de logique d'autorisation côté client seul.** La RLS fait foi ; le filtrage
   côté UI n'est que du confort.
5. **Les colonnes `dashboard_stats` sont en lecture seule côté client** — elles sont
   écrites par le trigger `on_score_write`.

---

## Modèle organisationnel

```
OMMS
 └── REGION (6 régions OMMS)
      └── OSN (une par pays)           ← TEM Madagascar
           └── ASN                     ← les 33 Faritany de TEM
```

- **Il n'existe pas de type `FARITANY`.** Pour TEM, `ASN` = Faritany. Le libellé affiché
  vient de `system_config.libelle_niveau_local` (`'Faritany'` pour TEM) — ne code jamais
  « ASN » ni « Faritany » en dur dans l'UI, passe par i18n + ce champ.
- **La province n'est pas un niveau d'organisation.** C'est le préfixe de
  `organisations.code` (`ANT-`, `TOA-`, `MAH-`, `FIA-`, `TOL-`, `DIA-`, `DSP-`), utilisé
  pour grouper à l'affichage.
- `organisations.poids` sert de pondération de consolidation (effectif). Défaut 1.

---

## Référentiels

Deux référentiels coexistent, distingués par `referentiel_versions.niveau` :

| Version | Niveau | Contenu |
|---|---|---|
| `v3_0` | OSN | GSAT V3.0 — 105 critères, 20 essentiels |
| `far_v1_0` | ASN | GSAT-Faritany v1.0 — 76 critères (42 socle, 17 essentiels), `parent_version = 'v3_0'` |

Règles :

- **La version à charger vient toujours de la campagne** (`campagnes.referentiel_version`),
  jamais d'un défaut codé en dur. `getReferentiel()` ne doit plus avoir `'v3_0'` en valeur
  par défaut.
- `criteres.source_codes` porte la filiation vers les critères GSAT parents. C'est ce qui
  rend calculable l'Indice de Déploiement — **ne jamais insérer un critère Faritany sans
  renseigner `source_codes`**.
- `criteres.socle` : en mode campagne `socle`, seuls les critères `socle = TRUE` entrent
  dans le score. Les autres restent saisissables et stockés.
- Une évaluation clôturée est figée sur sa version. Modifier un critère n'affecte que les
  évaluations futures.

---

## Scoring — les pièges

Le calcul vit à **deux endroits qui doivent rester identiques** :
- **SQL** : `fn_recalculate_scores` — source canonique = migration
  `supabase/migrations/20260804_faritany.sql` (version corrigée : N/A exclu du
  dénominateur via FILTER, mode socle). `supabase/reference/trigger_on_score_write.sql`
  en porte une **copie verbatim** (audit M5) + crée le trigger `on_score_write`.
- **TS** : `src/services/scoring.ts` (PAS `referentielService.ts`).
Toute modification de l'un impose l'autre + `__tests__/scoring.test.ts` ; la
parité SQL↔TS est vérifiée par `__tests__/parite-sql.diff.test.ts` (PG live requis).

```
score_dimension = round(somme_notes / (nb_criteres_comptes * 3) * 100, 2)
score_global    = moyenne des scores de dimension
```

Quatre règles à ne pas casser :

1. **N/A ≠ 0.** Une ligne `evaluation_scores` présente avec `note IS NULL` signifie
   « non applicable » : le critère sort du **numérateur et du dénominateur**.
   Une absence de ligne signifie « pas encore répondu » : compte 0, avec plein poids.
2. **Une dimension entièrement N/A est exclue de la moyenne globale**, pas notée 0.
3. **Un essentiel N/A n'est pas KO.** Seuls une note 0 ou une absence de réponse valent
   non-conformité.
4. **La consolidation ne mélange pas deux versions de référentiel.** Le champ
   `dashboard_stats.referentiel_version` sert à cloisonner.

---

## Workflow d'évaluation

```
brouillon → en_cours → validee ──────────────────► cloturee
                          │  (comité Faritany)  ▲   (revue OK, ou échéance dépassée)
                          │                     │
                          └── revision_requested (motif obligatoire) → en_cours
```

- **Auto-validation** : le rôle `responsable_asn` fait passer sa **propre** évaluation
  en `validee`. Le trigger `trg_garde_auto_validation` impose `pv_comite_path` et pose
  `revue_echeance_at = validee_at + system_config.revue_delai_jours` (60 j par défaut).
- **Revue nationale a posteriori**, non bloquante. Sans revue à l'échéance, le job
  `cloturer-evaluations-non-revues` (pg_cron, 02h30) clôture avec `cloturee_auto = TRUE`.
- Valider avec des essentiels à 0 **est autorisé** — mais déclenche une alerte critique
  et une notification au national. On ne pousse jamais quelqu'un à masquer un problème.

---

## Rôles

| Rôle | Portée |
|---|---|
| `admin_global` | Tout |
| `responsable_region` | Sa région, dashboards OSN |
| `responsable_osn` | Son OSN + ses ASN, campagnes, workflow, revue |
| `responsable_asn` | **Sa propre ASN uniquement** — saisie + auto-validation. Ne peut pas clôturer |
| `utilisateur_asn` | Saisie sur sa propre ASN, sans validation |
| `evaluateur` | Validation d'évaluations (évaluation accompagnée) |
| `lecteur` | Lecture seule |

Les claims (`role`, `org_id`, `org_type`, `parent_org_id`) sont injectés par le
**Custom Access Token Hook** (`supabase/reference/hook_custom_access_token.sql`) et lus en RLS via
`auth.jwt() ->> 'user_role'`. **Ne pose jamais un claim côté client** : passer par la Edge
Function `manage-user`.

---

## Structure `src/`

```
src/
├── services/            # Accès Supabase — un fichier par domaine
│   ├── supabase.ts      # init client — NE PAS MODIFIER
│   ├── authService.ts   # login (browserSessionPersistence), logout
│   ├── evaluationService.ts, campagneService.ts, planActionService.ts
│   ├── organisationService.ts        # modèle de référence pour rowToX/payloadToRow
│   ├── referentielService.ts         # chargement référentiel + scoring (miroir du trigger)
│   ├── dashboardService.ts, cartoService.ts, adminService.ts, auditService.ts
│   ├── notificationService.ts, storageService.ts, aiService.ts
│   └── pdf/             # pdfTheme, evaluationReport, actionPlanReport, validationReport
├── components/          # layout, auth, ui, evaluation, dashboard, campagnes, plan,
│                        # workflow, referential, audit, ai-assistant, report,
│                        # cartographie, admin, notifications, shared
├── pages/               # routées via src/router.tsx
├── stores/              # Zustand
├── hooks/
├── types/               # index.ts, roles.ts, workflow.ts, supabase.generated.ts
├── design/tokens.ts     # tokens JS
├── i18n/                # fr.ts, en.ts, mg.ts — TypeScript, PAS de JSON
├── data/                # referentiel_v3_0.json, far_v1_0.json
└── __tests__/
```

Côté base :

```
supabase/
├── schema.sql                        # tables, ENUM, index
├── rls_policies.sql                  # RLS
├── hook_custom_access_token.sql      # injection des claims JWT
├── trigger_on_score_write.sql        # fn_recalculate_scores
├── migrations/                       # migrations datées et additives
└── edge-functions/                   # manage-user, chat-with-ai (Deno)
```

---

## Design system — Stitch + WOSM

- **WOSM Purple** `#4B2E83` — accent principal, navigation active, titres
- **WOSM Yellow** `#FDB714` (Pantone 116C) — CTAs, badges
- Primary indigo `#15236e` · Secondary green `#3b6934` (scores élevés)
- **Cards sans bordure** — `shadow-card` uniquement (`0 8px 24px -4px rgba(23,28,34,.06)`)
- **Inputs recessed** — fond `surface-container-highest`, bordure transparente → `primary` au focus
- **Nav active** — barre violette 3px à gauche + fond `#EDE7F6`
- **Glass panels** — `bg-white/85 backdrop-blur-md`
- Tokens JS `src/design/tokens.ts` · tokens CSS `src/index.css` (`--wosm-purple`, `.btn-wosm`, `.card-hover`)
- Utiliser les classes Tailwind v4 du bloc `@theme` : `bg-wosm-purple`, `text-wosm-yellow`

Contrainte produit : **application 100 % en ligne, aucun mode offline** (décision projet).
Conséquences à respecter dans tout écran de saisie :

- écriture serveur à chaque note (debounce 500 ms sur les commentaires), jamais un bouton
  « Enregistrer » sur lequel reposerait deux heures de travail ;
- reprise au critère exact où l'utilisateur s'est arrêté ;
- chargement des dimensions à la demande, pas les 76 critères d'un coup ;
- état réseau visible en permanence : « Enregistré » / « Envoi… » / « Échec — réessayer ».

---

## i18n

- Fichiers **TypeScript** (`fr.ts`, `en.ts`, `mg.ts`), pas JSON.
- `useTranslation()` — jamais de chaîne codée en dur.
- Toute nouvelle clé va dans **les trois fichiers**.
- Le malgache est la langue de travail des Faritany : une clé `mg` manquante est un bug,
  pas un détail cosmétique.
- Namespaces : nav, common, auth, evaluation, evaluationList, campagne, planAction,
  tracking, dashboard, dashboardGlobal, dashboardFaritany, cartographie, admin, validation,
  report, pdf, workflow, alertes, erp, aiAssistant.

---

## Sécurité

- **RLS d'abord.** Chaque nouvelle table : policies écrites *et testées*
  (`__tests__/security/`) avant toute utilisation côté app.
- `RoleGuard` sur les routes admin, sidebar filtrée par rôle.
- `browserSessionPersistence` — session fermée à la fermeture du navigateur.
- Soft-delete utilisateur : `actif = false` + révocation des tokens.
- HTML échappé avant injection markdown (`ChatMessage`).
- Les listes d'utilisateurs sont filtrées par `org_id` — pas de fuite inter-tenant.
- Isolation à tester systématiquement : un `responsable_asn` du Faritany A ne doit
  **jamais** lire, écrire ni valider quoi que ce soit du Faritany B.

---

## Développement

```bash
npm run dev            # front
npm test               # Vitest
npx supabase start     # stack locale
npx supabase db reset  # rejoue schema + migrations + seed
```

Variables `.env.local` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

Ordre d'application en base : `schema.sql` → `migrations/*` → `rls_policies.sql`
→ `hook_custom_access_token.sql` → `trigger_on_score_write.sql` → seeds.

---

## Documents de référence

| Document | Contenu |
|---|---|
| `docs/GSAT-Faritany_Note-de-conception.md` | Concept, checklist des 76 critères, modèle de données, module Pilotage & alertes, Indice de Déploiement, arbitrages |
| `docs/PLAN_TACHES_FARITANY.md` | Découpage en tâches, niveau fichier |
| `docs/DEVELOPMENT_ROADMAP.md` | Roadmap des sprints (antérieure au chantier Faritany) |
| `src/data/far_v1_0.json` | Référentiel GSAT-Faritany — source du seed |
