/**
 * Signal Generation Service
 *
 * Transforms detected intents into actionable signals.
 * Signals are the bridge between user intent and system decisions.
 *
 * Intent → Signal → Decision → Action
 */

import {
  UserIntent,
  IntentDetectionResult,
  ConversationContextFull,
} from '../types/conversation'

// ============================================================================
// SIGNAL TYPES
// ============================================================================

export type SignalType =
  | 'NUTRITIONAL_NEED'
  | 'EMOTIONAL_STATE'
  | 'MOTIVATION_LEVEL'
  | 'KNOWLEDGE_GAP'
  | 'DECISION_POINT'
  | 'HABIT_DEVIATION'
  | 'GOAL_ALIGNMENT'
  | 'CELEBRATION_MOMENT'
  | 'SUPPORT_NEEDED'

export interface UserSignal {
  type: SignalType
  intensity: number        // 0-1
  source: 'explicit' | 'inferred' | 'contextual'
  confidence: number
  actionable: boolean
  priority: 'low' | 'medium' | 'high' | 'critical'
  relatedData: Record<string, unknown>
  suggestedAgents: string[]  // Which agents should handle this
}

// ============================================================================
// SIGNAL GENERATION SERVICE
// ============================================================================

class ConversationSignalService {
  /**
   * Transform detected intent into actionable signals
   */
  generateSignals(
    intent: IntentDetectionResult,
    context: ConversationContextFull
  ): UserSignal[] {
    const signals: UserSignal[] = []
    const primaryIntent = intent.topIntents[0]?.intent || 'UNKNOWN'
    const confidence = intent.topIntents[0]?.confidence || 0

    // Generate primary signal based on intent
    const primarySignal = this.generatePrimarySignal(primaryIntent, confidence, context)
    if (primarySignal) {
      signals.push(primarySignal)
    }

    // Generate secondary signals from context
    const contextSignals = this.generateContextualSignals(intent, context)
    signals.push(...contextSignals)

    // Generate inferred signals from correlations
    const inferredSignals = this.generateInferredSignals(intent, context)
    signals.push(...inferredSignals)

    // Sort by priority
    return this.prioritizeSignals(signals)
  }

