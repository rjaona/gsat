import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organisation } from '@/types';
import { grouperParProvince } from '@/utils/perimetreProvinces';
import type { StatutFaritany } from '@/utils/pilotage';

export interface WatchlistRow {
  org: Organisation;
  statut: StatutFaritany;
  essentielsKoCount: number;
  actionsTotal: number;
  actionsRetard: number;
  actionsBloque: number;
}

const STATUT_LABEL: Record<StatutFaritany, string> = {
  non_evalue: 'non évalué',
  rien_demarre: 'rien démarré',
  en_souffrance: 'en souffrance',
  sous_controle: 'sous contrôle',
};

const STATUT_STYLE: Record<StatutFaritany, string> = {
  non_evalue: 'bg-[#ecedef] text-[#767682]',
  rien_demarre: 'bg-[#ffe6c0] text-[#8a5a00]',
  en_souffrance: 'bg-[#ffdad6] text-[#ba1a1a]',
  sous_controle: 'bg-[#dcf5d3] text-[#256a1c]',
};

export function WatchlistFaritany({ rows, niveauLabel, onSelect }: { rows: WatchlistRow[]; niveauLabel?: string | undefined; onSelect?: ((orgId: string) => void) | undefined }) {
  const { t } = useTranslation();
  const byId = new Map(rows.map(r => [r.org.id, r]));
  const groupes = grouperParProvince(rows.map(r => r.org));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-[#767682] border-b border-[#eceef4]">
            <th className="py-2 pr-3">{niveauLabel ?? t('pages.pilotageNational.colFaritany', 'Faritany')}</th>
            <th className="py-2 px-2 text-center">{t('pages.pilotageNational.colKo', 'Essentiels KO')}</th>
            <th className="py-2 px-2 text-center">{t('pages.pilotageNational.colTotal', 'Actions')}</th>
            <th className="py-2 px-2 text-center">{t('pages.pilotageNational.colRetard', 'Retard')}</th>
            <th className="py-2 px-2 text-center">{t('pages.pilotageNational.colBloque', 'Bloquées')}</th>
            <th className="py-2 px-2">{t('pages.pilotageNational.colStatut', 'Statut')}</th>
            <th className="py-2 pl-2" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {groupes.map(g => (
            <Fragment key={`grp-${g.prefixe}`}>
              <tr className="bg-[#f0f4fd]">
                <td colSpan={7} className="py-1.5 px-3 text-xs font-bold text-[#15236e]">{g.nom}</td>
              </tr>
              {g.orgs.map(o => {
                const r = byId.get(o.id)!;
                return (
                  <tr
                    key={o.id}
                    onClick={() => onSelect?.(o.id)}
                    className={`border-b border-[#f2f3f7] ${onSelect ? 'cursor-pointer hover:bg-[#f8f9ff]' : ''} ${r.statut === 'non_evalue' ? 'opacity-60' : ''}`}
                  >
                    <td className="py-2 pr-3 font-medium text-[#171c22]">{o.nom}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{r.statut === 'non_evalue' ? '—' : (r.essentielsKoCount > 0 ? `🔴 ${r.essentielsKoCount}` : '0')}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{r.statut === 'non_evalue' ? '—' : r.actionsTotal}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{r.statut === 'non_evalue' ? '—' : r.actionsRetard}</td>
                    <td className="py-2 px-2 text-center tabular-nums">{r.statut === 'non_evalue' ? '—' : r.actionsBloque}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUT_STYLE[r.statut]}`}>
                        {t(`pages.pilotageNational.statuts.${r.statut}`, STATUT_LABEL[r.statut])}
                      </span>
                    </td>
                    <td className="py-2 pl-2 text-[#767682]">{onSelect ? '↗' : ''}</td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
