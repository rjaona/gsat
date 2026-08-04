import { useTranslation } from 'react-i18next'
import { useAiChatStore } from '@/stores/aiChatStore'
import { ScoringRubric } from './ScoringRubric'
import referentielData from '@/data/referentiel_v3_0.json'
import type { Referentiel } from '@/types'

export function SmartContextPanel() {
  const { t, i18n } = useTranslation()
  const currentDimension = useAiChatStore(s => s.currentDimension)
  const currentCriterion = useAiChatStore(s => s.currentCriterion)
  const setContext = useAiChatStore(s => s.setContext)

  const ref = referentielData as Referentiel
  const lang = i18n.language === 'fr' ? 'fr' : 'en'

  const dim = currentDimension
    ? ref.dimensions.find(d => d.code === currentDimension)
    : null

  const crit = dim && currentCriterion
    ? dim.criteres.find(c => c.code === currentCriterion)
    : null

  return (
    <aside className="w-80 shrink-0 hidden xl:flex flex-col h-full border-l border-[#c6c5d2]/15 bg-white overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-[#c6c5d2]/15">
        <div className="flex items-center justify-between">
          <h3 className="font-headline font-bold text-[15px] text-[#1c1b1f]">
            {t('aiAssistant.context.title')}
          </h3>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50] animate-pulse" />
            LIVE
          </span>
        </div>
      </div>

      {/* Current Focus */}
      <div className="p-4 border-b border-[#c6c5d2]/15">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#767682] mb-3">
          {t('aiAssistant.context.currentFocus')}
        </h4>

        {/* Dimension selector */}
        <div className="mb-3">
          <label className="text-[11px] font-medium text-[#767682] mb-1 block">
            {t('aiAssistant.context.dimension')}
          </label>
          <select
            value={currentDimension ?? ''}
            onChange={e => setContext(e.target.value, '')}
            className="w-full text-sm border border-[#c6c5d2]/30 rounded-lg px-3 py-2 bg-white text-[#1c1b1f] outline-none focus:border-[#4B2E83] focus:ring-1 focus:ring-[#4B2E83]/20 transition-colors"
          >
            <option value="">{t('aiAssistant.context.selectDimension')}</option>
            {ref.dimensions.map(d => (
              <option key={d.code} value={d.code}>
                {d.code} — {d.nom[lang]}
              </option>
            ))}
          </select>
        </div>

        {/* Criterion selector */}
        {dim && (
          <div>
            <label className="text-[11px] font-medium text-[#767682] mb-1 block">
              {t('aiAssistant.context.criterion')}
            </label>
            <select
              value={currentCriterion ?? ''}
              onChange={e => setContext(currentDimension ?? '', e.target.value)}
              className="w-full text-sm border border-[#c6c5d2]/30 rounded-lg px-3 py-2 bg-white text-[#1c1b1f] outline-none focus:border-[#4B2E83] focus:ring-1 focus:ring-[#4B2E83]/20 transition-colors"
            >
              <option value="">{t('aiAssistant.context.allCriteria')}</option>
              {dim.criteres.filter(c => c.actif).map(c => (
                <option key={c.code} value={c.code}>
                  {c.code}{c.essentiel ? ' *' : ''} — {c.libelle[lang].slice(0, 60)}...
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Current criterion detail */}
        {crit && (
          <div className="mt-3 p-3 bg-[#EDE7F6]/30 rounded-lg border border-[#D1C4E9]/30">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs font-bold text-[#4B2E83]">{crit.code}</span>
              {crit.essentiel && (
                <span className="px-1.5 py-0.5 bg-[#FDB714]/15 text-[#7A5800] text-[9px] font-bold rounded uppercase">
                  {t('evaluation.essentiel')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#454651] leading-snug">
              {crit.libelle[lang]}
            </p>
          </div>
        )}
      </div>

      {/* Scoring Rubric */}
      <div className="p-4 border-b border-[#c6c5d2]/15">
        <ScoringRubric />
      </div>

      {/* Pro Tip */}
      <div className="p-4">
        <div className="p-3.5 bg-[#EDE7F6]/30 rounded-xl border border-[#D1C4E9]/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[16px] text-[#4B2E83]">
              lightbulb
            </span>
            <span className="text-xs font-bold text-[#4B2E83] uppercase tracking-wider">
              {t('aiAssistant.context.proTip')}
            </span>
          </div>
          <p className="text-[11px] text-[#454651] leading-relaxed">
            {t('aiAssistant.context.proTipContent')}
          </p>
        </div>
      </div>
    </aside>
  )
}
