/**
 * Nutrition Insights - LYM Health Module
 *
 * Calculates weekly nutrition summaries and ranges.
 * Provides "reperes" (markers), not targets or goals.
 */

import type { Meal, NutritionInfo, NutritionalNeeds } from '../../../types'
import type { MacroRange, NutritionRanges } from '../types'

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Default ranges when no user profile is available
 * These are approximate "zones de confort" for most adults
 */
const DEFAULT_RANGES: NutritionRanges = {
  calories: { min: 1600, max: 2200, unit: 'kcal' },
  proteins: { min: 50, max: 100, unit: 'g' },
  carbs: { min: 200, max: 300, unit: 'g' },
  fats: { min: 50, max: 80, unit: 'g' },
  fiber: { min: 25, max: 35, unit: 'g' },
}

/**
 * Variance percentage for creating ranges from targets
 */
const RANGE_VARIANCE = 0.15 // 15%

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
 * Create a range from a target value with variance
 */
function createRange(target: number, unit: 'g' | 'kcal', variance = RANGE_VARIANCE): MacroRange {
  return {
    min: Math.round(target * (1 - variance)),
    max: Math.round(target * (1 + variance)),
    unit,
  }
}

// =============================================================================
// WEEKLY SUMMARY
// =============================================================================

export interface WeeklySummary {
  /** Average daily calories */
  avgCalories: number
  /** Average daily proteins */
  avgProteins: number
  /** Average daily carbs */
  avgCarbs: number
  /** Average daily fats */
  avgFats: number
  /** Average daily fiber */
  avgFiber: number
  /** Days with logged meals */
  daysWithData: number
  /** Total days in period */
  totalDays: number
}

/**
 * Calculate weekly nutrition summary
 *
 * @param meals - Meals to analyze
 * @param dailyData - Optional daily data record
 * @param days - Number of days to include (default 7)
 * @returns Weekly summary with averages
 */
export function calculateWeeklySummary(
  meals: Meal[],
  dailyData?: Record<string, { meals: Meal[]; totalNutrition?: NutritionInfo }>,
  days = 7
): WeeklySummary {
  const lastNDays = getLastNDays(days)
  const dailyTotals: NutritionInfo[] = []

  for (const date of lastNDays) {
    let dayNutrition: NutritionInfo = { calories: 0, proteins: 0, carbs: 0, fats: 0, fiber: 0 }

    if (dailyData && dailyData[date]) {
      const dayData = dailyData[date]
      if (dayData.totalNutrition) {
        dayNutrition = dayData.totalNutrition
      } else if (dayData.meals.length > 0) {
        // Calculate from meals
        for (const meal of dayData.meals) {
          dayNutrition.calories += meal.totalNutrition?.calories || 0
          dayNutrition.proteins += meal.totalNutrition?.proteins || 0
          dayNutrition.carbs += meal.totalNutrition?.carbs || 0
          dayNutrition.fats += meal.totalNutrition?.fats || 0
          dayNutrition.fiber = (dayNutrition.fiber || 0) + (meal.totalNutrition?.fiber || 0)
        }
      }
    } else {
      // Filter meals by date
      const dayMeals = meals.filter(m => m.date === date)
      for (const meal of dayMeals) {
        dayNutrition.calories += meal.totalNutrition?.calories || 0
        dayNutrition.proteins += meal.totalNutrition?.proteins || 0
        dayNutrition.carbs += meal.totalNutrition?.carbs || 0
        dayNutrition.fats += meal.totalNutrition?.fats || 0
        dayNutrition.fiber = (dayNutrition.fiber || 0) + (meal.totalNutrition?.fiber || 0)
      }
    }

    // Only count days with data
    if (dayNutrition.calories > 0) {
      dailyTotals.push(dayNutrition)
    }
  }

  const daysWithData = dailyTotals.length

  if (daysWithData === 0) {
    return {
      avgCalories: 0,
      avgProteins: 0,
      avgCarbs: 0,
      avgFats: 0,
      avgFiber: 0,
      daysWithData: 0,
      totalDays: days,
    }
  }

  const totals = dailyTotals.reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      proteins: acc.proteins + day.proteins,
      carbs: acc.carbs + day.carbs,
      fats: acc.fats + day.fats,
      fiber: (acc.fiber ?? 0) + (day.fiber || 0),
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0, fiber: 0 as number }
  )

  return {
    avgCalories: Math.round(totals.calories / daysWithData),
    avgProteins: Math.round(totals.proteins / daysWithData),
    avgCarbs: Math.round(totals.carbs / daysWithData),
    avgFats: Math.round(totals.fats / daysWithData),
    avgFiber: Math.round((totals.fiber ?? 0) / daysWithData),
    daysWithData,
    totalDays: days,
  }
}

