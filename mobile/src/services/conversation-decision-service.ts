/**
 * Decision Bridge Service
 *
 * Translates signals into decision requests for the agent orchestrator.
 * This is the bridge between user signals and system actions.
 *
 * Signal → Decision Request → Agent Orchestrator → Action
 */

import { UserSignal } from './conversation-signal-service'
import { ConversationContextFull, ActionType } from '../types/conversation'

// ============================================================================
// DECISION TYPES
// ============================================================================

export interface DecisionRequest {
  agent: AgentType
  action: string
  params: Record<string, unknown>
  priority: 'low' | 'medium' | 'high' | 'critical'
  timeout?: number  // ms
}

export interface DecisionResult {
  requestId: string
  agent: AgentType
  action: string
  success: boolean
  data?: unknown
  error?: string
  processingTimeMs: number
}

export type AgentType =
  | 'meal_plan_agent'
  | 'coach_proactive'
  | 'wellness_program'
  | 'gamification_store'
  | 'challenges_service'
  | 'correlation_engine'
  | 'notification_service'

// ============================================================================
// DECISION BRIDGE SERVICE
// ============================================================================

class ConversationDecisionService {
  /**
   * Process signals and generate decision requests
   */
  async processSignals(
    signals: UserSignal[],
    context: ConversationContextFull
  ): Promise<DecisionRequest[]> {
    const requests: DecisionRequest[] = []

    for (const signal of signals) {
      if (!signal.actionable) continue

      const signalRequests = this.signalToRequests(signal, context)
      requests.push(...signalRequests)
    }

    // Deduplicate and prioritize
    return this.deduplicateRequests(requests)
  }

