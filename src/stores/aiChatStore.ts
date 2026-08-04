import { create } from 'zustand'
import { generateAiResponse } from '@/services/aiService'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  context?: {
    dimensionCode?: string | undefined
    criterionCode?: string | undefined
  } | undefined
}

interface AiChatState {
  messages: ChatMessage[]
  isLoading: boolean
  currentDimension: string | null
  currentCriterion: string | null
  error: string | null

  // Actions
  sendMessage: (content: string) => Promise<void>
  setContext: (dim: string, criterion: string) => void
  clearChat: () => void
  clearError: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useAiChatStore = create<AiChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  currentDimension: null,
  currentCriterion: null,
  error: null,

  sendMessage: async (content: string) => {
    const { messages, currentDimension, currentCriterion } = get()

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
      context: currentDimension
        ? { dimensionCode: currentDimension, criterionCode: currentCriterion ?? undefined }
        : undefined,
    }

    set({
      messages: [...messages, userMessage],
      isLoading: true,
      error: null,
    })

    try {
      const response = await generateAiResponse(
        [...messages, userMessage],
        currentDimension,
        currentCriterion,
      )

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        context: currentDimension
          ? { dimensionCode: currentDimension, criterionCode: currentCriterion ?? undefined }
          : undefined,
      }

      set(state => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }))
    } catch (err) {
      set({
        isLoading: false,
        error: (err as Error).message,
      })
    }
  },

  setContext: (dim: string, criterion: string) => {
    set({ currentDimension: dim, currentCriterion: criterion })
  },

  clearChat: () => {
    set({
      messages: [],
      isLoading: false,
      error: null,
    })
  },

  clearError: () => {
    set({ error: null })
  },
}))
