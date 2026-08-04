/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase.generated'

// ---------------------------------------------------------------------------
// Client Supabase — singleton
// Remplace src/services/firebase.ts
// ---------------------------------------------------------------------------

const supabaseUrl  = import.meta.env['VITE_SUPABASE_URL'] as string
const supabaseAnon = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is not set. Check your .env.local file.')
}
if (!supabaseAnon) {
  throw new Error('VITE_SUPABASE_ANON_KEY is not set. Check your .env.local file.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnon, {
  auth: {
    // Équivalent de browserSessionPersistence : stockage en mémoire uniquement.
    // Le token est perdu à la fermeture de l'onglet.
    storage: sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// ---------------------------------------------------------------------------
// Client admin (Edge Functions uniquement — NE PAS utiliser côté browser)
// Exposé ici pour référence ; en pratique les Edge Functions créent leur propre
// client avec SUPABASE_SERVICE_ROLE_KEY.
// ---------------------------------------------------------------------------

// export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey)
// → N'utiliser QUE dans les Edge Functions Deno côté serveur.

export default supabase
