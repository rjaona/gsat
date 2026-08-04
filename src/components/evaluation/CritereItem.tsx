import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScorePicker } from './ScorePicker';
import type { CritereDef, Score } from '@/types';
import type { ValeurScore } from './ScorePicker';

/**
 * `note` peut valoir undefined : c'est « pas repondu », distinct de null qui
 * est « non applicable ». Le service supprimera la ligne dans le premier cas
 * et ecrira un NULL dans le second.
 */
type ScoreInput = Omit<Score, 'updatedBy' | 'updatedAt' | 'note'> & { note: ValeurScore };

interface CritereItemProps {
  critere: CritereDef;
  score: Score | undefined;
  onScoreChange: (score: ScoreInput) => void;
  onUploadPreuve: (critereCode: string, file: File) => void;
  uploadProgress?: number | undefined;
  disabled?: boolean;
  isKO?: boolean;
  commentaireManquant?: boolean;
}

export function CritereItem({
  critere,
  score,
  onScoreChange,
  onUploadPreuve,
  uploadProgress,
  disabled = false,
  isKO = false,
  commentaireManquant = false,
}: CritereItemProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('en') ? 'en' : 'fr';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);

  const handleNoteChange = (note: ValeurScore) => {
    onScoreChange({ critereCode: critere.code, note, commentaire: score?.commentaire ?? '' });
  };

  const handleCommentaireChange = (commentaire: string) => {
    // `score === undefined` (pas repondu) doit rester undefined, et surtout PAS
    // devenir null : `?? null` transformerait un critere non repondu en N/A et
    // ferait monter le score au lieu de le faire baisser.
    onScoreChange({ critereCode: critere.code, note: score === undefined ? undefined : score.note, commentaire });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadPreuve(critere.code, file);
      e.target.value = '';
    }
  };

  return (
    <div
      id={`critere-${critere.code}`}
      style={{
        background: isKO ? 'var(--danger-light)' : 'var(--surface-container-low)',
        borderRadius: 'var(--radius-xl)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        // Subtle left accent for KO state
        borderLeft: isKO ? '3px solid var(--danger)' : '3px solid transparent',
        transition: 'border-color 200ms ease',
      }}
    >
      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges ligne */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
            {/* Code critère */}
            <span
              style={{
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
              {critere.code}
            </span>

            {/* Essentiel */}
            {critere.essentiel && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--warning-light)',
                  color: 'var(--warning)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                }}
              >
                ★ {t('evaluation.essentiel')}
              </span>
            )}

            {/* KO */}
            {isKO && (
              <span
                style={{
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--danger)',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  letterSpacing: '0.04em',
                }}
              >
                KO
              </span>
            )}
          </div>

          {/* Libellé */}
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.5 }}>
            {critere.libelle[lang]}
          </p>
        </div>

        {/* Bouton guide */}
        {critere.guideInterpretation && (
          <button
            type="button"
            onClick={() => setShowGuide(v => !v)}
            title={t('evaluation.guide')}
            style={{
              flexShrink: 0,
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              border: 'none',
              background: showGuide ? 'var(--primary-light)' : 'var(--surface-container-high)',
              color: showGuide ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease, color 150ms ease',
            }}
          >
            ?
          </button>
        )}
      </div>

      {/* ── Guide d'interprétation ── */}
      {showGuide && critere.guideInterpretation && (
        <div
          style={{
            background: 'var(--info-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 14px',
          }}
        >
          <p style={{ fontSize: '12px', color: 'var(--info)', lineHeight: 1.6 }}>
            {critere.guideInterpretation[lang]}
          </p>
        </div>
      )}

      {/* ── Score picker ── */}
      <ScorePicker
        value={score === undefined ? undefined : score.note}
        onChange={handleNoteChange}
        disabled={disabled}
        essentiel={critere.essentiel}
      />

      {/* ── Commentaire ── */}
      <div>
        <label
          style={{
            display: 'block',
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: commentaireManquant ? 'var(--danger)' : 'var(--text-muted)',
            marginBottom: '6px',
          }}
        >
          {t('evaluation.commentaire')}
          {commentaireManquant && (
            <span style={{ marginLeft: '6px', fontWeight: 600, textTransform: 'none', letterSpacing: 'normal', fontSize: '11px' }}>
              * {t('evaluation.commentaireObligatoire')}
            </span>
          )}
        </label>
        <textarea
          rows={2}
          disabled={disabled}
          value={score?.commentaire ?? ''}
          onChange={e => handleCommentaireChange(e.target.value)}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => setTextareaFocused(false)}
          placeholder={t('evaluation.commentairePlaceholder')}
          style={{
            width: '100%',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 14px',
            fontSize: '13px',
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
            transition: 'border-color 150ms ease',
            background: commentaireManquant
              ? 'var(--danger-light)'
              : disabled
              ? 'var(--surface-container)'
              : 'var(--surface-container-highest)',
            border: `2px solid ${
              commentaireManquant
                ? 'var(--danger)'
                : textareaFocused
                ? 'var(--primary)'
                : 'transparent'
            }`,
            color: disabled ? 'var(--text-muted)' : 'var(--text)',
            cursor: disabled ? 'not-allowed' : 'auto',
          }}
        />
      </div>

      {/* ── Upload preuve ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileChange}
          disabled={disabled}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: 'var(--radius-lg)',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 500,
            border: 'none',
            background: 'var(--surface-container-lowest)',
            color: 'var(--text-secondary)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            boxShadow: 'var(--shadow-xs)',
            transition: 'box-shadow 150ms ease',
          }}
          onMouseEnter={e => {
            if (!disabled) (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-xs)';
          }}
        >
          <span>📎</span>
          {t('evaluation.ajouterPreuve')}
        </button>

        {uploadProgress !== undefined && uploadProgress < 100 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <div
              style={{
                flex: 1,
                height: '4px',
                background: 'var(--surface-container-highest)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  background: 'var(--primary)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
              {uploadProgress}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
