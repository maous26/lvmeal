/**
 * Progress Insights Service
 *
 * Generates contextual coach messages based on user data.
 * Rules:
 * - 1 message max per week
 * - Always link analysis to past, never promise future
 * - Show data reliability indicator
 * - Silence is a feature (no message if nothing meaningful to say)
 */

import type { WeightEntry } from '../types'

// Types
export interface ProgressData {
  // Weight data
  weightHistory: WeightEntry[]
  targetWeight?: number
  startWeight?: number

  // Nutrition data (7 days)
  weeklyNutrition: {
    date: string
    calories: number
    proteins: number
    carbs: number
    fats: number
  }[]
  nutritionGoals: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }

  // Health data (from HealthKit/HealthConnect)
  healthData?: {
    avgSteps7d: number
    avgSleepHours7d: number | null
    stepsGoal: number
  }
}

export interface CoachInsight {
  message: string
  type: 'info' | 'warning' | 'success' | 'question'
  reliability: 'high' | 'medium' | 'low'
  daysTracked: number
}

export interface WeightTrend {
  current: number
  trend7d: number | null // kg change over 7 days
  trend30d: number | null // kg change over 30 days
  weeklyRate: number | null // kg per week (smoothed)
  isPlateauDetected: boolean // stable ≥14 days
}

export interface NutritionSummary {
  avgCalories: number
  avgProteins: number
  avgCarbs: number
  avgFats: number
  daysTracked: number
  trackingRate: number // 0-1
}

export interface GapAnalysis {
  calories: { value: number; target: number; delta: number; status: 'ok' | 'warning' | 'over' }
  proteins: { value: number; target: number; delta: number; status: 'ok' | 'warning' | 'over' }
  steps: { value: number; target: number; delta: number; status: 'ok' | 'warning' | 'over' } | null
}

/**
 * Calculate weight trend from history
 */
