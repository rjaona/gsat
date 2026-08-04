import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { colors, wosmBrand } from '@/design/tokens'
import { useAuthStore } from '@/stores/authStore'
import { getEvaluation, getScores } from '@/services/evaluationService'
import { getReferentiel, getCriteresEssentiels, calculerScoreDimension, calculerScoreGlobal } from '@/services/referentielService'
import { getOrganisation } from '@/services/organisationService'
import { getCampagne } from '@/services/campagneService'
import {
  generateValidationReportPdf,
  type ValidationStatus,
  type ValidatorInfo,
} from '@/services/pdf/validationReport'

import { ReportHeader } from '@/components/report/ReportHeader'
import { ExecutiveSummary } from '@/components/report/ExecutiveSummary'
import { DimensionScoresGrid } from '@/components/report/DimensionScoresGrid'
import { CriticalFindings, type CriticalFinding } from '@/components/report/CriticalFindings'
import { ApprovalSection } from '@/components/report/ApprovalSection'
import { ReportFooter } from '@/components/report/ReportFooter'

import type { Referentiel, Score, Evaluation, CritereDef } from '@/types'
import { VALIDATION_ROLES } from '@/types/roles'

// ── Component ────────────────────────────────────────────────────────────────

export function ValidationReportPage() {
  const { evalId } = useParams<{ evalId: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = (i18n.language === 'en' ? 'en' : 'fr') as 'fr' | 'en'

  const { profile, user, role, orgId: userOrgId } = useAuthStore()

  const [evaluation, setEvaluation] = useState<Evaluation | null>(null)
  const [referentiel, setReferentiel] = useState<Referentiel | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [orgName, setOrgName] = useState<string>('')
  const [campagneName, setCampagneName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Contrôle d'accès : rôle autorisé OU même org que l'évaluation
  useEffect(() => {
    if (!evaluation) return
    const isPrivileged = role != null && (VALIDATION_ROLES as readonly string[]).includes(role)
    const isSameOrg = userOrgId != null && userOrgId === evaluation.orgId
    if (!isPrivileged && !isSameOrg) {
      navigate('/dashboard', { replace: true })
    }
  }, [evaluation, role, userOrgId, navigate])

  // Load data
  useEffect(() => {
    if (!evalId) return

    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const evalData = await getEvaluation(evalId!)
        if (!evalData) {
          setError(t('evaluationList.introuvable'))
          return
        }
        // Résoudre org + campagne d'abord : la campagne donne la version du référentiel.
        const [org, campagne] = await Promise.allSettled([
          getOrganisation(evalData.orgId),
          getCampagne(evalData.campagneId),
        ])
        const version = campagne.status === 'fulfilled' ? campagne.value?.referentielVersion : undefined
        const [ref, scoresData] = await Promise.all([
          version ? getReferentiel(version) : Promise.resolve(null),
          getScores(evalId!),
        ])
        setEvaluation(evalData)
        setReferentiel(ref)
        setScores(scoresData)

        setOrgName(
          org.status === 'fulfilled' && org.value?.nom
            ? org.value.nom
            : evalData.orgId
        )
        setCampagneName(
          campagne.status === 'fulfilled' && campagne.value?.nom
            ? campagne.value.nom
            : evalData.campagneId
        )
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [evalId, t])

  // Compute scores
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

  // Critical findings
  const criticalFindings = useMemo((): CriticalFinding[] => {
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

  // Validation status derived from evaluation
  const validationStatus = useMemo((): ValidationStatus => {
    if (!evaluation) return 'approved_with_conditions'
    if (evaluation.statut === 'validee' || evaluation.statut === 'cloturee') {
      return criticalFindings.length > 0 ? 'approved_with_conditions' : 'approved'
    }
    return 'approved_with_conditions'
  }, [evaluation, criticalFindings])

  // Validator info
  const validatorInfo = useMemo((): ValidatorInfo => {
    const name = profile?.prenom && profile?.nom
      ? `${profile.prenom} ${profile.nom}`
      : user?.email ?? 'N/A'
    return {
      name,
      role: profile?.role ?? 'evaluateur',
      email: user?.email ?? '',
      date: new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    }
  }, [profile, user, lang])

  // Document meta
  const documentId = evaluation
    ? `GSAT-${evaluation.id.substring(0, 8).toUpperCase()}`
    : 'GSAT-XXXX'

  const dateStr = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleExportPdf = useCallback(async () => {
    if (!evaluation || !referentiel) return
    setPdfLoading(true)
    try {
      const doc = await generateValidationReportPdf({
        evaluation,
        referentiel,
        scores,
        orgName,
        campagneName,
        validator: validatorInfo,
        validationStatus,
        lang,
      })
      doc.save(`${documentId}_validation_report.pdf`)
    } catch (err) {
      console.error('[ValidationReportPage] PDF generation failed:', err)
    } finally {
      setPdfLoading(false)
    }
  }, [evaluation, referentiel, scores, orgName, campagneName, validatorInfo, validationStatus, lang, documentId])

  const handleBack = useCallback(() => {
    if (evalId) {
      navigate(`/evaluation/validate/${evalId}`)
    } else {
      navigate('/evaluation')
    }
  }, [evalId, navigate])

  // ── Loading / Error ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-sm" style={{ color: colors.onSurfaceVariant }}>
          {t('common.loading')}
        </div>
      </div>
    )
  }

  if (error || !evaluation || !referentiel) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="text-sm" style={{ color: colors.error }}>
            {error ?? t('evaluationList.introuvable')}
          </div>
          <button
            onClick={handleBack}
            className="text-sm font-bold px-4 py-2 rounded-lg"
            style={{ color: colors.primary, background: colors.surfaceContainerLow }}
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #validation-report, #validation-report * { visibility: visible; }
          #validation-report { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print\\:break-before { break-before: page; }
        }
      `}</style>

      {/* Floating action buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50 no-print">
        <button
          onClick={handleBack}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95"
          style={{ background: colors.surfaceContainerLow, color: colors.onSurface }}
          title={t('common.back')}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>

        <button
          onClick={handlePrint}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95"
          style={{ background: colors.surfaceContainerLow, color: colors.primary }}
          title={t('report.print')}
        >
          <span className="material-symbols-outlined">print</span>
        </button>

        <button
          onClick={handleExportPdf}
          disabled={pdfLoading}
          className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: wosmBrand.purple, color: wosmBrand.white }}
          title={t('pdf.exportPdf')}
        >
          {pdfLoading ? (
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined">picture_as_pdf</span>
          )}
        </button>
      </div>

      {/* Report content */}
      <div
        id="validation-report"
        className="max-w-4xl mx-auto space-y-10 pb-24"
      >
        <ReportHeader documentId={documentId} date={dateStr} />

        <div className="px-2 space-y-12">
          <ExecutiveSummary
            orgName={orgName}
            campagneName={campagneName}
            date={dateStr}
            scoreGlobal={scoreGlobal}
          />

          <DimensionScoresGrid
            referentiel={referentiel}
            scoresParDimension={scoresParDimension}
          />

          <CriticalFindings findings={criticalFindings} />

          <ApprovalSection
            status={validationStatus}
            validator={validatorInfo}
            date={dateStr}
          />
        </div>

        <ReportFooter documentId={documentId} />
      </div>
    </>
  )
}
