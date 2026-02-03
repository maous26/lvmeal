/**
 * Test Suite 4: Conversation Response Service
 *
 * Tests for response generation:
 * - Template selection
 * - Slot filling
 * - Short term plan generation (Premium)
 * - Quick replies
 * - Diagnosis generation
 */

import { conversationResponseService } from '../../services/conversation-response-service'
import type { ConversationContextFull, IntentDetectionResult } from '../../types/conversation'

// Mock context
const createMockContext = (overrides?: Partial<ConversationContextFull>): ConversationContextFull => ({
  nutrition: {
    caloriesConsumed: 800,
    caloriesRemaining: 1200,
    caloriesTarget: 2000,
    macroBalance: { proteins: 40, carbs: 100, fats: 30 },
    macroTargets: { proteins: 100, carbs: 200, fats: 70 },
    lastMealTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
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
  ...overrides,
})

const createMockIntentResult = (
  intent: string,
  confidence = 0.85
): IntentDetectionResult => ({
  topIntents: [
    { intent: intent as any, confidence },
    { intent: 'UNKNOWN', confidence: 0.1 },
    { intent: 'UNKNOWN', confidence: 0.05 },
  ],
  entities: [],
  sentiment: 'neutral',
  urgency: 'medium',
  safetyFlags: [],
})

describe('ConversationResponseService', () => {
  describe('generateResponse', () => {
    // ========== BASIC RESPONSE GENERATION ==========

    it('should generate response with message', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('HUNGER')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.message.text).toBeTruthy()
      expect(response.message.tone).toBeTruthy()
    })

    it('should include responseId and metadata', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('GREETING')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.meta.responseId).toMatch(/^resp_/)
      expect(response.meta.generatedAt).toBeTruthy()
      expect(response.meta.model).toBe('rules')
      expect(response.meta.processingTimeMs).toBeGreaterThanOrEqual(0)
    })

    // ========== SLOT FILLING ==========

    it('should fill {name} slot with user firstName', () => {
      const context = createMockContext({ user: { ...createMockContext().user, firstName: 'Sophie' } })
      const intentResult = createMockIntentResult('GREETING')

      const response = conversationResponseService.generateResponse(intentResult, context)

      // Some greeting templates include {name}
      // The name should be filled or slot removed
      expect(response.message.text).not.toContain('{name}')
    })

    it('should fill {calories} slot', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('HUNGER')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.message.text).not.toContain('{calories}')
      // Should contain the actual calorie value or be cleaned up
    })

    it('should handle missing slots gracefully', () => {
      const context = createMockContext({ user: { ...createMockContext().user, firstName: null } })
      const intentResult = createMockIntentResult('GREETING')

      const response = conversationResponseService.generateResponse(intentResult, context)

      // Should not contain unfilled slots
      expect(response.message.text).not.toMatch(/\{[^}]+\}/)
    })

    // ========== TONE SELECTION ==========

    it('should use empathetic tone for stress', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('STRESS')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.message.tone).toBe('empathetic')
    })

    it('should use celebratory tone for celebration', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('CELEBRATION')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.message.tone).toBe('celebratory')
    })

    it('should use informative tone for progress check', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('PROGRESS_CHECK')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.message.tone).toBe('informative')
    })

    // ========== QUICK REPLIES ==========

    it('should include quick replies', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('GREETING')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.ui?.quickReplies).toBeDefined()
      expect(response.ui?.quickReplies?.length).toBeGreaterThan(0)
      expect(response.ui?.quickReplies?.length).toBeLessThanOrEqual(3)
    })

    it('should include relevant quick replies for hunger', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('HUNGER')

      const response = conversationResponseService.generateResponse(intentResult, context)

      const labels = response.ui?.quickReplies?.map(qr => qr.label) || []
      // Should have meal-related quick replies
      expect(labels.some(l => l.toLowerCase().includes('repas') || l.toLowerCase().includes('mangé'))).toBe(true)
    })

    // ========== ACTIONS ==========

    it('should include relevant actions for hunger', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('HUNGER')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.actions.length).toBeGreaterThan(0)
      expect(response.actions.some(a => a.type === 'SUGGEST_MEAL')).toBe(true)
    })

    it('should include breathing action for stress', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('STRESS')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.actions.some(a => a.type === 'START_BREATHING')).toBe(true)
    })

    it('should include show progress action for progress check', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('PROGRESS_CHECK')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.actions.some(a => a.type === 'SHOW_PROGRESS')).toBe(true)
    })

    // ========== DIAGNOSIS (Premium Feature) ==========

    it('should include diagnosis for premium users', () => {
      const context = createMockContext({ user: { ...createMockContext().user, isPremium: true } })
      const intentResult = createMockIntentResult('HUNGER')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.diagnosis).toBeDefined()
      expect(response.diagnosis?.factors).toBeDefined()
      expect(response.diagnosis?.factors?.length).toBeGreaterThan(0)
    })

    it('should show diagnosis toggle for premium', () => {
      const context = createMockContext({ user: { ...createMockContext().user, isPremium: true } })
      const intentResult = createMockIntentResult('HUNGER')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.ui?.showDiagnosisToggle).toBe(true)
    })

    it('should not show diagnosis toggle for free users', () => {
      const context = createMockContext({ user: { ...createMockContext().user, isPremium: false } })
      const intentResult = createMockIntentResult('HUNGER')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.ui?.showDiagnosisToggle).toBeFalsy()
    })

    // ========== SHORT TERM PLAN (Premium Feature) ==========

    it('should generate short term plan for premium users', () => {
      const context = createMockContext({ user: { ...createMockContext().user, isPremium: true } })
      const intentResult = createMockIntentResult('HUNGER')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.shortTermPlan).toBeDefined()
      expect(response.shortTermPlan?.steps).toBeDefined()
      expect(response.shortTermPlan?.steps?.length).toBeGreaterThan(0)
      expect(response.shortTermPlan?.expectedOutcome).toBeTruthy()
    })

    it('should not generate short term plan for free users', () => {
      const context = createMockContext({ user: { ...createMockContext().user, isPremium: false } })
      const intentResult = createMockIntentResult('HUNGER')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.shortTermPlan).toBeUndefined()
    })

    it('should generate stress plan with breathing exercise', () => {
      const context = createMockContext({ user: { ...createMockContext().user, isPremium: true } })
      const intentResult = createMockIntentResult('STRESS')

      const response = conversationResponseService.generateResponse(intentResult, context)

      const planActions = response.shortTermPlan?.steps?.map(s => s.action) || []
      expect(planActions.some(a => a.toLowerCase().includes('respiration'))).toBe(true)
    })

    it('should generate simplification plan for overwhelm', () => {
      const context = createMockContext({ user: { ...createMockContext().user, isPremium: true } })
      const intentResult = createMockIntentResult('OVERWHELM')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.shortTermPlan?.expectedOutcome).toContain('douceur')
    })

    // ========== TEMPLATE ROTATION ==========

    it('should rotate templates to avoid repetition', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('GREETING')

      const responses: string[] = []
      for (let i = 0; i < 5; i++) {
        const response = conversationResponseService.generateResponse(intentResult, context)
        responses.push(response.message.text)
      }

      // Not all responses should be identical (templates rotate)
      const uniqueResponses = new Set(responses)
      expect(uniqueResponses.size).toBeGreaterThan(1)
    })

    // ========== CONTEXT-SPECIFIC RESPONSES ==========

    it('should mention stress-eating pattern when detected', () => {
      const context = createMockContext({
        correlations: {
          ...createMockContext().correlations,
          stressEating: [{ type: 'stress_eating', description: 'Pattern detected' }],
        },
      })
      const intentResult = createMockIntentResult('STRESS')

      const response = conversationResponseService.generateResponse(intentResult, context)

      // Response or diagnosis should reference the pattern
      const fullText = response.message.text + (response.diagnosis?.summary || '')
      const hasReference = fullText.toLowerCase().includes('stress') ||
        response.diagnosis?.factors?.some(f => f.label.toLowerCase().includes('stress'))

      expect(hasReference).toBe(true)
    })

    it('should adapt fatigue response based on sleep', () => {
      const context = createMockContext({
        wellness: {
          ...createMockContext().wellness,
          sleepLastNight: { hours: 5, quality: 'poor' },
        },
      })
      const intentResult = createMockIntentResult('FATIGUE')

      const response = conversationResponseService.generateResponse(intentResult, context)

      // Diagnosis should mention sleep
      const sleepFactor = response.diagnosis?.factors?.find(f =>
        f.label.toLowerCase().includes('sommeil')
      )
      expect(sleepFactor?.impact).toBe('high')
    })

    // ========== UNKNOWN INTENT HANDLING ==========

    it('should handle UNKNOWN intent gracefully', () => {
      const context = createMockContext()
      const intentResult = createMockIntentResult('UNKNOWN')

      const response = conversationResponseService.generateResponse(intentResult, context)

      expect(response.message.text).toBeTruthy()
      expect(response.ui?.quickReplies?.length).toBeGreaterThan(0)
    })
  })
})
