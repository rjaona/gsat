import { useTranslation } from 'react-i18next';
import type { ActionOrigine, ActionStatut } from '@/types';

export interface DrilldownAction {
  id: string;
  titre: string;
  statut: ActionStatut;
  dateEcheance: string;
  origine: ActionOrigine;
}

export interface DrilldownData {
  nom: string;
  essentielsKO: { code: string; libelle: string }[];
  actionsRetard: number;
  actionsBloque: number;
}

export function DrilldownFaritany({ data, onClose }: { data: DrilldownData | null; onClose: () => void }) {
  const { t } = useTranslation();
  if (!data) return null;
  return (
    <aside className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-5 border-b border-[#eceef4]">
        <h3 className="text-lg font-extrabold text-[#15236e]">{data.nom}</h3>
        <button type="button" onClick={onClose} aria-label={t('common.fermer', 'Fermer')} className="text-[#767682] hover:text-[#171c22]">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="p-5 space-y-6 overflow-y-auto">
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-[#ba1a1a] mb-2">
            {t('pages.pilotageNational.drillKo', 'Essentiels non conformes')}
          </h4>
          {data.essentielsKO.length === 0 ? (
            <p className="text-sm text-[#767682]">{t('pages.pilotageNational.drillAucunKo', 'Aucun essentiel KO.')}</p>
          ) : (
            <ul className="space-y-1">
              {data.essentielsKO.map(k => (
                <li key={k.code} className="text-sm text-[#171c22]">{k.code} — {k.libelle}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h4 className="text-xs font-bold uppercase tracking-wide text-[#8a5a00] mb-2">
            {t('pages.pilotageNational.drillActions', 'Actions en souffrance')}
          </h4>
          <p className="text-sm text-[#171c22]">
            {t('pages.pilotageNational.drillResume', '{{retard}} en retard · {{bloque}} bloquées', { retard: data.actionsRetard, bloque: data.actionsBloque })}
          </p>
          <p className="text-xs italic text-[#767682] mt-1">
            {t('pages.pilotageNational.drillPhase2', 'Détail par action et déclenchement de l’appui : Phase 2.')}
          </p>
        </section>
      </div>
    </aside>
  );
}
