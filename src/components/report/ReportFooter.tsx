import { useTranslation } from 'react-i18next'
import { colors, wosmBrand } from '@/design/tokens'

// ── Types ────────────────────────────────────────────────────────────────────

interface ReportFooterProps {
  documentId: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReportFooter({ documentId }: ReportFooterProps) {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer
      className="mt-12 pt-4 border-t print:mt-4"
      style={{ borderColor: colors.outlineVariant }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-[10px] font-medium"
          style={{ color: colors.outline }}
        >
          {documentId} | {t('report.confidential')}
        </p>
        <p
          className="text-[10px] font-medium"
          style={{ color: colors.outline }}
        >
          &copy; WOSM {year}
        </p>
      </div>
    </footer>
  )
}