  /**
   * Generate primary signal from main intent
   */
  private generatePrimarySignal(
    intent: UserIntent,
    confidence: number,
    context: ConversationContextFull
  ): UserSignal | null {
    switch (intent) {
      // ========== NUTRITIONAL NEEDS ==========
      case 'HUNGER':
        return {
          type: 'NUTRITIONAL_NEED',
          intensity: this.calculateHungerIntensity(context),
          source: 'explicit',
          confidence,
          actionable: true,
          priority: context.temporal.hoursSinceLastMeal > 5 ? 'high' : 'medium',
          relatedData: {
            caloriesRemaining: context.nutrition.caloriesRemaining,
            lastMealTime: context.nutrition.lastMealTime,
            suggestedMealType: this.determineMealType(context),
            hoursSinceLastMeal: context.temporal.hoursSinceLastMeal,
          },
          suggestedAgents: ['meal_plan_agent'],
        }

      case 'CRAVING':
        return {
          type: 'NUTRITIONAL_NEED',
          intensity: 0.6,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'medium',
          relatedData: {
            cravingType: 'unspecified', // Would be extracted from entities
            caloriesRemaining: context.nutrition.caloriesRemaining,
            stressEatingRisk: context.correlations.stressEating.length > 0,
          },
          suggestedAgents: ['meal_plan_agent', 'coach_proactive'],
        }

      case 'THIRST':
        return {
          type: 'NUTRITIONAL_NEED',
          intensity: 0.5,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'low',
          relatedData: {
            currentHydration: context.wellness.hydration,
            recommendedGlasses: Math.max(0, 8 - context.wellness.hydration),
          },
          suggestedAgents: ['wellness_program'],
        }

      // ========== EMOTIONAL STATES ==========
      case 'STRESS':
      case 'ANXIETY':
        return {
          type: 'EMOTIONAL_STATE',
          intensity: 0.7,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: intent === 'ANXIETY' ? 'high' : 'medium',
          relatedData: {
            stressLevel: context.wellness.stressLevel || 7,
            stressEatingRisk: context.correlations.stressEating.length > 0,
            stressEatingHistory: context.correlations.stressEating,
            sleepQuality: context.wellness.sleepLastNight?.quality,
            suggestedActions: ['breathing_exercise', 'healthy_comfort_food', 'walk'],
          },
          suggestedAgents: ['coach_proactive', 'wellness_program'],
        }

      case 'FRUSTRATION':
        return {
          type: 'EMOTIONAL_STATE',
          intensity: 0.6,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'medium',
          relatedData: {
            possibleCauses: this.analyzeFrustrationCauses(context),
            suggestedActions: ['simplify', 'quick_win', 'support'],
          },
          suggestedAgents: ['coach_proactive'],
        }

      case 'SADNESS':
        return {
          type: 'SUPPORT_NEEDED',
          intensity: 0.7,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'high',
          relatedData: {
            requiresEmpathy: true,
            suggestedTone: 'supportive',
          },
          suggestedAgents: ['coach_proactive'],
        }

      case 'CELEBRATION':
        return {
          type: 'CELEBRATION_MOMENT',
          intensity: 0.8,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'medium',
          relatedData: {
            currentStreak: context.gamification.currentStreak,
            recentAchievements: context.gamification.recentAchievements,
            suggestedReward: this.suggestReward(context),
          },
          suggestedAgents: ['gamification_store'],
        }

      // ========== FATIGUE / ENERGY ==========
      case 'FATIGUE':
      case 'LOW_ENERGY':
        return {
          type: 'NUTRITIONAL_NEED',
          intensity: this.calculateFatigueIntensity(context),
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'medium',
          relatedData: {
            sleepLastNight: context.wellness.sleepLastNight,
            hoursSinceLastMeal: context.temporal.hoursSinceLastMeal,
            hydration: context.wellness.hydration,
            possibleCauses: this.analyzeFatigueCauses(context),
            suggestedActions: this.suggestEnergyActions(context),
          },
          suggestedAgents: ['meal_plan_agent', 'wellness_program'],
        }

      // ========== PROGRESS & MOTIVATION ==========
      case 'PROGRESS_CHECK':
        return {
          type: 'KNOWLEDGE_GAP',
          intensity: 0.5,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'low',
          relatedData: {
            currentStreak: context.gamification.currentStreak,
            weeklyTrend: context.nutrition.weeklyTrend,
            phaseProgress: context.program.phaseProgress,
            weightTrend: context.wellness.weightTrend,
          },
          suggestedAgents: ['gamification_store', 'correlation_engine'],
        }

      case 'PLATEAU':
        return {
          type: 'MOTIVATION_LEVEL',
          intensity: 0.4,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'high',
          relatedData: {
            daysSinceProgress: this.calculateDaysSinceProgress(context),
            possibleCauses: this.analyzePlateauCauses(context),
            suggestedAdjustments: this.generatePlateauStrategy(context),
          },
          suggestedAgents: ['coach_proactive', 'wellness_program'],
        }

      case 'DOUBT':
        return {
          type: 'MOTIVATION_LEVEL',
          intensity: 0.3,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'high',
          relatedData: {
            daysInApp: context.user.daysInApp,
            currentStreak: context.gamification.currentStreak,
            evidenceOfProgress: this.gatherProgressEvidence(context),
          },
          suggestedAgents: ['coach_proactive', 'gamification_store'],
        }

      case 'OVERWHELM':
        return {
          type: 'SUPPORT_NEEDED',
          intensity: 0.6,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'high',
          relatedData: {
            simplificationNeeded: true,
            suggestedActions: ['simplify_goals', 'reduce_tracking', 'quick_win'],
          },
          suggestedAgents: ['coach_proactive'],
        }

      // ========== ACTION REQUESTS ==========
      case 'MEAL_SUGGESTION':
        return {
          type: 'DECISION_POINT',
          intensity: 0.7,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'medium',
          relatedData: {
            caloriesRemaining: context.nutrition.caloriesRemaining,
            mealType: this.determineMealType(context),
            preferences: [], // Would come from user profile
          },
          suggestedAgents: ['meal_plan_agent'],
        }

      case 'CHALLENGE_START':
        return {
          type: 'GOAL_ALIGNMENT',
          intensity: 0.7,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'medium',
          relatedData: {
            currentLevel: context.gamification.level,
            activeChallenge: context.gamification.activeChallenge,
            suggestedDifficulty: this.suggestChallengeDifficulty(context),
          },
          suggestedAgents: ['gamification_store', 'challenges_service'],
        }

      case 'PLAN_MODIFICATION':
        return {
          type: 'DECISION_POINT',
          intensity: 0.6,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'medium',
          relatedData: {
            currentTarget: context.nutrition.caloriesTarget,
            weeklyTrend: context.nutrition.weeklyTrend,
            suggestedAdjustment: this.suggestCalorieAdjustment(context),
          },
          suggestedAgents: ['coach_proactive', 'wellness_program'],
        }

      // ========== INFORMATION REQUESTS ==========
      case 'EXPLAIN_DECISION':
        return {
          type: 'KNOWLEDGE_GAP',
          intensity: 0.5,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'medium',
          relatedData: {
            requiresExplanation: true,
            lastDecision: this.getLastDecision(context),
          },
          suggestedAgents: ['coach_proactive'],
        }

      case 'NUTRITION_QUESTION':
        return {
          type: 'KNOWLEDGE_GAP',
          intensity: 0.4,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'low',
          relatedData: {
            questionType: 'nutrition_info',
          },
          suggestedAgents: ['coach_proactive'],
        }

      case 'HELP':
        return {
          type: 'KNOWLEDGE_GAP',
          intensity: 0.3,
          source: 'explicit',
          confidence,
          actionable: true,
          priority: 'low',
          relatedData: {
            helpType: 'general',
          },
          suggestedAgents: ['coach_proactive'],
        }

      // ========== META ==========
      case 'GREETING':
      case 'FEEDBACK':
      case 'LOG_MEAL':
      case 'PHASE_QUESTION':
      case 'UNKNOWN':
      default:
        return null
    }
  }

