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
import { lightColors, darkColors } from '../constants/theme'

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
  // Source scientifique pour crédibilité
  source?: 'ANSES' | 'INSERM' | 'HAS' | 'OMS' | string
}

// Priority config - behavior only (colors come from theme)
export interface PriorityBehavior {
  vibrate: boolean
  persistent: boolean
  maxAge: number // hours
  cooldown: number // heures avant de pouvoir renvoyer un message similaire
}

export const PRIORITY_BEHAVIOR: Record<MessagePriority, PriorityBehavior> = {
  P0: { vibrate: true, persistent: true, maxAge: 24, cooldown: 24 },   // Urgent (rare!)
  P1: { vibrate: false, persistent: true, maxAge: 12, cooldown: 8 },   // Action needed
  P2: { vibrate: false, persistent: false, maxAge: 8, cooldown: 24 },  // Celebration
  P3: { vibrate: false, persistent: false, maxAge: 4, cooldown: 4 },   // Tip
}

// Priority config with colors - uses theme tokens (palette bienveillante)
// For components, use getPriorityConfig() to get theme-aware colors
export const PRIORITY_CONFIG: Record<MessagePriority, PriorityBehavior & { color: string }> = {
  P0: { ...PRIORITY_BEHAVIOR.P0, color: lightColors.coach.urgent },
  P1: { ...PRIORITY_BEHAVIOR.P1, color: lightColors.coach.action },
  P2: { ...PRIORITY_BEHAVIOR.P2, color: lightColors.coach.celebration },
  P3: { ...PRIORITY_BEHAVIOR.P3, color: lightColors.coach.tip },
}

/**
 * Get priority config with theme-aware colors
 * Use this in components with access to theme context
 */
