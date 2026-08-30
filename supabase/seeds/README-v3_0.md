# Auto-évaluation OSN v3_0 — application en prod

Débloque les écarts de l'Indice de Déploiement en seedant le référentiel v3_0 +
en créant le scaffolding (campagne v3_0 + éval OSN `en_cours`). La **vraie** saisie
des scores est faite par TEM via le formulaire d'évaluation existant.

Prérequis : SSH natif `~/.ssh/id_ed25519` root@76.13.37.209 (**WARP off**). La
migration `20260804_faritany.sql` est déjà en prod (colonnes `socle/source_codes/
niveau/parent_version/*_mg`). Idempotent + additif (aucune donnée existante écrasée).

## 1. Backup
```
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
  "docker exec supabase_db_gsat pg_dump -U postgres postgres" \
  > gsat_backup_pre_v3_0_$(date +%Y%m%d-%H%M%S).sql
```

## 2. Seed du référentiel v3_0 (idempotent)
```
cat supabase/seeds/referentiel_v3_0_seed.sql | ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
  "docker exec -i supabase_db_gsat psql -U postgres -d postgres -v ON_ERROR_STOP=1"
```

## 3. Scaffolding campagne + éval OSN (idempotent)
```
cat supabase/seeds/campagne_eval_osn_v3_0.sql | ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
  "docker exec -i supabase_db_gsat psql -U postgres -d postgres -v ON_ERROR_STOP=1"
```

## 4. Recharger le cache PostgREST
```
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
  "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"NOTIFY pgrst, 'reload schema';\""
```

## 5. Post-conditions (attendu : refver=1, dims=10, crit=105, camp=1, ev=1)
```
ssh -i ~/.ssh/id_ed25519 root@76.13.37.209 \
  "docker exec -i supabase_db_gsat psql -U postgres -d postgres -c \"
SELECT (SELECT count(*) FROM referentiel_versions WHERE version='v3_0') AS refver,
       (SELECT count(*) FROM dimensions d JOIN referentiel_versions r ON d.ref_id=r.id WHERE r.version='v3_0') AS dims,
       (SELECT count(*) FROM criteres c JOIN dimensions d ON c.dimension_id=d.id JOIN referentiel_versions r ON d.ref_id=r.id WHERE r.version='v3_0') AS crit,
       (SELECT count(*) FROM campagnes WHERE referentiel_version='v3_0' AND statut='ouverte') AS camp,
       (SELECT count(*) FROM evaluations e JOIN campagnes ca ON e.campagne_id=ca.id WHERE ca.referentiel_version='v3_0' AND e.statut='en_cours') AS ev;\""
```

## 6. Saisie réelle (TEM)
Un utilisateur `responsable_osn` (org = OSN TEM) ouvre l'éval par lien direct
`https://gsat.tily-digital.com/#/evaluation/d3000000-0000-4000-8000-0000000e0001`,
saisit les 105 critères v3_0, puis Enregistre. Les écarts apparaissent dans
l'Indice de Déploiement (`/dashboard/indice`) dès qu'au moins un critère mappé
(parmi les 88) est noté. L'éval reste `en_cours` (validation formelle = étape
ultérieure, non requise pour les écarts).

> Note : `admin_global` doit exister en prod (il existe — cf. `admin@gsat`). Le
> scaffolding résout l'organisateur/created_by par `role='admin_global'` et l'OSN
> par `type='OSN'` (1 seul en prod), donc aucun UUID n'est codé en dur.

## Régénérer le SQL du référentiel (si le JSON change)
```
npx tsx scripts/gen_v3_0_seed.ts   # réécrit supabase/seeds/referentiel_v3_0_seed.sql
```

## Vérifié en local 2026-08-17
Les deux SQL appliqués sur la stack locale (54322) : post-conditions exactes
(refver=1/dims=10/crit=105/camp=1/ev=1), idempotence (ré-application sans erreur ni
doublon), et plombage prouvé (un score OSN v3_0 est sélectionné par la requête
« note nationale » de `indiceService`).