  /**
   * Generate signals from context (not directly from intent)
   */
  private generateContextualSignals(
    intent: IntentDetectionResult,
    context: ConversationContextFull
  ): UserSignal[] {
    const signals: UserSignal[] = []

    // Long time without eating
    if (context.temporal.hoursSinceLastMeal > 5) {
      signals.push({
        type: 'NUTRITIONAL_NEED',
        intensity: Math.min(1, context.temporal.hoursSinceLastMeal / 8),
        source: 'contextual',
        confidence: 0.8,
        actionable: true,
        priority: context.temporal.hoursSinceLastMeal > 7 ? 'high' : 'medium',
        relatedData: {
          reason: 'long_fasting',
          hoursSinceLastMeal: context.temporal.hoursSinceLastMeal,
        },
        suggestedAgents: ['meal_plan_agent'],
      })
    }

    // Low hydration
    if (context.wellness.hydration < 3) {
      signals.push({
        type: 'NUTRITIONAL_NEED',
        intensity: 0.4,
        source: 'contextual',
        confidence: 0.7,
        actionable: true,
        priority: 'low',
        relatedData: {
          reason: 'low_hydration',
          currentGlasses: context.wellness.hydration,
        },
        suggestedAgents: ['wellness_program'],
      })
    }

    // Poor sleep affecting energy
    if (context.wellness.sleepLastNight && context.wellness.sleepLastNight.hours < 6) {
      signals.push({
        type: 'HABIT_DEVIATION',
        intensity: 0.5,
        source: 'contextual',
        confidence: 0.75,
        actionable: true,
        priority: 'medium',
        relatedData: {
          reason: 'poor_sleep',
          sleepHours: context.wellness.sleepLastNight.hours,
          expectedImpact: 'low_energy',
        },
        suggestedAgents: ['wellness_program', 'coach_proactive'],
      })
    }

    // Streak at risk (evening, no meals logged)
    if (
      context.temporal.timeOfDay === 'evening' &&
      context.nutrition.todayMeals.length === 0 &&
      context.gamification.currentStreak > 0
    ) {
      signals.push({
        type: 'GOAL_ALIGNMENT',
        intensity: 0.6,
        source: 'contextual',
        confidence: 0.8,
        actionable: true,
        priority: 'high',
        relatedData: {
          reason: 'streak_at_risk',
          currentStreak: context.gamification.currentStreak,
        },
        suggestedAgents: ['gamification_store', 'notification_service'],
      })
    }

    return signals
  }

