import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { Organisation } from '@/types';
import { listOrganisations, deleteOrganisation } from '@/services/organisationService';
import { OrgTree } from './OrgTree';
import { OrgFormModal } from './OrgFormModal';

export function OrganisationsPage() {
  const { t } = useTranslation();
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg] = useState<Organisation | null>(null);

  const refreshOrgs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orgs = await listOrganisations();
      setOrganisations(orgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrgs();
  }, [refreshOrgs]);

  const handleDelete = useCallback(
    async (org: Organisation) => {
      if (!window.confirm(t('admin.organisations.confirmerSuppression', { nom: org.nom }))) return;
      setDeleteError(null);
      try {
        await deleteOrganisation(org.id);
        await refreshOrgs();
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : t('common.erreur'));
      }
    },
    [t, refreshOrgs]
  );

  return (
    <div className="space-y-5">
      {/* Barre d'outils */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          {t('admin.organisations.titre')}
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#5C2D91] px-4 py-2 text-sm font-medium text-white hover:bg-[#3D1A6B] transition-colors"
        >
          <Plus size={15} />
          {t('admin.organisations.nouvelle')}
        </button>
      </div>

      {/* Erreur suppression */}
      {deleteError && (
        <div
          className="rounded-lg px-4 py-2 text-sm"
          style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
        >
          {deleteError}
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
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: 'var(--bg)' }} />
          ))}
        </div>
      )}

      {/* Arbre */}
      {!loading && (
        <OrgTree
          organisations={organisations}
          onEdit={setEditOrg}
          onDelete={handleDelete}
        />
      )}

      {/* Modale création */}
      {showCreate && (
        <OrgFormModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); refreshOrgs(); }}
        />
      )}

      {/* Modale édition */}
      {editOrg && (
        <OrgFormModal
          org={editOrg}
          onClose={() => setEditOrg(null)}
          onSuccess={() => { setEditOrg(null); refreshOrgs(); }}
        />
      )}
    </div>
  );
}
