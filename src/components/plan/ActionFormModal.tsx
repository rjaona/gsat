import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Action, ActionStatut, ActionPriorite } from '@/types';
import { usePlanActionStore } from '@/stores/planActionStore';
import { Button } from '@/components/ui';

interface ActionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionExistante?: Action | undefined;
}

interface FormValues {
  objectif: string;
  description: string;
  domaineAmelioration: string;
  responsable: string;
  dateEcheance: string;
  priorite: ActionPriorite;
  statut: ActionStatut;
  kpis: string;
  ressourcesNecessaires: string;
}

const PRIORITES: ActionPriorite[] = ['basse', 'moyenne', 'haute', 'critique'];
const STATUTS: ActionStatut[] = ['a_faire', 'en_cours', 'termine', 'bloque'];

function isoToInputDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toISOString().split('T')[0] ?? '';
}

// Shared style helpers
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

const fieldErrorStyle: React.CSSProperties = {
  ...fieldStyle,
  border: '2px solid var(--danger)',
};

const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'var(--primary)';
  e.currentTarget.style.background = 'var(--surface-container-lowest)';
};

const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'transparent';
  e.currentTarget.style.background = 'var(--surface-container-highest)';
};

const onFocusError = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = 'var(--danger)';
  e.currentTarget.style.background = 'var(--surface-container-lowest)';
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

const selectStyle: React.CSSProperties = {
  ...fieldStyle,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23767682' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: '36px',
  appearance: 'none' as const,
};

