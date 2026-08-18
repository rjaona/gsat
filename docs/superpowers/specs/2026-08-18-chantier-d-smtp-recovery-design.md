# Chantier D — SMTP réel + récupération de mot de passe bout-en-bout

- **Date** : 2026-08-18
- **Statut** : design approuvé
- **Périmètre** : LOT 4 différé « D » de GSAT-Faritany
- **Repo** : `/mnt/d/Mes Documents/GSAT/gsat-v2` (origin `github.com/rjaona/gsat`), base master `0bce7f3`

## Problème

GoTrue de la prod GSAT envoie tous les mails d'authentification vers **inbucket**
(`GOTRUE_SMTP_HOST=supabase_inbucket_gsat`, catcher local `:1025`) et pointe ses URLs
sur `127.0.0.1`. Conséquence : **aucun mail d'auth ne quitte le serveur** et le
parcours « mot de passe oublié » est inutilisable. Par ailleurs le frontend
**n'a aucun parcours de reset** (pas de `resetPasswordForEmail`, pas de page de
réinitialisation, pas de gestion de l'event `PASSWORD_RECOVERY`, seule la route
`/login` existe).

Besoin réel : les **33 comptes `responsable_asn`** + l'**admin** doivent pouvoir
réinitialiser leur mot de passe eux-mêmes via un email réel.

## Objectif

Recovery de mot de passe **bout-en-bout** : un utilisateur demande une
réinitialisation, reçoit un vrai email, clique le lien, atterrit sur une page de
l'app, définit un nouveau mot de passe, puis se connecte.

