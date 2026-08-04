import { create } from 'zustand'
import { subscribeDashboardStats } from '@/services/dashboardService'
import type { DashboardStats } from '@/types'

// ── Types locaux ──────────────────────────────────────────────────────────────

interface DashboardOsnState {
  stats: DashboardStats | null
  loading: boolean
  error: string | null
  osnId: string | null

  // Actions
  subscribe: (osnId: string) => () => void
  reset: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDashboardOsnStore = create<DashboardOsnState>((set, get) => ({
  stats: null,
  loading: false,
  error: null,
  osnId: null,

  subscribe: (osnId: string) => {
    // Évite de re-souscrire si déjà abonné au même OSN
    if (get().osnId === osnId && get().stats !== null) {
      return () => {}
    }

    set({ loading: true, error: null, osnId })

    const unsubscribe = subscribeDashboardStats(
      osnId,
      (stats) => set({ stats, loading: false, error: null }),
      (err) => {
        console.error('[dashboardOsnStore] subscribe error:', err)
        set({ error: err.message, loading: false })
      },
    )

    return unsubscribe
  },

  reset: () => set({ stats: null, loading: false, error: null, osnId: null }),
}))
