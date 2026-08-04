import { useTranslation } from 'react-i18next';
import type { Action, ActionStatut } from '@/types';
import { ActionCard } from './ActionCard';

interface ActionKanbanProps {
  actions: Action[];
  loadingAction?: Record<string, boolean>;
  onSuivi?: (action: Action) => void;
  onEdit?: (action: Action) => void;
}

// Colonnes dans l'ordre d'affichage
const COLONNES: { statut: ActionStatut; labelKey: string; borderColor: string }[] = [
  { statut: 'a_faire', labelKey: 'planAction.statuts.a_faire', borderColor: 'var(--outline-variant)' },
  { statut: 'en_cours', labelKey: 'planAction.statuts.en_cours', borderColor: 'var(--info)' },
  { statut: 'termine', labelKey: 'planAction.statuts.termine', borderColor: 'var(--success)' },
  { statut: 'bloque', labelKey: 'planAction.statuts.bloque', borderColor: 'var(--danger)' },
];

export function ActionKanban({
  actions,
  loadingAction = {},
  onSuivi,
  onEdit,
}: ActionKanbanProps) {
  const { t } = useTranslation();

  const parStatut = COLONNES.map(col => ({
    ...col,
    items: actions.filter(a => a.statut === col.statut),
  }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {parStatut.map(col => (
        <div key={col.statut} className="flex flex-col gap-3">
          {/* En-tête colonne */}
          <div
            className="flex items-center justify-between pl-3 py-1"
            style={{ borderLeft: `4px solid ${col.borderColor}` }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {t(col.labelKey)}
            </span>
            <span
              className="text-xs rounded-full px-2 py-0.5"
              style={{ color: 'var(--text-muted)', background: 'var(--bg)' }}
            >
              {col.items.length}
            </span>
          </div>

          {/* Cartes */}
          <div className="flex flex-col gap-3 min-h-[80px]">
            {col.items.length === 0 ? (
              <div
                className="flex items-center justify-center h-16 border-2 border-dashed rounded-lg"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('planAction.aucuneAction')}</span>
              </div>
            ) : (
              col.items.map(action => (
                <ActionCard
                  key={action.id}
                  action={action}
                  loading={loadingAction[action.id] ?? false}
                  onSuivi={onSuivi}
                  onEdit={onEdit}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
