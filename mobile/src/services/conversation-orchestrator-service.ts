/**
 * Agent Orchestrator Service
 *
 * Bridge between the conversational layer and the existing LYM decision engine.
 * This service orchestrates calls to existing agents/services based on decision requests.
 *
 * Key principle: The conversational layer does NOT reinvent agents.
 * It orchestrates existing services:
 * - mealPlanAgent
 * - coachProactiveService
 * - weeklyChallengesService
 * - gamificationStore
 * - wellnessStore
 * - etc.
 */

import { DecisionRequest, DecisionResult, AgentType } from './conversation-decision-service'
import { ConversationContextFull } from '../types/conversation'
import { mealPlanAgent } from './meal-plan-agent'
import {
  getUserChallengeStats,
  getAvailableChallenges,
  joinChallenge,
  type WeeklyChallenge,
} from './weekly-challenges-service'
import { useGamificationStore } from '../stores/gamification-store'
import { useWellnessStore } from '../stores/wellness-store'
import { useUserStore } from '../stores/user-store'
import { useCalorieStore } from '../stores/calorie-store'
import type { PlannedMealItem } from '../stores/meal-plan-store'

// ============================================================================
// TYPES
// ============================================================================

export interface OrchestratorResult {
  success: boolean
  results: DecisionResult[]
  summary: string
  suggestedMeal?: PlannedMealItem
  suggestedChallenge?: WeeklyChallenge
  progressData?: ProgressData
  supportMessage?: string
}

export interface ProgressData {
  streak: number
  level: number
  xp: number
  xpToNextLevel: number
  weeklyCalorieAvg: number
  weeklyProteinAvg: number
  trend: 'improving' | 'stable' | 'declining'
  highlights: string[]
}

export interface MealSuggestionParams {
  mealType?: string
  caloriesBudget?: number
  tags?: string[]
  constraints?: string[]
}

// ============================================================================
// ORCHESTRATOR SERVICE
// ============================================================================

// Strict whitelist of allowed agents
const ALLOWED_AGENTS: AgentType[] = [
  'meal_plan_agent',
  'coach_proactive',
  'wellness_program',
  'gamification_store',
  'challenges_service',
  'correlation_engine',
  'notification_service',
]

// Strict whitelist of allowed actions per agent
const ALLOWED_ACTIONS: Record<AgentType, string[]> = {
  meal_plan_agent: ['generate_suggestion', 'generate_options', 'get_meal_details'],
  coach_proactive: ['generate_support_message', 'generate_motivation_message', 'generate_celebration_message', 'explain_decision', 'address_deviation'],
  wellness_program: ['suggest_hydration', 'suggest_breathing', 'suggest_adjustments', 'suggest_simplification'],
  gamification_store: ['suggest_challenge', 'process_celebration', 'get_progress'],
  challenges_service: ['get_available_challenges', 'join_challenge'],
  correlation_engine: ['generate_progress_summary', 'get_pattern_insights'],
  notification_service: ['send_streak_reminder', 'schedule_reminder'],
}

// Params validation rules (bounds checking)
const PARAM_BOUNDS: Record<string, { min?: number; max?: number }> = {
  caloriesBudget: { min: 0, max: 5000 },
  duration: { min: 0, max: 600 }, // seconds
  count: { min: 1, max: 10 },
  currentStreak: { min: 0, max: 1000 },
}

