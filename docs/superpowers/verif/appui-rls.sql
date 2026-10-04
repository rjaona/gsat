-- Vérif RLS + garde origine — cockpits Phase 2. TOUT en transaction ROLLBACK.
-- Fixtures AUTONOMES (UUID a99e…) : 2 OSN, 3 Faritany, 3 users. Aucune donnée réelle lue ni modifiée.
-- Claims forgés au format du hook : role='authenticated' + user_role=<rôle app> + org_id.
-- Exécution : psql -U postgres -d postgres -v ON_ERROR_STOP=0 -f appui-rls.sql
-- Les cas « ATTENDU: ERROR » sont isolés par SAVEPOINT ; lire la sortie ligne à ligne.
--
-- OSN_A  = a99e0000-0000-4000-8000-000000000001   FarA1 = …0002   FarA2 = …0003
-- OSN_B  = a99e0000-0000-4000-8000-000000000004   FarB1 = …0005
-- U_OSN  = …0011 (responsable_osn @ OSN_A)  U_ASN1 = …0012 (responsable_asn @ FarA1)
-- U_ASN2 = …0013 (responsable_asn @ FarA2)
begin;

-- ── Fixtures (superuser) ─────────────────────────────────────────────────────
insert into organisations(id, type, nom, code, parent_id) values
 ('a99e0000-0000-4000-8000-000000000001','OSN','OSN test A','TA',   null),
 ('a99e0000-0000-4000-8000-000000000002','ASN','Far A1',   'TA-01','a99e0000-0000-4000-8000-000000000001'),
 ('a99e0000-0000-4000-8000-000000000003','ASN','Far A2',   'TA-02','a99e0000-0000-4000-8000-000000000001'),
 ('a99e0000-0000-4000-8000-000000000004','OSN','OSN test B','TB',  null),
 ('a99e0000-0000-4000-8000-000000000005','ASN','Far B1',   'TB-01','a99e0000-0000-4000-8000-000000000004');

insert into auth.users(id, email) values
 ('a99e0000-0000-4000-8000-000000000011','osn.test@verif.local'),
 ('a99e0000-0000-4000-8000-000000000012','asn1.test@verif.local'),
 ('a99e0000-0000-4000-8000-000000000013','asn2.test@verif.local');

insert into users(id, org_id, org_type, parent_org_id, nom, prenom, email, role) values
 ('a99e0000-0000-4000-8000-000000000011','a99e0000-0000-4000-8000-000000000001','OSN',null,'Osn','Test','osn.test@verif.local','responsable_osn'),
 ('a99e0000-0000-4000-8000-000000000012','a99e0000-0000-4000-8000-000000000002','ASN','a99e0000-0000-4000-8000-000000000001','Asn1','Test','asn1.test@verif.local','responsable_asn'),
 ('a99e0000-0000-4000-8000-000000000013','a99e0000-0000-4000-8000-000000000003','ASN','a99e0000-0000-4000-8000-000000000001','Asn2','Test','asn2.test@verif.local','responsable_asn');

insert into campagnes(id, organisateur_id, referentiel_version, nom, date_ouverture, date_fermeture, created_by, statut)
values ('a99e0000-0000-4000-8000-000000000021','a99e0000-0000-4000-8000-000000000011','far_v1_0','Camp verif',
        now(), now() + interval '30 days','a99e0000-0000-4000-8000-000000000011','ouverte');

insert into evaluations(id, campagne_id, org_id, type, statut, created_by) values
 ('a99e0000-0000-4000-8000-000000000031','a99e0000-0000-4000-8000-000000000021','a99e0000-0000-4000-8000-000000000002','auto','en_cours','a99e0000-0000-4000-8000-000000000012'),
 ('a99e0000-0000-4000-8000-000000000032','a99e0000-0000-4000-8000-000000000021','a99e0000-0000-4000-8000-000000000005','auto','en_cours','a99e0000-0000-4000-8000-000000000011'),
 ('a99e0000-0000-4000-8000-000000000033','a99e0000-0000-4000-8000-000000000021','a99e0000-0000-4000-8000-000000000003','auto','en_cours','a99e0000-0000-4000-8000-000000000013');

