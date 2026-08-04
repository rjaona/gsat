import { useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { colors, elevation, borderRadius, gradients } from '@/design/tokens'

// ── Constants ────────────────────────────────────────────────────────────────

const SLA_DAYS = 30

// ── Types ────────────────────────────────────────────────────────────────────

interface ValidationSignatureProps {
  validatorName: string
  validatorEmail: string
  hasEssentialKO: boolean
  onValidate: (conclusion: string, confirmedKO: boolean) => Promise<void>
  onRequestRevision: () => void
  loading: boolean
  submittedAt?: Date | undefined
  /** Auto-validation Faritany : dépôt du PV de comité obligatoire. */
  requierePv?: boolean | undefined
  onUploadPv?: ((file: File) => Promise<void>) | undefined
  pvUploaded?: boolean | undefined
  pvUploading?: boolean | undefined
  /** Masque le bouton « renvoyer en révision » (auto-validation : l'ASN valide). */
  hideRevision?: boolean | undefined
}

// ── Component ────────────────────────────────────────────────────────────────

export function ValidationSignature({
  validatorName,
  validatorEmail,
  hasEssentialKO,
  onValidate,
  onRequestRevision,
  loading,
  submittedAt,
  requierePv = false,
  onUploadPv,
  pvUploaded = false,
  pvUploading = false,
  hideRevision = false,
}: ValidationSignatureProps) {
  const { t } = useTranslation()
  const [conclusion, setConclusion] = useState('')
  const [certified, setCertified] = useState(false)
  const [confirmedKO, setConfirmedKO] = useState(false)
  const pvInputRef = useRef<HTMLInputElement>(null)

  const slaDate = useMemo(() => {
    if (submittedAt == null) return null
    const deadline = new Date(submittedAt)
    deadline.setDate(deadline.getDate() + SLA_DAYS)
    return deadline.toLocaleDateString()
  }, [submittedAt])

  const canValidate =
    certified &&
    conclusion.trim().length > 0 &&
    (!hasEssentialKO || confirmedKO) &&
    (!requierePv || pvUploaded)

  async function handleValidate() {
    if (!canValidate || loading) return
    await onValidate(conclusion, confirmedKO)
  }

  async function handlePvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && onUploadPv) {
      await onUploadPv(file)
      e.target.value = ''
    }
  }

  return (
    <div
      className="p-8 rounded-xl sticky top-24 border"
      style={{
        background: colors.surfaceContainerHighest,
        borderColor: `${colors.outlineVariant}30`,
      }}
    >
      <h2
        className="text-xl font-bold tracking-tight font-headline mb-6"
        style={{ color: colors.primary }}
      >
        {t('validation.panelTitle')}
      </h2>

      <div className="space-y-6">
        {/* Validator info */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: colors.surfaceContainerHigh, color: colors.primary }}
          >
            <span className="material-symbols-outlined">person</span>
          </div>
          <div>
            <p className="text-sm font-bold font-headline" style={{ color: colors.onSurface }}>
              {validatorName}
            </p>
            <p className="text-xs" style={{ color: colors.onSurfaceVariant }}>
              {validatorEmail}
            </p>
          </div>
        </div>

        {/* PV de comité — obligatoire en auto-validation Faritany */}
        {requierePv && (
          <div>
            <span className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: colors.onSurfaceVariant }}>
              {t('validation.pvComite')}
            </span>
            <input
              ref={pvInputRef}
              type="file"
              accept="application/pdf,image/*,.doc,.docx"
              className="hidden"
              onChange={handlePvChange}
              disabled={loading || pvUploading}
            />
            <button
              type="button"
              onClick={() => pvInputRef.current?.click()}
              disabled={loading || pvUploading}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50"
              style={{ background: colors.surfaceContainerHigh, color: colors.primary, borderColor: `${colors.outlineVariant}` }}
            >
              <span className="material-symbols-outlined text-[18px]">{pvUploaded ? 'check_circle' : 'upload_file'}</span>
              {pvUploading ? t('common.loading') : pvUploaded ? t('validation.pvUploaded') : t('validation.pvUpload')}
            </button>
            {!pvUploaded && (
              <p className="text-[11px] mt-1.5" style={{ color: colors.error }}>{t('validation.pvObligatoire')}</p>
            )}
          </div>
        )}

        {/* Conclusion textarea */}
        <label className="block">
          <span
            className="text-xs font-bold uppercase tracking-widest block mb-2"
            style={{ color: colors.onSurfaceVariant }}
          >
            {t('validation.finalConclusion')}
          </span>
          <textarea
            className="w-full input-recessed p-4 text-sm h-32 resize-none"
            placeholder={t('validation.conclusionPlaceholder')}
            value={conclusion}
            onChange={e => setConclusion(e.target.value)}
            disabled={loading}
          />
        </label>

        {/* Essential KO explicit confirmation */}
        {hasEssentialKO && (
          <div
            className="flex items-start gap-3 p-3 rounded-lg border"
            style={{
              background: `${colors.errorContainer}60`,
              borderColor: `${colors.error}20`,
            }}
          >
            <div className="mt-0.5">
              <input
                type="checkbox"
                id="confirmKO"
                checked={confirmedKO}
                onChange={e => setConfirmedKO(e.target.checked)}
                className="w-5 h-5 rounded"
                style={{ accentColor: colors.error }}
                disabled={loading}
              />
            </div>
            <label
              htmlFor="confirmKO"
              className="text-xs font-medium leading-relaxed"
              style={{ color: colors.onErrorContainer }}
            >
              {t('validation.confirmEssentialKO')}
            </label>
          </div>
        )}

        {/* Certification checkbox */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <input
              type="checkbox"
              id="certify"
              checked={certified}
              onChange={e => setCertified(e.target.checked)}
              className="w-5 h-5 rounded"
              style={{ accentColor: colors.primary }}
              disabled={loading}
            />
          </div>
          <label
            htmlFor="certify"
            className="text-xs font-medium leading-relaxed"
            style={{ color: colors.onSurfaceVariant }}
          >
            {t('validation.certifyStatement')}
          </label>
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pt-4">
          <button
            onClick={handleValidate}
            disabled={!canValidate || loading}
            className="w-full py-4 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: canValidate ? gradients.primary : colors.surfaceContainerHigh,
              color: canValidate ? colors.onPrimary : colors.outline,
              boxShadow: canValidate ? `0 8px 24px -4px ${colors.primary}33` : 'none',
            }}
          >
            {loading ? t('common.loading') : t('validation.approveEvaluation')}
          </button>

          {!hideRevision && (
            <button
              onClick={onRequestRevision}
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm border transition-colors hover:opacity-90 disabled:opacity-50"
              style={{
                background: colors.surfaceContainerLowest,
                color: colors.error,
                borderColor: `${colors.error}30`,
              }}
            >
              {t('validation.requestRevision')}
            </button>
          )}
        </div>

        {/* Timestamp */}
        <div
          className="mt-8 pt-6 border-t flex items-center gap-3"
          style={{ borderColor: `${colors.outlineVariant}30`, color: colors.onSurfaceVariant }}
        >
          <span className="material-symbols-outlined text-sm">schedule</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">
            {t('validation.dateLabel')}: {new Date().toLocaleDateString()}
          </span>
        </div>

        {/* SLA Deadline */}
        {slaDate != null && (
          <div className="mt-8 pt-8 border-t" style={{ borderColor: `${colors.outlineVariant}30` }}>
            <div className="flex items-center gap-3" style={{ color: colors.onSurfaceVariant }}>
              <span className="material-symbols-outlined text-sm">schedule</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {t('validation.slaDeadline')}: {slaDate}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
