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
  // Nouveaux champs pour transparence et dedup
  reason?: string // Pourquoi ce message est généré (ex: "8h sans repas")
  confidence?: number // 0-1, confiance dans la pertinence
  dedupKey?: string // Clé pour éviter doublons (ex: "nutrition-8h-alert")
}

// Priority config - P0 = vraiment urgent (rare), vibrations seulement P0
export const PRIORITY_CONFIG: Record<MessagePriority, {
  color: string
  vibrate: boolean
  persistent: boolean
  maxAge: number // hours
  cooldown: number // heures avant de pouvoir renvoyer un message similaire
}> = {
  P0: { color: '#EF4444', vibrate: true, persistent: true, maxAge: 24, cooldown: 24 },   // Red - urgent (rare!)
  P1: { color: '#F97316', vibrate: false, persistent: true, maxAge: 12, cooldown: 8 },   // Orange - action needed
  P2: { color: '#22C55E', vibrate: false, persistent: false, maxAge: 8, cooldown: 24 },  // Green - celebration
  P3: { color: '#3B82F6', vibrate: false, persistent: false, maxAge: 4, cooldown: 4 },   // Blue - tip
}

// Cooldown tracking pour éviter spam
interface CooldownEntry {
  dedupKey: string
  lastSentAt: string
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

// ============= USER PREFERENCES =============

export interface MessagePreferences {
  // Opt-in pour alertes P0 nutrition (ex: "8h sans manger")
  enableUrgentNutritionAlerts: boolean
  // Opt-in pour tips quotidiens P3
  enableDailyTips: boolean
  // Heures silencieuses (pas de vibration)
  quietHoursStart: number // 0-23
  quietHoursEnd: number // 0-23
}

export const DEFAULT_PREFERENCES: MessagePreferences = {
  enableUrgentNutritionAlerts: false, // Off par défaut - pas intrusif
  enableDailyTips: true,
  quietHoursStart: 22,
  quietHoursEnd: 8,
}

// ============= STORE =============

interface MessageCenterState {
  messages: LymiaMessage[]
  lastShownId: string | null
  preferences: MessagePreferences
  cooldowns: CooldownEntry[]

  // Actions
  addMessage: (message: Omit<LymiaMessage, 'id' | 'createdAt' | 'read' | 'dismissed'>) => string | null
  markAsRead: (id: string) => void
  dismiss: (id: string) => void
  dismissAll: () => void
  clearExpired: () => void
  updatePreferences: (prefs: Partial<MessagePreferences>) => void
  resetCooldown: (dedupKey: string) => void

  // Getters
  getActiveMessages: () => LymiaMessage[]
  getPriorityMessage: () => LymiaMessage | null
  getUnreadCount: () => number
  canSendMessage: (dedupKey: string, priority: MessagePriority) => boolean
  isInQuietHours: () => boolean
}

export const useMessageCenter = create<MessageCenterState>()(
  persist(
    (set, get) => ({
      messages: [],
      lastShownId: null,
      preferences: DEFAULT_PREFERENCES,
      cooldowns: [],

      // Vérifie si on peut envoyer un message (cooldown pas expiré)
      canSendMessage: (dedupKey: string, priority: MessagePriority) => {
        if (!dedupKey) return true
        const { cooldowns } = get()
        const entry = cooldowns.find(c => c.dedupKey === dedupKey)
        if (!entry) return true

        const config = PRIORITY_CONFIG[priority]
        const cooldownMs = config.cooldown * 60 * 60 * 1000
        const lastSent = new Date(entry.lastSentAt).getTime()
        return Date.now() - lastSent > cooldownMs
      },

      // Vérifie si on est en heures silencieuses
      isInQuietHours: () => {
        const { preferences } = get()
        const hour = new Date().getHours()
        const { quietHoursStart, quietHoursEnd } = preferences

        // Gestion du cas où quiet hours traverse minuit
        if (quietHoursStart > quietHoursEnd) {
          return hour >= quietHoursStart || hour < quietHoursEnd
        }
        return hour >= quietHoursStart && hour < quietHoursEnd
      },

      addMessage: (messageData) => {
        const { dedupKey } = messageData
        const config = PRIORITY_CONFIG[messageData.priority]

        // Vérifier cooldown si dedupKey fourni
        if (dedupKey && !get().canSendMessage(dedupKey, messageData.priority)) {
          console.log(`[MessageCenter] Message blocked by cooldown: ${dedupKey}`)
          return null
        }

        const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

        const message: LymiaMessage = {
          ...messageData,
          id,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + config.maxAge * 60 * 60 * 1000).toISOString(),
          read: false,
          dismissed: false,
        }

        set((state) => {
          // Smart eviction: garder 50 max, mais priorité aux P0/P1
          let newMessages = [message, ...state.messages]
          if (newMessages.length > 50) {
            // Trier par priorité puis date, supprimer les moins importants
            newMessages = newMessages
              .sort((a, b) => {
                const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 }
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                  return priorityOrder[a.priority] - priorityOrder[b.priority]
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              })
              .slice(0, 50)
          }

          // Mettre à jour cooldown si dedupKey
          let newCooldowns = state.cooldowns
          if (dedupKey) {
            newCooldowns = [
              ...state.cooldowns.filter(c => c.dedupKey !== dedupKey),
              { dedupKey, lastSentAt: new Date().toISOString() }
            ].slice(-30) // Garder max 30 cooldowns
          }

          return { messages: newMessages, cooldowns: newCooldowns }
        })

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

      updatePreferences: (prefs) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        }))
      },

      resetCooldown: (dedupKey) => {
        set((state) => ({
          cooldowns: state.cooldowns.filter(c => c.dedupKey !== dedupKey),
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
        preferences: state.preferences,
        cooldowns: state.cooldowns.slice(-20), // Persist recent cooldowns
      }),
    }
  )
)

