import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { colors } from '@/design/tokens'
import { useAuthStore } from '@/stores/authStore'
import { useEvaluationStore } from '@/stores/evaluationStore'
import { getScores, getPreuves } from '@/services/evaluationService'
import { getCampagne } from '@/services/campagneService'
import { getReferentiel, getCriteresEssentiels, calculerScoreDimension, calculerScoreGlobal } from '@/services/referentielService'
import { writeAuditEntry } from '@/services/auditService'
import { WorkflowStatusStepper } from '@/components/evaluation/WorkflowStatusStepper'
import { ValidationSummary } from '@/components/evaluation/ValidationSummary'
import { EssentialAlertPanel } from '@/components/evaluation/EssentialAlertPanel'
import { ValidationSignature } from '@/components/evaluation/ValidationSignature'
import { ReviewerNotes } from '@/components/evaluation/ReviewerNotes'
import { EvidenceLog, type EvidenceItem } from '@/components/evaluation/EvidenceLog'
import type { Referentiel, Score, CritereDef, EvaluationStatut, Preuve } from '@/types'
import { VALIDATION_ROLES } from '@/types/roles'

// ── Component ────────────────────────────────────────────────────────────────

export function ValidationPage() {
  const { evalId } = useParams<{ evalId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const { profile, role, user } = useAuthStore()
  const { evaluation, load, updateStatut, loading: evalLoading } = useEvaluationStore()

  const [referentiel, setReferentiel] = useState<Referentiel | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [evidences, setEvidences] = useState<Preuve[]>([])
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load evaluation, referentiel, and scores
  useEffect(() => {
    if (!evalId) return

    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        await load(evalId!)
        // La version du référentiel vient de la campagne de l'évaluation, jamais d'un défaut.
        const evaln = useEvaluationStore.getState().evaluation
        const version = evaln ? (await getCampagne(evaln.campagneId))?.referentielVersion : undefined
        const [ref, scoresData, preuvesData] = await Promise.all([
          version ? getReferentiel(version) : Promise.resolve(null),
          getScores(evalId!),
          getPreuves(evalId!),
        ])
        setReferentiel(ref)
        setScores(scoresData)
        setEvidences(preuvesData)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [evalId, load])

  // Compute scores per dimension
  const scoresMap = useMemo(() => {
    const map: Record<string, number | null> = {}
    for (const s of scores) {
      map[s.critereCode] = s.note
    }
    return map
  }, [scores])

  const scoresParDimension = useMemo(() => {
    if (!referentiel) return {}
    // null = dimension non comptable (vide ou entièrement N/A) ; les leaves affichent 0/« — ».
    const result: Record<string, number | null> = {}
    for (const dim of referentiel.dimensions) {
      result[dim.code] = calculerScoreDimension(scoresMap, dim)
    }
    return result
  }, [referentiel, scoresMap])

  const scoreGlobal = useMemo(() => {
    if (!referentiel) return 0
    return calculerScoreGlobal(scoresMap, referentiel)
  }, [referentiel, scoresMap])

  // Essential criteria with score 0
  const essentielsKO = useMemo(() => {
    if (!referentiel) return []
    const essentiels = getCriteresEssentiels(referentiel)
    return essentiels
      .filter((c: CritereDef) => {
        const note = scoresMap[c.code]
        return note === 0 || note === null || note === undefined
      })
      .map((c: CritereDef) => {
        const score = scores.find(s => s.critereCode === c.code)
        return {
          critere: c,
          commentaire: score?.commentaire,
        }
      })
  }, [referentiel, scoresMap, scores])

  // Map Preuve[] to EvidenceItem[] (show first 3 for grid)
  const evidenceItems: EvidenceItem[] = useMemo(() => {
    return evidences.map((p): EvidenceItem => {
      let type: EvidenceItem['type'] = 'other'
      if (p.typeMime.includes('pdf')) type = 'pdf'
      else if (p.typeMime.startsWith('image/')) type = 'image'
      else if (
        p.typeMime.includes('spreadsheet') ||
        p.typeMime.includes('excel') ||
        p.typeMime.includes('csv')
      ) type = 'spreadsheet'

      return {
        id: p.id,
        filename: p.nom,
        type,
        uploadedAt: p.uploadedAt != null ? new Date(p.uploadedAt) : undefined,
      }
    })
  }, [evidences])

  // Submitted date as JS Date
  const submittedAtDate = useMemo(() => {
    return evaluation?.submittedAt != null ? new Date(evaluation.submittedAt) : undefined
  }, [evaluation?.submittedAt])

  // Authorization check
  const canValidate = role != null && VALIDATION_ROLES.includes(role) && evaluation?.statut === 'soumise'

  // Handlers
  const handleValidate = useCallback(async (conclusion: string) => {
    if (!evaluation || !canValidate || !user) return
    setValidating(true)
    try {
      await updateStatut('validee' as EvaluationStatut)
      await writeAuditEntry({
        userId: user.id,
        userEmail: user.email ?? '',
        action: 'validate',
        resource: 'evaluation',
        resourceId: evaluation.id,
        metadata: {
          scoreGlobal,
          essentielsKO: essentielsKO.length,
          conclusion,
        },
      })
      navigate('/evaluation')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setValidating(false)
    }
  }, [evaluation, canValidate, user, updateStatut, scoreGlobal, essentielsKO, navigate])

  const handleRequestRevision = useCallback(async () => {
    if (!evaluation || !user) return
    setValidating(true)
    try {
      await updateStatut('en_cours' as EvaluationStatut)
      await writeAuditEntry({
        userId: user.id,
        userEmail: user.email ?? '',
        action: 'update',
        resource: 'evaluation',
        resourceId: evaluation.id,
        metadata: { action: 'request_revision' },
      })
      navigate('/evaluation')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setValidating(false)
    }
  }, [evaluation, user, updateStatut, navigate])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading || !referentiel || !evaluation) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm" style={{ color: colors.onSurfaceVariant }}>
          {t('common.loading')}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm" style={{ color: colors.error }}>{error}</div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex justify-between items-end">
        <div>
          <p
            className="text-xs font-bold uppercase tracking-[0.2em] mb-2"
            style={{ color: colors.onSurfaceVariant }}
          >
            {t('validation.assessmentCycle')}
          </p>
          <h1
            className="text-4xl font-extrabold tracking-tight font-headline"
            style={{ color: colors.primary }}
          >
            {t('validation.title')}
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <span
              className="flex items-center gap-1.5 px-3 py-1 font-bold text-xs rounded-full"
              style={{
                background: colors.surfaceContainerHighest,
                color: colors.primary,
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: colors.primary }}
              />
              {t(`evaluation.statuts.${evaluation.statut}`)}
            </span>
          </div>
          <span className="text-sm mt-2 block" style={{ color: colors.onSurfaceVariant }}>
            {t('validation.submittedBy')}{' '}
            <span className="font-bold" style={{ color: colors.onSurface }}>
              {evaluation.submittedBy ?? '\u2014'}
            </span>
            {evaluation.submittedAt != null && (
              <>{' \u2022 '}{new Date(evaluation.submittedAt).toLocaleDateString()}</>
            )}
          </span>
        </div>
        <div className="text-right space-y-3">
          <div
            className="text-6xl font-black font-headline leading-none"
            style={{ color: colors.primary }}
          >
            {scoreGlobal}%
          </div>
          <p
            className="text-xs font-bold uppercase tracking-widest mt-1"
            style={{ color: colors.onSurfaceVariant }}
          >
            {t('evaluation.scoreGlobal')}
          </p>
          <Link
            to={`/report/validation/${evalId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
            style={{
              background: colors.surfaceContainerLow,
              color: colors.primary,
              border: `1px solid ${colors.outlineVariant}`,
            }}
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            {t('report.viewReport')}
          </Link>
        </div>
      </header>

      {/* Workflow stepper */}
      <div className="card p-6">
        <WorkflowStatusStepper currentStatut={evaluation.statut} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Score summary */}
        <div className="col-span-8">
          <ValidationSummary
            referentiel={referentiel}
            scoresParDimension={scoresParDimension}
            scoreGlobal={scoreGlobal}
          />
        </div>

        {/* Essential alerts */}
        <div className="col-span-4">
          <EssentialAlertPanel essentielsKO={essentielsKO} />
        </div>

        {/* Reviewer notes */}
        {evaluation.reviewerName != null && evaluation.reviewerRecommendation != null && (
          <div className="col-span-8">
            <ReviewerNotes
              reviewerName={evaluation.reviewerName}
              reviewerTitle={evaluation.reviewerTitle ?? ''}
              reviewerAvatar={evaluation.reviewerAvatar}
              recommendation={evaluation.reviewerRecommendation}
              verdict={evaluation.reviewerVerdict}
            />
          </div>
        )}

        {/* Evidence log */}
        <div className="col-span-8">
          <EvidenceLog
            evidences={evidenceItems.slice(0, 3)}
            totalCount={evidenceItems.length}
            onViewAll={evidenceItems.length > 3 ? () => { /* future navigation */ } : undefined}
          />
        </div>

        {/* Validation panel */}
        {canValidate && (
          <div className="col-span-12 lg:col-span-4 lg:col-start-9">
            <ValidationSignature
              validatorName={profile?.prenom && profile?.nom ? `${profile.prenom} ${profile.nom}` : user?.email ?? ''}
              validatorEmail={user?.email ?? ''}
              hasEssentialKO={essentielsKO.length > 0}
              onValidate={handleValidate}
              onRequestRevision={handleRequestRevision}
              loading={validating}
              submittedAt={submittedAtDate}
            />
          </div>
        )}

        {/* Read-only message for non-validators */}
        {!canValidate && (
          <div className="col-span-12">
            <div
              className="p-4 rounded-xl text-center text-sm"
              style={{
                background: colors.surfaceContainerLow,
                color: colors.onSurfaceVariant,
              }}
            >
              {evaluation.statut !== 'soumise'
                ? t('validation.notSubmittedYet')
                : t('validation.noPermission')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