  /**
   * Generate inferred signals from correlations
   */
  private generateInferredSignals(
    intent: IntentDetectionResult,
    context: ConversationContextFull
  ): UserSignal[] {
    const signals: UserSignal[] = []
    const primaryIntent = intent.topIntents[0]?.intent

    // Stress-eating pattern detected
    if (
      (primaryIntent === 'STRESS' || primaryIntent === 'CRAVING') &&
      context.correlations.stressEating.length > 0
    ) {
      signals.push({
        type: 'HABIT_DEVIATION',
        intensity: 0.6,
        source: 'inferred',
        confidence: 0.7,
        actionable: true,
        priority: 'high',
        relatedData: {
          pattern: 'stress_eating',
          correlation: context.correlations.stressEating[0]?.correlation || 0.7,
          historicalOccurrences: context.correlations.stressEating.length,
        },
        suggestedAgents: ['coach_proactive', 'wellness_program'],
      })
    }

    // Sleep affecting nutrition
    if (
      context.correlations.sleepNutrition.length > 0 &&
      context.wellness.sleepLastNight &&
      context.wellness.sleepLastNight.hours < 6
    ) {
      signals.push({
        type: 'HABIT_DEVIATION',
        intensity: 0.5,
        source: 'inferred',
        confidence: 0.65,
        actionable: true,
        priority: 'medium',
        relatedData: {
          pattern: 'sleep_nutrition_correlation',
          expectedImpact: 'increased_hunger',
        },
        suggestedAgents: ['coach_proactive'],
      })
    }

    return signals
  }

