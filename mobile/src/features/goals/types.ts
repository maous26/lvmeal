/**
 * LYM Goals & Health Module - Types
 *
 * Types for the new goals system with health priorities.
 * Maintains backward compatibility with existing Goal type.
 */

import type { NutritionInfo, Meal, FoodItem } from '../../types'

// =============================================================================
// GOALS & PRIORITIES
// =============================================================================

/**
 * User-visible goals (only 3 shown in onboarding)
 * Internal goals (maintenance, energy) are mapped to these
 */
export type VisibleGoal = 'weight_loss' | 'muscle_gain' | 'health'

/**
 * Health priorities - shown when user selects "Ameliorer ma sante"
 */
export type HealthPriority = 'better_eating' | 'more_energy' | 'stress'

/**
 * Labels for health priorities (FR)
 */
export const HEALTH_PRIORITY_LABELS: Record<HealthPriority, { title: string; description: string }> = {
  better_eating: {
    title: 'Mieux manger',
    description: 'Variete, equilibre, sans rigidite',
  },
  more_energy: {
    title: "Plus d'energie",
    description: 'Vitalite au quotidien',
  },
  stress: {
    title: 'Stress',
    description: 'Apaisement, routines legeres',
  },
}

// =============================================================================
// FOOD GROUPS & DIVERSITY
// =============================================================================

/**
 * Food groups for diversity calculation
 */
export type FoodGroup =
  | 'fruits'
  | 'vegetables'
  | 'proteins'
  | 'legumes'
  | 'whole_grains'
  | 'dairy'
  | 'nuts_seeds'
  | 'fish'

/**
 * Labels for food groups (FR)
 */
export const FOOD_GROUP_LABELS: Record<FoodGroup, string> = {
  fruits: 'Fruits',
  vegetables: 'Legumes',
  proteins: 'Proteines',
  legumes: 'Legumineuses',
  whole_grains: 'Cereales completes',
  dairy: 'Produits laitiers',
  nuts_seeds: 'Oleagineux',
  fish: 'Poissons',
}

/**
 * Diversity level - qualitative, never a score
 */
export type DiversityLevel = 'low' | 'medium' | 'good'

/**
 * Diversity calculation result
 */
export interface DiversityResult {
  /** Groups present in the last 7 days */
  presentGroups: FoodGroup[]
  /** Groups missing in the last 7 days */
  missingGroups: FoodGroup[]
  /** Qualitative level */
  level: DiversityLevel
  /** Count per group */
  groupCounts: Record<FoodGroup, number>
}

// =============================================================================
// ENERGY SIGNALS
// =============================================================================

/**
 * Energy signals that trigger advice
 * These are detected automatically based on meal data
 */
export interface EnergySignals {
  /** Proteins below lower bound for 3+ consecutive days */
  lowProtein3Days: boolean
  /** Fiber below lower bound for 3+ consecutive days */
  lowFiber3Days: boolean
  /** Ultra-processed foods frequent (NOVA 4) */
  highUltraProcessed: boolean
  /** Details for context */
  details?: {
    proteinDaysLow?: number
    fiberDaysLow?: number
    ultraProcessedPercentage?: number
  }
}

// =============================================================================
// MACRO RANGES (not targets, not goals)
// =============================================================================

/**
 * Macro range - displayed as "zone de confort", never as target
 */
export interface MacroRange {
  min: number
  max: number
  unit: 'g' | 'kcal'
}

/**
 * Nutrition ranges for the week
 */
export interface NutritionRanges {
  calories: MacroRange
  proteins: MacroRange
  carbs: MacroRange
  fats: MacroRange
  fiber: MacroRange
}

// =============================================================================
// ADVICE & RECOMMENDATIONS
// =============================================================================

/**
 * Advice card type
 */
export type AdviceType =
  | 'better_eating'
  | 'more_energy'
  | 'stress'
  | 'supplementation_info'
  | 'diversity'
  | 'general'

/**
 * Advice card returned by recommendations service
 */