// ============= MESSAGE GENERATORS =============

type GeneratedMessage = Omit<LymiaMessage, 'id' | 'createdAt' | 'read' | 'dismissed'>

/**
 * Generate contextual messages based on user data
 * Respecte les preferences utilisateur et le système de cooldown
 */
export function generateDailyMessages(
  userData: {
    caloriesConsumed: number
    caloriesTarget: number
    proteinsPercent: number
    waterPercent: number
    sleepHours: number | null
    streak: number
    lastMealTime: Date | null
    // Repas plaisir: max 600 kcal/repas, max 2 repas/semaine, à partir du jour 3
    plaisirAvailable: boolean  // true si repas plaisir débloqué (jour >= 3 ET budget >= 200)
    maxPlaisirPerMeal: number  // max 600 kcal par repas plaisir
    remainingPlaisirMeals: number  // 0, 1 ou 2 repas restants cette semaine
  },
  preferences?: MessagePreferences
): GeneratedMessage[] {
  const messages: GeneratedMessage[] = []
  const now = new Date()
  const hour = now.getHours()
  const prefs = preferences || DEFAULT_PREFERENCES

  // P1: No meal for 8+ hours (downgraded from P0 - moins intrusif)
  // Devient P0 SEULEMENT si opt-in activé par l'utilisateur
  if (userData.lastMealTime && hour >= 8 && hour <= 22) {
    const hoursSinceLastMeal = (now.getTime() - userData.lastMealTime.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastMeal >= 8) {
      const isUrgent = prefs.enableUrgentNutritionAlerts && hoursSinceLastMeal >= 10
      messages.push({
        priority: isUrgent ? 'P0' : 'P1',
        type: isUrgent ? 'alert' : 'action',
        category: 'nutrition',
        title: 'Tu as faim ?',
        message: `Ça fait ${Math.round(hoursSinceLastMeal)}h que tu n'as rien mangé. Prends soin de toi !`,
        emoji: '🍽️',
        actionLabel: 'Ajouter un repas',
        actionRoute: 'AddMeal',
        reason: `${Math.round(hoursSinceLastMeal)}h sans repas enregistré`,
        confidence: Math.min(0.9, hoursSinceLastMeal / 12), // Plus c'est long, plus on est sûr
        dedupKey: 'nutrition-long-fast',
      })
    }
  }

  // P1: Low protein (< 50% at dinner time)
  if (hour >= 18 && userData.proteinsPercent < 50) {
    messages.push({
      priority: 'P1',
      type: 'action',
      category: 'nutrition',
      title: 'Protéines à rattraper',
      message: `Tu es à ${userData.proteinsPercent}% de ton objectif protéines. Pense à en ajouter ce soir.`,
      emoji: '🥩',
      reason: `Protéines à ${userData.proteinsPercent}% après 18h`,
      confidence: 0.8,
      dedupKey: 'nutrition-low-protein',
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
      reason: `Hydratation à ${userData.waterPercent}% après 14h`,
      confidence: 0.7,
      dedupKey: 'hydration-low',
    })
  }

  // P2: Streak celebration
  if (userData.streak > 0 && userData.streak % 7 === 0) {
    messages.push({
      priority: 'P2',
      type: 'celebration',
      category: 'progress',
      title: `${userData.streak} jours de suite !`,
      message: 'Ta régularité est impressionnante. Continue comme ça !',
      emoji: '🔥',
      reason: `Série de ${userData.streak} jours (multiple de 7)`,
      confidence: 1,
      dedupKey: `streak-${userData.streak}`,
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
      reason: `${userData.sleepHours}h de sommeil >= 7h`,
      confidence: 0.9,
      dedupKey: 'sleep-good',
    })
  }

  // P2: Plaisir available (max 600 kcal/repas, max 2 repas/semaine)
  if (userData.plaisirAvailable && userData.remainingPlaisirMeals > 0 && userData.maxPlaisirPerMeal > 0) {
    const repasText = userData.remainingPlaisirMeals === 2 ? 'tes 2 repas plaisir' : 'ton repas plaisir'
    messages.push({
      priority: 'P2',
      type: 'tip',
      category: 'nutrition',
      title: 'Repas plaisir disponible',
      message: `+${userData.maxPlaisirPerMeal} kcal bonus pour ${repasText}. Fais-toi plaisir !`,
      emoji: '🎁',
      reason: `${userData.remainingPlaisirMeals} repas plaisir restant(s), max ${userData.maxPlaisirPerMeal} kcal/repas`,
      confidence: 0.85,
      dedupKey: 'plaisir-available',
    })
  }

  // P3: Morning tip (si tips activés)
  if (prefs.enableDailyTips && hour >= 7 && hour <= 9) {
    messages.push({
      priority: 'P3',
      type: 'tip',
      category: 'wellness',
      title: 'Bien commencer',
      message: "Un verre d'eau au réveil aide ton métabolisme à démarrer.",
      emoji: '☀️',
      reason: 'Tip matinal entre 7h et 9h',
      confidence: 0.6,
      dedupKey: 'tip-morning-water',
    })
  }

  // P3: Bad sleep (si tips activés)
  if (prefs.enableDailyTips && userData.sleepHours && userData.sleepHours < 6) {
    messages.push({
      priority: 'P3',
      type: 'tip',
      category: 'sleep',
      title: 'Sommeil léger',
      message: `${userData.sleepHours}h seulement. Essaie de te coucher plus tôt ce soir.`,
      emoji: '🌙',
      reason: `${userData.sleepHours}h de sommeil < 6h`,
      confidence: 0.7,
      dedupKey: 'sleep-bad',
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
  DEFAULT_PREFERENCES,
}
