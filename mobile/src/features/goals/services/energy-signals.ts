/**
 * Energy Signals Detector - LYM Health Module
 *
 * Detects 3 signals that may affect energy levels:
 * 1. Low protein for 3+ consecutive days
 * 2. Low fiber for 3+ consecutive days
 * 3. High ultra-processed food consumption (NOVA 4)
 *
 * These signals trigger contextual advice, not warnings.
 */

import type { Meal, NutritionInfo, FoodItem } from '../../../types'
import type { EnergySignals, NovaGroup } from '../types'

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Thresholds for signal detection
 * These are flexible "lower bounds", not strict targets
 */
const THRESHOLDS = {
  /** Minimum protein in grams per day (approximate for most adults) */
  proteinLowerBound: 50, // g/day - conservative lower bound
  /** Minimum fiber in grams per day */
  fiberLowerBound: 20, // g/day
  /** Consecutive days needed to trigger protein/fiber signals */
  consecutiveDaysThreshold: 3,
  /** Percentage of ultra-processed items above which signal triggers */
  ultraProcessedPercentage: 40, // % of items over 7 days
  /** Alternative: days with majority ultra-processed */
  ultraProcessedDaysThreshold: 3, // days out of 7
}

// =============================================================================
// NOVA DETECTION HEURISTICS
// =============================================================================

/**
 * Keywords that suggest ultra-processed foods (NOVA 4)
 * This is a heuristic - ideally use NOVA from OpenFoodFacts
 */
const ULTRA_PROCESSED_KEYWORDS = [
  // Snacks & confectionery
  'chips', 'bonbon', 'bonbons', 'chocolat au lait', 'biscuit', 'cookie',
  'gateau industriel', 'viennoiserie industrielle', 'barre chocolatee',
  'cereales petit dejeuner', 'cereales sucrees',
  // Beverages
  'soda', 'coca', 'fanta', 'sprite', 'boisson sucree', 'boisson energisante',
  'jus de fruit industriel', 'sirop',
  // Prepared foods
  'nugget', 'cordon bleu', 'pizza surgelee', 'plat prepare', 'plat cuisine',
  'lasagne surgelee', 'burger industriel', 'hot dog',
  // Processed meats
  'saucisse industrielle', 'jambon reconstitue', 'surimi',
  // Sauces & spreads
  'ketchup', 'mayonnaise industrielle', 'sauce barbecue',
  'pate a tartiner', 'nutella',
  // Dairy
  'yaourt sucre', 'dessert lacte', 'creme dessert', 'glace industrielle',
  // Bread & bakery
  'pain de mie industriel', 'brioche industrielle',
  // Generic markers
  'industriel', 'transforme', 'ultra-transforme',
]

/**
 * Keywords that suggest minimally processed foods (NOVA 1)
 */
const MINIMALLY_PROCESSED_KEYWORDS = [
  'frais', 'cru', 'nature', 'bio', 'entier',
  'legume frais', 'fruit frais', 'viande fraiche', 'poisson frais',
  'oeuf', 'lait', 'yaourt nature', 'fromage blanc nature',
  'riz', 'pates', 'pain complet', 'flocons d\'avoine',
]

/**
 * Estimate NOVA group from food item
 * Returns 4 (ultra-processed) if detected, null otherwise
 */
