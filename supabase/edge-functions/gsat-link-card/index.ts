// =============================================================================
// Edge Function : gsat-link-card — entrée Deno (E19 vague 2, Tily Wiki)
// GET /functions/v1/gsat-link-card?path=/evaluation/<uuid>
// En-tête x-tem-link-card-key = secret GSAT_LINK_CARD_KEY du runtime (≥ 32
// caractères, même valeur que TEM_GSAT_LINK_CARD_KEY côté wiki, distincte de
// la clé ERPTEM ; générer hors dépôt : openssl rand -hex 32 ; jamais commitée).
// GSAT_LINK_CARD_ROOT_ORG_IDS = UUID de l'OSN TEM (virgules pour plusieurs) :
// seules ses évaluations et celles de ses ASN donnent une carte ; absente →
// fonction fermée (503). Hors périmètre → 404, comme une évaluation inconnue.
// Runtime : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service role : RLS
// contournée, la liste blanche de handler.ts est la seule garde).
// À servir SANS vérification JWT (verify_jwt = false) : le wiki n'a pas de JWT
// GSAT ; la clé partagée protège la fonction. Pas de CORS : appel serveur à
// serveur. Hors de src/ : non vérifié par tsc (`deno check` si Deno est là).
// =============================================================================

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { EVALUATION_SELECT, handleLinkCard, toCardRow } from './handler.ts'

let admin: SupabaseClient | null = null

// Créé à la première lecture : sans secret valide, la fonction répond 503
// avant d'en avoir besoin.
function client(): SupabaseClient {
  admin ??= createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return admin
}

Deno.serve((req: Request): Promise<Response> =>
  handleLinkCard(req, {
    key: Deno.env.get('GSAT_LINK_CARD_KEY'),
    rootOrgIds: Deno.env.get('GSAT_LINK_CARD_ROOT_ORG_IDS'),
    loadEvaluation: async (id) => {
      const { data, error } = await client()
        .from('evaluations')
        .select(EVALUATION_SELECT)
        .eq('id', id)
        .maybeSingle()
      // Code PostgREST seulement : ni donnée ni secret dans le journal.
      if (error) throw new Error(`evaluations read failed (${error.code || 'unknown'})`)
      return toCardRow(data)
    },
    loadOrganisation: async (id) => {
      const { data, error } = await client().from('organisations').select('type, actif').eq('id', id).maybeSingle()
      if (error) throw new Error(`organisations read failed (${error.code || 'unknown'})`)
      return data ? { type: data.type, actif: data.actif } : null
    },
    logError: (message) => console.error('[gsat-link-card]', message),
  }),
)