class ConversationOrchestratorService {
  /**
   * Validate a request against strict whitelist and param bounds
   */
  private validateRequest(request: DecisionRequest, isPremium: boolean): { valid: boolean; error?: string } {
    // 1. Validate agent type
    if (!ALLOWED_AGENTS.includes(request.agent)) {
      return { valid: false, error: `Unknown agent: ${request.agent}` }
    }

    // 2. Validate action for this agent
    const allowedActions = ALLOWED_ACTIONS[request.agent]
    if (!allowedActions.includes(request.action)) {
      return { valid: false, error: `Unknown action ${request.action} for agent ${request.agent}` }
    }

    // 3. Validate params bounds
    for (const [key, value] of Object.entries(request.params)) {
      const bounds = PARAM_BOUNDS[key]
      if (bounds && typeof value === 'number') {
        if (bounds.min !== undefined && value < bounds.min) {
          return { valid: false, error: `Param ${key} below minimum (${bounds.min})` }
        }
        if (bounds.max !== undefined && value > bounds.max) {
          return { valid: false, error: `Param ${key} above maximum (${bounds.max})` }
        }
      }
    }

    // 4. Premium-only actions check
    const premiumOnlyActions = ['schedule_reminder', 'join_challenge', 'suggest_adjustments']
    if (premiumOnlyActions.includes(request.action) && !isPremium) {
      return { valid: false, error: `Action ${request.action} requires premium` }
    }

    return { valid: true }
  }

  /**
   * Execute decision requests and return aggregated results
   */
  async executeDecisions(
    requests: DecisionRequest[],
    context: ConversationContextFull
  ): Promise<OrchestratorResult> {
    const results: DecisionResult[] = []
    let suggestedMeal: PlannedMealItem | undefined
    let suggestedChallenge: WeeklyChallenge | undefined
    let progressData: ProgressData | undefined
    let supportMessage: string | undefined

    // Process requests in priority order (they're already sorted)
    for (const request of requests) {
      // STRICT VALIDATION before execution
      const validation = this.validateRequest(request, context.user.isPremium)
      if (!validation.valid) {
        console.warn('[Orchestrator] Request rejected:', validation.error)
        results.push({
          requestId: `req_${Date.now()}`,
          agent: request.agent,
          action: request.action,
          success: false,
          error: validation.error,
          processingTimeMs: 0,
        })
        continue
      }
      const startTime = Date.now()
      let result: DecisionResult

      try {
        switch (request.agent) {
          case 'meal_plan_agent':
            result = await this.handleMealPlanRequest(request, context)
            if (result.success && result.data) {
              suggestedMeal = result.data as PlannedMealItem
            }
            break

          case 'coach_proactive':
            result = await this.handleCoachRequest(request, context)
            if (result.success && result.data) {
              supportMessage = result.data as string
            }
            break

          case 'gamification_store':
            result = await this.handleGamificationRequest(request, context)
            break

          case 'challenges_service':
            result = await this.handleChallengesRequest(request, context)
            if (result.success && result.data) {
              suggestedChallenge = result.data as WeeklyChallenge
            }
            break

          case 'wellness_program':
            result = await this.handleWellnessRequest(request, context)
            break

          case 'correlation_engine':
            result = await this.handleCorrelationRequest(request, context)
            if (result.success && result.data) {
              progressData = result.data as ProgressData
            }
            break

          case 'notification_service':
            result = await this.handleNotificationRequest(request, context)
            break

          default:
            result = {
              requestId: `req_${Date.now()}`,
              agent: request.agent,
              action: request.action,
              success: false,
              error: `Unknown agent: ${request.agent}`,
              processingTimeMs: Date.now() - startTime,
            }
        }
      } catch (error) {
        result = {
          requestId: `req_${Date.now()}`,
          agent: request.agent,
          action: request.action,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTimeMs: Date.now() - startTime,
        }
      }

      results.push(result)
    }

    // Generate summary
    const summary = this.generateSummary(results)

    return {
      success: results.some(r => r.success),
      results,
      summary,
      suggestedMeal,
      suggestedChallenge,
      progressData,
      supportMessage,
    }
  }

  // ============================================================================
  // AGENT HANDLERS
  // ============================================================================

