# Runbook — Pilote go-live bout-en-bout GSAT (2026-09-05)

Plan : `docs/superpowers/plans/2026-09-05-pilote-go-live-e2e.md`
Accès : `ssh -i ~/.ssh/id_ed25519 root@76.13.37.209` (WARP off) ; DB `docker exec -i supabase_db_gsat psql -U postgres -d postgres`.
Appels API exécutés SUR le VPS (kong `127.0.0.1:54331`) pour contourner le firewall.

## 0. Recon (valeurs capturées 2026-09-05, read-only)
- Baseline prod : `scores=0, evals=1, far_camps=0` ✅ (vierge, OK pour seed).
- ADMIN_UID   = `8e9b7ea9-40c9-4667-8139-efa46e451838` (admin@gsat.tily-digital.com, admin_global)
- OSN_ORG_ID  = `a0208b22-bfaa-4ac9-926d-3f7549823153` (Tily Eto Madagasikara, TEM) == parent des Faritany ✅
- Faritany pilotes (province Analamanga) :
  - ANT-01 `16d6ced0-40cb-5833-9888-767d89bc8f14` — ant.01@tem.mg
  - ANT-02 `9d92701c-2de8-5a50-90e5-f4d1b859b08f` — ant.02@tem.mg
  - ANT-03 `a9bd31b9-1704-5444-8d2e-d237a033d832` — ant.03@tem.mg
- V3_EVAL_ID  = `d3000000-0000-4000-8000-0000000e0001` (en_cours, org=OSN TEM, type=auto)
- V3_CAMP_ID  = `d3000000-0000-4000-8000-0000000c0001`
- Mots de passe : dans `/root/gsat_faritany_accounts.md` (VPS, root-only 0600) — JAMAIS dans le repo.
- ANON key : dérivée sur le VPS du bundle frontend :
  `ANON=$(grep -rhoE 'eyJhbGciOiJIUzI1Ni[A-Za-z0-9_.-]+' /var/www/gsat-frontend/assets/*.js | head -1)`
- WRITER v3_0 = **admin_global** — la policy `scores_write` autorise `user_role='admin_global'`
  à écrire sur toute éval en brouillon/en_cours sans borne d'org (pas besoin de créer un responsable_osn).
  Faritany : `scores_write_resp_asn` couvre ant.0x sur leur propre éval en_cours ✅.

## 1. Seed campagne + évals — voir Task 1
## 2. Matrice de scores — voir Task 2
## 3-4. Écriture scores — voir Tasks 3-4
## 5. Vérif backend — voir Task 5
## 6. Vérif frontend — voir Task 6
## 7. Teardown (documenté, NON exécuté — données conservées) — voir Task 7
