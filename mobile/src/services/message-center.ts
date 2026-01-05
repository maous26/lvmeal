/**
 * MessageCenter - Unified Communication Service
 *
 * Single source of truth for ALL user-facing messages in LYM.
 * Replaces fragmented communication (LymIA widget, CoachInsights, alerts, notifications).
 *
 * Principles:
 * - 1 coach (LymIA), 1 voice, 1 priority message at a time
 * - Clear hierarchy: P0 (urgent) → P3 (tips)
 * - Consistent tone: bienveillant, jamais culpabilisant
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ============= TYPES =============

export type MessagePriority = 'P0' | 'P1' | 'P2' | 'P3'
export type MessageType = 'alert' | 'action' | 'celebration' | 'tip' | 'insight'
export type MessageCategory =
  | 'nutrition'
  | 'hydration'
  | 'sleep'
  | 'sport'
  | 'stress'
  | 'progress'
  | 'wellness'
  | 'system'

export interface LymiaMessage {
  id: string
  priority: MessagePriority
  type: MessageType
  category: MessageCategory
  title: string
  message: string
  emoji?: string
  actionLabel?: string
  actionRoute?: string
  createdAt: string
  expiresAt?: string // Auto-dismiss after this time
  read: boolean
  dismissed: boolean
}

// Priority config
export const PRIORITY_CONFIG: Record<MessagePriority, {
  color: string
  vibrate: boolean
  persistent: boolean
  maxAge: number // hours
}> = {
  P0: { color: '#EF4444', vibrate: true, persistent: true, maxAge: 24 },   // Red - urgent
  P1: { color: '#F97316', vibrate: false, persistent: true, maxAge: 12 },  // Orange - action needed
  P2: { color: '#22C55E', vibrate: false, persistent: false, maxAge: 8 },  // Green - celebration
  P3: { color: '#3B82F6', vibrate: false, persistent: false, maxAge: 4 },  // Blue - tip
}

// Category emojis
export const CATEGORY_EMOJI: Record<MessageCategory, string> = {
  nutrition: '🥗',
  hydration: '💧',
  sleep: '😴',
  sport: '💪',
  stress: '🧘',
  progress: '📈',
  wellness: '❤️',
  system: '⚙️',
}

// ============= STORE =============

interface MessageCenterState {
  messages: LymiaMessage[]
  lastShownId: string | null

  // Actions
  addMessage: (message: Omit<LymiaMessage, 'id' | 'createdAt' | 'read' | 'dismissed'>) => string
  markAsRead: (id: string) => void
  dismiss: (id: string) => void
  dismissAll: () => void
  clearExpired: () => void

  // Getters
  getActiveMessages: () => LymiaMessage[]
  getPriorityMessage: () => LymiaMessage | null
  getUnreadCount: () => number
}

export const useMessageCenter = create<MessageCenterState>()(
  persist(
    (set, get) => ({
      messages: [],
      lastShownId: null,

      addMessage: (messageData) => {
        const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const config = PRIORITY_CONFIG[messageData.priority]

        const message: LymiaMessage = {
          ...messageData,
          id,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + config.maxAge * 60 * 60 * 1000).toISOString(),
          read: false,
          dismissed: false,
        }

        set((state) => ({
          messages: [message, ...state.messages].slice(0, 50), // Keep max 50 messages
        }))

        return id
      },

      markAsRead: (id) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, read: true } : m
          ),
          lastShownId: id,
        }))
      },

      dismiss: (id) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, dismissed: true } : m
          ),
        }))
      },

      dismissAll: () => {
        set((state) => ({
          messages: state.messages.map((m) => ({ ...m, dismissed: true })),
        }))
      },

      clearExpired: () => {
        const now = new Date().toISOString()
        set((state) => ({
          messages: state.messages.filter((m) => {
            if (m.dismissed) return false
            if (m.expiresAt && m.expiresAt < now) return false
            return true
          }),
        }))
      },

      getActiveMessages: () => {
        const now = new Date().toISOString()
        return get().messages.filter((m) => {
          if (m.dismissed) return false
          if (m.expiresAt && m.expiresAt < now) return false
          return true
        })
      },

      getPriorityMessage: () => {
        const active = get().getActiveMessages()
        if (active.length === 0) return null

        // Sort by priority (P0 first), then by date (newest first)
        const sorted = [...active].sort((a, b) => {
          const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 }
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority]
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })

        return sorted[0]
      },

      getUnreadCount: () => {
        return get().getActiveMessages().filter((m) => !m.read).length
      },
    }),
    {
      name: 'lym-message-center',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        messages: state.messages.slice(0, 20), // Persist only last 20
        lastShownId: state.lastShownId,
      }),
    }
  )
)

// ============= MESSAGE GENERATORS =============

/**
 * Generate contextual messages based on user data
 */
