import { useTranslation } from 'react-i18next'
import { colors, wosmBrand, scoreTextColor, scoreBgColor } from '@/design/tokens'
import type { Referentiel, DimensionDef } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

interface DimensionScoresGridProps {
  referentiel: Referentiel
  scoresParDimension: Record<string, number | null>
}

// ── Component ────────────────────────────────────────────────────────────────

export function DimensionScoresGrid({
  referentiel,
  scoresParDimension,
}: DimensionScoresGridProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  return (
    <section className="space-y-4" id="section-02">
      {/* Section label */}
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: wosmBrand.purple }}
        >
          {t('report.sectionLabel', { num: '02' })}
        </span>
        <h2
          className="text-xl font-extrabold tracking-tight font-headline"
          style={{ color: wosmBrand.purple }}
        >
          {t('report.dimensionScores')}
        </h2>
      </div>

      {/* Yellow accent line */}
      <div
        className="h-0.5 w-8 ml-[70px]"
        style={{ background: wosmBrand.yellow }}
      />

      {/* Grid 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {referentiel.dimensions.map((dim: DimensionDef) => {
          const score = scoresParDimension[dim.code] ?? 0
          const textColor = scoreTextColor(score)
          const bgColor = scoreBgColor(score)

          return (
            <div
              key={dim.code}
              className="flex items-center justify-between p-4 rounded-xl border"
              style={{
                background: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: wosmBrand.purple }}
                >
                  {dim.code}
                </p>
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: colors.onSurface }}
                >
                  {dim.nom[lang]}
                </p>
              </div>

              <div
                className="ml-4 px-3 py-1 rounded-lg text-lg font-black font-headline"
                style={{
                  color: textColor,
                  background: bgColor,
                }}
              >
                {score}%
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
