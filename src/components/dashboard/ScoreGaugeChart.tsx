import { useTranslation } from 'react-i18next';

interface ScoreGaugeChartProps {
  score: number; // 0-100
  label?: string;
  size?: number;
}

function couleurScore(score: number): string {
  if (score >= 75) return 'var(--score-excellent)';
  if (score >= 50) return 'var(--score-moyen)';
  if (score >= 25) return 'var(--score-faible)';
  return 'var(--score-critique)';
}

function labelScore(score: number): { text: string; bg: string; color: string } {
  if (score >= 75) return { text: 'Excellent', bg: 'var(--success-light)', color: 'var(--success)' };
  if (score >= 50) return { text: 'Moyen', bg: 'var(--warning-light)', color: 'var(--warning)' };
  if (score >= 25) return { text: 'Faible', bg: 'var(--score-faible-light)', color: 'var(--score-faible)' };
  return { text: 'Critique', bg: 'var(--danger-light)', color: 'var(--danger)' };
}

export function ScoreGaugeChart({ score, label, size = 220 }: ScoreGaugeChartProps) {
  const { t } = useTranslation();

  const safeScore = Math.min(100, Math.max(0, score));
  const couleur = couleurScore(safeScore);
  const badge = labelScore(safeScore);

  // Pure SVG semicircle gauge — no Recharts dependency
  const r = Math.round(size * 0.36);  // radius ~79px at size=220
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * r;
  const progress = (safeScore / 100) * circumference;
  const arcD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  // Only show top half + a bit of margin
  const svgH = r + 16;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        userSelect: 'none',
      }}
      role="img"
      aria-label={`${label ?? t('evaluation.scoreGlobal')} : ${safeScore}%`}
    >
      {/* SVG arc */}
      <svg
        width={size}
        height={svgH}
        viewBox={`0 ${cy - r - 8} ${size} ${svgH}`}
        style={{ overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Background track */}
        <path
          d={arcD}
          fill="none"
          stroke="var(--surface-container-highest)"
          strokeWidth={13}
          strokeLinecap="round"
        />
        {/* Progress fill */}
        <path
          d={arcD}
          fill="none"
          stroke={couleur}
          strokeWidth={13}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{
            transition: 'stroke-dasharray 900ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>

      {/* Score hero number */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          marginTop: '-4px',
        }}
      >
        <div style={{ lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: '2px' }}>
          <span
            style={{
              fontSize: `${size * 0.17}px`,
              fontWeight: 800,
              fontFamily: 'var(--font-headline)',
              color: couleur,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {safeScore}
          </span>
          <span
            style={{
              fontSize: `${size * 0.075}px`,
              fontWeight: 700,
              color: couleur,
              letterSpacing: '-0.02em',
            }}
          >
            %
          </span>
        </div>

        <p
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '0.01em',
          }}
        >
          {label ?? t('evaluation.scoreGlobal')}
        </p>

        <span
          style={{
            background: badge.bg,
            color: badge.color,
            fontSize: '10px',
            fontWeight: 700,
            borderRadius: 'var(--radius-full)',
            padding: '3px 12px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {badge.text}
        </span>
      </div>
    </div>
  );
}
