// =============================================================================
// Edge Function : chat-with-ai
// Remplace la Cloud Function Firebase "chatWithAi"
// Runtime : Deno (Supabase Edge Functions)
// Secret requis : ANTHROPIC_API_KEY (Dashboard > Settings > Edge Functions)
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-3-5-sonnet-20241022'
const MAX_TOKENS = 1024
const RATE_LIMIT_WINDOW_MS = 60_000   // 1 minute
const RATE_LIMIT_MAX_CALLS = 20       // 20 appels / minute / utilisateur

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  messages: ChatMessage[]
  currentDimension: string | null
  currentCriterion: string | null
  referentielContext: string
}

Deno.serve(async (req: Request): Promise<Response> => {
  // ── CORS ────────────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': Deno.env.get('CORS_ORIGIN') ?? 'https://gsat.tily-digital.com',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  // ── Auth : vérifier le JWT Supabase ────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonError('Missing Authorization header', 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return jsonError('Unauthorized', 401)
  }

  // ── Rate limiting (table rate_limits en base) ───────────────────────────────
  const rateLimitKey = `chatWithAi:${user.id}`
  const now = Date.now()

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data: rl } = await supabaseAdmin
    .from('rate_limits')
    .select('count, window_end')
    .eq('key', rateLimitKey)
    .single()

  if (rl && new Date(rl.window_end).getTime() > now) {
    if (rl.count >= RATE_LIMIT_MAX_CALLS) {
      return jsonError('Rate limit exceeded. Please wait before sending another message.', 429)
    }
    // Incrémenter
    await supabaseAdmin
      .from('rate_limits')
      .update({ count: rl.count + 1, updated_at: new Date().toISOString() })
      .eq('key', rateLimitKey)
  } else {
    // Nouvelle fenêtre
    await supabaseAdmin
      .from('rate_limits')
      .upsert({
        key: rateLimitKey,
        count: 1,
        window_end: new Date(now + RATE_LIMIT_WINDOW_MS).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })
  }

  // ── Lecture du body ─────────────────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await req.json() as RequestBody
  } catch {
    return jsonError('Invalid JSON body', 400)
  }

  const { messages, currentDimension, currentCriterion, referentielContext } = body

  if (!messages || messages.length === 0) {
    return jsonError('messages is required', 400)
  }

  // ── Appel Anthropic ─────────────────────────────────────────────────────────
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    // Pas de clé configurée → retourner mock flag
    return Response.json({ response: '', mock: true })
  }

  const systemPrompt = buildSystemPrompt(currentDimension, currentCriterion, referentielContext)

  try {
    const anthropicResp = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messages.slice(-10), // garder les 10 derniers messages max
      }),
    })

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text()
      console.error('[chat-with-ai] Anthropic API error:', errText)
      return jsonError('AI service error', 502)
    }

    const result = await anthropicResp.json() as {
      content: Array<{ type: string; text: string }>
    }
    const responseText = result.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('')

    return Response.json({ response: responseText, mock: false })

  } catch (err) {
    console.error('[chat-with-ai] fetch error:', err)
    return jsonError('Failed to reach AI service', 502)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  dimension: string | null,
  criterion: string | null,
  referentielContext: string,
): string {
  let prompt = `You are the GSAT Evaluation Assistant, an expert in the Global Scout Assessment Tool (GSAT) Version 3.0 from the World Organization of the Scout Movement (WOSM).

Your role is to help NSO representatives and evaluators understand the GSAT framework, score criteria accurately, and collect appropriate evidence.

## GSAT Context
${referentielContext}
`

  if (dimension) {
    prompt += `\n## Current Focus\nDimension: ${dimension}`
    if (criterion) {
      prompt += `\nCriterion: ${criterion}`
    }
  }

  prompt += `\n## Guidelines
- Be concise but thorough in your explanations
- Always base your guidance on the official GSAT V3.0 framework
- When discussing scoring, always reference the 0-3 scale
- Highlight essential criteria and their importance
- Suggest practical, achievable evidence types
- Respond in the same language as the user (French or English)`

  return prompt
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}
