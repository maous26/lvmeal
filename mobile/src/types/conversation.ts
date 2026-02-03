/**
 * Conversation Types - LYM Conversational AI Coach
 *
 * Key design decisions:
 * 1. Separate full context (local) from compact context (for LLM)
 * 2. Top-3 intents instead of single intent
 * 3. Strict action whitelist
 * 4. Safety flags for health-sensitive content
 */

// ============================================================================
// USER INTENTS
// ============================================================================

export type UserIntent =
  // Besoins physiologiques
  | 'HUNGER'              // "J'ai faim", "Qu'est-ce que je mange ?"
  | 'CRAVING'             // "J'ai envie de sucré"
  | 'FATIGUE'             // "Je suis crevé"
  | 'LOW_ENERGY'          // "Pas la forme"
  | 'THIRST'              // "J'ai soif"

  // États émotionnels
  | 'STRESS'              // "Journée difficile"
  | 'ANXIETY'             // "Je stresse pour..."
  | 'FRUSTRATION'         // "Ça ne marche pas"
  | 'CELEBRATION'         // "J'ai réussi !"
  | 'SADNESS'             // "Je me sens pas bien"

  // Demandes d'information
  | 'PROGRESS_CHECK'      // "Où j'en suis ?"
  | 'EXPLAIN_DECISION'    // "Pourquoi tu me dis ça ?"
  | 'NUTRITION_QUESTION'  // "C'est bon les noix ?"

  // Demandes d'action
  | 'MEAL_SUGGESTION'     // "Propose-moi un truc"
  | 'PLAN_MODIFICATION'   // "Ajuste mes objectifs"
  | 'CHALLENGE_START'     // "Je veux un défi"
  | 'PHASE_QUESTION'      // "C'est quoi la prochaine phase ?"
  | 'LOG_MEAL'            // "J'ai mangé..."

  // Signaux de désengagement
  | 'OVERWHELM'           // "C'est trop compliqué"
  | 'DOUBT'               // "Est-ce que ça sert à quelque chose ?"
  | 'PLATEAU'             // "Je stagne"

  // Meta-conversation
  | 'GREETING'            // "Salut"
  | 'FEEDBACK'            // "J'aime bien / pas"
  | 'HELP'                // "Comment ça marche ?"
  | 'UNKNOWN'             // Fallback

// ============================================================================
// INTENT DETECTION
// ============================================================================

export interface DetectedIntent {
  intent: UserIntent
  confidence: number
}

export interface IntentDetectionResult {
  // Top 3 intents instead of single (recommendation #2)
  topIntents: [DetectedIntent, DetectedIntent?, DetectedIntent?]
  entities: ExtractedEntity[]
  sentiment: 'positive' | 'neutral' | 'negative'
  urgency: 'low' | 'medium' | 'high'
  // Safety flags (recommendation #3)
  safetyFlags: SafetyFlag[]
}

export interface ExtractedEntity {
  type: 'food' | 'time' | 'quantity' | 'emotion' | 'goal' | 'duration' | 'meal_type'
  value: string
  normalized: string | number | null
  position: [number, number]
}

// ============================================================================
// SAFETY (Recommendation #3)
// ============================================================================

export type SafetyFlag =
  | 'POTENTIAL_TCA'           // Eating disorder signals
  | 'MEDICAL_ADVICE_REQUEST'  // User asking for medical advice
  | 'PREGNANCY_MENTION'       // Pregnancy-related
  | 'MINOR_USER'              // User mentions being underage
  | 'EXTREME_RESTRICTION'     // Dangerous calorie restriction
  | 'SELF_HARM_SIGNAL'        // Mental health concern
  | 'DIABETES_MENTION'        // Chronic condition
  | 'ALLERGY_MENTION'         // Food allergy

export interface SafetyCheckResult {
  isAllowed: boolean
  flags: SafetyFlag[]
  action: 'allow' | 'safe_rewrite' | 'refuse_redirect'
  redirectMessage?: string
  disclaimer?: string
}

// ============================================================================
// CONTEXT (Recommendation #1 - Separate full vs compact)
// ============================================================================

/**
 * Full context stored locally - NOT sent to LLM
 */
export interface ConversationContextFull {
  // État nutritionnel complet
  nutrition: {
    caloriesConsumed: number
    caloriesRemaining: number
    caloriesTarget: number
    macroBalance: { proteins: number; carbs: number; fats: number }
    macroTargets: { proteins: number; carbs: number; fats: number }
    lastMealTime: string | null
    todayMeals: MealEntry[]
    weeklyTrend: 'deficit' | 'balanced' | 'surplus'
    avgCaloriesLast7Days: number
  }

  // État bien-être complet
  wellness: {
    currentMood: MoodType | null
    sleepLastNight: { hours: number; quality: 'poor' | 'fair' | 'good' | 'excellent' } | null
    stressLevel: number | null  // 1-10
    energyLevel: number | null  // 1-10
    hydration: number           // glasses
    weight: number | null
    weightTrend: 'losing' | 'stable' | 'gaining' | null
  }

