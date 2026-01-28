/**
 * Nutrition Calculator Service
 *
 * SINGLE SOURCE OF TRUTH for all nutritional calculations.
 * This file centralizes BMR, TDEE, macro calculations to avoid duplication.
 *
 * References:
 * - Mifflin-St Jeor (BMR): Most accurate for general population
 * - ISSN Position Stand (Proteins): Evidence-based recommendations
 * - ANSES (French guidelines): Macro distribution ranges
 * - WHO (Activity multipliers): Standard activity factors
 */

import type { UserProfile, NutritionalNeeds } from '../types'

// ============= CONSTANTS =============

export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,    // Little or no exercise
  light: 1.375,      // Light exercise 1-3 days/week
  moderate: 1.55,    // Moderate exercise 3-5 days/week
  active: 1.725,     // Active 6-7 days/week
  athlete: 1.9,      // Athlete/very active
  very_active: 1.9,  // Alias for athlete
}

// Micronutrient defaults (ANSES recommendations)
export const DEFAULT_MICRONUTRIENTS = {
  fiber: 30,
  water: 2.5,
  calcium: 1000,
  vitaminD: 600,
  vitaminC: 90,
  vitaminB12: 2.4,
  zinc: 11,
  magnesium: 400,
  potassium: 3500,
  omega3: 1.6,
}

// ============= BMR CALCULATION =============

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 * More accurate than Harris-Benedict for modern populations
 *
 * @param weight - Body weight in kg
 * @param height - Height in cm
 * @param age - Age in years
 * @param gender - 'male' | 'female' | 'other'
 * @returns BMR in kcal/day
 */
export function calculateBMR(
  weight: number,
  height: number,
  age: number,
  gender: 'male' | 'female' | 'other' | string
): number {
  // Mifflin-St Jeor: 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) + s
  // where s = +5 for males, -161 for females
  const base = 10 * weight + 6.25 * height - 5 * age

  if (gender === 'male') return base + 5
  if (gender === 'female') return base - 161
  return base - 78 // Average for 'other'
}

/**
 * Calculate Total Daily Energy Expenditure
 *
 * @param bmr - Basal Metabolic Rate
 * @param activityLevel - Activity level key
 * @returns TDEE in kcal/day
 */
export function calculateTDEE(bmr: number, activityLevel: string): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderate
  return bmr * multiplier
}

// ============= MACRO CALCULATIONS =============

interface MacroParams {
  weight: number
  goal: string
  activityLevel: string
  calories: number
  metabolismProfile?: string
  hasRestrictiveDietHistory?: boolean
}

/**
 * Calculate protein needs based on goal and activity level
 * Based on ISSN Position Stand on protein and exercise
 *
 * @returns Protein in grams per day
 */
export function calculateProteinNeeds(params: MacroParams): number {
  const { weight, goal, activityLevel, metabolismProfile, hasRestrictiveDietHistory } = params

  let proteinPerKg: number

  switch (goal) {
    case 'weight_loss':
      // ISSN: 1.6-2.4 g/kg for weight loss (preserve muscle)
      if (activityLevel === 'athlete' || activityLevel === 'active') {
        proteinPerKg = 2.2
      } else if (activityLevel === 'moderate') {
        proteinPerKg = 2.0
      } else {
        proteinPerKg = 1.8
      }
      break

    case 'muscle_gain':
      // ISSN: 1.6-2.2 g/kg for muscle building
      if (activityLevel === 'athlete' || activityLevel === 'active') {
        proteinPerKg = 2.2
      } else {
        proteinPerKg = 1.8
      }
      break

    default:
      // Maintenance: 1.0-1.6 g/kg
      if (activityLevel === 'athlete' || activityLevel === 'active') {
        proteinPerKg = 1.6
      } else if (activityLevel === 'moderate') {
        proteinPerKg = 1.4
      } else {
        proteinPerKg = 1.0
      }
  }

  let proteins = Math.round(weight * proteinPerKg)

  // Adaptive metabolism: increase protein by 10% for satiety
  if (metabolismProfile === 'adaptive' || hasRestrictiveDietHistory) {
    proteins = Math.round(proteins * 1.1)
  }

  return proteins
}

