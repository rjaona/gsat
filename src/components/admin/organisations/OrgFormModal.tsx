import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organisation, OrgType, RegionCode } from '@/types';
import { createOrganisation, updateOrganisation, listOrganisations } from '@/services/organisationService';
import { Button } from '@/components/ui';

const ORG_TYPES: OrgType[] = ['OMMS', 'REGION', 'OSN', 'ASN'];

const REGION_CODES: RegionCode[] = [
  'AFRICA',
  'ASIA_PACIFIC',
  'ARAB',
  'INTERAMERICA',
  'EUROPE',
  'EURASIA',
];

const PARENT_TYPE: Record<OrgType, OrgType | null> = {
  OMMS:   null,
  REGION: 'OMMS',
  OSN:    'REGION',
  ASN:    'OSN',
};

interface OrgFormModalProps {
  org?: Organisation | null;
  onClose: () => void;
  onSuccess: () => void;
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

const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = 'var(--primary)';
  e.currentTarget.style.background = 'var(--surface-container-lowest)';
};

const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
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

const selectStyle: React.CSSProperties = {
  ...fieldStyle,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23767682' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: '36px',
  appearance: 'none' as const,
};

export function OrgFormModal({ org, onClose, onSuccess }: OrgFormModalProps) {
  const { t } = useTranslation();
  const isEdit = !!org;

  const [nom, setNom] = useState(org?.nom ?? '');
  const [code, setCode] = useState(org?.code ?? '');
  const [type, setType] = useState<OrgType>(org?.type ?? 'ASN');
  const [parentOrgId, setParentOrgId] = useState(org?.parentId ?? '');
  const [regionCode, setRegionCode] = useState<RegionCode | ''>(org?.regionCode ?? '');
  const [actif, setActif] = useState(org?.actif ?? true);
  const [parents, setParents] = useState<Organisation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentType = PARENT_TYPE[type];

  useEffect(() => {
    if (parentType) {
      listOrganisations(parentType).then(setParents).catch(() => {});
    } else {
      setParents([]);
      setParentOrgId('');
    }
  }, [type, parentType]);

  // ESC key close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: Omit<Organisation, 'id'> = {
      nom,
      type,
      actif,
      poids: 1,   // pondération de consolidation ; sélecteur dédié = tâche ultérieure
      ...(code ? { code } : {}),
      ...(parentOrgId ? { parentId: parentOrgId } : {}),
      ...(regionCode ? { regionCode: regionCode as RegionCode } : {}),
    };

    try {
      if (isEdit && org) {
        await updateOrganisation(org.id, payload);
      } else {
        await createOrganisation(payload);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.erreur'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
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
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            {isEdit
              ? t('admin.organisations.form.titreEdition')
              : t('admin.organisations.form.titreCreation')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <form id="org-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nom */}
          <div>
            <label style={labelStyle}>
              {t('admin.organisations.form.nom')} <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              required
              style={fieldStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          {/* Code */}
          <div>
            <label style={labelStyle}>{t('admin.organisations.form.code')}</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Ex: TEM"
              style={fieldStyle}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>

          {/* Type + Région — grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{t('admin.organisations.form.type')}</label>
              <select
                value={type}
                onChange={e => { setType(e.target.value as OrgType); setParentOrgId(''); }}
                style={selectStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              >
                {ORG_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t('admin.organisations.form.region')}</label>
              <select
                value={regionCode}
                onChange={e => setRegionCode(e.target.value as RegionCode | '')}
                style={selectStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              >
                <option value="">{t('admin.organisations.form.aucuneRegion')}</option>
                {REGION_CODES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Organisation parente */}
          {parentType && (
            <div>
              <label style={labelStyle}>
                {t('admin.organisations.form.parent', { type: parentType })}
              </label>
              <select
                value={parentOrgId}
                onChange={e => setParentOrgId(e.target.value)}
                style={selectStyle}
                onFocus={onFocus}
                onBlur={onBlur}
              >
                <option value="">{t('admin.organisations.form.aucunParent')}</option>
                {parents.map(p => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>
          )}

          {/* Actif toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={actif}
              onClick={() => setActif(v => !v)}
              className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
              style={{ background: actif ? 'var(--primary)' : 'var(--border)' }}
            >
              <span
                className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: actif ? 'translateX(16px)' : 'translateX(0)' }}
              />
            </button>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('admin.organisations.form.actif')}
            </span>
          </div>

          {/* Erreur */}
          {error && (
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
            >
              {error}
            </p>
          )}
        </form>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            {t('common.annuler')}
          </Button>
          <Button type="submit" form="org-form" loading={submitting}>
            {t('common.enregistrer')}
          </Button>
        </div>
      </div>
    </div>
  );
}