export interface AdviceCard {
  id: string
  type: AdviceType
  title: string
  content: string
  /** Optional disclaimer (especially for supplementation) */
  disclaimer?: string
  /** Priority for display order */
  priority: number
  /** When the advice was generated */
  createdAt: string
  /** Optional action items from LymIA Brain */
  actionItems?: string[]
}

/**
 * Context sent to recommendations service
 */
export interface AdviceContext {
  /** User's goal (internal) */
  objective: 'weight_loss' | 'muscle_gain' | 'maintenance' | 'health' | 'energy'
  /** Health priorities if goal is health */
  healthPriorities?: HealthPriority[]
  /** 7-day nutrition summary */
  weekSummary: {
    avgCalories: number
    avgProteins: number
    avgCarbs: number
    avgFats: number
    avgFiber: number
  }
  /** Diversity result */
  diversity: DiversityResult
  /** Energy signals detected */
  energySignals: EnergySignals
  /** Check-in data if available */
  checkin?: {
    energyLevel?: 1 | 2 | 3 | 4 | 5
    stressLevel?: 1 | 2 | 3 | 4 | 5
    sleepHours?: number
    hydrationLiters?: number
  }
  /** User preferences */
  userPrefs?: {
    allergies?: string[]
    dietType?: string
  }
}

// =============================================================================
// CHECK-IN
// =============================================================================

/**
 * Check-in entry (simplified, optional fields)
 */
export interface HealthCheckin {
  id: string
  date: string
  /** Energy level 1-5 (emoji scale) */
  energyLevel: 1 | 2 | 3 | 4 | 5
  /** Optional stress level */
  stressLevel?: 1 | 2 | 3 | 4 | 5
  /** Optional sleep hours */
  sleepHours?: number
  /** Optional hydration */
  hydrationLiters?: number
  createdAt: string
}

/**
 * Check-in prompt state
 */
export interface CheckinPromptState {
  /** Last check-in date */
  lastCheckinDate: string | null
  /** Last prompt shown date */
  lastPromptDate: string | null
  /** Number of prompts shown this week */
  promptsThisWeek: number
}

// =============================================================================
// ROUTINE EQUILIBRE (ex-Metabolic Boost)
// =============================================================================

/**
 * Routine Equilibre daily entry
 * No scores, no streaks, just presence
 */
export interface RoutineEquilibreEntry {
  date: string
  /** Ate to hunger (not restriction) */
  ateToHunger?: boolean
  /** Walked 20-30 min */
  walked?: boolean
  /** Slept 7-8h */
  sleptWell?: boolean
  /** Drank ~2L water */
  hydratedWell?: boolean
}

/**
 * Weekly presence summary (replaces streak)
 */
export interface WeeklyPresence {
  /** Days with at least one entry this week (0-7) */
  daysPresent: number
  /** Start of week */
  weekStart: string
}

// =============================================================================
// ANALYTICS EVENTS
// =============================================================================

/**
 * Analytics events for the goals/health module
 * No toxic metrics - only actions and engagement
 */
export type GoalsAnalyticsEvent =
  | 'objective_selected'
  | 'health_priorities_selected'
  | 'routine_equilibre_enabled'
  | 'routine_equilibre_disabled'
  | 'checkin_prompt_shown'
  | 'checkin_submitted'
  | 'checkin_skipped'
  | 'advice_requested'
  | 'advice_viewed'
  | 'health_overview_opened'
  | 'diversity_card_viewed'

// =============================================================================
// EXTENDED FOOD ITEM (with NOVA and food group)
// =============================================================================

/**
 * NOVA classification for ultra-processed detection
 */
export type NovaGroup = 1 | 2 | 3 | 4

/**
 * Extended food item with NOVA and food group
 * These are optional additions to the existing FoodItem type
 */
export interface ExtendedFoodData {
  /** NOVA classification (1=unprocessed, 4=ultra-processed) */
  novaGroup?: NovaGroup
  /** Food group for diversity */
  foodGroup?: FoodGroup
}