/**
 * Calculate fat needs based on goal
 * ANSES: 35-40% AET, minimum ~0.8g/kg for hormonal health
 *
 * @returns Fat in grams per day
 */
export function calculateFatNeeds(params: MacroParams): number {
  const { weight, goal } = params

  let fatPerKg: number

  switch (goal) {
    case 'weight_loss':
      fatPerKg = 0.9
      break
    case 'muscle_gain':
      fatPerKg = 0.8
      break
    default:
      fatPerKg = 1.0
  }

  return Math.round(weight * fatPerKg)
}

/**
 * Calculate carb needs (remaining calories after protein and fat)
 *
 * @returns Carbs in grams per day
 */
export function calculateCarbNeeds(params: MacroParams & { proteins: number; fats: number }): number {
  const { calories, proteins, fats, goal } = params

  // Protein: 4 kcal/g, Fat: 9 kcal/g, Carbs: 4 kcal/g
  const proteinCalories = proteins * 4
  const fatCalories = fats * 9
  const remainingCalories = calories - proteinCalories - fatCalories

  let carbs = Math.round(remainingCalories / 4)

  // Minimum carbs for brain function and performance
  const minCarbs = goal === 'weight_loss' ? 80 : 100
  const maxCarbs = goal === 'weight_loss' ? 180 : 400

  return Math.max(minCarbs, Math.min(maxCarbs, carbs))
}

// ============= CALORIE ADJUSTMENTS =============

interface CalorieAdjustmentParams {
  tdee: number
  goal: string
  metabolismProfile?: string
  hasRestrictiveDietHistory?: boolean
  sleepHours?: number
  stressLevel?: number // 1-5 scale
}

/**
 * Calculate adjusted calories based on goal and lifestyle factors
 *
 * @returns Adjusted calories and reasons for adjustments
 */
export function calculateAdjustedCalories(params: CalorieAdjustmentParams): {
  calories: number
  adjustmentReasons: string[]
} {
  const { tdee, goal, metabolismProfile, hasRestrictiveDietHistory, sleepHours, stressLevel } = params

  let calories: number
  const adjustmentReasons: string[] = []

  // Base adjustment by goal
  switch (goal) {
    case 'weight_loss':
      // Standard deficit: 400 kcal for ~0.5kg/week loss
      calories = tdee - 400
      break
    case 'muscle_gain':
      // Moderate surplus for clean bulk
      calories = tdee + 300
      break
    default:
      calories = tdee
  }

  // Adaptive metabolism: reduce deficit
  if ((metabolismProfile === 'adaptive' || hasRestrictiveDietHistory) && goal === 'weight_loss') {
    calories = tdee - 200 // Gentler deficit
    adjustmentReasons.push('Métabolisme adaptatif: déficit réduit')
  }

  // Sleep adjustment (poor sleep increases hunger hormones)
  if (sleepHours !== undefined && sleepHours < 6) {
    // Add 5% calories for sleep deprivation compensation
    const sleepAdjustment = Math.round(calories * 0.05)
    calories += sleepAdjustment
    adjustmentReasons.push(`Sommeil insuffisant: +${sleepAdjustment} kcal`)
  }

  // Stress adjustment (high stress affects metabolism)
  if (stressLevel !== undefined && stressLevel >= 4) {
    // Reduce deficit for high stress
    if (goal === 'weight_loss') {
      const stressAdjustment = 100
      calories += stressAdjustment
      adjustmentReasons.push(`Stress élevé: +${stressAdjustment} kcal`)
    }
  }

  // Round to nearest 50 for cleaner display
  calories = Math.round(calories / 50) * 50

  return { calories, adjustmentReasons }
}

// ============= MAIN CALCULATION FUNCTION =============

/**
 * Calculate complete nutritional needs for a user profile
 * This is the main entry point for nutritional calculations
 *
 * @param profile - User profile with physical stats and goals
 * @param lifestyleAdjustments - Optional real-time lifestyle data
 * @returns Complete nutritional needs or null if missing data
 */