export function estimateNovaGroup(food: FoodItem): NovaGroup | null {
  const searchText = `${food.name} ${food.category || ''} ${food.brand || ''}`.toLowerCase()

  // Check for ultra-processed markers first
  for (const keyword of ULTRA_PROCESSED_KEYWORDS) {
    if (searchText.includes(keyword.toLowerCase())) {
      return 4
    }
  }

  // Check for minimally processed markers
  for (const keyword of MINIMALLY_PROCESSED_KEYWORDS) {
    if (searchText.includes(keyword.toLowerCase())) {
      return 1
    }
  }

  // Unknown - don't assume
  return null
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get dates for the last N days in YYYY-MM-DD format
 */
function getLastNDays(n: number): string[] {
  const dates: string[] = []
  const today = new Date()

  for (let i = 0; i < n; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    dates.push(date.toISOString().split('T')[0])
  }

  return dates
}

/**
 * Calculate daily totals from meals
 */
function getDailyTotals(
  meals: Meal[],
  dailyData?: Record<string, { meals: Meal[]; totalNutrition?: NutritionInfo }>
): Map<string, { protein: number; fiber: number; totalItems: number; novaItems: number }> {
  const dailyTotals = new Map<string, { protein: number; fiber: number; totalItems: number; novaItems: number }>()

  // Initialize with dailyData if provided
  if (dailyData) {
    for (const [date, data] of Object.entries(dailyData)) {
      const dayMeals = data.meals || []
      let protein = 0
      let fiber = 0
      let totalItems = 0
      let novaItems = 0

      for (const meal of dayMeals) {
        protein += meal.totalNutrition?.proteins || 0
        fiber += meal.totalNutrition?.fiber || 0

        for (const item of meal.items) {
          totalItems++
          // Check for NOVA 4
          const foodWithNova = item.food as FoodItem & { novaGroup?: NovaGroup }
          const nova = foodWithNova.novaGroup || estimateNovaGroup(item.food)
          if (nova === 4) {
            novaItems++
          }
        }
      }

      dailyTotals.set(date, { protein, fiber, totalItems, novaItems })
    }
  } else {
    // Process meals directly
    for (const meal of meals) {
      const date = meal.date
      const existing = dailyTotals.get(date) || { protein: 0, fiber: 0, totalItems: 0, novaItems: 0 }

      existing.protein += meal.totalNutrition?.proteins || 0
      existing.fiber += meal.totalNutrition?.fiber || 0

      for (const item of meal.items) {
        existing.totalItems++
        const foodWithNova = item.food as FoodItem & { novaGroup?: NovaGroup }
        const nova = foodWithNova.novaGroup || estimateNovaGroup(item.food)
        if (nova === 4) {
          existing.novaItems++
        }
      }

      dailyTotals.set(date, existing)
    }
  }

  return dailyTotals
}

// =============================================================================
// MAIN DETECTOR
// =============================================================================

/**
 * Detect energy signals from meal data
 *
 * @param meals - Meals to analyze
 * @param dailyData - Optional daily data record
 * @param proteinLowerBound - Optional custom protein threshold
 * @param fiberLowerBound - Optional custom fiber threshold
 * @returns EnergySignals with detected signals and details
 */
export function detectEnergySignals(
  meals: Meal[],
  dailyData?: Record<string, { meals: Meal[]; totalNutrition?: NutritionInfo }>,
  proteinLowerBound = THRESHOLDS.proteinLowerBound,
  fiberLowerBound = THRESHOLDS.fiberLowerBound
): EnergySignals {
  const last7Days = getLastNDays(7)
  const dailyTotals = getDailyTotals(meals, dailyData)

  // =========================================================================
  // SIGNAL 1: Low protein for 3+ consecutive days
  // =========================================================================
  let proteinDaysLow = 0
  let maxConsecutiveProteinLow = 0
  let currentConsecutiveProteinLow = 0

  // Check from most recent to oldest
  for (const date of last7Days) {
    const dayData = dailyTotals.get(date)
    // Only count days with logged meals
    if (dayData && dayData.totalItems > 0) {
      if (dayData.protein < proteinLowerBound) {
        proteinDaysLow++
        currentConsecutiveProteinLow++
        maxConsecutiveProteinLow = Math.max(maxConsecutiveProteinLow, currentConsecutiveProteinLow)
      } else {
        currentConsecutiveProteinLow = 0
      }
    } else {
      // No data for this day - break the streak
      currentConsecutiveProteinLow = 0
    }
  }

  const lowProtein3Days = maxConsecutiveProteinLow >= THRESHOLDS.consecutiveDaysThreshold

  // =========================================================================
  // SIGNAL 2: Low fiber for 3+ consecutive days
  // =========================================================================
  let fiberDaysLow = 0
  let maxConsecutiveFiberLow = 0
  let currentConsecutiveFiberLow = 0

  for (const date of last7Days) {
    const dayData = dailyTotals.get(date)
    if (dayData && dayData.totalItems > 0) {
      if (dayData.fiber < fiberLowerBound) {
        fiberDaysLow++
        currentConsecutiveFiberLow++
        maxConsecutiveFiberLow = Math.max(maxConsecutiveFiberLow, currentConsecutiveFiberLow)
      } else {
        currentConsecutiveFiberLow = 0
      }
    } else {
      currentConsecutiveFiberLow = 0
    }
  }

  const lowFiber3Days = maxConsecutiveFiberLow >= THRESHOLDS.consecutiveDaysThreshold

  // =========================================================================
  // SIGNAL 3: High ultra-processed consumption
  // =========================================================================
  let totalItems = 0
  let totalNovaItems = 0
  let daysWithMajorityUltraProcessed = 0

  for (const date of last7Days) {
    const dayData = dailyTotals.get(date)
    if (dayData && dayData.totalItems > 0) {
      totalItems += dayData.totalItems
      totalNovaItems += dayData.novaItems

      // Check if majority of day is ultra-processed
      const dayUltraPercentage = (dayData.novaItems / dayData.totalItems) * 100
      if (dayUltraPercentage > 50) {
        daysWithMajorityUltraProcessed++
      }
    }
  }

  const overallUltraPercentage = totalItems > 0 ? (totalNovaItems / totalItems) * 100 : 0

  const highUltraProcessed =
    overallUltraPercentage >= THRESHOLDS.ultraProcessedPercentage ||
    daysWithMajorityUltraProcessed >= THRESHOLDS.ultraProcessedDaysThreshold

  return {
    lowProtein3Days,
    lowFiber3Days,
    highUltraProcessed,
    details: {
      proteinDaysLow,
      fiberDaysLow,
      ultraProcessedPercentage: Math.round(overallUltraPercentage),
    },
  }
}

/**
 * Check if any energy signal is active
 */
export function hasActiveEnergySignals(signals: EnergySignals): boolean {
  return signals.lowProtein3Days || signals.lowFiber3Days || signals.highUltraProcessed
}

/**
 * Get friendly message for active signals
 * No judgment, just helpful information
 */
export function getEnergySignalMessage(signals: EnergySignals): string | null {
  const activeSignals: string[] = []

  if (signals.lowProtein3Days) {
    activeSignals.push('proteines')
  }
  if (signals.lowFiber3Days) {
    activeSignals.push('fibres')
  }

  if (activeSignals.length === 0 && !signals.highUltraProcessed) {
    return null
  }

  if (activeSignals.length > 0) {
    const joined = activeSignals.join(' et ')
    return `Tes apports en ${joined} sont un peu bas ces derniers jours. C'est un repere, pas une alarme.`
  }

  if (signals.highUltraProcessed) {
    return `Beaucoup de produits transformes cette semaine. Peut-etre ajouter quelques aliments frais ?`
  }

  return null
}

export default detectEnergySignals
