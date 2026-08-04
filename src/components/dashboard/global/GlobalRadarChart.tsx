import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { colors } from '@/design/tokens'
import type { CountryScore } from '@/stores/dashboardGlobalStore'

// ── Types ────────────────────────────────────────────────────────────────────

interface GlobalRadarChartProps {
  countries: CountryScore[]
  dimensionCodes: string[]
}

// ── Component ────────────────────────────────────────────────────────────────

export function GlobalRadarChart({ countries, dimensionCodes }: GlobalRadarChartProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const data = useMemo(() => {
    return dimensionCodes.map(code => {
      const evaluated = countries.filter(c => c.scoreGlobal > 0)
      const avg = evaluated.length > 0
        ? Math.round(
            evaluated.reduce((sum, c) => sum + (c.scoreParDimension[code] ?? 0), 0) /
              evaluated.length,
          )
        : 0

      const dimLabel = t(`dimensions.${code}`)
      // Shorten label for radar display
      const shortLabel = dimLabel.length > 18 ? dimLabel.substring(0, 16) + '...' : dimLabel

      return { dimension: shortLabel, fullLabel: dimLabel, score: avg }
    })
  }, [countries, dimensionCodes, t])

  return (
    <div
      className="card p-8"
      style={{ background: colors.surfaceContainerLowest }}
    >
      <h4
        className="font-headline font-bold text-lg mb-6"
        style={{ color: colors.primary }}
      >
        {t('dashboardGlobal.radarTitle')}
      </h4>

      <ResponsiveContainer width="100%" height={320}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid
            stroke={colors.surfaceContainerHighest}
            strokeDasharray="3 3"
          />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{
              fill: colors.onSurfaceVariant,
              fontSize: 10,
              fontWeight: 600,
            }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: colors.outline, fontSize: 8 }}
            tickCount={5}
          />
          <Radar
            name={t('dashboardGlobal.globalAverage')}
            dataKey="score"
            stroke={colors.primary}
            fill={colors.primaryFixedDim}
            fillOpacity={0.35}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              background: colors.surfaceContainerLowest,
              border: `1px solid ${colors.outlineVariant}`,
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value}%`, t('dashboardGlobal.score')]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
