# Auto-évaluation OSN v3_0 — débloquer les écarts de l'Indice de Déploiement

_LOT 4 · Chantier C · 2026-08-17_

## Problème

L'Indice de Déploiement affiche `écart = —` (mode « ID seul ») parce que la **note nationale** — issue d'une auto-évaluation de l'OSN sur le référentiel **v3_0** — n'existe pas. En prod, v3_0 n'a **jamais été seedé** dans Supabase (seul `far_v1_0` l'est). Objectif : permettre à l'OSN de réaliser une **vraie** auto-évaluation v3_0 (pas de scores fabriqués) afin que les écarts calculent.

## Faits établis (exploration)

- **Mapping codes = 88/88** : les 88 `sourceCodes` référencés par les critères far_v1_0 actifs sont tous présents parmi les 105 codes de critères v3_0. Dès que l'éval OSN écrit ses `evaluation_scores` (codes v3_0), les écarts calculent.
- **Le formulaire + la validation + les RLS supportent déjà une éval ciblant l'OSN** (policies de base en `user_role`) : SELECT / saisie scores / `brouillon→en_cours→soumise` passent pour `responsable_osn` (et `admin_global`) sur sa propre éval. Le formulaire est atteignable par lien direct (route `evaluation/:evalId`, pas de RoleGuard) et résout v3_0 une fois seedé.
- **Validation optionnelle** : `indiceService` prend « validée préférée, **sinon la plus récente** » → une éval OSN `en_cours` avec ≥1 score suffit aux écarts. (Le passage `→validee` est bloqué par un trigger PV trop large — **hors périmètre**, décision : on laisse l'éval `en_cours`.)
- **Nommage** : le JSON `referentiel_v3_0.json` a `"version": "3.0"`, mais tout le code attend **`'v3_0'`** (`indiceService.VERSION_NAT`, form, etc.). Le seed DOIT poser `version='v3_0'`.
- **Pré-requis indice** : `indiceService` renvoie `null` s'il n'y a pas aussi d'évals `far_v1_0` sous l'OSN → les écarts ne s'affichent qu'en présence des deux (Faritany + OSN v3_0).

## Décisions

- **Scaffolding par SQL** (patron Phases A/B), saisie réelle via le **formulaire existant**. Pas de nouvelle feature UI.
- **Validation** : on ne touche PAS au trigger `fn_garde_auto_validation`. L'éval OSN reste `en_cours` ; les écarts calculent via le fallback. Validation formelle = suivi ultérieur éventuel.
- Zéro changement de code applicatif runtime (formulaire/service inchangés). Le livrable = **outillage de seed + SQL de scaffolding + vérification**.

## Architecture

### 1. Seeder v3_0 (générateur SQL idempotent)

- **`scripts/gen_v3_0_seed.mjs`** (committé) : lit `src/data/referentiel_v3_0.json`, émet du SQL idempotent vers **`supabase/seeds/referentiel_v3_0_seed.sql`** (committé, = texte à coller/psql en prod).
- Upserts (patron `seed-referentiel-faritany.ts`) :
  - `referentiel_versions` `ON CONFLICT (version)` : **`version='v3_0'`**, `nom_fr/en` bruts, `nom_mg=NULL`, `niveau='OSN'`, `parent_version=NULL`, `actif=true`.
  - `dimensions` `ON CONFLICT (ref_id,code)` : `ref_id` résolu par sous-requête `(SELECT id FROM referentiel_versions WHERE version='v3_0')`, `code`, `nom_fr/en`, `nom_mg=NULL`, `ordre`.
  - `criteres` `ON CONFLICT (dimension_id,code)` : `dimension_id` résolu par clé naturelle, `code`, `libelle_fr/en`, `guide_fr/en` bruts, `libelle_mg/guide_mg=NULL`, `essentiel`, `actif`, `ordre` ; défauts pour colonnes absentes du JSON : **`socle=true`** (ignoré au niveau OSN, mode `complet`), **`source_codes='{}'`**, **`indicateur_erp='{}'`**.
- 10 dimensions, 105 critères. Réutilise la migration `20260804_faritany.sql` (colonnes `socle/source_codes/niveau/parent_version/*_mg`) — déjà en prod.

### 2. Scaffolding campagne + éval OSN

- **`supabase/seeds/campagne_eval_osn_v3_0.sql`** (committé, idempotent — UUIDs fixes ou `ON CONFLICT`) :
  - `campagnes` : `referentiel_version='v3_0'`, `mode='complet'`, `statut='ouverte'`, dates englobant la période, organisateur = OSN/admin, périmètre = OSN TEM.
  - `evaluations` : `org_id = OSN TEM (a0208b22-bfaa-4ac9-926d-3f7549823153)`, `campagne_id`, `type='auto'`, `statut='en_cours'`.
- Colonnes NOT NULL exactes à confirmer au moment du plan (lecture `schema.sql` `campagnes`/`evaluations`).

### 3. Saisie réelle + écarts (existant)

Le `responsable_osn` ouvre l'éval par lien direct → saisit les 105 critères v3_0 dans le formulaire existant → `getIndiceComplet()` renvoie des écarts non-nuls (les 88 codes mappent). Aucun code à écrire ici.

## Périmètre & environnement

- **Livré/testé par moi (local)** : générateur + SQL, appliqués sur la stack Supabase locale ; preuve E2E que, avec v3_0 seedé + une éval far_v1_0 + une éval OSN v3_0 scorée, `getIndiceComplet()` rend des écarts.
- **Reste à TEM / prod** : appliquer le SQL en prod (psql, comme Phase B) + TEM réalise la **vraie** saisie des scores.
- GSAT n'a qu'une stack (prod) ; pas de preprod. Seed idempotent + additif (aucune donnée existante écrasée).

## Tests / vérification

- **Unitaire** (durable) : `gen_v3_0_seed` — le SQL généré pose `version='v3_0'`, contient 105 critères / 10 dimensions, et **couvre les 88 sourceCodes** de far_v1_0 (garantit que les écarts pourront calculer). La logique d'écart elle-même est déjà couverte par `indiceService.test.ts`.
- **Intégration locale** (si stack dispo) : appliquer les 2 SQL sur la stack locale, saisir 1 score de test sur l'éval OSN, vérifier `getIndiceComplet().national[*].ecart` défini.
- **Idempotence** : ré-exécuter les SQL → aucune erreur, aucun doublon.

## Hors périmètre

- Feature UI « OSN self-eval » (création campagne/éval au niveau OSN dans l'app) — non retenu.
- Correction du trigger PV / validation formelle de l'éval OSN — laissé de côté (écarts calculent sans).
- v3_0 « standard mondial » multi-pays — l'éval est scopée à l'OSN parent des Faritany (déjà géré par `indiceService`).
