-- =============================================================================
-- GSAT Digital V2 — Seed des 33 Faritany de TEM Madagascar
-- Date   : 2026-08-04
-- Source : ERPTEM, ERP/types/faritany.ts L145-199 — referentiel officiel TEM 2026
--          (_audit_mapping_faritany.xlsx, Foibe). 32 districts + FRANTSA (diaspora).
--
-- Remplace les 6 ASN codees en dur dans scripts/seed-emulator.mjs L223-228,
-- qui correspondaient aux ex-provinces et non aux Faritany.
--
-- IDEMPOTENT : rejouable sans doublon (insertion conditionnelle sur le code).
-- Les UUID sont deterministes (uuid5 du namespace DNS sur 'tem.faritany.<ID_ERP>')
-- afin qu'un rejeu, un autre environnement ou un import ERP retombent sur les
-- memes identifiants.
--
-- PREREQUIS : la ligne organisation de l'OSN TEM doit exister (code = 'TEM').
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Garde-fou : l'OSN parente doit exister
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organisations WHERE code = 'TEM' AND type = 'OSN') THEN
    RAISE EXCEPTION 'OSN TEM introuvable (organisations.code = ''TEM''). Seeder l''OSN avant les Faritany.';
  END IF;
END $$;

-- Libelle du niveau local pour cette OSN
INSERT INTO system_config (org_id, site_name, libelle_niveau_local, revue_delai_jours)
SELECT id, 'GSAT — TEM Madagascar', 'Faritany', 60 FROM organisations WHERE code = 'TEM' AND type = 'OSN'
ON CONFLICT (org_id) DO UPDATE SET libelle_niveau_local = 'Faritany';

-- -----------------------------------------------------------------------------
-- Les 33 Faritany
--   code          = code district TEM (le prefixe porte la province : ANT/TOA/
--                   MAH/FIA/TOL/DIA/DSP — cf. note de conception §2.1)
--   poids         = ponderation de consolidation (effectif). 1 par defaut,
--                   a mettre a jour depuis l'ERP quand il sera branche.
--   lat/lng       = NULL : aucune coordonnee n'existe pour ces identifiants dans
--                   ERPTEM. A completer depuis les centroides de Region
--                   administrative avant la carte du lot 4.
-- -----------------------------------------------------------------------------

