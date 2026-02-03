/**
 * Test Suite 3: Conversation Action Service
 *
 * Tests for action validation and execution:
 * - Whitelist validation
 * - Param schema validation
 * - Tier permission checks
 * - Forced confirmation for sensitive actions
 * - Daily limits
 */

import { conversationActionService } from '../../services/conversation-action-service'
import type { ConversationAction, ConversationContextFull, ActionType } from '../../types/conversation'

// Mock context
const createMockContext = (isPremium = false): ConversationContextFull => ({
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
    isPremium,
    daysInApp: 10,
    preferredLanguage: 'fr',
  },
})

describe('ConversationActionService', () => {
  describe('validateAction', () => {
    // ========== WHITELIST VALIDATION ==========

    it('should accept whitelisted action types', () => {
      const context = createMockContext()
      const action: ConversationAction = {
        type: 'SUGGEST_MEAL',
        label: 'Voir une suggestion',
        params: {},
        requiresConfirmation: false,
        isPremium: false,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(true)
    })

    it('should reject unknown action types', () => {
      const context = createMockContext()
      const action: ConversationAction = {
        type: 'HACK_SYSTEM' as ActionType,
        label: 'Hack',
        params: {},
        requiresConfirmation: false,
        isPremium: false,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Action type 'HACK_SYSTEM' is not allowed")
    })

    // ========== TIER PERMISSION CHECKS ==========

    it('should allow free tier actions for free users', () => {
      const context = createMockContext(false)
      const action: ConversationAction = {
        type: 'SHOW_PROGRESS',
        label: 'Voir mes progrès',
        params: {},
        requiresConfirmation: false,
        isPremium: false,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(true)
    })

    it('should reject premium actions for free users', () => {
      const context = createMockContext(false)
      const action: ConversationAction = {
        type: 'ADJUST_CALORIES',
        label: 'Ajuster mes calories',
        params: { adjustment: 100 },
        requiresConfirmation: true,
        isPremium: true,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain("Action 'ADJUST_CALORIES' requires Premium")
    })

    it('should allow premium actions for premium users', () => {
      const context = createMockContext(true)
      const action: ConversationAction = {
        type: 'ADJUST_CALORIES',
        label: 'Ajuster mes calories',
        params: { adjustment: 100 },
        requiresConfirmation: true,
        isPremium: true,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(true)
    })

    // ========== PARAM VALIDATION ==========

    it('should validate required params', () => {
      const context = createMockContext(true)
      const action: ConversationAction = {
        type: 'ADJUST_CALORIES',
        label: 'Ajuster',
        params: {}, // Missing required 'adjustment' param
        requiresConfirmation: true,
        isPremium: true,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Missing required param: adjustment')
    })

    it('should validate param types', () => {
      const context = createMockContext(true)
      const action: ConversationAction = {
        type: 'ADJUST_CALORIES',
        label: 'Ajuster',
        params: { adjustment: 'beaucoup' }, // Should be number
        requiresConfirmation: true,
        isPremium: true,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(false)
    })

    it('should validate param bounds', () => {
      const context = createMockContext(true)
      const action: ConversationAction = {
        type: 'ADJUST_CALORIES',
        label: 'Ajuster',
        params: { adjustment: 1000 }, // Max is 500
        requiresConfirmation: true,
        isPremium: true,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(false)
    })

    it('should reject unknown params', () => {
      const context = createMockContext()
      const action: ConversationAction = {
        type: 'SUGGEST_MEAL',
        label: 'Suggérer',
        params: {
          mealType: 'lunch',
          hackParam: 'malicious', // Unknown param
        },
        requiresConfirmation: false,
        isPremium: false,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.errors).toContain('Unknown param: hackParam')
    })

    // ========== FORCED CONFIRMATION (Check #3) ==========

    it('should force requiresConfirmation for ADJUST_CALORIES', () => {
      const context = createMockContext(true)
      const action: ConversationAction = {
        type: 'ADJUST_CALORIES',
        label: 'Ajuster',
        params: { adjustment: 100 },
        requiresConfirmation: false, // LLM said false
        isPremium: true,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(true)
      // But sanitized action should have true
      expect(result.sanitizedAction?.requiresConfirmation).toBe(true)
    })

    it('should force requiresConfirmation for START_CHALLENGE', () => {
      const context = createMockContext(true)
      const action: ConversationAction = {
        type: 'START_CHALLENGE',
        label: 'Démarrer',
        params: { challengeId: 'challenge_123' },
        requiresConfirmation: false,
        isPremium: true,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.sanitizedAction?.requiresConfirmation).toBe(true)
    })

    it('should force requiresConfirmation for SCHEDULE_REMINDER', () => {
      const context = createMockContext(true)
      const action: ConversationAction = {
        type: 'SCHEDULE_REMINDER',
        label: 'Programmer',
        params: { message: 'Rappel repas' },
        requiresConfirmation: false,
        isPremium: true,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.sanitizedAction?.requiresConfirmation).toBe(true)
    })

    // ========== LABEL SANITIZATION ==========

    it('should sanitize labels with XSS attempts', () => {
      const context = createMockContext()
      const action: ConversationAction = {
        type: 'SUGGEST_MEAL',
        label: '<script>alert("xss")</script>Suggérer',
        params: {},
        requiresConfirmation: false,
        isPremium: false,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.isValid).toBe(true)
      expect(result.sanitizedAction?.label).not.toContain('<script>')
      expect(result.sanitizedAction?.label).toContain('Suggérer')
    })

    it('should truncate long labels', () => {
      const context = createMockContext()
      const longLabel = 'A'.repeat(200)
      const action: ConversationAction = {
        type: 'SUGGEST_MEAL',
        label: longLabel,
        params: {},
        requiresConfirmation: false,
        isPremium: false,
      }

      const result = conversationActionService.validateAction(action, context)
      expect(result.sanitizedAction?.label.length).toBeLessThanOrEqual(100)
    })
  })

  describe('executeAction', () => {
    // ========== CONFIRMATION REQUIREMENT ==========

    it('should require confirmation for sensitive actions', async () => {
      const context = createMockContext(true)
      const action: ConversationAction = {
        type: 'ADJUST_CALORIES',
        label: 'Ajuster',
        params: { adjustment: 100 },
        requiresConfirmation: true,
        isPremium: true,
      }

      // Execute without confirmation
      const result = await conversationActionService.executeAction(
        action,
        context,
        false // userConfirmed = false
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('confirmation explicite')
    })

    it('should execute sensitive actions with confirmation', async () => {
      const context = createMockContext(true)
      const action: ConversationAction = {
        type: 'ADJUST_CALORIES',
        label: 'Ajuster',
        params: { adjustment: 100 },
        requiresConfirmation: true,
        isPremium: true,
      }

      const result = await conversationActionService.executeAction(
        action,
        context,
        true // userConfirmed = true
      )

      expect(result.success).toBe(true)
    })

    // ========== SAFE ACTIONS EXECUTION ==========

    it('should execute SUGGEST_MEAL without confirmation', async () => {
      const context = createMockContext()
      const action: ConversationAction = {
        type: 'SUGGEST_MEAL',
        label: 'Suggérer',
        params: { mealType: 'lunch' },
        requiresConfirmation: false,
        isPremium: false,
      }

      const result = await conversationActionService.executeAction(action, context)
      expect(result.success).toBe(true)
    })

    it('should execute NAVIGATE_TO', async () => {
      const context = createMockContext()
      const action: ConversationAction = {
        type: 'NAVIGATE_TO',
        label: 'Aller aux progrès',
        params: { screen: 'Progress' },
        requiresConfirmation: false,
        isPremium: false,
      }

      const result = await conversationActionService.executeAction(action, context)
      expect(result.success).toBe(true)
      expect(result.result).toEqual(
        expect.objectContaining({ action: 'navigate', screen: 'Progress' })
      )
    })

    it('should execute START_BREATHING', async () => {
      const context = createMockContext()
      const action: ConversationAction = {
        type: 'START_BREATHING',
        label: 'Respiration',
        params: { technique: '4-7-8' },
        requiresConfirmation: false,
        isPremium: false,
      }

      const result = await conversationActionService.executeAction(action, context)
      expect(result.success).toBe(true)
    })

    // ========== VALIDATION IN EXECUTION ==========

    it('should validate before executing', async () => {
      const context = createMockContext(false)
      const action: ConversationAction = {
        type: 'ADJUST_CALORIES', // Premium only
        label: 'Ajuster',
        params: { adjustment: 100 },
        requiresConfirmation: true,
        isPremium: true,
      }

      const result = await conversationActionService.executeAction(action, context)
      expect(result.success).toBe(false)
      expect(result.error).toContain('Premium')
    })
  })

  describe('buildValidActions', () => {
    it('should filter invalid actions', () => {
      const context = createMockContext(false)
      const proposedActions: Partial<ConversationAction>[] = [
        { type: 'SUGGEST_MEAL', label: 'Suggérer', params: {} },
        { type: 'ADJUST_CALORIES', label: 'Ajuster', params: { adjustment: 100 } }, // Premium only
        { type: 'SHOW_PROGRESS', label: 'Progrès', params: {} },
      ]

      const result = conversationActionService.buildValidActions(proposedActions, context)

      expect(result).toHaveLength(2)
      expect(result.map(a => a.type)).toContain('SUGGEST_MEAL')
      expect(result.map(a => a.type)).toContain('SHOW_PROGRESS')
      expect(result.map(a => a.type)).not.toContain('ADJUST_CALORIES')
    })

    it('should limit to 3 actions', () => {
      const context = createMockContext()
      const proposedActions: Partial<ConversationAction>[] = [
        { type: 'SUGGEST_MEAL', label: '1', params: {} },
        { type: 'SHOW_PROGRESS', label: '2', params: {} },
        { type: 'START_BREATHING', label: '3', params: {} },
        { type: 'NAVIGATE_TO', label: '4', params: { screen: 'Home' } },
        { type: 'LOG_MEAL_QUICK', label: '5', params: {} },
      ]

      const result = conversationActionService.buildValidActions(proposedActions, context)

      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('should skip actions without type or label', () => {
      const context = createMockContext()
      const proposedActions: Partial<ConversationAction>[] = [
        { type: 'SUGGEST_MEAL', label: 'Valid', params: {} },
        { label: 'No type', params: {} }, // Missing type
        { type: 'SHOW_PROGRESS', params: {} }, // Missing label
      ]

      const result = conversationActionService.buildValidActions(proposedActions, context)

      expect(result).toHaveLength(1)
      expect(result[0].label).toBe('Valid')
    })
  })
})
