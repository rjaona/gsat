/**
 * EvidenceSummary — Summary of evidence documents with counts and download.
 */
import { useTranslation } from 'react-i18next';
import type { EvidenceCategory } from '@/types/workflow';

// ── Icon helper ──────────────────────────────────────────────────────────────

function MIcon({ name, size = 20 }: { name: string; size?: number | undefined }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface EvidenceSummaryProps {
  categories: EvidenceCategory[];
  onDownload?: (() => void) | undefined;
}

// ── Component ────────────────────────────────────────────────────────────────

export function EvidenceSummary({ categories, onDownload }: EvidenceSummaryProps) {
  const { t } = useTranslation();

  return (
    <section
      className="p-6 space-y-4"
      style={{
        background: 'var(--surface-container-lowest)',
        boxShadow: 'var(--shadow-card)',
        borderRadius: 'var(--radius-xl)',
      }}
    >
      <h4
        className="text-sm font-bold uppercase tracking-widest"
        style={{ color: 'var(--on-surface-variant)' }}
      >
        {t('workflow.resumePreuves')}
      </h4>

      <div className="space-y-3">
        {categories.map((cat, i) => (
          <div
            key={i}
            className="flex items-center gap-3 py-2 px-3"
            style={{
              background: 'var(--surface-container-low)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div
              className="w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{
                background: 'var(--primary-fixed)',
                color: 'var(--primary)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <MIcon name={cat.icon} size={16} />
            </div>
            <span
              className="flex-1 text-sm"
              style={{ color: 'var(--on-surface)' }}
            >
              {cat.label}
            </span>
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: 'var(--primary)' }}
            >
              {String(cat.count).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>

      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="w-full mt-2 px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{
            background: 'var(--surface-container-highest)',
            color: 'var(--on-surface)',
            borderRadius: 'var(--radius-xl)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <MIcon name="download" size={14} />
          {t('workflow.telechargerArchive')}
        </button>
      )}
    </section>
  );
}
