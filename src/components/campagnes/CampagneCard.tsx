import { useTranslation } from 'react-i18next';
import { Pencil, RefreshCw } from 'lucide-react';
import type { Campagne } from '@/types';
import CampagneBadge from './CampagneBadge';

interface CampagneCardProps {
  campagne: Campagne;
  onClick?: ((campagne: Campagne) => void) | undefined;
  onEdit?: ((campagne: Campagne) => void) | undefined;
  onChangeStatut?: ((campagne: Campagne) => void | Promise<void>) | undefined;
  canManage?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CampagneCard({
  campagne,
  onClick,
  onEdit,
  onChangeStatut,
  canManage = false,
}: CampagneCardProps) {
  const { t } = useTranslation();
  const nbCibles = campagne.perimetre.length;

  return (
    <div
      className="group relative"
      style={{
        background: 'var(--surface-container-lowest)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-card)',
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 200ms ease, box-shadow 200ms ease',
      }}
      onClick={() => onClick?.(campagne)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick?.(campagne)}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--shadow-lg)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--shadow-card)';
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'var(--font-headline)',
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            }}
          >
            {campagne.nom}
          </h3>
          {campagne.description && (
            <p
              style={{
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.5,
              }}
            >
              {campagne.description}
            </p>
          )}
        </div>
        <CampagneBadge statut={campagne.statut} className="shrink-0" />
      </div>

      {/* ── Dates ── */}
      <dl
        style={{
          marginTop: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px 16px',
        }}
      >
        <div>
          <dt style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
            {t('campagne.dateOuverture')}
          </dt>
          <dd style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: 'var(--text)' }}>
            {formatDate(campagne.dateOuverture)}
          </dd>
        </div>
        <div>
          <dt style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
            {t('campagne.dateFermeture')}
          </dt>
          <dd style={{ fontSize: '12px', fontWeight: 600, marginTop: '2px', color: 'var(--text)' }}>
            {formatDate(campagne.dateFermeture)}
          </dd>
        </div>
      </dl>

      {/* ── Périmètre ── */}
      <p
        style={{
          marginTop: '12px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {nbCibles === 0
          ? t('campagne.perimetreToutes')
          : t('campagne.perimetreN', { count: nbCibles })}
      </p>

      {/* ── Actions au hover ── */}
      {canManage && (
        <div
          className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={e => e.stopPropagation()}
        >
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(campagne)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 150ms ease, color 150ms ease',
              }}
              title={t('common.modifier')}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'var(--surface-container)';
                el.style.color = 'var(--text)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'transparent';
                el.style.color = 'var(--text-muted)';
              }}
            >
              <Pencil size={13} />
            </button>
          )}
          {onChangeStatut && (
            <button
              type="button"
              onClick={() => onChangeStatut(campagne)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 150ms ease, color 150ms ease',
              }}
              title={t('campagne.changerStatut')}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'var(--surface-container)';
                el.style.color = 'var(--text)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = 'transparent';
                el.style.color = 'var(--text-muted)';
              }}
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