Hors périmètre (v1) : templates d'email brandés / sujets FR custom (follow-up),
confirmation d'inscription publique (les comptes restent créés par admin,
`MAILER_AUTOCONFIRM=true` conservé), magic-links (l'app utilise login mot de passe).

## Contexte technique constaté

- Frontend : **`createBrowserRouter`** (chemins propres, pas de hash routing) →
  le lien de recovery peut viser `https://gsat.tily-digital.com/reset-password`
  sans collision de fragment d'URL.
- Client Supabase (`src/services/supabase.ts`) : `detectSessionInUrl: true`,
  `storage: sessionStorage`, `persistSession: true`, `autoRefreshToken: true`.
  → Au chargement de `/reset-password`, supabase-js parse les tokens de l'URL,
  établit une session de recovery et émet `PASSWORD_RECOVERY` via
  `onAuthStateChange`.
- `/login` est une route **publique** (hors `PrivateRoute`). Les nouvelles routes
  `/forgot-password` et `/reset-password` se calquent dessus (publiques).
- **Aucune logique « déjà authentifié → redirige » (vérifié)** : `LoginPage` ne
  navigue que dans son handler de submit (pas d'effet de redirection sur session),
  et `PrivateRoute` ne fait que renvoyer les *non*-authentifiés vers `/login`. Donc
  la session de recovery établie à l'arrivée sur `/reset-password` (route publique)
  **ne rebondit pas** l'utilisateur hors de la page. À re-vérifier si une telle
  logique est ajoutée d'ici l'implémentation.
- i18n : fichiers TS `src/i18n/fr.ts` / `src/i18n/en.ts` (mg en fallback), PAS de
  `.json`.
- Prod : Supabase self-hosted VPS Hostinger `76.13.37.209`, nginx sert
  `/var/www/gsat-frontend/`, API `gsat-api.tily-digital.com` → `127.0.0.1:54331`.

## Décisions

| Sujet | Décision |
|---|---|
| Périmètre | Recovery bout-en-bout (ops + frontend) |
| Fournisseur SMTP | Réutiliser Gmail `digitaltily@gmail.com` (`smtp.gmail.com:465` + App Password) |
| Expéditeur | `GSAT — TEM Madagascar <digitaltily@gmail.com>` |
| Autoconfirm | **Conservé `true`** (comptes admin-créés, pas de signup public) |
| Template email | Défaut GoTrue en v1 (branding en follow-up) |
| `redirectTo` | `window.location.origin + '/reset-password'` (→ prod `https://gsat.tily-digital.com/reset-password`, marche aussi en local) ; **doit figurer exactement dans `URI_ALLOW_LIST`** |
| Politique mot de passe | UI : longueur ≥ 8 + confirmation qui matche ; **doit égaler ou dépasser `GOTRUE_PASSWORD_MIN_LENGTH`** (défaut 6) — jamais plus laxiste que le serveur |
| Séquencement | **Frontend d'abord** (TDD), puis ops, puis smoke prod. La page reset reste « provisoire » jusqu'à confirmation du flow au smoke post-ops (cf. risque flow implicit/PKCE) |

## Architecture

### Workstream A — Ops VPS (GoTrue → vrai SMTP)

1. **Backup** de la config GoTrue actuelle (config.toml et/ou env du conteneur
   auth) avant toute modification.
2. **Inspecter le conteneur auth live** (`supabase_auth_gsat`) pour figer :
   - le **modèle de gestion** : stack piloté par la CLI Supabase (config.toml +
     `supabase stop/start`) vs env docker persistant. Détermine COMMENT persister
     un changement sans casser les autres conteneurs.
   - les **noms de variables exacts** et leurs valeurs courantes.
3. **Régler** (noms indicatifs, à confirmer selon le modèle) :
   - SMTP : host `smtp.gmail.com`, user `digitaltily@gmail.com`, pass = App
     Password (secret fourni à l'apply), admin email / sender name.
     - **Port : préférer `587` (STARTTLS)**, pas `465` (implicit TLS). GoTrue +
       Gmail sur 465 est historiquement capricieux ; 587/STARTTLS est le défaut
       qui marche. **Fallback documenté** : si 587 échoue, tester 465. Test
       discriminant à l'apply = envoyer un recovery et surveiller les logs
       `supabase_auth_gsat` pour une erreur TLS/handshake.
   - `SITE_URL = https://gsat.tily-digital.com` (aujourd'hui `127.0.0.1`).
   - URL API externe = `https://gsat-api.tily-digital.com` (aujourd'hui
     `127.0.0.1` → **c'est la cause des liens cassés**).
   - **Allow-list de redirection (`URI_ALLOW_LIST`) incluant EXACTEMENT**
     `https://gsat.tily-digital.com/reset-password`. ⚠️ Si le `redirectTo` du
     client n'est pas dans l'allow-list, GoTrue **retombe silencieusement sur
     `SITE_URL`** et jette le `redirectTo` → le lien atterrit à la racine, pas
     sur la page reset.
   - `MAILER_AUTOCONFIRM` conservé `true`.
   - **Noter `GOTRUE_PASSWORD_MIN_LENGTH`** (défaut 6) : l'UI reset doit
     l'égaler ou le dépasser (voir Décisions), sinon 4xx confus au submit.
4. **Persister + redémarrer** selon le modèle constaté. ⚠️ Si le stack est
   piloté par la CLI (config.toml, cf. mémoire), appliquer le SMTP peut imposer
   un **`supabase stop/start` complet** (redémarre TOUS les conteneurs gsat =
   brève coupure, et peut interagir avec le secret JWT custom). Vérifier à
   l'inspection s'il est possible de ne redémarrer que `supabase_auth_gsat` avec
   un changement qui **persiste**, sinon planifier la coupure.
5. **Vérifier le fallback SPA nginx** — étape explicite, PAS une hypothèse : le
   lien de recovery est le **premier deep-link froid** vers un chemin non-racine
   (`/login` n'est atteint que par redirection client depuis `/`, jamais en GET
   serveur froid). Test : `curl -I https://gsat.tily-digital.com/reset-password`
   doit renvoyer `index.html` (200), pas un 404. Corriger `try_files … /index.html`
   si absent.

Le secret Gmail (App Password) : stocké dans la config GoTrue sur le VPS
(root-only, comme les autres secrets SMTP de l'org), **jamais committé ni loggé**.

### Workstream B — Frontend (parcours reset)

1. **`authService`** — deux fonctions :
   - `requestPasswordReset(email: string)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })`.
   - `updatePassword(newPassword: string)` → `supabase.auth.updateUser({ password: newPassword })`.
2. **`/forgot-password`** (route publique, nouvelle page) : champ email → appelle
   `requestPasswordReset` → affiche un **message neutre** (« si un compte existe,
   un email a été envoyé ») quel que soit le résultat → **pas d'énumération
   d'utilisateurs** (comportement naturel de `resetPasswordForEmail`).
3. **`/reset-password`** (route publique, nouvelle page) — **flow-agnostic** :
   - On ne présume PAS du flow (implicit `#access_token=…` vs PKCE `?code=…`). La
     version de GoTrue n'est pas connue (firewall). La page attend une session
     par **`onAuthStateChange('PASSWORD_RECOVERY')` OU `getSession()`** ; si un
     `?code=` est présent sans session établie, tenter `exchangeCodeForSession`.
   - Si aucune session ne se matérialise → message « lien expiré/invalide,
     redemandez-en un » + lien retour vers `/forgot-password`.
   - Champs nouveau mot de passe + confirmation → `updatePassword` → succès →
     redirige `/login`.
   - ⚠️ **Dépendance résiduelle au flow serveur** : si l'apply ops révèle que
     GoTrue émet un lien PKCE, il faudra `flowType: 'pkce'` dans le client
     Supabase. Donc la page reset est **« provisoirement faite, à confirmer au
     smoke post-ops »** — ce n'est PAS 100 % indépendant du VPS.
4. **`LoginPage`** : ajouter le lien « Mot de passe oublié ? » vers
   `/forgot-password`.
5. **i18n** fr/en (mg fallback) : clés pour les 2 pages + le lien login.
6. **Router** : enregistrer les 2 routes publiques à côté de `/login`.

## Interfaces / unités

- `authService.requestPasswordReset(email)` : effet = déclenche l'envoi ; retour
  résolu même si l'email n'existe pas (anti-énumération). Dépend de `supabase`.
- `authService.updatePassword(pwd)` : effet = change le mot de passe de la session
  courante (recovery). Dépend de `supabase` + d'une session active.
- `ForgotPasswordPage` : formulaire → `requestPasswordReset` → état « envoyé ».
- `ResetPasswordPage` : session recovery → formulaire → `updatePassword` →
  redirection. Gère l'absence de session.

## Stratégie de test

- **Frontend en TDD** :
  - `authService` : mock du client supabase, vérifier `resetPasswordForEmail`
    appelé avec le bon `redirectTo` ; `updateUser` appelé avec le mot de passe.
  - `ForgotPasswordPage` (RTL) : soumission → message neutre affiché ; pas de
    fuite selon existence du compte.
  - `ResetPasswordPage` (RTL) : avec session → soumission met à jour + redirige ;
    sans session → erreur + lien retour ; validation confirmation ≠.
  - Présence des clés i18n fr/en.
  - Gates : `node node_modules/typescript/bin/tsc -b` = 0 ;
    `node node_modules/vitest/vitest.mjs run --exclude '**/*.diff.test.ts'` verts ;
    `node node_modules/vite/bin/vite.js build` OK.
- **Ops = smoke réel** (non unit-testable) : après apply prod, déclencher un vrai
  recovery vers une boîte réelle → clic lien → atterrit `/reset-password` →
  change le mot de passe → login OK. Puis valider le chemin d'un compte
  `responsable_asn`.

## Risques / dépendances

- **Firewall VPS** : SSH port 22 en timeout depuis la machine dev (egress qui
  glisse dans le `/24`, cf. gotcha récurrent). À rouvrir dans hPanel **avant
  l'apply ops**. Le frontend se développe sans dépendance VPS.
- **App Password Gmail** : fourni au moment de l'apply, traité en secret.
- **Modèle de gestion du stack** : figé à l'inspection live ; conditionne la
  persistance du changement. Si CLI/config.toml, un `supabase stop/start` complet
  peut être requis (brève coupure de tous les conteneurs gsat + interaction
  possible avec le secret JWT custom) — à trancher à l'inspection.
- **Fallback nginx** : à confirmer par `curl -I` pour `/reset-password` (pas une
  hypothèse).
- **Flow implicit vs PKCE** (le plus susceptible de mordre) : inconnu tant que
  GoTrue n'est pas lisible ; peut imposer `flowType: 'pkce'` côté client après le
  smoke. La page reset est buildée flow-agnostic pour amortir, mais un ajustement
  post-ops reste possible.
- **Port SMTP** : 587/STARTTLS préféré, 465 en fallback ; à discriminer aux logs
  auth à l'apply.
- **Rate-limit GoTrue au smoke** : fréquence par email (~60 s) + cap horaire.
  Pendant la vérif on retente vite → ne pas confondre un rate-limit avec un
  « email cassé ». À noter dans le runbook.

## Séquencement

1. Frontend (TDD) → PR → merge.
2. Ops (firewall rouvert) : backup → inspection → apply → restart → vérif nginx.
3. Smoke end-to-end en prod (email réel → reset → login).
4. Déploiement frontend (rsync `dist/` → `/var/www/gsat-frontend`, cf. runbook
   LOT 4 Indice) si pas déjà couvert par un déploiement en cours.

## Livrables

- Frontend : `authService` (+2 fn), `ForgotPasswordPage`, `ResetPasswordPage`,
  lien login, routes, i18n fr/en, tests.
- Ops : config GoTrue prod modifiée (SMTP + URLs + allow-list), backup, vérif nginx.
- Doc : ce spec + plan d'implémentation + runbook ops de l'apply.
