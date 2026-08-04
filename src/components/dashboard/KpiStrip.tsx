import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

export interface KpiItem {
  label: string;
  value: string | number;
  subLabel?: string | undefined;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  trend?: { value: number; label: string } | undefined;
  icon?: ReactNode;
}

interface KpiStripProps {
  kpis: KpiItem[];
  loading?: boolean;
}

const VARIANT_VALUE_COLOR: Record<NonNullable<KpiItem['variant']>, string> = {
  default: 'var(--text)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};

const VARIANT_ICON_BG: Record<NonNullable<KpiItem['variant']>, string> = {
  default: 'var(--primary-light)',
  success: 'var(--success-light)',
  warning: 'var(--warning-light)',
  danger: 'var(--danger-light)',
};

const VARIANT_ICON_COLOR: Record<NonNullable<KpiItem['variant']>, string> = {
  default: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
};

function KpiSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        padding: '20px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        className="animate-pulse"
        style={{ position: 'absolute', inset: 0, background: 'var(--surface-container-low)', borderRadius: 'var(--radius-xl)', opacity: 0.5 }}
        aria-hidden="true"
      />
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--surface-container)', marginBottom: '14px', marginLeft: 'auto' }} />
      <div style={{ height: '9px', width: '60%', background: 'var(--surface-container)', borderRadius: '4px', marginBottom: '14px' }} />
      <div style={{ height: '32px', width: '45%', background: 'var(--surface-container)', borderRadius: '6px', marginBottom: '14px' }} />
      <div style={{ height: '8px', width: '70%', background: 'var(--surface-container)', borderRadius: '4px' }} />
    </div>
  );
}

export function KpiStrip({ kpis, loading = false }: KpiStripProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        aria-label={t('common.chargement')}
        aria-busy="true"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      role="list"
      aria-label={t('dashboard.kpiStrip')}
    >
      {kpis.map((kpi, i) => {
        const variant = kpi.variant ?? 'default';
        const valueColor = VARIANT_VALUE_COLOR[variant];
        const iconBg = VARIANT_ICON_BG[variant];
        const iconColor = VARIANT_ICON_COLOR[variant];

        const trendPositive = kpi.trend != null && kpi.trend.value > 0;
        const trendNegative = kpi.trend != null && kpi.trend.value < 0;
        const trendNeutral = kpi.trend != null && kpi.trend.value === 0;
        const trendColor = trendNeutral
          ? 'var(--text-muted)'
          : trendPositive
          ? 'var(--success)'
          : 'var(--danger)';
        const trendArrow = trendNeutral ? '→' : trendPositive ? '↑' : '↓';

        return (
          <div
            key={i}
            role="listitem"
            style={{
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-card)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              transition: 'transform 200ms ease, box-shadow 200ms ease',
              cursor: 'default',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'translateY(-2px)';
              el.style.boxShadow = 'var(--shadow-lg)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'translateY(0)';
              el.style.boxShadow = 'var(--shadow-card)';
            }}
          >
            {/* Icône en haut à droite */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: iconColor,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {kpi.icon}
              </div>
            </div>

            {/* Label caps */}
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                lineHeight: 1,
              }}
            >
              {kpi.label}
            </p>

            {/* Valeur large */}
            <p
              style={{
                fontSize: '2.25rem',
                fontWeight: 800,
                fontFamily: 'var(--font-headline)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: valueColor,
              }}
              aria-label={`${kpi.label} : ${kpi.value}`}
            >
              {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
            </p>

            {/* Trend + subLabel */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: '6px',
                minHeight: '16px',
              }}
            >
              {kpi.trend != null ? (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: trendColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    lineHeight: 1,
                  }}
                  aria-label={`Tendance : ${trendArrow} ${kpi.trend.value > 0 ? '+' : ''}${kpi.trend.value} — ${kpi.trend.label}`}
                >
                  <span aria-hidden="true">{trendArrow}</span>
                  {kpi.trend.value > 0 && '+'}
                  {kpi.trend.value !== 0 ? kpi.trend.value : ''}
                  &nbsp;
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '10px' }}>
                    {kpi.trend.label}
                  </span>
                </span>
              ) : (
                <span />
              )}

              {kpi.subLabel && (
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    textAlign: 'right',
                    lineHeight: 1.2,
                    flexShrink: 0,
                    maxWidth: '45%',
                  }}
                >
                  {kpi.subLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