// =============================================================================
// NUTRITION RANGES
// =============================================================================

/**
 * Create nutrition ranges from user's nutritional needs
 * Returns "zones de confort", not strict targets
 *
 * @param needs - User's calculated nutritional needs
 * @returns Ranges for each macro
 */
export function createNutritionRanges(needs?: Partial<NutritionalNeeds>): NutritionRanges {
  if (!needs || !needs.calories) {
    return DEFAULT_RANGES
  }

  return {
    calories: createRange(needs.calories, 'kcal'),
    proteins: createRange(needs.proteins || 100, 'g'),
    carbs: createRange(needs.carbs || 250, 'g'),
    fats: createRange(needs.fats || 70, 'g'),
    fiber: createRange(needs.fiber || 25, 'g'),
  }
}

/**
 * Check if a value is within a range
 * Returns: 'below' | 'within' | 'above'
 */
export function checkRangePosition(value: number, range: MacroRange): 'below' | 'within' | 'above' {
  if (value < range.min) return 'below'
  if (value > range.max) return 'above'
  return 'within'
}

/**
 * Get friendly label for range position
 * No judgment - just factual
 */
export function getRangePositionLabel(position: 'below' | 'within' | 'above'): string {
  switch (position) {
    case 'below':
      return 'En dessous du repere'
    case 'within':
      return 'Dans la zone de confort'
    case 'above':
      return 'Au-dessus du repere'
  }
}

// =============================================================================
// INSIGHTS GENERATION
// =============================================================================

export interface NutritionInsight {
  type: 'info' | 'suggestion'
  macro: 'calories' | 'proteins' | 'carbs' | 'fats' | 'fiber'
  message: string
}

/**
 * Generate nutrition insights based on weekly summary
 * No judgment, no "good/bad", just helpful observations
 *
 * @param summary - Weekly nutrition summary
 * @param ranges - User's nutrition ranges
 * @returns Array of insights
 */
export function generateNutritionInsights(
  summary: WeeklySummary,
  ranges: NutritionRanges
): NutritionInsight[] {
  const insights: NutritionInsight[] = []

  if (summary.daysWithData < 3) {
    insights.push({
      type: 'info',
      macro: 'calories',
      message: 'Pas assez de donnees cette semaine pour des reperes precis.',
    })
    return insights
  }

  // Proteins
  const proteinPosition = checkRangePosition(summary.avgProteins, ranges.proteins)
  if (proteinPosition === 'below') {
    insights.push({
      type: 'suggestion',
      macro: 'proteins',
      message: `Tes proteines sont un peu basses (${summary.avgProteins}g en moyenne). Les proteines aident a garder l'energie.`,
    })
  }

  // Fiber
  const fiberPosition = checkRangePosition(summary.avgFiber, ranges.fiber)
  if (fiberPosition === 'below') {
    insights.push({
      type: 'suggestion',
      macro: 'fiber',
      message: `Les fibres sont un peu basses cette semaine. Legumes, fruits, cereales completes peuvent aider.`,
    })
  }

  // Calories - only mention if significantly off
  const calorieDeviation = Math.abs(summary.avgCalories - (ranges.calories.min + ranges.calories.max) / 2)
  const calorieThreshold = (ranges.calories.max - ranges.calories.min) * 0.5

  if (calorieDeviation > calorieThreshold) {
    const position = checkRangePosition(summary.avgCalories, ranges.calories)
    if (position === 'below') {
      insights.push({
        type: 'info',
        macro: 'calories',
        message: `Tes apports caloriques sont bas cette semaine. Ecoute ta faim.`,
      })
    }
  }

  // Positive insight if everything is good
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      macro: 'calories',
      message: 'Tes reperes de la semaine sont equilibres. Continue a ton rythme !',
    })
  }

  return insights
}

export default calculateWeeklySummary
