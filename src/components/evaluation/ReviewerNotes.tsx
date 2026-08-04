import { useTranslation } from 'react-i18next'
import { colors, elevation } from '@/design/tokens'

// ── Types ────────────────────────────────────────────────────────────────────

interface ReviewerNotesProps {
  reviewerName: string
  reviewerTitle: string
  reviewerAvatar?: string | undefined
  recommendation: string
  verdict: 'approved' | 'approved_with_conditions' | 'revision_requested' | undefined
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getVerdictConfig(verdict: ReviewerNotesProps['verdict'], t: (key: string) => string): {
  icon: string
  label: string
  color: string
  bg: string
} | null {
  switch (verdict) {
    case 'approved':
      return {
        icon: 'thumb_up',
        label: t('report.status.approved'),
        color: colors.secondary,
        bg: colors.secondaryContainer,
      }
    case 'approved_with_conditions':
      return {
        icon: 'thumb_up',
        label: t('report.status.approved_with_conditions'),
        color: '#b07d00',
        bg: '#FEF3C7',
      }
    case 'revision_requested':
      return {
        icon: 'thumb_down',
        label: t('report.status.rejected'),
        color: colors.error,
        bg: colors.errorContainer,
      }
    default:
      return null
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ReviewerNotes({
  reviewerName,
  reviewerTitle,
  reviewerAvatar,
  recommendation,
  verdict,
}: ReviewerNotesProps) {
  const { t } = useTranslation()
  const verdictConfig = getVerdictConfig(verdict, t)

  return (
    <div
      className="p-6 rounded-xl"
      style={{
        background: colors.surfaceContainerLowest,
        boxShadow: elevation.sm,
      }}
    >
      {/* Section title */}
      <h3
        className="text-sm font-bold uppercase tracking-widest mb-5"
        style={{ color: colors.onSurfaceVariant }}
      >
        {t('validation.reviewerNotes')}
      </h3>

      {/* Reviewer identity */}
      <div className="flex items-center gap-3 mb-5">
        {reviewerAvatar ? (
          <img
            src={reviewerAvatar}
            alt={reviewerName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              background: colors.surfaceContainerHigh,
              color: colors.primary,
            }}
          >
            {getInitials(reviewerName)}
          </div>
        )}
        <div>
          <p
            className="text-sm font-bold font-headline"
            style={{ color: colors.onSurface }}
          >
            {reviewerName}
          </p>
          <p className="text-xs" style={{ color: colors.onSurfaceVariant }}>
            {reviewerTitle}
          </p>
        </div>
      </div>

      {/* Recommendation blockquote */}
      <blockquote
        className="pl-4 py-2 mb-5 italic text-sm leading-relaxed"
        style={{
          borderLeft: `4px solid ${colors.surfaceContainerHighest}`,
          color: colors.onSurfaceVariant,
        }}
      >
        {recommendation}
      </blockquote>

      {/* Verdict */}
      {verdictConfig != null && (
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{
            background: verdictConfig.bg,
            color: verdictConfig.color,
          }}
        >
          <span className="material-symbols-outlined text-sm">{verdictConfig.icon}</span>
          {verdictConfig.label}
        </div>
      )}
    </div>
  )
}
