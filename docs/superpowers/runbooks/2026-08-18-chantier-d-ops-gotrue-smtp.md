# Runbook ops — Chantier D : GoTrue GSAT → Gmail SMTP

> À exécuter quand le firewall VPS est rouvert et l'App Password Gmail fourni.
> Objectif : GoTrue de la prod envoie de vrais emails de recovery (au lieu d'inbucket)
> et les liens pointent sur `https://gsat.tily-digital.com/reset-password`.

## Pré-requis
- Firewall hPanel Hostinger : rouvrir l'egress dev (bloc /24 courant, cf. gotcha `/24`)
  sur 22/80/443. Vérifier : `ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 'echo OK'`.
- App Password Gmail de `digitaltily@gmail.com` (16 caractères) en main — secret,
  jamais collé dans un commit ni un log.
- WARP off.
- Frontend Chantier D déployé (branche `feat/chantier-d-recovery` mergée +
  `dist/` rsync sur `/var/www/gsat-frontend`) — sinon le lien atterrit sur une
  route inconnue.

## 0. Backup
    ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
      'cp /var/www/gsat/supabase/config.toml /root/config.toml.bak-$(date +%Y%m%d-%H%M%S); \
       docker inspect supabase_auth_gsat > /root/auth_inspect_pre_D.json'

## 1. Inspection live (fige le modèle de gestion + noms de vars)
    ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
      'docker inspect supabase_auth_gsat --format "{{range .Config.Env}}{{println .}}{{end}}"' \
      | grep -iE 'SMTP|MAILER|SITE_URL|EXTERNAL_URL|URI_ALLOW|AUTOCONFIRM|PASSWORD_MIN'
- Noter : GOTRUE_SMTP_* actuels, GOTRUE_SITE_URL, API_EXTERNAL_URL/GOTRUE_API_EXTERNAL_URL,
  GOTRUE_URI_ALLOW_LIST, GOTRUE_MAILER_AUTOCONFIRM, GOTRUE_PASSWORD_MIN_LENGTH.
- Déterminer le modèle : env fourni par config.toml (stack CLI) vs env docker direct.
  → conditionne l'étape 3 (persistance) et 4 (restart scope).

## 2. Valeurs cibles
- GOTRUE_SMTP_HOST=smtp.gmail.com
- GOTRUE_SMTP_PORT=587        # STARTTLS d'abord ; si échec TLS aux logs, tester 465
- GOTRUE_SMTP_USER=digitaltily@gmail.com
- GOTRUE_SMTP_PASS=<App Password>          # secret
- GOTRUE_SMTP_ADMIN_EMAIL=digitaltily@gmail.com
- GOTRUE_SMTP_SENDER_NAME=GSAT — TEM Madagascar
- GOTRUE_SITE_URL=https://gsat.tily-digital.com
- (API externe)=https://gsat-api.tily-digital.com
- GOTRUE_URI_ALLOW_LIST inclut EXACTEMENT https://gsat.tily-digital.com/reset-password
- GOTRUE_MAILER_AUTOCONFIRM=true           # conservé
- Vérifier GOTRUE_PASSWORD_MIN_LENGTH ≤ 8 (l'UI impose 8).

## 3. Appliquer (selon modèle de l'étape 1)
- Si config.toml [auth] / [auth.email.smtp] : éditer config.toml (backup fait),
  renseigner host/port/user/pass/admin_email/sender_name, site_url, external_url,
  additional_redirect_urls.
- Persistance : le secret PASS peut être injecté via env/secret plutôt qu'en clair
  dans config.toml selon ce que lit le stack — choisir la voie qui persiste ET
  garde le secret root-only.

## 4. Redémarrer (scope minimal)
- Si possible, ne redémarrer que l'auth : `docker restart supabase_auth_gsat`.
- Si le stack est CLI et n'applique le config.toml qu'au boot complet :
  `supabase stop && supabase start` dans /var/www/gsat (⚠️ brève coupure de tous
  les conteneurs gsat + interaction possible avec le secret JWT custom — prévenir).

## 5. Vérifier le fallback SPA nginx (pas une hypothèse)
    curl -I https://gsat.tily-digital.com/reset-password
- Attendu : 200 servant index.html (pas 404). Sinon ajouter `try_files $uri /index.html;`
  au bloc nginx du frontend et `nginx -t && systemctl reload nginx`.

## 6. Smoke end-to-end
1. Depuis le navigateur : /forgot-password → email d'un compte réel de test
   (une boîte que tu contrôles ; à défaut, admin). ⚠️ Rate-limit GoTrue :
   ~60 s entre deux demandes pour le même email + cap horaire → ne pas confondre
   un 429 avec « email cassé ».
2. Surveiller les logs auth en parallèle :
   `ssh … 'docker logs -f --tail 50 supabase_auth_gsat'` — repérer un envoi OK
   ou une erreur TLS/handshake (→ bascule port 465).
3. Réception de l'email → cliquer le lien → doit atterrir sur /reset-password
   (page « choisir un nouveau mot de passe », pas « lien invalide »).
   - Si « lien invalide » : vérifier le flow. Si l'URL contient `?code=`, la page
     tente déjà l'échange (ensureRecoverySession) ; si elle contient
     `#access_token`, detectSessionInUrl suffit. Si échec persistant en PKCE,
     ajouter `flowType: 'pkce'` dans src/services/supabase.ts (options auth) puis
     re-déployer le frontend.
4. Saisir un nouveau mot de passe (≥ 8) → succès → redirection /login → se
   connecter avec le nouveau mot de passe.
5. Rejouer avec un compte responsable_asn (ex. ant.01@tem.mg) pour confirmer le
   chemin réel des 33.

## 7. Rollback
- Restaurer config.toml depuis /root/config.toml.bak-* + restart auth
  (`docker restart supabase_auth_gsat`, ou `supabase stop && supabase start`
  selon le modèle).

## Notes de suivi
- Follow-up hors périmètre : templates d'email brandés FR (sujet/corps custom).
- Si SMTP mutualisé avec les autres apps TEM voulu plus tard : centraliser le
  secret plutôt que le dupliquer par stack.
