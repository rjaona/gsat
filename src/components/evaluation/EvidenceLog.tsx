import { useTranslation } from 'react-i18next'
import { colors, elevation } from '@/design/tokens'

// ── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  id: string
  filename: string
  type: 'pdf' | 'image' | 'spreadsheet' | 'other'
  url?: string | undefined
  uploadedAt?: Date | undefined
}

interface EvidenceLogProps {
  evidences: EvidenceItem[]
  totalCount: number
  onViewAll?: (() => void) | undefined
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getIconForType(type: EvidenceItem['type']): string {
  switch (type) {
    case 'pdf':
      return 'description'
    case 'image':
      return 'image'
    case 'spreadsheet':
      return 'table_chart'
    default:
      return 'insert_drive_file'
  }
}

function getColorForType(type: EvidenceItem['type']): string {
  switch (type) {
    case 'pdf':
      return colors.error
    case 'image':
      return colors.secondary
    case 'spreadsheet':
      return '#0d9488'
    default:
      return colors.onSurfaceVariant
  }
}

function getBgForType(type: EvidenceItem['type']): string {
  switch (type) {
    case 'pdf':
      return colors.errorContainer
    case 'image':
      return colors.secondaryContainer
    case 'spreadsheet':
      return '#ccfbf1'
    default:
      return colors.surfaceContainerHigh
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function EvidenceLog({
  evidences,
  totalCount,
  onViewAll,
}: EvidenceLogProps) {
  const { t } = useTranslation()

  return (
    <div
      className="p-6 rounded-xl"
      style={{
        background: colors.surfaceContainerLow,
        boxShadow: elevation.sm,
      }}
    >
      {/* Title with counter */}
      <div className="flex items-center justify-between mb-5">
        <h3
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: colors.onSurfaceVariant }}
        >
          {t('validation.evidenceLog')}
        </h3>
        <span
          className="text-xs font-bold px-2.5 py-0.5 rounded-full"
          style={{
            background: colors.surfaceContainerHighest,
            color: colors.primary,
          }}
        >
          {totalCount}
        </span>
      </div>

      {/* Evidence grid */}
      {evidences.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: colors.onSurfaceVariant }}>
          {t('validation.noEvidence')}
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {evidences.map(evidence => (
            <div
              key={evidence.id}
              className="aspect-video rounded-xl flex flex-col items-center justify-center gap-2 relative overflow-hidden cursor-pointer transition-transform hover:scale-[1.02]"
              style={{ background: getBgForType(evidence.type) }}
            >
              <span
                className="material-symbols-outlined text-2xl"
                style={{ color: getColorForType(evidence.type) }}
              >
                {getIconForType(evidence.type)}
              </span>
              {/* Filename overlay gradient */}
              <div
                className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
                }}
              >
                <p
                  className="text-[10px] font-medium text-white truncate"
                  title={evidence.filename}
                >
                  {evidence.filename}
                </p>
              </div>
            </div>
          ))}

          {/* View All cell */}
          {onViewAll != null && totalCount > evidences.length && (
            <button
              onClick={onViewAll}
              className="aspect-video rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors hover:opacity-80"
              style={{
                border: `2px dashed ${colors.outlineVariant}`,
                background: 'transparent',
                color: colors.primary,
              }}
            >
              <span className="material-symbols-outlined text-xl">add_circle</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {t('validation.viewAllEvidence')} {totalCount}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
