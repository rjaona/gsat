import { useTranslation } from 'react-i18next';

// Hex résolus depuis wosm.css (CSS vars non utilisables dans les props de couleur inline)
const LEGEND_ITEMS = [
  { color: '#3b6934', colorVar: 'var(--score-excellent)', labelKey: 'cartographie.legende.excellent' },
  { color: '#F59E0B', colorVar: 'var(--score-moyen)',     labelKey: 'cartographie.legende.moyen' },
  { color: '#F97316', colorVar: 'var(--score-faible)',    labelKey: 'cartographie.legende.faible' },
  { color: '#ba1a1a', colorVar: 'var(--score-critique)',  labelKey: 'cartographie.legende.critique' },
  { color: '#767682', colorVar: 'var(--text-muted)',      labelKey: 'cartographie.legende.sansDonnee' },
];

export function CartoLegend() {
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '16px',
        zIndex: 1000,
        padding: '14px 16px',
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: '156px',
      }}
    >
      <p className="label-caps" style={{ marginBottom: '10px' }}>
        {t('cartographie.legende.titre')}
      </p>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {LEGEND_ITEMS.map(item => (
          <li
            key={item.labelKey}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                flexShrink: 0,
                background: item.colorVar,
              }}
              aria-hidden="true"
            />
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              {t(item.labelKey)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
