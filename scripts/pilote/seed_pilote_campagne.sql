-- Pilote go-live : campagne DÉMO far_v1_0 + 3 évals Faritany (Analamanga), conservées.
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO campagnes (id, organisateur_id, referentiel_version, nom, description,
                       date_ouverture, date_fermeture, statut, mode, perimetre, created_by)
VALUES ('d5000000-0000-4000-8000-0000000c0001',
        '8e9b7ea9-40c9-4667-8139-efa46e451838', 'far_v1_0', 'DÉMO — pilote go-live',
        'Jeu de démonstration conservé (preuve du flow bout-en-bout).',
        NOW() - INTERVAL '1 day', NOW() + INTERVAL '365 days',
        'ouverte', 'socle',
        ARRAY['16d6ced0-40cb-5833-9888-767d89bc8f14',
              '9d92701c-2de8-5a50-90e5-f4d1b859b08f',
              'a9bd31b9-1704-5444-8d2e-d237a033d832']::uuid[],
        '8e9b7ea9-40c9-4667-8139-efa46e451838')
ON CONFLICT (id) DO NOTHING;

INSERT INTO evaluations (id, campagne_id, org_id, type, statut, created_by) VALUES
 ('d5000000-0000-4000-8000-0000000e0001','d5000000-0000-4000-8000-0000000c0001','16d6ced0-40cb-5833-9888-767d89bc8f14','auto','en_cours','8e9b7ea9-40c9-4667-8139-efa46e451838'),
 ('d5000000-0000-4000-8000-0000000e0002','d5000000-0000-4000-8000-0000000c0001','9d92701c-2de8-5a50-90e5-f4d1b859b08f','auto','en_cours','8e9b7ea9-40c9-4667-8139-efa46e451838'),
 ('d5000000-0000-4000-8000-0000000e0003','d5000000-0000-4000-8000-0000000c0001','a9bd31b9-1704-5444-8d2e-d237a033d832','auto','en_cours','8e9b7ea9-40c9-4667-8139-efa46e451838')
ON CONFLICT (org_id, campagne_id) DO NOTHING;

COMMIT;
SELECT count(*) AS camps FROM campagnes WHERE id='d5000000-0000-4000-8000-0000000c0001';
SELECT id, org_id, statut FROM evaluations WHERE campagne_id='d5000000-0000-4000-8000-0000000c0001' ORDER BY id;