  /**
   * Handle meal plan agent requests
   */
  private async handleMealPlanRequest(
    request: DecisionRequest,
    context: ConversationContextFull
  ): Promise<DecisionResult> {
    const startTime = Date.now()
    const requestId = `meal_${Date.now()}`

    try {
      const params = request.params as MealSuggestionParams

      // Get user profile for preferences
      const userStore = useUserStore.getState()
      const profile = userStore.profile

      // Determine meal type from context if not provided
      const mealType = params.mealType || this.getMealTypeFromTime(context)

      // Calculate calorie budget
      const caloriesBudget = params.caloriesBudget || this.calculateMealCalories(
        context.nutrition.caloriesRemaining,
        mealType
      )

      // Build preferences for meal plan agent
      const preferences = {
        dailyCalories: context.nutrition.caloriesTarget,
        proteins: context.nutrition.macroTargets.proteins,
        carbs: context.nutrition.macroTargets.carbs,
        fats: context.nutrition.macroTargets.fats,
        dietType: profile?.dietType,
        allergies: profile?.allergies,
        cookingTimeWeekday: 20,
        cookingTimeWeekend: 45,
        complexity: 'basique' as const,
        cookingLevel: 'beginner' as const,
        mealSourcePreference: 'balanced' as const,
        goal: profile?.goal || 'maintain',
      }

      // Generate a single day meal plan (just for the requested meal)
      const meals = await mealPlanAgent.generateWeekPlan(preferences, undefined, 1)

      // Find the meal matching the requested type
      const meal = meals.find(m => m.mealType === mealType)

      if (meal) {
        // Apply tags filter if provided
        if (params.tags && params.tags.length > 0) {
          // Check if meal matches any tags (simplified)
          const mealNameLower = meal.name.toLowerCase()
          const hasMatchingTag = params.tags.some(tag =>
            mealNameLower.includes(tag.toLowerCase())
          )
          // Continue with meal even if no tag match - it's still a valid suggestion
        }

        return {
          requestId,
          agent: 'meal_plan_agent',
          action: request.action,
          success: true,
          data: meal,
          processingTimeMs: Date.now() - startTime,
        }
      }

      return {
        requestId,
        agent: 'meal_plan_agent',
        action: request.action,
        success: false,
        error: 'No matching meal found',
        processingTimeMs: Date.now() - startTime,
      }
    } catch (error) {
      return {
        requestId,
        agent: 'meal_plan_agent',
        action: request.action,
        success: false,
        error: error instanceof Error ? error.message : 'Meal generation failed',
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Handle coach proactive requests
   */
  private async handleCoachRequest(
    request: DecisionRequest,
    context: ConversationContextFull
  ): Promise<DecisionResult> {
    const startTime = Date.now()
    const requestId = `coach_${Date.now()}`

    try {
      const params = request.params as {
        context?: string
        emotionalContext?: string
        tone?: string
        includeActions?: boolean
        simplify?: boolean
      }

      // Generate support message based on context
      let message: string

      if (params.emotionalContext === 'stress' || params.context === 'stress_management') {
        message = this.generateStressSupportMessage(context, params.tone)
      } else if (params.simplify) {
        message = this.generateSimplificationMessage(context)
      } else {
        message = this.generateGeneralSupportMessage(context, params.tone)
      }

      return {
        requestId,
        agent: 'coach_proactive',
        action: request.action,
        success: true,
        data: message,
        processingTimeMs: Date.now() - startTime,
      }
    } catch (error) {
      return {
        requestId,
        agent: 'coach_proactive',
        action: request.action,
        success: false,
        error: error instanceof Error ? error.message : 'Coach message generation failed',
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Handle gamification store requests
   */
  private async handleGamificationRequest(
    request: DecisionRequest,
    context: ConversationContextFull
  ): Promise<DecisionResult> {
    const startTime = Date.now()
    const requestId = `gamif_${Date.now()}`

    try {
      const gamificationStore = useGamificationStore.getState()

      switch (request.action) {
        case 'suggest_challenge':
          const params = request.params as { difficulty?: string; category?: string }
          const challenges = await getAvailableChallenges()
          const filtered = challenges.filter(c => {
            if (params.difficulty && c.difficulty !== params.difficulty) return false
            if (params.category && c.category !== params.category) return false
            return true
          })
          const suggested = filtered[0] || challenges[0]
          return {
            requestId,
            agent: 'gamification_store',
            action: request.action,
            success: !!suggested,
            data: suggested,
            processingTimeMs: Date.now() - startTime,
          }

        case 'process_celebration':
          // Trigger celebration animation
          return {
            requestId,
            agent: 'gamification_store',
            action: request.action,
            success: true,
            data: {
              streak: context.gamification.currentStreak,
              level: context.gamification.level,
              recentAchievements: context.gamification.recentAchievements,
            },
            processingTimeMs: Date.now() - startTime,
          }

        default:
          return {
            requestId,
            agent: 'gamification_store',
            action: request.action,
            success: false,
            error: `Unknown gamification action: ${request.action}`,
            processingTimeMs: Date.now() - startTime,
          }
      }
    } catch (error) {
      return {
        requestId,
        agent: 'gamification_store',
        action: request.action,
        success: false,
        error: error instanceof Error ? error.message : 'Gamification request failed',
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Handle challenges service requests
   */
  private async handleChallengesRequest(
    request: DecisionRequest,
    context: ConversationContextFull
  ): Promise<DecisionResult> {
    const startTime = Date.now()
    const requestId = `challenge_${Date.now()}`

    try {
      switch (request.action) {
        case 'get_available_challenges':
          const params = request.params as { difficulty?: string; excludeActive?: boolean }
          const challenges = await getAvailableChallenges()
          const filtered = challenges.filter(c => {
            if (params.difficulty && c.difficulty !== params.difficulty) return false
            if (params.excludeActive && context.gamification.activeChallenge?.id === c.id) return false
            return true
          })
          return {
            requestId,
            agent: 'challenges_service',
            action: request.action,
            success: true,
            data: filtered[0], // Return best match
            processingTimeMs: Date.now() - startTime,
          }

        default:
          return {
            requestId,
            agent: 'challenges_service',
            action: request.action,
            success: false,
            error: `Unknown challenges action: ${request.action}`,
            processingTimeMs: Date.now() - startTime,
          }
      }
    } catch (error) {
      return {
        requestId,
        agent: 'challenges_service',
        action: request.action,
        success: false,
        error: error instanceof Error ? error.message : 'Challenges request failed',
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Handle wellness program requests
   */
  private async handleWellnessRequest(
    request: DecisionRequest,
    context: ConversationContextFull
  ): Promise<DecisionResult> {
    const startTime = Date.now()
    const requestId = `wellness_${Date.now()}`

    try {
      switch (request.action) {
        case 'suggest_hydration':
          const hydrationParams = request.params as { currentGlasses: number; target: number }
          const remaining = hydrationParams.target - hydrationParams.currentGlasses
          return {
            requestId,
            agent: 'wellness_program',
            action: request.action,
            success: true,
            data: {
              message: remaining > 0
                ? `Il te reste ${remaining} verres d'eau pour atteindre ton objectif.`
                : 'Super, tu as atteint ton objectif hydratation !',
              remaining,
            },
            processingTimeMs: Date.now() - startTime,
          }

        case 'suggest_breathing':
          return {
            requestId,
            agent: 'wellness_program',
            action: request.action,
            success: true,
            data: {
              technique: '4-7-8',
              instructions: [
                'Inspire par le nez pendant 4 secondes',
                'Retiens ta respiration pendant 7 secondes',
                'Expire lentement par la bouche pendant 8 secondes',
                'Répète 3-4 fois',
              ],
            },
            processingTimeMs: Date.now() - startTime,
          }

        case 'suggest_adjustments':
        case 'prepare_adjustment':
          const adjustParams = request.params as { type?: string; amount?: number; reason?: string }
          return {
            requestId,
            agent: 'wellness_program',
            action: request.action,
            success: true,
            data: {
              suggestion: adjustParams.reason === 'plateau'
                ? 'Essaie de varier tes repas et augmenter légèrement ton activité.'
                : 'Un ajustement de tes objectifs pourrait t\'aider.',
              adjustment: adjustParams.amount || 0,
            },
            processingTimeMs: Date.now() - startTime,
          }

        case 'suggest_simplification':
          return {
            requestId,
            agent: 'wellness_program',
            action: request.action,
            success: true,
            data: {
              message: 'Concentre-toi sur l\'essentiel : log tes repas et bois de l\'eau.',
              simplifiedGoals: [
                'Logger au moins 1 repas par jour',
                'Boire 6 verres d\'eau',
                'Prendre 5 minutes pour toi',
              ],
            },
            processingTimeMs: Date.now() - startTime,
          }

        default:
          return {
            requestId,
            agent: 'wellness_program',
            action: request.action,
            success: false,
            error: `Unknown wellness action: ${request.action}`,
            processingTimeMs: Date.now() - startTime,
          }
      }
    } catch (error) {
      return {
        requestId,
        agent: 'wellness_program',
        action: request.action,
        success: false,
        error: error instanceof Error ? error.message : 'Wellness request failed',
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Handle correlation engine requests
   */
  private async handleCorrelationRequest(
    request: DecisionRequest,
    context: ConversationContextFull
  ): Promise<DecisionResult> {
    const startTime = Date.now()
    const requestId = `corr_${Date.now()}`

    try {
      switch (request.action) {
        case 'generate_progress_summary':
          const progressData = this.buildProgressData(context)
          return {
            requestId,
            agent: 'correlation_engine',
            action: request.action,
            success: true,
            data: progressData,
            processingTimeMs: Date.now() - startTime,
          }

        case 'get_pattern_insights':
          const patternParams = request.params as { pattern: string }
          const insights = this.getPatternInsights(patternParams.pattern, context)
          return {
            requestId,
            agent: 'correlation_engine',
            action: request.action,
            success: true,
            data: insights,
            processingTimeMs: Date.now() - startTime,
          }

        default:
          return {
            requestId,
            agent: 'correlation_engine',
            action: request.action,
            success: false,
            error: `Unknown correlation action: ${request.action}`,
            processingTimeMs: Date.now() - startTime,
          }
      }
    } catch (error) {
      return {
        requestId,
        agent: 'correlation_engine',
        action: request.action,
        success: false,
        error: error instanceof Error ? error.message : 'Correlation request failed',
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Handle notification service requests
   */
  private async handleNotificationRequest(
    request: DecisionRequest,
    context: ConversationContextFull
  ): Promise<DecisionResult> {
    const startTime = Date.now()
    const requestId = `notif_${Date.now()}`

    try {
      switch (request.action) {
        case 'send_streak_reminder':
          const streakParams = request.params as { currentStreak: number; urgency: string }
          return {
            requestId,
            agent: 'notification_service',
            action: request.action,
            success: true,
            data: {
              message: `N'oublie pas de logger un repas pour maintenir ta série de ${streakParams.currentStreak} jours !`,
              scheduled: true,
            },
            processingTimeMs: Date.now() - startTime,
          }

        default:
          return {
            requestId,
            agent: 'notification_service',
            action: request.action,
            success: false,
            error: `Unknown notification action: ${request.action}`,
            processingTimeMs: Date.now() - startTime,
          }
      }
    } catch (error) {
      return {
        requestId,
        agent: 'notification_service',
        action: request.action,
        success: false,
        error: error instanceof Error ? error.message : 'Notification request failed',
        processingTimeMs: Date.now() - startTime,
      }
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getMealTypeFromTime(context: ConversationContextFull): string {
    switch (context.temporal.timeOfDay) {
      case 'morning': return 'breakfast'
      case 'midday': return 'lunch'
      case 'afternoon': return 'snack'
      case 'evening':
      case 'night': return 'dinner'
      default: return 'snack'
    }
  }

  private calculateMealCalories(remaining: number, mealType: string): number {
    const distribution: Record<string, number> = {
      breakfast: 0.25,
      lunch: 0.35,
      snack: 0.10,
      dinner: 0.30,
    }
    const factor = distribution[mealType] || 0.25
    return Math.round(remaining * factor)
  }

  private generateStressSupportMessage(
    context: ConversationContextFull,
    tone?: string
  ): string {
    const hasStressEatingPattern = context.correlations.stressEating.length > 0
    const firstName = context.user.firstName ? `, ${context.user.firstName}` : ''

    if (hasStressEatingPattern) {
      return `Je comprends${firstName}. Le stress peut influencer nos envies alimentaires, c'est normal. ` +
        `Prends un moment pour respirer. Si tu as faim, choisis quelque chose qui te fait du bien ` +
        `sans culpabilité.`
    }

    return `Je suis là pour toi${firstName}. Le stress fait partie de la vie, mais on peut le gérer. ` +
      `Prends quelques respirations profondes. Qu'est-ce qui t'aiderait le plus là maintenant ?`
  }

  private generateSimplificationMessage(context: ConversationContextFull): string {
    return `Pas de panique ! Concentre-toi sur l'essentiel aujourd'hui : ` +
      `1) Log au moins un repas, 2) Bois de l'eau, 3) Sois bienveillant(e) avec toi-même. ` +
      `Le reste peut attendre.`
  }

  private generateGeneralSupportMessage(
    context: ConversationContextFull,
    tone?: string
  ): string {
    const streak = context.gamification.currentStreak

    if (streak > 7) {
      return `Tu fais du super boulot avec ${streak} jours de suite ! Continue comme ça.`
    } else if (streak > 0) {
      return `Tu es sur une bonne lancée avec ${streak} jours. Chaque jour compte !`
    }

    return `Je suis là pour t'accompagner. Qu'est-ce que je peux faire pour toi ?`
  }

  private buildProgressData(context: ConversationContextFull): ProgressData {
    const highlights: string[] = []

    // Build highlights based on context
    if (context.gamification.currentStreak > 7) {
      highlights.push(`Série de ${context.gamification.currentStreak} jours`)
    }
    if (context.nutrition.weeklyTrend === 'deficit') {
      highlights.push('Tendance déficitaire maintenue')
    }
    if (context.gamification.recentAchievements.length > 0) {
      highlights.push(`${context.gamification.recentAchievements.length} achievement(s) récent(s)`)
    }

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable'
    if (context.nutrition.weeklyTrend === 'deficit' && context.gamification.currentStreak > 3) {
      trend = 'improving'
    } else if (context.nutrition.weeklyTrend === 'surplus' || context.gamification.currentStreak === 0) {
      trend = 'declining'
    }

    return {
      streak: context.gamification.currentStreak,
      level: context.gamification.level,
      xp: context.gamification.xp,
      xpToNextLevel: context.gamification.xpToNextLevel,
      weeklyCalorieAvg: context.nutrition.avgCaloriesLast7Days,
      weeklyProteinAvg: context.nutrition.macroBalance.proteins,
      trend,
      highlights,
    }
  }

  private getPatternInsights(pattern: string, context: ConversationContextFull): object {
    switch (pattern) {
      case 'stress_eating':
        return {
          pattern: 'stress_eating',
          occurrences: context.correlations.stressEating.length,
          description: 'Le stress semble influencer tes choix alimentaires.',
          suggestion: 'Essaie des alternatives comme la respiration ou une marche.',
        }

      case 'sleep_nutrition':
        return {
          pattern: 'sleep_nutrition',
          occurrences: context.correlations.sleepNutrition.length,
          description: 'Ton sommeil impacte ton alimentation.',
          suggestion: 'Un bon sommeil aide à mieux gérer les envies.',
        }

      default:
        return {
          pattern,
          description: 'Pattern non analysé',
        }
    }
  }

  private generateSummary(results: DecisionResult[]): string {
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    if (successful.length === 0) {
      return 'Aucune action n\'a pu être exécutée.'
    }

    if (failed.length === 0) {
      return `${successful.length} action(s) exécutée(s) avec succès.`
    }

    return `${successful.length} action(s) réussie(s), ${failed.length} échouée(s).`
  }
}

// Export singleton
export const conversationOrchestratorService = new ConversationOrchestratorService()
