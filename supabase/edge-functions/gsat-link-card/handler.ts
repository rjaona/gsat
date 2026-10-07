// =============================================================================
// Edge Function : gsat-link-card — gestionnaire (E19 vague 2, Tily Wiki)
// Carte « Évaluation » des liens intelligents de Tily Wiki, appelée de serveur
// à serveur avec l'en-tête x-tem-link-card-key (secret GSAT_LINK_CARD_KEY).
// Module pur : ni Deno.*, ni import distant, ni node: — testé par vitest
// (src/__tests__/gsatLinkCard.test.ts). index.ts est l'entrée Deno.
// La lecture se fait avec le service role (RLS contournée) : la liste blanche
// ci-dessous (requête ET réponse) est la SEULE garde sur le contenu. Jamais de
// score, ni de nom de personne, ni de revue, de PV ou de commentaire.
// =============================================================================

export const KEY_HEADER = 'x-tem-link-card-key'
// Un secret plus court ferme la fonction (503), comme un secret absent.
export const LINK_CARD_KEY_MIN = 32
const TEXT_MAX = 200
// `/evaluation/new` et `/evaluation/validate/:id` ne sont pas des fiches.
const PATH = /^\/evaluation\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
const NO_STORE: Record<string, string> = { 'Cache-Control': 'no-store' }

// Liste blanche de la requête PostgREST : rien d'autre n'est lu.
export const EVALUATION_SELECT =
  'statut, type, campagne:campagnes(nom, date_ouverture, date_fermeture), organisation:organisations(nom, code)'

// Statuts lisibles (refus par défaut) : `brouillon` et tout autre → 404.
const STATUS_LABELS: ReadonlyMap<string, string> = new Map([
  ['en_cours', 'En cours'],
  ['soumise', 'Soumise'],
  ['validee', 'Validée'],
  ['cloturee', 'Clôturée'],
])

const TYPE_LABELS: ReadonlyMap<string, string> = new Map([
  ['auto', 'Auto-évaluation'],
  ['accompagnee', 'Évaluation accompagnée'],
])

// Copie de PROVINCES (src/utils/perimetreProvinces.ts) : une fonction Deno
// n'importe pas src/. Parité vérifiée par le test.
export const PROVINCE_LABELS: ReadonlyMap<string, string> = new Map([
  ['ANT', 'Antananarivo'],
  ['TOA', 'Toamasina'],
  ['MAH', 'Mahajanga'],
  ['FIA', 'Fianarantsoa'],
  ['TOL', 'Toliara'],
  ['DIA', 'Antsiranana'],
  ['DSP', 'Diaspora'],
])

export interface LinkCardCampagne {
  nom: unknown
  date_ouverture: unknown
  date_fermeture: unknown
}

export interface LinkCardOrganisation {
  nom: unknown
  code: unknown
}

export interface LinkCardEvaluation {
  statut: unknown
  type: unknown
  campagne: LinkCardCampagne | null
  organisation: LinkCardOrganisation | null
}

export interface LinkCardDeps {
  /** Secret GSAT_LINK_CARD_KEY, lu à chaque requête. */
  key: string | undefined
  /** Lecture (service role) par id, colonnes de EVALUATION_SELECT seulement ; null = absente. */
  loadEvaluation: (id: string) => Promise<LinkCardEvaluation | null>
  /** Journal d'erreur : un message technique, jamais la clé ni une donnée. */
  logError?: ((message: string) => void) | undefined
}

const DAY = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Indian/Antananarivo',
})

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

const badPath = (): Response => json(400, { error: 'Chemin non reconnu.', code: 'link_card_bad_path' })
const notFound = (): Response => json(404, { error: 'Évaluation introuvable.', code: 'link_card_not_found' })

