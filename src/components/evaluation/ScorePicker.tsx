import { useTranslation } from 'react-i18next';

/**
 * Trois états, et non deux — c'est tout l'enjeu du correctif C4.
 *
 *   0 | 1 | 2 | 3   note attribuée
 *   null            NON APPLICABLE — le critère sort du numérateur ET du
 *                   dénominateur. Une ligne existe en base avec note = NULL.
 *   undefined       PAS ENCORE RÉPONDU — compte 0 avec plein poids.
 *                   Aucune ligne en base : `onChange(undefined)` doit SUPPRIMER
 *                   la ligne, pas écrire un null.
 *
 * Confondre les deux derniers, c'est réintroduire le bug que la migration
 * corrige. D'où trois boutons distincts et trois libellés distincts.
 */
export type ValeurScore = 0 | 1 | 2 | 3 | null | undefined;

interface ScorePickerProps {
  value: ValeurScore;
  onChange: (note: ValeurScore) => void;
  disabled?: boolean;
  /** Affiche un rappel visuel que ce critère est essentiel. */
  essentiel?: boolean;
}

const SCORE_CONFIG: Array<{ value: 0 | 1 | 2 | 3; color: string; lightBg: string }> = [
  { value: 0, color: 'var(--score-critique)',  lightBg: 'var(--danger-light)' },
  { value: 1, color: 'var(--score-faible)',    lightBg: 'var(--score-faible-light)' },
  { value: 2, color: 'var(--score-moyen)',     lightBg: 'var(--warning-light)' },
  { value: 3, color: 'var(--score-excellent)', lightBg: 'var(--success-light)' },
];

const pill = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  borderRadius: 'var(--radius-full)',
  padding: '5px 14px',
  fontSize: '12px',
  fontWeight: 600,
  border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'transform 150ms ease, box-shadow 150ms ease',
});

export function ScorePicker({ value, onChange, disabled = false, essentiel = false }: ScorePickerProps) {
  const { t } = useTranslation();
  const estNA = value === null;
  const sansReponse = value === undefined;

  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}
      role="radiogroup"
      aria-label={t('evaluation.note')}
    >
      {SCORE_CONFIG.map(({ value: noteVal, color, lightBg }) => {
        const isSelected = value === noteVal;
        return (
          <button
            key={noteVal}
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-testid={`note-${noteVal}`}
            disabled={disabled}
            // Re-cliquer sur la note sélectionnée efface la réponse (retour à
            // « pas répondu »), il ne la bascule PAS en N/A.
            onClick={() => onChange(isSelected ? undefined : noteVal)}
            style={{
              ...pill(disabled),
              background: isSelected ? color : lightBg,
              color: isSelected ? '#ffffff' : color,
              boxShadow: isSelected ? `0 2px 8px -1px ${color}55` : 'none',
              transform: isSelected ? 'scale(1.04)' : 'scale(1)',
            }}
          >
            <span
              style={{
                width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                background: isSelected ? 'rgba(255,255,255,0.7)' : color,
              }}
              aria-hidden="true"
            />
            <span style={{ fontWeight: 700, marginRight: '1px' }}>{noteVal}</span>
            <span>{t(`evaluation.notes.${noteVal}`)}</span>
          </button>
        );
      })}

      <span aria-hidden="true" style={{ width: '1px', height: '20px', background: 'var(--outline-variant)', margin: '0 2px' }} />

      {/* Non applicable — état à part entière, pas un effacement */}
      <button
        type="button"
        role="radio"
        aria-checked={estNA}
        data-testid="note-na"
        disabled={disabled}
        title={t('evaluation.notes.naAide')}
        onClick={() => onChange(estNA ? undefined : null)}
        style={{
          ...pill(disabled),
          background: estNA ? 'var(--text-muted)' : 'var(--surface-container)',
          color: estNA ? '#ffffff' : 'var(--text-muted)',
          transform: estNA ? 'scale(1.04)' : 'scale(1)',
        }}
      >
        {t('evaluation.notes.na')}
      </button>

      {/* Effacer — ne s'affiche que s'il y a quelque chose à effacer */}
      {!sansReponse && (
        <button
          type="button"
          data-testid="note-effacer"
          disabled={disabled}
          onClick={() => onChange(undefined)}
          style={{
            ...pill(disabled),
            fontWeight: 500,
            background: 'transparent',
            color: 'var(--text-muted)',
            textDecoration: 'underline',
          }}
        >
          {t('evaluation.notes.effacer')}
        </button>
      )}

      {sansReponse && essentiel && (
        <span style={{ fontSize: '11px', color: 'var(--score-critique)', fontWeight: 600 }}>
          {t('evaluation.notes.essentielSansReponse')}
        </span>
      )}
    </div>
  );
}