export function ActionFormModal({ isOpen, onClose, actionExistante }: ActionFormModalProps) {
  const { t } = useTranslation();
  const { ajouterAction, modifierAction, loading, error } = usePlanActionStore();

  const isEdition = !!actionExistante;

  const [values, setValues] = useState<FormValues>({
    objectif: '',
    description: '',
    domaineAmelioration: '',
    responsable: '',
    dateEcheance: '',
    priorite: 'moyenne',
    statut: 'a_faire',
    kpis: '',
    ressourcesNecessaires: '',
  });

  const [erreurs, setErreurs] = useState<Partial<Record<keyof FormValues, string>>>({});

  useEffect(() => {
    if (actionExistante) {
      setValues({
        objectif: actionExistante.objectif,
        description: actionExistante.description,
        domaineAmelioration: actionExistante.domaineAmelioration,
        responsable: actionExistante.responsable,
        dateEcheance: isoToInputDate(actionExistante.dateEcheance),
        priorite: actionExistante.priorite,
        statut: actionExistante.statut,
        kpis: actionExistante.kpis ?? '',
        ressourcesNecessaires: actionExistante.ressourcesNecessaires ?? '',
      });
    } else {
      setValues({
        objectif: '',
        description: '',
        domaineAmelioration: '',
        responsable: '',
        dateEcheance: '',
        priorite: 'moyenne',
        statut: 'a_faire',
        kpis: '',
        ressourcesNecessaires: '',
      });
    }
    setErreurs({});
  }, [actionExistante, isOpen]);

  // ESC key close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function valider(): boolean {
    const e: Partial<Record<keyof FormValues, string>> = {};
    if (!values.objectif.trim()) e.objectif = t('planAction.form.objectifRequis');
    if (!values.domaineAmelioration.trim())
      e.domaineAmelioration = t('planAction.form.domaineRequis');
    if (!values.dateEcheance) e.dateEcheance = t('planAction.form.echeanceRequise');
    setErreurs(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valider()) return;

    const dateEcheance = new Date(values.dateEcheance).toISOString();

    try {
      if (isEdition && actionExistante) {
        await modifierAction(actionExistante.id, {
          objectif: values.objectif.trim(),
          description: values.description.trim(),
          domaineAmelioration: values.domaineAmelioration.trim(),
          responsable: values.responsable.trim(),
          dateEcheance,
          priorite: values.priorite,
          statut: values.statut,
          kpis: values.kpis.trim() || undefined,
          ressourcesNecessaires: values.ressourcesNecessaires.trim() || undefined,
        });
      } else {
        await ajouterAction({
          objectif: values.objectif.trim(),
          description: values.description.trim(),
          domaineAmelioration: values.domaineAmelioration.trim(),
          responsable: values.responsable.trim(),
          dateEcheance,
          priorite: values.priorite,
          statut: 'a_faire',
          kpis: values.kpis.trim() || undefined,
          ressourcesNecessaires: values.ressourcesNecessaires.trim() || undefined,
        });
      }
      onClose();
    } catch {
      // L'erreur est gérée dans le store
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-modal-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl animate-fadeIn flex flex-col"
        style={{
          background: 'var(--surface)',
          boxShadow: 'var(--shadow-xl)',
          maxHeight: '92vh',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 id="action-modal-title" className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            {isEdition ? t('planAction.form.titreEdition') : t('planAction.form.titreCreation')}
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

        {/* Body — scrollable */}
        <form id="action-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div
              className="rounded-lg px-3 py-2.5 text-sm"
              style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
            >
              {error}
            </div>
          )}

          {/* Objectif */}
          <div>
            <label style={labelStyle}>
              {t('planAction.form.objectif')} <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={values.objectif}
              onChange={e => setValues(v => ({ ...v, objectif: e.target.value }))}
              placeholder={t('planAction.form.objectifPlaceholder')}
              style={erreurs.objectif ? fieldErrorStyle : fieldStyle}
              onFocus={erreurs.objectif ? onFocusError : onFocus}
              onBlur={e => {
                e.currentTarget.style.borderColor = erreurs.objectif ? 'var(--danger)' : 'transparent';
                e.currentTarget.style.background = 'var(--surface-container-highest)';
              }}
            />
            {erreurs.objectif && (
              <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{erreurs.objectif}</p>
            )}
          </div>

          {/* Domaine d'amélioration */}
          <div>
            <label style={labelStyle}>
              {t('planAction.form.domaine')} <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={values.domaineAmelioration}
              onChange={e => setValues(v => ({ ...v, domaineAmelioration: e.target.value }))}
              placeholder={t('planAction.form.domainePlaceholder')}
              style={erreurs.domaineAmelioration ? fieldErrorStyle : fieldStyle}
              onFocus={erreurs.domaineAmelioration ? onFocusError : onFocus}
              onBlur={e => {
                e.currentTarget.style.borderColor = erreurs.domaineAmelioration ? 'var(--danger)' : 'transparent';
                e.currentTarget.style.background = 'var(--surface-container-highest)';
              }}
            />
            {erreurs.domaineAmelioration && (
              <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{erreurs.domaineAmelioration}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>{t('planAction.form.description')}</label>
            <textarea
              value={values.description}
              onChange={e => setValues(v => ({ ...v, description: e.target.value }))}
              placeholder={t('planAction.form.descriptionPlaceholder')}
              rows={3}
              style={{ ...fieldStyle, resize: 'none' }}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          {/* Responsable + Échéance */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{t('planAction.responsable')}</label>
              <input
                type="text"
                value={values.responsable}
                onChange={e => setValues(v => ({ ...v, responsable: e.target.value }))}
                style={fieldStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              />
            </div>
            <div>
              <label style={labelStyle}>
                {t('planAction.echeance')} <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="date"
                value={values.dateEcheance}
                onChange={e => setValues(v => ({ ...v, dateEcheance: e.target.value }))}
                style={erreurs.dateEcheance ? fieldErrorStyle : fieldStyle}
                onFocus={erreurs.dateEcheance ? onFocusError : onFocus}
                onBlur={e => {
                  e.currentTarget.style.borderColor = erreurs.dateEcheance ? 'var(--danger)' : 'transparent';
                  e.currentTarget.style.background = 'var(--surface-container-highest)';
                }}
              />
              {erreurs.dateEcheance && (
                <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{erreurs.dateEcheance}</p>
              )}
            </div>
          </div>

          {/* Priorité + Statut */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{t('planAction.priorite')}</label>
              <select
                value={values.priorite}
                onChange={e => setValues(v => ({ ...v, priorite: e.target.value as ActionPriorite }))}
                style={selectStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              >
                {PRIORITES.map(p => (
                  <option key={p} value={p}>{t(`planAction.priorites.${p}`)}</option>
                ))}
              </select>
            </div>
            {isEdition && (
              <div>
                <label style={labelStyle}>{t('planAction.statut')}</label>
                <select
                  value={values.statut}
                  onChange={e => setValues(v => ({ ...v, statut: e.target.value as ActionStatut }))}
                  style={selectStyle}
                  onFocus={onFocus}
                  onBlur={onBlur}
                >
                  {STATUTS.map(s => (
                    <option key={s} value={s}>{t(`planAction.statuts.${s}`)}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* KPIs */}
          <div>
            <label style={labelStyle}>{t('planAction.kpis')}</label>
            <input
              type="text"
              value={values.kpis}
              onChange={e => setValues(v => ({ ...v, kpis: e.target.value }))}
              placeholder={t('planAction.form.kpisPlaceholder')}
              style={fieldStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
        </form>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {t('common.annuler')}
          </Button>
          <Button type="submit" form="action-form" loading={loading}>
            {isEdition ? t('common.enregistrer') : t('planAction.form.creer')}
          </Button>
        </div>
      </div>
    </div>
  );
}
