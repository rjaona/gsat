import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useReferentielStore } from '@/stores/referentielStore'
import { useEvaluationDetail, useEvaluationActions } from '@/hooks/useEvaluation'
import { EvaluationForm } from '@/components/evaluation/EvaluationForm'
import { EvaluationWorkflowBadge } from '@/components/evaluation/EvaluationWorkflowBadge'
import { listOrganisations } from '@/services/organisationService'
import { useCampagneStore } from '@/stores/campagneStore'
import type { Organisation } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function EvaluationDetailPage() {
  const { evalId } = useParams<{ evalId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { role } = useAuthStore()

  // Référentiel : la valeur courante du store (null tant que non chargé).
  const subscribeRef = useReferentielStore(s => s.subscribe)
  const referentiel = useReferentielStore(s => s.referentiel())

  // Subscribe to evaluation
  const { evaluation, loading: evalLoading, error } = useEvaluationDetail(evalId)
  // Consider loading until the subscription has had time to respond
  const loading = evalLoading || (!evaluation && !error)
  const { canValidate } = useEvaluationActions()

  // Subscribe to campagnes for name resolution
  const { campagnes, subscribe: subscribeCampagnes } = useCampagneStore()
  useEffect(() => {
    const unsub = subscribeCampagnes()
    return unsub
  }, [subscribeCampagnes])

  // La version du référentiel vient TOUJOURS de la campagne de l'évaluation,
  // jamais d'un défaut codé en dur.
  const refVersion = evaluation
    ? campagnes.find(c => c.id === evaluation.campagneId)?.referentielVersion
    : undefined
  useEffect(() => {
    if (!refVersion) return
    const unsub = subscribeRef(refVersion)
    return unsub
  }, [subscribeRef, refVersion])

  // Load organisations for name resolution
  const [orgs, setOrgs] = useState<Organisation[]>([])
  useEffect(() => {
    listOrganisations().then(setOrgs).catch(() => { /* ignore */ })
  }, [])

  const orgName = useMemo(() => {
    if (!evaluation) return ''
    return orgs.find(o => o.id === evaluation.orgId)?.nom ?? evaluation.orgId
  }, [evaluation, orgs])

  const campagneName = useMemo(() => {
    if (!evaluation) return ''
    return campagnes.find(c => c.id === evaluation.campagneId)?.nom ?? evaluation.campagneId
  }, [evaluation, campagnes])

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading && !evaluation) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-[32px] text-[#15236e]">progress_activity</span>
          <p className="mt-3 text-sm text-[#454651]">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error && !evaluation) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <span className="material-symbols-outlined text-[48px] text-[#ba1a1a] mb-3 block">error</span>
          <p className="text-[#93000a] text-sm">{error}</p>
          <button
            onClick={() => navigate('/evaluation')}
            className="mt-4 text-sm font-bold text-[#15236e] hover:underline"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="material-symbols-outlined text-[48px] text-[#dee3eb] mb-3 block">assignment</span>
          <p className="text-[#454651]">{t('evaluationList.introuvable')}</p>
          <button
            onClick={() => navigate('/evaluation')}
            className="mt-4 text-sm font-bold text-[#15236e] hover:underline"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/evaluation')}
          className="inline-flex items-center gap-1 text-sm text-[#454651] hover:text-[#15236e] transition-colors mb-4"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {t('evaluationList.retourListe')}
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#15236e] font-headline">
              {orgName}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <EvaluationWorkflowBadge statut={evaluation.statut} />
              <span className="text-sm text-[#454651]">{campagneName}</span>
              <span className="text-xs text-[#767682]">
                {t('evaluationList.detail.majLe', { date: formatDate(evaluation.updatedAt) })}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {canValidate && evaluation.statut === 'soumise' && (
              <button
                onClick={() => navigate(`/evaluation/validate/${evaluation.id}`)}
                className="bg-[#3b6934] text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                {t('common.validate')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Referentiel loading guard */}
      {!referentiel ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-[24px] text-[#15236e]">progress_activity</span>
            <p className="mt-3 text-sm text-[#454651]">{t('common.loading')}</p>
          </div>
        </div>
      ) : (
        <EvaluationForm evalId={evaluation.id} />
      )}
    </div>
  )
}
