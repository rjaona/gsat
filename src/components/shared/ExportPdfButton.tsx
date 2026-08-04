import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { colors, gradients } from '@/design/tokens'

// ── Types ────────────────────────────────────────────────────────────────────

interface ExportPdfButtonProps {
  /** Async function that generates and saves/downloads the PDF */
  onExport: () => Promise<void>
  /** Optional label override */
  label?: string
  /** Optional icon override (Material Symbols name) */
  icon?: string
  /** Variant */
  variant?: 'primary' | 'secondary' | 'outline'
  /** Compact mode */
  compact?: boolean
}

// ── Component ────────────────────────────────────────────────────────────────

export function ExportPdfButton({
  onExport,
  label,
  icon = 'picture_as_pdf',
  variant = 'primary',
  compact = false,
}: ExportPdfButtonProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayLabel = label ?? t('pdf.exportPdf')

  const handleClick = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await onExport()
    } catch (err) {
      setError((err as Error).message)
      console.error('[ExportPdfButton] Export failed:', err)
    } finally {
      setLoading(false)
    }
  }, [onExport, loading])

  // Style variants
  const baseClasses = `
    inline-flex items-center gap-2 font-bold uppercase tracking-widest text-sm
    rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
    ${compact ? 'px-3 py-2 text-xs' : 'px-5 py-3'}
  `.trim()

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: gradients.primary,
      color: colors.onPrimary,
      boxShadow: `0 4px 12px -2px ${colors.primary}40`,
    },
    secondary: {
      background: colors.surfaceContainerLow,
      color: colors.primary,
    },
    outline: {
      background: 'transparent',
      color: colors.primary,
      border: `1px solid ${colors.outlineVariant}`,
    },
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        onClick={handleClick}
        disabled={loading}
        className={baseClasses}
        style={variantStyles[variant]}
      >
        {loading ? (
          <span
            className="material-symbols-outlined text-[18px] animate-spin"
          >
            progress_activity
          </span>
        ) : (
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        )}
        {!compact && (loading ? t('pdf.generating') : displayLabel)}
      </button>
      {error && (
        <p className="text-xs mt-1" style={{ color: colors.error }}>
          {t('pdf.exportError')}
        </p>
      )}
    </div>
  )
}
