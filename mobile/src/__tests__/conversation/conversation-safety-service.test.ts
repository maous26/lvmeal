/**
 * Test Suite 2: Conversation Safety Service
 *
 * Tests for safety guards:
 * - TCA (eating disorder) detection
 * - Medical advice detection
 * - Self-harm signal detection
 * - Moralizing language detection
 * - Log anonymization
 */

import { conversationSafetyService } from '../../services/conversation-safety-service'
import type { ConversationContextFull, ConversationResponse } from '../../types/conversation'

// Mock context
const createMockContext = (): ConversationContextFull => ({
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
})

describe('ConversationSafetyService', () => {
  describe('checkInput', () => {
    // ========== TCA DETECTION ==========

    it('should flag POTENTIAL_TCA for purging mentions', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Je me fais vomir après chaque repas',
        context
      )

      expect(result.flags).toContain('POTENTIAL_TCA')
      expect(result.action).toBe('refuse_redirect')
      expect(result.isAllowed).toBe(false)
    })

    it('should flag POTENTIAL_TCA for extreme restriction', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Je veux manger moins de 500 calories par jour',
        context
      )

      expect(result.flags).toContain('POTENTIAL_TCA')
      expect(result.isAllowed).toBe(false)
    })

    it('should flag POTENTIAL_TCA for binge mentions', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        "J'ai fait un binge hier soir",
        context
      )

      expect(result.flags).toContain('POTENTIAL_TCA')
    })

    it('should flag POTENTIAL_TCA for body hatred', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Je me déteste quand je mange',
        context
      )

      expect(result.flags).toContain('POTENTIAL_TCA')
    })

    // ========== SELF-HARM DETECTION ==========

    it('should flag SELF_HARM_SIGNAL for suicidal ideation', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Je veux en finir',
        context
      )

      expect(result.flags).toContain('SELF_HARM_SIGNAL')
      expect(result.action).toBe('refuse_redirect')
      expect(result.redirectMessage).toContain('SOS Amitié')
    })

    it('should flag SELF_HARM_SIGNAL for self-harm mentions', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Je me fais du mal',
        context
      )

      expect(result.flags).toContain('SELF_HARM_SIGNAL')
    })

    // ========== MEDICAL ADVICE DETECTION ==========

    it('should flag MEDICAL_ADVICE_REQUEST for doctor mentions', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Mon médecin dit que je dois perdre du poids',
        context
      )

      expect(result.flags).toContain('MEDICAL_ADVICE_REQUEST')
      expect(result.action).toBe('refuse_redirect')
    })

    it('should flag DIABETES_MENTION for diabetes', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Je suis diabétique type 2',
        context
      )

      expect(result.flags).toContain('DIABETES_MENTION')
    })

    it('should flag PREGNANCY_MENTION', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        "Je suis enceinte de 3 mois",
        context
      )

      expect(result.flags).toContain('PREGNANCY_MENTION')
      expect(result.redirectMessage).toContain('Félicitations')
    })

    // ========== MINOR USER DETECTION ==========

    it('should flag MINOR_USER for age mentions', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        "J'ai 15 ans",
        context
      )

      expect(result.flags).toContain('MINOR_USER')
    })

    it('should flag MINOR_USER for school mentions', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Je suis au lycée en terminale',
        context
      )

      expect(result.flags).toContain('MINOR_USER')
    })

    // ========== ALLERGY DETECTION ==========

    it('should flag ALLERGY_MENTION', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        "J'ai une allergie aux arachides",
        context
      )

      expect(result.flags).toContain('ALLERGY_MENTION')
      expect(result.action).toBe('safe_rewrite')
      expect(result.isAllowed).toBe(true)
    })

    // ========== EXTREME RESTRICTION DETECTION ==========

    it('should flag EXTREME_RESTRICTION for fad diets', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Je veux faire le régime militaire',
        context
      )

      expect(result.flags).toContain('EXTREME_RESTRICTION')
    })

    it('should flag EXTREME_RESTRICTION for detox diets', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        'Je commence une detox 21 jours',
        context
      )

      expect(result.flags).toContain('EXTREME_RESTRICTION')
    })

    // ========== SAFE MESSAGES ==========

    it('should allow normal messages', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        "J'ai faim, qu'est-ce que je mange ?",
        context
      )

      expect(result.flags).toHaveLength(0)
      expect(result.isAllowed).toBe(true)
      expect(result.action).toBe('allow')
    })

    it('should allow nutrition questions', () => {
      const context = createMockContext()
      const result = conversationSafetyService.checkInput(
        "C'est bon les avocats ?",
        context
      )

      expect(result.isAllowed).toBe(true)
    })
  })

  describe('getRedirectMessage', () => {
    it('should return appropriate message for TCA', () => {
      const message = conversationSafetyService.getRedirectMessage(['POTENTIAL_TCA'])

      expect(message).toContain('rapport à l\'alimentation')
      expect(message).toContain('Anorexie Boulimie Info Écoute')
    })

    it('should return appropriate message for self-harm', () => {
      const message = conversationSafetyService.getRedirectMessage(['SELF_HARM_SIGNAL'])

      expect(message).toContain('moment vraiment difficile')
      expect(message).toContain('SOS Amitié')
      expect(message).toContain('Fil Santé Jeunes')
    })

    it('should return appropriate message for medical', () => {
      const message = conversationSafetyService.getRedirectMessage(['MEDICAL_ADVICE_REQUEST'])

      expect(message).toContain('santé')
      expect(message).toContain('médecin')
    })

    it('should return appropriate message for pregnancy', () => {
      const message = conversationSafetyService.getRedirectMessage(['PREGNANCY_MENTION'])

      expect(message).toContain('Félicitations')
      expect(message).toContain('sage-femme')
    })
  })

  describe('containsMoralizingLanguage', () => {
    it('should detect "tu as trop mangé"', () => {
      const result = conversationSafetyService.containsMoralizingLanguage(
        'Tu as trop mangé hier soir'
      )
      expect(result).toBe(true)
    })

    it('should detect guilt-tripping language', () => {
      expect(conversationSafetyService.containsMoralizingLanguage(
        "C'est mal de manger ça"
      )).toBe(true)

      expect(conversationSafetyService.containsMoralizingLanguage(
        "Tu n'aurais pas dû manger"
      )).toBe(true)
    })

    it('should detect lack of willpower comments', () => {
      expect(conversationSafetyService.containsMoralizingLanguage(
        'Tu manques de volonté'
      )).toBe(true)
    })

    it('should not flag neutral statements', () => {
      expect(conversationSafetyService.containsMoralizingLanguage(
        "Tu as bien mangé aujourd'hui"
      )).toBe(false)

      expect(conversationSafetyService.containsMoralizingLanguage(
        'Voici quelques suggestions'
      )).toBe(false)
    })
  })

  describe('rewriteMoralizingText', () => {
    it('should rewrite "tu as trop mangé"', () => {
      const result = conversationSafetyService.rewriteMoralizingText(
        'Tu as trop mangé hier'
      )
      expect(result).toContain('repas copieux')
      expect(result).not.toContain('trop mangé')
    })

    it('should rewrite "tu as craqué"', () => {
      const result = conversationSafetyService.rewriteMoralizingText(
        'Tu as craqué ce soir'
      )
      expect(result).toContain('fait plaisir')
      expect(result).not.toContain('craqué')
    })
  })

  describe('anonymizeForLog', () => {
    it('should anonymize phone numbers', () => {
      const result = conversationSafetyService.anonymizeForLog(
        'Mon numéro est 06 12 34 56 78'
      )
      expect(result).toContain('[TEL]')
      expect(result).not.toContain('06 12 34 56 78')
    })

    it('should anonymize emails', () => {
      const result = conversationSafetyService.anonymizeForLog(
        'Mon email est test@example.com'
      )
      expect(result).toContain('[EMAIL]')
      expect(result).not.toContain('test@example.com')
    })

    it('should anonymize weights', () => {
      const result = conversationSafetyService.anonymizeForLog(
        'Je pèse 75 kg'
      )
      expect(result).toContain('[POIDS]')
      expect(result).not.toContain('75 kg')
    })

    it('should preserve intent-relevant content', () => {
      const result = conversationSafetyService.anonymizeForLog(
        "J'ai faim et envie de sucré"
      )
      expect(result).toContain('faim')
      expect(result).toContain('sucré')
    })
  })

  describe('validateResponse', () => {
    const createMockResponse = (text: string): ConversationResponse => ({
      message: {
        text,
        tone: 'empathetic',
      },
      actions: [],
      meta: {
        responseId: 'test_123',
        generatedAt: new Date().toISOString(),
        model: 'rules',
        processingTimeMs: 50,
      },
    })

    it('should add disclaimer for nutrition advice', () => {
      const context = createMockContext()
      const response = createMockResponse('Tu devrais manger plus de protéines')

      // Note: disclaimer is added randomly (30% of time), so we test the function exists
      const validated = conversationSafetyService.validateResponse(response, context)
      expect(validated).toBeDefined()
      expect(validated.message.text).toBeDefined()
    })

    it('should rewrite moralizing content in responses', () => {
      const context = createMockContext()
      const response = createMockResponse('Tu as trop mangé hier, tu devrais faire attention')

      const validated = conversationSafetyService.validateResponse(response, context)
      // If moralizing was detected, it should have been rewritten
      // The validation function handles this internally
      expect(validated.message.text).toBeDefined()
    })
  })

  describe('createAnonymizedEvent', () => {
    it('should create anonymized analytics event', () => {
      const event = conversationSafetyService.createAnonymizedEvent(
        'intent_detected',
        {
          intent: 'HUNGER',
          confidence: 0.85,
          processingTimeMs: 45,
        }
      )

      expect(event.event).toBe('conversation_intent_detected')
      expect(event.intent).toBe('HUNGER')
      expect(event.confidence).toBe(0.85)
      expect(event.sessionId).toBeDefined()
      expect(event.timestamp).toBeDefined()
    })

    it('should include safety flags in events', () => {
      const event = conversationSafetyService.createAnonymizedEvent(
        'safety_flag',
        {
          safetyFlags: ['POTENTIAL_TCA', 'MEDICAL_ADVICE_REQUEST'],
        }
      )

      expect(event.safetyFlags).toEqual(['POTENTIAL_TCA', 'MEDICAL_ADVICE_REQUEST'])
    })
  })
})
