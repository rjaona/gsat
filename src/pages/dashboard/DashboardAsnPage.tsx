import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useReferentielStore } from '@/stores/referentielStore'
import { subscribeDashboardStats } from '@/services/dashboardService'
import { subscribeEvaluationsByOrg } from '@/services/evaluationService'
import { useState } from 'react'
import type { DashboardStats, Evaluation } from '@/types'

// ---- Helpers ---------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 75) return 'text-[#1a5c14]'
  if (score >= 50) return 'text-wosm-purple'
  if (score >= 25) return 'text-[#b44d00]'
  return 'text-on-error-container'
}

function scoreIconBg(score: number): string {
  if (score >= 75) return 'bg-[#d4f5cd] text-[#1a5c14]'
  if (score >= 50) return 'bg-wosm-purple-container text-wosm-purple'
  if (score >= 25) return 'bg-wosm-yellow-container text-[#b44d00]'
  return 'bg-error-container text-on-error-container'
}

// Dimension metadata for display
const DIMENSION_META: Record<string, { label: string; icon: string }> = {
  D01: { label: 'Institutionnel', icon: 'gavel' },
  D02: { label: 'Gouvernance', icon: 'groups' },
  D03: { label: 'Strategie', icon: 'strategy' },
  D04: { label: 'Integrite', icon: 'verified_user' },
  D05: { label: 'Communication', icon: 'campaign' },
  D06: { label: 'Adultes', icon: 'hub' },
  D07: { label: 'Finances', icon: 'payments' },
  D08: { label: 'Programme', icon: 'volunteer_activism' },
  D09: { label: 'Croissance', icon: 'trending_up' },
  D10: { label: 'Amelioration', icon: 'auto_fix_high' },
}

// ---- Page ------------------------------------------------------------------

