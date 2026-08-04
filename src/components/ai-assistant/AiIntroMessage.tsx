import { useTranslation } from 'react-i18next'
import { QuickActions } from './QuickActions'

interface AiIntroMessageProps {
  onQuickAction: (prompt: string) => void
  disabled?: boolean | undefined
}

export function AiIntroMessage({ onQuickAction, disabled }: AiIntroMessageProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-start gap-3 mb-6">
      {/* AI avatar */}
      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #4B2E83 0%, #6B4FA3 100%)' }}
      >
        <span className="material-symbols-outlined text-[18px] text-[#FDB714]">
          auto_awesome
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Intro card */}
        <div className="bg-white rounded-2xl rounded-tl-md p-5 shadow-sm border border-[#c6c5d2]/10">
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[20px] text-[#FDB714]">
              rocket_launch
            </span>
            <h3 className="font-headline font-bold text-[#1c1b1f] text-base">
              {t('aiAssistant.intro.title')}
            </h3>
          </div>
          <p className="text-sm text-[#454651] leading-relaxed mb-1">
            {t('aiAssistant.intro.description')}
          </p>
          <p className="text-sm text-[#767682] leading-relaxed">
            {t('aiAssistant.intro.suggestion')}
          </p>

          <QuickActions onAction={onQuickAction} disabled={disabled} />
        </div>
      </div>
    </div>
  )
}
