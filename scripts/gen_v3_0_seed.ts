import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { genV3Seed, type V3ReferentielJson } from '../src/services/seed/genV3Seed';

const here = dirname(fileURLToPath(import.meta.url));
const json = JSON.parse(
  readFileSync(resolve(here, '../src/data/referentiel_v3_0.json'), 'utf8'),
) as V3ReferentielJson;
mkdirSync(resolve(here, '../supabase/seeds'), { recursive: true });
writeFileSync(resolve(here, '../supabase/seeds/referentiel_v3_0_seed.sql'), genV3Seed(json));
console.log('Wrote supabase/seeds/referentiel_v3_0_seed.sql');
