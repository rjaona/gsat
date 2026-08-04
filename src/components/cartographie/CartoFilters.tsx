import { useTranslation } from 'react-i18next';
import { ChevronDown, Globe } from 'lucide-react';
import type { RegionCode } from '@/types';

export type ScoreRange = 'tous' | 'excellent' | 'moyen' | 'faible';

interface CartoFiltersProps {
  regionSelectionnee: RegionCode | 'TOUTES';
  onRegionChange: (region: RegionCode | 'TOUTES') => void;
  scoreRange: ScoreRange;
  onScoreRangeChange: (range: ScoreRange) => void;
  nbOsnAffichees: number;
}

const REGIONS: { value: RegionCode | 'TOUTES'; label: string }[] = [
  { value: 'TOUTES',       label: 'Toutes les régions' },
  { value: 'AFRICA',       label: 'Afrique' },
  { value: 'ASIA_PACIFIC', label: 'Asie-Pacifique' },
  { value: 'ARAB',         label: 'Arabe' },
  { value: 'INTERAMERICA', label: 'Interamérique' },
  { value: 'EUROPE',       label: 'Europe' },
  { value: 'EURASIA',      label: 'Eurasie' },
];

const SCORE_CHIPS: {
  value: ScoreRange;
  label: string;
  dot: string;
  activeBg: string;
}[] = [
  { value: 'tous',      label: 'Tous',     dot: 'var(--text-muted)',      activeBg: 'var(--primary)' },
  { value: 'excellent', label: '≥ 75%',    dot: 'var(--score-excellent)', activeBg: 'var(--score-excellent)' },
  { value: 'moyen',     label: '50 – 74%', dot: 'var(--score-moyen)',     activeBg: 'var(--score-moyen)' },
  { value: 'faible',    label: '< 50%',    dot: 'var(--score-faible)',    activeBg: 'var(--danger)' },
];

export function CartoFilters({
  regionSelectionnee,
  onRegionChange,
  scoreRange,
  onScoreRangeChange,
  nbOsnAffichees,
}: CartoFiltersProps) {
  const { t } = useTranslation();

  const isScoreActive = scoreRange !== 'tous';
  const isRegionActive = regionSelectionnee !== 'TOUTES';

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        padding: '10px 20px',
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* ── Titre ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Globe size={14} style={{ color: 'var(--primary)' }} />
        </div>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: 'var(--font-headline)',
            color: 'var(--text)',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          {t('nav.cartographie')}
        </h2>
      </div>

      {/* ── Séparateur ── */}
      <div
        style={{
          height: '18px',
          width: '1px',
          background: 'var(--border)',
          flexShrink: 0,
        }}
        className="hidden sm:block"
      />

      {/* ── Sélecteur région ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <select
          value={regionSelectionnee}
          onChange={e => onRegionChange(e.target.value as RegionCode | 'TOUTES')}
          className="appearance-none outline-none"
          style={{
            paddingLeft: '12px',
            paddingRight: '28px',
            paddingTop: '6px',
            paddingBottom: '6px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: 'var(--radius-full)',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 150ms ease, color 150ms ease, box-shadow 150ms ease',
            background: isRegionActive ? 'var(--primary)' : 'var(--surface-container)',
            color: isRegionActive ? '#ffffff' : 'var(--text)',
            boxShadow: isRegionActive
              ? '0 2px 8px -1px rgba(21,35,110,0.35)'
              : 'var(--shadow-xs)',
          }}
          aria-label={t('cartographie.filtres.region')}
        >
          {REGIONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <ChevronDown
          size={11}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: isRegionActive ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
          }}
        />
      </div>

      {/* ── Chips score ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span
          className="hidden sm:inline"
          style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
        >
          Score :
        </span>
        {SCORE_CHIPS.map(chip => {
          const isActive = scoreRange === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => onScoreRangeChange(chip.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 150ms ease, color 150ms ease, transform 150ms ease, box-shadow 150ms ease',
                background: isActive ? chip.activeBg : 'var(--surface-container)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                transform: isActive ? 'scale(1.04)' : 'scale(1)',
                boxShadow: isActive ? `0 2px 6px -1px ${chip.activeBg}66` : 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-high)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface-container)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }
              }}
            >
              {chip.value !== 'tous' && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: isActive ? 'rgba(255,255,255,0.7)' : chip.dot,
                  }}
                />
              )}
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* ── Reset ── */}
      {(isRegionActive || isScoreActive) && (
        <button
          type="button"
          onClick={() => { onRegionChange('TOUTES'); onScoreRangeChange('tous'); }}
          style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: 'var(--danger-light)',
            color: 'var(--danger)',
            cursor: 'pointer',
            transition: 'opacity 150ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
        >
          <span aria-hidden="true">✕ </span>Réinitialiser
        </button>
      )}

      {/* ── Compteur ── */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 800,
            fontFamily: 'var(--font-headline)',
            color: 'var(--text)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {nbOsnAffichees}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          OSN affichée{nbOsnAffichees !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}