export function generateDailyMessages(userData: {
  caloriesConsumed: number
  caloriesTarget: number
  proteinsPercent: number
  waterPercent: number
  sleepHours: number | null
  streak: number
  lastMealTime: Date | null
  plaisirAvailable: number
  plaisirUsed: number
}): Omit<LymiaMessage, 'id' | 'createdAt' | 'read' | 'dismissed'>[] {
  const messages: Omit<LymiaMessage, 'id' | 'createdAt' | 'read' | 'dismissed'>[] = []
  const now = new Date()
  const hour = now.getHours()

  // P0: No meal for 8+ hours (during daytime)
  if (userData.lastMealTime && hour >= 8 && hour <= 22) {
    const hoursSinceLastMeal = (now.getTime() - userData.lastMealTime.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastMeal >= 8) {
      messages.push({
        priority: 'P0',
        type: 'alert',
        category: 'nutrition',
        title: 'Tu as faim ?',
        message: `Ca fait ${Math.round(hoursSinceLastMeal)}h que tu n'as rien mange. Prends soin de toi !`,
        emoji: '🍽️',
        actionLabel: 'Ajouter un repas',
        actionRoute: 'AddMeal',
      })
    }
  }

  // P1: Low protein (< 50% at dinner time)
  if (hour >= 18 && userData.proteinsPercent < 50) {
    messages.push({
      priority: 'P1',
      type: 'action',
      category: 'nutrition',
      title: 'Proteines a rattraper',
      message: `Tu es a ${userData.proteinsPercent}% de ton objectif proteines. Pense a en ajouter ce soir.`,
      emoji: '🥩',
    })
  }

  // P1: Low hydration
  if (userData.waterPercent < 40 && hour >= 14) {
    messages.push({
      priority: 'P1',
      type: 'action',
      category: 'hydration',
      title: 'Hydrate-toi',
      message: `Seulement ${userData.waterPercent}% de ton objectif eau. Un verre d'eau ?`,
      emoji: '💧',
    })
  }

  // P2: Streak celebration
  if (userData.streak > 0 && userData.streak % 7 === 0) {
    messages.push({
      priority: 'P2',
      type: 'celebration',
      category: 'progress',
      title: `${userData.streak} jours de suite !`,
      message: 'Ta regularite est impressionnante. Continue comme ca !',
      emoji: '🔥',
    })
  }

  // P2: Good sleep
  if (userData.sleepHours && userData.sleepHours >= 7) {
    messages.push({
      priority: 'P2',
      type: 'celebration',
      category: 'sleep',
      title: 'Belle nuit !',
      message: `${userData.sleepHours}h de sommeil. Ton corps te remercie.`,
      emoji: '😴',
    })
  }

  // P2: Plaisir available
  if (userData.plaisirAvailable > 0 && userData.plaisirUsed < 2) {
    messages.push({
      priority: 'P2',
      type: 'tip',
      category: 'nutrition',
      title: 'Repas plaisir disponible',
      message: `+${userData.plaisirAvailable} kcal bonus cette semaine. Fais-toi plaisir !`,
      emoji: '🎁',
    })
  }

  // P3: Morning tip
  if (hour >= 7 && hour <= 9) {
    messages.push({
      priority: 'P3',
      type: 'tip',
      category: 'wellness',
      title: 'Bien commencer',
      message: 'Un verre d\'eau au reveil aide ton metabolisme a demarrer.',
      emoji: '☀️',
    })
  }

  // P3: Bad sleep
  if (userData.sleepHours && userData.sleepHours < 6) {
    messages.push({
      priority: 'P3',
      type: 'tip',
      category: 'sleep',
      title: 'Sommeil leger',
      message: `${userData.sleepHours}h seulement. Essaie de te coucher plus tot ce soir.`,
      emoji: '🌙',
    })
  }

  return messages
}

// ============= TOAST HELPER =============

/**
 * Simple toast messages (replaces Alert.alert for non-critical feedback)
 */
export interface ToastMessage {
  type: 'success' | 'error' | 'info'
  message: string
  duration?: number
}

let toastCallback: ((toast: ToastMessage) => void) | null = null

export function setToastHandler(callback: (toast: ToastMessage) => void) {
  toastCallback = callback
}

export function showToast(toast: ToastMessage) {
  if (toastCallback) {
    toastCallback(toast)
  } else {
    console.log('[Toast]', toast.type, toast.message)
  }
}

// Convenience methods
export const toast = {
  success: (message: string) => showToast({ type: 'success', message, duration: 2000 }),
  error: (message: string) => showToast({ type: 'error', message, duration: 3000 }),
  info: (message: string) => showToast({ type: 'info', message, duration: 2500 }),
}

export default {
  useMessageCenter,
  generateDailyMessages,
  toast,
  PRIORITY_CONFIG,
  CATEGORY_EMOJI,
}
