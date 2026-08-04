import { useTranslation } from 'react-i18next'

const SCORE_LEVELS = [
  { score: 0, color: '#E53935', bgColor: '#FFEBEE' },
  { score: 1, color: '#FB8C00', bgColor: '#FFF3E0' },
  { score: 2, color: '#43A047', bgColor: '#E8F5E9' },
  { score: 3, color: '#1E88E5', bgColor: '#E3F2FD' },
] as const

export function ScoringRubric() {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[#767682] mb-3">
        {t('aiAssistant.context.scoringRubric')}
      </h4>

      {SCORE_LEVELS.map(level => (
        <div
          key={level.score}
          className="flex items-start gap-2.5 p-2.5 rounded-lg transition-colors hover:bg-[#f8f9ff]"
        >
          {/* Score badge */}
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
            style={{ backgroundColor: level.bgColor, color: level.color }}
          >
            {level.score}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-[#1c1b1f]">
              {t(`aiAssistant.context.score${String(level.score)}Label`)}
            </p>
            <p className="text-[11px] text-[#767682] leading-snug mt-0.5">
              {t(`aiAssistant.context.score${String(level.score)}Desc`)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