  // Corrélations détectées (full)
  correlations: {
    sleepNutrition: CorrelationInsight[]
    stressEating: CorrelationInsight[]
    energyPatterns: CorrelationInsight[]
  }

  // Programme en cours
  program: {
    currentPhase: string | null
    dayInPhase: number
    phaseProgress: number        // 0-100
    upcomingMilestone: string | null
    totalDaysInProgram: number
  }

  // Gamification
  gamification: {
    currentStreak: number
    level: number
    xp: number
    xpToNextLevel: number
    activeChallenge: ActiveChallenge | null
    recentAchievements: Achievement[]
  }

  // Historique conversationnel COMPLET (local only)
  conversationHistoryFull: ConversationTurn[]

  // Signaux temporels
  temporal: {
    timeOfDay: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'
    dayOfWeek: number
    isWeekend: boolean
    hoursSinceLastMeal: number
    hoursSinceWakeup: number | null
    currentHour: number
  }

  // User info
  user: {
    firstName: string | null
    isPremium: boolean
    daysInApp: number
    preferredLanguage: 'fr' | 'en'
  }
}

/**
 * Compact context for LLM - minimal tokens (Recommendation #1)
 */
export interface ConversationContextCompact {
  // Nutrition summary
  n: {
    cal: number           // calories remaining
    lastMeal: string      // "3h" format
    trend: 'D' | 'B' | 'S' // Deficit/Balanced/Surplus
  }

  // Wellness summary
  w: {
    mood: string | null   // "stressed", "happy", etc.
    energy: number | null // 1-10
    sleep: number | null  // hours
  }

  // Key correlations (just flags)
  c: {
    stressEat: boolean    // has stress-eating pattern
    sleepImpact: boolean  // sleep affects nutrition
  }

  // Last 3 conversation turns only
  h: CompactTurn[]

  // Memory summary (generated periodically)
  mem?: string           // "User prefers quick meals, struggles with evenings"

  // Temporal
  t: {
    tod: 'M' | 'D' | 'A' | 'E' | 'N'  // time of day
    we: boolean                        // is weekend
  }
}

export interface CompactTurn {
  r: 'U' | 'A'  // role: User or Assistant
  m: string     // message (truncated if needed)
}

// ============================================================================
// ACTIONS (Recommendation #4 - Strict whitelist)
// ============================================================================

/**
 * Whitelisted action types - LLM cannot invent new ones
 */
export type ActionType =
  | 'SUGGEST_MEAL'
  | 'LOG_MEAL_QUICK'
  | 'ADJUST_CALORIES'
  | 'START_CHALLENGE'
  | 'NAVIGATE_TO'
  | 'SHOW_INSIGHT'
  | 'SCHEDULE_REMINDER'
  | 'START_BREATHING'
  | 'SHOW_PROGRESS'
  | 'CONTACT_SUPPORT'

/**
 * Action risk levels for confirmation requirements
 */
export type ActionRisk = 'low' | 'medium' | 'high'

/**
 * Action permission matrix
 */
export interface ActionPermission {
  type: ActionType
  allowedTiers: ('free' | 'premium')[]
  risk: ActionRisk
  requiresConfirmation: boolean
  maxPerDay?: number
}

export const ACTION_PERMISSIONS: Record<ActionType, ActionPermission> = {
  SUGGEST_MEAL: { type: 'SUGGEST_MEAL', allowedTiers: ['free', 'premium'], risk: 'low', requiresConfirmation: false },
  LOG_MEAL_QUICK: { type: 'LOG_MEAL_QUICK', allowedTiers: ['free', 'premium'], risk: 'low', requiresConfirmation: false },
  NAVIGATE_TO: { type: 'NAVIGATE_TO', allowedTiers: ['free', 'premium'], risk: 'low', requiresConfirmation: false },
  SHOW_INSIGHT: { type: 'SHOW_INSIGHT', allowedTiers: ['free', 'premium'], risk: 'low', requiresConfirmation: false },
  SHOW_PROGRESS: { type: 'SHOW_PROGRESS', allowedTiers: ['free', 'premium'], risk: 'low', requiresConfirmation: false },
  START_BREATHING: { type: 'START_BREATHING', allowedTiers: ['free', 'premium'], risk: 'low', requiresConfirmation: false },
  CONTACT_SUPPORT: { type: 'CONTACT_SUPPORT', allowedTiers: ['free', 'premium'], risk: 'low', requiresConfirmation: false },
  START_CHALLENGE: { type: 'START_CHALLENGE', allowedTiers: ['premium'], risk: 'medium', requiresConfirmation: true },
  ADJUST_CALORIES: { type: 'ADJUST_CALORIES', allowedTiers: ['premium'], risk: 'high', requiresConfirmation: true },
  SCHEDULE_REMINDER: { type: 'SCHEDULE_REMINDER', allowedTiers: ['premium'], risk: 'medium', requiresConfirmation: true, maxPerDay: 5 },
}

