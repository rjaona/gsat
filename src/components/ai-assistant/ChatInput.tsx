import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean | undefined
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    // Auto-resize
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${String(Math.min(el.scrollHeight, 160))}px`
  }, [])

  return (
    <div className="sticky bottom-0 px-4 pb-4 pt-2">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-[#c6c5d2]/15 p-3">
        <div className="flex items-end gap-2">
          {/* Attach file button */}
          <button
            className="p-2 rounded-lg hover:bg-[#EDE7F6]/50 transition-colors shrink-0 mb-0.5"
            aria-label={t('aiAssistant.input.attach')}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px] text-[#767682]">
              attach_file
            </span>
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={t('aiAssistant.input.placeholder')}
            disabled={disabled}
            rows={1}
            className={[
              'flex-1 resize-none border-0 outline-none bg-transparent',
              'text-sm text-[#1c1b1f] placeholder:text-[#767682]/60',
              'py-2 max-h-40 leading-relaxed',
              'disabled:opacity-50',
            ].join(' ')}
          />

          {/* Mic button */}
          <button
            className="p-2 rounded-lg hover:bg-[#EDE7F6]/50 transition-colors shrink-0 mb-0.5"
            aria-label={t('aiAssistant.input.voice')}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px] text-[#767682]">
              mic
            </span>
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className={[
              'p-2.5 rounded-xl transition-all duration-200 shrink-0 mb-0.5',
              value.trim() && !disabled
                ? 'bg-[#4B2E83] text-white shadow-md hover:shadow-lg hover:bg-[#3a2368]'
                : 'bg-[#EDE7F6]/50 text-[#767682] cursor-not-allowed',
            ].join(' ')}
            aria-label={t('aiAssistant.input.send')}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              send
            </span>
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-[#767682]/60 text-center mt-2 px-2">
          {t('aiAssistant.disclaimer')}
        </p>
      </div>
    </div>
  )
}
