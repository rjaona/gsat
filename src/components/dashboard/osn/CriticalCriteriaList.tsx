import { useTranslation } from 'react-i18next'

interface CriticalItem {
  code: string
  dimensionCode: string
  label: string
  description?: string
  severity: 'critical' | 'warning'
}

interface CriticalCriteriaListProps {
  items: CriticalItem[]
}

/**
 * Liste des critères essentiels KO au niveau national.
 * Design Stitch : cards error-container/orange avec bordure gauche colorée.
 */
export function CriticalCriteriaList({ items }: CriticalCriteriaListProps) {
  const { t } = useTranslation()

  if (items.length === 0) {
    return (
      <div className="bg-[#ffffff] rounded-2xl shadow-sm p-6 border border-[#c6c5d2]/10">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="material-symbols-outlined text-[#3b6934]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <h4 className="font-headline font-bold text-[#15236e]">
            {t('pages.dashboardOsn.lacunesCritiques', 'Lacunes Critiques')}
          </h4>
        </div>
        <p className="text-sm text-[#454651]">
          {t('pages.dashboardOsn.aucuneLacune', 'Aucune lacune critique détectée.')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#ffffff] rounded-2xl shadow-sm p-6 border border-[#c6c5d2]/10">
      <div className="flex items-center gap-2 mb-6">
        <span
          className="material-symbols-outlined text-[#ba1a1a]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          report
        </span>
        <h4 className="font-headline font-bold text-[#15236e]">
          {t('pages.dashboardOsn.lacunesCritiques', 'Lacunes Critiques')}
        </h4>
        <span className="ml-auto text-xs font-bold bg-[#ffdad6] text-[#93000a] px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const isCritical = item.severity === 'critical'
          return (
            <div
              key={item.code}
              className={`p-4 rounded-xl border-l-4 ${
                isCritical
                  ? 'bg-[#ffdad6]/30 border-[#ba1a1a]'
                  : 'bg-orange-50 border-orange-500'
              }`}
            >
              <p
                className={`text-[10px] font-extrabold uppercase mb-1 tracking-widest ${
                  isCritical ? 'text-[#ba1a1a]' : 'text-orange-600'
                }`}
              >
                {item.dimensionCode} — {item.code}
              </p>
              <p className="text-sm font-bold text-[#171c22]">{item.label}</p>
              {item.description && (
                <p className="text-xs text-[#454651] mt-1 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
