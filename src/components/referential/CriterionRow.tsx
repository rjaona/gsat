import { useTranslation } from 'react-i18next'
import { EssentialBadge } from './EssentialBadge'
import type { CritereDef } from '@/types'

interface CriterionRowProps {
  criterion: CritereDef
  dimensionCode: string
  onEdit?: ((criterion: CritereDef) => void) | undefined
  readonly?: boolean | undefined
}

/**
 * Carte critère — code, titre, badge essentiel, bouton édition.
 * Design Stitch : rounded-3xl, shadow-sm, hover:shadow-md, border border-outline-variant/5.
 */
export function CriterionRow({ criterion, dimensionCode, onEdit, readonly }: CriterionRowProps) {
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const label = criterion.libelle[lang] ?? criterion.libelle.fr
  const guide = criterion.guideInterpretation?.[lang] ?? criterion.guideInterpretation?.fr

  return (
    <div className="bg-[#ffffff] rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-[#c6c5d2]/5">
      <div className="p-6 flex items-start gap-5">
        {/* Numéro + icône essentiel */}
        <div className="mt-1 flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-xs font-bold text-[#454651]/40">
            {dimensionCode.replace('D', '')}.{criterion.ordre}
          </span>
          <button
            className={`w-6 h-6 flex items-center justify-center ${
              criterion.essentiel ? 'text-[#3b6934]' : 'text-[#454651]/20'
            }`}
            aria-label={criterion.essentiel ? 'Critère essentiel' : 'Critère complémentaire'}
            disabled
          >
            <span
              className="material-symbols-outlined text-xl"
              style={
                criterion.essentiel
                  ? { fontVariationSettings: "'FILL' 1" }
                  : undefined
              }
            >
              verified
            </span>
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-3 gap-4">
            <div className="min-w-0">
              <h4 className="font-bold text-[#15236e] text-base leading-snug">{label}</h4>
              <div className="flex gap-2 mt-1.5 flex-wrap">
                <EssentialBadge essential={criterion.essentiel} />
                <span className="px-2 py-0.5 bg-[#dee3eb] text-[#454651] text-[10px] font-bold rounded-full uppercase tracking-tighter">
                  Code: {criterion.code}
                </span>
              </div>
            </div>

            {!readonly && onEdit && (
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => onEdit(criterion)}
                  className="p-2 hover:bg-[#eaeef7] rounded-lg text-[#15236e] transition-colors"
                  aria-label="Modifier le critère"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                </button>
              </div>
            )}
          </div>

          {guide && (
            <p className="text-[#454651] text-sm leading-relaxed">{guide}</p>
          )}
        </div>
      </div>
    </div>
  )
}
