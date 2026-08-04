import { useTranslation } from 'react-i18next'
import { colors, wosmBrand } from '@/design/tokens'

// ── Types ────────────────────────────────────────────────────────────────────

interface ReportHeaderProps {
  documentId: string
  date: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReportHeader({ documentId, date }: ReportHeaderProps) {
  const { t } = useTranslation()

  return (
    <header className="print:mb-0">
      {/* Purple accent bar */}
      <div
        className="h-1 w-full rounded-t-xl"
        style={{ background: wosmBrand.purple }}
      />

      <div
        className="flex items-center justify-between px-8 py-5 rounded-b-xl"
        style={{
          background: colors.surfaceContainerLowest,
          borderBottom: `1px solid ${colors.outlineVariant}`,
        }}
      >
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-4">
          {/* WOSM Logo placeholder */}
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-xs"
            style={{ background: wosmBrand.purple, color: wosmBrand.white }}
          >
            WOSM
          </div>
          <div>
            <h1
              className="text-lg font-extrabold tracking-tight font-headline"
              style={{ color: wosmBrand.purple }}
            >
              {t('report.title')}
            </h1>
            <p
              className="text-xs font-medium"
              style={{ color: colors.onSurfaceVariant }}
            >
              {documentId}
            </p>
          </div>
        </div>

        {/* Right: Date + Badge + Seal */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p
              className="text-xs"
              style={{ color: colors.onSurfaceVariant }}
            >
              {date}
            </p>
            <span
              className="inline-block mt-1 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{
                background: wosmBrand.yellow,
                color: wosmBrand.purpleDark,
              }}
            >
              {t('report.officialDocument')}
            </span>
          </div>

          {/* Official Seal */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center border-2"
            style={{
              borderColor: wosmBrand.purple,
              color: wosmBrand.purple,
            }}
          >
            <span className="material-symbols-outlined text-[20px]">
              verified
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
