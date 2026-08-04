import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Calendar } from 'lucide-react';
import type { Campagne, CampagneStatut } from '@/types';
import { useCampagnes } from '@/hooks/useCampagne';
import { useCampagneActions } from '@/hooks/useCampagne';
import { Button, EmptyState } from '@/components/ui';
import CampagneCard from './CampagneCard';
import CampagneFormModal from './CampagneFormModal';

const STATUTS: { value: CampagneStatut | undefined; labelKey: string }[] = [
  { value: undefined,     labelKey: 'campagne.filtreToutes' },
  { value: 'ouverte',     labelKey: 'campagne.statut.ouverte' },
  { value: 'planifiee',   labelKey: 'campagne.statut.planifiee' },
  { value: 'fermee',      labelKey: 'campagne.statut.fermee' },
  { value: 'archivee',    labelKey: 'campagne.statut.archivee' },
];

export default function CampagneList() {
  const { t } = useTranslation();
  const [filtreStatut, setFiltreStatut] = useState<CampagneStatut | undefined>(undefined);
  const [selectedForEdit, setSelectedForEdit] = useState<Campagne | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { campagnes, loading, error } = useCampagnes(filtreStatut);
  const { changerStatut, supprimerCampagne, canManage } = useCampagneActions();

  const handleChangeStatut = async (campagne: Campagne) => {
    const transitions: Record<CampagneStatut, CampagneStatut | null> = {
      planifiee: 'ouverte',
      ouverte: 'fermee',
      fermee: 'archivee',
      archivee: null,
    };
    const next = transitions[campagne.statut];
    if (!next) return;
    await changerStatut(campagne.id, next);
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-xl animate-pulse"
            style={{ background: 'var(--surface-container-low)' }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg p-4 text-sm"
        style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}
      >
        {t('common.erreurChargement')} : {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filtres statut */}
        <div className="flex flex-wrap gap-2">
          {STATUTS.map(s => {
            const isActive = filtreStatut === s.value;
            return (
              <button
                key={s.value ?? 'toutes'}
                type="button"
                onClick={() => setFiltreStatut(s.value)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                style={{
                  background: isActive ? 'var(--primary)' : 'var(--surface-container)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-container-high)';
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-container)';
                }}
              >
                {t(s.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Bouton créer */}
        {canManage && (
          <Button icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
            {t('campagne.nouvelle')}
          </Button>
        )}
      </div>

      {/* Grille / Empty state */}
      {campagnes.length === 0 ? (
        <div
          style={{
            borderRadius: 'var(--radius-2xl)',
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <EmptyState
            icon={<Calendar size={24} />}
            title={t('campagne.aucune')}
            description="Créez une campagne pour démarrer des évaluations GSAT dans votre organisation."
            action={
              canManage ? (
                <Button icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>
                  {t('campagne.nouvelle')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campagnes.map(c => (
            <CampagneCard
              key={c.id}
              campagne={c}
              canManage={canManage}
              onEdit={canManage ? setSelectedForEdit : undefined}
              onChangeStatut={canManage ? handleChangeStatut : undefined}
            />
          ))}
        </div>
      )}

      {/* Modale création */}
      {showCreateModal && (
        <CampagneFormModal
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Modale édition */}
      {selectedForEdit && (
        <CampagneFormModal
          campagne={selectedForEdit}
          onClose={() => setSelectedForEdit(null)}
        />
      )}
    </div>
  );
}
