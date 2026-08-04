import { create } from 'zustand'
import { supabase } from '@/services/supabase'
import type { DashboardStats, Organisation, RegionCode } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CountryScore {
  orgId: string
  nom: string
  codeIso?: string | undefined
  regionCode: RegionCode
  scoreGlobal: number
  scoreParDimension: Record<string, number>
  criteresEssentielsKO: string[]
}

export interface RegionSummary {
  code: RegionCode
  label: { fr: string; en: string }
  avgScore: number
  osnCount: number
  osnEvaluated: number
  growth: number | null // null = no historical data available
}

interface DashboardGlobalState {
  countryScores: CountryScore[]
  regionSummaries: RegionSummary[]
  globalScore: number
  selectedRegion: RegionCode | null
  loading: boolean
  error: string | null

  // Actions
  loadGlobalData: () => Promise<void>
  setSelectedRegion: (region: RegionCode | null) => void

  // Selectors
  filteredCountries: () => CountryScore[]
}

// ── Region labels ────────────────────────────────────────────────────────────

const REGION_LABELS: Record<RegionCode, { fr: string; en: string }> = {
  AFRICA:        { fr: 'Afrique',        en: 'Africa' },
  ASIA_PACIFIC:  { fr: 'Asie-Pacifique', en: 'Asia-Pacific' },
  ARAB:          { fr: 'Arabe',          en: 'Arab' },
  INTERAMERICA:  { fr: 'Interamerique',  en: 'Interamerica' },
  EUROPE:        { fr: 'Europe',         en: 'Europe' },
  EURASIA:       { fr: 'Eurasie',        en: 'Eurasia' },
}

// ── Helpers de conversion DB → type applicatif ────────────────────────────────

function rowToOrg(row: Record<string, unknown>): Organisation {
  const lat = row['lat'] as number | null | undefined
  const lng = row['lng'] as number | null | undefined
  const paysId    = row['pays_id']     as string | null | undefined
  const regionCode = row['region_code'] as RegionCode | null | undefined
  const parentId  = row['parent_id']   as string | null | undefined
  return {
    id:   row['id']   as string,
    nom:  row['nom']  as string,
    type: row['type'] as Organisation['type'],
    actif: row['actif'] as boolean,
    ...(paysId    != null ? { paysId }    : {}),
    ...(regionCode != null ? { regionCode } : {}),
    ...(parentId  != null ? { parentId }  : {}),
    ...(lat != null && lng != null ? { coordonnees: { lat, lng } } : {}),
  }
}

function rowToStats(row: Record<string, unknown>): DashboardStats {
  const nbAsn              = row['nb_asn']               as number | null | undefined;
  const scoresAsn          = row['scores_asn']           as Record<string, number> | null | undefined;
  const tauxCompletionEval = row['taux_completion_eval'] as number | null | undefined;
  return {
    orgId:                row['org_id']                   as string,
    scoreGlobal:          ((row['score_global']           as number) ?? 0),
    scoreParDimension:    ((row['score_par_dimension']    as Record<string, number>) ?? {}),
    criteresEssentielsKO: ((row['criteres_essentiels_ko'] as string[]) ?? []),
    updatedAt:            row['updated_at']               as string,
    ...(nbAsn              != null ? { nbAsn }              : {}),
    ...(scoresAsn          != null ? { scoresAsn }          : {}),
    ...(tauxCompletionEval != null ? { tauxCompletionEval } : {}),
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useDashboardGlobalStore = create<DashboardGlobalState>((set, get) => ({
  countryScores: [],
  regionSummaries: [],
  globalScore: 0,
  selectedRegion: null,
  loading: false,
  error: null,

  loadGlobalData: async () => {
    set({ loading: true, error: null })
    try {
      // Load all active OSN organisations
      const { data: orgsData, error: orgsError } = await supabase
        .from('organisations')
        .select('*')
        .eq('type', 'OSN')
        .eq('actif', true)
        .order('nom')
      if (orgsError) throw orgsError

      const orgs: Organisation[] = (orgsData ?? []).map(r => rowToOrg(r as Record<string, unknown>))
      const orgIds = orgs.map(o => o.id)

      // Load dashboard stats for all OSN ids in one query (no Supabase IN limit)
      const statsMap: Record<string, DashboardStats> = {}
      if (orgIds.length > 0) {
        const { data: statsData, error: statsError } = await supabase
          .from('dashboard_stats')
          .select('*')
          .in('org_id', orgIds)
        if (statsError) throw statsError

        for (const row of statsData ?? []) {
          const s = rowToStats(row as Record<string, unknown>)
          statsMap[s.orgId] = s
        }
      }

      // Build country scores
      const countryScores: CountryScore[] = orgs.map(org => {
        const stats = statsMap[org.id]
        return {
          orgId: org.id,
          nom: org.nom,
          codeIso: org.paysId,
          regionCode: org.regionCode ?? 'AFRICA',
          scoreGlobal: stats?.scoreGlobal ?? 0,
          scoreParDimension: stats?.scoreParDimension ?? {},
          criteresEssentielsKO: stats?.criteresEssentielsKO ?? [],
        }
      })

      // Build region summaries
      const regionGroups: Record<RegionCode, CountryScore[]> = {
        AFRICA: [],
        ASIA_PACIFIC: [],
        ARAB: [],
        INTERAMERICA: [],
        EUROPE: [],
        EURASIA: [],
      }

      for (const cs of countryScores) {
        const group = regionGroups[cs.regionCode]
        if (group) group.push(cs)
      }

      const regionSummaries: RegionSummary[] = (Object.keys(regionGroups) as RegionCode[]).map(code => {
        const group = regionGroups[code]
        const evaluated = group.filter(c => c.scoreGlobal > 0)
        const avgScore = evaluated.length > 0
          ? Math.round(evaluated.reduce((sum, c) => sum + c.scoreGlobal, 0) / evaluated.length)
          : 0
        return {
          code,
          label: REGION_LABELS[code],
          avgScore,
          osnCount: group.length,
          osnEvaluated: evaluated.length,
          growth: null, // no historical snapshot in dashboard_stats
        }
      })

      // Global score
      const evaluatedAll = countryScores.filter(c => c.scoreGlobal > 0)
      const globalScore = evaluatedAll.length > 0
        ? Math.round(evaluatedAll.reduce((sum, c) => sum + c.scoreGlobal, 0) / evaluatedAll.length)
        : 0

      set({ countryScores, regionSummaries, globalScore, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  setSelectedRegion: (region: RegionCode | null) => {
    set({ selectedRegion: region })
  },

  filteredCountries: () => {
    const { countryScores, selectedRegion } = get()
    if (!selectedRegion) return countryScores
    return countryScores.filter(c => c.regionCode === selectedRegion)
  },
}))
