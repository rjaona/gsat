import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useCampagneStore } from '@/stores/campagneStore'
import { useEvaluationActions } from '@/hooks/useEvaluation'
import { listOrganisations } from '@/services/organisationService'
import { getEvaluationForOrgCampagne } from '@/services/evaluationService'
import type { Organisation, Campagne, EvaluationType } from '@/types'

// ── Steps ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3

// ── Page ─────────────────────────────────────────────────────────────────────

export function NewEvaluationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { role, orgId } = useAuthStore()
  const { campagnes, subscribe: subscribeCampagnes } = useCampagneStore()
  const { creerEvaluation, loading: creating } = useEvaluationActions()

  const [step, setStep] = useState<WizardStep>(1)
  const [orgs, setOrgs] = useState<Organisation[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)

  // Form state
  const [selectedCampagneId, setSelectedCampagneId] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedType, setSelectedType] = useState<EvaluationType>('auto')
  const [error, setError] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)

  // Subscribe to campagnes
  useEffect(() => {
    const unsub = subscribeCampagnes('ouverte')
    return unsub
  }, [subscribeCampagnes])

  // Load organisations if admin/osn role
  useEffect(() => {
    const isOrgSelector = role === 'admin_global' || role === 'responsable_region' || role === 'responsable_osn' || role === 'evaluateur'
    if (isOrgSelector) {
      setLoadingOrgs(true)
      listOrganisations('ASN')
        .then(setOrgs)
        .catch(() => { /* ignore */ })
        .finally(() => setLoadingOrgs(false))
    }
  }, [role])

  // Auto-fill orgId for ASN users
  useEffect(() => {
    if (role === 'utilisateur_asn' && orgId) {
      setSelectedOrgId(orgId)
    }
  }, [role, orgId])

  const campagnesOuvertes = useMemo(
    () => campagnes.filter(c => c.statut === 'ouverte'),
    [campagnes],
  )

  const isOrgAutoFilled = role === 'utilisateur_asn'
  const selectedCampagne = campagnesOuvertes.find(c => c.id === selectedCampagneId)
  const selectedOrg = orgs.find(o => o.id === selectedOrgId)

  // Check for duplicate before moving to step 3
  const checkDuplicate = async () => {
    if (!selectedCampagneId || !selectedOrgId) return false
    setDuplicateError(null)
    try {
      const existing = await getEvaluationForOrgCampagne(selectedOrgId, selectedCampagneId)
      if (existing) {
        setDuplicateError(t('evaluationList.creation.dejaExistante'))
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const canNext = (s: WizardStep): boolean => {
    switch (s) {
      case 1: return selectedCampagneId !== ''
      case 2: return selectedOrgId !== ''
      case 3: return true
      default: return false
    }
  }

  const handleNext = async () => {
    if (step === 2) {
      const isDuplicate = await checkDuplicate()
      if (isDuplicate) return
    }
    if (step < 3) {
      setStep((step + 1) as WizardStep)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as WizardStep)
      setDuplicateError(null)
    } else {
      navigate('/evaluation')
    }
  }

  const handleCreate = async () => {
    setError(null)
    try {
      const evalId = await creerEvaluation({
        campagneId: selectedCampagneId,
        orgId: selectedOrgId,
        type: selectedType,
      })
      navigate(`/evaluation/${evalId}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // ── Step indicator ──────────────────────────────────────────────────────────

  const stepLabels = [
    t('evaluationList.creation.etape1'),
    t('evaluationList.creation.etape2'),
    t('evaluationList.creation.etape3'),
  ] as const

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm text-[#454651] hover:text-[#15236e] transition-colors mb-4"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {t('common.back')}
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#15236e] font-headline">
          {t('evaluationList.creation.titre')}
        </h1>
        <p className="text-[#454651] mt-1">{t('evaluationList.creation.sousTitre')}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {stepLabels.map((label, i) => {
          const stepNum = (i + 1) as WizardStep
          const isActive = step === stepNum
          const isDone = step > stepNum
          return (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                  isDone
                    ? 'bg-[#3b6934] text-white'
                    : isActive
                    ? 'bg-[#15236e] text-white'
                    : 'bg-[#e4e8f1] text-[#767682]'
                }`}
              >
                {isDone ? (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={`text-xs font-bold truncate ${
                  isActive ? 'text-[#15236e]' : 'text-[#767682]'
                }`}
              >
                {label}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-[#dee3eb]" />}
            </div>
          )
        })}
      </div>

      {/* Form panel */}
      <div
        className="rounded-2xl p-8"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 24px -4px rgba(23, 28, 34, 0.06)',
        }}
      >
        {/* Step 1: Campaign */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-[#15236e] font-headline mb-1">
              {t('evaluationList.creation.etape1')}
            </h2>
            <p className="text-sm text-[#454651] mb-6">
              {t('evaluationList.creation.etape1Description')}
            </p>

            {campagnesOuvertes.length === 0 ? (
              <div className="text-center py-10">
                <span className="material-symbols-outlined text-[48px] text-[#dee3eb] mb-3 block">event_busy</span>
                <p className="text-[#454651] font-medium">{t('evaluationList.creation.aucuneCampagne')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {campagnesOuvertes.map((c: Campagne) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCampagneId(c.id)}
                    className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                      selectedCampagneId === c.id
                        ? 'border-[#15236e] bg-[#dee0ff]/30'
                        : 'border-[#e4e8f1] hover:border-[#bbc3ff] bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-[#171c22]">{c.nom}</p>
                        {c.description && (
                          <p className="text-xs text-[#767682] mt-0.5 line-clamp-1">{c.description}</p>
                        )}
                      </div>
                      {selectedCampagneId === c.id && (
                        <span className="material-symbols-outlined text-[#15236e]">check_circle</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Organisation */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-[#15236e] font-headline mb-1">
              {t('evaluationList.creation.etape2')}
            </h2>
            <p className="text-sm text-[#454651] mb-6">
              {t('evaluationList.creation.etape2Description')}
            </p>

            {isOrgAutoFilled ? (
              <div className="rounded-xl border-2 border-[#15236e] bg-[#dee0ff]/30 p-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#15236e]">business</span>
                  <span className="font-bold text-sm text-[#171c22]">
                    {selectedOrg?.nom ?? t('evaluationList.creation.orgAutoFillee')}
                  </span>
                </div>
              </div>
            ) : loadingOrgs ? (
              <div className="text-center py-10">
                <span className="material-symbols-outlined animate-spin text-[24px] text-[#15236e]">progress_activity</span>
              </div>
            ) : (
              <select
                value={selectedOrgId}
                onChange={e => { setSelectedOrgId(e.target.value); setDuplicateError(null) }}
                className="w-full bg-[#f0f4fd] border-none rounded-lg px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-[#15236e]/20"
              >
                <option value="">{t('evaluationList.creation.selectionnerOrg')}</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.nom}</option>
                ))}
              </select>
            )}

            {duplicateError && (
              <div className="mt-4 p-3 bg-[#ffdad6] text-[#93000a] rounded-lg text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {duplicateError}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Type */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-[#15236e] font-headline mb-1">
              {t('evaluationList.creation.etape3')}
            </h2>
            <p className="text-sm text-[#454651] mb-6">
              {t('evaluationList.creation.etape3Description')}
            </p>

            <div className="space-y-3">
              {(['auto', 'accompagnee'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                    selectedType === type
                      ? 'border-[#15236e] bg-[#dee0ff]/30'
                      : 'border-[#e4e8f1] hover:border-[#bbc3ff] bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-[#171c22]">
                        {type === 'auto'
                          ? t('evaluationList.creation.typeAutoLabel')
                          : t('evaluationList.creation.typeAccompagneeLabel')}
                      </p>
                      <p className="text-xs text-[#767682] mt-0.5">
                        {type === 'auto'
                          ? t('evaluationList.creation.typeAutoDescription')
                          : t('evaluationList.creation.typeAccompagneeDescription')}
                      </p>
                    </div>
                    {selectedType === type && (
                      <span className="material-symbols-outlined text-[#15236e]">check_circle</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 rounded-xl bg-[#f0f4fd] border border-[#e4e8f1]">
              <p className="text-xs uppercase font-bold tracking-widest text-[#767682] mb-3">
                {t('evaluationList.creation.recapitulatif')}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#454651]">{t('evaluation.campagne')}</span>
                  <span className="font-bold text-[#171c22]">{selectedCampagne?.nom ?? '--'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#454651]">{t('evaluationList.creation.organisation')}</span>
                  <span className="font-bold text-[#171c22]">
                    {isOrgAutoFilled
                      ? (selectedOrg?.nom ?? t('evaluationList.creation.orgAutoFillee'))
                      : (selectedOrg?.nom ?? orgs.find(o => o.id === selectedOrgId)?.nom ?? '--')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#454651]">{t('evaluationList.creation.typeLabel')}</span>
                  <span className="font-bold text-[#171c22]">
                    {selectedType === 'auto'
                      ? t('evaluationList.creation.typeAutoLabel')
                      : t('evaluationList.creation.typeAccompagneeLabel')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-[#ffdad6] text-[#93000a] rounded-lg text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#e4e8f1]">
          <button
            onClick={handleBack}
            className="px-4 py-2 text-sm font-medium text-[#454651] hover:bg-[#f0f4fd] rounded-lg transition-colors"
          >
            {step === 1 ? t('common.cancel') : t('common.previous')}
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!canNext(step)}
              className="bg-gradient-to-r from-[#15236e] to-[#2e3b85] text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('common.next')}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-gradient-to-r from-[#15236e] to-[#2e3b85] text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {creating ? t('common.loading') : t('evaluationList.creation.creer')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
