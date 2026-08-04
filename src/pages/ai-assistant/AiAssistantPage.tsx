import { ChatCanvas } from '@/components/ai-assistant/ChatCanvas'
import { SmartContextPanel } from '@/components/ai-assistant/SmartContextPanel'

export function AiAssistantPage() {
  return (
    <div className="-m-8 flex h-[calc(100vh-4rem)]">
      {/* Chat canvas — takes remaining space */}
      <ChatCanvas />

      {/* Smart Context panel — right side, hidden below xl */}
      <SmartContextPanel />
    </div>
  )
}