export function calculateWeightTrend(weightHistory: WeightEntry[]): WeightTrend {
  if (!weightHistory || weightHistory.length === 0) {
    return {
      current: 0,
      trend7d: null,
      trend30d: null,
      weeklyRate: null,
      isPlateauDetected: false,
    }
  }

  const sorted = [...weightHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const current = sorted[0]?.weight || 0
  const now = new Date()

  // Find weight 7 days ago
  const date7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weight7dAgo = sorted.find(w => new Date(w.date) <= date7dAgo)?.weight
  const trend7d = weight7dAgo ? +(current - weight7dAgo).toFixed(2) : null

  // Find weight 30 days ago
  const date30dAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const weight30dAgo = sorted.find(w => new Date(w.date) <= date30dAgo)?.weight
  const trend30d = weight30dAgo ? +(current - weight30dAgo).toFixed(2) : null

  // Calculate weekly rate (smoothed over 4 weeks if available)
  let weeklyRate: number | null = null
  if (trend30d !== null) {
    weeklyRate = +(trend30d / 4).toFixed(2)
  } else if (trend7d !== null) {
    weeklyRate = trend7d
  }

  // Detect plateau: weight stable (±0.3kg) for ≥14 days
  let isPlateauDetected = false
  if (sorted.length >= 3) {
    const date14dAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const recentWeights = sorted.filter(w => new Date(w.date) >= date14dAgo)

    if (recentWeights.length >= 3) {
      const weights = recentWeights.map(w => w.weight)
      const min = Math.min(...weights)
      const max = Math.max(...weights)
      isPlateauDetected = (max - min) <= 0.5
    }
  }

  return {
    current,
    trend7d,
    trend30d,
    weeklyRate,
    isPlateauDetected,
  }
}

/**
 * Calculate nutrition summary for last 7 days
 */
export function calculateNutritionSummary(
  weeklyNutrition: ProgressData['weeklyNutrition']
): NutritionSummary {
  const daysWithData = weeklyNutrition.filter(d => d.calories > 0)
  const daysTracked = daysWithData.length
  const trackingRate = daysTracked / 7

  if (daysTracked === 0) {
    return {
      avgCalories: 0,
      avgProteins: 0,
      avgCarbs: 0,
      avgFats: 0,
      daysTracked: 0,
      trackingRate: 0,
    }
  }

  const avgCalories = Math.round(
    daysWithData.reduce((sum, d) => sum + d.calories, 0) / daysTracked
  )
  const avgProteins = Math.round(
    daysWithData.reduce((sum, d) => sum + d.proteins, 0) / daysTracked
  )
  const avgCarbs = Math.round(
    daysWithData.reduce((sum, d) => sum + d.carbs, 0) / daysTracked
  )
  const avgFats = Math.round(
    daysWithData.reduce((sum, d) => sum + d.fats, 0) / daysTracked
  )

  return {
    avgCalories,
    avgProteins,
    avgCarbs,
    avgFats,
    daysTracked,
    trackingRate,
  }
}

/**
 * Calculate gaps vs targets
 */
export function calculateGaps(
  nutrition: NutritionSummary,
  goals: ProgressData['nutritionGoals'],
  healthData?: ProgressData['healthData']
): GapAnalysis {
  const getStatus = (delta: number, threshold: number): 'ok' | 'warning' | 'over' => {
    if (Math.abs(delta) <= threshold) return 'ok'
    if (delta < 0) return 'warning'
    return 'over'
  }

  const caloriesDelta = nutrition.avgCalories - goals.calories
  const proteinsDelta = nutrition.avgProteins - goals.proteins

  return {
    calories: {
      value: nutrition.avgCalories,
      target: goals.calories,
      delta: caloriesDelta,
      status: getStatus(caloriesDelta, goals.calories * 0.1), // 10% tolerance
    },
    proteins: {
      value: nutrition.avgProteins,
      target: goals.proteins,
      delta: proteinsDelta,
      status: getStatus(proteinsDelta, goals.proteins * 0.15), // 15% tolerance
    },
    steps: healthData ? {
      value: healthData.avgSteps7d,
      target: healthData.stepsGoal,
      delta: healthData.avgSteps7d - healthData.stepsGoal,
      status: getStatus(
        healthData.avgSteps7d - healthData.stepsGoal,
        healthData.stepsGoal * 0.2 // 20% tolerance
      ),
    } : null,
  }
}

/**
 * Generate coach insight based on data
 * Returns null if nothing meaningful to say (silence is a feature)
 */
export function generateCoachInsight(data: ProgressData): CoachInsight | null {
  const weightTrend = calculateWeightTrend(data.weightHistory)
  const nutrition = calculateNutritionSummary(data.weeklyNutrition)
  const gaps = calculateGaps(nutrition, data.nutritionGoals, data.healthData)

  // Determine reliability
  const reliability: CoachInsight['reliability'] =
    nutrition.trackingRate >= 0.85 ? 'high' :
    nutrition.trackingRate >= 0.5 ? 'medium' : 'low'

  // Priority 1: Low tracking - can't analyze without data
  if (nutrition.trackingRate < 0.5) {
    return {
      message: `Tu as loggé ${nutrition.daysTracked}/7 jours cette semaine. Sans données fiables, l'analyse est limitée.`,
      type: 'warning',
      reliability: 'low',
      daysTracked: nutrition.daysTracked,
    }
  }

  // Priority 2: Plateau detected (≥14 days stable weight)
  if (weightTrend.isPlateauDetected && data.targetWeight) {
    const isDeficitDeclared = nutrition.avgCalories < data.nutritionGoals.calories

    if (isDeficitDeclared) {
      return {
        message: `Poids stable depuis 2+ semaines malgré un déficit déclaré. Hypothèses : sous-estimation des portions ou adaptation métabolique. Vérifie tes quantités cette semaine.`,
        type: 'question',
        reliability,
        daysTracked: nutrition.daysTracked,
      }
    }
  }

  // Priority 3: Weight moving in wrong direction
  if (weightTrend.trend7d !== null && data.targetWeight) {
    const wantToLose = data.startWeight && data.startWeight > data.targetWeight
    const isGaining = weightTrend.trend7d > 0.3
    const isLosingFast = weightTrend.trend7d < -1.0

    if (wantToLose && isGaining && nutrition.avgCalories <= data.nutritionGoals.calories) {
      return {
        message: `+${weightTrend.trend7d}kg cette semaine malgré ${nutrition.avgCalories} kcal/j déclarés. Possibles causes : rétention d'eau, sous-estimation, ou repas non loggés.`,
        type: 'question',
        reliability,
        daysTracked: nutrition.daysTracked,
      }
    }

    if (isLosingFast) {
      return {
        message: `Perte rapide détectée (${weightTrend.trend7d}kg/sem). Pour préserver ta masse musculaire, assure-toi d'atteindre ${data.nutritionGoals.proteins}g de protéines/jour.`,
        type: 'warning',
        reliability,
        daysTracked: nutrition.daysTracked,
      }
    }
  }

  // Priority 4: Protein deficit
  if (gaps.proteins.status === 'warning' && gaps.proteins.delta < -20) {
    return {
      message: `Protéines moyennes : ${nutrition.avgProteins}g/j (objectif : ${data.nutritionGoals.proteins}g). Ajoute une source de protéines à chaque repas.`,
      type: 'info',
      reliability,
      daysTracked: nutrition.daysTracked,
    }
  }

  // Priority 5: Things going well (only if high reliability)
  if (reliability === 'high' && weightTrend.weeklyRate !== null) {
    const wantToLose = data.startWeight && data.targetWeight && data.startWeight > data.targetWeight
    const isLosingHealthily = weightTrend.weeklyRate < 0 && weightTrend.weeklyRate >= -1.0

    if (wantToLose && isLosingHealthily) {
      return {
        message: `Ces ${nutrition.daysTracked} derniers jours, ton poids a évolué de ${weightTrend.weeklyRate > 0 ? '+' : ''}${weightTrend.weeklyRate}kg/sem. Les données suggèrent que ton approche fonctionne.`,
        type: 'success',
        reliability,
        daysTracked: nutrition.daysTracked,
      }
    }
  }

  // Default: No message (silence is a feature)
  return null
}

/**
 * Format gap for display
 */
export function formatGap(delta: number, unit: string = ''): string {
  const sign = delta >= 0 ? '+' : ''
  return `${sign}${delta}${unit}`
}

/**
 * Get smoothed weight data for chart (30 days)
 * Uses simple moving average to reduce noise
 */
export function getSmoothedWeightData(
  weightHistory: WeightEntry[],
  days: number = 30
): { date: string; weight: number; smoothedWeight: number }[] {
  if (!weightHistory || weightHistory.length === 0) return []

  const now = new Date()
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const sorted = [...weightHistory]
    .filter(w => new Date(w.date) >= startDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (sorted.length === 0) return []

  // Apply 3-point moving average for smoothing
  return sorted.map((entry, idx) => {
    const windowStart = Math.max(0, idx - 1)
    const windowEnd = Math.min(sorted.length - 1, idx + 1)
    const window = sorted.slice(windowStart, windowEnd + 1)
    const smoothedWeight = +(window.reduce((sum, w) => sum + w.weight, 0) / window.length).toFixed(1)

    return {
      date: entry.date,
      weight: entry.weight,
      smoothedWeight,
    }
  })
}

export default {
  calculateWeightTrend,
  calculateNutritionSummary,
  calculateGaps,
  generateCoachInsight,
  formatGap,
  getSmoothedWeightData,
}
