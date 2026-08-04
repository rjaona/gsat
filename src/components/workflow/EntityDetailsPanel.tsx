/**
 * EntityDetailsPanel — Right panel showing entity details.
 *
 * Purple gradient background with organisation info,
 * type, last evaluation date, contact, and conformity bar.
 */
import { useTranslation } from 'react-i18next';
import type { EntityDetails } from '@/types/workflow';

// ── Props ────────────────────────────────────────────────────────────────────

export interface EntityDetailsPanelProps {
  entity: EntityDetails;
}

// ── Component ────────────────────────────────────────────────────────────────

export function EntityDetailsPanel({ entity }: EntityDetailsPanelProps) {
  const { t } = useTranslation();

  const conformity = entity.conformityPercent ?? 0;

  return (
    <section
      className="p-6 space-y-4"
      style={{
        background: 'var(--gradient-primary)',
        borderRadius: 'var(--radius-xl)',
        color: 'white',
      }}
    >
      <h4
        className="text-sm font-bold uppercase tracking-widest"
        style={{ opacity: 0.7 }}
      >
        {t('workflow.detailsEntite')}
      </h4>

      {/* Organisation name */}
      <p
        className="text-xl font-extrabold"
        style={{ fontFamily: 'var(--font-headline)' }}
      >
        {entity.name}
      </p>

      {/* Details rows */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span style={{ opacity: 0.7 }}>Type</span>
          <span className="font-semibold">{entity.type}</span>
        </div>

        {entity.lastEvaluation && (
          <div className="flex justify-between">
            <span style={{ opacity: 0.7 }}>{t('workflow.derniereEvaluation')}</span>
            <span className="font-semibold">{entity.lastEvaluation}</span>
          </div>
        )}

        {entity.contactPrincipal && (
          <div className="flex justify-between">
            <span style={{ opacity: 0.7 }}>{t('workflow.contactPrincipal')}</span>
            <span className="font-semibold">{entity.contactPrincipal}</span>
          </div>
        )}
      </div>

      {/* Conformity bar */}
      {entity.conformityPercent !== undefined && (
        <div className="space-y-2 pt-2">
          <div className="flex justify-between items-baseline">
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ opacity: 0.7 }}
            >
              {t('workflow.conformite')}
            </span>
            <span className="text-lg font-extrabold">{conformity}%</span>
          </div>
          <div
            className="w-full h-2 overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${conformity}%`,
                background: 'rgba(255,255,255,0.85)',
                borderRadius: 'var(--radius-full)',
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
