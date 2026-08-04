import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Suivi, ActionStatut } from '@/types';
import { listSuivis } from '@/services/planActionService';

interface SuiviTimelineProps {
  planId: string;
  actionId: string;
}

const STATUT_STYLES: Record<ActionStatut, { bg: string; text: string; dot: string }> = {
  a_faire: { bg: 'var(--surface-container-low)', text: 'var(--text-secondary)', dot: 'var(--outline-variant)' },
  en_cours: { bg: 'var(--info-light)', text: 'var(--info)', dot: 'var(--info)' },
  termine:  { bg: 'var(--success-light)', text: 'var(--success)', dot: 'var(--success)' },
  bloque:   { bg: 'var(--danger-light)', text: 'var(--danger)', dot: 'var(--danger)' },
};

export function SuiviTimeline({ planId, actionId }: SuiviTimelineProps) {
  const { t } = useTranslation();
  const [suivis, setSuivis] = useState<Suivi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listSuivis(actionId)
      .then(data => {
        setSuivis(data);
        setLoading(false);
      })
      .catch(err => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [planId, actionId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ background: 'var(--border)' }} />
            <div className="flex-1 space-y-1">
              <div className="h-3 rounded w-1/3" style={{ background: 'var(--border)' }} />
              <div className="h-3 rounded w-2/3" style={{ background: 'var(--border)' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs" style={{ color: 'var(--danger)' }}>{t('common.erreurChargement')} : {error}</p>
    );
  }

  if (suivis.length === 0) {
    return (
      <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
        {t('planAction.aucunSuivi')}
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Ligne verticale */}
      <div className="absolute left-1.5 top-2 bottom-0 w-px" style={{ background: 'var(--border)' }} />

      <ol className="space-y-4">
        {suivis.map((suivi, index) => {
          const couleur = STATUT_STYLES[suivi.nouveauStatut];
          const date =
            suivi.createdAt
              ? new Date(suivi.createdAt).toLocaleDateString()
              : '';

          return (
            <li key={suivi.id ?? index} className="flex gap-3 relative">
              {/* Point sur la timeline */}
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 mt-1 ring-2 ring-white"
                style={{ background: couleur.dot }}
              />

              {/* Contenu */}
              <div className="flex-1 rounded-lg p-3" style={{ background: couleur.bg }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium" style={{ color: couleur.text }}>
                    {t(`planAction.statuts.${suivi.ancienStatut}`)}
                    {' → '}
                    {t(`planAction.statuts.${suivi.nouveauStatut}`)}
                  </span>
                  {date && (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{date}</span>
                  )}
                </div>
                {suivi.commentaire && (
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{suivi.commentaire}</p>
                )}
                {suivi.createdBy && (
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{suivi.createdBy}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
