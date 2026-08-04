import { useTranslation } from 'react-i18next';
import type { Action, ActionPriorite, ActionStatut } from '@/types';

export interface ActionCardProps {
  action: Action;
  loading?: boolean;
  onSuivi?: ((action: Action) => void) | undefined;
  onEdit?: ((action: Action) => void) | undefined;
}

const PRIORITE_STYLES: Record<ActionPriorite, { bg: string; color: string }> = {
  basse:    { bg: 'var(--surface-container)',  color: 'var(--text-secondary)' },
  moyenne:  { bg: 'var(--info-light)',          color: 'var(--info)' },
  haute:    { bg: 'rgba(249,115,22,0.12)',      color: 'var(--score-faible)' },
  critique: { bg: 'var(--danger-light)',         color: 'var(--danger)' },
};

const STATUT_STYLES: Record<ActionStatut, { bg: string; color: string }> = {
  a_faire:  { bg: 'var(--surface-container-high)', color: 'var(--text-secondary)' },
  en_cours: { bg: 'var(--info-light)',              color: 'var(--info)' },
  termine:  { bg: 'var(--success-light)',           color: 'var(--success)' },
  bloque:   { bg: 'var(--danger-light)',            color: 'var(--danger)' },
};

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isEnRetard(echeance: string, statut: ActionStatut): boolean {
  if (statut === 'termine') return false;
  return new Date(echeance) < new Date();
}

export function ActionCard({ action, loading = false, onSuivi, onEdit }: ActionCardProps) {
  const { t } = useTranslation();

  const retard = isEnRetard(action.dateEcheance, action.statut);
  const echeanceStr = formatDate(action.dateEcheance);
  const prioriteStyle = PRIORITE_STYLES[action.priorite];
  const statutStyle = STATUT_STYLES[action.statut];

  return (
    <div
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: retard
          ? `0 0 0 2px var(--danger), var(--shadow-card)`
          : 'var(--shadow-card)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transition: 'opacity 200ms ease, box-shadow 200ms ease',
        opacity: loading ? 0.5 : 1,
        pointerEvents: loading ? 'none' : 'auto',
      }}
    >
      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {action.objectif}
          </p>
          {action.critereCode && (
            <p style={{ fontSize: '11px', marginTop: '3px', color: 'var(--text-muted)' }}>
              {t('planAction.critere')} {action.critereCode}
            </p>
          )}
        </div>

        {/* Priorité */}
        <span
          style={{
            flexShrink: 0,
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderRadius: 'var(--radius-full)',
            padding: '3px 9px',
            background: prioriteStyle.bg,
            color: prioriteStyle.color,
          }}
        >
          {t(`planAction.priorites.${action.priorite}`)}
        </span>
      </div>

      {/* ── Description ── */}
      {action.description && (
        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {action.description}
        </p>
      )}

      {/* ── Métadonnées ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
        {action.responsable && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            👤 {action.responsable}
          </span>
        )}
        {echeanceStr && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: retard ? 600 : 400,
              color: retard ? 'var(--danger)' : 'var(--text-muted)',
            }}
          >
            📅 {echeanceStr}
            {retard && ` — ${t('planAction.enRetard')}`}
          </span>
        )}
      </div>

      {/* ── KPIs ── */}
      {action.kpis && (
        <p
          style={{
            fontSize: '11px',
            fontStyle: 'italic',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {t('planAction.kpis')} : {action.kpis}
        </p>
      )}

      {/* ── Pied de carte ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {/* Statut */}
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            borderRadius: 'var(--radius-full)',
            padding: '3px 10px',
            background: statutStyle.bg,
            color: statutStyle.color,
          }}
        >
          {t(`planAction.statuts.${action.statut}`)}
        </span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(action)}
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 4px',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              {t('common.modifier')}
            </button>
          )}
          {onSuivi && (
            <button
              type="button"
              onClick={() => onSuivi(action)}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: 'var(--radius-lg)',
                padding: '5px 12px',
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 150ms ease, transform 150ms ease',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'var(--primary-hover)';
                el.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'var(--primary)';
                el.style.transform = 'translateY(0)';
              }}
            >
              {t('planAction.ajouterSuivi')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
