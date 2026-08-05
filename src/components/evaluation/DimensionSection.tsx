import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CritereItem } from './CritereItem';
import type { DimensionDef, Score, CritereDef } from '@/types';
import type { CritereKO, ScoreInput } from '@/stores/evaluationStore';
import type { ModeCampagne } from '@/services/scoring';
import type { ErpSnapshot } from '@/services/erpService';

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
  mode?: ModeCampagne;
  erpSnapshot?: ErpSnapshot | null;
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
  mode = 'complet',
  erpSnapshot = null,
}: DimensionSectionProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
  const [open, setOpen] = useState(defaultOpen);
  const [extOpen, setExtOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const activeCriteres = dimension.criteres.filter(c => c.actif);
  const extensionCriteres = activeCriteres.filter(c => c.socle === false);
  // En mode socle, les extensions n'entrent pas dans le score : liste principale = socle seul.
  const principales = mode === 'socle' ? activeCriteres.filter(c => c.socle !== false) : activeCriteres;
  const enExtension = mode === 'socle' ? extensionCriteres : [];

  // Avancement de la dimension : une ligne présente (N/A compris) compte comme répondu.
  const nbRenseignes = principales.filter(c => c.code in scores).length;

  const koInDim = criteresKO.filter(k =>
    activeCriteres.some(c => c.code === k.critereCode)
  );
  const hasKO = koInDim.length > 0;

  const { color: scoreColor, bg: scoreBg } = scoreStyle(Math.round(scoreDim));
  const progressWidth = principales.length > 0
    ? Math.round((nbRenseignes / principales.length) * 100)
    : 0;

  const renderCritere = (critere: CritereDef) => {
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
        erpSnapshot={erpSnapshot}
      />
    );
  };

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
          {nbRenseignes}/{principales.length}
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
          {principales.map(renderCritere)}

          {/* Extensions (mode socle) — saisissables mais hors score */}
          {enExtension.length > 0 && (
            <div style={{ marginTop: '4px', borderTop: '1px dashed var(--border)', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setExtOpen(v => !v)}
                aria-expanded={extOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0', textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', transform: extOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }} aria-hidden="true">›</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('evaluation.sectionExtension')}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({enExtension.length})</span>
              </button>
              {extOpen && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {enExtension.map(renderCritere)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
