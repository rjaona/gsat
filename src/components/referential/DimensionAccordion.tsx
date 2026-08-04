import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CriterionRow } from './CriterionRow'
import type { DimensionDef, CritereDef } from '@/types'

interface DimensionAccordionProps {
  dimension: DimensionDef
  isActive?: boolean
  onSelect?: () => void
  onEditCriterion?: (criterion: CritereDef) => void
  readonly?: boolean
}

/**
 * Accordéon dimension — navigation latérale + liste critères dépliable.
 * Design Stitch : border-l-4 border-primary quand actif, rounded-xl.
 */
export function DimensionAccordion({
  dimension,
  isActive,
  onSelect,
  onEditCriterion,
  readonly,
}: DimensionAccordionProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'
  const [expanded, setExpanded] = useState(isActive ?? false)

  const nom = dimension.nom[lang] ?? dimension.nom.fr
  const critereActifs = dimension.criteres.filter((c) => c.actif)
  const nbEssentiels = critereActifs.filter((c) => c.essentiel).length

  function handleToggle() {
    if (onSelect) onSelect()
    setExpanded((prev) => !prev)
  }

  return (
    <div>
      {/* En-tête dimension */}
      <button
        onClick={handleToggle}
        className={`w-full text-left p-4 rounded-xl flex items-center justify-between group transition-all ${
          isActive
            ? 'bg-[#15236e]/5 border-l-4 border-[#15236e]'
            : 'hover:bg-[#f0f4fd] border-l-4 border-transparent'
        }`}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
              isActive
                ? 'bg-[#15236e] text-white'
                : 'bg-[#e4e8f1] text-[#454651]'
            }`}
          >
            {dimension.code.replace('D', '').padStart(2, '0')}
          </span>
          <div className="text-left">
            <div
              className={`font-bold text-sm ${
                isActive ? 'text-[#15236e]' : 'text-[#171c22]'
              }`}
            >
              {nom}
            </div>
            <div className="text-[10px] text-[#454651] font-medium">
              {critereActifs.length} Critères
              {nbEssentiels > 0 && ` · ${nbEssentiels} essentiels`}
            </div>
          </div>
        </div>
        <span
          className={`material-symbols-outlined transition-transform duration-200 ${
            isActive ? 'text-[#15236e]' : 'text-[#454651]/30'
          } ${expanded ? 'rotate-90' : ''}`}
        >
          chevron_right
        </span>
      </button>

      {/* Liste critères */}
      {expanded && critereActifs.length > 0 && (
        <div className="mt-3 space-y-4 pl-2">
          {critereActifs.map((critere) => (
            <CriterionRow
              key={critere.code}
              criterion={critere}
              dimensionCode={dimension.code}
              onEdit={onEditCriterion}
              readonly={readonly}
            />
          ))}
        </div>
      )}
    </div>
  )
}
