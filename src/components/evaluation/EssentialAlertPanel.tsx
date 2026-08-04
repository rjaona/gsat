import { useTranslation } from 'react-i18next'
import { colors } from '@/design/tokens'
import type { CritereDef } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EssentialKO {
  critere: CritereDef
  commentaire?: string | undefined
}

interface EssentialAlertPanelProps {
  essentielsKO: EssentialKO[]
}

// ── Component ────────────────────────────────────────────────────────────────

export function EssentialAlertPanel({ essentielsKO }: EssentialAlertPanelProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  if (essentielsKO.length === 0) {
    return (
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
          <span className="text-sm font-bold" style={{ color: colors.onSecondaryContainer }}>
            {t('validation.noEssentialKO')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="p-8 rounded-xl border"
      style={{
        background: colors.errorContainer,
        borderColor: `${colors.error}15`,
      }}
    >
      <div className="flex items-center gap-2 mb-6">
        <span
          className="material-symbols-outlined filled"
          style={{ color: colors.error }}
        >
          warning
        </span>
        <h2
          className="text-xl font-bold tracking-tight font-headline"
          style={{ color: colors.onErrorContainer }}
        >
          {t('validation.criticalFindings')}
        </h2>
      </div>

      <div className="space-y-4">
        {essentielsKO.map(({ critere, commentaire }) => (
          <div
            key={critere.code}
            className="p-4 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.4)' }}
          >
            <p
              className="text-xs font-bold uppercase tracking-widest mb-1"
              style={{ color: colors.error }}
            >
              {t('evaluation.essentiel')} {critere.code}
            </p>
            <p className="text-sm font-semibold" style={{ color: colors.onSurface }}>
              {critere.libelle[lang]}
            </p>
            {commentaire && (
              <p
                className="text-xs mt-2 italic"
                style={{ color: colors.onSurfaceVariant }}
              >
                {commentaire}
              </p>
            )}
          </div>
        ))}
      </div>

      <div
        className="mt-6 pt-4 border-t text-xs font-bold"
        style={{
          borderColor: `${colors.error}20`,
          color: colors.onErrorContainer,
        }}
      >
        {t('validation.essentialKOWarning', { count: essentielsKO.length })}
      </div>
    </div>
  )
}
