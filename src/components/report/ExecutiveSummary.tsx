import { useTranslation } from 'react-i18next'
import { colors, wosmBrand } from '@/design/tokens'

// ── Types ────────────────────────────────────────────────────────────────────

interface ExecutiveSummaryProps {
  orgName: string
  campagneName: string
  date: string
  scoreGlobal: number
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExecutiveSummary({
  orgName,
  campagneName,
  date,
  scoreGlobal,
}: ExecutiveSummaryProps) {
  const { t } = useTranslation()

  return (
    <section className="space-y-4" id="section-01">
      {/* Section label */}
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: wosmBrand.purple }}
        >
          {t('report.sectionLabel', { num: '01' })}
        </span>
        <h2
          className="text-xl font-extrabold tracking-tight font-headline"
          style={{ color: wosmBrand.purple }}
        >
          {t('report.executiveSummary')}
        </h2>
      </div>

      {/* Yellow accent line */}
      <div
        className="h-0.5 w-8 ml-[70px]"
        style={{ background: wosmBrand.yellow }}
      />

      {/* Content: 2/3 text + 1/3 score */}
      <div className="flex gap-6">
        {/* Text box */}
        <div
          className="flex-[2] p-6 rounded-xl"
          style={{ background: colors.surfaceContainer }}
        >
          <p
            className="text-sm leading-relaxed mb-6"
            style={{ color: colors.onSurface }}
          >
            {t('report.summaryText')}
          </p>

          <div className="space-y-2">
            <p className="text-xs" style={{ color: colors.onSurfaceVariant }}>
              <span className="font-bold">{t('report.organisation')}:</span> {orgName}
            </p>
            <p className="text-xs" style={{ color: colors.onSurfaceVariant }}>
              <span className="font-bold">{t('report.campaign')}:</span> {campagneName}
            </p>
            <p className="text-xs" style={{ color: colors.onSurfaceVariant }}>
              <span className="font-bold">{t('report.dateOfIssue')}:</span> {date}
            </p>
          </div>
        </div>

        {/* Score card */}
        <div
          className="flex-1 p-6 rounded-xl flex flex-col items-center justify-center"
          style={{ background: wosmBrand.purple }}
        >
          <div
            className="text-5xl font-black font-headline leading-none"
            style={{ color: wosmBrand.white }}
          >
            {scoreGlobal}%
          </div>
          <p
            className="text-xs font-bold uppercase tracking-widest mt-2"
            style={{ color: wosmBrand.yellowLight }}
          >
            {t('report.globalScore')}
          </p>

          {/* Progress bar */}
          <div className="w-full mt-4">
            <div
              className="h-1.5 w-full rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(scoreGlobal, 100)}%`,
                  background: wosmBrand.yellow,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
