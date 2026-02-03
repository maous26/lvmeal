/**
 * Conversation Action Validator Service (Recommendation #4)
 *
 * Key principles:
 * - Actions are STRICTLY whitelisted - LLM cannot invent new ones
 * - Params are validated against schemas
 * - Risk-based confirmation requirements
 * - Daily limits for certain actions
 */

import {
  ActionType,
  ActionPermission,
  ACTION_PERMISSIONS,
  ConversationAction,
  ConversationContextFull,
} from '../types/conversation'

// ============================================================================
// ACTION SCHEMAS (Validation)
// ============================================================================

interface ActionParamSchema {
  required: string[]
  optional: string[]
  validators: Record<string, (value: unknown) => boolean>
}

const ACTION_SCHEMAS: Record<ActionType, ActionParamSchema> = {
  SUGGEST_MEAL: {
    required: [],
    optional: ['mealType', 'caloriesBudget', 'tags', 'excludeIngredients'],
    validators: {
      mealType: (v) => typeof v === 'string' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(v),
      caloriesBudget: (v) => typeof v === 'number' && v > 0 && v < 3000,
      tags: (v) => Array.isArray(v) && v.every(t => typeof t === 'string'),
    },
  },

  LOG_MEAL_QUICK: {
    required: [],
    optional: ['mealType', 'mealName', 'calories', 'openQuickLog'],
    validators: {
      mealType: (v) => typeof v === 'string' && ['breakfast', 'lunch', 'dinner', 'snack'].includes(v),
      mealName: (v) => typeof v === 'string' && v.length > 0 && v.length < 200,
      calories: (v) => typeof v === 'number' && v > 0 && v < 5000,
      openQuickLog: (v) => typeof v === 'boolean',
    },
  },

  ADJUST_CALORIES: {
    required: ['adjustment'],
    optional: ['reason', 'duration'],
    validators: {
      adjustment: (v) => typeof v === 'number' && Math.abs(v as number) <= 500,
      reason: (v) => typeof v === 'string',
      duration: (v) => typeof v === 'string' && ['today', 'this_week', 'permanent'].includes(v as string),
    },
  },

  START_CHALLENGE: {
    required: ['challengeId'],
    optional: [],
    validators: {
      challengeId: (v) => typeof v === 'string' && v.length > 0,
    },
  },

  NAVIGATE_TO: {
    required: ['screen'],
    optional: ['params'],
    validators: {
      screen: (v) => typeof v === 'string' && ALLOWED_SCREENS.includes(v as string),
      params: (v) => typeof v === 'object',
    },
  },

  SHOW_INSIGHT: {
    required: ['insightType'],
    optional: ['data'],
    validators: {
      insightType: (v) => typeof v === 'string' && ['correlation', 'trend', 'achievement', 'tip'].includes(v as string),
    },
  },

  SCHEDULE_REMINDER: {
    required: ['message'],
    optional: ['delay', 'time', 'recurring'],
    validators: {
      message: (v) => typeof v === 'string' && v.length > 0 && v.length < 200,
      delay: (v) => typeof v === 'number' && v > 0 && v <= 86400, // Max 24h
      time: (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v as string),
      recurring: (v) => typeof v === 'boolean',
    },
  },

  START_BREATHING: {
    required: [],
    optional: ['technique', 'duration'],
    validators: {
      technique: (v) => typeof v === 'string' && ['4-7-8', 'box', 'calming'].includes(v as string),
      duration: (v) => typeof v === 'number' && v >= 60 && v <= 600, // 1-10 minutes
    },
  },

  SHOW_PROGRESS: {
    required: [],
    optional: ['period', 'metric'],
    validators: {
      period: (v) => typeof v === 'string' && ['today', 'week', 'month'].includes(v as string),
      metric: (v) => typeof v === 'string' && ['calories', 'weight', 'streak', 'all'].includes(v as string),
    },
  },

  CONTACT_SUPPORT: {
    required: [],
    optional: ['topic', 'prefill'],
    validators: {
      topic: (v) => typeof v === 'string',
      prefill: (v) => typeof v === 'string',
    },
  },
}

// Allowed navigation screens
const ALLOWED_SCREENS = [
  'Home',
  'Progress',
  'Coach',
  'WeeklyPlan',
  'MealSuggestions',
  'AddMeal',
  'Profile',
  'Settings',
  'WellnessProgram',
  'Challenges',
  'Achievements',
  'BreathingExercise',
  'Paywall',
]

// ============================================================================
// ACTION VALIDATOR SERVICE
// ============================================================================

interface ValidationResult {
  isValid: boolean
  errors: string[]
  sanitizedAction?: ConversationAction
}