export interface ConversationAction {
  type: ActionType
  label: string
  description?: string
  params: Record<string, unknown>
  requiresConfirmation: boolean
  isPremium: boolean
}

// ============================================================================
// RESPONSE
// ============================================================================

export type ResponseTone = 'empathetic' | 'encouraging' | 'informative' | 'celebratory' | 'casual' | 'supportive'

export interface ConversationResponse {
  // Main message
  message: {
    text: string
    tone: ResponseTone
    emoji?: string
  }

  // Diagnosis (shown via "Pourquoi?" toggle - Recommendation #5)
  diagnosis?: {
    summary: string
    factors: DiagnosisFactor[]
    confidence: number
    dataPoints: string[]
  }

  // Short term plan (Premium)
  shortTermPlan?: {
    horizon: 'immediate' | 'today' | 'this_week'
    steps: PlanStep[]
    expectedOutcome: string
  }

  // Actions (validated against whitelist)
  actions: ConversationAction[]

  // UI elements
  ui?: {
    quickReplies?: QuickReply[]
    cards?: InfoCard[]
    showDiagnosisToggle?: boolean  // Recommendation #5
  }

  // Safety disclaimer if needed
  disclaimer?: string

  // Metadata
  meta: {
    responseId: string
    generatedAt: string
    model: 'rules' | 'hybrid' | 'llm'
    tokensUsed?: number
    processingTimeMs: number
  }
}

export interface DiagnosisFactor {
  label: string
  value: string
  impact: 'high' | 'medium' | 'low'
}

export interface PlanStep {
  action: string
  timing: string
  priority: 'high' | 'medium' | 'low'
}

export interface QuickReply {
  label: string
  intent?: UserIntent
  action?: ActionType
  params?: Record<string, unknown>
}

export interface InfoCard {
  type: 'meal_preview' | 'correlation_insight' | 'progress_chart' | 'challenge_preview'
  data: Record<string, unknown>
}

// ============================================================================
// CONVERSATION TURN
// ============================================================================

export interface ConversationTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  // For user messages
  detectedIntent?: IntentDetectionResult
  // For assistant messages
  response?: ConversationResponse
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export type MoodType = 'happy' | 'neutral' | 'stressed' | 'sad' | 'anxious' | 'energetic' | 'tired'

export interface MealEntry {
  id: string
  name: string
  calories: number
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  loggedAt: string
}

export interface CorrelationInsight {
  id?: string
  type: string
  correlation?: number  // -1 to 1
  description: string
  dataPoints?: number
  confidence?: number
  detectedAt?: string
}

// ============================================================================
// CONVERSATION MEMORY
// ============================================================================

export interface ConversationMemory {
  userPreferences: {
    foodLikes: string[]
    foodDislikes: string[]
    mealPreferences: string[]
    timingPreferences: string[]
  }
  patterns: {
    frequentIntents: string[]
    timePatterns: string[]
    triggerPatterns: string[]
  }
  conversationStats: {
    totalMessages: number
    averageSessionLength: number
    mostActiveTimeOfDay: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night' | null
  }
  learnedFacts: string[]
  lastUpdated: string
}

export interface ActiveChallenge {
  id: string
  name: string
  progress: number
  daysRemaining: number
}

export interface Achievement {
  id: string
  name: string
  earnedAt: string
}

// ============================================================================
// TIER CONFIGURATION
// ============================================================================

export interface ConversationTierConfig {
  dailyMessages: number | 'unlimited'
  llmCallsPerDay: number
  features: {
    guidedMode: boolean
    freeMode: boolean
    diagnosisIncluded: boolean
    shortTermPlan: boolean
    advancedActions: boolean
    voiceInput: boolean
  }
}

export const CONVERSATION_TIERS: Record<'free' | 'premium', ConversationTierConfig> = {
  free: {
    dailyMessages: 10,
    llmCallsPerDay: 1,  // 1 LLM call per day to avoid "stupid" responses (Recommendation #7)
    features: {
      guidedMode: true,
      freeMode: false,
      diagnosisIncluded: false,
      shortTermPlan: false,
      advancedActions: false,
      voiceInput: false,
    }
  },
  premium: {
    dailyMessages: 'unlimited',
    llmCallsPerDay: 20,
    features: {
      guidedMode: true,
      freeMode: true,
      diagnosisIncluded: true,
      shortTermPlan: true,
      advancedActions: true,
      voiceInput: true,
    }
  }
}

// ============================================================================
// METRICS (Recommendation #6 - Hypothesis tracking)
// ============================================================================

export interface ConversationMetrics {
  // Session metrics
  sessionId: string
  messagesInSession: number

  // For A/B testing
  hasCoachAccess: boolean
  experimentGroup?: 'control' | 'treatment'

  // Engagement
  intentDistribution: Partial<Record<UserIntent, number>>
  actionsExecuted: number
  diagnosisViewed: number

  // Satisfaction
  thumbsUp: number
  thumbsDown: number
}
