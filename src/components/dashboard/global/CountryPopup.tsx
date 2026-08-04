import { useTranslation } from 'react-i18next'
import { colors, scoreTextColor } from '@/design/tokens'
import type { CountryScore } from '@/stores/dashboardGlobalStore'

// ── Types ────────────────────────────────────────────────────────────────────

interface CountryPopupProps {
  country: CountryScore
}

// ── Component ────────────────────────────────────────────────────────────────

export function CountryPopup({ country }: CountryPopupProps) {
  const { t } = useTranslation()

  return (
    <div className="min-w-[200px]">
      <div className="mb-2">
        <h4 className="font-bold text-sm" style={{ color: colors.onSurface }}>
          {country.nom}
        </h4>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: colors.onSurfaceVariant }}>
          {t(`cartographie.regions.${country.regionCode.toLowerCase()}`)}
        </p>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span
          className="text-2xl font-black font-headline"
          style={{ color: scoreTextColor(country.scoreGlobal) }}
        >
          {country.scoreGlobal > 0 ? `${country.scoreGlobal}%` : '-'}
        </span>
        <span className="text-xs" style={{ color: colors.onSurfaceVariant }}>
          {t('cartographie.popup.score')}
        </span>
      </div>

      {country.criteresEssentielsKO.length > 0 && (
        <div
          className="text-[10px] px-2 py-1 rounded"
          style={{ background: colors.errorContainer, color: colors.onErrorContainer }}
        >
          {country.criteresEssentielsKO.length} {t('dashboardGlobal.essentialKO')}
        </div>
      )}
    </div>
  )
}
