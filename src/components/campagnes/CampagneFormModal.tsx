import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Campagne, CampagneStatut, CampagneMode, OrgType, Organisation } from '@/types';
import { useCampagneActions } from '@/hooks/useCampagne';
import { listReferentiels } from '@/services/referentielService';
import { listOrganisations } from '@/services/organisationService';
import { grouperParProvince } from '@/utils/perimetreProvinces';
import { Button } from '@/components/ui';

interface CampagneFormModalProps {
  campagne?: Campagne | undefined;   // undefined = création, défini = édition
  onClose: () => void;
}

interface RefOption {
  version: string;
  nom: string;
  niveau: OrgType | null;
  actif: boolean;
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

const aideStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  marginTop: '4px',
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
  const [referentielVersion, setReferentielVersion] = useState(campagne?.referentielVersion ?? '');
  const [mode, setMode] = useState<CampagneMode>(campagne?.mode ?? 'complet');
  const [perimetre, setPerimetre] = useState<string[]>(campagne?.perimetre ?? []);
  const [referentiels, setReferentiels] = useState<RefOption[]>([]);
  const [refsLoading, setRefsLoading] = useState(true);
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [openProvinces, setOpenProvinces] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (error) setFormError(error);
  }, [error]);

  // Chargement des référentiels (sélecteur) et des ASN (périmètre par province).
  useEffect(() => {
    let alive = true;
    void listReferentiels()
      .then(refs => {
        if (!alive) return;
        setReferentiels(refs);
        // Défaut : version de la campagne éditée, sinon 1er référentiel ACTIF (jamais
        // un brouillon inactif ni 'v3_0' en dur ; l'ordre alphabétique ne fait pas le défaut).
        const defaut = campagne?.referentielVersion || refs.find(r => r.actif)?.version || refs[0]?.version || '';
        setReferentielVersion(prev => prev || defaut);
        setRefsLoading(false);
      })
      .catch(() => { if (alive) setRefsLoading(false); });
    void listOrganisations('ASN')
      .then(a => { if (alive) setOrgs(a); })
      .catch(() => { /* périmètre optionnel */ });
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC key close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectedRef = referentiels.find(r => r.version === referentielVersion);
  // Le mode socle/complet n'a de sens qu'au niveau ASN : le GSAT national n'a pas de socle.
  const isAsn = selectedRef?.niveau === 'ASN';
  const groupes = useMemo(() => grouperParProvince(orgs), [orgs]);
  const perimetreSet = useMemo(() => new Set(perimetre), [perimetre]);

  function toggleOrg(id: string) {
    setPerimetre(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  }
  function toggleProvince(ids: string[]) {
    const allSel = ids.length > 0 && ids.every(id => perimetreSet.has(id));
    setPerimetre(p => (allSel ? p.filter(id => !ids.includes(id)) : [...new Set([...p, ...ids])]));
  }
  function toggleOpen(prefixe: string) {
    setOpenProvinces(s => {
      const n = new Set(s);
      if (n.has(prefixe)) n.delete(prefixe); else n.add(prefixe);
      return n;
    });
  }

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

    // Un référentiel national (niveau ≠ ASN) est toujours en mode complet.
    const modeEffectif: CampagneMode = isAsn ? mode : 'complet';

    try {
      if (isEdit && campagne) {
        await modifierCampagne(campagne.id, {
          nom: nom.trim(),
          description: description.trim() || undefined,
          dateOuverture: inputDateToIso(dateOuverture),
          dateFermeture: inputDateToIso(dateFermeture),
          referentielVersion,
          mode: modeEffectif,
          perimetre,
        });
      } else {
        await creerCampagne({
          nom: nom.trim(),
          description: description.trim() || undefined,
          dateOuverture: inputDateToIso(dateOuverture),
          dateFermeture: inputDateToIso(dateFermeture),
          referentielVersion,
          statut: 'planifiee' as CampagneStatut,
          mode: modeEffectif,
          perimetre,
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
        className="w-full max-w-lg rounded-2xl animate-fadeIn flex flex-col"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
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

        {/* Body (scrollable) */}
        <form id="campagne-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
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

          {/* Version référentiel — alimenté par listReferentiels() */}
          <div>
            <label htmlFor="campagne-referentiel" style={labelStyle}>
              {t('campagne.form.referentiel')}
            </label>
            <select
              id="campagne-referentiel"
              value={referentielVersion}
              onChange={e => setReferentielVersion(e.target.value)}
              disabled={refsLoading}
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
              {refsLoading && <option value="">{t('campagne.form.referentielChargement')}</option>}
              {referentiels.map(r => (
                <option key={r.version} value={r.version}>
                  {r.nom}{r.actif ? '' : ` — ${t('campagne.form.referentielInactif')}`}
                </option>
              ))}
            </select>
          </div>

          {/* Mode socle / complet — uniquement pour un référentiel ASN */}
          {isAsn && (
            <div>
              <label style={labelStyle}>{t('campagne.form.mode')}</label>
              <div className="grid grid-cols-2 gap-2">
                {(['socle', 'complet'] as CampagneMode[]).map(m => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-lg)',
                        border: active ? '2px solid var(--primary)' : '2px solid transparent',
                        background: active ? 'var(--primary-light)' : 'var(--surface-container-highest)',
                        color: active ? 'var(--primary)' : 'var(--text)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      aria-pressed={active}
                    >
                      {t(`campagne.form.mode${m === 'socle' ? 'Socle' : 'Complet'}`)}
                    </button>
                  );
                })}
              </div>
              <p style={aideStyle}>
                {t(mode === 'socle' ? 'campagne.form.modeSocleAide' : 'campagne.form.modeCompletAide')}
              </p>
            </div>
          )}

          {/* Périmètre — Faritany groupés par province, repliables */}
          {groupes.length > 0 && (
            <div>
              <label style={labelStyle}>{t('campagne.form.perimetre')}</label>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  maxHeight: '240px',
                  overflowY: 'auto',
                }}
              >
                {groupes.map(g => {
                  const ids = g.orgs.map(o => o.id);
                  const nSel = ids.filter(id => perimetreSet.has(id)).length;
                  const allSel = nSel === ids.length;
                  const open = openProvinces.has(g.prefixe);
                  return (
                    <div key={g.prefixe} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleOpen(g.prefixe)}
                          aria-expanded={open}
                          aria-label={g.nom}
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            transform: open ? 'rotate(90deg)' : 'none',
                            transition: 'transform 150ms ease',
                            width: 16,
                          }}
                        >
                          ›
                        </button>
                        <label className="flex items-center gap-2 flex-1 cursor-pointer" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                          <input
                            type="checkbox"
                            checked={allSel}
                            ref={el => { if (el) el.indeterminate = nSel > 0 && !allSel; }}
                            onChange={() => toggleProvince(ids)}
                          />
                          {g.nom}
                        </label>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{nSel}/{ids.length}</span>
                      </div>
                      {open && (
                        <div className="px-3 pb-2" style={{ paddingLeft: '34px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {g.orgs.map(o => (
                            <label key={o.id} className="flex items-center gap-2 cursor-pointer" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              <input
                                type="checkbox"
                                checked={perimetreSet.has(o.id)}
                                onChange={() => toggleOrg(o.id)}
                              />
                              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>{o.code}</span>
                              {o.nom}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <p style={aideStyle}>
                {perimetre.length === 0
                  ? t('campagne.form.perimetreAide')
                  : t('campagne.perimetreN', { count: perimetre.length })}
              </p>
            </div>
          )}

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
          className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
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
