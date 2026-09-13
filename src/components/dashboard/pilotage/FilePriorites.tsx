import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { PrioriteItem } from '@/utils/pilotage';

export function FilePriorites({ items, evalue, actionsTerminees }: { items: PrioriteItem[]; evalue: boolean; actionsTerminees: number }) {
  const { t } = useTranslation();

  if (!evalue) {
    return <p className="text-sm text-[#767682]">{t('pages.pilotageRegional.nonEvalue', 'Aucune évaluation en cours.')}</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-sm text-[#256a1c]">
        {t('pages.pilotageRegional.rienEnAttente', 'Aucune priorité en attente — {{n}} actions terminées.', { n: actionsTerminees })}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map(it => {
        if (it.kind === 'essentiel_ko') {
          return (
            <li key={`ko-${it.code}`} className="flex items-center gap-3 p-3 rounded-lg bg-[#fff5f5]">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a]">
                {t('pages.pilotageRegional.badgeKo', 'Essentiel KO')}
              </span>
              <span className="text-sm font-medium text-[#171c22]">{it.code} — {it.libelle}</span>
            </li>
          );
        }
        const badge = it.statut === 'bloque'
          ? { txt: t('pages.pilotageRegional.badgeBloque', 'Bloquée'), cls: 'bg-[#ffe6c0] text-[#8a5a00]' }
          : { txt: t('pages.pilotageRegional.badgeRetard', 'En retard'), cls: 'bg-[#ffdad6] text-[#ba1a1a]' };
        return (
          <li key={`ac-${it.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-[#f8f9ff]">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.txt}</span>
            <span className="text-sm font-medium text-[#171c22] flex-1">{it.titre}</span>
            <Link to="/action-plan" className="text-xs font-semibold text-[#15236e] hover:underline shrink-0">
              {t('pages.pilotageRegional.agir', 'Agir')} ↗
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
