import { useTranslation } from 'react-i18next';
import type { Evaluation } from '@/types';

interface EvaluationRecenteCardProps {
  evaluation: Evaluation;
  orgNom?: string;
  campagneNom?: string;
  onClick?: () => void;
}

/* Couleurs sémantiques score via variables CSS */
function scoreColor(score: number): string {
  if (score >= 75) return 'var(--score-excellent)';
  if (score >= 50) return 'var(--score-moyen)';
  if (score >= 25) return 'var(--score-faible)';
  return 'var(--score-critique)';
}

/* Statut : styles via tokens CSS */
interface StatutStyle {
  bg: string;
  color: string;
  dot?: string;
  pulse?: boolean;
}

const STATUT_STYLES: Record<string, StatutStyle> = {
  brouillon: { bg: 'var(--border-subtle)', color: 'var(--text-secondary)' },
  en_cours: {
    bg: 'var(--info-light)',
    color: 'var(--info)',
    dot: 'var(--info)',
    pulse: true,
  },
  soumise: {
    bg: 'var(--warning-light)',
    color: 'var(--warning)',
    dot: 'var(--warning)',
  },
  validee: {
    bg: 'var(--success-light)',
    color: 'var(--success)',
    dot: 'var(--success)',
  },
  cloturee: { bg: 'var(--border-subtle)', color: 'var(--text-muted)' },
};

export function EvaluationRecenteCard({
  evaluation,
  orgNom,
  campagneNom,
  onClick,
}: EvaluationRecenteCardProps) {
  const { t } = useTranslation();

  const statutStyle = STATUT_STYLES[evaluation.statut] ?? {
    bg: 'var(--border-subtle)',
    color: 'var(--text-secondary)',
  };

  const updatedAt =
    evaluation.updatedAt
      ? new Date(evaluation.updatedAt as string).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'short',
        })
      : null;

  return (
    <div
      className="flex flex-col gap-3 transition-all duration-200"
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        padding: '16px',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick();
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--shadow-lg)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--shadow-card)';
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* Ligne 1 : org + badge statut */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {orgNom ? (
            <p
              className="text-sm font-semibold truncate leading-tight"
              style={{ color: 'var(--text)' }}
            >
              {orgNom}
            </p>
          ) : (
            <p
              className="text-sm font-semibold truncate leading-tight"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('dashboard.orgInconnue', { defaultValue: 'Organisation' })}
            </p>
          )}
          {campagneNom && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {campagneNom}
            </p>
          )}
        </div>

        {/* Badge statut avec dot animé pour en_cours */}
        <span
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1"
          style={{ background: statutStyle.bg, color: statutStyle.color }}
        >
          {statutStyle.dot && (
            <span
              className="inline-block rounded-full flex-shrink-0"
              style={{
                width: '6px',
                height: '6px',
                background: statutStyle.dot,
                animation: statutStyle.pulse
                  ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite'
                  : 'none',
              }}
              aria-hidden="true"
            />
          )}
          {t(`evaluation.statuts.${evaluation.statut}`)}
        </span>
      </div>

      {/* Ligne 2 : badge type éval */}
      <div>
        <span
          className="text-xs font-medium rounded-full px-2.5 py-0.5"
          style={{
            background: 'var(--primary-light)',
            color: 'var(--primary)',
          }}
        >
          {evaluation.type === 'auto'
            ? t('dashboard.evalTypeAuto')
            : t('dashboard.evalTypeAccompagnee')}
        </span>
      </div>

      {/* Ligne 3 : score + date */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex-1 min-w-0">
          {evaluation.scoreGlobal != null ? (
            <>
              <p
                className="text-3xl font-bold tabular-nums leading-none mb-1.5"
                style={{ color: scoreColor(evaluation.scoreGlobal) }}
              >
                {evaluation.scoreGlobal}
                <span className="text-lg font-semibold">%</span>
              </p>
              {/* Barre de progression fine */}
              <div
                className="w-full rounded-full overflow-hidden"
                style={{ height: '3px', background: 'var(--border-subtle)' }}
                role="progressbar"
                aria-valuenow={evaluation.scoreGlobal}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Score : ${evaluation.scoreGlobal}%`}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${evaluation.scoreGlobal}%`,
                    background: scoreColor(evaluation.scoreGlobal),
                  }}
                />
              </div>
            </>
          ) : (
            <p
              className="text-lg font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              —
            </p>
          )}
        </div>

        {updatedAt && (
          <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            {updatedAt}
          </p>
        )}
      </div>
    </div>
  );
}