interface ActionUsage {
  date: string
  counts: Partial<Record<ActionType, number>>
}

// ============================================================================
// SENSITIVE ACTIONS - Force confirmation regardless of LLM output
// ============================================================================

/**
 * Actions that ALWAYS require user confirmation, even if LLM says otherwise
 * This is a safety measure to prevent accidental or unauthorized changes
 */
const FORCE_CONFIRMATION_ACTIONS: ActionType[] = [
  'ADJUST_CALORIES',     // Modifies user's calorie target
  'SCHEDULE_REMINDER',   // Creates persistent notifications
  'START_CHALLENGE',     // Commits user to a challenge
]

class ConversationActionService {
  private usageTracker: ActionUsage = {
    date: new Date().toDateString(),
    counts: {},
  }

  /**
   * Validate an action against whitelist and schema
   */
  validateAction(
    action: ConversationAction,
    context: ConversationContextFull
  ): ValidationResult {
    const errors: string[] = []

    // 1. Check if action type is whitelisted
    if (!Object.keys(ACTION_PERMISSIONS).includes(action.type)) {
      errors.push(`Action type '${action.type}' is not allowed`)
      return { isValid: false, errors }
    }

    const permission = ACTION_PERMISSIONS[action.type]
    const schema = ACTION_SCHEMAS[action.type]

    // 2. Check tier permission
    const userTier = context.user.isPremium ? 'premium' : 'free'
    if (!permission.allowedTiers.includes(userTier)) {
      errors.push(`Action '${action.type}' requires Premium`)
      return { isValid: false, errors }
    }

    // 3. Check daily limits
    if (permission.maxPerDay) {
      const todayCount = this.getTodayCount(action.type)
      if (todayCount >= permission.maxPerDay) {
        errors.push(`Daily limit reached for '${action.type}' (${permission.maxPerDay}/day)`)
        return { isValid: false, errors }
      }
    }

    // 4. Validate required params
    for (const required of schema.required) {
      if (!(required in action.params)) {
        errors.push(`Missing required param: ${required}`)
      }
    }

    // 5. Validate param types/values
    const sanitizedParams: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(action.params)) {
      // Check if param is allowed
      if (!schema.required.includes(key) && !schema.optional.includes(key)) {
        errors.push(`Unknown param: ${key}`)
        continue
      }

      // Validate value
      const validator = schema.validators[key]
      if (validator && !validator(value)) {
        errors.push(`Invalid value for param '${key}'`)
        continue
      }

      sanitizedParams[key] = value
    }

    if (errors.length > 0) {
      return { isValid: false, errors }
    }

    // 6. Create sanitized action
    // FORCE confirmation for sensitive actions - regardless of LLM output
    const forceConfirmation = FORCE_CONFIRMATION_ACTIONS.includes(action.type)

    const sanitizedAction: ConversationAction = {
      type: action.type,
      label: this.sanitizeLabel(action.label),
      description: action.description ? this.sanitizeLabel(action.description) : undefined,
      params: sanitizedParams,
      // Force confirmation for sensitive actions OR if permission requires it
      requiresConfirmation: forceConfirmation || permission.requiresConfirmation || permission.risk === 'high',
      isPremium: !permission.allowedTiers.includes('free'),
    }

