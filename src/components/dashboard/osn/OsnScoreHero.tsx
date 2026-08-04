import { useTranslation } from 'react-i18next'

interface OsnScoreHeroProps {
  scoreGlobal: number
  tendance?: number // delta vs période précédente, ex: +3.2
  nbAsn?: number
  tauxCompletion?: number
}

/**
 * Carte gradient score national — grand chiffre Manrope, tendance, taux de participation.
 * Design Stitch : from-primary to-primary-container, text-white, shadow-xl, rounded-2xl.
 */
export function OsnScoreHero({ scoreGlobal, tendance, nbAsn, tauxCompletion }: OsnScoreHeroProps) {
  const { t } = useTranslation()

  return (
    <div className="md:col-span-2 bg-gradient-to-br from-primary to-primary-container p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
      {/* Contenu principal */}
      <div className="relative z-10">
        <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-2">
          {t('pages.dashboardOsn.scoreNational', 'Score National Global')}
        </p>
        <div className="flex items-baseline gap-3">
          <h2 className="text-6xl font-headline font-extrabold tracking-tight">
            {scoreGlobal.toFixed(1)}%
          </h2>
          {tendance !== undefined && (
            <span
              className={`text-sm font-bold flex items-center gap-1 ${
                tendance >= 0 ? 'text-[#bcf0ae]' : 'text-[#ffdad6]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {tendance >= 0 ? 'trending_up' : 'trending_down'}
              </span>
              {tendance >= 0 ? '+' : ''}{tendance.toFixed(1)}%
            </span>
          )}
        </div>

        {nbAsn !== undefined && (
          <p className="mt-4 text-white/60 text-sm leading-relaxed max-w-xs">
            {t('pages.dashboardOsn.scoreDescription', {
              count: nbAsn,
              defaultValue: `Moyenne pondérée calculée sur ${nbAsn} Association(s) Scoute(s) Nationale(s).`,
            })}
          </p>
        )}

        {tauxCompletion !== undefined && (
          <div className="mt-6 flex items-center gap-3">
            <div className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#bcf0ae] rounded-full transition-all duration-700"
                style={{ width: `${tauxCompletion}%` }}
              />
            </div>
            <span className="text-white/80 text-xs font-bold whitespace-nowrap">
              {tauxCompletion}% {t('pages.dashboardOsn.asnSoumises', 'ASN soumises')}
            </span>
          </div>
        )}
      </div>

      {/* Décor blob */}
      <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-8 -top-8 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
    </div>
  )
}
