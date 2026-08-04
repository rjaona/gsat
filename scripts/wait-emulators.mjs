/**
 * wait-emulators.mjs — Poll jusqu'à ce que les émulateurs Firebase soient prêts.
 * Usage : node scripts/wait-emulators.mjs
 */

import { createConnection } from 'net';

const PORTS = [
  { name: 'Auth',      port: 9400 },
  { name: 'Firestore', port: 8400 },
];
const TIMEOUT_MS  = 120_000;
const INTERVAL_MS = 1_000;

function checkPort(port) {
  return new Promise(resolve => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error',   () => { socket.destroy(); resolve(false); });
  });
}

async function waitAll() {
  const deadline = Date.now() + TIMEOUT_MS;
  const ready = new Set();

  while (ready.size < PORTS.length) {
    if (Date.now() > deadline) {
      console.error(`❌ Timeout: émulateurs non prêts après ${TIMEOUT_MS / 1000}s`);
      process.exit(1);
    }
    for (const { name, port } of PORTS) {
      if (!ready.has(port) && await checkPort(port)) {
        console.log(`✅ ${name} (${port}) prêt`);
        ready.add(port);
      }
    }
    if (ready.size < PORTS.length) {
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
  }
  console.log('\n🚀 Tous les émulateurs sont prêts');
}

waitAll();