    return { isValid: true, errors: [], sanitizedAction }
  }

  /**
   * Execute an action (after validation)
   * @param action The action to execute
   * @param context The conversation context
   * @param userConfirmed Whether user has explicitly confirmed (required for sensitive actions)
   */
  async executeAction(
    action: ConversationAction,
    context: ConversationContextFull,
    userConfirmed: boolean = false
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    // Validate first
    const validation = this.validateAction(action, context)
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') }
    }

    // SECURITY: Require explicit confirmation for sensitive actions
    if (FORCE_CONFIRMATION_ACTIONS.includes(action.type) && !userConfirmed) {
      return {
        success: false,
        error: 'Cette action nécessite ta confirmation explicite',
        result: { requiresConfirmation: true, actionType: action.type },
      }
    }

    // Track usage
    this.trackUsage(action.type)

    // Execute based on type
    try {
      switch (action.type) {
        case 'SUGGEST_MEAL':
          return this.executeSuggestMeal(action.params)

        case 'LOG_MEAL_QUICK':
          return this.executeLogMealQuick(action.params)

        case 'NAVIGATE_TO':
          return this.executeNavigateTo(action.params)

        case 'SHOW_PROGRESS':
          return this.executeShowProgress(action.params)

        case 'START_BREATHING':
          return this.executeStartBreathing(action.params)

        case 'START_CHALLENGE':
          return this.executeStartChallenge(action.params)

        case 'ADJUST_CALORIES':
          return this.executeAdjustCalories(action.params, context)

        case 'SCHEDULE_REMINDER':
          return this.executeScheduleReminder(action.params)

        case 'SHOW_INSIGHT':
          return this.executeShowInsight(action.params)

        case 'CONTACT_SUPPORT':
          return this.executeContactSupport(action.params)

        default:
          return { success: false, error: `Unknown action type: ${action.type}` }
      }
    } catch (error) {
      console.error(`[ActionService] Error executing ${action.type}:`, error)
      return { success: false, error: 'Une erreur est survenue' }
    }
  }

  /**
   * Build actions for a response (validates and filters)
   */
  buildValidActions(
    proposedActions: Partial<ConversationAction>[],
    context: ConversationContextFull
  ): ConversationAction[] {
    const validActions: ConversationAction[] = []

    for (const proposed of proposedActions) {
      // Ensure required fields
      if (!proposed.type || !proposed.label) continue

      const action: ConversationAction = {
        type: proposed.type,
        label: proposed.label,
        description: proposed.description,
        params: proposed.params || {},
        requiresConfirmation: proposed.requiresConfirmation || false,
        isPremium: proposed.isPremium || false,
      }

      const validation = this.validateAction(action, context)
      if (validation.isValid && validation.sanitizedAction) {
        validActions.push(validation.sanitizedAction)
      }
    }

    // Limit to 3 actions max
    return validActions.slice(0, 3)
  }

  // ============================================================================
  // PRIVATE EXECUTION METHODS
  // ============================================================================

  private async executeSuggestMeal(params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    // This would integrate with meal plan agent
    console.log('[ActionService] Would suggest meal with params:', params)
    return {
      success: true,
      result: { action: 'navigate', screen: 'MealSuggestions', params },
    }
  }

  private async executeLogMealQuick(params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    if (params.openQuickLog) {
      return { success: true, result: { action: 'navigate', screen: 'AddMeal', params } }
    }
    // Would integrate with meal logging
    return { success: true, result: { action: 'logged' } }
  }

  private async executeNavigateTo(params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    return {
      success: true,
      result: { action: 'navigate', screen: params.screen, params: params.params },
    }
  }

  private async executeShowProgress(params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    return {
      success: true,
      result: { action: 'navigate', screen: 'Progress', params },
    }
  }

  private async executeStartBreathing(params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    return {
      success: true,
      result: { action: 'navigate', screen: 'BreathingExercise', params },
    }
  }

  private async executeStartChallenge(params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    // Would integrate with challenges service
    console.log('[ActionService] Would start challenge:', params.challengeId)
    return {
      success: true,
      result: { action: 'challenge_started', challengeId: params.challengeId },
    }
  }

  private async executeAdjustCalories(
    params: Record<string, unknown>,
    context: ConversationContextFull
  ): Promise<{ success: boolean; result?: unknown }> {
    const adjustment = params.adjustment as number
    const newTarget = context.nutrition.caloriesTarget + adjustment

    // Safety check
    if (newTarget < 1200 || newTarget > 4000) {
      return { success: false, error: 'Objectif calorique hors limites sécuritaires' }
    }

    console.log('[ActionService] Would adjust calories by:', adjustment)
    return {
      success: true,
      result: { action: 'calories_adjusted', newTarget },
    }
  }

  private async executeScheduleReminder(params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    // Would integrate with notification service
    console.log('[ActionService] Would schedule reminder:', params.message)
    return {
      success: true,
      result: { action: 'reminder_scheduled' },
    }
  }

  private async executeShowInsight(params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    return {
      success: true,
      result: { action: 'show_insight', insightType: params.insightType },
    }
  }

  private async executeContactSupport(params: Record<string, unknown>): Promise<{ success: boolean; result?: unknown }> {
    return {
      success: true,
      result: { action: 'open_support', topic: params.topic },
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getTodayCount(actionType: ActionType): number {
    const today = new Date().toDateString()
    if (this.usageTracker.date !== today) {
      this.usageTracker = { date: today, counts: {} }
    }
    return this.usageTracker.counts[actionType] || 0
  }

  private trackUsage(actionType: ActionType): void {
    const today = new Date().toDateString()
    if (this.usageTracker.date !== today) {
      this.usageTracker = { date: today, counts: {} }
    }
    this.usageTracker.counts[actionType] = (this.usageTracker.counts[actionType] || 0) + 1
  }

  private sanitizeLabel(label: string): string {
    // Remove potential XSS, limit length
    return label
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .substring(0, 100)
      .trim()
  }
}

// Export singleton
export const conversationActionService = new ConversationActionService()
