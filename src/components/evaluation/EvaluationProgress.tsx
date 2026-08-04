import { useTranslation } from 'react-i18next';
import type { CritereKO } from '@/stores/evaluationStore';

interface EvaluationProgressProps {
  scoreGlobal: number;
  nbRenseignes: number;
  nbTotal: number;
  criteresKO: CritereKO[];
  sticky?: boolean;
}

export function EvaluationProgress({
  scoreGlobal,
  nbRenseignes,
  nbTotal,
  criteresKO,
  sticky = true,
}: EvaluationProgressProps) {
  const { t } = useTranslation();

  const progressPercent = nbTotal > 0 ? Math.round((nbRenseignes / nbTotal) * 100) : 0;
  const koBloquants = criteresKO.filter(k => k.commentaireManquant);

  const scoreColorVar =
    scoreGlobal >= 75 ? 'var(--score-excellent)' :
    scoreGlobal >= 50 ? 'var(--score-moyen)' :
    scoreGlobal >= 25 ? 'var(--score-faible)' :
    'var(--score-critique)';

  const progressBarColor =
    progressPercent === 100 ? 'var(--score-excellent)' :
    progressPercent >= 50   ? 'var(--primary)' :
    'var(--score-faible)';

  return (
    <div
      className={sticky ? 'sticky bottom-4 z-20' : ''}
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-lg)',
        padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>

        {/* Score global */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              fontFamily: 'var(--font-headline)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.03em',
              lineHeight: 1,
              color: scoreColorVar,
            }}
          >
            {Math.round(scoreGlobal)}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>/100</span>
          <span style={{ marginLeft: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {t('evaluation.scoreGlobal')}
          </span>
        </div>

        {/* Progression */}
        <div style={{ flex: '1 1 180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {t('evaluation.progression')} — {nbRenseignes}/{nbTotal}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)' }}>{progressPercent}%</span>
          </div>
          <div
            style={{
              height: '6px',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              background: 'var(--surface-container-highest)',
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                borderRadius: 'var(--radius-full)',
                background: progressBarColor,
                transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </div>
        </div>

        {/* KO bloquants */}
        {koBloquants.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: 'var(--radius-lg)',
              padding: '7px 12px',
              background: 'var(--danger-light)',
              flexShrink: 0,
            }}
          >
            <span style={{ color: 'var(--danger)', fontSize: '13px' }} aria-hidden="true">⚠</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--danger)' }}>
              {t('evaluation.criteresKO', { count: koBloquants.length })}
            </span>
          </div>
        )}
      </div>

      {/* Codes KO cliquables */}
      {koBloquants.length > 0 && koBloquants.length <= 5 && (
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {koBloquants.map(k => (
            <a
              key={k.critereCode}
              href={`#critere-${k.critereCode}`}
              style={{
                borderRadius: 'var(--radius-full)',
                padding: '2px 10px',
                fontSize: '11px',
                fontFamily: 'monospace',
                fontWeight: 600,
                background: 'var(--danger-light)',
                color: 'var(--danger)',
                textDecoration: 'none',
                transition: 'opacity 150ms ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              {k.critereCode}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
