/**
 * Chat Store - LymIA Coach Conversations
 *
 * Manages:
 * - Chat history with LymIA
 * - Message states (sending, sent, error)
 * - Suggested actions and quick replies
 * - Sync with Supabase when available
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { saveChatMessage, getChatHistory, clearChatHistory, isSupabaseConfigured } from '../services/supabase-client'

// ============= TYPES =============

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  status: 'sending' | 'sent' | 'error'
  sources?: Array<{
    title: string
    source: string
    relevance: number
  }>
  suggestedActions?: string[]
  mealSource?: 'gustar' | 'ciqual' | 'off' | 'ai'
  contextUsed?: {
    categories: string[]
    knowledgeIds: string[]
  }
}

export interface QuickReply {
  id: string
  label: string
  prompt: string
  category: 'nutrition' | 'wellness' | 'sport' | 'plan' | 'general'
}

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isSyncing: boolean
  userId: string | null
  lastSyncAt: string | null
  quickReplies: QuickReply[]

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  deleteMessage: (id: string) => void
  clearMessages: () => Promise<void>
  setLoading: (loading: boolean) => void
  setUserId: (userId: string) => void

  // Sync
  syncWithServer: () => Promise<void>
  loadFromServer: () => Promise<void>

  // Quick replies
  getQuickReplies: (category?: QuickReply['category']) => QuickReply[]
}

// Default quick replies
const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  // Nutrition
  {
    id: 'qr-1',
    label: 'Que manger ce soir ?',
    prompt: 'Suggere-moi un diner equilibre pour ce soir en fonction de ce que j\'ai mange aujourd\'hui.',
    category: 'nutrition',
  },
  {
    id: 'qr-2',
    label: 'Analyser mon alimentation',
    prompt: 'Analyse mon alimentation de la semaine et donne-moi des conseils.',
    category: 'nutrition',
  },
  {
    id: 'qr-3',
    label: 'Recette rapide',
    prompt: 'Propose-moi une recette saine qui prend moins de 20 minutes.',
    category: 'nutrition',
  },

  // Wellness
  {
    id: 'qr-4',
    label: 'Ameliorer mon sommeil',
    prompt: 'Comment puis-je ameliorer la qualite de mon sommeil ?',
    category: 'wellness',
  },
  {
    id: 'qr-5',
    label: 'Gerer mon stress',
    prompt: 'Donne-moi des techniques pour mieux gerer mon stress au quotidien.',
    category: 'wellness',
  },

  // Sport
  {
    id: 'qr-6',
    label: 'Exercice du jour',
    prompt: 'Quel exercice me recommandes-tu aujourd\'hui en fonction de mon programme ?',
    category: 'sport',
  },
  {
    id: 'qr-7',
    label: 'Recuperation',
    prompt: 'Comment optimiser ma recuperation apres l\'entrainement ?',
    category: 'sport',
  },

  // Plan
  {
    id: 'qr-8',
    label: 'Mon plan repas',
    prompt: 'Genere-moi un plan repas pour les 3 prochains jours.',
    category: 'plan',
  },
  {
    id: 'qr-9',
    label: 'Liste de courses',
    prompt: 'Cree une liste de courses pour ma semaine.',
    category: 'plan',
  },

  // General
  {
    id: 'qr-10',
    label: 'Mon progres',
    prompt: 'Resume mes progres de la semaine.',
    category: 'general',
  },
  {
    id: 'qr-11',
    label: 'Conseils personnalises',
    prompt: 'Quels sont tes conseils personnalises pour moi aujourd\'hui ?',
    category: 'general',
  },
]

// ============= STORE =============

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      isSyncing: false,
      userId: null,
      lastSyncAt: null,
      quickReplies: DEFAULT_QUICK_REPLIES,

      addMessage: (message) => {
        const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newMessage: ChatMessage = {
          ...message,
          id,
          timestamp: new Date().toISOString(),
        }

        set((state) => ({
          messages: [...state.messages, newMessage],
        }))

        // Sync to server if configured
        const { userId } = get()
        if (isSupabaseConfigured() && userId) {
          saveChatMessage(userId, message.role, message.content, message.contextUsed ? {
            sources: message.sources?.map(s => s.source) || [],
            knowledge_ids: message.contextUsed.knowledgeIds,
            meal_source: message.mealSource,
          } : undefined).catch(console.warn)
        }

        return id
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        }))
      },

      deleteMessage: (id) => {
        set((state) => ({
          messages: state.messages.filter((msg) => msg.id !== id),
        }))
      },

      clearMessages: async () => {
        const { userId } = get()

        // Clear server if configured
        if (isSupabaseConfigured() && userId) {
          await clearChatHistory(userId)
        }

        set({ messages: [], lastSyncAt: null })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setUserId: (userId) => {
        set({ userId })
      },

      syncWithServer: async () => {
        const { userId, messages } = get()
        if (!isSupabaseConfigured() || !userId) return

        set({ isSyncing: true })

        try {
          // Upload any messages not yet synced
          // For simplicity, we just mark sync time
          // In production, implement proper sync logic
          set({ lastSyncAt: new Date().toISOString(), isSyncing: false })
        } catch (error) {
          console.warn('Chat sync error:', error)
          set({ isSyncing: false })
        }
      },

      loadFromServer: async () => {
        const { userId } = get()
        if (!isSupabaseConfigured() || !userId) return

        set({ isSyncing: true })

        try {
          const serverMessages = await getChatHistory(userId, 100)

          if (serverMessages.length > 0) {
            // Convert server messages to local format
            const localMessages: ChatMessage[] = serverMessages.map((msg) => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content,
              timestamp: msg.created_at,
              status: 'sent' as const,
              sources: msg.context_used?.sources?.map((s: string) => ({
                title: s,
                source: s,
                relevance: 0.8,
              })),
              mealSource: msg.context_used?.meal_source,
            }))

            set({ messages: localMessages, lastSyncAt: new Date().toISOString() })
          }
        } catch (error) {
          console.warn('Failed to load chat history:', error)
        } finally {
          set({ isSyncing: false })
        }
      },

      getQuickReplies: (category) => {
        const { quickReplies } = get()
        if (!category) return quickReplies
        return quickReplies.filter((qr) => qr.category === category)
      },
    }),
    {
      name: 'lymia-chat-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        messages: state.messages.slice(-100), // Keep last 100 messages
        userId: state.userId,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
)

// ============= SELECTORS =============

export const selectRecentMessages = (state: ChatState, count: number = 10) =>
  state.messages.slice(-count)

export const selectMessagesByDate = (state: ChatState, date: string) =>
  state.messages.filter((msg) => msg.timestamp.startsWith(date))

export const selectUnreadCount = (state: ChatState) =>
  state.messages.filter(
    (msg) => msg.role === 'assistant' && msg.status === 'sent'
  ).length

export default useChatStore