INSERT INTO organisations (id, type, nom, code, parent_id, pays_id, region_code, actif, poids)
SELECT v.id::uuid, 'ASN', v.nom, v.code, o.id, o.pays_id, 'AFRICA', TRUE, 1
FROM (VALUES
  ('16d6ced0-40cb-5833-9888-767d89bc8f14','Analamanga - Afovoany','ANT-01'),  -- ANALAMANGA_AFOVOANY · ANTANANARIVO · ANALAMANGA
  ('9d92701c-2de8-5a50-90e5-f4d1b859b08f','Analamanga - Andrefana','ANT-02'),  -- ANALAMANGA_ANDREFANA · ANTANANARIVO · ANALAMANGA
  ('a9bd31b9-1704-5444-8d2e-d237a033d832','Analamanga - Atsimo','ANT-03'),  -- ANALAMANGA_ATSIMO · ANTANANARIVO · ANALAMANGA
  ('b7f7f0a2-9f34-5ddb-abea-a97d60ff682d','Analamanga - Atsinanana','ANT-04'),  -- ANALAMANGA_ATSINANANA · ANTANANARIVO · ANALAMANGA
  ('ba6833c4-8bf7-5f99-9535-ee5b1f3cb68a','Analamanga - Avaratra','ANT-05'),  -- ANALAMANGA_AVARATRA · ANTANANARIVO · ANALAMANGA
  ('47d581e6-ebac-50fa-a544-bb03bb09b547','Vakinankaratra - Antsirabe','ANT-06'),  -- VAKINANKARATRA_ANTSIRABE · ANTANANARIVO · VAKINANKARATRA
  ('494b97e0-1b5a-53dc-9df0-e4bf2856119b','Vakinankaratra - Ambatolampy','ANT-07'),  -- VAKINANKARATRA_AMBATOLAMPY · ANTANANARIVO · VAKINANKARATRA
  ('c4f443cf-9c1c-5162-855c-eeab56032a97','Itasy','ANT-08'),  -- ITASY · ANTANANARIVO · ITASY
  ('19bbefb3-10cb-5846-b8dd-207e4520529e','Bongolava','ANT-09'),  -- BONGOLAVA · ANTANANARIVO · BONGOLAVA
  ('b4dfa94b-d430-5f50-b1d1-b5a87299a615','Alaotra - Ambatondrazaka','TOA-01'),  -- ALAOTRA_AMBATONDRAZAKA · TOAMASINA · ALAOTRA_MANGORO
  ('08a3c659-6499-5616-b86e-d3a5420091bd','Mangoro - Moramanga','TOA-02'),  -- MANGORO_MORAMANGA · TOAMASINA · ALAOTRA_MANGORO
  ('83b715ce-a353-5c57-ab2c-f17acc25202b','Analanjirofo','TOA-03'),  -- ANALANJIROFO · TOAMASINA · ANALANJIROFO
  ('a34af695-5a67-5ae9-b3eb-9f728df59281','Ambatosoa','TOA-04'),  -- AMBATOSOA · TOAMASINA · ANALANJIROFO
  ('411a16c6-2f0d-5826-8049-5b11016a106c','Atsinanana','TOA-05'),  -- ATSINANANA · TOAMASINA · ATSINANANA
  ('0120fbdd-bc9e-509f-bf98-6456137c2414','Agnivon''i Pangalana','TOA-06'),  -- AGNIVON_I_PANGALANA · TOAMASINA · ATSINANANA
  ('a578301a-23f2-5948-905e-a90398ac6ca2','Boeny','MAH-01'),  -- BOENY · MAHAJANGA · BOENY
  ('5312a572-600b-5438-a3fd-b0c26dc94bfa','Betsiboka','MAH-02'),  -- BETSIBOKA · MAHAJANGA · BETSIBOKA
  ('3fc3445d-1fcc-53a9-98e3-7cb588888571','Melaky','MAH-03'),  -- MELAKY · MAHAJANGA · MELAKY
  ('6e2d8a40-97bf-563e-b09d-be46b893a793','Sofia','MAH-04'),  -- SOFIA · MAHAJANGA · SOFIA
  ('7fa7dd60-d175-5024-a0ac-1a8457249fb8','Matsiatra Ambony','FIA-01'),  -- MATSIATRA_AMBONY · FIANARANTSOA · HAUTE_MATSIATRA
  ('ebd0fc66-6aa2-57b1-a4fc-2c7e423750b9','Matsiatra Iarandrano','FIA-02'),  -- MATSIATRA_IARANDRANO · FIANARANTSOA · HAUTE_MATSIATRA
  ('160511ab-ae6d-59c7-9d40-93fe21eb7681','Amoron''i Mania','FIA-03'),  -- AMORON_I_MANIA · FIANARANTSOA · AMORON_I_MANIA
  ('8561bbb2-23ff-5959-93e6-4e42c3dc496b','Vatovavy Mananjary','FIA-04'),  -- VATOVAVY_MANANJARY · FIANARANTSOA · VATOVAVY
  ('73d89ae6-890d-56dc-8e67-45b4eff8c002','Fitovinany Manakara','FIA-05'),  -- FITOVINANY_MANAKARA · FIANARANTSOA · FITOVINANY
  ('f99ae294-bd8e-55e2-b527-4f5bff37dc2e','Atsimo Atsinanana','FIA-06'),  -- ATSIMO_ATSINANANA · FIANARANTSOA · ATSIMO_ATSINANANA
  ('9cc2eb1f-1894-5874-8508-09596d75ab18','Ihorombe','FIA-07'),  -- IHOROMBE · FIANARANTSOA · IHOROMBE
  ('5df6b4a6-6126-5342-826e-6b42170b879b','Atsimo Andrefana','TOL-01'),  -- ATSIMO_ANDREFANA · TOLIARA · ATSIMO_ANDREFANA
  ('e2d83265-d387-5345-85ad-c6b00de487bb','Androy','TOL-02'),  -- ANDROY · TOLIARA · ANDROY
  ('70089f9b-eed4-5b19-ad08-ccaf909b6d14','Anosy','TOL-03'),  -- ANOSY · TOLIARA · ANOSY
  ('0d351b6a-44e3-59a2-89b0-f8599acfc244','Menabe','TOL-04'),  -- MENABE · TOLIARA · MENABE
  ('6ac58e3c-4221-5777-87be-e1f528145f77','Diana','DIA-01'),  -- DIANA · ANTSIRANANA · DIANA
  ('2610cd62-7aa7-5563-919e-006992794b5d','Sava','DIA-02'),  -- SAVA · ANTSIRANANA · SAVA
  ('e3151f77-30ea-5967-a9d0-1a58f68eed97','Frantsa','DSP-01')  -- FRANTSA · DIASPORA
) AS v(id, nom, code)
CROSS JOIN (SELECT id, pays_id FROM organisations WHERE code = 'TEM' AND type = 'OSN' LIMIT 1) o
WHERE NOT EXISTS (SELECT 1 FROM organisations x WHERE x.code = v.code);

COMMIT;

-- -----------------------------------------------------------------------------
-- Verification
-- -----------------------------------------------------------------------------
SELECT split_part(code, '-', 1) AS province, COUNT(*) AS nb
FROM organisations
WHERE type = 'ASN' AND parent_id = (SELECT id FROM organisations WHERE code = 'TEM')
GROUP BY 1 ORDER BY 1;
-- Attendu : ANT 9 | DIA 2 | DSP 1 | FIA 7 | MAH 4 | TOA 6 | TOL 4  = 33

-- =============================================================================
-- COMPTES responsable_asn — a creer via l'API Auth, PAS en SQL
--
-- Sous Supabase, auth.users ne se peuple pas par INSERT : passer par la Edge
-- Function existante `manage-user`, qui cree le compte ET pose les claims
-- (role, org_id, org_type) necessaires aux policies RLS.
--
-- Un compte par Faritany, role = 'responsable_asn' :
--
--   for f in $(psql -tAc "SELECT code FROM organisations WHERE type='ASN'"); do
--     curl -X POST "$SUPABASE_URL/functions/v1/manage-user" \
--       -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
--       -H "Content-Type: application/json" \
--       -d "{\"action\":\"create\",
--            \"email\":\"$(echo $f | tr 'A-Z-' 'a-z.')@tem.mg\",
--            \"role\":\"responsable_asn\",
--            \"orgCode\":\"$f\"}"
--   done
--
-- Ne pas committer les mots de passe generes : les consigner dans
-- scripts/TEST_ACCOUNTS.md, hors depot en production.
-- =============================================================================
