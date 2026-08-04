import { useTranslation } from 'react-i18next'
import { colors, wosmBrand } from '@/design/tokens'
import type { CritereDef } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface CriticalFinding {
  critere: CritereDef
  commentaire?: string | undefined
}

interface CriticalFindingsProps {
  findings: CriticalFinding[]
}

// ── Component ────────────────────────────────────────────────────────────────

export function CriticalFindings({ findings }: CriticalFindingsProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  return (
    <section className="space-y-4" id="section-03">
      {/* Section label */}
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: wosmBrand.purple }}
        >
          {t('report.sectionLabel', { num: '03' })}
        </span>
        <h2
          className="text-xl font-extrabold tracking-tight font-headline"
          style={{ color: wosmBrand.purple }}
        >
          {t('report.criticalFindings')}
        </h2>
      </div>

      {/* Yellow accent line */}
      <div
        className="h-0.5 w-8 ml-[70px]"
        style={{ background: wosmBrand.yellow }}
      />

      {findings.length === 0 ? (
        <div
          className="p-6 rounded-xl border"
          style={{
            background: colors.secondaryContainer,
            borderColor: `${colors.secondary}20`,
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined filled"
              style={{ color: colors.secondary }}
            >
              check_circle
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: colors.onSecondaryContainer }}
            >
              {t('report.noCriticalFindings')}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map(({ critere, commentaire }) => (
            <div
              key={critere.code}
              className="rounded-xl overflow-hidden"
              style={{
                borderLeft: `4px solid ${colors.error}`,
                background: colors.errorContainer,
              }}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="material-symbols-outlined filled mt-0.5"
                    style={{ color: colors.error, fontSize: '20px' }}
                  >
                    warning
                  </span>
                  <div className="flex-1">
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-1"
                      style={{ color: colors.error }}
                    >
                      {t('evaluation.essentiel')} {critere.code}
                    </p>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: colors.onSurface }}
                    >
                      {critere.libelle[lang]}
                    </p>
                    <p
                      className="text-xs mt-2"
                      style={{ color: colors.onSurfaceVariant }}
                    >
                      <span className="font-bold">{t('report.impact')}:</span>{' '}
                      {t('report.impactDescription')}
                    </p>
                    {commentaire && (
                      <p
                        className="text-xs mt-1 italic"
                        style={{ color: colors.onSurfaceVariant }}
                      >
                        {commentaire}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
