/**
 * WorkflowTimeline — Vertical timeline of workflow events.
 *
 * Displays chronological entries with colored dots and connecting lines.
 */
import { useTranslation } from 'react-i18next';
import type { WorkflowEvent } from '@/types/workflow';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Assign a color to an event based on its action keyword */
function eventDotColor(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('approuv') || lower.includes('valid') || lower.includes('approv')) {
    return 'var(--secondary)';
  }
  if (lower.includes('rejet') || lower.includes('reject') || lower.includes('renvoy')) {
    return 'var(--error)';
  }
  if (lower.includes('soumis') || lower.includes('submit')) {
    return 'var(--primary)';
  }
  return 'var(--outline)';
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface WorkflowTimelineProps {
  events: WorkflowEvent[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function WorkflowTimeline({ events }: WorkflowTimelineProps) {
  const { t } = useTranslation();

  return (
    <section
      className="p-6"
      style={{
        background: 'var(--surface-container-lowest)',
        boxShadow: 'var(--shadow-card)',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <h3
        className="text-sm font-bold uppercase tracking-widest mb-6"
        style={{ color: 'var(--on-surface-variant)' }}
      >
        {t('workflow.historiqueChangements')}
      </h3>

      <div className="relative">
        {events.map((event, i) => {
          const isLast = i === events.length - 1;
          const dotColor = eventDotColor(event.action);

          return (
            <div key={event.id} className="relative flex gap-4 pb-6">
              {/* Vertical line */}
              {!isLast && (
                <div
                  className="absolute left-[7px] top-4 w-0.5"
                  style={{
                    background: 'var(--outline-variant)',
                    height: 'calc(100% - 8px)',
                  }}
                />
              )}

              {/* Dot */}
              <div
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{
                  background: dotColor,
                  borderRadius: '50%',
                  border: '2px solid var(--surface-container-lowest)',
                  boxShadow: `0 0 0 2px ${dotColor}`,
                }}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'var(--on-surface)' }}
                >
                  {event.action}
                </p>
                {event.detail && (
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--on-surface-variant)' }}
                  >
                    {event.detail}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {event.actor && (
                    <span
                      className="text-xs font-medium"
                      style={{ color: 'var(--primary)' }}
                    >
                      {event.actor}
                    </span>
                  )}
                  <span
                    className="text-[10px]"
                    style={{ color: 'var(--outline)' }}
                  >
                    {formatEventDate(event.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
