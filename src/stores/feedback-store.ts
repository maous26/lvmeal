import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface FeedbackEntry {
  id: string
  type: 'coach_advice' | 'recipe_suggestion' | 'meal_plan' | 'insight'
  contentId: string
  rating: 'helpful' | 'not_helpful'
  timestamp: string
}

interface FeedbackState {
  // Data
  entries: FeedbackEntry[]
  
  // Actions
  addFeedback: (type: FeedbackEntry['type'], contentId: string, rating: FeedbackEntry['rating']) => void
  getFeedbackForContent: (contentId: string) => FeedbackEntry | null
  getHelpfulRate: () => number
  getRecentFeedback: (limit?: number) => FeedbackEntry[]
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      entries: [],

      addFeedback: (type, contentId, rating) => {
        set((state) => {
          // Update existing or add new
          const existing = state.entries.findIndex(e => e.contentId === contentId)
          const entry: FeedbackEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            type,
            contentId,
            rating,
            timestamp: new Date().toISOString(),
          }

          if (existing >= 0) {
            const updated = [...state.entries]
            updated[existing] = entry
            return { entries: updated }
          }

          // Keep last 200 entries
          return { entries: [...state.entries, entry].slice(-200) }
        })
      },

      getFeedbackForContent: (contentId) => {
        return get().entries.find(e => e.contentId === contentId) || null
      },

      getHelpfulRate: () => {
        const { entries } = get()
        if (entries.length === 0) return 0
        const helpful = entries.filter(e => e.rating === 'helpful').length
        return Math.round((helpful / entries.length) * 100)
      },

      getRecentFeedback: (limit = 20) => {
        return get().entries.slice(-limit)
      },
    }),
    {
      name: 'presence-feedback',
      partialize: (state) => ({
        entries: state.entries,
      }),
    }
  )
)
