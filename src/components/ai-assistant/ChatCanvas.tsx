import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAiChatStore } from '@/stores/aiChatStore'
import { AiIntroMessage } from './AiIntroMessage'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'

export function ChatCanvas() {
  const { t } = useTranslation()
  const messages = useAiChatStore(s => s.messages)
  const isLoading = useAiChatStore(s => s.isLoading)
  const error = useAiChatStore(s => s.error)
  const sendMessage = useAiChatStore(s => s.sendMessage)
  const clearError = useAiChatStore(s => s.clearError)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, isLoading])

  const handleSend = (content: string) => {
    void sendMessage(content)
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Chat header */}
      <div className="px-6 py-3 border-b border-[#c6c5d2]/15 bg-white/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4B2E83 0%, #6B4FA3 100%)' }}
            >
              <span className="material-symbols-outlined text-[16px] text-[#FDB714]">
                auto_awesome
              </span>
            </div>
            <div>
              <h2 className="font-headline font-bold text-[15px] text-[#1c1b1f]">
                {t('aiAssistant.title')}
              </h2>
              <p className="text-[11px] text-[#767682]">
                {t('aiAssistant.subtitle')}
              </p>
            </div>
          </div>

          {/* Tab pills */}
          <div className="hidden md:flex items-center bg-[#EDE7F6]/40 rounded-full p-0.5">
            {['reference', 'analysis', 'evaluation'].map((tab, i) => (
              <button
                key={tab}
                className={[
                  'px-3.5 py-1.5 text-xs font-medium rounded-full transition-all duration-200',
                  i === 0
                    ? 'bg-white text-[#4B2E83] shadow-sm font-semibold'
                    : 'text-[#767682] hover:text-[#4B2E83]',
                ].join(' ')}
              >
                {t(`aiAssistant.tabs.${tab}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {/* Intro message (always shown) */}
        <AiIntroMessage onQuickAction={handleSend} disabled={isLoading} />

        {/* Chat messages */}
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4B2E83 0%, #6B4FA3 100%)' }}
            >
              <span className="material-symbols-outlined text-[18px] text-[#FDB714]">
                auto_awesome
              </span>
            </div>
            <div className="bg-white rounded-2xl rounded-tl-md px-5 py-4 shadow-sm border border-[#c6c5d2]/10">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#4B2E83] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[#4B2E83] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[#4B2E83] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-[#767682]">{t('aiAssistant.thinking')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <span className="material-symbols-outlined text-[18px] text-red-500">error</span>
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 transition-colors"
              aria-label={t('common.close')}
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  )
}
