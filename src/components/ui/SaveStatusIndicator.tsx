import { useTranslation } from 'react-i18next'

export type SaveStatus = 'saved' | 'saving' | 'pending' | 'error'

interface SaveStatusIndicatorProps {
  status: SaveStatus
  /** Optionnel : relancer la dernière écriture échouée. */
  onRetry?: (() => void) | undefined
}

const STYLE: Record<SaveStatus, { icon: string; color: string; bg: string; spin?: boolean }> = {
  saved:   { icon: 'cloud_done',  color: 'var(--success)', bg: 'var(--success-light)' },
  saving:  { icon: 'cloud_sync',  color: 'var(--primary)', bg: 'var(--primary-light)', spin: true },
  pending: { icon: 'schedule',    color: 'var(--warning)', bg: 'var(--warning-light)' },
  error:  { icon: 'cloud_off',   color: 'var(--danger)',  bg: 'var(--danger-light)' },
}

/**
 * Indicateur réseau PERMANENT (mesure 5, 100 % en ligne) : Enregistré / Envoi… /
 * Échec — réessayer. Présentationnel : l'état est dérivé par l'appelant.
 */
export function SaveStatusIndicator({ status, onRetry }: SaveStatusIndicatorProps) {
  const { t } = useTranslation()
  const s = STYLE[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}
      role="status"
      aria-live="polite"
    >
      <span className={`material-symbols-outlined text-[15px] ${s.spin ? 'animate-spin' : ''}`}>{s.icon}</span>
      {t(`evaluation.reseau.${status}`)}
      {status === 'error' && onRetry && (
        <button type="button" onClick={onRetry} className="underline ml-1" style={{ color: s.color }}>
          {t('evaluation.reseau.retry')}
        </button>
      )}
    </span>
  )
}