export function getPriorityConfig(isDarkMode: boolean): Record<MessagePriority, PriorityBehavior & { color: string }> {
  const colors = isDarkMode ? darkColors : lightColors
  return {
    P0: { ...PRIORITY_BEHAVIOR.P0, color: colors.coach.urgent },
    P1: { ...PRIORITY_BEHAVIOR.P1, color: colors.coach.action },
    P2: { ...PRIORITY_BEHAVIOR.P2, color: colors.coach.celebration },
    P3: { ...PRIORITY_BEHAVIOR.P3, color: colors.coach.tip },
  }
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

const MAX_MESSAGES_PER_GENERATION = 3 // Max messages ajoutés à la fois

// ============= AI MESSAGE GENERATION =============

export interface AIMessageContext {
  profile: {
    firstName?: string
    goal?: string
  }
  nutrition: {
    caloriesConsumed: number
    caloriesTarget: number
    proteinsConsumed: number
    proteinsTarget: number
    carbsConsumed: number
    fatsConsumed: number
  }
  wellness: {
    sleepHours?: number | null
    stressLevel?: number | null
    energyLevel?: number | null
    hydrationPercent: number
  }
  streak: number
  lastMealTime: Date | null
  todayMealsCount: number
}

/**
 * Generate smart messages combining AI insights + critical contextual alerts
 * Now uses MessageRouter for collision resolution, TTL, and delivery routing
 *
 * Strategy:
 * 1. Critical alerts (rules-based, urgent only)
 * 2. AI messages (LymIABrain) with becauseLine for transparency
 * 3. Route through MessageRouter for collision/delivery decisions
 */
export async function generateAIMessages(context: AIMessageContext): Promise<GeneratedMessage[]> {
  const hour = new Date().getHours()
  const { profile, nutrition, wellness, streak, lastMealTime, todayMealsCount } = context
  const today = new Date().toISOString().split('T')[0]

  // Calculate percentages
  const caloriesPercent = nutrition.caloriesTarget > 0
    ? Math.round((nutrition.caloriesConsumed / nutrition.caloriesTarget) * 100)
    : 0
  const proteinsPercent = nutrition.proteinsTarget > 0
    ? Math.round((nutrition.proteinsConsumed / nutrition.proteinsTarget) * 100)
    : 0

  // Import router dynamically to avoid circular deps
  const { messageRouter, createRuleCandidate, createAICandidate } = await import('./message-router')
  type CandidateMessage = Parameters<typeof messageRouter.deliver>[0]
  type CoachTopic = CandidateMessage['topic']

  const candidates: CandidateMessage[] = []

  // ============= STEP 1: Critical contextual alerts (non-AI, urgent only) =============

  // Alert: Long fast (8+ hours without eating, daytime only)
  if (lastMealTime && hour >= 9 && hour <= 21) {
    const hoursSinceLastMeal = (Date.now() - lastMealTime.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastMeal >= 8) {
      candidates.push(createRuleCandidate({
        priority: 'P1',
        type: 'action',
        category: 'nutrition',
        topic: 'fasting' as CoachTopic,
        title: 'Tu as faim ?',
        message: `Ça fait ${Math.round(hoursSinceLastMeal)}h sans repas. Prends soin de toi !`,
        emoji: '🍽️',
        actionLabel: 'Ajouter un repas',
        actionRoute: 'AddMeal',
        becauseLine: `Ça fait ${Math.round(hoursSinceLastMeal)} heures que tu n'as rien mangé`,
        confidence: 0.85,
        dedupKey: `alert-long-fast-${today}`,
        urgencyWindow: 2, // Actionable in next 2 hours
      }))
    }
  }

  // Alert: Critical dehydration (< 30% after 15h)
  if (wellness.hydrationPercent < 30 && hour >= 15) {
    candidates.push(createRuleCandidate({
      priority: 'P1',
      type: 'action',
      category: 'hydration',
      topic: 'hydration' as CoachTopic,
      title: 'Pense à boire',
      message: `Seulement ${wellness.hydrationPercent}% de ton objectif eau. Un verre d'eau ?`,
      emoji: '💧',
      actionLabel: "Ajouter de l'eau",
      actionRoute: 'Home',
      becauseLine: `Tu n'as bu que ${wellness.hydrationPercent}% de ton objectif aujourd'hui`,
      confidence: 0.8,
      dedupKey: `alert-dehydration-${today}`,
      source: 'ANSES',
      urgencyWindow: 3,
    }))
  }

  // ============= STEP 2: AI-powered personalized messages =============
  try {
    const { getCoachingAdvice } = await import('./lymia-brain')

    const lymiaContext = {
      profile: {
        firstName: profile.firstName,
        goal: profile.goal || 'maintain',
        nutritionalNeeds: {
          calories: nutrition.caloriesTarget,
          proteins: nutrition.proteinsTarget,
          carbs: 0,
          fats: 0,
        },
      } as any,
      todayNutrition: {
        calories: nutrition.caloriesConsumed,
        proteins: nutrition.proteinsConsumed,
        carbs: nutrition.carbsConsumed,
        fats: nutrition.fatsConsumed,
      },
      weeklyAverage: {
        calories: nutrition.caloriesConsumed,
        proteins: nutrition.proteinsConsumed,
        carbs: nutrition.carbsConsumed,
        fats: nutrition.fatsConsumed,
      },
      currentStreak: streak,
      lastMeals: [],
      wellnessData: {
        sleepHours: wellness.sleepHours || undefined,
        stressLevel: wellness.stressLevel || undefined,
        energyLevel: wellness.energyLevel || undefined,
        hydrationLiters: (wellness.hydrationPercent / 100) * 2,
      },
    }

    const advices = await getCoachingAdvice(lymiaContext)

    // Track topics already covered by rule-based alerts to avoid duplicates
    const coveredTopics = new Set(candidates.map(c => c.topic))

    for (const advice of advices.slice(0, 2)) { // Max 2 AI messages
      const aiCategory = advice.category === 'alert' ? 'nutrition' :
        advice.category === 'motivation' ? 'progress' :
        advice.category as MessageCategory

      const aiTopic: CoachTopic =
        aiCategory === 'nutrition' ? 'nutrition' :
        aiCategory === 'hydration' ? 'hydration' :
        aiCategory === 'sleep' ? 'sleep' :
        aiCategory === 'sport' ? 'activity' :
        aiCategory === 'stress' ? 'wellness' :
        aiCategory === 'progress' ? 'progress' :
        'motivation'

      // Skip AI message if this topic is already covered by a rule-based alert
      if (coveredTopics.has(aiTopic)) {
        console.log(`[MessageCenter] Skipping AI message for ${aiTopic}: already covered by rule`)
        continue
      }

      const priority: MessagePriority =
        advice.priority === 'high' ? 'P1' :
        advice.priority === 'medium' ? 'P2' : 'P3'

      const type: MessageType =
        advice.category === 'alert' ? 'alert' :
        advice.category === 'motivation' ? 'celebration' :
        advice.priority === 'high' ? 'action' : 'tip'

      const sourceEntry = advice.sources?.[0]
      const sourceName = sourceEntry?.source?.toUpperCase() || undefined

      // Build human-readable becauseLine from context
      const becauseLine = buildBecauseLine(context, advice.category, caloriesPercent, proteinsPercent)

      candidates.push(createAICandidate({
        priority,
        type,
        category: aiCategory,
        topic: aiTopic,
        title: extractTitle(advice.message),
        message: advice.message,
        emoji: getCategoryEmoji(aiCategory, type),
        actionLabel: advice.actionItems?.[0] || undefined,
        actionRoute: getActionRoute(aiCategory),
        becauseLine,
        reason: `IA: ${advice.category} - ${advice.priority}`,
        confidence: 0.9,
        dedupKey: `ai-${aiCategory}-${today}-${advice.priority}`,
        source: sourceName,
      }))

      // Mark this topic as covered
      coveredTopics.add(aiTopic)
    }
  } catch (error) {
    console.error('[MessageCenter] AI generation failed:', error)
  }

  // ============= STEP 3: Fallback if no candidates =============
  if (candidates.length === 0 && hour >= 18) {
    const fallback = await generateFallbackInsight(context)
    candidates.push(createRuleCandidate({
      priority: fallback.priority,
      type: fallback.type,
      category: fallback.category,
      topic: 'nutrition' as CoachTopic,
      title: fallback.title,
      message: fallback.message,
      emoji: fallback.emoji,
      actionLabel: fallback.actionLabel,
      actionRoute: fallback.actionRoute,
      becauseLine: 'Bilan de ta journée nutrition',
      confidence: fallback.confidence,
      dedupKey: fallback.dedupKey || `fallback-${today}`,
    }))
  }

  // ============= STEP 4: Route through MessageRouter =============
  const deliveredIds = await messageRouter.deliverBatch(candidates)

  // Convert to GeneratedMessage format for backward compatibility
  const messageCenter = useMessageCenter.getState()
  const messages: GeneratedMessage[] = []

  for (const id of deliveredIds) {
    const msg = messageCenter.messages.find(m => m.id === id)
    if (msg) {
      messages.push({
        priority: msg.priority,
        type: msg.type,
        category: msg.category,
        title: msg.title,
        message: msg.message,
        emoji: msg.emoji,
        actionLabel: msg.actionLabel,
        actionRoute: msg.actionRoute,
        reason: msg.reason,
        confidence: msg.confidence,
        dedupKey: msg.dedupKey,
        source: msg.source,
        expiresAt: msg.expiresAt,
      })
    }
  }

  return messages
}

/**
 * Build a human-readable "because line" for AI messages
 */
function buildBecauseLine(
  context: AIMessageContext,
  category: string,
  caloriesPercent: number,
  proteinsPercent: number
): string {
  const { nutrition, wellness, streak, todayMealsCount } = context

  switch (category) {
    case 'nutrition':
      if (caloriesPercent < 50) {
        return `Tu as consommé ${caloriesPercent}% de tes calories aujourd'hui`
      } else if (caloriesPercent > 110) {
        return `Tu as dépassé ton objectif calorique de ${caloriesPercent - 100}%`
      }
      return `Basé sur tes ${todayMealsCount} repas d'aujourd'hui`

    case 'wellness':
      if (wellness.sleepHours && wellness.sleepHours < 6) {
        return `Tu as dormi seulement ${wellness.sleepHours}h cette nuit`
      }
      return 'Basé sur ton bien-être général'

    case 'motivation':
      if (streak > 7) {
        return `Tu as maintenu une série de ${streak} jours`
      }
      return 'Pour te motiver à continuer'

    case 'alert':
      return 'Détecté automatiquement selon tes données'

    default:
      return 'Conseil personnalisé selon ton profil'
  }
}

/**
 * Extract a short title from an AI message
 */
function extractTitle(message: string): string {
  // Take first sentence or first 40 chars
  const firstSentence = message.split(/[.!?]/)[0]
  if (firstSentence.length <= 40) return firstSentence
  return firstSentence.substring(0, 37) + '...'
}

/**
 * Get appropriate emoji for category and type
 */
function getCategoryEmoji(category: MessageCategory, type: MessageType): string {
  if (type === 'celebration') return '🎉'
  if (type === 'alert') return '⚠️'

  const emojis: Record<MessageCategory, string> = {
    nutrition: '🥗',
    hydration: '💧',
    sleep: '😴',
    sport: '💪',
    stress: '🧘',
    progress: '📈',
    wellness: '❤️',
    system: '⚙️',
  }
  return emojis[category] || '💡'
}

/**
 * Get action route for category
 */
function getActionRoute(category: MessageCategory): string {
  const routes: Record<MessageCategory, string> = {
    nutrition: 'AddMeal',
    hydration: 'Home',
    sleep: 'WellnessProgram',
    sport: 'WellnessProgram',
    stress: 'WellnessProgram',
    progress: 'Progress',
    wellness: 'WellnessProgram',
    system: 'Settings',
  }
  return routes[category] || 'Home'
}

/**
 * Generate a fallback insight when AI fails
 */
async function generateFallbackInsight(context: AIMessageContext): Promise<GeneratedMessage> {
  const { nutrition, streak } = context
  const caloriesPercent = nutrition.caloriesTarget > 0
    ? Math.round((nutrition.caloriesConsumed / nutrition.caloriesTarget) * 100)
    : 0

  let title: string
  let message: string
  let emoji: string

  if (caloriesPercent >= 85 && caloriesPercent <= 115) {
    title = 'Objectif atteint !'
    message = `${nutrition.caloriesConsumed} kcal aujourd'hui, pile dans ton objectif. Belle journée !`
    emoji = '✅'
  } else if (caloriesPercent < 70) {
    title = 'Il te reste de la marge'
    message = `${nutrition.caloriesConsumed} kcal sur ${nutrition.caloriesTarget}. Si tu as faim, c'est le moment.`
    emoji = '🍽️'
  } else {
    title = 'Bilan du jour'
    message = `${nutrition.caloriesConsumed} / ${nutrition.caloriesTarget} kcal (${caloriesPercent}%). ${streak > 1 ? `Série de ${streak} jours !` : ''}`
    emoji = '📊'
  }

  return {
    priority: 'P3',
    type: 'insight',
    category: 'nutrition',
    title,
    message,
    emoji,
    actionLabel: 'Voir mes progrès',
    actionRoute: 'Progress',
    reason: 'Bilan journalier (fallback)',
    confidence: 0.7,
    dedupKey: `fallback-insight-${new Date().toISOString().split('T')[0]}`,
  }
}

// ============= TEMPLATE-BASED MESSAGES (Legacy) =============

/**
 * Generate contextual messages based on user data (TEMPLATE-BASED)
 * @deprecated Use generateAIMessages for real AI-powered messages
 * This function uses static templates - kept for fallback only
 */

export function generateDailyMessages(
  userData: {
    caloriesConsumed: number
    caloriesTarget: number
    proteinsConsumed?: number
    proteinsTarget?: number
    proteinsPercent: number
    carbsConsumed?: number
    carbsTarget?: number
    fatsConsumed?: number
    fatsTarget?: number
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
  const allMessages: GeneratedMessage[] = []
  const now = new Date()
  const hour = now.getHours()
  const prefs = preferences || DEFAULT_PREFERENCES

  // Calculs utiles
  const caloriesRemaining = Math.max(0, userData.caloriesTarget - userData.caloriesConsumed)
  const caloriesPercent = Math.round((userData.caloriesConsumed / userData.caloriesTarget) * 100)

  // P1: No meal for 8+ hours (downgraded from P0 - moins intrusif)
  // Devient P0 SEULEMENT si opt-in activé par l'utilisateur
  if (userData.lastMealTime && hour >= 8 && hour <= 22) {
    const hoursSinceLastMeal = (now.getTime() - userData.lastMealTime.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastMeal >= 8) {
      const isUrgent = prefs.enableUrgentNutritionAlerts && hoursSinceLastMeal >= 10
      allMessages.push({
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
    const proteinsRemaining = userData.proteinsTarget
      ? Math.round(userData.proteinsTarget - (userData.proteinsConsumed || 0))
      : null
    const proteinsInfo = proteinsRemaining ? ` (~${proteinsRemaining}g à rattraper)` : ''
    allMessages.push({
      priority: 'P1',
      type: 'action',
      category: 'nutrition',
      title: 'Protéines à rattraper',
      message: `Tu es à ${userData.proteinsPercent}% de ton objectif protéines.${proteinsInfo} Pense à en ajouter ce soir.`,
      emoji: '🥩',
      actionLabel: 'Ajouter mon dîner',
      actionRoute: 'AddMeal',
      reason: `Protéines à ${userData.proteinsPercent}% après 18h`,
      confidence: 0.8,
      dedupKey: 'nutrition-low-protein',
      source: 'ANSES',
    })
  }

  // P1: Low hydration
  if (userData.waterPercent < 40 && hour >= 14) {
    const waterRemaining = Math.round(2000 * (100 - userData.waterPercent) / 100)
    allMessages.push({
      priority: 'P1',
      type: 'action',
      category: 'hydration',
      title: 'Hydrate-toi',
      message: `Seulement ${userData.waterPercent}% de ton objectif eau (~${waterRemaining}ml restants). Un verre d'eau ?`,
      emoji: '💧',
      actionLabel: 'Ajouter de l\'eau',
      actionRoute: 'Home',
      reason: `Hydratation à ${userData.waterPercent}% après 14h`,
      confidence: 0.7,
      dedupKey: 'hydration-low',
      source: 'ANSES',
    })
  }

  // P2: Streak celebration
  if (userData.streak > 0 && userData.streak % 7 === 0) {
    allMessages.push({
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
    allMessages.push({
      priority: 'P2',
      type: 'celebration',
      category: 'sleep',
      title: 'Belle nuit !',
      message: `${userData.sleepHours}h de sommeil. Ton corps te remercie.`,
      emoji: '😴',
      reason: `${userData.sleepHours}h de sommeil >= 7h`,
      confidence: 0.9,
      dedupKey: 'sleep-good',
      source: 'INSERM',
    })
  }

  // P2: Plaisir available (max 600 kcal/repas, max 2 repas/semaine)
  if (userData.plaisirAvailable && userData.remainingPlaisirMeals > 0 && userData.maxPlaisirPerMeal > 0) {
    const repasText = userData.remainingPlaisirMeals === 2 ? 'tes 2 repas plaisir' : 'ton repas plaisir'
    allMessages.push({
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
    allMessages.push({
      priority: 'P3',
      type: 'tip',
      category: 'wellness',
      title: 'Bien commencer',
      message: "Un verre d'eau au réveil aide ton métabolisme à démarrer.",
      emoji: '☀️',
      reason: 'Tip matinal entre 7h et 9h',
      confidence: 0.6,
      dedupKey: 'tip-morning-water',
      source: 'ANSES',
    })
  }

  // P3: Bad sleep (si tips activés)
  if (prefs.enableDailyTips && userData.sleepHours && userData.sleepHours < 6) {
    allMessages.push({
      priority: 'P3',
      type: 'tip',
      category: 'sleep',
      title: 'Sommeil léger',
      message: `${userData.sleepHours}h seulement. Essaie de te coucher plus tôt ce soir.`,
      emoji: '🌙',
      reason: `${userData.sleepHours}h de sommeil < 6h`,
      confidence: 0.7,
      dedupKey: 'sleep-bad',
      source: 'INSERM',
    })
  }

  // P3: Bilan nutrition du soir (après 19h, si on a mangé)
  if (hour >= 19 && userData.caloriesConsumed > 0) {
    const proteinsG = userData.proteinsConsumed || 0
    const carbsG = userData.carbsConsumed || 0
    const fatsG = userData.fatsConsumed || 0

    // Construire le résumé macros si disponible
    let macrosSummary = ''
    if (proteinsG > 0 || carbsG > 0 || fatsG > 0) {
      macrosSummary = ` (P: ${Math.round(proteinsG)}g · G: ${Math.round(carbsG)}g · L: ${Math.round(fatsG)}g)`
    }

    // Déterminer le ton du message selon le niveau de calories
    let bilanMessage: string
    let bilanEmoji: string
    if (caloriesPercent >= 90 && caloriesPercent <= 110) {
      bilanMessage = `Parfait ! ${userData.caloriesConsumed} kcal aujourd'hui, pile dans l'objectif.${macrosSummary}`
      bilanEmoji = '✅'
    } else if (caloriesPercent < 70) {
      bilanMessage = `${userData.caloriesConsumed} kcal (${caloriesPercent}%). Il te reste ${caloriesRemaining} kcal si tu as encore faim.${macrosSummary}`
      bilanEmoji = '📊'
    } else if (caloriesPercent > 120) {
      bilanMessage = `${userData.caloriesConsumed} kcal aujourd'hui. Pas de stress, un jour ne fait pas tout !${macrosSummary}`
      bilanEmoji = '💪'
    } else {
      bilanMessage = `${userData.caloriesConsumed} / ${userData.caloriesTarget} kcal (${caloriesPercent}%).${macrosSummary}`
      bilanEmoji = '📊'
    }

    allMessages.push({
      priority: 'P3',
      type: 'insight',
      category: 'nutrition',
      title: 'Bilan nutrition',
      message: bilanMessage,
      emoji: bilanEmoji,
      actionLabel: 'Voir mes progrès',
      actionRoute: 'Progress',
      reason: 'Bilan journalier après 19h',
      confidence: 0.9,
      dedupKey: `bilan-nutrition-${now.toISOString().split('T')[0]}`,
    })
  }

  // NOTE: Les rappels de repas (petit-déjeuner, déjeuner, etc.) sont gérés par
  // meal-reminder-service.ts via notifications push programmées.
  // Ne PAS les dupliquer ici pour éviter les rafales de messages.

  // ============= SUGGESTIONS PROGRAMMES CONTEXTUELLES =============
  // Ces suggestions apparaissent uniquement quand pertinent (stress, sommeil, etc.)
  // Cooldown long (72h) pour ne pas être intrusif

  // Suggestion Wellness si stress détecté ou fatigue
  if (userData.sleepHours && userData.sleepHours < 6) {
    allMessages.push({
      priority: 'P3',
      type: 'tip',
      category: 'wellness',
      title: 'Besoin de te ressourcer ?',
      message: 'Le programme Bien-être t\'aide à mieux gérer ton énergie et ton stress au quotidien.',
      emoji: '🧘',
      actionLabel: 'Découvrir',
      actionRoute: 'WellnessProgram',
      reason: 'Sommeil insuffisant détecté',
      confidence: 0.6,
      dedupKey: 'suggest-wellness-program',
      source: 'INSERM',
    })
  }

  // Suggestion Boost Métabolique si streak élevé mais progression lente
  if (userData.streak >= 14 && caloriesPercent < 80) {
    allMessages.push({
      priority: 'P3',
      type: 'tip',
      category: 'progress',
      title: 'Relancer ton métabolisme ?',
      message: 'Le programme Boost Métabolique aide à sortir des plateaux avec une approche progressive.',
      emoji: '🚀',
      actionLabel: 'En savoir plus',
      actionRoute: 'MetabolicBoost',
      reason: 'Streak de 14+ jours avec apports sous-objectif',
      confidence: 0.5,
      dedupKey: 'suggest-metabolic-boost',
    })
  }

  // Trier par priorité (P0 > P1 > P2 > P3) et ne garder que les plus importants
  // Cela évite les rafales de messages qui submergent l'utilisateur
  const priorityOrder: Record<MessagePriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  const sortedMessages = allMessages.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  // Retourner maximum MAX_MESSAGES_PER_GENERATION messages
  // Le système de cooldown empêchera de toute façon les doublons
  return sortedMessages.slice(0, MAX_MESSAGES_PER_GENERATION)
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
  PRIORITY_BEHAVIOR,
  getPriorityConfig,
  CATEGORY_EMOJI,
  DEFAULT_PREFERENCES,
}
