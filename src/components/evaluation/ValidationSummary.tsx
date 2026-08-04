import { useTranslation } from 'react-i18next'
import { colors, scoreColors, scoreBgColors } from '@/design/tokens'
import type { Referentiel, DimensionDef } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface ValidationSummaryProps {
  referentiel: Referentiel
  scoresParDimension: Record<string, number | null>
  scoreGlobal: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScoreLevel(score: number): 0 | 1 | 2 | 3 {
  if (score >= 75) return 3
  if (score >= 50) return 2
  if (score >= 25) return 1
  return 0
}

function getScoreLabel(score: number, t: (key: string) => string): string {
  if (score >= 75) return t('scores.3')
  if (score >= 50) return t('scores.2')
  if (score >= 25) return t('scores.1')
  return t('scores.0')
}

// ── Component ────────────────────────────────────────────────────────────────

export function ValidationSummary({
  referentiel,
  scoresParDimension,
  scoreGlobal,
}: ValidationSummaryProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const globalLevel = getScoreLevel(scoreGlobal)

  return (
    <div className="card p-8">
      {/* Header with global score */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold font-headline" style={{ color: colors.primary }}>
            {t('validation.dimensionPerformance')}
          </h2>
          <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: colors.onSurfaceVariant }}>
            {referentiel.dimensions.length} {t('validation.totalDimensions')}
          </p>
        </div>
        <div className="text-right">
          <div
            className="text-5xl font-black font-headline leading-none"
            style={{ color: scoreColors[globalLevel] }}
          >
            {scoreGlobal}%
          </div>
          <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: colors.onSurfaceVariant }}>
            {t('evaluation.scoreGlobal')}
          </p>
        </div>
      </div>

      {/* Dimension scores grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
        {referentiel.dimensions.map((dim: DimensionDef) => {
          const dimScore = scoresParDimension[dim.code] ?? 0
          const level = getScoreLevel(dimScore)

          return (
            <div key={dim.code} className="space-y-2">
              <div className="flex justify-between items-end">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: colors.onSurfaceVariant }}
                >
                  {dim.nom[lang]}
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: scoreColors[level] }}
                >
                  {dimScore}%
                </span>
              </div>
              <div
                className="h-1.5 w-full rounded-full overflow-hidden"
                style={{ background: colors.surfaceContainerHighest }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(dimScore, 100)}%`,
                    background: scoreColors[level],
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
