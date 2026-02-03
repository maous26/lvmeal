/**
 * Test Suite 1: Conversation Intent Detection Service
 *
 * Tests for intent detection pipeline:
 * - Pattern matching
 * - Entity extraction
 * - Confidence calculation
 * - Safety flag detection
 */

import { conversationIntentService } from '../../services/conversation-intent-service'
import type { ConversationContextFull, UserIntent } from '../../types/conversation'

// Mock context for testing
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

describe('ConversationIntentService', () => {
  describe('detectIntent', () => {
    // ========== PHYSICAL NEEDS INTENTS ==========

    it('should detect HUNGER intent for hunger expressions', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "J'ai faim",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('HUNGER')
      expect(result.topIntents[0].confidence).toBeGreaterThan(0.7)
    })

    it('should detect HUNGER intent with high confidence when lastMeal > 5h', async () => {
      const context = createMockContext({
        temporal: {
          ...createMockContext().temporal,
          hoursSinceLastMeal: 6,
        },
      })
      const result = await conversationIntentService.detectIntent(
        "Qu'est-ce que je pourrais manger ?",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('HUNGER')
      // Context boost should increase confidence
      expect(result.topIntents[0].confidence).toBeGreaterThan(0.8)
    })

    it('should detect CRAVING intent for specific food desires', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "J'ai envie de sucré",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('CRAVING')
      expect(result.topIntents[0].confidence).toBeGreaterThan(0.7)
    })

    it('should detect THIRST intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "J'ai soif",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('THIRST')
    })

    it('should detect FATIGUE intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "Je suis crevé",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('FATIGUE')
    })

    it('should boost FATIGUE confidence when sleep < 6h', async () => {
      const context = createMockContext({
        wellness: {
          ...createMockContext().wellness,
          sleepLastNight: { hours: 5, quality: 'poor' },
        },
      })
      const result = await conversationIntentService.detectIntent(
        "Pas la forme aujourd'hui",
        context,
        false,
        0
      )

      expect(['FATIGUE', 'LOW_ENERGY']).toContain(result.topIntents[0].intent)
      expect(result.topIntents[0].confidence).toBeGreaterThan(0.75)
    })

    // ========== EMOTIONAL INTENTS ==========

    it('should detect STRESS intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        'Journée difficile',
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('STRESS')
    })

    it('should boost STRESS confidence when stress eating pattern detected', async () => {
      const context = createMockContext({
        correlations: {
          ...createMockContext().correlations,
          stressEating: [{ type: 'stress_eating', description: 'Pattern detected' }],
        },
      })
      const result = await conversationIntentService.detectIntent(
        'Je suis stressé',
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('STRESS')
      expect(result.topIntents[0].confidence).toBeGreaterThan(0.8)
    })

    it('should detect CELEBRATION intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "J'ai réussi mon objectif !",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('CELEBRATION')
    })

    // ========== INFORMATION INTENTS ==========

    it('should detect PROGRESS_CHECK intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "Où j'en suis ?",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('PROGRESS_CHECK')
    })

    it('should detect NUTRITION_QUESTION intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "C'est bon les noix ?",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('NUTRITION_QUESTION')
    })

    // ========== DISENGAGEMENT INTENTS ==========

    it('should detect DOUBT intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        'Est-ce que ça sert à quelque chose ?',
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('DOUBT')
    })

    it('should detect OVERWHELM intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "C'est trop compliqué tout ça",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('OVERWHELM')
    })

    it('should detect PLATEAU intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "Je stagne depuis des semaines",
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('PLATEAU')
    })

    // ========== META-CONVERSATION INTENTS ==========

    it('should detect GREETING intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        'Salut !',
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('GREETING')
    })

    it('should detect HELP intent', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        'Comment ça marche ?',
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('HELP')
    })

    // ========== ENTITY EXTRACTION ==========

    it('should extract food entities', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "J'ai envie d'une pizza",
        context,
        false,
        0
      )

      expect(result.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'food' }),
        ])
      )
    })

    it('should extract meal type entities', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "Qu'est-ce que je mange pour le petit-déjeuner ?",
        context,
        false,
        0
      )

      expect(result.entities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'meal_type' }),
        ])
      )
    })

    // ========== SENTIMENT DETECTION ==========

    it('should detect positive sentiment', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "Super ! J'ai réussi !",
        context,
        false,
        0
      )

      expect(result.sentiment).toBe('positive')
    })

    it('should detect negative sentiment', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "Je suis nul, ça marche pas",
        context,
        false,
        0
      )

      expect(result.sentiment).toBe('negative')
    })

    // ========== URGENCY DETECTION ==========

    it('should detect high urgency for distress signals', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "J'ai vraiment besoin d'aide maintenant",
        context,
        false,
        0
      )

      expect(result.urgency).toBe('high')
    })

    // ========== TOP 3 INTENTS ==========

    it('should return top 3 intents sorted by confidence', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        "J'ai faim et je suis fatigué",
        context,
        false,
        0
      )

      expect(result.topIntents).toHaveLength(3)
      expect(result.topIntents[0].confidence).toBeGreaterThanOrEqual(
        result.topIntents[1]?.confidence || 0
      )
    })

    // ========== UNKNOWN INTENT ==========

    it('should return UNKNOWN for gibberish', async () => {
      const context = createMockContext()
      const result = await conversationIntentService.detectIntent(
        'asdfghjkl',
        context,
        false,
        0
      )

      expect(result.topIntents[0].intent).toBe('UNKNOWN')
    })
  })
})
