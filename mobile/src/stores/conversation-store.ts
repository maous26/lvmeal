/**
 * Conversation Store - Zustand state management
 *
 * Manages:
 * - Conversation history (full, local)
 * - Message limits (free tier)
 * - LLM call tracking
 * - Metrics for A/B testing (Recommendation #6)
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  ConversationTurn,
  ConversationResponse,
  IntentDetectionResult,
  UserIntent,
  ConversationMetrics,
  ConversationContextFull,
  ConversationMemory,
  CONVERSATION_TIERS,
} from '../types/conversation'
import { conversationContextService } from '../services/conversation-context-service'
import { conversationIntentService } from '../services/conversation-intent-service'
import { conversationResponseService } from '../services/conversation-response-service'
import { conversationSafetyService } from '../services/conversation-safety-service'
import { conversationActionService } from '../services/conversation-action-service'
import { analytics } from '../services/analytics-service'

// ============================================================================
// TYPES
// ============================================================================

interface ConversationState {
  // Conversation data
  turns: ConversationTurn[]
  sessionId: string
  isProcessing: boolean

  // Limits tracking
  messagesToday: number
  llmCallsToday: number
  lastResetDate: string

  // Memory summary (for long conversations)
  memorySummary: string | null

  // Enhanced memory (user preferences, patterns, learned facts)
  enhancedMemory: ConversationMemory | null

  // User memory control settings
  memoryEnabled: boolean  // Whether memory collection is enabled
  memoryLastResetAt: string | null  // When memory was last reset

  // Metrics (Recommendation #6)
  metrics: ConversationMetrics

  // A/B experiment
  experimentGroup: 'control' | 'treatment' | null

  // Hydration
  _hasHydrated: boolean

  // Actions
  sendMessage: (message: string, isPremium: boolean) => Promise<ConversationResponse | null>
  sendIntent: (intent: UserIntent, isPremium: boolean) => Promise<ConversationResponse | null>
  clearConversation: () => void
  setExperimentGroup: (group: 'control' | 'treatment') => void
  trackDiagnosisViewed: () => void
  trackFeedback: (positive: boolean) => void
  setHasHydrated: (state: boolean) => void
  reset: () => void
  updateEnhancedMemory: () => void
  getEnhancedMemory: () => ConversationMemory | null

  // User memory control actions
  resetMemory: () => void  // Clears all learned preferences/patterns
  toggleMemory: (enabled: boolean) => void  // Enable/disable memory collection
  getMemoryStats: () => { totalFacts: number; preferences: number; patterns: number; enabled: boolean }

  // Getters
  canSendMessage: (isPremium: boolean) => boolean
  getMessagesRemaining: (isPremium: boolean) => number | 'unlimited'
  getContext: () => ConversationContextFull
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

const initialMetrics: ConversationMetrics = {
  sessionId: generateSessionId(),
  messagesInSession: 0,
  hasCoachAccess: true,
  intentDistribution: {},
  actionsExecuted: 0,
  diagnosisViewed: 0,
  thumbsUp: 0,
  thumbsDown: 0,
}

const initialState = {
  turns: [] as ConversationTurn[],
  sessionId: generateSessionId(),
  isProcessing: false,
  messagesToday: 0,
  llmCallsToday: 0,
  lastResetDate: new Date().toDateString(),
  memorySummary: null as string | null,
  enhancedMemory: null as ConversationMemory | null,
  memoryEnabled: true,  // Memory enabled by default
  memoryLastResetAt: null as string | null,
  metrics: initialMetrics,
  experimentGroup: null as 'control' | 'treatment' | null,
  _hasHydrated: false,
}

// ============================================================================
// STORE
// ============================================================================

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * Send a free-text message
       */
      sendMessage: async (message: string, isPremium: boolean): Promise<ConversationResponse | null> => {
        const state = get()

        // Check limits
        if (!state.canSendMessage(isPremium)) {
          console.log('[ConversationStore] Message limit reached')
          return null
        }

        // Reset daily counters if needed
        const today = new Date().toDateString()
        if (state.lastResetDate !== today) {
          set({
            messagesToday: 0,
            llmCallsToday: 0,
            lastResetDate: today,
          })
        }

        set({ isProcessing: true })

        try {
          // 1. Build context
          const context = conversationContextService.buildFullContext(state.turns)

          // 2. Safety check
          const safetyCheck = conversationSafetyService.checkInput(message, context)
          if (safetyCheck.action === 'refuse_redirect') {
            // Return safety redirect message
            const safetyResponse: ConversationResponse = {
              message: {
                text: safetyCheck.redirectMessage || "Je préfère te rediriger vers un professionnel pour cette question.",
                tone: 'supportive',
                emoji: '💙',
              },
              actions: [],
              meta: {
                responseId: `safety_${Date.now()}`,
                generatedAt: new Date().toISOString(),
                model: 'rules',
                processingTimeMs: 0,
              },
            }

            // Add to history
            const userTurn: ConversationTurn = {
              id: `turn_${Date.now()}_user`,
              role: 'user',
              content: message,
              timestamp: new Date().toISOString(),
            }

            const assistantTurn: ConversationTurn = {
              id: `turn_${Date.now()}_assistant`,
              role: 'assistant',
              content: safetyResponse.message.text,
              timestamp: new Date().toISOString(),
              response: safetyResponse,
            }

            set(s => ({
              turns: [...s.turns, userTurn, assistantTurn],
              messagesToday: s.messagesToday + 1,
              isProcessing: false,
            }))

            return safetyResponse
          }

          // 3. Detect intent
          const intentResult = await conversationIntentService.detectIntent(
            message,
            context,
            isPremium,
            state.llmCallsToday
          )

          // 4. Generate response
          const response = conversationResponseService.generateResponse(intentResult, context)

          // 5. Add to history
          const userTurn: ConversationTurn = {
            id: `turn_${Date.now()}_user`,
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
            detectedIntent: intentResult,
          }

          const assistantTurn: ConversationTurn = {
            id: `turn_${Date.now()}_assistant`,
            role: 'assistant',
            content: response.message.text,
            timestamp: new Date().toISOString(),
            response,
          }

          // 6. Update metrics
          const primaryIntent = intentResult.topIntents[0]?.intent || 'UNKNOWN'
          const newMetrics: ConversationMetrics = {
            ...state.metrics,
            messagesInSession: state.metrics.messagesInSession + 1,
            intentDistribution: {
              ...state.metrics.intentDistribution,
              [primaryIntent]: (state.metrics.intentDistribution[primaryIntent] || 0) + 1,
            },
          }

          // 7. Generate memory summary if conversation is long
          const newTurns = [...state.turns, userTurn, assistantTurn]
          const memorySummary = newTurns.length >= 10
            ? conversationContextService.generateMemorySummary(newTurns)
            : state.memorySummary

          // 8. Update enhanced memory every 10 messages (if enabled)
          let enhancedMemory = state.enhancedMemory
          if (state.memoryEnabled && newTurns.length >= 10 && newTurns.length % 10 === 0) {
            enhancedMemory = conversationContextService.generateEnhancedMemory(newTurns)
          }

          set({
            turns: newTurns,
            messagesToday: state.messagesToday + 1,
            llmCallsToday: response.meta.model === 'llm' ? state.llmCallsToday + 1 : state.llmCallsToday,
            isProcessing: false,
            metrics: newMetrics,
            memorySummary,
            enhancedMemory,
          })

          // 8. Track analytics
          analytics.track('coach_message_sent', {
            intent: primaryIntent,
            model: response.meta.model,
            hasActions: response.actions.length > 0,
            processingTimeMs: response.meta.processingTimeMs,
          })

          return response
        } catch (error) {
          console.error('[ConversationStore] Error processing message:', error)
          set({ isProcessing: false })
          return null
        }
      },

      /**
       * Send a pre-defined intent (from guided mode buttons)
       */
      sendIntent: async (intent: UserIntent, isPremium: boolean): Promise<ConversationResponse | null> => {
        const state = get()

        // Check limits
        if (!state.canSendMessage(isPremium)) {
          console.log('[ConversationStore] Message limit reached')
          return null
        }

        // Reset daily counters if needed
        const today = new Date().toDateString()
        if (state.lastResetDate !== today) {
          set({
            messagesToday: 0,
            llmCallsToday: 0,
            lastResetDate: today,
          })
        }

        set({ isProcessing: true })

        try {
          // 1. Build context
          const context = conversationContextService.buildFullContext(state.turns)

          // 2. Create synthetic intent result (high confidence since user clicked button)
          const intentResult: IntentDetectionResult = {
            topIntents: [
              { intent, confidence: 0.99 },
              { intent: 'UNKNOWN', confidence: 0 },
              { intent: 'UNKNOWN', confidence: 0 },
            ],
            entities: [],
            sentiment: 'neutral',
            urgency: 'medium',
            safetyFlags: [],
          }

          // 3. Generate response
          const response = conversationResponseService.generateResponse(intentResult, context)

          // 4. Create user turn with intent label
          const intentLabels: Record<UserIntent, string> = {
            HUNGER: "J'ai faim",
            CRAVING: "J'ai une envie",
            FATIGUE: "Je suis fatigué(e)",
            LOW_ENERGY: "Pas la forme",
            THIRST: "J'ai soif",
            STRESS: "Je suis stressé(e)",
            ANXIETY: "Je suis anxieux(se)",
            FRUSTRATION: "Je suis frustré(e)",
            CELEBRATION: "J'ai réussi !",
            SADNESS: "Je ne me sens pas bien",
            PROGRESS_CHECK: "Où j'en suis ?",
            EXPLAIN_DECISION: "Pourquoi ?",
            NUTRITION_QUESTION: "Question nutrition",
            MEAL_SUGGESTION: "Propose-moi un repas",
            PLAN_MODIFICATION: "Ajuster mes objectifs",
            CHALLENGE_START: "Lance-moi un défi",
            PHASE_QUESTION: "C'est quoi la suite ?",
            LOG_MEAL: "J'ai mangé",
            OVERWHELM: "C'est compliqué",
            DOUBT: "J'ai des doutes",
            PLATEAU: "Je stagne",
            GREETING: "Salut !",
            FEEDBACK: "Retour",
            HELP: "Aide",
            UNKNOWN: "...",
          }

          const userTurn: ConversationTurn = {
            id: `turn_${Date.now()}_user`,
            role: 'user',
            content: intentLabels[intent] || intent,
            timestamp: new Date().toISOString(),
            detectedIntent: intentResult,
          }

          const assistantTurn: ConversationTurn = {
            id: `turn_${Date.now()}_assistant`,
            role: 'assistant',
            content: response.message.text,
            timestamp: new Date().toISOString(),
            response,
          }

          // 5. Update metrics
          const newMetrics: ConversationMetrics = {
            ...state.metrics,
            messagesInSession: state.metrics.messagesInSession + 1,
            intentDistribution: {
              ...state.metrics.intentDistribution,
              [intent]: (state.metrics.intentDistribution[intent] || 0) + 1,
            },
          }

          set({
            turns: [...state.turns, userTurn, assistantTurn],
            messagesToday: state.messagesToday + 1,
            isProcessing: false,
            metrics: newMetrics,
          })

          // 6. Track analytics
          analytics.track('coach_intent_selected', {
            intent,
            model: response.meta.model,
            hasActions: response.actions.length > 0,
          })

          return response
        } catch (error) {
          console.error('[ConversationStore] Error processing intent:', error)
          set({ isProcessing: false })
          return null
        }
      },

      /**
       * Check if user can send another message
       */
      canSendMessage: (isPremium: boolean): boolean => {
        const state = get()
        const tier = isPremium ? 'premium' : 'free'
        const config = CONVERSATION_TIERS[tier]

        if (config.dailyMessages === 'unlimited') return true
        return state.messagesToday < config.dailyMessages
      },

      /**
       * Get messages remaining for today
       */
      getMessagesRemaining: (isPremium: boolean): number | 'unlimited' => {
        const state = get()
        const tier = isPremium ? 'premium' : 'free'
        const config = CONVERSATION_TIERS[tier]

        if (config.dailyMessages === 'unlimited') return 'unlimited'
        return Math.max(0, config.dailyMessages - state.messagesToday)
      },

      /**
       * Get current context
       */
      getContext: (): ConversationContextFull => {
        const state = get()
        return conversationContextService.buildFullContext(state.turns)
      },

      /**
       * Clear conversation history
       */
      clearConversation: () => {
        set({
          turns: [],
          sessionId: generateSessionId(),
          metrics: {
            ...initialMetrics,
            sessionId: generateSessionId(),
          },
          memorySummary: null,
        })

        analytics.track('coach_conversation_cleared')
      },

      /**
       * Set A/B experiment group
       */
      setExperimentGroup: (group: 'control' | 'treatment') => {
        set(s => ({
          experimentGroup: group,
          metrics: {
            ...s.metrics,
            experimentGroup: group,
          },
        }))

        analytics.track('coach_experiment_assigned', { group })
      },

      /**
       * Track diagnosis toggle view (Recommendation #5)
       */
      trackDiagnosisViewed: () => {
        set(s => ({
          metrics: {
            ...s.metrics,
            diagnosisViewed: s.metrics.diagnosisViewed + 1,
          },
        }))

        analytics.track('coach_diagnosis_viewed')
      },

      /**
       * Track feedback (Recommendation #6)
       */
      trackFeedback: (positive: boolean) => {
        set(s => ({
          metrics: {
            ...s.metrics,
            thumbsUp: positive ? s.metrics.thumbsUp + 1 : s.metrics.thumbsUp,
            thumbsDown: !positive ? s.metrics.thumbsDown + 1 : s.metrics.thumbsDown,
          },
        }))

        analytics.track('coach_feedback', { positive })
      },

      /**
       * Set hydration state
       */
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state })
      },

      /**
       * Reset store
       */
      reset: () => {
        set({
          ...initialState,
          sessionId: generateSessionId(),
          metrics: {
            ...initialMetrics,
            sessionId: generateSessionId(),
          },
          _hasHydrated: true,
        })
      },

      /**
       * Update enhanced memory manually (e.g., on app foreground)
       * Respects user's memory preference setting
       */
      updateEnhancedMemory: () => {
        const state = get()

        // Don't update if memory is disabled by user
        if (!state.memoryEnabled) {
          return
        }

        if (state.turns.length >= 10) {
          const enhancedMemory = conversationContextService.generateEnhancedMemory(state.turns)
          const memorySummary = conversationContextService.buildMemorySummaryFromEnhanced(enhancedMemory)

          set({
            enhancedMemory,
            memorySummary: memorySummary || state.memorySummary,
          })
        }
      },

      /**
       * Get current enhanced memory
       */
      getEnhancedMemory: (): ConversationMemory | null => {
        return get().enhancedMemory
      },

      // ========================================================================
      // USER MEMORY CONTROL (Check #5)
      // ========================================================================

      /**
       * Reset all learned memory (preferences, patterns, facts)
       * User control: allows user to start fresh without clearing conversation history
       */
      resetMemory: () => {
        const now = new Date().toISOString()

        set({
          enhancedMemory: null,
          memorySummary: null,
          memoryLastResetAt: now,
        })

        analytics.track('coach_memory_reset', {
          timestamp: now,
        })
      },

      /**
       * Toggle memory collection on/off
       * User control: allows user to opt-out of preference learning
       */
      toggleMemory: (enabled: boolean) => {
        set({ memoryEnabled: enabled })

        // If disabling, optionally clear existing memory
        if (!enabled) {
          set({
            enhancedMemory: null,
            memorySummary: null,
          })
        }

        analytics.track('coach_memory_toggled', {
          enabled,
        })
      },

      /**
       * Get memory statistics for settings UI
       */
      getMemoryStats: () => {
        const state = get()
        const memory = state.enhancedMemory

        if (!memory) {
          return {
            totalFacts: 0,
            preferences: 0,
            patterns: 0,
            enabled: state.memoryEnabled,
          }
        }

        const preferences =
          (memory.userPreferences.foodLikes?.length || 0) +
          (memory.userPreferences.foodDislikes?.length || 0) +
          (memory.userPreferences.mealPreferences?.length || 0) +
          (memory.userPreferences.timingPreferences?.length || 0)

        const patterns =
          (memory.patterns.frequentIntents?.length || 0) +
          (memory.patterns.timePatterns?.length || 0) +
          (memory.patterns.triggerPatterns?.length || 0)

        return {
          totalFacts: memory.learnedFacts?.length || 0,
          preferences,
          patterns,
          enabled: state.memoryEnabled,
        }
      },
    }),
    {
      name: 'lym-conversation-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Persist conversation turns (limited to last 50 for storage)
        turns: state.turns.slice(-50),
        // Persist daily limits
        messagesToday: state.messagesToday,
        llmCallsToday: state.llmCallsToday,
        lastResetDate: state.lastResetDate,
        // Persist memory summary
        memorySummary: state.memorySummary,
        // Persist enhanced memory
        enhancedMemory: state.enhancedMemory,
        // Persist user memory control settings
        memoryEnabled: state.memoryEnabled,
        memoryLastResetAt: state.memoryLastResetAt,
        // Persist experiment group
        experimentGroup: state.experimentGroup,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)

        // Check if daily limits need reset
        const today = new Date().toDateString()
        if (state && state.lastResetDate !== today) {
          state.messagesToday = 0
          state.llmCallsToday = 0
          state.lastResetDate = today
        }
      },
    }
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Get last assistant message
 */
export const useLastAssistantMessage = () => {
  return useConversationStore((s) => {
    const assistantTurns = s.turns.filter(t => t.role === 'assistant')
    return assistantTurns[assistantTurns.length - 1]?.response
  })
}

/**
 * Get conversation length
 */
export const useConversationLength = () => {
  return useConversationStore((s) => s.turns.length)
}

/**
 * Check if processing
 */
export const useIsProcessing = () => {
  return useConversationStore((s) => s.isProcessing)
}

// ============================================================================
// EXPORT
// ============================================================================

export default useConversationStore
