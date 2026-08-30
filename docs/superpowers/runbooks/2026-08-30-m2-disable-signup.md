# Runbook ops — M2 : désactiver l'auto-inscription GoTrue (prod GSAT)

**Constat** (audit go-live) : `GOTRUE_DISABLE_SIGNUP=false` + `GOTRUE_MAILER_AUTOCONFIRM=true` en prod → tout internaute crée un compte actif et lit les tables `USING(TRUE)` (annuaire OSN/ASN, référentiel, campagnes). Les comptes sont provisionnés par admin (`manage-user`) → l'auto-inscription publique doit être fermée.

**Pourquoi ce n'est pas fait pendant l'audit** : le stack est piloté par la CLI Supabase (conteneurs `supabase_*_gsat`, config `/var/www/gsat/supabase/config.toml`). `GOTRUE_DISABLE_SIGNUP` dérive de `[auth] enable_signup`. Le changer = éditer config.toml + `supabase stop && supabase start` = **redémarrage complet du stack gsat** (brève coupure totale) + risque : la CLI n'est pas dans le PATH (seul `npx`, risque de mismatch de version sur un stack existant) et un restart applique tout drift latent du config.toml. À faire comme action ops délibérée.

## Pré-check
```bash
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209
docker exec supabase_auth_gsat printenv | grep -E 'DISABLE_SIGNUP|MAILER_AUTOCONFIRM'   # attendu: DISABLE_SIGNUP=false
sed -n '52,66p' /var/www/gsat/supabase/config.toml   # bloc [auth], enable_signup ligne 60
cp /var/www/gsat/supabase/config.toml /root/config.toml.bak-$(date +%Y%m%d-%H%M%S)
```

## Application
1. Éditer `/var/www/gsat/supabase/config.toml`, ligne 60 (bloc `[auth]`) :
   ```
   enable_signup = false
   ```
   (NE PAS toucher ligne 65 `[auth.email] enable_signup` sauf si l'on veut aussi bloquer la voie email spécifiquement ; ligne 60 suffit à poser `GOTRUE_DISABLE_SIGNUP=true`.)
2. Localiser la CLI puis redémarrer le stack **dans** `/var/www/gsat` :
   ```bash
   cd /var/www/gsat
   # verifier la version CLI utilisee historiquement AVANT (mem: 2.84.2). Si npx, EPINGLER la version :
   npx --yes supabase@<version_connue> stop
   npx --yes supabase@<version_connue> start
   ```
   ⚠️ Vérifier qu'`[edge_runtime] enabled=true` (l.75) et `[inbucket]` restent cohérents (le restart les réapplique).
3. Post-check :
   ```bash
   docker exec supabase_auth_gsat printenv | grep DISABLE_SIGNUP   # attendu: true
   # smoke : un POST /auth/v1/signup via kong doit renvoyer 422/403 (signup disabled)
   curl -s -o /dev/null -w '%{http_code}\n' -X POST https://gsat-api.tily-digital.com/auth/v1/signup \
     -H 'apikey: <ANON>' -H 'Content-Type: application/json' -d '{"email":"t@t.co","password":"xxxxxxxx"}'
   ```
   Vérifier aussi que les 34 comptes existants se connectent toujours (login `ant.01@tem.mg`), et que l'edge (`manage-user`) répond.

## Rollback
Restaurer `config.toml` depuis le backup + `supabase stop/start`. (Ou `enable_signup = true`.)

## Notes
- Alternative sans restart (si l'on veut éviter la coupure) : bloquer `POST /auth/v1/signup` au niveau nginx/kong. Plus léger mais détourne la conf GoTrue — à évaluer.
- Corréler avec le Chantier D (SMTP) qui exige aussi un ajustement GoTrue : grouper les deux dans un seul restart pour ne couper qu'une fois.
