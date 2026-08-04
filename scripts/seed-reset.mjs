/**
 * seed-reset.mjs — Supprime toutes les collections Firestore et tous les
 * comptes Auth de l'emulateur, puis relance le seed complet.
 *
 * Usage : node scripts/seed-reset.mjs
 * (Lancer APRES firebase emulators:start)
 *
 * ATTENTION : ce script est reserve a l'environnement de developpement.
 * Il supprime TOUTES les donnees de l'emulateur.
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ── Pointer vers les emulators GSAT ──────────────────────────────────────────

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8400';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9400';

// ── Init Admin SDK ────────────────────────────────────────────────────────────

if (!getApps().length) {
  initializeApp({ projectId: 'gsatwosm' });
}

const db   = getFirestore();
const auth = getAuth();

function log(msg) { console.log(`[reset] ${msg}`); }

// ── Collections a supprimer ──────────────────────────────────────────────────

const COLLECTIONS = [
  'referentiel',
  'organisations',
  'pays',
  'campagnes',
  'evaluations',
  'plansAction',
  'preuves',
  'dashboardStats',
  'users',
  'auditLog',
];

// ── Suppression recursive d'une collection ───────────────────────────────────

async function deleteCollection(collectionPath) {
  const collRef = db.collection(collectionPath);
  const batchSize = 100;

  let deleted = 0;
  let snap = await collRef.limit(batchSize).get();

  while (!snap.empty) {
    const batch = db.batch();

    for (const docSnap of snap.docs) {
      // Supprimer les sous-collections connues
      const subCollections = await docSnap.ref.listCollections();
      for (const subCol of subCollections) {
        await deleteCollection(subCol.path);
      }
      batch.delete(docSnap.ref);
      deleted++;
    }

    await batch.commit();
    snap = await collRef.limit(batchSize).get();
  }

  return deleted;
}

// ── Suppression de tous les comptes Auth ─────────────────────────────────────

async function deleteAllAuthUsers() {
  let deleted = 0;
  let pageToken;

  do {
    const listResult = await auth.listUsers(100, pageToken);
    const uids = listResult.users.map(u => u.uid);

    if (uids.length > 0) {
      await auth.deleteUsers(uids);
      deleted += uids.length;
    }

    pageToken = listResult.pageToken;
  } while (pageToken);

  return deleted;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== GSAT Digital — Reset Emulator ===\n');

  // Verification de securite : ne fonctionne que sur l'emulateur
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('ERREUR : Ce script ne doit tourner que sur l\'emulateur Firestore.');
    console.error('Variable FIRESTORE_EMULATOR_HOST non definie.');
    process.exit(1);
  }

  try {
    // 1. Supprimer les collections Firestore
    log('Suppression des collections Firestore...');
    for (const col of COLLECTIONS) {
      const count = await deleteCollection(col);
      if (count > 0) {
        log(`  ${col}: ${count} document(s) supprime(s)`);
      }
    }
    log('Collections Firestore videes.');

    // 2. Supprimer les comptes Auth
    log('Suppression des comptes Auth...');
    const authCount = await deleteAllAuthUsers();
    log(`  ${authCount} compte(s) Auth supprime(s).`);

    console.log('\nReset termine. Lancez `npm run seed` pour recharger les donnees.\n');
    process.exit(0);
  } catch (err) {
    console.error('\nErreur reset:', err);
    process.exit(1);
  }
}

main();
