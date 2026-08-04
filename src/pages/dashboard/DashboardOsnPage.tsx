import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useDashboardOsnStore } from '@/stores/dashboardOsnStore'
import { listOrganisations } from '@/services/organisationService'
import { getDashboardStats } from '@/services/dashboardService'
import { listPlanStatsByOrgIds } from '@/services/planActionService'
import { OsnScoreHero } from '@/components/dashboard/osn/OsnScoreHero'
import { AsnParticipationRing } from '@/components/dashboard/osn/AsnParticipationRing'
import { AsnComparisonTable } from '@/components/dashboard/osn/AsnComparisonTable'
import { CriticalCriteriaList } from '@/components/dashboard/osn/CriticalCriteriaList'
import { AsnProgressList } from '@/components/dashboard/osn/AsnProgressList'
import { OsnRadarChart } from '@/components/dashboard/osn/OsnRadarChart'
import type { Organisation, DashboardStats } from '@/types'

const DIMENSION_CODES = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10']

// ── Types internes ───────────────────────────────────────────────────────────

interface AsnRow {
  asnId: string
  nom: string
  scoreGlobal: number
  scoreParDimension: Record<string, number>
  dernierAudit?: string
}

interface AsnProgressItem {
  asnId: string
  nom: string
  progression: number
  actionsTotal: number
  actionsDone: number
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function DashboardOsnPage() {
  const { t } = useTranslation()
  const { orgId } = useAuthStore()
  const { stats, loading, error, subscribe } = useDashboardOsnStore()

  // Use orgId from auth store, fallback to env variable for dev
  const osnId = orgId ?? import.meta.env['VITE_OSN_ID'] ?? 'tem_madagascar'

  // ── ASN organisations & their individual dashboard stats ──
  const [asnOrgs, setAsnOrgs] = useState<Organisation[]>([])
  const [asnStats, setAsnStats] = useState<Record<string, DashboardStats>>({})
  const [asnLoading, setAsnLoading] = useState(true)

  // ── Progression plan d'action par ASN ──
  interface AsnPlanStats { actionsTotal: number; actionsDone: number }
  const [asnPlanStats, setAsnPlanStats] = useState<Record<string, AsnPlanStats>>({})

  useEffect(() => {
    const unsubscribe = subscribe(osnId)
    return unsubscribe
  }, [subscribe, osnId])

  // Load ASN organisations belonging to this OSN
  useEffect(() => {
    let cancelled = false
    setAsnLoading(true)

    listOrganisations('ASN', osnId)
      .then((orgs) => {
        if (cancelled) return
        setAsnOrgs(orgs)
        setAsnLoading(false)
      })
      .catch(() => {
        if (!cancelled) setAsnLoading(false)
      })

    return () => { cancelled = true }
  }, [osnId])

  // Charge les stats de plan d'action pour chaque ASN
  useEffect(() => {
    if (asnOrgs.length === 0) return
    let cancelled = false

    const fetchPlanStats = async () => {
      // Optimisation : une seule passe parallèle au lieu de N×2 appels séquentiels
      const results = await listPlanStatsByOrgIds(asnOrgs.map(o => o.id))
      if (!cancelled) setAsnPlanStats(results)
    }

    void fetchPlanStats()
    return () => { cancelled = true }
  }, [asnOrgs])

  // Load dashboard stats for each ASN once the list is available
  useEffect(() => {
    if (asnOrgs.length === 0) return
    let cancelled = false

    const fetchAsnStats = async () => {
      const results = await Promise.all(
        asnOrgs.map(org => getDashboardStats(org.id).then(s => ({ id: org.id, s })))
      )
      if (cancelled) return
      setAsnStats(
        results.reduce<Record<string, DashboardStats>>((acc, { id, s }) => {
          if (s) acc[id] = s
          return acc
        }, {})
      )
    }

    void fetchAsnStats()
    return () => { cancelled = true }
  }, [asnOrgs])

  // Build ASN comparison rows from loaded stats
  const asnRows: AsnRow[] = useMemo(
    () =>
      asnOrgs
        .map((org) => {
          const s = asnStats[org.id]
          // Also check scoresAsn from OSN-level stats as fallback
          const fallbackScore = stats?.scoresAsn?.[org.id]
          const scoreGlobal = s?.scoreGlobal ?? fallbackScore ?? 0
          return {
            asnId: org.id,
            nom: org.nom,
            scoreGlobal,
            scoreParDimension: s?.scoreParDimension ?? {},
          }
        })
        .sort((a, b) => b.scoreGlobal - a.scoreGlobal),
    [asnOrgs, asnStats, stats],
  )

  // Build progress items depuis les vrais plans d'action
  const progressItems: AsnProgressItem[] = useMemo(
    () =>
      asnOrgs
        .map((org) => {
          const planStats = asnPlanStats[org.id]
          const actionsTotal = planStats?.actionsTotal ?? 0
          const actionsDone = planStats?.actionsDone ?? 0
          const progression = actionsTotal > 0
            ? Math.round((actionsDone / actionsTotal) * 100)
            : 0
          return {
            asnId: org.id,
            nom: org.nom,
            progression,
            actionsTotal,
            actionsDone,
          }
        })
        .filter((item) => item.actionsTotal > 0)
        .sort((a, b) => a.progression - b.progression),
    [asnOrgs, asnPlanStats],
  )

  const scoreGlobal = stats?.scoreGlobal ?? 0
  const scoreParDimension = stats?.scoreParDimension ?? {}

  const criticalItems = (stats?.criteresEssentielsKO ?? []).map((code) => ({
    code,
    dimensionCode: `D0${code[0]}`,
    label: `${t('common.critere', 'Critere')} ${code}`,
    description: t('dashboard.enAttenteSync', 'Data from Supabase.'),
    severity: 'critical' as const,
  }))

  const total = stats?.nbAsn ?? asnOrgs.length
  const evaluated = stats?.tauxCompletionEval != null
    ? Math.round((stats.tauxCompletionEval * total) / 100)
    : asnRows.filter((r) => r.scoreGlobal > 0).length

  return (
    <div>
      {/* En-tête page */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <span className="text-xs font-bold tracking-widest text-[#454651] uppercase mb-2 block">
            Executive Dashboard
          </span>
          <h1 className="text-4xl font-headline font-extrabold tracking-tight text-[#15236e]">
            {t('pages.dashboardOsn.title', 'Tableau de Bord National')}
          </h1>
          <p className="text-[#454651] mt-2 max-w-2xl">
            {t(
              'pages.dashboardOsn.subtitle',
              "Aperçu stratégique de la conformité GSAT et de la performance organisationnelle pour l'Organisation Scoute Nationale.",
            )}
          </p>
        </div>
        <button className="flex items-center gap-3 bg-white text-[#171c22] font-bold py-3 px-6 rounded-xl shadow-sm hover:shadow-md transition-all border border-[#c6c5d2]/10">
          <span className="material-symbols-outlined text-[#15236e]">download</span>
          {t('common.export', 'Télécharger les Rapports')}
        </button>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="mb-6 p-4 bg-[#ffdad6] text-[#93000a] rounded-xl text-sm flex items-center gap-2">
          <span className="material-symbols-outlined">warning</span>
          {error}
        </div>
      )}

      {/* Bento Grid KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {/* Score national — col-span-2 */}
        <OsnScoreHero
          scoreGlobal={scoreGlobal}
          nbAsn={total}
          tauxCompletion={stats?.tauxCompletionEval ?? (total > 0 ? Math.round((evaluated / total) * 100) : 0)}
        />

        {/* Taux de participation */}
        <AsnParticipationRing evaluated={evaluated} total={total} />

        {/* Statut audit */}
        <div className="bg-[#ffffff] p-6 rounded-2xl shadow-sm border border-[#c6c5d2]/5">
          <p className="text-[#454651] text-xs font-bold uppercase tracking-widest mb-6">
            {t('pages.dashboardOsn.statutAudit', 'Statut Audit')}
          </p>
          <div className="flex items-start gap-4">
            <div className="bg-[#ffdad6] text-[#93000a] p-2 rounded-lg">
              <span className="material-symbols-outlined">event_busy</span>
            </div>
            <div>
              <p className="text-lg font-headline font-extrabold text-[#15236e]">
                {criticalItems.length} {t('pages.dashboardOsn.retards', 'Retards')}
              </p>
              <p className="text-[#454651] text-xs font-medium">
                {t('pages.dashboardOsn.reevaluationsRequises', 'Réévaluations requises')}
              </p>
            </div>
          </div>
          {loading && (
            <div className="mt-4 pt-4 border-t border-[#c6c5d2]/10">
              <span className="text-xs text-[#454651] italic">
                {t('common.loading', 'Synchronisation…')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Grille principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonne gauche (2/3) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tableau comparatif ASN */}
          {(loading || asnLoading) ? (
            <div className="bg-[#ffffff] rounded-2xl shadow-sm p-8 text-center border border-[#c6c5d2]/5">
              <span className="material-symbols-outlined text-[#c6c5d2] text-4xl animate-spin">sync</span>
              <p className="text-[#454651] text-sm mt-3">{t('common.loading', 'Loading...')}</p>
            </div>
          ) : (
            <AsnComparisonTable rows={asnRows} dimensionCodes={DIMENSION_CODES.slice(0, 5)} />
          )}

          {/* Radar dimensions */}
          <OsnRadarChart scoreParDimension={scoreParDimension} />
        </div>

        {/* Colonne droite (1/3) */}
        <div className="space-y-8">
          {/* Lacunes critiques */}
          <CriticalCriteriaList items={criticalItems} />

          {/* Priorites plan d'action */}
          <AsnProgressList items={progressItems} />

          {/* Certification données */}
          <div className="bg-[#15236e] rounded-2xl p-6 text-white overflow-hidden relative">
            <div className="relative z-10">
              <span className="material-symbols-outlined text-white/50 text-4xl mb-4 block">
                verified_user
              </span>
              <h4 className="font-headline font-bold text-lg mb-2">
                {t('pages.dashboardOsn.certificationDonnees', 'Certification des Données')}
              </h4>
              <p className="text-white/70 text-xs leading-relaxed mb-4">
                {t(
                  'pages.dashboardOsn.certificationDesc',
                  'Les données affichées sont synchronisées en temps réel depuis la base de données.',
                )}
              </p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#3b6934] animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/90">
                  {t('pages.dashboardOsn.systemeAJour', 'Système à jour')}
                </span>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-[120px]">analytics</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
