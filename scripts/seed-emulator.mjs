/**
 * seed-emulator.mjs — Charge le référentiel GSAT V3.0 et les données de base
 * dans l'émulateur Firestore + Auth via Admin SDK (bypasse les Security Rules).
 *
 * Usage : node scripts/seed-emulator.mjs
 * (Lancer APRÈS firebase emulators:start)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Pointer vers les emulators GSAT ──────────────────────────────────────────

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8400';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9400';

// ── Init Admin SDK ────────────────────────────────────────────────────────────

if (!getApps().length) {
  initializeApp({ projectId: 'gsatwosm' });
}

const db   = getFirestore();
const auth = getAuth();

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[seed] ${msg}`); }

async function createAuthUser(email, password, customClaims) {
  let uid;
  try {
    const user = await auth.createUser({ email, password });
    uid = user.uid;
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      const user = await auth.getUserByEmail(email);
      uid = user.uid;
    } else {
      throw err;
    }
  }
  if (customClaims) {
    await auth.setCustomUserClaims(uid, customClaims);
  }
  return uid;
}

// ── 1. Référentiel GSAT V3.0 ─────────────────────────────────────────────────

async function seedReferentiel() {
  log('Chargement du référentiel GSAT V3.0...');
  const referentiel = JSON.parse(
    readFileSync(join(__dirname, '../src/data/referentiel_v3_0.json'), 'utf-8')
  );
  await db.doc('referentiel/v3_0').set(referentiel);
  const nb = referentiel.dimensions.reduce((s, d) => s + d.criteres.length, 0);
  log(`✓ Référentiel : ${referentiel.dimensions.length} dimensions, ${nb} critères`);
}

// ── 2. Organisations ──────────────────────────────────────────────────────────

async function seedOrganisations() {
  log('Création des organisations...');
  const orgs = [
    // ── Niveau OMMS ────────────────────────────────────────────────────────────
    {
      id: 'omms',
      type: 'OMMS',
      nom: 'Organisation Mondiale du Mouvement Scout',
      code: 'OMMS',
      actif: true,
    },

    // ── Niveau REGION ──────────────────────────────────────────────────────────
    {
      id: 'region-africa',
      type: 'REGION',
      nom: 'Bureau Scout Africain',
      code: 'AFRICA',
      parentId: 'omms',
      regionCode: 'AFRICA',
      actif: true,
    },

    // ── OSN — TEM Madagascar (Tananarive) ──────────────────────────────────────
    {
      id: 'tem',
      type: 'OSN',
      nom: 'Tambazotra Eto Madagasikara',
      code: 'TEM',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'MG',
      coordonnees: { lat: -18.9137, lng: 47.5361 },
      actif: true,
    },

    // ── OSN — Scouts du Sénégal (Dakar) ───────────────────────────────────────
    {
      id: 'osn-senegal',
      type: 'OSN',
      nom: 'Scouts du Sénégal',
      code: 'SEN',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'SN',
      coordonnees: { lat: 14.6937, lng: -17.4441 },
      actif: true,
    },

    // ── OSN — Scouts de Côte d'Ivoire (Abidjan) ───────────────────────────────
    {
      id: 'osn-cote-ivoire',
      type: 'OSN',
      nom: "Scouts de Côte d'Ivoire",
      code: 'CIV',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'CI',
      coordonnees: { lat: 5.3599, lng: -4.0083 },
      actif: true,
    },

    // ── OSN — Scouts du Cameroun (Yaoundé) ────────────────────────────────────
    {
      id: 'osn-cameroun',
      type: 'OSN',
      nom: 'Scouts du Cameroun',
      code: 'CMR',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'CM',
      coordonnees: { lat: 3.8480, lng: 11.5021 },
      actif: true,
    },

    // ── OSN — Scouts du Kenya (Nairobi) ───────────────────────────────────────
    {
      id: 'osn-kenya',
      type: 'OSN',
      nom: 'Scouts du Kenya',
      code: 'KEN',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'KE',
      coordonnees: { lat: -1.2921, lng: 36.8219 },
      actif: true,
    },

    // ── OSN — Scouts d'Afrique du Sud (Johannesburg) ──────────────────────────
    {
      id: 'osn-afrique-du-sud',
      type: 'OSN',
      nom: "Scouts d'Afrique du Sud",
      code: 'ZAF',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'ZA',
      coordonnees: { lat: -26.2041, lng: 28.0473 },
      actif: true,
    },

    // ── OSN — Scouts du Maroc (Rabat) ─────────────────────────────────────────
    {
      id: 'osn-maroc',
      type: 'OSN',
      nom: 'Scouts du Maroc',
      code: 'MAR',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'MA',
      coordonnees: { lat: 33.9716, lng: -6.8498 },
      actif: true,
    },

    // ── OSN — Scouts d'Égypte (Le Caire) ──────────────────────────────────────
    {
      id: 'osn-egypte',
      type: 'OSN',
      nom: "Scouts d'Égypte",
      code: 'EGY',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'EG',
      coordonnees: { lat: 30.0444, lng: 31.2357 },
      actif: true,
    },

    // ── OSN — Scouts du Nigeria (Abuja) ───────────────────────────────────────
    {
      id: 'osn-nigeria',
      type: 'OSN',
      nom: 'Scouts du Nigeria',
      code: 'NGA',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'NG',
      coordonnees: { lat: 9.0765, lng: 7.3986 },
      actif: true,
    },

    // ── OSN — Scouts du Ghana (Accra) ─────────────────────────────────────────
    {
      id: 'osn-ghana',
      type: 'OSN',
      nom: 'Scouts du Ghana',
      code: 'GHA',
      parentId: 'region-africa',
      regionCode: 'AFRICA',
      paysId: 'GH',
      coordonnees: { lat: 5.6037, lng: -0.1870 },
      actif: true,
    },

    // ── ASN TEM Madagascar ─────────────────────────────────────────────────────
    { id: 'tem-antananarivo', type: 'ASN', nom: 'TEM Antananarivo', code: 'TEM-ANT', parentId: 'tem', regionCode: 'AFRICA', actif: true },
    { id: 'tem-fianarantsoa', type: 'ASN', nom: 'TEM Fianarantsoa', code: 'TEM-FIA', parentId: 'tem', regionCode: 'AFRICA', actif: true },
    { id: 'tem-toamasina',    type: 'ASN', nom: 'TEM Toamasina',    code: 'TEM-TOA', parentId: 'tem', regionCode: 'AFRICA', actif: true },
    { id: 'tem-mahajanga',    type: 'ASN', nom: 'TEM Mahajanga',    code: 'TEM-MAH', parentId: 'tem', regionCode: 'AFRICA', actif: true },
    { id: 'tem-toliara',      type: 'ASN', nom: 'TEM Toliara',      code: 'TEM-TOL', parentId: 'tem', regionCode: 'AFRICA', actif: true },
    { id: 'tem-antsiranana',  type: 'ASN', nom: 'TEM Antsiranana',  code: 'TEM-ANS', parentId: 'tem', regionCode: 'AFRICA', actif: true },
  ];

  const batch = db.batch();
  for (const { id, ...data } of orgs) {
    batch.set(db.doc(`organisations/${id}`), data);
  }
  await batch.commit();
  log(`✓ ${orgs.length} organisations`);
}

// ── 3. Pays ───────────────────────────────────────────────────────────────────

async function seedPays() {
  log('Création des pays africains...');
  const pays = [
    { id: 'MG', codeIso: 'MG', nom: { fr: 'Madagascar',       en: 'Madagascar'      }, regionCode: 'AFRICA', actif: true },
    { id: 'SN', codeIso: 'SN', nom: { fr: 'Sénégal',          en: 'Senegal'         }, regionCode: 'AFRICA', actif: true },
    { id: 'CI', codeIso: 'CI', nom: { fr: "Côte d'Ivoire",    en: "Côte d'Ivoire"   }, regionCode: 'AFRICA', actif: true },
    { id: 'CM', codeIso: 'CM', nom: { fr: 'Cameroun',         en: 'Cameroon'        }, regionCode: 'AFRICA', actif: true },
    { id: 'KE', codeIso: 'KE', nom: { fr: 'Kenya',            en: 'Kenya'           }, regionCode: 'AFRICA', actif: true },
    { id: 'ZA', codeIso: 'ZA', nom: { fr: 'Afrique du Sud',   en: 'South Africa'    }, regionCode: 'AFRICA', actif: true },
    { id: 'MA', codeIso: 'MA', nom: { fr: 'Maroc',            en: 'Morocco'         }, regionCode: 'AFRICA', actif: true },
    { id: 'EG', codeIso: 'EG', nom: { fr: 'Égypte',           en: 'Egypt'           }, regionCode: 'AFRICA', actif: true },
    { id: 'NG', codeIso: 'NG', nom: { fr: 'Nigeria',          en: 'Nigeria'         }, regionCode: 'AFRICA', actif: true },
    { id: 'GH', codeIso: 'GH', nom: { fr: 'Ghana',            en: 'Ghana'           }, regionCode: 'AFRICA', actif: true },
  ];
  const batch = db.batch();
  for (const { id, ...data } of pays) {
    batch.set(db.doc(`pays/${id}`), data);
  }
  await batch.commit();
  log(`✓ ${pays.length} pays`);
}

// ── 4. Dashboard Stats (simulés pour la WorldMap) ─────────────────────────────
//
// Répartition des couleurs de marqueurs :
//   Vert   (≥ 75) : tem, osn-kenya
//   Ambre  (50-74): osn-senegal, osn-cameroun, osn-maroc
//   Orange (25-49): osn-cote-ivoire, osn-afrique-du-sud, osn-nigeria
//   Gris   (aucun): osn-egypte, osn-ghana

async function seedDashboardStats() {
  log('Création des dashboardStats pour les OSN...');

  const now = Timestamp.now();

  const stats = [
    // ── Vert (score ≥ 75) ──────────────────────────────────────────────────────
    {
      orgId: 'tem',
      scoreGlobal: 82,
      scoreParDimension: { D01: 90, D02: 85, D03: 80, D04: 88, D05: 75, D06: 82, D07: 78, D08: 85, D09: 80, D10: 77 },
      criteresEssentielsKO: [],
      nbAsn: 6,
      tauxCompletionEval: 92,
      updatedAt: now,
    },
    {
      orgId: 'osn-kenya',
      scoreGlobal: 77,
      scoreParDimension: { D01: 80, D02: 75, D03: 78, D04: 82, D05: 70, D06: 76, D07: 72, D08: 80, D09: 75, D10: 77 },
      criteresEssentielsKO: [],
      nbAsn: 4,
      tauxCompletionEval: 88,
      updatedAt: now,
    },

    // ── Ambre (50–74) ──────────────────────────────────────────────────────────
    {
      orgId: 'osn-senegal',
      scoreGlobal: 68,
      scoreParDimension: { D01: 72, D02: 65, D03: 70, D04: 68, D05: 60, D06: 72, D07: 65, D08: 70, D09: 68, D10: 65 },
      criteresEssentielsKO: ['204'],
      nbAsn: 3,
      tauxCompletionEval: 75,
      updatedAt: now,
    },
    {
      orgId: 'osn-cameroun',
      scoreGlobal: 61,
      scoreParDimension: { D01: 65, D02: 58, D03: 62, D04: 60, D05: 55, D06: 65, D07: 58, D08: 62, D09: 60, D10: 60 },
      criteresEssentielsKO: ['108', '312'],
      nbAsn: 3,
      tauxCompletionEval: 67,
      updatedAt: now,
    },
    {
      orgId: 'osn-maroc',
      scoreGlobal: 55,
      scoreParDimension: { D01: 60, D02: 52, D03: 55, D04: 58, D05: 50, D06: 58, D07: 52, D08: 55, D09: 53, D10: 52 },
      criteresEssentielsKO: ['105', '209'],
      nbAsn: 2,
      tauxCompletionEval: 60,
      updatedAt: now,
    },

    // ── Orange (25–49) ─────────────────────────────────────────────────────────
    {
      orgId: 'osn-cote-ivoire',
      scoreGlobal: 44,
      scoreParDimension: { D01: 48, D02: 42, D03: 45, D04: 40, D05: 38, D06: 50, D07: 42, D08: 45, D09: 44, D10: 42 },
      criteresEssentielsKO: ['101', '203', '305'],
      nbAsn: 2,
      tauxCompletionEval: 50,
      updatedAt: now,
    },
    {
      orgId: 'osn-afrique-du-sud',
      scoreGlobal: 38,
      scoreParDimension: { D01: 42, D02: 35, D03: 38, D04: 40, D05: 32, D06: 42, D07: 36, D08: 38, D09: 36, D10: 35 },
      criteresEssentielsKO: ['101', '102', '201'],
      nbAsn: 2,
      tauxCompletionEval: 40,
      updatedAt: now,
    },
    {
      orgId: 'osn-nigeria',
      scoreGlobal: 29,
      scoreParDimension: { D01: 32, D02: 28, D03: 30, D04: 28, D05: 25, D06: 32, D07: 28, D08: 30, D09: 28, D10: 27 },
      criteresEssentielsKO: ['101', '102', '201', '301'],
      nbAsn: 1,
      tauxCompletionEval: 30,
      updatedAt: now,
    },

    // ── Gris (pas de stats — osn-egypte et osn-ghana intentionnellement omis) ──
  ];

  const batch = db.batch();
  for (const { orgId, ...data } of stats) {
    batch.set(db.doc(`dashboardStats/${orgId}`), { orgId, ...data });
  }
  await batch.commit();
  log(`✓ ${stats.length} dashboardStats OSN (2 OSN sans stats : osn-egypte, osn-ghana)`);
}

// ── 5. Utilisateurs Auth + Firestore + custom claims ─────────────────────────

async function seedUsers() {
  log('Création des comptes Auth...');

  const users = [
    {
      email: 'admin@gsat-digital.org', password: 'Admin1234!',
      claims:  { role: 'admin_global',    orgId: 'omms',             orgType: 'OMMS' },
      profile: { nom: 'Admin', prenom: 'Global',         orgId: 'omms',             orgType: 'OMMS',  role: 'admin_global',    actif: true },
    },
    {
      email: 'responsable@tem.mg', password: 'Responsable1234!',
      claims:  { role: 'responsable_osn', orgId: 'tem',              orgType: 'OSN',  parentOrgId: 'region-africa' },
      profile: { nom: 'Responsable', prenom: 'TEM',      orgId: 'tem',              orgType: 'OSN',   role: 'responsable_osn', actif: true, parentOrgId: 'region-africa' },
    },
    {
      email: 'antananarivo@tem.mg', password: 'Antana1234!',
      claims:  { role: 'utilisateur_asn', orgId: 'tem-antananarivo', orgType: 'ASN',  parentOrgId: 'tem' },
      profile: { nom: 'Évaluateur', prenom: 'Antananarivo', orgId: 'tem-antananarivo', orgType: 'ASN', role: 'utilisateur_asn', actif: true, parentOrgId: 'tem' },
    },
    {
      email: 'fianarantsoa@tem.mg', password: 'Fiana1234!',
      claims:  { role: 'utilisateur_asn', orgId: 'tem-fianarantsoa', orgType: 'ASN',  parentOrgId: 'tem' },
      profile: { nom: 'Évaluateur', prenom: 'Fianarantsoa', orgId: 'tem-fianarantsoa', orgType: 'ASN', role: 'utilisateur_asn', actif: true, parentOrgId: 'tem' },
    },
    {
      email: 'toamasina@tem.mg', password: 'Toama1234!',
      claims:  { role: 'utilisateur_asn', orgId: 'tem-toamasina',    orgType: 'ASN',  parentOrgId: 'tem' },
      profile: { nom: 'Évaluateur', prenom: 'Toamasina',    orgId: 'tem-toamasina',    orgType: 'ASN', role: 'utilisateur_asn', actif: true, parentOrgId: 'tem' },
    },
    {
      email: 'mahajanga@tem.mg', password: 'Mahaj1234!',
      claims:  { role: 'utilisateur_asn', orgId: 'tem-mahajanga',    orgType: 'ASN',  parentOrgId: 'tem' },
      profile: { nom: 'Évaluateur', prenom: 'Mahajanga',    orgId: 'tem-mahajanga',    orgType: 'ASN', role: 'utilisateur_asn', actif: true, parentOrgId: 'tem' },
    },
    {
      email: 'toliara@tem.mg', password: 'Tolia1234!',
      claims:  { role: 'utilisateur_asn', orgId: 'tem-toliara',      orgType: 'ASN',  parentOrgId: 'tem' },
      profile: { nom: 'Évaluateur', prenom: 'Toliara',      orgId: 'tem-toliara',      orgType: 'ASN', role: 'utilisateur_asn', actif: true, parentOrgId: 'tem' },
    },
    {
      email: 'antsiranana@tem.mg', password: 'Antsi1234!',
      claims:  { role: 'utilisateur_asn', orgId: 'tem-antsiranana',  orgType: 'ASN',  parentOrgId: 'tem' },
      profile: { nom: 'Évaluateur', prenom: 'Antsiranana',  orgId: 'tem-antsiranana',  orgType: 'ASN', role: 'utilisateur_asn', actif: true, parentOrgId: 'tem' },
    },
    {
      email: 'region.africa@wosm.org', password: 'Region1234!',
      claims:  { role: 'responsable_region', orgId: 'region-africa', orgType: 'REGION' },
      profile: { nom: 'Responsable', prenom: 'Afrique',     orgId: 'region-africa',    orgType: 'REGION', role: 'responsable_region', actif: true },
    },
    {
      email: 'evaluateur@tem.mg', password: 'Eval1234!',
      claims:  { role: 'evaluateur', orgId: 'tem',                   orgType: 'OSN',  parentOrgId: 'region-africa' },
      profile: { nom: 'Externe', prenom: 'Évaluateur',     orgId: 'tem',              orgType: 'OSN',  role: 'evaluateur', actif: true, parentOrgId: 'region-africa' },
    },
    {
      email: 'lecteur@tem.mg', password: 'Lecteur1234!',
      claims:  { role: 'lecteur', orgId: 'tem',                       orgType: 'OSN',  parentOrgId: 'region-africa' },
      profile: { nom: 'Lecteur', prenom: 'TEM',            orgId: 'tem',              orgType: 'OSN',  role: 'lecteur', actif: true, parentOrgId: 'region-africa' },
    },
    {
      email: 'responsable@senegal.scouts.sn', password: 'Senegal1234!',
      claims:  { role: 'responsable_osn', orgId: 'scouts-senegal',   orgType: 'OSN',  parentOrgId: 'region-africa' },
      profile: { nom: 'Responsable', prenom: 'Sénégal',    orgId: 'scouts-senegal',   orgType: 'OSN',  role: 'responsable_osn', actif: true, parentOrgId: 'region-africa' },
    },
  ];

  for (const u of users) {
    const uid = await createAuthUser(u.email, u.password, u.claims);
    await db.doc(`users/${uid}`).set({ ...u.profile, email: u.email });
    log(`  ✓ ${u.email} (${u.claims.role}) uid=${uid}`);
  }
  log(`✓ ${users.length} utilisateurs`);
}

// ── 6. Données exemple Madagascar ────────────────────────────────────────────
//
// Campagne TEM 2024-2025 avec 6 évaluations ASN (statuts variés),
// scores détaillés pour les évals avancées, et 1 plan d'action complet.

async function seedMadagascar() {
  log('Création des données exemple Madagascar...');
  const now  = Timestamp.now();

  // helpers de date
  const ts = (y, m, d) => Timestamp.fromDate(new Date(y, m - 1, d));

  // ── Campagne ──────────────────────────────────────────────────────────────

  const campagneId = 'campagne-tem-2024';
  await db.doc(`campagnes/${campagneId}`).set({
    id: campagneId,
    organisateurId: 'tem',
    referentielVersion: '3.0',
    nom: 'Évaluation Nationale TEM 2024-2025',
    description: "Campagne d'évaluation annuelle des 6 associations scoutes nationales (ASN) du Tambazotra Eto Madagasikara. Objectif : mesurer la progression et préparer les plans d'amélioration.",
    dateOuverture: ts(2024, 9, 1),
    dateFermeture: ts(2025, 3, 31),
    statut: 'ouverte',
    perimetre: ['tem-antananarivo', 'tem-fianarantsoa', 'tem-toamasina', 'tem-mahajanga', 'tem-toliara', 'tem-antsiranana'],
    createdBy: 'seed',
    createdAt: ts(2024, 8, 15),
  });
  log('  ✓ Campagne TEM 2024-2025');

  // ── Évaluations ───────────────────────────────────────────────────────────

  const evals = [
    {
      id: 'eval-antananarivo-2024',
      orgId: 'tem-antananarivo',
      statut: 'validee',
      type: 'accompagnee',
      scoreGlobal: 85,
      scoreParDimension: { D01:92, D02:88, D03:84, D04:90, D05:78, D06:85, D07:82, D08:88, D09:80, D10:83 },
      createdAt: ts(2024, 9, 5),
      updatedAt: ts(2024, 11, 20),
    },
    {
      id: 'eval-fianarantsoa-2024',
      orgId: 'tem-fianarantsoa',
      statut: 'soumise',
      type: 'auto',
      scoreGlobal: 72,
      scoreParDimension: { D01:78, D02:70, D03:74, D04:76, D05:65, D06:72, D07:68, D08:75, D09:70, D10:68 },
      createdAt: ts(2024, 9, 8),
      updatedAt: ts(2024, 12, 10),
    },
    {
      id: 'eval-toamasina-2024',
      orgId: 'tem-toamasina',
      statut: 'en_cours',
      type: 'auto',
      scoreGlobal: 61,
      scoreParDimension: { D01:68, D02:60, D03:63, D04:65, D05:55, D06:62, D07:58, D08:64, D09:58, D10:57 },
      createdAt: ts(2024, 9, 10),
      updatedAt: ts(2025, 1, 5),
    },
    {
      id: 'eval-mahajanga-2024',
      orgId: 'tem-mahajanga',
      statut: 'en_cours',
      type: 'auto',
      scoreGlobal: 54,
      scoreParDimension: { D01:60, D02:52, D03:55, D04:58, D05:48, D06:55, D07:50, D08:56, D09:52, D10:50 },
      createdAt: ts(2024, 10, 1),
      updatedAt: ts(2025, 1, 15),
    },
    {
      id: 'eval-toliara-2024',
      orgId: 'tem-toliara',
      statut: 'brouillon',
      type: 'auto',
      scoreGlobal: null,
      scoreParDimension: null,
      createdAt: ts(2024, 10, 15),
      updatedAt: ts(2024, 10, 15),
    },
    {
      id: 'eval-antsiranana-2024',
      orgId: 'tem-antsiranana',
      statut: 'brouillon',
      type: 'auto',
      scoreGlobal: null,
      scoreParDimension: null,
      createdAt: ts(2024, 11, 1),
      updatedAt: ts(2024, 11, 1),
    },
  ];

  for (const ev of evals) {
    const { id, ...data } = ev;
    await db.doc(`evaluations/${id}`).set({
      id,
      campagneId,
      createdBy: 'seed',
      criteresEssentielsKO: [],
      ...data,
    });
  }
  log(`  ✓ ${evals.length} évaluations (validée/soumise/en_cours/brouillon)`);

  // ── Scores détaillés — Antananarivo (validée, complète) ───────────────────

  const scoresAntana = {
    // D01 – Gouvernance (92)
    '101':3,'102':3,'103':3,'104':3,'105':3,'106':3,'107':3,'108':2,'109':3,'110':3,
    // D02 – Identité et valeurs (88)
    '201':3,'202':3,'203':3,'204':3,'205':2,'206':3,'207':3,'208':2,'209':3,'210':3,
    // D03 – Programme jeunesse (84)
    '301':3,'302':3,'303':2,'304':3,'305':3,'306':2,'307':3,'308':2,'309':3,'310':3,
    // D04 – Formation adultes (90)
    '401':3,'402':3,'403':3,'404':3,'405':3,'406':3,'407':2,'408':3,'409':3,'410':3,
    // D05 – Développement membres (78)
    '501':3,'502':2,'503':3,'504':2,'505':3,'506':2,'507':2,'508':3,'509':2,'510':3,
    // D06 – Communication (85)
    '601':3,'602':3,'603':2,'604':3,'605':3,'606':2,'607':3,'608':3,'609':2,'610':3,
    // D07 – Partenariats (82)
    '701':3,'702':2,'703':3,'704':3,'705':2,'706':3,'707':2,'708':3,'709':2,'710':3,
    // D08 – Finances (88)
    '801':3,'802':3,'803':3,'804':2,'805':3,'806':3,'807':3,'808':2,'809':3,'810':3,
    // D09 – Infrastructure (80)
    '901':3,'902':2,'903':3,'904':2,'905':3,'906':2,'907':3,'908':2,'909':3,'910':2,
    // D10 – Impact social (83)
   '1001':3,'1002':2,'1003':3,'1004':3,'1005':2,'1006':3,'1007':3,'1008':2,'1009':3,'1010':2,
  };
  const batchScoresAntana = db.batch();
  for (const [code, note] of Object.entries(scoresAntana)) {
    batchScoresAntana.set(
      db.doc(`evaluations/eval-antananarivo-2024/scores/${code}`),
      { critereCode: code, note, commentaire: '', updatedBy: 'seed', updatedAt: now }
    );
  }
  await batchScoresAntana.commit();

  // ── Scores détaillés — Fianarantsoa (soumise, complète) ───────────────────

  const scoresFiana = {
    '101':3,'102':2,'103':3,'104':2,'105':3,'106':3,'107':2,'108':2,'109':3,'110':2,
    '201':2,'202':3,'203':2,'204':3,'205':2,'206':2,'207':3,'208':2,'209':2,'210':3,
    '301':2,'302':3,'303':2,'304':3,'305':2,'306':2,'307':3,'308':2,'309':2,'310':3,
    '401':3,'402':2,'403':3,'404':2,'405':3,'406':3,'407':2,'408':2,'409':3,'410':2,
    '501':2,'502':2,'503':2,'504':1,'505':2,'506':2,'507':1,'508':2,'509':2,'510':2,
    '601':2,'602':3,'603':2,'604':2,'605':3,'606':2,'607':2,'608':3,'609':2,'610':2,
    '701':2,'702':2,'703':3,'704':2,'705':2,'706':2,'707':2,'708':3,'709':2,'710':2,
    '801':3,'802':2,'803':2,'804':2,'805':3,'806':2,'807':2,'808':2,'809':3,'810':2,
    '901':2,'902':2,'903':2,'904':2,'905':2,'906':2,'907':2,'908':2,'909':2,'910':2,
   '1001':2,'1002':2,'1003':2,'1004':2,'1005':2,'1006':2,'1007':2,'1008':2,'1009':2,'1010':1,
  };
  const batchScoresFiana = db.batch();
  for (const [code, note] of Object.entries(scoresFiana)) {
    batchScoresFiana.set(
      db.doc(`evaluations/eval-fianarantsoa-2024/scores/${code}`),
      { critereCode: code, note, commentaire: '', updatedBy: 'seed', updatedAt: now }
    );
  }
  await batchScoresFiana.commit();

  // ── Scores partiels — Toamasina (en_cours, 7/10 dimensions) ──────────────

  const scoresToama = {
    '101':2,'102':2,'103':3,'104':2,'105':2,'106':2,'107':2,'108':1,'109':2,'110':2,
    '201':2,'202':2,'203':2,'204':2,'205':2,'206':2,'207':2,'208':1,'209':2,'210':2,
    '301':2,'302':2,'303':2,'304':2,'305':1,'306':2,'307':2,'308':2,'309':2,'310':2,
    '401':2,'402':2,'403':2,'404':2,'405':2,'406':2,'407':2,'408':2,'409':2,'410':2,
    '501':1,'502':2,'503':1,'504':2,'505':1,'506':2,'507':1,'508':2,'509':1,'510':2,
    '601':2,'602':2,'603':2,'604':2,'605':2,'606':2,'607':2,'608':2,'609':2,'610':2,
    '701':2,'702':2,'703':2,'704':1,'705':2,'706':2,'707':2,'708':1,'709':2,'710':2,
    // D08-D10 pas encore remplis
  };
  const batchScoresToama = db.batch();
  for (const [code, note] of Object.entries(scoresToama)) {
    batchScoresToama.set(
      db.doc(`evaluations/eval-toamasina-2024/scores/${code}`),
      { critereCode: code, note, commentaire: '', updatedBy: 'seed', updatedAt: now }
    );
  }
  await batchScoresToama.commit();
  log('  ✓ Scores : Antananarivo (100%), Fianarantsoa (100%), Toamasina (70%)');

  // ── Plan d'action — Antananarivo ──────────────────────────────────────────

  const planId = 'plan-antananarivo-2024';
  await db.doc(`plansAction/${planId}`).set({
    id: planId,
    evalId: 'eval-antananarivo-2024',
    orgId: 'tem-antananarivo',
    statut: 'actif',
    createdBy: 'seed',
    createdAt: ts(2024, 12, 1),
  });

  const actions = [
    {
      id: 'action-001',
      critereCode: '502',
      domaineAmelioration: 'Développement des membres',
      objectif: 'Augmenter le taux de progression des jeunes de 60% à 80% d\'ici juin 2025',
      description: 'Mettre en place un système de suivi individuel pour chaque scout, avec des entretiens trimestriels et un carnet de progression numérique.',
      responsable: 'Chef Antananarivo',
      dateDebut: ts(2025, 1, 15),
      dateEcheance: ts(2025, 6, 30),
      ressourcesDisponibles: 'Équipe de 5 chefs formés, locaux disponibles',
      ressourcesNecessaires: 'Logiciel de suivi (budget 200 000 Ar), formation complémentaire',
      kpis: 'Taux progression scouts, nb entretiens réalisés/mois, satisfaction jeunes',
      statut: 'en_cours',
      priorite: 'haute',
      createdAt: ts(2024, 12, 2),
    },
    {
      id: 'action-002',
      critereCode: '701',
      domaineAmelioration: 'Partenariats locaux',
      objectif: 'Établir 3 nouveaux partenariats avec des institutions locales (mairie, écoles, ONG)',
      description: 'Identifier les partenaires potentiels, rédiger des conventions de partenariat, organiser des événements conjoints.',
      responsable: 'Chef Antananarivo',
      dateDebut: ts(2025, 2, 1),
      dateEcheance: ts(2025, 8, 31),
      ressourcesDisponibles: 'Réseau existant, lettre d\'accréditation TEM',
      ressourcesNecessaires: 'Budget communication 150 000 Ar, déplacements',
      kpis: 'Nombre de partenariats signés, événements co-organisés, jeunes bénéficiaires',
      statut: 'a_faire',
      priorite: 'moyenne',
      createdAt: ts(2024, 12, 2),
    },
    {
      id: 'action-003',
      critereCode: '901',
      domaineAmelioration: 'Infrastructure & équipement',
      objectif: 'Réhabiliter le local scout principal et acquérir du matériel de camp pour 50 scouts',
      description: 'Travaux de réhabilitation du foyer scout, achat de tentes et matériel de camp, création d\'un espace de stockage sécurisé.',
      responsable: 'Chef Antananarivo',
      dateDebut: ts(2025, 3, 1),
      dateEcheance: ts(2025, 9, 30),
      ressourcesDisponibles: 'Local existant, cotisations membres',
      ressourcesNecessaires: 'Budget 1 500 000 Ar (travaux + matériel), appui région',
      kpis: 'Travaux réalisés %, matériel acquis, nb scouts équipés',
      statut: 'a_faire',
      priorite: 'critique',
      createdAt: ts(2024, 12, 3),
    },
    {
      id: 'action-004',
      critereCode: '205',
      domaineAmelioration: 'Méthode scoute — programme',
      objectif: 'Former 100% des chefs de troupe à la méthode scoute WOSM V3.0 d\'ici mars 2025',
      description: 'Organiser 2 sessions de formation intensive sur la méthode scoute, les valeurs et le référentiel GSAT V3.0. Formation dispensée par le responsable de formation TEM.',
      responsable: 'Chef Formation',
      dateDebut: ts(2025, 1, 10),
      dateEcheance: ts(2025, 3, 31),
      ressourcesNecessaires: 'Formateurs TEM, supports de cours, venue pour 2 weekends',
      kpis: 'Taux de chefs formés, score évaluation formation, nb sessions réalisées',
      statut: 'termine',
      priorite: 'haute',
      createdAt: ts(2024, 12, 3),
    },
  ];

  const batchActions = db.batch();
  for (const { id, ...data } of actions) {
    batchActions.set(db.doc(`plansAction/${planId}/actions/${id}`), { id, planId, ...data });
  }
  await batchActions.commit();

  // Suivis pour action-001 (en_cours) et action-004 (terminée)
  const suivis = [
    {
      path: `plansAction/${planId}/actions/action-001/suivis/suivi-001`,
      data: {
        id: 'suivi-001', actionId: 'action-001',
        commentaire: 'Réunion de lancement effectuée. 12 chefs mobilisés. Modèle de carnet de progression en cours de conception.',
        ancienStatut: 'a_faire', nouveauStatut: 'en_cours',
        createdBy: 'seed', createdAt: ts(2025, 1, 20),
      },
    },
    {
      path: `plansAction/${planId}/actions/action-001/suivis/suivi-002`,
      data: {
        id: 'suivi-002', actionId: 'action-001',
        commentaire: 'Premier round d\'entretiens terminé : 38/52 scouts évalués (73%). Carnet numérique finalisé sous Google Sheets en attendant le logiciel.',
        ancienStatut: 'en_cours', nouveauStatut: 'en_cours',
        createdBy: 'seed', createdAt: ts(2025, 2, 28),
      },
    },
    {
      path: `plansAction/${planId}/actions/action-004/suivis/suivi-003`,
      data: {
        id: 'suivi-003', actionId: 'action-004',
        commentaire: 'Formation Session 1 réalisée le 18-19 janvier (28 participants). Session 2 le 15-16 février (24 participants). Total : 52/52 chefs formés. Évaluation finale : 87% de satisfaction.',
        ancienStatut: 'en_cours', nouveauStatut: 'termine',
        createdBy: 'seed', createdAt: ts(2025, 2, 20),
      },
    },
  ];

  const batchSuivis = db.batch();
  for (const { path, data } of suivis) {
    batchSuivis.set(db.doc(path), data);
  }
  await batchSuivis.commit();
  log('  ✓ Plan d\'action Antananarivo : 4 actions, 3 suivis');

  // ── DashboardStats par ASN ────────────────────────────────────────────────

  const statsAsn = [
    { orgId: 'tem-antananarivo', scoreGlobal: 85, tauxCompletionEval: 100,
      scoreParDimension: { D01:92, D02:88, D03:84, D04:90, D05:78, D06:85, D07:82, D08:88, D09:80, D10:83 },
      criteresEssentielsKO: [] },
    { orgId: 'tem-fianarantsoa', scoreGlobal: 72, tauxCompletionEval: 100,
      scoreParDimension: { D01:78, D02:70, D03:74, D04:76, D05:65, D06:72, D07:68, D08:75, D09:70, D10:68 },
      criteresEssentielsKO: ['505','507'] },
    { orgId: 'tem-toamasina', scoreGlobal: 61, tauxCompletionEval: 70,
      scoreParDimension: { D01:68, D02:60, D03:63, D04:65, D05:55, D06:62, D07:58, D08:null, D09:null, D10:null },
      criteresEssentielsKO: ['305','507'] },
    { orgId: 'tem-mahajanga', scoreGlobal: 54, tauxCompletionEval: 40,
      scoreParDimension: { D01:60, D02:52, D03:55, D04:58, D05:48, D06:55, D07:50, D08:56, D09:52, D10:50 },
      criteresEssentielsKO: ['101','507'] },
    { orgId: 'tem-toliara', scoreGlobal: null, tauxCompletionEval: 0,
      scoreParDimension: {}, criteresEssentielsKO: [] },
    { orgId: 'tem-antsiranana', scoreGlobal: null, tauxCompletionEval: 0,
      scoreParDimension: {}, criteresEssentielsKO: [] },
  ];

  const batchStatsAsn = db.batch();
  for (const { orgId, ...data } of statsAsn) {
    batchStatsAsn.set(db.doc(`dashboardStats/${orgId}`), { orgId, updatedAt: now, ...data });
  }
  await batchStatsAsn.commit();
  log('  ✓ DashboardStats pour 6 ASN TEM');
  log(`✓ Données Madagascar prêtes`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== GSAT Digital — Seed Emulator ===\n');
  try {
    await seedReferentiel();
    await seedOrganisations();
    await seedPays();
    await seedDashboardStats();
    await seedUsers();
    await seedMadagascar();
    console.log('\n✅ Seed terminé avec succès');
    console.log('\nComptes de test :');
    console.log('  admin@gsat-digital.org            / Admin1234!        (admin_global)');
    console.log('  region.africa@wosm.org            / Region1234!       (responsable_region)');
    console.log('  responsable@tem.mg                / Responsable1234!  (responsable_osn — TEM)');
    console.log('  responsable@senegal.scouts.sn     / Senegal1234!      (responsable_osn — Sénégal)');
    console.log('  antananarivo@tem.mg               / Antana1234!       (utilisateur_asn)');
    console.log('  fianarantsoa@tem.mg               / Fiana1234!        (utilisateur_asn)');
    console.log('  toamasina@tem.mg                  / Toama1234!        (utilisateur_asn)');
    console.log('  mahajanga@tem.mg                  / Mahaj1234!        (utilisateur_asn)');
    console.log('  toliara@tem.mg                    / Tolia1234!        (utilisateur_asn)');
    console.log('  antsiranana@tem.mg                / Antsi1234!        (utilisateur_asn)');
    console.log('  evaluateur@tem.mg                 / Eval1234!         (evaluateur)');
    console.log('  lecteur@tem.mg                    / Lecteur1234!      (lecteur)\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Erreur seed:', err);
    process.exit(1);
  }
}

main();
