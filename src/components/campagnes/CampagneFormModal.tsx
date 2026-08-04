import { useState, useEffect, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Campagne, CampagneStatut } from '@/types';
import { useCampagneActions } from '@/hooks/useCampagne';
import { Button } from '@/components/ui';

interface CampagneFormModalProps {
  campagne?: Campagne | undefined;   // undefined = création, défini = édition
  onClose: () => void;
}

function isoToInputDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function inputDateToIso(value: string): string {
  return new Date(value).toISOString();
}

// Shared input/select style helpers
const fieldStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 'var(--radius-lg)',
  border: '2px solid transparent',
  background: 'var(--surface-container-highest)',
  color: 'var(--text)',
  padding: '10px 16px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 150ms ease, background 150ms ease',
};

const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'var(--primary)';
  e.currentTarget.style.background = 'var(--surface-container-lowest)';
};

const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'transparent';
  e.currentTarget.style.background = 'var(--surface-container-highest)';
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  marginBottom: '6px',
};

export default function CampagneFormModal({ campagne, onClose }: CampagneFormModalProps) {
  const { t } = useTranslation();
  const { creerCampagne, modifierCampagne, loading, error } = useCampagneActions();
  const isEdit = Boolean(campagne);

  const [nom, setNom] = useState(campagne?.nom ?? '');
  const [description, setDescription] = useState(campagne?.description ?? '');
  const [dateOuverture, setDateOuverture] = useState(
    campagne ? isoToInputDate(campagne.dateOuverture) : ''
  );
  const [dateFermeture, setDateFermeture] = useState(
    campagne ? isoToInputDate(campagne.dateFermeture) : ''
  );
  const [referentielVersion, setReferentielVersion] = useState(
    campagne?.referentielVersion ?? 'v3_0'
  );
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (error) setFormError(error);
  }, [error]);

  // ESC key close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nom.trim()) {
      setFormError(t('campagne.form.nomRequis'));
      return;
    }
    if (!dateOuverture || !dateFermeture) {
      setFormError(t('campagne.form.datesRequises'));
      return;
    }
    if (new Date(dateFermeture) <= new Date(dateOuverture)) {
      setFormError(t('campagne.form.datesFermetureApresOuverture'));
      return;
    }

    try {
      if (isEdit && campagne) {
        await modifierCampagne(campagne.id, {
          nom: nom.trim(),
          description: description.trim() || undefined,
          dateOuverture: inputDateToIso(dateOuverture),
          dateFermeture: inputDateToIso(dateFermeture),
          referentielVersion,
        });
      } else {
        await creerCampagne({
          nom: nom.trim(),
          description: description.trim() || undefined,
          dateOuverture: inputDateToIso(dateOuverture),
          dateFermeture: inputDateToIso(dateFermeture),
          referentielVersion,
          statut: 'planifiee' as CampagneStatut,
          perimetre: [],
        });
      }
      onClose();
    } catch {
      // erreur déjà stockée dans le store
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="campagne-modal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl animate-fadeIn"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 id="campagne-modal-title" className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            {isEdit ? t('campagne.form.titreEdition') : t('campagne.form.titreCreation')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label={t('common.fermer')}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <form id="campagne-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nom */}
          <div>
            <label htmlFor="campagne-nom" style={labelStyle}>
              {t('campagne.form.nom')} <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="campagne-nom"
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              required
              maxLength={120}
              placeholder={t('campagne.form.nomPlaceholder')}
              style={fieldStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="campagne-description" style={labelStyle}>
              {t('campagne.form.description')}
            </label>
            <textarea
              id="campagne-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t('campagne.form.descriptionPlaceholder')}
              style={{ ...fieldStyle, resize: 'none' }}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="campagne-date-ouverture" style={labelStyle}>
                {t('campagne.dateOuverture')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="campagne-date-ouverture"
                type="date"
                value={dateOuverture}
                onChange={e => setDateOuverture(e.target.value)}
                required
                style={fieldStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </div>
            <div>
              <label htmlFor="campagne-date-fermeture" style={labelStyle}>
                {t('campagne.dateFermeture')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="campagne-date-fermeture"
                type="date"
                value={dateFermeture}
                onChange={e => setDateFermeture(e.target.value)}
                required
                style={fieldStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </div>
          </div>

          {/* Version référentiel */}
          <div>
            <label htmlFor="campagne-referentiel" style={labelStyle}>
              {t('campagne.form.referentiel')}
            </label>
            <select
              id="campagne-referentiel"
              value={referentielVersion}
              onChange={e => setReferentielVersion(e.target.value)}
              style={{
                ...fieldStyle,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23767682' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                paddingRight: '36px',
                appearance: 'none',
              }}
              onFocus={onFocus}
              onBlur={onBlur}
            >
              <option value="v3_0">GSAT v3.0</option>
            </select>
          </div>

          {/* Erreur */}
          {formError && (
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
            >
              {formError}
            </p>
          )}
        </form>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.annuler')}
          </Button>
          <Button type="submit" form="campagne-form" loading={loading}>
            {isEdit ? t('common.enregistrer') : t('campagne.form.creer')}
          </Button>
        </div>
      </div>
    </div>
  );
}