  /**
   * Prioritize signals by importance
   */
  private prioritizeSignals(signals: UserSignal[]): UserSignal[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return signals.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return b.intensity - a.intensity
    })
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private calculateHungerIntensity(context: ConversationContextFull): number {
    const hours = context.temporal.hoursSinceLastMeal
    if (hours <= 2) return 0.3
    if (hours <= 4) return 0.5
    if (hours <= 6) return 0.7
    return Math.min(1, 0.7 + (hours - 6) * 0.1)
  }

  private calculateFatigueIntensity(context: ConversationContextFull): number {
    let intensity = 0.5

    // Sleep impact
    if (context.wellness.sleepLastNight) {
      if (context.wellness.sleepLastNight.hours < 5) intensity += 0.3
      else if (context.wellness.sleepLastNight.hours < 6) intensity += 0.2
      else if (context.wellness.sleepLastNight.hours < 7) intensity += 0.1
    }

    // Fasting impact
    if (context.temporal.hoursSinceLastMeal > 5) intensity += 0.2

    // Hydration impact
    if (context.wellness.hydration < 3) intensity += 0.1

    return Math.min(1, intensity)
  }

  private determineMealType(context: ConversationContextFull): string {
    switch (context.temporal.timeOfDay) {
      case 'morning': return 'breakfast'
      case 'midday': return 'lunch'
      case 'afternoon': return 'snack'
      case 'evening': return 'dinner'
      case 'night': return 'snack'
      default: return 'snack'
    }
  }

  private analyzeFatigueCauses(context: ConversationContextFull): string[] {
    const causes: string[] = []

    if (context.wellness.sleepLastNight && context.wellness.sleepLastNight.hours < 6) {
      causes.push('insufficient_sleep')
    }
    if (context.temporal.hoursSinceLastMeal > 4) {
      causes.push('long_fasting')
    }
    if (context.wellness.hydration < 4) {
      causes.push('dehydration')
    }
    if (context.wellness.stressLevel && context.wellness.stressLevel > 6) {
      causes.push('stress')
    }

    return causes.length > 0 ? causes : ['unknown']
  }

  private suggestEnergyActions(context: ConversationContextFull): string[] {
    const actions: string[] = []

    if (context.temporal.hoursSinceLastMeal > 3) {
      actions.push('eat_snack')
    }
    if (context.wellness.hydration < 4) {
      actions.push('drink_water')
    }
    if (context.wellness.sleepLastNight && context.wellness.sleepLastNight.hours < 6) {
      actions.push('short_rest')
    }
    actions.push('light_walk')

    return actions
  }

  private analyzeFrustrationCauses(context: ConversationContextFull): string[] {
    const causes: string[] = []

    if (context.wellness.weightTrend === 'stable' && context.program.dayInPhase > 7) {
      causes.push('plateau')
    }
    if (context.gamification.currentStreak === 0) {
      causes.push('broken_streak')
    }
    if (context.nutrition.weeklyTrend === 'surplus') {
      causes.push('over_eating')
    }

    return causes.length > 0 ? causes : ['general']
  }

  private calculateDaysSinceProgress(context: ConversationContextFull): number {
    // Simplified - would need historical data
    return context.program.dayInPhase
  }

  private analyzePlateauCauses(context: ConversationContextFull): string[] {
    const causes: string[] = []

    if (context.nutrition.weeklyTrend === 'balanced') {
      causes.push('metabolic_adaptation')
    }
    if (context.nutrition.avgCaloriesLast7Days > context.nutrition.caloriesTarget * 0.95) {
      causes.push('calorie_creep')
    }

    return causes.length > 0 ? causes : ['normal_fluctuation']
  }

  private generatePlateauStrategy(context: ConversationContextFull): string[] {
    return [
      'vary_meals',
      'adjust_calories_slightly',
      'increase_protein',
      'add_movement',
    ]
  }

  private gatherProgressEvidence(context: ConversationContextFull): string[] {
    const evidence: string[] = []

    if (context.gamification.currentStreak > 0) {
      evidence.push(`${context.gamification.currentStreak} jours de suite`)
    }
    if (context.gamification.recentAchievements.length > 0) {
      evidence.push(`${context.gamification.recentAchievements.length} achievements récents`)
    }
    if (context.nutrition.weeklyTrend === 'deficit') {
      evidence.push('tendance déficitaire maintenue')
    }

    return evidence
  }

  private suggestReward(context: ConversationContextFull): string {
    if (context.gamification.currentStreak >= 7) return 'milestone_celebration'
    if (context.gamification.recentAchievements.length > 0) return 'achievement_highlight'
    return 'encouragement'
  }

  private suggestChallengeDifficulty(context: ConversationContextFull): string {
    const level = context.gamification.level
    if (level <= 3) return 'easy'
    if (level <= 7) return 'medium'
    return 'hard'
  }

  private suggestCalorieAdjustment(context: ConversationContextFull): number {
    if (context.nutrition.weeklyTrend === 'surplus') return -100
    if (context.nutrition.weeklyTrend === 'deficit' && context.wellness.energyLevel && context.wellness.energyLevel < 4) return 100
    return 0
  }

  private getLastDecision(context: ConversationContextFull): string | null {
    // Would track last coach decision
    return null
  }
}

// Export singleton
export const conversationSignalService = new ConversationSignalService()
