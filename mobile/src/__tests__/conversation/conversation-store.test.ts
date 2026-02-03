/**
 * Test Suite 5: Conversation Store
 *
 * Tests for Zustand store:
 * - Message sending
 * - Limit tracking
 * - Memory management
 * - User memory control
 * - Metrics tracking
 */

import { renderHook, act, waitFor } from '@testing-library/react-native'

// Mock dependencies before importing store
jest.mock('../../services/conversation-context-service', () => ({
  conversationContextService: {
    buildFullContext: jest.fn(() => ({
      nutrition: {
        caloriesConsumed: 800,
        caloriesRemaining: 1200,
        caloriesTarget: 2000,
        macroBalance: { proteins: 40, carbs: 100, fats: 30 },
        macroTargets: { proteins: 100, carbs: 200, fats: 70 },
        lastMealTime: new Date().toISOString(),
        todayMeals: [],
        weeklyTrend: 'balanced',
        avgCaloriesLast7Days: 1900,
      },
      wellness: {
        currentMood: 'neutral',
        sleepLastNight: { hours: 7, quality: 'good' },
        stressLevel: 4,
        energyLevel: 6,
        hydration: 4,
        weight: 70,
        weightTrend: 'stable',
      },
      correlations: {
        sleepNutrition: [],
        stressEating: [],
        energyPatterns: [],
      },
      program: {
        currentPhase: 'Phase 1',
        dayInPhase: 5,
        phaseProgress: 35,
        upcomingMilestone: 'Semaine 2',
        totalDaysInProgram: 14,
      },
      gamification: {
        currentStreak: 5,
        level: 3,
        xp: 450,
        xpToNextLevel: 150,
        activeChallenge: null,
        recentAchievements: [],
      },
      conversationHistoryFull: [],
      temporal: {
        timeOfDay: 'midday',
        dayOfWeek: 3,
        isWeekend: false,
        hoursSinceLastMeal: 3,
        hoursSinceWakeup: 5,
        currentHour: 12,
      },
      user: {
        firstName: 'Marie',
        isPremium: false,
        daysInApp: 10,
        preferredLanguage: 'fr',
      },
    })),
    generateMemorySummary: jest.fn(() => 'Memory summary'),
    generateEnhancedMemory: jest.fn(() => ({
      userPreferences: {
        foodLikes: ['pizza'],
        foodDislikes: ['broccoli'],
        mealPreferences: ['quick meals'],
        timingPreferences: ['late dinner'],
      },
      patterns: {
        frequentIntents: ['HUNGER', 'STRESS'],
        timePatterns: ['evening snacker'],
        triggerPatterns: ['stress eating'],
      },
      conversationStats: {
        totalMessages: 25,
        averageSessionLength: 5,
        mostActiveTimeOfDay: 'evening',
      },
      learnedFacts: ['Préfère les repas rapides', 'Stress le soir'],
      lastUpdated: new Date().toISOString(),
    })),
    buildMemorySummaryFromEnhanced: jest.fn(() => 'Enhanced memory summary'),
  },
}))

jest.mock('../../services/conversation-intent-service', () => ({
  conversationIntentService: {
    detectIntent: jest.fn(() =>
      Promise.resolve({
        topIntents: [
          { intent: 'HUNGER', confidence: 0.9 },
          { intent: 'UNKNOWN', confidence: 0.05 },
          { intent: 'UNKNOWN', confidence: 0.05 },
        ],
        entities: [],
        sentiment: 'neutral',
        urgency: 'medium',
        safetyFlags: [],
      })
    ),
  },
}))

jest.mock('../../services/conversation-response-service', () => ({
  conversationResponseService: {
    generateResponse: jest.fn(() => ({
      message: {
        text: "Je comprends que tu aies faim ! Voici ce que je te propose.",
        tone: 'empathetic',
        emoji: '🍽️',
      },
      actions: [
        { type: 'SUGGEST_MEAL', label: 'Voir une suggestion', params: {}, requiresConfirmation: false, isPremium: false },
      ],
      ui: {
        quickReplies: [
          { label: 'Quelque chose de rapide', intent: 'MEAL_SUGGESTION' },
        ],
      },
      meta: {
        responseId: 'resp_123',
        generatedAt: new Date().toISOString(),
        model: 'rules',
        processingTimeMs: 45,
      },
    })),
  },
}))

jest.mock('../../services/conversation-safety-service', () => ({
  conversationSafetyService: {
    checkInput: jest.fn(() => ({
      isAllowed: true,
      flags: [],
      action: 'allow',
    })),
    validateResponse: jest.fn((response) => response),
  },
}))

jest.mock('../../services/analytics-service', () => ({
  analytics: {
    track: jest.fn(),
  },
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(() => null),
  removeItem: jest.fn(),
}))

