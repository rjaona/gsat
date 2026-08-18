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
| Séquencement | **Frontend d'abord** (TDD, sans dépendance VPS), puis ops, puis smoke prod |

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
   - SMTP : host `smtp.gmail.com`, port `465`, user `digitaltily@gmail.com`,
     pass = App Password (secret fourni à l'apply), admin email / sender name.
   - `SITE_URL = https://gsat.tily-digital.com` (aujourd'hui `127.0.0.1`).
   - URL API externe = `https://gsat-api.tily-digital.com` (aujourd'hui
     `127.0.0.1` → **c'est la cause des liens cassés**).
   - Allow-list de redirection incluant `https://gsat.tily-digital.com/reset-password`.
   - `MAILER_AUTOCONFIRM` conservé `true`.
4. **Persister + redémarrer** le conteneur auth selon le modèle constaté.
5. **Vérifier le fallback SPA nginx** (`try_files … /index.html`) : le lien de
   recovery est un **chargement frais** de `/reset-password` → nginx doit servir
   `index.html` (probable, car `/login` fonctionne déjà en deep-link, mais à
   confirmer explicitement).

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
3. **`/reset-password`** (route publique, nouvelle page) :
   - À l'arrivée, la session de recovery est déjà établie par `detectSessionInUrl` ;
     on s'appuie sur l'event `PASSWORD_RECOVERY` et/ou la présence d'une session.
   - Champs nouveau mot de passe + confirmation → `updatePassword` → succès →
     redirige `/login`.
   - Lien expiré/invalide (aucune session) → message d'erreur + lien retour vers
     `/forgot-password`.
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
  persistance du changement sans casser les autres conteneurs.
- **Fallback nginx** : à confirmer pour `/reset-password`.

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
