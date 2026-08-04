import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { subscribeReferentiel } from '@/services/referentielService'
import { DimensionAccordion } from '@/components/referential/DimensionAccordion'
import { CriterionEditModal } from './CriterionEditModal'
import type { Referentiel, DimensionDef, CritereDef } from '@/types'

// ── Page ─────────────────────────────────────────────────────────────────────

export function ReferentialPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'fr'

  const [referentiel, setReferentiel] = useState<Referentiel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dimension sélectionnée dans le panneau gauche
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null)
  const [filterEssentiel, setFilterEssentiel] = useState<'all' | 'essential' | 'standard'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal édition
  const [editCriterion, setEditCriterion] = useState<{
    criterion: CritereDef
    dimensionCode: string
  } | null>(null)

  useEffect(() => {
    const unsub = subscribeReferentiel('v3_0', (ref) => {
      setReferentiel(ref)
      setLoading(false)
      if (!selectedDimension && ref.dimensions.length > 0) {
        setSelectedDimension(ref.dimensions[0]!.code)
      }
    }, (err) => {
      setError(err.message)
      setLoading(false)
    })
    return unsub
  }, [selectedDimension])

  const handleEditCriterion = useCallback((criterion: CritereDef, dimensionCode: string) => {
    setEditCriterion({ criterion, dimensionCode })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <span className="material-symbols-outlined animate-spin text-[#15236e] text-3xl">
          progress_activity
        </span>
        <span className="text-[#454651]">{t('common.loading', 'Chargement…')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-[#ffdad6] text-[#93000a] rounded-xl flex items-center gap-3">
        <span className="material-symbols-outlined">warning</span>
        <span>{error}</span>
      </div>
    )
  }

  if (!referentiel) {
    return (
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-[#c6c5d2] text-5xl">menu_book</span>
        <p className="text-[#454651] mt-4">
          {t('pages.referential.aucunReferentiel', 'Référentiel non disponible.')}
        </p>
      </div>
    )
  }

  // Statistiques globales
  const nbCriteres = referentiel.dimensions.reduce((acc, d) => acc + d.criteres.filter(c => c.actif).length, 0)
  const nbEssentiels = referentiel.dimensions.reduce(
    (acc, d) => acc + d.criteres.filter(c => c.actif && c.essentiel).length,
    0,
  )

  // Dimension affichée dans la zone principale
  const activeDim = selectedDimension
    ? referentiel.dimensions.find((d) => d.code === selectedDimension)
    : referentiel.dimensions[0]

  // Filtrage critères
  const criteresFiltres = (activeDim?.criteres ?? []).filter((c) => {
    if (!c.actif) return false
    if (filterEssentiel === 'essential' && !c.essentiel) return false
    if (filterEssentiel === 'standard' && c.essentiel) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const label = (c.libelle[lang] ?? c.libelle.fr).toLowerCase()
      return label.includes(q) || c.code.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div>
      {/* En-tête */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <nav className="flex items-center gap-2 text-xs text-[#454651]/60 mb-2 font-medium tracking-wider uppercase">
            <span>Framework</span>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span>GSAT V{referentiel.version}</span>
          </nav>
          <h1 className="text-3xl font-extrabold text-[#171c22] tracking-tight font-headline">
            {t('pages.referential.title', 'Gestion du Référentiel GSAT')}
          </h1>
          <p className="text-[#454651] mt-1">
            {t('pages.referential.subtitle', `Gérez les ${nbCriteres} critères structurant les ${referentiel.dimensions.length} dimensions stratégiques.`)}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-[#454651] font-semibold flex items-center gap-2 hover:bg-[#e4e8f1] rounded-xl transition-all">
            <span className="material-symbols-outlined text-lg">history</span>
            {t('pages.referential.historique', 'Historique')}
          </button>
          <button className="px-6 py-2 bg-gradient-to-r from-[#15236e] to-[#2e3b85] text-white font-bold rounded-xl shadow-lg shadow-[#15236e]/20 flex items-center gap-2 active:scale-95 transition-all">
            <span className="material-symbols-outlined">publish</span>
            {t('pages.referential.publier', 'Publier les modifications')}
          </button>
        </div>
      </div>

      {/* Barre de stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        {[
          {
            label: t('pages.referential.dimensions', 'Dimensions'),
            value: referentiel.dimensions.length,
            icon: 'view_quilt',
            sub: t('pages.referential.structureComplete', 'Structure complète'),
            color: 'text-[#15236e]',
            iconBg: 'bg-[#15236e]/10 text-[#15236e]',
          },
          {
            label: t('pages.referential.criteresTotaux', 'Critères Totaux'),
            value: nbCriteres,
            icon: 'list_alt',
            sub: `Version ${referentiel.version}`,
            color: 'text-[#15236e]',
            iconBg: 'bg-[#15236e]/10 text-[#15236e]',
          },
          {
            label: t('pages.referential.criteresEssentiels', 'Critères Essentiels'),
            value: nbEssentiels,
            icon: 'verified',
            sub: `${Math.round((nbEssentiels / nbCriteres) * 100)}% du référentiel`,
            color: 'text-[#3b6934]',
            iconBg: 'bg-[#3b6934]/10 text-[#3b6934]',
          },
          {
            label: t('pages.referential.traductions', 'Traductions'),
            value: '98%',
            icon: 'translate',
            sub: t('pages.referential.traductionsInfo', '2 langues actives'),
            color: 'text-[#171c22]',
            iconBg: 'bg-amber-100 text-amber-700',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[#ffffff] p-5 rounded-2xl shadow-sm border border-[#c6c5d2]/10"
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-[#454651] text-sm font-semibold tracking-wide uppercase">
                {stat.label}
              </span>
              <span className={`p-1.5 rounded-lg ${stat.iconBg}`}>
                <span className="material-symbols-outlined text-lg">{stat.icon}</span>
              </span>
            </div>
            <div className={`text-3xl font-bold tracking-tighter ${stat.color}`}>{stat.value}</div>
            <div className="text-[11px] text-[#454651] mt-1 font-medium">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Interface principale : arbre gauche + liste droite */}
      <div className="flex gap-8 items-start">
        {/* Panneau dimensions */}
        <div className="w-72 flex-shrink-0 sticky top-4">
          <div className="bg-[#ffffff] rounded-3xl p-6 shadow-sm border border-[#c6c5d2]/5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-[#15236e] tracking-tight">
                {t('pages.referential.dimensions', 'Dimensions')}
              </h3>
            </div>
            <div className="space-y-1">
              {referentiel.dimensions.map((dim) => {
                const nom = dim.nom[lang] ?? dim.nom.fr
                const isActive = dim.code === selectedDimension
                return (
                  <button
                    key={dim.code}
                    onClick={() => setSelectedDimension(dim.code)}
                    className={`w-full text-left p-4 rounded-xl flex items-center justify-between group transition-all ${
                      isActive
                        ? 'bg-[#15236e]/5 border-l-4 border-[#15236e]'
                        : 'hover:bg-[#f0f4fd] border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isActive
                            ? 'bg-[#15236e] text-white'
                            : 'bg-[#e4e8f1] text-[#454651]'
                        }`}
                      >
                        {dim.code.replace('D', '').padStart(2, '0')}
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
                          {dim.criteres.filter((c) => c.actif).length} Critères
                        </div>
                      </div>
                    </div>
                    <span
                      className={`material-symbols-outlined group-hover:translate-x-1 transition-transform ${
                        isActive ? 'text-[#15236e]' : 'text-[#454651]/30'
                      }`}
                    >
                      chevron_right
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Zone principale critères */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeDim && (
            <>
              {/* Titre dimension + filtres */}
              <div className="flex justify-between items-center bg-[#e4e8f1]/50 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-[#15236e] flex items-center justify-center text-white">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      view_quilt
                    </span>
                  </span>
                  <h2 className="font-bold text-xl text-[#15236e] tracking-tight">
                    Dimension {activeDim.code.replace('D', '')} : {activeDim.nom[lang] ?? activeDim.nom.fr}
                  </h2>
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterEssentiel}
                    onChange={(e) =>
                      setFilterEssentiel(e.target.value as 'all' | 'essential' | 'standard')
                    }
                    className="bg-white border-none rounded-lg text-xs font-semibold px-3 py-2 shadow-sm focus:ring-[#15236e]/20"
                  >
                    <option value="all">{t('pages.referential.tousCriteres', 'Tous les critères')}</option>
                    <option value="essential">{t('pages.referential.essentielsUniquement', 'Essentiels uniquement')}</option>
                    <option value="standard">{t('pages.referential.nonEssentiels', 'Non-essentiels')}</option>
                  </select>
                </div>
              </div>

              {/* Recherche */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#454651] text-sm">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.search', 'Rechercher un critère…')}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#ffffff] border-none rounded-xl text-sm ring-1 ring-[#c6c5d2]/30 focus:ring-2 focus:ring-[#15236e]/20"
                />
              </div>

              {/* Liste critères */}
              {criteresFiltres.length === 0 ? (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-[#c6c5d2] text-4xl">
                    search_off
                  </span>
                  <p className="text-[#454651] text-sm mt-3">
                    {t('pages.referential.aucunCritere', 'Aucun critère ne correspond aux filtres.')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {criteresFiltres.map((critere) => (
                    <DimensionAccordion
                      key={critere.code}
                      dimension={{
                        ...activeDim,
                        criteres: [critere],
                      } as DimensionDef}
                      isActive={false}
                      onEditCriterion={(c) => handleEditCriterion(c, activeDim.code)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal édition */}
      {editCriterion && (
        <CriterionEditModal
          criterion={editCriterion.criterion}
          dimensionCode={editCriterion.dimensionCode}
          referentialVersion="v3_0"
          onClose={() => setEditCriterion(null)}
          onSaved={() => setEditCriterion(null)}
        />
      )}
    </div>
  )
}
