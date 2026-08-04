import { useTranslation } from 'react-i18next'
import { colors, wosmBrand } from '@/design/tokens'
import type { ValidationStatus, ValidatorInfo } from '@/services/pdf/validationReport'

// ── Types ────────────────────────────────────────────────────────────────────

interface ApprovalSectionProps {
  status: ValidationStatus
  validator: ValidatorInfo
  date: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStatusStyle(status: ValidationStatus): { bg: string; text: string } {
  switch (status) {
    case 'approved':
      return { bg: colors.secondary, text: colors.onSecondary }
    case 'approved_with_conditions':
      return { bg: '#F59E0B', text: '#ffffff' }
    case 'rejected':
      return { bg: colors.error, text: colors.onError }
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ApprovalSection({
  status,
  validator,
  date,
}: ApprovalSectionProps) {
  const { t } = useTranslation()
  const statusStyle = getStatusStyle(status)

  return (
    <section className="space-y-4" id="section-04">
      {/* Section label */}
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: wosmBrand.purple }}
        >
          {t('report.sectionLabel', { num: '04' })}
        </span>
        <h2
          className="text-xl font-extrabold tracking-tight font-headline"
          style={{ color: wosmBrand.purple }}
        >
          {t('report.approvalStatus')}
        </h2>
      </div>

      {/* Yellow accent line */}
      <div
        className="h-0.5 w-8 ml-[70px]"
        style={{ background: wosmBrand.yellow }}
      />

      {/* Status badge */}
      <div
        className="py-3 px-6 rounded-xl text-center"
        style={{
          background: statusStyle.bg,
          color: statusStyle.text,
        }}
      >
        <span className="text-lg font-extrabold uppercase tracking-widest font-headline">
          {t(`report.status.${status}`)}
        </span>
      </div>

      {/* Validator details */}
      <div
        className="p-6 rounded-xl"
        style={{ background: colors.surfaceContainer }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Validator info */}
          <div className="space-y-3">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: colors.onSurfaceVariant }}
              >
                {t('report.validatedBy')}
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: colors.onSurface }}
              >
                {validator.name}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: colors.onSurfaceVariant }}
              >
                {t('report.validatorRole')}
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: colors.onSurface }}
              >
                {validator.role}
              </p>
            </div>
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: colors.onSurfaceVariant }}
              >
                {t('report.validationDate')}
              </p>
              <p
                className="text-sm font-bold"
                style={{ color: colors.onSurface }}
              >
                {date}
              </p>
            </div>
          </div>

          {/* Digital Signature area */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="w-full h-20 rounded-xl border-2 border-dashed flex items-center justify-center"
              style={{ borderColor: colors.outline }}
            >
              <div className="text-center">
                <span
                  className="material-symbols-outlined"
                  style={{ color: colors.outline, fontSize: '28px' }}
                >
                  draw
                </span>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mt-1"
                  style={{ color: colors.outline }}
                >
                  {t('report.digitalSignature')}
                </p>
              </div>
            </div>
            <p
              className="text-[10px] mt-2 text-center"
              style={{ color: colors.onSurfaceVariant }}
            >
              {t('report.signatureNote')}
            </p>
          </div>
        </div>

        {/* Conclusion */}
        {validator.conclusion && (
          <div
            className="mt-6 pt-4 border-t"
            style={{ borderColor: colors.outlineVariant }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: wosmBrand.purple }}
            >
              {t('report.conclusion')}
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: colors.onSurface }}
            >
              {validator.conclusion}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
