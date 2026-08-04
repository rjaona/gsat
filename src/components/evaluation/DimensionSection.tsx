import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CritereItem } from './CritereItem';
import type { DimensionDef, Score } from '@/types';
import type { CritereKO, ScoreInput } from '@/stores/evaluationStore';

interface DimensionSectionProps {
  dimension: DimensionDef;
  scores: Record<string, Score>;
  criteresKO: CritereKO[];
  scoreDim: number;
  onScoreChange: (score: ScoreInput) => void;
  onUploadPreuve: (critereCode: string, file: File) => void;
  uploadProgress: Record<string, number>;
  disabled?: boolean;
  defaultOpen?: boolean;
}

function scoreStyle(score: number): { color: string; bg: string } {
  if (score >= 75) return { color: 'var(--score-excellent)', bg: 'var(--success-light)' };
  if (score >= 50) return { color: 'var(--score-moyen)',    bg: 'var(--warning-light)' };
  if (score >= 25) return { color: 'var(--score-faible)',   bg: 'var(--score-faible-light)' };
  return { color: 'var(--score-critique)', bg: 'var(--danger-light)' };
}

function progressBarColor(pct: number): string {
  if (pct === 100) return 'var(--score-excellent)';
  if (pct >= 50)   return 'var(--primary)';
  return 'var(--score-faible)';
}

export function DimensionSection({
  dimension,
  scores,
  criteresKO,
  scoreDim,
  onScoreChange,
  onUploadPreuve,
  uploadProgress,
  disabled = false,
  defaultOpen = false,
}: DimensionSectionProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
  const [open, setOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);

  const activeCriteres = dimension.criteres.filter(c => c.actif);
  const nbRenseignes = activeCriteres.filter(c => {
    const s = scores[c.code];
    return s?.note !== null && s?.note !== undefined;
  }).length;

  const koInDim = criteresKO.filter(k =>
    activeCriteres.some(c => c.code === k.critereCode)
  );
  const hasKO = koInDim.length > 0;

  const { color: scoreColor, bg: scoreBg } = scoreStyle(Math.round(scoreDim));
  const progressWidth = activeCriteres.length > 0
    ? Math.round((nbRenseignes / activeCriteres.length) * 100)
    : 0;

  return (
    <div
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: hasKO ? `0 0 0 2px var(--danger), var(--shadow-card)` : 'var(--shadow-card)',
        overflow: 'hidden',
        transition: 'box-shadow 200ms ease',
      }}
    >
      {/* ── Accordéon header ── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 20px',
          textAlign: 'left',
          border: 'none',
          background: hovered ? 'var(--surface-container-low)' : 'transparent',
          cursor: 'pointer',
          transition: 'background 150ms ease',
          borderRadius: open ? '0' : 'var(--radius-2xl)',
        }}
        aria-expanded={open}
      >
        {/* Code dimension */}
        <span
          style={{
            flexShrink: 0,
            fontFamily: 'monospace',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--primary)',
            background: 'var(--primary-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px 6px',
            letterSpacing: '0.04em',
          }}
        >
          {dimension.code}
        </span>

        {/* Titre */}
        <span
          style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {dimension.nom[lang]}
        </span>

        {/* KO badge */}
        {hasKO && (
          <span
            style={{
              flexShrink: 0,
              borderRadius: 'var(--radius-full)',
              background: 'var(--danger)',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 9px',
            }}
          >
            {koInDim.length} KO
          </span>
        )}

        {/* Score dimension */}
        <span
          style={{
            flexShrink: 0,
            fontSize: '12px',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: scoreColor,
            background: scoreBg,
            borderRadius: 'var(--radius-lg)',
            padding: '3px 10px',
          }}
        >
          {Math.round(scoreDim)}%
        </span>

        {/* Progression */}
        <span
          style={{
            flexShrink: 0,
            fontSize: '11px',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {nbRenseignes}/{activeCriteres.length}
        </span>

        {/* Chevron */}
        <span
          style={{
            flexShrink: 0,
            color: 'var(--text-muted)',
            fontSize: '14px',
            transition: 'transform 200ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      {/* ── Barre de progression ── */}
      <div style={{ padding: '0 20px', marginTop: '-2px' }}>
        <div
          style={{
            height: '3px',
            background: 'var(--surface-container-highest)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressWidth}%`,
              height: '100%',
              background: progressBarColor(progressWidth),
              borderRadius: 'var(--radius-full)',
              transition: 'width 500ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </div>
      </div>

      {/* ── Contenu déroulant ── */}
      {open && (
        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activeCriteres.map(critere => {
            const ko = criteresKO.find(k => k.critereCode === critere.code);
            return (
              <CritereItem
                key={critere.code}
                critere={critere}
                score={scores[critere.code]}
                onScoreChange={onScoreChange}
                onUploadPreuve={onUploadPreuve}
                uploadProgress={uploadProgress[critere.code]}
                disabled={disabled}
                isKO={!!ko}
                commentaireManquant={ko?.commentaireManquant ?? false}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