  /**
   * Convert a signal to decision requests
   */
  private signalToRequests(
    signal: UserSignal,
    context: ConversationContextFull
  ): DecisionRequest[] {
    const requests: DecisionRequest[] = []

    switch (signal.type) {
      // ========== NUTRITIONAL NEED ==========
      case 'NUTRITIONAL_NEED':
        if (signal.relatedData.suggestedMealType) {
          requests.push({
            agent: 'meal_plan_agent',
            action: 'generate_suggestion',
            params: {
              mealType: signal.relatedData.suggestedMealType,
              caloriesBudget: signal.relatedData.caloriesRemaining,
              constraints: this.getUserDietaryConstraints(context),
              tags: this.getMealTags(signal, context),
            },
            priority: signal.priority,
          })
        }

        // If low hydration, also suggest water
        if (signal.relatedData.reason === 'low_hydration') {
          requests.push({
            agent: 'wellness_program',
            action: 'suggest_hydration',
            params: {
              currentGlasses: signal.relatedData.currentGlasses,
              target: 8,
            },
            priority: 'low',
          })
        }
        break

      // ========== EMOTIONAL STATE ==========
      case 'EMOTIONAL_STATE':
        // Generate support message
        requests.push({
          agent: 'coach_proactive',
          action: 'generate_support_message',
          params: {
            emotionalContext: signal.relatedData.stressLevel ? 'stress' : 'general',
            includeActions: true,
            tone: 'empathetic',
          },
          priority: signal.priority,
        })

        // If stress-eating risk, add meal suggestion
        if (signal.relatedData.stressEatingRisk) {
          requests.push({
            agent: 'meal_plan_agent',
            action: 'generate_suggestion',
            params: {
              mealType: 'snack',
              tags: ['comfort', 'healthy', 'stress_relief'],
              caloriesBudget: Math.min(300, context.nutrition.caloriesRemaining),
            },
            priority: 'medium',
          })
        }

        // Suggest breathing exercise
        if (signal.relatedData.stressLevel && signal.relatedData.stressLevel > 6) {
          requests.push({
            agent: 'wellness_program',
            action: 'suggest_breathing',
            params: {
              technique: '4-7-8',
              duration: 120,
            },
            priority: 'high',
          })
        }
        break

      // ========== MOTIVATION LEVEL ==========
      case 'MOTIVATION_LEVEL':
        // Low motivation - suggest easy win
        if (signal.intensity < 0.5) {
          requests.push({
            agent: 'gamification_store',
            action: 'suggest_challenge',
            params: {
              difficulty: 'easy',
              category: 'quick_win',
              duration: 'day',
            },
            priority: 'medium',
          })

          requests.push({
            agent: 'coach_proactive',
            action: 'generate_motivation_message',
            params: {
              context: signal.relatedData.possibleCauses || ['general'],
              evidenceOfProgress: signal.relatedData.evidenceOfProgress || [],
            },
            priority: 'high',
          })
        }

        // Plateau situation
        if (signal.relatedData.suggestedAdjustments) {
          requests.push({
            agent: 'wellness_program',
            action: 'suggest_adjustments',
            params: {
              adjustments: signal.relatedData.suggestedAdjustments,
              reason: 'plateau',
            },
            priority: 'medium',
          })
        }
        break

      // ========== KNOWLEDGE GAP ==========
      case 'KNOWLEDGE_GAP':
        if (signal.relatedData.requiresExplanation) {
          requests.push({
            agent: 'coach_proactive',
            action: 'explain_decision',
            params: {
              lastDecision: signal.relatedData.lastDecision,
              includeData: true,
            },
            priority: 'medium',
          })
        } else {
          // Progress check
          requests.push({
            agent: 'correlation_engine',
            action: 'generate_progress_summary',
            params: {
              period: 'week',
              includeCorrelations: context.user.isPremium,
            },
            priority: 'low',
          })
        }
        break

      // ========== DECISION POINT ==========
      case 'DECISION_POINT':
        if (signal.relatedData.mealType) {
          requests.push({
            agent: 'meal_plan_agent',
            action: 'generate_options',
            params: {
              mealType: signal.relatedData.mealType,
              caloriesBudget: signal.relatedData.caloriesRemaining,
              count: 3,
            },
            priority: signal.priority,
          })
        }

        if (signal.relatedData.suggestedAdjustment !== undefined) {
          requests.push({
            agent: 'wellness_program',
            action: 'prepare_adjustment',
            params: {
              type: 'calories',
              amount: signal.relatedData.suggestedAdjustment,
              reason: 'user_request',
            },
            priority: 'medium',
          })
        }
        break

      // ========== HABIT DEVIATION ==========
      case 'HABIT_DEVIATION':
        requests.push({
          agent: 'coach_proactive',
          action: 'address_deviation',
          params: {
            pattern: signal.relatedData.pattern,
            severity: signal.intensity,
            suggestedApproach: 'supportive',
          },
          priority: signal.priority,
        })

        // If stress-eating pattern
        if (signal.relatedData.pattern === 'stress_eating') {
          requests.push({
            agent: 'correlation_engine',
            action: 'get_pattern_insights',
            params: {
              pattern: 'stress_eating',
              includeHistory: true,
            },
            priority: 'medium',
          })
        }
        break

      // ========== GOAL ALIGNMENT ==========
      case 'GOAL_ALIGNMENT':
        if (signal.relatedData.reason === 'streak_at_risk') {
          requests.push({
            agent: 'notification_service',
            action: 'send_streak_reminder',
            params: {
              currentStreak: signal.relatedData.currentStreak,
              urgency: 'high',
            },
            priority: 'high',
          })
        }

        if (signal.relatedData.suggestedDifficulty) {
          requests.push({
            agent: 'challenges_service',
            action: 'get_available_challenges',
            params: {
              difficulty: signal.relatedData.suggestedDifficulty,
              excludeActive: true,
            },
            priority: 'medium',
          })
        }
        break

      // ========== CELEBRATION MOMENT ==========
      case 'CELEBRATION_MOMENT':
        requests.push({
          agent: 'gamification_store',
          action: 'process_celebration',
          params: {
            type: signal.relatedData.suggestedReward,
            streak: signal.relatedData.currentStreak,
          },
          priority: 'medium',
        })

        requests.push({
          agent: 'coach_proactive',
          action: 'generate_celebration_message',
          params: {
            achievements: signal.relatedData.recentAchievements,
            streak: signal.relatedData.currentStreak,
          },
          priority: 'medium',
        })
        break

      // ========== SUPPORT NEEDED ==========
      case 'SUPPORT_NEEDED':
        requests.push({
          agent: 'coach_proactive',
          action: 'generate_support_message',
          params: {
            tone: signal.relatedData.suggestedTone || 'empathetic',
            includeActions: signal.relatedData.simplificationNeeded,
            simplify: signal.relatedData.simplificationNeeded,
          },
          priority: 'high',
        })

        if (signal.relatedData.simplificationNeeded) {
          requests.push({
            agent: 'wellness_program',
            action: 'suggest_simplification',
            params: {
              currentComplexity: 'high',
              targetComplexity: 'minimal',
            },
            priority: 'medium',
          })
        }
        break
    }

    return requests
  }

  /**
   * Get user dietary constraints
   */
  private getUserDietaryConstraints(context: ConversationContextFull): string[] {
    // Would come from user profile
    return []
  }

  /**
   * Get meal tags based on signal and context
   */
  private getMealTags(signal: UserSignal, context: ConversationContextFull): string[] {
    const tags: string[] = []

    // Time-based tags
    if (context.temporal.timeOfDay === 'morning') tags.push('breakfast')
    if (context.temporal.timeOfDay === 'night') tags.push('light')

    // Energy needs
    if (signal.relatedData.hoursSinceLastMeal && signal.relatedData.hoursSinceLastMeal > 5) {
      tags.push('energy', 'substantial')
    }

    // Quick if low time
    if (context.temporal.timeOfDay === 'midday') {
      tags.push('quick')
    }

    return tags
  }

  /**
   * Deduplicate and prioritize requests
   */
  private deduplicateRequests(requests: DecisionRequest[]): DecisionRequest[] {
    const seen = new Map<string, DecisionRequest>()

    for (const request of requests) {
      const key = `${request.agent}:${request.action}`

      if (!seen.has(key)) {
        seen.set(key, request)
      } else {
        // Keep higher priority request
        const existing = seen.get(key)!
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        if (priorityOrder[request.priority] < priorityOrder[existing.priority]) {
          seen.set(key, request)
        }
      }
    }

    // Sort by priority
    return Array.from(seen.values()).sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
  }
}

// Export singleton
export const conversationDecisionService = new ConversationDecisionService()