export function DashboardAsnPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { orgId } = useAuthStore()
  const subscribeRef = useReferentielStore(s => s.subscribe)
  const referentiel = useReferentielStore(s => s.referentiel())

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading] = useState(true)

  // Subscribe to referentiel — version issue des stats consolidées, jamais un défaut.
  useEffect(() => {
    const version = stats?.referentielVersion
    if (!version) return
    const unsub = subscribeRef(version)
    return unsub
  }, [subscribeRef, stats?.referentielVersion])

  // Subscribe to dashboard stats
  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const unsub = subscribeDashboardStats(
      orgId,
      (data) => {
        setStats(data)
        setLoading(false)
      },
      (err) => {
        console.error('[DashboardAsn] stats error:', err)
        setLoading(false)
      },
    )
    return unsub
  }, [orgId])

  // Subscribe to evaluations for this org
  useEffect(() => {
    if (!orgId) return
    const unsub = subscribeEvaluationsByOrg(
      orgId,
      setEvaluations,
      (err) => console.error('[DashboardAsn] evaluations error:', err),
    )
    return unsub
  }, [orgId])

  const lang = i18n.language === 'en' ? 'en' : 'fr'

  // Computed values
  const globalScore = stats?.scoreGlobal ?? 0
  const scoreParDimension = stats?.scoreParDimension ?? {}
  const criteresKO = stats?.criteresEssentielsKO ?? []

  // Build dimension cards from referentiel + stats
  const dimensionCards = useMemo(() => {
    if (!referentiel) return []
    return referentiel.dimensions.map(dim => {
      const meta = DIMENSION_META[dim.code] ?? { label: dim.nom[lang], icon: 'category' }
      return {
        code: dim.code,
        label: meta.label,
        icon: meta.icon,
        score: scoreParDimension[dim.code] ?? 0,
      }
    })
  }, [referentiel, scoreParDimension, lang])

  // Count criteria evaluated
  const criteriaTotal = useMemo(() => {
    if (!referentiel) return 0
    return referentiel.dimensions.flatMap(d => d.criteres.filter(c => c.actif)).length
  }, [referentiel])

  // Build alerts from essential KO criteria
  const alerts = useMemo(() => {
    if (!referentiel || criteresKO.length === 0) return []
    return criteresKO.map(code => {
      const dim = referentiel.dimensions.find(d => d.criteres.some(c => c.code === code))
      const critere = dim?.criteres.find(c => c.code === code)
      return {
        criterionCode: code,
        title: `Critere ${code}`,
        description: critere?.libelle[lang] ?? '',
        score: 0 as const,
      }
    })
  }, [referentiel, criteresKO, lang])

  // Action plan stats from evaluations
  const actionStats = useMemo(() => {
    const submitted = evaluations.filter(e => e.statut === 'soumise' || e.statut === 'validee' || e.statut === 'cloturee').length
    const inProgress = evaluations.filter(e => e.statut === 'en_cours').length
    const total = evaluations.length
    return { submitted, inProgress, total }
  }, [evaluations])

  // Whether the org has any scored dimensions (score aggregation has run at least once)
  const hasScoredData = useMemo(() => {
    if (!stats?.scoreParDimension) return false
    return Object.values(stats.scoreParDimension).some(s => s > 0)
  }, [stats])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="material-symbols-outlined animate-spin text-[32px] text-wosm-purple">progress_activity</span>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-headline text-wosm-purple tracking-tight">
            {t('pages.dashboardAsn.title')}
          </h1>
          <p className="text-on-surface-variant mt-1 text-sm">
            {t('pages.dashboardAsn.subtitle')}
          </p>
        </div>
        <button className="px-4 py-2 bg-white text-wosm-purple border border-wosm-purple-muted rounded-lg font-medium text-sm flex items-center gap-2 hover:bg-wosm-purple-container transition-colors">
          <span className="material-symbols-outlined text-[18px]">download</span>
          {t('common.export')}
        </button>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* -- Global Score -- col-span-4 */}
        <div className="col-span-12 lg:col-span-4 bg-white p-6 rounded-xl border border-outline-variant/10 elevation-card flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-on-surface-variant uppercase">
                {t('pages.dashboardAsn.scoreGlobal')}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-wosm-yellow-container text-wosm-on-yellow-container text-[10px] font-bold">
                WOSM V3.0
              </span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-6xl font-extrabold font-headline text-wosm-purple tracking-tighter">
                {globalScore}%
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-2">
              {t('pages.dashboardAsn.scoreDescription')}
            </p>
          </div>
          <div className="mt-8">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-semibold text-on-surface-variant">
                {t('evaluation.progression')}
              </span>
              <span
                className="text-xs font-bold text-wosm-purple"
                title={t('pages.dashboardAsn.progressionIndisponible')}
              >
                {hasScoredData ? `— / ${criteriaTotal}` : `0 / ${criteriaTotal}`}
              </span>
            </div>
            <div className="w-full h-3 bg-wosm-purple-container rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: hasScoredData ? '100%' : '0%',
                  background: 'linear-gradient(90deg, #4B2E83 0%, #6B4FA3 100%)',
                  opacity: hasScoredData ? 0.4 : 1,
                }}
              />
            </div>
            {hasScoredData && (
              <p className="text-[10px] text-on-surface-variant mt-1 italic">
                {t('pages.dashboardAsn.progressionIndisponible')}
              </p>
            )}
          </div>
        </div>

        {/* -- Dimensions grid -- col-span-8 */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {dimensionCards.map((dim) => (
            <div
              key={dim.code}
              className="bg-white p-4 rounded-xl border border-outline-variant/10 card-hover cursor-pointer group"
            >
              <span className={`material-symbols-outlined ${scoreIconBg(dim.score)} p-2 rounded-lg mb-3 block w-fit text-[20px] transition-colors`}>
                {dim.icon}
              </span>
              <div className="flex items-start justify-between gap-1">
                <h3 className="text-sm font-bold font-headline leading-tight">{dim.label}</h3>
                <span className="text-[9px] font-bold text-outline mt-0.5">{dim.code}</span>
              </div>
              <div className={`mt-2 text-2xl font-bold ${scoreColor(dim.score)}`}>
                {dim.score}%
              </div>
            </div>
          ))}
        </div>

        {/* -- Critical Alerts -- col-span-7 */}
        <div className="col-span-12 lg:col-span-7 bg-white p-6 rounded-xl border border-outline-variant/10 elevation-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold font-headline flex items-center gap-2">
              <span className="material-symbols-outlined text-error">warning</span>
              {t('pages.dashboardAsn.criticalAlerts')}
            </h2>
            <span className="px-2.5 py-1 bg-error-container text-on-error-container text-xs font-bold rounded-full">
              {alerts.length}
            </span>
          </div>
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-[40px] text-secondary-container mb-2 block">check_circle</span>
              <p className="text-sm text-on-surface-variant">{t('dashboard.aucuneDonnee')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.criterionCode}
                  className="p-4 bg-surface-container-low rounded-lg flex items-start gap-4 card-hover"
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-error-container">
                    <span className="font-bold text-sm text-on-error-container">{alert.score}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm">{alert.title}</h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">{alert.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* -- Action Plan Status -- col-span-5 */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          <div
            className="p-6 rounded-xl text-white relative overflow-hidden cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #351F63 0%, #4B2E83 60%, #6B4FA3 100%)' }}
            onClick={() => navigate('/action-plan')}
          >
            {/* Yellow accent stripe */}
            <div className="absolute top-0 left-0 w-full h-1" style={{ background: '#FDB714' }} />
            <div className="relative z-10">
              <h2 className="text-lg font-bold font-headline mb-4 flex items-center gap-2">
                {t('pages.dashboardAsn.actionPlan')}
                <span className="material-symbols-outlined text-wosm-yellow text-[18px]">moving</span>
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: t('status.inProgress'), value: String(actionStats.inProgress), icon: 'pending' },
                  { label: t('evaluationList.stats.soumises'), value: String(actionStats.submitted), icon: 'check_circle' },
                  { label: t('evaluationList.stats.total'), value: String(actionStats.total), icon: 'list' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">
                      {stat.label}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="material-symbols-outlined opacity-60 text-[16px]">
                        {stat.icon}
                      </span>
                      <span className="text-2xl font-extrabold font-headline">{stat.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Decorative background icon */}
            <span className="material-symbols-outlined absolute -bottom-4 -right-4 opacity-10 text-[100px] text-white">
              moving
            </span>
          </div>

          {/* Score distribution */}
          <div className="bg-white p-6 rounded-xl border border-outline-variant/10 elevation-card">
            <h3 className="text-sm font-bold font-headline mb-4">
              {t('dashboard.radarDimensions')}
            </h3>
            <div className="space-y-3">
              {[
                { label: t('scores.3'), threshold: 75, color: 'bg-secondary' },
                { label: t('scores.2'), threshold: 50, color: 'bg-wosm-purple' },
                { label: t('scores.1'), threshold: 25, color: 'bg-wosm-yellow' },
                { label: t('scores.0'), threshold: 0, color: 'bg-error' },
              ].map((row) => {
                const count = dimensionCards.filter(d => {
                  if (row.threshold === 75) return d.score >= 75
                  if (row.threshold === 50) return d.score >= 50 && d.score < 75
                  if (row.threshold === 25) return d.score >= 25 && d.score < 50
                  return d.score < 25
                }).length
                const pct = dimensionCards.length > 0 ? Math.round((count / dimensionCards.length) * 100) : 0
                return (
                  <div key={row.threshold}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-on-surface-variant">{row.label}</span>
                      <span className="text-xs font-bold text-on-surface-variant">{count} dim. ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-wosm-purple-container rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.color} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
