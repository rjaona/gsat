import { useTranslation } from 'react-i18next'

interface QuickAction {
  icon: string
  labelKey: string
  prompt: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: 'search',
    labelKey: 'aiAssistant.quickActions.analyzeEvidence',
    prompt: 'Analyze Evidence',
  },
  {
    icon: 'school',
    labelKey: 'aiAssistant.quickActions.explainDimension',
    prompt: 'Explain Dimension 3',
  },
  {
    icon: 'star',
    labelKey: 'aiAssistant.quickActions.scoreGuide',
    prompt: 'Score a 3',
  },
  {
    icon: 'help',
    labelKey: 'aiAssistant.quickActions.methodologyFaq',
    prompt: 'Methodology FAQ',
  },
]

interface QuickActionsProps {
  onAction: (prompt: string) => void
  disabled?: boolean | undefined
}

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {QUICK_ACTIONS.map(action => (
        <button
          key={action.labelKey}
          onClick={() => onAction(action.prompt)}
          disabled={disabled}
          className={[
            'flex items-center gap-2.5 px-4 py-3 rounded-xl border border-[#c6c5d2]/20',
            'bg-white hover:bg-[#EDE7F6]/30 hover:border-[#D1C4E9]',
            'transition-all duration-200 text-left group',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          ].join(' ')}
        >
          <span className="material-symbols-outlined text-[20px] text-[#4B2E83] group-hover:scale-110 transition-transform">
            {action.icon}
          </span>
          <span className="text-sm font-medium text-[#454651]">
            {t(action.labelKey)}
          </span>
        </button>
      ))}
    </div>
  )
}
