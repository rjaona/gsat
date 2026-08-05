-- Vérif RLS Indice de Déploiement — tout en transaction ROLLBACK (aucune persistance).
-- Seed d'une éval nationale v3_0 (org=TEM) puis lectures sous vrais JWT.
-- TEM (OSN)      = 1c367734-9218-4b7f-bde4-c0549b85c582
-- Faritany enfant= 16d6ced0-40cb-5833-9888-767d89bc8f14 (Analamanga - Afovoany, a des évals far)
-- user valide    = 00000000-0000-0000-0000-000000000001
begin;

-- Seed (en tant que superuser, avant bascule de rôle)
insert into campagnes(id, organisateur_id, referentiel_version, nom, date_ouverture, date_fermeture, created_by, statut, mode)
values ('99999999-0000-4000-8000-0000000000aa','00000000-0000-0000-0000-000000000001','v3_0','Nat v3_0 test',
        now(), now()+interval '30 days','00000000-0000-0000-0000-000000000001','ouverte','complet');
insert into evaluations(id, campagne_id, org_id, type, statut, created_by)
values ('99999999-0000-4000-8000-0000000000bb','99999999-0000-4000-8000-0000000000aa',
        '1c367734-9218-4b7f-bde4-c0549b85c582','auto','validee','00000000-0000-0000-0000-000000000001');
insert into evaluation_scores(eval_id, critere_code, note, updated_by) values
 ('99999999-0000-4000-8000-0000000000bb','401',3,'00000000-0000-0000-0000-000000000001'),
 ('99999999-0000-4000-8000-0000000000bb','104',2,'00000000-0000-0000-0000-000000000001');

-- ── responsable_osn @ TEM : DOIT lire l'éval nationale ET les scores far descendants ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"osn","role":"responsable_osn","org_id":"1c367734-9218-4b7f-bde4-c0549b85c582"}';
select 'osn_national_scores(attendu>0)'  as check, count(*) from evaluation_scores where eval_id='99999999-0000-4000-8000-0000000000bb';
select 'osn_far_descend_scores(attendu>0)' as check, count(*) from evaluation_scores es
   join evaluations e on e.id=es.eval_id
   join organisations o on o.id=e.org_id
  where o.parent_id='1c367734-9218-4b7f-bde4-c0549b85c582';

-- ── responsable_region @ TEM : même attendu (sous-arbre) ──
set local request.jwt.claims = '{"sub":"reg","role":"responsable_region","org_id":"1c367734-9218-4b7f-bde4-c0549b85c582"}';
select 'region_far_descend_scores(attendu>0)' as check, count(*) from evaluation_scores es
   join evaluations e on e.id=es.eval_id
   join organisations o on o.id=e.org_id
  where o.parent_id='1c367734-9218-4b7f-bde4-c0549b85c582';

-- ── responsable_asn @ Faritany : NE DOIT PAS lire l'éval nationale (parent) ──
set local request.jwt.claims = '{"sub":"asn","role":"responsable_asn","org_id":"16d6ced0-40cb-5833-9888-767d89bc8f14"}';
select 'asn_national_scores(attendu=0)' as check, count(*) from evaluation_scores where eval_id='99999999-0000-4000-8000-0000000000bb';
select 'asn_own_far_scores(attendu>0)'  as check, count(*) from evaluation_scores es
   join evaluations e on e.id=es.eval_id where e.org_id='16d6ced0-40cb-5833-9888-767d89bc8f14';
select 'asn_sibling_far_scores(attendu=0)' as check, count(*) from evaluation_scores es
   join evaluations e on e.id=es.eval_id where e.org_id <> '16d6ced0-40cb-5833-9888-767d89bc8f14';

rollback;