-- Plan existant du Faritany A2 (créé par lui-même)
insert into plans_action(id, eval_id, org_id, statut, created_by)
values ('a99e0000-0000-4000-8000-000000000041','a99e0000-0000-4000-8000-000000000033','a99e0000-0000-4000-8000-000000000003','actif','a99e0000-0000-4000-8000-000000000013');

-- ── responsable_osn @ OSN_A ─────────────────────────────────────────────────
select set_config('request.jwt.claims','{"sub":"a99e0000-0000-4000-8000-000000000011","role":"authenticated","user_role":"responsable_osn","org_id":"a99e0000-0000-4000-8000-000000000001"}', true);
set local role authenticated;

\echo '[1] OSN crée le plan de FarA1 (enfant) — ATTENDU: INSERT 0 1'
insert into plans_action(eval_id, org_id, statut, created_by)
values ('a99e0000-0000-4000-8000-000000000031','a99e0000-0000-4000-8000-000000000002','actif','a99e0000-0000-4000-8000-000000000011');

savepoint t;
\echo '[2] OSN crée un plan dans FarB1 (autre arbre) — ATTENDU: ERROR row-level security'
insert into plans_action(eval_id, org_id, statut, created_by)
values ('a99e0000-0000-4000-8000-000000000032','a99e0000-0000-4000-8000-000000000005','actif','a99e0000-0000-4000-8000-000000000011');
rollback to savepoint t;

savepoint t;
\echo '[3] OSN crée un plan pour FarA2 sur l éval d un AUTRE Faritany — ATTENDU: ERROR row-level security'
insert into plans_action(eval_id, org_id, statut, created_by)
values ('a99e0000-0000-4000-8000-000000000032','a99e0000-0000-4000-8000-000000000003','actif','a99e0000-0000-4000-8000-000000000011');
rollback to savepoint t;

\echo '[4] OSN ajoute une action NATIONALE au plan de FarA2 — ATTENDU: INSERT 0 1'
insert into plan_actions(id, plan_id, domaine_amelioration, objectif, date_echeance, origine)
values ('a99e0000-0000-4000-8000-000000000051','a99e0000-0000-4000-8000-000000000041','Gouvernance','Appui test', now() + interval '10 days','nationale');

savepoint t;
\echo '[5] OSN ajoute une action REGIONALE au plan de FarA2 — ATTENDU: ERROR row-level security'
insert into plan_actions(plan_id, domaine_amelioration, objectif, date_echeance, origine)
values ('a99e0000-0000-4000-8000-000000000041','Gouvernance','Usurpation', now() + interval '10 days','regionale');
rollback to savepoint t;

\echo '[6] OSN met à jour le statut de SON action nationale — ATTENDU: n=1'
with u as (update plan_actions set statut = 'en_cours' where id = 'a99e0000-0000-4000-8000-000000000051' returning 1)
select '[6]' as chk, count(*) as n from u;

savepoint t;
\echo '[7] OSN change l origine de l action — ATTENDU: ERROR origine immuable'
update plan_actions set origine = 'regionale' where id = 'a99e0000-0000-4000-8000-000000000051';
rollback to savepoint t;

\echo '[8] OSN ouvre un appui pour FarA2 — ATTENDU: INSERT 0 1'
insert into appui_faritany(org_id, note) values ('a99e0000-0000-4000-8000-000000000003','test');

savepoint t;
\echo '[9] OSN ouvre un 2e appui pour FarA2 — ATTENDU: ERROR duplicate key uq_appui_ouvert_par_org'
insert into appui_faritany(org_id) values ('a99e0000-0000-4000-8000-000000000003');
rollback to savepoint t;

