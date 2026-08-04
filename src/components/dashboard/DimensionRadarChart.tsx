import { useTranslation } from 'react-i18next';

interface DimensionRadarChartProps {
  scoreParDimension: Record<string, number>;
  height?: number;
}

function couleurScore(score: number): string {
  if (score >= 75) return 'var(--score-excellent)';
  if (score >= 50) return 'var(--score-moyen)';
  if (score >= 25) return 'var(--score-faible)';
  return 'var(--score-critique)';
}

// Labels courts pour les dimensions GSAT
const DIM_LABELS: Record<string, string> = {
  D01: 'Gouvernance',
  D02: 'Programme',
  D03: 'Finances',
  D04: 'Membres',
  D05: 'Bénévoles',
  D06: 'Communication',
  D07: 'Partenariats',
  D08: 'Propriétés',
  D09: 'Développement',
  D10: 'Image',
};

// DimensionRow — barre de progression d'une dimension
function DimensionRow({ code, score }: { code: string; score: number }) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.max(0, Math.round(score)));
  const color = couleurScore(pct);
  const label = t(`dimensions.${code}`, { defaultValue: DIM_LABELS[code] ?? code });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {/* Label + score */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: 'var(--primary)',
              background: 'var(--primary-light)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 5px',
              flexShrink: 0,
              letterSpacing: '0.02em',
            }}
          >
            {code}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        </div>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color,
            flexShrink: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '5px',
          background: 'var(--surface-container-highest)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} : ${pct}%`}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            borderRadius: 'var(--radius-full)',
            transition: 'width 700ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>
    </div>
  );
}

// Grille de dimensions — remplace le radar chart
export function DimensionRadarChart({
  scoreParDimension,
}: DimensionRadarChartProps) {
  const { t } = useTranslation();

  const entries = Object.entries(scoreParDimension).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}
      >
        {t('common.chargement')}
      </div>
    );
  }

  // Moyenne globale
  const avg = Math.round(
    entries.reduce((sum, [, v]) => sum + v, 0) / entries.length
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Indicateur de moyenne */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'var(--surface-container-low)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}
        >
          Moyenne toutes dimensions
        </span>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 800,
            color: couleurScore(avg),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {avg}%
        </span>
      </div>

      {/* Grille 2 colonnes */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px 20px',
        }}
      >
        {entries.map(([code, score]) => (
          <DimensionRow key={code} code={code} score={score} />
        ))}
      </div>
    </div>
  );
}
