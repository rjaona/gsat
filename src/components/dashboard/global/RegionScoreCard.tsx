import { useTranslation } from 'react-i18next'
import { colors, scoreTextColor } from '@/design/tokens'
import type { RegionCode } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface RegionScoreCardProps {
  code: RegionCode
  label: { fr: string; en: string }
  avgScore: number
  osnCount: number
  osnEvaluated: number
  growth: number | null
}

// ── Color dots per region ────────────────────────────────────────────────────

const REGION_DOT_COLORS: Record<RegionCode, string> = {
  AFRICA:       '#F59E0B',
  ARAB:         `${colors.error}cc`,
  ASIA_PACIFIC: colors.primary,
  EURASIA:      '#7C3AED',
  EUROPE:       '#6366F1',
  INTERAMERICA: colors.secondary,
}

// ── Component ────────────────────────────────────────────────────────────────

export function RegionScoreCard({
  code,
  label,
  avgScore,
  osnCount,
  osnEvaluated,
  growth,
}: RegionScoreCardProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const dotColor = REGION_DOT_COLORS[code] ?? colors.outline

  return (
    <div
      className="p-4 rounded-lg shadow-sm border text-center"
      style={{
        background: colors.surfaceContainerLowest,
        borderColor: `${colors.outlineVariant}15`,
      }}
    >
      {/* Region name with color dot */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="w-2.5 h-6 rounded-full" style={{ background: dotColor }} />
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: colors.onSurfaceVariant }}
        >
          {label[lang]}
        </span>
      </div>

      {/* Score */}
      <div
        className="text-3xl font-black font-headline mb-1"
        style={{ color: scoreTextColor(avgScore) }}
      >
        {avgScore > 0 ? avgScore.toFixed(1) : '-'}
      </div>

      {/* Growth — hidden when no historical data */}
      {growth != null && (
        <span
          className="text-[10px] font-bold"
          style={{ color: growth > 0 ? colors.secondary : colors.error }}
        >
          {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
        </span>
      )}

      {/* OSN count */}
      <div className="mt-3 pt-2 border-t" style={{ borderColor: colors.surfaceContainerHigh }}>
        <span className="text-xs font-medium" style={{ color: colors.onSurfaceVariant }}>
          {osnEvaluated} / {osnCount}
        </span>
      </div>
    </div>
  )
}
