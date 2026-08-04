import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateCriterion } from '@/services/referentialService'
import type { CritereDef } from '@/types'

interface CriterionEditModalProps {
  criterion: CritereDef
  dimensionCode: string
  referentialVersion?: string
  onClose: () => void
  onSaved?: () => void
}

/**
 * Modal édition d'un critère GSAT.
 * Design Stitch : overlay sombre, card blanche rounded-3xl, textarea recessed,
 * toggle essentiel, bouton gradient de confirmation.
 */
export function CriterionEditModal({
  criterion,
  dimensionCode,
  referentialVersion = 'v3_0',
  onClose,
  onSaved,
}: CriterionEditModalProps) {
  const { t } = useTranslation()

  const [libelleFr, setLibelleFr] = useState(criterion.libelle.fr)
  const [libelleEn, setLibelleEn] = useState(criterion.libelle.en)
  const [guideFr, setGuideFr] = useState(criterion.guideInterpretation?.fr ?? '')
  const [guideEn, setGuideEn] = useState(criterion.guideInterpretation?.en ?? '')
  const [essentiel, setEssentiel] = useState(criterion.essentiel)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!libelleFr.trim()) return

    setSaving(true)
    setError(null)
    try {
      await updateCriterion(referentialVersion, dimensionCode, criterion.code, {
        libelle: { fr: libelleFr.trim(), en: libelleEn.trim() },
        guideInterpretation: {
          fr: guideFr.trim(),
          en: guideEn.trim(),
        },
        essentiel,
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  return (
    /* Overlay */
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('pages.referential.editCriterion', 'Modifier le critère')}
    >
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border-2 border-[#15236e]/20 relative">
        {/* Barre de couleur gauche */}
        <div className="absolute top-0 left-0 w-1 h-full bg-[#15236e]" />

        <form onSubmit={handleSubmit}>
          {/* En-tête */}
          <div className="px-8 py-6 flex justify-between items-center border-b border-[#c6c5d2]/10">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#dee0ff] text-[#15236e] flex items-center justify-center font-bold text-sm">
                {criterion.code}
              </span>
              <h3 className="font-bold text-[#15236e] text-lg">
                {t('pages.referential.editCriterion', 'Modifier le critère')}
              </h3>
            </div>
            <div className="flex items-center gap-4">
              {/* Toggle essentiel */}
              <label className="flex items-center cursor-pointer gap-2">
                <span className="text-xs font-bold uppercase tracking-tight text-[#454651]">
                  {t('evaluation.essentiel', 'Essentiel')}
                </span>
                <div className="relative inline-block w-10 h-6">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={essentiel}
                    onChange={(e) => setEssentiel(e.target.checked)}
                  />
                  <div className="w-full h-full bg-[#dee3eb] rounded-full peer peer-checked:bg-[#3b6934] transition-colors" />
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
                </div>
              </label>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-[#eaeef7] rounded-lg text-[#454651] transition-colors"
                aria-label="Fermer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {/* Contenu */}
          <div className="px-8 py-6 space-y-5 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-[#ffdad6] text-[#93000a] rounded-xl text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">warning</span>
                {error}
              </div>
            )}

            {/* Libellé FR */}
            <div>
              <label className="block text-xs font-bold text-[#454651] uppercase mb-2 tracking-wider">
                {t('pages.referential.libelleFr', 'Libellé (FR)')} *
              </label>
              <textarea
                value={libelleFr}
                onChange={(e) => setLibelleFr(e.target.value)}
                required
                rows={3}
                className="w-full bg-[#f0f4fd] border-none rounded-xl p-4 text-sm text-[#171c22] focus:ring-2 focus:ring-[#15236e]/20 resize-none"
                placeholder="Libellé du critère en français…"
              />
            </div>

            {/* Libellé EN */}
            <div>
              <label className="block text-xs font-bold text-[#454651] uppercase mb-2 tracking-wider">
                {t('pages.referential.libelleEn', 'Label (EN)')}
              </label>
              <textarea
                value={libelleEn}
                onChange={(e) => setLibelleEn(e.target.value)}
                rows={3}
                className="w-full bg-[#f0f4fd] border-none rounded-xl p-4 text-sm text-[#171c22] focus:ring-2 focus:ring-[#15236e]/20 resize-none"
                placeholder="Criterion label in English…"
              />
            </div>

            {/* Guide interprétation FR */}
            <div>
              <label className="block text-xs font-bold text-[#454651] uppercase mb-2 tracking-wider">
                {t('pages.referential.guideFr', "Guide d'interprétation (FR)")}
              </label>
              <textarea
                value={guideFr}
                onChange={(e) => setGuideFr(e.target.value)}
                rows={4}
                className="w-full bg-[#f0f4fd] border-none rounded-xl p-4 text-sm text-[#171c22] focus:ring-2 focus:ring-[#15236e]/20 resize-none"
                placeholder="Description et guide pour les évaluateurs…"
              />
            </div>

            {/* Guide interprétation EN */}
            <div>
              <label className="block text-xs font-bold text-[#454651] uppercase mb-2 tracking-wider">
                {t('pages.referential.guideEn', 'Interpretation guide (EN)')}
              </label>
              <textarea
                value={guideEn}
                onChange={(e) => setGuideEn(e.target.value)}
                rows={4}
                className="w-full bg-[#f0f4fd] border-none rounded-xl p-4 text-sm text-[#171c22] focus:ring-2 focus:ring-[#15236e]/20 resize-none"
                placeholder="Description and guide for evaluators…"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-5 border-t border-[#c6c5d2]/10 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-[#454651] font-semibold rounded-xl hover:bg-[#eaeef7] transition-colors"
            >
              {t('common.annuler', 'Annuler')}
            </button>
            <button
              type="submit"
              disabled={saving || !libelleFr.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-[#15236e] to-[#2e3b85] text-white font-bold rounded-xl shadow-lg shadow-[#15236e]/20 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving && (
                <span className="material-symbols-outlined animate-spin text-sm">
                  progress_activity
                </span>
              )}
              <span className="material-symbols-outlined text-sm">save</span>
              {saving
                ? t('common.loading', 'Enregistrement…')
                : t('common.enregistrer', 'Enregistrer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