export function configuredKey(raw: string | undefined): string | null {
  const key = (raw ?? '').trim()
  return key.length >= LINK_CARD_KEY_MIN ? key : null
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

// Empreintes SHA-256 (même longueur) comparées octet par octet sans sortie
// anticipée : ni fuite de la longueur de la clé, ni du premier octet différent.
async function keyMatches(given: string | null, expected: string): Promise<boolean> {
  if (!given) return false
  const [a, b] = await Promise.all([digest(given), digest(expected)])
  let diff = a.length ^ b.length
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

// Une relation PostgREST « plusieurs-à-un » arrive en objet ; par prudence,
// un tableau est réduit à son premier élément.
function one(value: unknown): Record<string, unknown> | null {
  const item: unknown = Array.isArray(value) ? value[0] : value
  return isRecord(item) ? item : null
}

/** Réponse PostgREST → ligne de carte : seules les clés de la liste blanche sont copiées. */
export function toCardRow(raw: unknown): LinkCardEvaluation | null {
  if (!isRecord(raw)) return null
  const campagne = one(raw['campagne'])
  const organisation = one(raw['organisation'])
  return {
    statut: raw['statut'],
    type: raw['type'],
    campagne: campagne
      ? { nom: campagne['nom'], date_ouverture: campagne['date_ouverture'], date_fermeture: campagne['date_fermeture'] }
      : null,
    organisation: organisation ? { nom: organisation['nom'], code: organisation['code'] } : null,
  }
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
  return clean ? clean.slice(0, TEXT_MAX) : null
}

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const s = value.trim()
  // Date seule : midi UTC, le même jour à Antananarivo (UTC+3).
  const date = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(s)
  return Number.isNaN(date.getTime()) ? null : date
}

function dates(start: unknown, end: unknown): string | null {
  const a = toDate(start)
  const b = toDate(end)
  const from = a ? DAY.format(a) : null
  const to = b ? DAY.format(b) : null
  if (from && to) return from === to ? from : `${from} – ${to}`
  return from ?? to
}

// Province TEM = préfixe de organisations.code avant le premier '-'.
function province(code: unknown): string | null {
  if (typeof code !== 'string') return null
  return PROVINCE_LABELS.get(code.split('-')[0] ?? '') ?? null
}

export async function handleLinkCard(req: Request, deps: LinkCardDeps): Promise<Response> {
  const expected = configuredKey(deps.key)
  if (!expected) return json(503, { error: 'Cartes de liens non configurées.' }, NO_STORE)
  if (!(await keyMatches(req.headers.get(KEY_HEADER), expected))) {
    return json(401, { error: 'Clé de carte invalide.' }, NO_STORE)
  }
  if (req.method !== 'GET') return json(405, { error: 'Méthode non autorisée.' }, { Allow: 'GET', ...NO_STORE })

  // Seul le paramètre `path` compte : le chemin de la requête dépend de Kong.
  let paths: string[]
  try {
    paths = new URL(req.url).searchParams.getAll('path')
  } catch {
    return badPath()
  }
  const id = paths.length === 1 ? PATH.exec(paths[0] ?? '')?.[1]?.toLowerCase() : undefined
  if (!id) return badPath()

  try {
    const row = await deps.loadEvaluation(id)
    const statut = typeof row?.statut === 'string' ? row.statut : ''
    const stateLabel = STATUS_LABELS.get(statut)
    // Absente, brouillon ou statut inconnu : indiscernables.
    if (!row || !stateLabel) return notFound()

    const organisation = text(row.organisation?.nom)
    const campagne = text(row.campagne?.nom)
    const type = typeof row.type === 'string' ? (TYPE_LABELS.get(row.type) ?? null) : null
    const subtitle =
      [
        type,
        organisation ? campagne : null,
        dates(row.campagne?.date_ouverture, row.campagne?.date_fermeture),
        province(row.organisation?.code),
      ]
        .filter((part): part is string => !!part)
        .join(' · ') || null

    return json(
      200,
      { title: organisation ?? campagne ?? 'Évaluation', subtitle, state: statut, stateLabel, meta: {} },
      { 'Cache-Control': 'private, max-age=300' },
    )
  } catch (err) {
    deps.logError?.(err instanceof Error ? err.message : 'error')
    return json(500, { error: 'Erreur interne.' }, NO_STORE)
  }
}