savepoint t;
\echo '[10] OSN ouvre un appui pour FarB1 (autre arbre) — ATTENDU: ERROR row-level security'
insert into appui_faritany(org_id) values ('a99e0000-0000-4000-8000-000000000005');
rollback to savepoint t;

\echo '[11] OSN modifie la note de l appui FarA2 — ATTENDU: n=1 ; ouvert_par = U_OSN'
with u as (update appui_faritany set note = 'maj' where org_id = 'a99e0000-0000-4000-8000-000000000003' returning ouvert_par)
select '[11]' as chk, count(*) as n, max(ouvert_par::text) as ouvert_par from u;

savepoint t;
\echo '[12] OSN supprime l appui (aucune policy DELETE) — ATTENDU: n=0 OU ERROR permission denied (selon les default privileges) ; JAMAIS n=1'
with d as (delete from appui_faritany where org_id = 'a99e0000-0000-4000-8000-000000000003' returning 1)
select '[12]' as chk, count(*) as n from d;
rollback to savepoint t;

-- ── responsable_asn @ FarA2 (le Faritany appuyé) ────────────────────────────
reset role;
select set_config('request.jwt.claims','{"sub":"a99e0000-0000-4000-8000-000000000013","role":"authenticated","user_role":"responsable_asn","org_id":"a99e0000-0000-4000-8000-000000000003"}', true);
set local role authenticated;

\echo '[13] FarA2 lit son appui (chip) — ATTENDU: n=1'
select '[13]' as chk, count(*) as n from appui_faritany where org_id = 'a99e0000-0000-4000-8000-000000000003';

\echo '[14] FarA2 tente de modifier son appui — ATTENDU: n=0'
with u as (update appui_faritany set note = 'hack' where org_id = 'a99e0000-0000-4000-8000-000000000003' returning 1)
select '[14]' as chk, count(*) as n from u;

\echo '[15] FarA2 ajoute une action REGIONALE à son plan (non-régression) — ATTENDU: INSERT 0 1'
insert into plan_actions(plan_id, domaine_amelioration, objectif, date_echeance)
values ('a99e0000-0000-4000-8000-000000000041','Gouvernance','Action locale', now() + interval '10 days');

savepoint t;
\echo '[16] FarA2 fabrique une action NATIONALE — ATTENDU: ERROR Seul le niveau national'
insert into plan_actions(plan_id, domaine_amelioration, objectif, date_echeance, origine)
values ('a99e0000-0000-4000-8000-000000000041','Gouvernance','Faux badge', now() + interval '10 days','nationale');
rollback to savepoint t;

savepoint t;
\echo '[17] FarA2 retire le tag national de l action d appui — ATTENDU: ERROR origine immuable'
update plan_actions set origine = 'regionale' where id = 'a99e0000-0000-4000-8000-000000000051';
rollback to savepoint t;

savepoint t;
\echo '[17b] FarA2 supprime l action d appui nationale — ATTENDU: ERROR Seul le niveau national peut supprimer'
delete from plan_actions where id = 'a99e0000-0000-4000-8000-000000000051';
rollback to savepoint t;

\echo '[18] FarA2 voit l action nationale (badge) — ATTENDU: n=1'
select '[18]' as chk, count(*) as n from plan_actions where plan_id = 'a99e0000-0000-4000-8000-000000000041' and origine = 'nationale';

-- ── responsable_asn @ FarA1 (voisin) ────────────────────────────────────────
reset role;
select set_config('request.jwt.claims','{"sub":"a99e0000-0000-4000-8000-000000000012","role":"authenticated","user_role":"responsable_asn","org_id":"a99e0000-0000-4000-8000-000000000002"}', true);
set local role authenticated;

\echo '[19] FarA1 lit l appui de FarA2 (voisin) — ATTENDU: n=0'
select '[19]' as chk, count(*) as n from appui_faritany where org_id = 'a99e0000-0000-4000-8000-000000000003';

rollback;
