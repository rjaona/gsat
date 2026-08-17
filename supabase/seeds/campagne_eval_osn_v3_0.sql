-- Scaffolding auto-évaluation OSN v3_0 — idempotent.
-- Crée la campagne v3_0 (périmètre OSN) + l'éval OSN en_cours pour la saisie
-- réelle. Laisse l'éval en_cours (validation hors périmètre — écarts calculent
-- via le fallback "plus récente" de indiceService). Portable local↔prod :
-- l'OSN et l'admin sont résolus par sous-requête (1 seul OSN, 1 admin_global).
BEGIN;

-- Campagne v3_0 (UUID fixe → idempotent).
INSERT INTO campagnes (
  id, organisateur_id, referentiel_version, nom,
  date_ouverture, date_fermeture, statut, mode, perimetre, created_by
) VALUES (
  'd3000000-0000-4000-8000-0000000c0001',
  (SELECT id FROM users WHERE role = 'admin_global' ORDER BY created_at LIMIT 1),
  'v3_0',
  'Auto-évaluation OSN v3_0',
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '365 days',
  'ouverte',
  'complet',
  ARRAY[(SELECT id FROM organisations WHERE type = 'OSN' ORDER BY created_at LIMIT 1)]::uuid[],
  (SELECT id FROM users WHERE role = 'admin_global' ORDER BY created_at LIMIT 1)
)
ON CONFLICT (id) DO UPDATE SET
  statut = 'ouverte',
  date_fermeture = EXCLUDED.date_fermeture,
  perimetre = EXCLUDED.perimetre;

-- Évaluation OSN en_cours (UNIQUE(org_id, campagne_id) → idempotent).
INSERT INTO evaluations (
  id, campagne_id, org_id, type, statut, created_by
) VALUES (
  'd3000000-0000-4000-8000-0000000e0001',
  'd3000000-0000-4000-8000-0000000c0001',
  (SELECT id FROM organisations WHERE type = 'OSN' ORDER BY created_at LIMIT 1),
  'auto',
  'en_cours',
  (SELECT id FROM users WHERE role = 'admin_global' ORDER BY created_at LIMIT 1)
)
ON CONFLICT (org_id, campagne_id) DO UPDATE SET statut = 'en_cours';

COMMIT;
