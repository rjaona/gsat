/**
 * RoleCard — Individual role assignment card.
 *
 * Three variants:
 * - validated: fond surface-container-low, green badge
 * - in_progress: fond blanc with primary border, animated pulse badge
 * - not_assigned: fond surface-container with dashed border, "Assign" button
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoleAssignment, AssignmentRole } from '@/types/workflow';

// ── Icon helper ──────────────────────────────────────────────────────────────

function MIcon({ name, size = 20, fill = 0 }: { name: string; size?: number | undefined; fill?: 0 | 1 | undefined }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill ?? 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

// ── Role icons ───────────────────────────────────────────────────────────────

const ROLE_ICONS: Record<AssignmentRole, string> = {
  evaluateur:  'assignment_ind',
  reviewer:    'rate_review',
  approbateur: 'gavel',
};

// ── Props ────────────────────────────────────────────────────────────────────

export interface RoleCardProps {
  assignment: RoleAssignment;
  onAssign?: (() => void) | undefined;
}

// ── Component ────────────────────────────────────────────────────────────────

export function RoleCard({ assignment, onAssign }: RoleCardProps) {
  const { t } = useTranslation();
  const { role, userName, userTitle, status, itemCount, itemLabel } = assignment;

  const initials = userName
    ? userName.split(' ').map(p => p.charAt(0)).join('').toUpperCase().slice(0, 2)
    : '?';

  // Style variants
  const isValidated = status === 'validated';
  const isInProgress = status === 'in_progress';
  const isNotAssigned = status === 'not_assigned';

  const cardStyle: CSSProperties = {
    borderRadius: 'var(--radius-xl)',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    transition: 'box-shadow 150ms ease, transform 150ms ease',
    ...(isValidated ? {
      background: 'var(--surface-container-low)',
      boxShadow: 'var(--shadow-card)',
    } : isInProgress ? {
      background: 'var(--surface-container-lowest)',
      border: '2px solid var(--primary)',
      boxShadow: 'var(--shadow-card)',
    } : {
      background: 'var(--surface-container)',
      border: '2px dashed var(--outline-variant)',
    }),
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <MIcon name={ROLE_ICONS[role]} size={20} />
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          {t(`workflow.roles.${role}`)}
        </span>
      </div>

      {/* Avatar + Name */}
      {isNotAssigned ? (
        <div className="flex flex-col items-center justify-center py-4 gap-3">
          <div
            className="w-14 h-14 flex items-center justify-center"
            style={{
              background: 'var(--surface-container-highest)',
              borderRadius: '50%',
              color: 'var(--outline)',
            }}
          >
            <MIcon name="person_add" size={24} />
          </div>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--outline)' }}
          >
            {t('workflow.nonAssigne')}
          </span>
          {onAssign && (
            <button
              type="button"
              onClick={onAssign}
              className="mt-1 px-4 py-2 text-xs font-semibold transition-colors"
              style={{
                background: 'var(--primary)',
                color: 'white',
                borderRadius: 'var(--radius-xl)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('workflow.assigner')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: 'var(--gradient-primary)',
                color: 'white',
                borderRadius: '50%',
              }}
            >
              {initials}
            </div>
            <div className="flex flex-col">
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--on-surface)' }}
              >
                {userName}
              </span>
              {userTitle && (
                <span
                  className="text-xs"
                  style={{ color: 'var(--on-surface-variant)' }}
                >
                  {userTitle}
                </span>
              )}
            </div>
          </div>

          {/* Status badge + Modifier button */}
          <div className="flex items-center justify-between">
            <span
              className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold"
              style={{
                borderRadius: 'var(--radius-full)',
                ...(isValidated ? {
                  background: 'var(--secondary-container)',
                  color: 'var(--on-secondary-container)',
                } : {
                  background: 'var(--primary-fixed)',
                  color: 'var(--primary)',
                  animation: 'status-pulse 2s ease-in-out infinite',
                }),
              }}
            >
              {isValidated && <MIcon name="check_circle" size={12} fill={1} />}
              <span className="ml-1">{t(`workflow.status.${status}`)}</span>
            </span>

            <div className="flex items-center gap-2">
              {itemCount !== undefined && itemLabel && (
                <span
                  className="text-xs"
                  style={{ color: 'var(--on-surface-variant)' }}
                >
                  {itemCount} {itemLabel}
                </span>
              )}
              {onAssign && (
                <button
                  type="button"
                  onClick={onAssign}
                  className="px-3 py-1 text-[11px] font-semibold transition-colors flex items-center gap-1"
                  style={{
                    background: 'var(--surface-container-highest)',
                    color: 'var(--primary)',
                    borderRadius: 'var(--radius-full)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <MIcon name="edit" size={12} />
                  {t('workflow.modifier', 'Modifier')}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Pulse animation for in_progress */}
      {isInProgress && (
        <style>{`
          @keyframes status-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}</style>
      )}
    </div>
  );
}
