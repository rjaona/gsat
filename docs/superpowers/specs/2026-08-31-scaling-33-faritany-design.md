# Mise à l'échelle GSAT — 33 Faritany usage terrain

**Date** : 2026-08-31
**Contexte** : GSAT est prêt fonctionnellement (audit go-live clos, M3/M4 résolus). Les 33 comptes `responsable_asn` existent en prod. Avant le lancement terrain, 4 points de mise à l'échelle doivent être adressés.

**Scénario cible** : usage mixte — pic initial (~33 utilisateurs simultanés) puis usage étalé (~5-10 simultanés). VPS Hostinger KVM2 (76.13.37.209), Supabase self-hosted.

**Approche** : chirurgicale (4 items à fort impact, effort minimal ~2-3 jours).

---

## 1. Debounce `writeScore` (perf — haute priorité)

### Problème

`evaluationStore.saveScore()` appelle `evaluationService.writeScore()` immédiatement à chaque clic sur une note. Chaque upsert déclenche le trigger `fn_recalculate_scores` (recalcul dimensions + dashboard_stats ASN + propagation OSN parent). Avec 33 évaluateurs cliquant rapidement sur ~60 critères, cela produit des centaines d'upserts concurrents et autant de cascades trigger.

### Design

- **Debounce 800ms** dans `evaluationStore.saveScore()`. Un seul timer par `evalId`. Le dernier clic dans la fenêtre gagne. Le service `writeScore()` reste inchangé (API directe).
- **Optimistic update local immédiat** : déjà en place, l'utilisateur voit sa note changer sans délai.
- **Indicateur visuel** : `SaveStatusIndicator` (existant, `components/ui`) gagne un état « En attente… » pendant le debounce. Transitions : clic → `pending` (attente debounce) → `saving` (envoi réseau) → `saved` | `error`.
- **Flush obligatoire** : au `beforeunload` (fermeture onglet) et au changement de route (flush synchrone, annule le timer et envoie immédiatement).
- **Pas de batching** : 1 upsert par critère (le dernier). Le trigger recalcule tout à chaque écriture ; batcher N critères ne réduit que le coût réseau, pas le coût trigger. Non justifié pour 33 users.

### Fichiers touchés

- `src/stores/evaluationStore.ts` — ajout debounce + flush
- `src/components/ui/SaveStatusIndicator.tsx` — état `pending`
- Tests unitaires debounce (timer mock)

---

## 2. Filtrer les channels Realtime (perf — moyenne priorité)

### Problème

3 channels Realtime sont globaux (sans filtre `.eq()`) et broadcastent à tous les clients connectés :
- `evaluations-all` sur `evaluations`
- `campagnes-realtime` sur `campagnes`
- `organisations-realtime` sur `organisations`

Avec 33 clients simultanés, chaque écriture de score (qui met à jour `evaluations.updated_at` via le trigger) envoie un événement WebSocket à 33 clients inutilement.

### Design

- **`evaluations-all` → supprimer**. Redondant avec `evals-org-{orgId}` et `evals-campagne-{campagneId}` qui existent déjà. Les pages admin/OSN qui listaient toutes les évals passent en **refetch à l'entrée de page** (appel service au `useEffect` mount).
- **`campagnes-realtime` → supprimer + refetch**. Les campagnes changent rarement (création/fermeture). Refetch à l'entrée de page suffit.
- **`organisations-realtime` → supprimer + refetch**. Les organisations ne changent quasi jamais en exploitation.

Résultat : 0 channel global. Les channels filtrés existants (`evals-org-{orgId}`, `scores-{evalId}`, `notifications-{userId}`, etc.) restent inchangés.

### Trade-off accepté

Un admin connecté ne verra pas un changement d'éval en temps réel sans rafraîchir la page. Acceptable pour un outil d'évaluation.

### Fichiers touchés

- `src/services/evaluationService.ts` — supprimer `subscribeToAllEvaluations` (ou équivalent)
- `src/services/campagneService.ts` — supprimer subscription globale, garder fetch
- `src/services/organisationService.ts` — supprimer subscription globale, garder fetch (ou `cartoService.ts` si c'est là)
- Stores consommateurs — adapter les appels (supprimer unsubscribe, ajouter refetch)

---

## 3. Backup cron automatisé (ops — haute priorité)

### Problème

Aucun backup automatisé. Un seul dump ad-hoc existe (`/root/gsat_backup_pre_faritany_*.sql`). Perte de données = perte totale.

### Design

- **Script `/root/gsat_backup.sh`** sur le VPS :
  - `pg_dump` format custom compressé via `docker exec supabase_db_gsat pg_dump -U postgres -Fc postgres`
  - Destination : `/root/gsat_backups/daily/gsat_YYYYMMDD_HHMMSS.dump` (permissions 0600)
  - Rotation quotidienne : supprime les dumps `daily/` de plus de 7 jours
  - Copie mensuelle : le 1er du mois, copie le dump du jour dans `/root/gsat_backups/monthly/` (rétention 90 jours)
- **Crontab root** : `0 3 * * *` (03h00 heure serveur, hors usage)
- **Log** : `/root/gsat_backups/backup.log` — date, taille, exit code. Écrit `FAILED` si exit ≠ 0 ou dump < 1KB.
- **Pas d'alerte email** (SMTP pas résolu — M1). Le log est consultable par SSH.
- **Rien dans le repo** — script ops VPS uniquement. Documenté dans un runbook `docs/superpowers/runbooks/2026-08-31-backup-cron.md`.

---

## 4. Index composite `evaluations(campagne_id, org_id)` (perf — basse priorité)

### Problème

Le pattern de requête le plus fréquent pour les Faritany est `WHERE campagne_id = ? AND org_id = ?` (evaluationService, indiceService, trigger section 6e). Pas d'index composite dédié — Postgres doit combiner `idx_eval_campagne` et `idx_eval_org` via bitmap scan.

### Design

- **Migration** `supabase/migrations/20260831_index_eval_campagne_org.sql` :
  ```sql
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eval_campagne_org
    ON evaluations(campagne_id, org_id);
  ```
- `CONCURRENTLY` pour ne pas bloquer les écritures en prod.
- **Apply prod** manuellement via psql (hors heures de pointe). `CONCURRENTLY` n'est pas supporté dans une transaction — exécuter directement, pas via `ON_ERROR_STOP` wrapper.

---

## Hors périmètre (décisions prises)

| Item | Raison |
|------|--------|
| Pooler PgBouncer | 33 connexions PG directes = négligeable, pas besoin |
| Cache TTL multi-stores | Over-engineering pour 33 users, TTL indice déjà en place |
| Batching writeScore | Le trigger recalcule tout à chaque écriture, batching ne réduit que le réseau |
| Healthcheck/alerting | Exige SMTP (M1 bloqué) ou un service tiers, hors scope |
| `api.max_rows = 1000` | 33 Faritany × 1 eval = 33 lignes, loin de la limite |

---

## Ordre d'implémentation recommandé

1. **Index composite** (1 ligne SQL, indépendant, zéro risque)
2. **Backup cron** (ops VPS, indépendant du code)
3. **Channels Realtime** (suppression + refetch, tests existants à adapter)
4. **Debounce writeScore** (touche le flux de saisie cœur, nécessite le plus de tests)

## Gate de validation

- `tsc -b` clean
- Suite de tests verte (actuellement 382)
- Smoke manuel : saisir 5 notes rapidement → 1 seul upsert visible dans les logs PG (pas 5)
- Vérifier que le backup cron produit un dump restaurable (`pg_restore --list`)
