-- Index composite pour le pattern de requête Faritany :
-- WHERE campagne_id = ? AND org_id = ?
-- CONCURRENTLY pour ne pas bloquer les écritures en prod.
-- ⚠️ CONCURRENTLY ne fonctionne pas dans une transaction —
-- appliquer via psql direct (pas ON_ERROR_STOP wrapper).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eval_campagne_org
  ON evaluations(campagne_id, org_id);
