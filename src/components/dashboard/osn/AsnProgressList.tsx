import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { seuilQuartileBas } from '@/utils/asnTableau'

interface AsnProgressItem {
  asnId: string
  nom: string
  progression: number // 0–100
  actionsTotal: number
  actionsDone: number
}

interface AsnProgressListProps {
  items: AsnProgressItem[]
  onViewAll?: () => void
}

/**
 * Liste des ASN avec barre de progression du plan d'action national.
 * Design Stitch : numéros en cercle vert, barre slim, bouton voir tout.
 */
export function AsnProgressList({ items, onViewAll }: AsnProgressListProps) {
  const { t } = useTranslation()

  // Priorités : les plus en retard d'abord ; le quartile bas est mis en avant.
  const seuil = useMemo(() => seuilQuartileBas(items.map(i => i.progression)), [items])
  const tries = useMemo(() => [...items].sort((a, b) => a.progression - b.progression), [items])

  return (
    <div className="bg-[#ffffff] rounded-2xl shadow-sm p-6 border border-[#c6c5d2]/5">
      <h4 className="font-headline font-bold text-[#15236e] mb-6">
        {t('pages.dashboardOsn.prioritesPlanAction', "Priorités du Plan d'Action")}
      </h4>

      <div className="space-y-5">
        {tries.map((item, idx) => {
          const bas = item.progression <= seuil
          return (
          <div key={item.asnId} className="flex gap-4">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${bas ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#3b6934]/10 text-[#3b6934]'}`}>
              {String(idx + 1).padStart(2, '0')}
            </div>
            <div className="flex-1 min-w-0">
              <h5 className="text-sm font-bold text-[#171c22] truncate">{item.nom}</h5>
              <p className="text-xs text-[#454651] mt-0.5">
                {item.actionsDone}/{item.actionsTotal}{' '}
                {t('pages.dashboardOsn.actionsTerminees', 'actions terminées')}
              </p>
              <div className="mt-2 h-1.5 w-full bg-[#eaeef7] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3b6934] rounded-full transition-all duration-700"
                  style={{ width: `${item.progression}%` }}
                />
              </div>
            </div>
            <span className="flex-shrink-0 text-xs font-bold text-[#454651] self-center">
              {item.progression}%
            </span>
          </div>
          )
        })}
      </div>

      {onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full mt-6 py-3 border border-[#15236e] text-[#15236e] font-bold text-xs rounded-xl hover:bg-[#15236e] hover:text-white transition-all"
        >
          {t('pages.dashboardOsn.voirPlanComplet', 'Voir le Plan Complet')}
        </button>
      )}
    </div>
  )
}