export function calculateNutritionalNeeds(
  profile: Partial<UserProfile>,
  lifestyleAdjustments?: {
    sleepHours?: number
    stressLevel?: number
  }
): NutritionalNeeds | null {
  const { weight, height, age, gender, activityLevel, goal, metabolismProfile, metabolismFactors } = profile

  // Validate required fields
  if (!weight || !height || !age) return null

  // Step 1: Calculate BMR
  const bmr = calculateBMR(weight, height, age, gender || 'male')

  // Step 2: Calculate TDEE
  const tdee = calculateTDEE(bmr, activityLevel || 'moderate')

  // Step 3: Calculate adjusted calories
  const { calories, adjustmentReasons } = calculateAdjustedCalories({
    tdee,
    goal: goal || 'maintenance',
    metabolismProfile,
    hasRestrictiveDietHistory: metabolismFactors?.restrictiveDietsHistory,
    sleepHours: lifestyleAdjustments?.sleepHours,
    stressLevel: lifestyleAdjustments?.stressLevel,
  })

  // Step 4: Calculate macros
  const macroParams: MacroParams = {
    weight,
    goal: goal || 'maintenance',
    activityLevel: activityLevel || 'moderate',
    calories,
    metabolismProfile,
    hasRestrictiveDietHistory: metabolismFactors?.restrictiveDietsHistory,
  }

  const proteins = calculateProteinNeeds(macroParams)
  const fats = calculateFatNeeds(macroParams)
  const carbs = calculateCarbNeeds({ ...macroParams, proteins, fats })

  // Step 5: Build complete nutritional needs
  return {
    calories,
    proteins,
    carbs,
    fats,
    fiber: DEFAULT_MICRONUTRIENTS.fiber,
    water: DEFAULT_MICRONUTRIENTS.water,
    calcium: DEFAULT_MICRONUTRIENTS.calcium,
    iron: gender === 'female' ? 18 : 8, // Higher for women (ANSES)
    vitaminD: DEFAULT_MICRONUTRIENTS.vitaminD,
    vitaminC: DEFAULT_MICRONUTRIENTS.vitaminC,
    vitaminB12: DEFAULT_MICRONUTRIENTS.vitaminB12,
    zinc: DEFAULT_MICRONUTRIENTS.zinc,
    magnesium: DEFAULT_MICRONUTRIENTS.magnesium,
    potassium: DEFAULT_MICRONUTRIENTS.potassium,
    omega3: DEFAULT_MICRONUTRIENTS.omega3,
    // Store adjustment reasons for transparency
    _adjustmentReasons: adjustmentReasons.length > 0 ? adjustmentReasons : undefined,
  } as NutritionalNeeds
}

// ============= UTILITY FUNCTIONS =============

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

/**
 * Get macro percentages from grams
 */
export function getMacroPercentages(proteins: number, carbs: number, fats: number): {
  proteinPercent: number
  carbPercent: number
  fatPercent: number
} {
  const totalCalories = proteins * 4 + carbs * 4 + fats * 9
  if (totalCalories === 0) return { proteinPercent: 0, carbPercent: 0, fatPercent: 0 }

  return {
    proteinPercent: Math.round((proteins * 4 / totalCalories) * 100),
    carbPercent: Math.round((carbs * 4 / totalCalories) * 100),
    fatPercent: Math.round((fats * 9 / totalCalories) * 100),
  }
}

/**
 * Validate nutritional needs are within safe ranges
 */
export function validateNutritionalNeeds(needs: NutritionalNeeds): {
  isValid: boolean
  warnings: string[]
} {
  const warnings: string[] = []

  if (needs.calories < 1200) {
    warnings.push('Calories trop basses (<1200 kcal)')
  }
  if (needs.calories > 5000) {
    warnings.push('Calories très élevées (>5000 kcal)')
  }
  if (needs.proteins < 40) {
    warnings.push('Protéines insuffisantes (<40g)')
  }
  if (needs.fats < 30) {
    warnings.push('Lipides insuffisants (<30g)')
  }
  if (needs.carbs < 50) {
    warnings.push('Glucides très bas (<50g)')
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  }
}

export default {
  calculateBMR,
  calculateTDEE,
  calculateProteinNeeds,
  calculateFatNeeds,
  calculateCarbNeeds,
  calculateAdjustedCalories,
  calculateNutritionalNeeds,
  calculateAge,
  getMacroPercentages,
  validateNutritionalNeeds,
  ACTIVITY_MULTIPLIERS,
  DEFAULT_MICRONUTRIENTS,
}