import { useConversationStore } from '../../stores/conversation-store'

describe('ConversationStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useConversationStore.getState().reset()
  })

  describe('sendMessage', () => {
    it('should send message and receive response', async () => {
      const { result } = renderHook(() => useConversationStore())

      let response
      await act(async () => {
        response = await result.current.sendMessage("J'ai faim", false)
      })

      expect(response).toBeDefined()
      expect(response?.message.text).toBeTruthy()
    })

    it('should add turns to conversation history', async () => {
      const { result } = renderHook(() => useConversationStore())

      await act(async () => {
        await result.current.sendMessage("J'ai faim", false)
      })

      expect(result.current.turns).toHaveLength(2) // User + Assistant
      expect(result.current.turns[0].role).toBe('user')
      expect(result.current.turns[1].role).toBe('assistant')
    })

    it('should increment messagesToday', async () => {
      const { result } = renderHook(() => useConversationStore())

      const initialCount = result.current.messagesToday

      await act(async () => {
        await result.current.sendMessage("J'ai faim", false)
      })

      expect(result.current.messagesToday).toBe(initialCount + 1)
    })

    it('should update metrics', async () => {
      const { result } = renderHook(() => useConversationStore())

      await act(async () => {
        await result.current.sendMessage("J'ai faim", false)
      })

      expect(result.current.metrics.messagesInSession).toBe(1)
      expect(result.current.metrics.intentDistribution.HUNGER).toBe(1)
    })
  })

  describe('canSendMessage', () => {
    it('should allow messages under limit for free tier', () => {
      const { result } = renderHook(() => useConversationStore())

      expect(result.current.canSendMessage(false)).toBe(true)
    })

    it('should always allow for premium', () => {
      const { result } = renderHook(() => useConversationStore())

      expect(result.current.canSendMessage(true)).toBe(true)
    })

    it('should block when limit reached for free tier', async () => {
      const { result } = renderHook(() => useConversationStore())

      // Simulate reaching limit (10 messages for free)
      act(() => {
        useConversationStore.setState({ messagesToday: 10 })
      })

      expect(result.current.canSendMessage(false)).toBe(false)
    })
  })

  describe('getMessagesRemaining', () => {
    it('should return remaining count for free tier', () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        useConversationStore.setState({ messagesToday: 3 })
      })

      expect(result.current.getMessagesRemaining(false)).toBe(7) // 10 - 3
    })

    it('should return unlimited for premium', () => {
      const { result } = renderHook(() => useConversationStore())

      expect(result.current.getMessagesRemaining(true)).toBe('unlimited')
    })

    it('should not return negative', () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        useConversationStore.setState({ messagesToday: 15 })
      })

      expect(result.current.getMessagesRemaining(false)).toBe(0)
    })
  })

  describe('clearConversation', () => {
    it('should clear turns', async () => {
      const { result } = renderHook(() => useConversationStore())

      await act(async () => {
        await result.current.sendMessage("J'ai faim", false)
      })

      expect(result.current.turns.length).toBeGreaterThan(0)

      act(() => {
        result.current.clearConversation()
      })

      expect(result.current.turns).toHaveLength(0)
    })

    it('should generate new sessionId', async () => {
      const { result } = renderHook(() => useConversationStore())

      const oldSessionId = result.current.sessionId

      act(() => {
        result.current.clearConversation()
      })

      expect(result.current.sessionId).not.toBe(oldSessionId)
    })

    it('should reset metrics but keep daily counts', async () => {
      const { result } = renderHook(() => useConversationStore())

      await act(async () => {
        await result.current.sendMessage("J'ai faim", false)
      })

      const messageCount = result.current.messagesToday

      act(() => {
        result.current.clearConversation()
      })

      expect(result.current.metrics.messagesInSession).toBe(0)
      expect(result.current.messagesToday).toBe(messageCount) // Daily count preserved
    })
  })

  describe('User Memory Control (Check #5)', () => {
    it('should reset memory', async () => {
      const { result } = renderHook(() => useConversationStore())

      // Set some memory
      act(() => {
        useConversationStore.setState({
          enhancedMemory: {
            userPreferences: { foodLikes: ['pizza'], foodDislikes: [], mealPreferences: [], timingPreferences: [] },
            patterns: { frequentIntents: [], timePatterns: [], triggerPatterns: [] },
            conversationStats: { totalMessages: 10, averageSessionLength: 5, mostActiveTimeOfDay: 'evening' },
            learnedFacts: ['Test fact'],
            lastUpdated: new Date().toISOString(),
          },
          memorySummary: 'Test summary',
        })
      })

      expect(result.current.enhancedMemory).toBeTruthy()

      act(() => {
        result.current.resetMemory()
      })

      expect(result.current.enhancedMemory).toBeNull()
      expect(result.current.memorySummary).toBeNull()
      expect(result.current.memoryLastResetAt).toBeTruthy()
    })

    it('should toggle memory on/off', () => {
      const { result } = renderHook(() => useConversationStore())

      expect(result.current.memoryEnabled).toBe(true) // Default

      act(() => {
        result.current.toggleMemory(false)
      })

      expect(result.current.memoryEnabled).toBe(false)

      act(() => {
        result.current.toggleMemory(true)
      })

      expect(result.current.memoryEnabled).toBe(true)
    })

    it('should clear memory when disabled', () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        useConversationStore.setState({
          enhancedMemory: {
            userPreferences: { foodLikes: ['pizza'], foodDislikes: [], mealPreferences: [], timingPreferences: [] },
            patterns: { frequentIntents: [], timePatterns: [], triggerPatterns: [] },
            conversationStats: { totalMessages: 10, averageSessionLength: 5, mostActiveTimeOfDay: 'evening' },
            learnedFacts: ['Test fact'],
            lastUpdated: new Date().toISOString(),
          },
        })
      })

      act(() => {
        result.current.toggleMemory(false)
      })

      expect(result.current.enhancedMemory).toBeNull()
    })

    it('should return memory stats', () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        useConversationStore.setState({
          memoryEnabled: true,
          enhancedMemory: {
            userPreferences: {
              foodLikes: ['pizza', 'pasta'],
              foodDislikes: ['broccoli'],
              mealPreferences: ['quick meals'],
              timingPreferences: [],
            },
            patterns: {
              frequentIntents: ['HUNGER'],
              timePatterns: ['evening'],
              triggerPatterns: [],
            },
            conversationStats: { totalMessages: 10, averageSessionLength: 5, mostActiveTimeOfDay: 'evening' },
            learnedFacts: ['Fact 1', 'Fact 2'],
            lastUpdated: new Date().toISOString(),
          },
        })
      })

      const stats = result.current.getMemoryStats()

      expect(stats.enabled).toBe(true)
      expect(stats.totalFacts).toBe(2)
      expect(stats.preferences).toBe(4) // 2+1+1+0
      expect(stats.patterns).toBe(2) // 1+1+0
    })

    it('should not update memory when disabled', async () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        result.current.toggleMemory(false)
      })

      // Add many turns to trigger memory update
      act(() => {
        const turns = Array.from({ length: 12 }, (_, i) => ({
          id: `turn_${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant' as const,
          content: 'Test message',
          timestamp: new Date().toISOString(),
        }))
        useConversationStore.setState({ turns })
      })

      act(() => {
        result.current.updateEnhancedMemory()
      })

      // Memory should still be null because it's disabled
      expect(result.current.enhancedMemory).toBeNull()
    })
  })

  describe('Feedback tracking (Check #6)', () => {
    it('should track positive feedback', () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        result.current.trackFeedback(true)
      })

      expect(result.current.metrics.thumbsUp).toBe(1)
      expect(result.current.metrics.thumbsDown).toBe(0)
    })

    it('should track negative feedback', () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        result.current.trackFeedback(false)
      })

      expect(result.current.metrics.thumbsUp).toBe(0)
      expect(result.current.metrics.thumbsDown).toBe(1)
    })

    it('should track diagnosis viewed', () => {
      const { result } = renderHook(() => useConversationStore())

      act(() => {
        result.current.trackDiagnosisViewed()
        result.current.trackDiagnosisViewed()
      })

      expect(result.current.metrics.diagnosisViewed).toBe(2)
    })
  })

  describe('A/B Experiment', () => {
    it('should set experiment group', () => {
      const { result } = renderHook(() => useConversationStore())

      expect(result.current.experimentGroup).toBeNull()

      act(() => {
        result.current.setExperimentGroup('treatment')
      })

      expect(result.current.experimentGroup).toBe('treatment')
      expect(result.current.metrics.experimentGroup).toBe('treatment')
    })
  })

  describe('reset', () => {
    it('should reset all state', async () => {
      const { result } = renderHook(() => useConversationStore())

      // Add some state
      await act(async () => {
        await result.current.sendMessage("J'ai faim", false)
        result.current.setExperimentGroup('treatment')
        result.current.trackFeedback(true)
      })

      act(() => {
        result.current.reset()
      })

      expect(result.current.turns).toHaveLength(0)
      expect(result.current.messagesToday).toBe(0)
      expect(result.current.metrics.messagesInSession).toBe(0)
      expect(result.current.metrics.thumbsUp).toBe(0)
    })
  })
})
