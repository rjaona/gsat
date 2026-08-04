import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useCampagneStore } from '@/stores/campagneStore'
import { EvaluationWorkflowBadge } from '@/components/evaluation/EvaluationWorkflowBadge'
import { listOrganisations } from '@/services/organisationService'
import {
  subscribeAllEvaluations,
  subscribeEvaluationsByOrg,
} from '@/services/evaluationService'
import type { Evaluation, EvaluationStatut, Organisation } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

type FilterStatut = EvaluationStatut | 'tous'

const STATUTS: EvaluationStatut[] = ['brouillon', 'en_cours', 'soumise', 'validee', 'cloturee']

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  icon: string
  accentClass: string
  iconBgClass: string
  iconColorClass: string
}

function StatCard({ label, value, icon, accentClass, iconBgClass, iconColorClass }: StatCardProps) {
  return (
    <div className={`bg-[#ffffff] p-5 rounded-xl border-l-4 ${accentClass} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#454651] mb-1">{label}</p>
          <h3 className="text-3xl font-extrabold font-headline text-[#15236e]">{value}</h3>
        </div>
        <span className={`material-symbols-outlined ${iconColorClass} ${iconBgClass} p-3 rounded-full`}>
          {icon}
        </span>
      </div>
    </div>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#ffffff] rounded-xl p-5 shadow-[0_8px_24px_-4px_rgba(23,28,34,0.06)] animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-4 bg-[#e4e8f1] rounded w-3/5 mb-2" />
          <div className="h-3 bg-[#e4e8f1] rounded w-2/5" />
        </div>
        <div className="h-5 w-16 bg-[#e4e8f1] rounded-full" />
      </div>
      <div className="h-1.5 bg-[#e4e8f1] rounded-full w-full mt-4" />
      <div className="flex justify-between items-center mt-3">
        <div className="h-3 bg-[#e4e8f1] rounded w-16" />
        <div className="h-3 bg-[#e4e8f1] rounded w-20" />
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function EvaluationListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { role, orgId } = useAuthStore()

  const { campagnes, subscribe: subscribeCampagnes } = useCampagneStore()

  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [orgs, setOrgs] = useState<Organisation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filtreStatut, setFiltreStatut] = useState<FilterStatut>('tous')
  const [search, setSearch] = useState('')

  // Subscribe to campagnes for name resolution
  useEffect(() => {
    const unsub = subscribeCampagnes()
    return unsub
  }, [subscribeCampagnes])

  // Load organisations for name resolution
  useEffect(() => {
    listOrganisations().then(setOrgs).catch(() => { /* ignore */ })
  }, [])

  // Subscribe to evaluations based on role
  useEffect(() => {
    setLoading(true)
    setError(null)

    const isOrgScoped = role === 'utilisateur_asn' || role === 'responsable_osn'

    const unsub = isOrgScoped && orgId
      ? subscribeEvaluationsByOrg(
          orgId,
          evals => { setEvaluations(evals); setLoading(false) },
          err => { setError(err.message); setLoading(false) },
        )
      : subscribeAllEvaluations(
          evals => { setEvaluations(evals); setLoading(false) },
          err => { setError(err.message); setLoading(false) },
        )

    return unsub
  }, [role, orgId])

  // Name lookup maps
  const orgMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of orgs) {
      map.set(o.id, o.nom)
    }
    return map
  }, [orgs])

  const campagneMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of campagnes) {
      map.set(c.id, c.nom)
    }
    return map
  }, [campagnes])

  // Filtered list
  const filtered = useMemo(() => {
    return evaluations.filter(ev => {
      if (filtreStatut !== 'tous' && ev.statut !== filtreStatut) return false
      if (search.trim() !== '') {
        const orgName = orgMap.get(ev.orgId) ?? ''
        const campagneName = campagneMap.get(ev.campagneId) ?? ''
        const q = search.toLowerCase()
        if (!orgName.toLowerCase().includes(q) && !campagneName.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [evaluations, filtreStatut, search, orgMap, campagneMap])

  // Stats
  const stats = useMemo(() => {
    return {
      total: evaluations.length,
      enCours: evaluations.filter(e => e.statut === 'en_cours').length,
      soumises: evaluations.filter(e => e.statut === 'soumise').length,
      validees: evaluations.filter(e => e.statut === 'validee').length,
    }
  }, [evaluations])

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-[#15236e] font-headline mb-2">
            {t('evaluationList.titre')}
          </h1>
          <p className="text-[#454651] text-lg">
            {t('evaluationList.sousTitre')}
          </p>
        </div>
        <button
          onClick={() => navigate('/evaluation/new')}
          className="bg-gradient-to-r from-[#15236e] to-[#2e3b85] text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined">add_circle</span>
          <span>{t('evaluation.nouveau')}</span>
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={t('evaluationList.stats.total')}
          value={stats.total}
          icon="assignment"
          accentClass="border-[#15236e]"
          iconBgClass="bg-[#dee0ff]"
          iconColorClass="text-[#2e3b85]"
        />
        <StatCard
          label={t('evaluationList.stats.enCours')}
          value={stats.enCours}
          icon="sync"
          accentClass="border-[#F59E0B]"
          iconBgClass="bg-[#FEF3C7]"
          iconColorClass="text-[#78350f]"
        />
        <StatCard
          label={t('evaluationList.stats.soumises')}
          value={stats.soumises}
          icon="send"
          accentClass="border-[#3b6934]"
          iconBgClass="bg-[#b9eeab]/40"
          iconColorClass="text-[#3b6934]"
        />
        <StatCard
          label={t('evaluationList.stats.validees')}
          value={stats.validees}
          icon="verified"
          accentClass="border-[#3b6934]"
          iconBgClass="bg-[#b9eeab]"
          iconColorClass="text-[#23501e]"
        />
      </div>

      {/* Filter bar */}
      <div className="bg-[#eaeef7] rounded-2xl p-1 shadow-sm mb-1">
        <div className="bg-[#ffffff] rounded-[calc(1rem-0.25rem)] overflow-hidden">
          <div className="p-4 flex flex-wrap gap-4 items-center border-b border-[#e4e8f1]">
            {/* Search */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#767682] text-lg">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('evaluationList.rechercher')}
                className="bg-[#f0f4fd] border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#15236e]/20 placeholder-[#767682] min-w-[240px]"
              />
            </div>

            <div className="h-8 w-px bg-[#dee3eb] mx-1" />

            {/* Status filter tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFiltreStatut('tous')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filtreStatut === 'tous'
                    ? 'bg-[#15236e] text-white shadow-sm'
                    : 'text-[#454651] hover:bg-[#f0f4fd]'
                }`}
              >
                {t('evaluationList.filtres.tous')} ({evaluations.length})
              </button>
              {STATUTS.map(s => {
                const count = evaluations.filter(e => e.statut === s).length
                return (
                  <button
                    key={s}
                    onClick={() => setFiltreStatut(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      filtreStatut === s
                        ? 'bg-[#15236e] text-white shadow-sm'
                        : 'text-[#454651] hover:bg-[#f0f4fd]'
                    }`}
                  >
                    {t(`evaluation.statuts.${s}`)} ({count})
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-[#ffdad6] text-[#93000a] rounded-lg text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Evaluation cards grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loading && filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-[56px] text-[#dee3eb] mb-4">assignment</span>
            <p className="text-[#454651] font-medium text-lg mb-1">{t('evaluationList.aucune')}</p>
            <p className="text-[#767682] text-sm mb-6">{t('evaluationList.aucuneDescription')}</p>
            <button
              onClick={() => navigate('/evaluation/new')}
              className="bg-gradient-to-r from-[#15236e] to-[#2e3b85] text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              {t('evaluation.nouveau')}
            </button>
          </div>
        )}

        {!loading && filtered.map(ev => {
          const orgName = orgMap.get(ev.orgId) ?? t('dashboard.orgInconnue')
          const campagneName = campagneMap.get(ev.campagneId) ?? ev.campagneId
          const scoreGlobal = ev.scoreGlobal ?? 0
          const scoreColor =
            scoreGlobal >= 75 ? '#3b6934' :
            scoreGlobal >= 50 ? '#15236e' :
            scoreGlobal >= 25 ? '#e97c00' :
            '#ba1a1a'

          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => navigate(`/evaluation/${ev.id}`)}
              className="bg-[#ffffff] rounded-xl p-5 shadow-[0_8px_24px_-4px_rgba(23,28,34,0.06)] hover:shadow-[0_8px_24px_-4px_rgba(23,28,34,0.12)] transition-shadow text-left group cursor-pointer"
            >
              {/* Top row: org + badge */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#171c22] text-sm truncate group-hover:text-[#15236e] transition-colors">
                    {orgName}
                  </p>
                  <p className="text-xs text-[#767682] truncate mt-0.5">{campagneName}</p>
                </div>
                <div className="flex-shrink-0 ml-3">
                  <EvaluationWorkflowBadge statut={ev.statut} size="sm" />
                </div>
              </div>

              {/* Score */}
              <div className="flex items-baseline gap-1 mt-3">
                <span
                  className="text-2xl font-extrabold font-headline"
                  style={{ color: scoreColor }}
                >
                  {Math.round(scoreGlobal)}
                </span>
                <span className="text-xs text-[#767682] font-medium">/100</span>
              </div>

              {/* Progress bar placeholder */}
              <div className="mt-3">
                <div className="w-full bg-[#dee3eb] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, scoreGlobal)}%`,
                      background: scoreColor,
                    }}
                  />
                </div>
              </div>

              {/* Footer: type + date */}
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#767682]">
                  {ev.type === 'auto' ? t('evaluationList.typeAuto') : t('evaluationList.typeAccompagnee')}
                </span>
                <span className="text-xs text-[#767682]">
                  {formatDate(ev.updatedAt)}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
