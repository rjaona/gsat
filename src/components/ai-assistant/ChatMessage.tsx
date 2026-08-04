import type { ChatMessage as ChatMessageType } from '@/stores/aiChatStore'

interface ChatMessageProps {
  message: ChatMessageType
}

// ── Simple markdown-like renderer ────────────────────────────────────────────

function renderContent(content: string): React.ReactNode {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let inList = false

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${String(elements.length)}`} className="space-y-1.5 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[#454651]">
              <span className="material-symbols-outlined text-[14px] text-[#4B2E83] mt-0.5 shrink-0">
                check_circle
              </span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            </li>
          ))}
        </ul>,
      )
      listItems = []
    }
    inList = false
  }

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  function formatInline(text: string): string {
    // Escape HTML entities FIRST to prevent XSS, then apply markdown formatting
    let result = escapeHtml(text)
    // Bold: **text**
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-[#1c1b1f]">$1</strong>')
    // Italic: *text*
    result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Inline code: `text`
    result = result.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-[#EDE7F6]/50 rounded text-[#4B2E83] text-xs font-mono">$1</code>')
    return result
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    // Empty line
    if (trimmed === '') {
      flushList()
      continue
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h5 key={`h5-${String(i)}`} className="font-semibold text-sm text-[#1c1b1f] mt-3 mb-1"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(4)) }}
        />,
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h4 key={`h4-${String(i)}`} className="font-bold text-[15px] text-[#1c1b1f] mt-3 mb-1.5"
          dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(3)) }}
        />,
      )
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList()
      elements.push(
        <div key={`bq-${String(i)}`} className="border-l-[3px] border-[#4B2E83] bg-[#EDE7F6]/30 px-3 py-2 rounded-r-lg my-2">
          <p className="text-sm text-[#454651]"
            dangerouslySetInnerHTML={{ __html: formatInline(trimmed.slice(2)) }}
          />
        </div>,
      )
      continue
    }

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList()
      // Separator row
      if (trimmed.match(/^\|[\s-|]+\|$/)) continue

      const cells = trimmed.split('|').filter(c => c.trim() !== '')
      const isHeader = i + 1 < lines.length && (lines[i + 1] ?? '').trim().match(/^\|[\s-|]+\|$/)

      elements.push(
        <div key={`tr-${String(i)}`} className={[
          'grid gap-2 px-2 py-1.5 text-xs border-b border-[#c6c5d2]/15',
          isHeader ? 'font-semibold text-[#1c1b1f] bg-[#EDE7F6]/20' : 'text-[#454651]',
        ].join(' ')}
          style={{ gridTemplateColumns: `repeat(${String(cells.length)}, 1fr)` }}
        >
          {cells.map((cell, ci) => (
            <span key={ci} dangerouslySetInnerHTML={{ __html: formatInline(cell.trim()) }} />
          ))}
        </div>,
      )
      continue
    }

    // List item
    if (trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
      inList = true
      const text = trimmed.replace(/^[-]\s+/, '').replace(/^\d+\.\s+/, '')
      listItems.push(text)
      continue
    }

    // Regular paragraph
    flushList()
    elements.push(
      <p key={`p-${String(i)}`} className="text-sm text-[#454651] leading-relaxed my-1"
        dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
      />,
    )
  }

  flushList()
  return elements
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-[#4B2E83] text-white px-4 py-3 rounded-2xl rounded-tr-md shadow-sm">
          <p className="text-sm leading-relaxed">{message.content}</p>
          <p className="text-[10px] text-white/50 mt-1.5 text-right">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex items-start gap-3 mb-4">
      {/* AI avatar */}
      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center mt-0.5"
        style={{ background: 'linear-gradient(135deg, #4B2E83 0%, #6B4FA3 100%)' }}
      >
        <span className="material-symbols-outlined text-[18px] text-[#FDB714]">
          auto_awesome
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl rounded-tl-md p-4 shadow-sm border border-[#c6c5d2]/10">
          {renderContent(message.content)}
          <p className="text-[10px] text-[#767682]/50 mt-2">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  )
}
