import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import type { Referentiel } from '@/types';
import { getReferentiel, updateReferentiel } from '@/services/referentielService';
import { ReferentielViewer } from './ReferentielViewer';
import { useReferentiel } from '@/hooks/useReferentiel';

// ── Validation de structure JSON ──────────────────────────────────────────────

function isValidReferentiel(data: unknown): data is Referentiel {
  if (!data || typeof data !== 'object') return false;
  const r = data as Record<string, unknown>;
  if (typeof r['version'] !== 'string') return false;
  if (!r['nom'] || typeof (r['nom'] as Record<string, unknown>)['fr'] !== 'string') return false;
  if (!Array.isArray(r['dimensions'])) return false;
  return true;
}

export function ReferentielPage() {
  const { t } = useTranslation();
  // Vue admin : référentiel national par défaut. Un sélecteur multi-versions
  // (via listReferentiels) reste à ajouter pour éditer aussi far_v1_0.
  const { referentiel, loading, error } = useReferentiel('v3_0');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(false);

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);

      if (!isValidReferentiel(parsed)) {
        setImportError(t('admin.referentiel.erreurStructure'));
        return;
      }

      const confirmed = window.confirm(
        t('admin.referentiel.confirmerImport', { version: parsed.version })
      );
      if (!confirmed) return;

      setImporting(true);
      await updateReferentiel(parsed.version.replace(/\./g, '_'), parsed);
      setImportSuccess(true);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : t('common.erreur'));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-5">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          {t('admin.referentiel.titre')}
        </h2>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#5C2D91] px-4 py-2 text-sm font-medium text-white hover:bg-[#3D1A6B] transition-colors">
          <Upload size={15} />
          {importing ? t('common.chargement') : t('admin.referentiel.importer')}
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={handleFileChange}
            disabled={importing}
          />
        </label>
      </div>

      {/* Feedback import */}
      {importError && (
        <div
          className="rounded-lg px-4 py-2 text-sm"
          style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
        >
          {importError}
        </div>
      )}
      {importSuccess && (
        <div
          className="rounded-lg px-4 py-2 text-sm"
          style={{ background: 'var(--success-light)', color: 'var(--success)' }}
        >
          {t('admin.referentiel.importSucces')}
        </div>
      )}

      {/* Erreur chargement */}
      {error && (
        <div
          className="rounded-lg px-4 py-2 text-sm"
          style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
        >
          {t('common.erreurChargement')} : {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl" style={{ background: 'var(--bg)' }} />
          ))}
        </div>
      )}

      {/* Référentiel actif */}
      {!loading && referentiel && (
        <ReferentielViewer referentiel={referentiel} />
      )}

      {/* Aucun référentiel */}
      {!loading && !referentiel && !error && (
        <div
          className="rounded-xl border-2 border-dashed py-12 text-center text-sm"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          {t('admin.referentiel.aucun')}
        </div>
      )}
    </div>
  );
}
