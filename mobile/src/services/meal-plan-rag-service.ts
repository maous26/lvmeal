/**
 * Meal Plan RAG Service
 *
 * Intelligent meal plan generation using RAG for optimal source selection:
 * - Gustar: Pre-enriched recipes with complete nutrition
 * - Open Food Facts: Commercial products with Nutriscore
 * - CIQUAL: Official French nutrition data
 * - AI (GPT): Custom generation for complex constraints
 */

import {
  getRAGMeal,
  buildRAGContext,
  decideMealSource,
  searchOFF,
  searchCIQUAL,
  type MealSource,
  type SourcedMeal,
  type RAGContext,
  type OFFProduct,
} from './rag-service'

// Re-export MealSource for consumers
export type { MealSource } from './rag-service'
import {
  loadStaticRecipes,
  getStaticRecipesByMealType,
  filterStaticRecipes,
  staticToRecipe,
  type StaticEnrichedRecipe,
} from './static-recipes'
import { generatePlanMeal, type AIRecipe } from './ai-service'
import { dspyClient } from './dspy/client'
import { profileToDSPyContext } from './dspy/integration'
import {
  getOptimizedMealPrompt,
  calculateMealMacroTargets,
  GOAL_MACRO_STRATEGIES,
  type MealGenerationContext,
} from './dspy/meal-prompts'
import type { DSPyPassage } from './dspy/types'
import { analytics } from './analytics-service'
import { errorReporting } from './error-reporting-service'
import type { UserProfile, MealType, NutritionInfo, Recipe } from '../types'
import type { PlannedMealItem } from '../stores/meal-plan-store'

// CIQUAL data type
interface CIQUALFood {
  id: string
  code: string
  name: string
  groupCode: string
  groupName: string
  subGroupCode: string
  subGroupName: string
  nutrition: NutritionInfo & {
    fiber?: number
    sugar?: number
    sodium?: number
    saturatedFat?: number
  }
  serving: number
  servingUnit: string
  source: string
}

// Cache for CIQUAL data
let ciqualCache: CIQUALFood[] | null = null

/**
 * Load CIQUAL data from bundled JSON
 */
async function loadCIQUALData(): Promise<CIQUALFood[]> {
  if (ciqualCache) return ciqualCache
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('../data/ciqual.json') as CIQUALFood[]
    ciqualCache = data
    console.log(`[CIQUAL] Loaded ${data.length} foods`)
    return data
  } catch (error) {
    console.warn('[CIQUAL] Failed to load:', error)
    return []
  }
}

/**
 * Search CIQUAL foods by name and meal type
 */
function searchCIQUALByMealType(
  foods: CIQUALFood[],
  mealType: MealType,
  targetCalories: number
): CIQUALFood[] {
  // Map meal types to relevant CIQUAL group names
  const mealTypeGroups: Record<MealType, string[]> = {
    breakfast: ['céréales', 'lait', 'yaourt', 'fruit', 'jus', 'pain', 'biscuit', 'confiture'],
    lunch: ['plat', 'viande', 'poisson', 'légume', 'riz', 'pâtes', 'salade'],
    snack: ['fruit', 'yaourt', 'biscuit', 'compote', 'barre'],
    dinner: ['soupe', 'légume', 'poisson', 'viande', 'plat', 'salade'],
  }

  const keywords = mealTypeGroups[mealType] || []

  return foods.filter(food => {
    const name = food.name.toLowerCase()
    const group = (food.groupName || '').toLowerCase()
    const subGroup = (food.subGroupName || '').toLowerCase()

    // Check if matches any keyword
    const matchesKeyword = keywords.some(kw =>
      name.includes(kw) || group.includes(kw) || subGroup.includes(kw)
    )

    // Check calories are reasonable
    const calories = food.nutrition.calories
    const caloriesOk = calories > 50 && calories <= targetCalories + 100

    return matchesKeyword && caloriesOk
  })
}

// ============= TYPES =============

export interface MealPlanConfig {
  userProfile: UserProfile
  dailyCalories: number
  preferences?: {
    preferHomemade?: boolean
    preferQuick?: boolean
    maxPrepTime?: number
    includeCheatMeal?: boolean
    cheatMealDay?: number // 0-6
    cheatMealType?: MealType
  }
}

export interface MealSlot {
  dayIndex: number
  mealType: MealType
  targetCalories: number
  isCheatMeal?: boolean
}

export interface GeneratedMealPlan {
  meals: PlannedMealItem[]
  sourceBreakdown: {
    gustar: number
    off: number
    ciqual: number
    ai: number
  }
  totalNutrition: NutritionInfo
  generatedAt: string
}

// ============= MEAL DISTRIBUTION =============

const MEAL_RATIOS: Record<MealType, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  snack: 0.10,
  dinner: 0.30,
}

const MEAL_TYPES_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

// ============= HELPERS =============

function generateMealId(): string {
  return `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Calculate target calories for each meal based on daily target
 */
function calculateMealTargets(dailyCalories: number): Record<MealType, number> {
  return {
    breakfast: Math.round(dailyCalories * MEAL_RATIOS.breakfast),
    lunch: Math.round(dailyCalories * MEAL_RATIOS.lunch),
    snack: Math.round(dailyCalories * MEAL_RATIOS.snack),
    dinner: Math.round(dailyCalories * MEAL_RATIOS.dinner),
  }
}

/**
 * Calculate smart target calories for a specific meal
 * Takes into account:
 * - Daily calorie target
 * - Already consumed calories
 * - Which meals have been logged today
 * - The requested meal type
 *
 * Returns the ideal calories for this meal based on context
 */
export function calculateSmartMealCalories(params: {
  dailyTarget: number
  consumedCalories: number
  mealType: MealType
  mealsLogged: MealType[] // Which meals have already been logged today
  calorieReduction?: boolean
}): { targetCalories: number; reasoning: string } {
  const { dailyTarget, consumedCalories, mealType, mealsLogged, calorieReduction = false } = params

  const adjustedDailyTarget = calorieReduction ? Math.round(dailyTarget * 0.9) : dailyTarget
  const remainingCalories = Math.max(0, adjustedDailyTarget - consumedCalories)
  const standardMealTargets = calculateMealTargets(adjustedDailyTarget)

  // Check which meals are still pending (not logged)
  const pendingMeals = MEAL_TYPES_ORDER.filter(mt => !mealsLogged.includes(mt))

  // If the requested meal is already logged, we're adding extra to it
  const isExtraMeal = mealsLogged.includes(mealType)

  let targetCalories: number
  let reasoning: string

  if (isExtraMeal) {
    // User wants to add more to an already logged meal
    // Give them a small portion based on what's left
    targetCalories = Math.min(remainingCalories, Math.round(standardMealTargets[mealType] * 0.5))
    reasoning = `Complement pour ${mealType} (deja enregistre)`
  } else if (pendingMeals.length === 1 && pendingMeals[0] === mealType) {
    // This is the LAST meal of the day - use ALL remaining calories
    targetCalories = remainingCalories
    reasoning = `Dernier repas de la journee: ${remainingCalories} kcal restantes`
  } else if (pendingMeals.length > 1) {
    // Multiple meals still pending - distribute remaining calories proportionally
    const totalPendingRatio = pendingMeals.reduce((sum, mt) => sum + MEAL_RATIOS[mt], 0)
    const thisRatio = MEAL_RATIOS[mealType]
    const proportionalTarget = Math.round(remainingCalories * (thisRatio / totalPendingRatio))

    // But don't go below 50% or above 150% of the standard meal target
    const minTarget = Math.round(standardMealTargets[mealType] * 0.5)
    const maxTarget = Math.round(standardMealTargets[mealType] * 1.5)
    targetCalories = Math.max(minTarget, Math.min(maxTarget, proportionalTarget))

    reasoning = `Reparti sur ${pendingMeals.length} repas restants`
  } else {
    // No pending meals info - use standard ratio
    targetCalories = standardMealTargets[mealType]
    reasoning = `Cible standard pour ${mealType}`
  }

  // Safety bounds: minimum 100 kcal, maximum remaining calories
  targetCalories = Math.max(100, Math.min(remainingCalories, targetCalories))

  console.log(`[SmartCalories] ${mealType}: target=${targetCalories}, remaining=${remainingCalories}, logged=${mealsLogged.join(',')}, pending=${pendingMeals.join(',')}`)

  return { targetCalories, reasoning }
}

/**
 * Meal component type distribution based on meal type and calorie target
 */
const MEAL_COMPOSITION: Record<MealType, Array<{ type: MealComponent['type']; ratio: number; optional?: boolean }>> = {
  breakfast: [
    { type: 'main', ratio: 0.6 },      // Main dish (eggs, cereals, etc.)
    { type: 'side', ratio: 0.25 },     // Side (fruit, yogurt)
    { type: 'drink', ratio: 0.15, optional: true }, // Drink
  ],
  lunch: [
    { type: 'starter', ratio: 0.15, optional: true }, // Starter/soup
    { type: 'main', ratio: 0.55 },     // Main course
    { type: 'side', ratio: 0.15 },     // Side (vegetables, rice)
    { type: 'bread', ratio: 0.10, optional: true }, // Bread
    { type: 'dessert', ratio: 0.15, optional: true }, // Dessert
  ],
  snack: [
    { type: 'snack', ratio: 1.0 },     // Single snack item
  ],
  dinner: [
    { type: 'starter', ratio: 0.15, optional: true }, // Light starter
    { type: 'main', ratio: 0.60 },     // Main course
    { type: 'side', ratio: 0.15 },     // Side
    { type: 'dessert', ratio: 0.10, optional: true }, // Light dessert
  ],
}

/**
 * Component type to search keywords mapping
 */
const COMPONENT_SEARCH_TERMS: Record<MealComponent['type'], Record<MealType, string[]>> = {
  starter: {
    breakfast: [],
    lunch: ['soupe', 'salade', 'crudites', 'entree'],
    snack: [],
    dinner: ['soupe', 'veloute', 'salade verte', 'crudites'],
  },
  main: {
    breakfast: ['oeuf', 'cereales', 'tartine', 'pancake', 'porridge', 'muesli'],
    lunch: ['poulet', 'poisson', 'viande', 'plat', 'pates', 'riz', 'quinoa'],
    snack: ['yaourt', 'fromage blanc'],
    dinner: ['poisson', 'viande blanche', 'omelette', 'legumes', 'tofu'],
  },
  side: {
    breakfast: ['fruit', 'yaourt', 'compote'],
    lunch: ['legumes', 'riz', 'pates', 'haricots verts', 'salade'],
    snack: [],
    dinner: ['legumes', 'salade', 'riz', 'puree'],
  },
  dessert: {
    breakfast: [],
    lunch: ['fruit', 'yaourt', 'compote', 'fromage blanc'],
    snack: ['fruit', 'compote'],
    dinner: ['fruit', 'yaourt', 'compote'],
  },
  drink: {
    breakfast: ['cafe', 'the', 'jus', 'lait'],
    lunch: [],
    snack: [],
    dinner: [],
  },
  bread: {
    breakfast: ['pain', 'tartine'],
    lunch: ['pain', 'baguette'],
    snack: [],
    dinner: ['pain'],
  },
  snack: {
    breakfast: [],
    lunch: [],
    snack: ['fruit', 'yaourt', 'amandes', 'noix', 'barre cereales', 'fromage'],
    dinner: [],
  },
}

/**
 * Compose a complete meal with multiple components to reach target calories
 */
async function composeMultiComponentMeal(params: {
  mealType: MealType
  targetCalories: number
  userProfile: UserProfile
  excludeRecipeIds?: string[]
}): Promise<ComposedMeal | null> {
  const { mealType, targetCalories, userProfile, excludeRecipeIds = [] } = params

  console.log(`[ComposeMeal] Composing ${mealType} with target ${targetCalories} kcal`)

  const composition = MEAL_COMPOSITION[mealType]
  const components: MealComponent[] = []
  let remainingCalories = targetCalories

  // Load recipes for potential main dishes
  const allRecipes = await loadStaticRecipes()
  const mealTypeRecipes = getStaticRecipesByMealType(mealType)
    .filter(r => !excludeRecipeIds.includes(r.id))

  // For each component in the composition
  for (const slot of composition) {
    if (remainingCalories < 50) break // Stop if we've reached the target

    const componentTargetCalories = Math.round(targetCalories * slot.ratio)

    // Skip optional components if we're running low on calories
    if (slot.optional && remainingCalories < componentTargetCalories * 1.5) {
      continue
    }

    // Try to find a suitable item for this component
    let component: MealComponent | null = null

    if (slot.type === 'main') {
      // Use Gustar recipes for main dishes
      const suitable = mealTypeRecipes
        .filter(r => r.nutrition.calories <= componentTargetCalories + 100)
        .filter(r => r.nutrition.calories >= componentTargetCalories * 0.5)
        .sort((a, b) => Math.abs(a.nutrition.calories - componentTargetCalories) - Math.abs(b.nutrition.calories - componentTargetCalories))

      if (suitable.length > 0) {
        const recipe = suitable[Math.floor(Math.random() * Math.min(3, suitable.length))]
        component = {
          id: recipe.id,
          name: recipe.titleFr,
          type: 'main',
          nutrition: recipe.nutrition,
          source: 'gustar',
          imageUrl: recipe.imageUrl,
          prepTime: recipe.prepTime,
          ingredients: recipe.ingredientsFr.map(ing => ({
            name: ing.name,
            amount: `${ing.amount} ${ing.unit}`,
            calories: 0,
          })),
          instructions: recipe.instructionsFr,
        }
      }
    } else {
      // Use CIQUAL/OFF for sides, starters, desserts
      const searchTerms = COMPONENT_SEARCH_TERMS[slot.type][mealType]
      if (searchTerms.length > 0) {
        const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]

        // Search in CIQUAL
        const ciqualResults = await searchCIQUAL(randomTerm)
        const suitableCiqual = ciqualResults.slice(0, 5) // Limit to 5 results
          .filter(f => f.nutrition.calories <= componentTargetCalories + 50)
          .filter(f => f.nutrition.calories >= componentTargetCalories * 0.3)

        if (suitableCiqual.length > 0) {
          const food = suitableCiqual[Math.floor(Math.random() * suitableCiqual.length)]
          // Calculate portion size to match target calories
          const portionMultiplier = componentTargetCalories / food.nutrition.calories
          const portionGrams = Math.round(100 * portionMultiplier)

          component = {
            id: `ciqual-${food.code}-${Date.now()}`,
            name: food.name,
            type: slot.type,
            nutrition: {
              calories: Math.round(food.nutrition.calories * portionMultiplier),
              proteins: Math.round(food.nutrition.proteins * portionMultiplier * 10) / 10,
              carbs: Math.round(food.nutrition.carbs * portionMultiplier * 10) / 10,
              fats: Math.round(food.nutrition.fats * portionMultiplier * 10) / 10,
            },
            source: 'ciqual',
          }
        }
      }
    }

    if (component) {
      components.push(component)
      remainingCalories -= component.nutrition.calories
      console.log(`[ComposeMeal] Added ${slot.type}: ${component.name} (${component.nutrition.calories} kcal), remaining: ${remainingCalories}`)
    }
  }

  if (components.length === 0) {
    return null
  }

  // Calculate total nutrition
  const totalNutrition = components.reduce(
    (acc, c) => ({
      calories: acc.calories + c.nutrition.calories,
      proteins: acc.proteins + c.nutrition.proteins,
      carbs: acc.carbs + c.nutrition.carbs,
      fats: acc.fats + c.nutrition.fats,
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )

  // Generate description
  const componentNames = components.map(c => c.name)
  const description = componentNames.length === 1
    ? componentNames[0]
    : `${componentNames.slice(0, -1).join(', ')} et ${componentNames[componentNames.length - 1]}`

  return {
    id: generateMealId(),
    mealType,
    components,
    totalNutrition,
    targetCalories,
    actualCalories: totalNutrition.calories,
    description,
  }
}

/**
 * Score a meal based on how well it matches macro targets for the user's goal
 * Returns a score from 0-100, higher is better
 *
 * @param mealNutrition - Nutrition info of the meal
 * @param targetMacros - Target macros for this meal
 * @param userGoal - User's goal (weight_loss, muscle_gain, etc.)
 * @param targetCalories - Target calories for this meal
 * @param mealName - Optional meal name for ingredient-based scoring
 */
function scoreMealByMacros(
  mealNutrition: NutritionInfo,
  targetMacros: { proteins: number; carbs: number; fats: number },
  userGoal: string,
  targetCalories: number,
  mealName?: string
): number {
  const strategy = GOAL_MACRO_STRATEGIES[userGoal] || GOAL_MACRO_STRATEGIES.maintain

  // Base calorie score (0-40 points)
  const calorieDiff = Math.abs(mealNutrition.calories - targetCalories)
  const calorieScore = Math.max(0, 40 - (calorieDiff / targetCalories) * 100)

  // Macro scores based on goal priority
  let proteinScore = 0
  let carbScore = 0
  let fatScore = 0

  // Protein score (0-30 points for weight_loss, 0-20 for others)
  const proteinDiff = Math.abs(mealNutrition.proteins - targetMacros.proteins)
  const proteinTolerance = targetMacros.proteins * 0.3 // 30% tolerance
  if (strategy.priority === 'proteins') {
    // Weight loss: heavily reward high protein
    if (mealNutrition.proteins >= targetMacros.proteins) {
      proteinScore = 30 // Full points for meeting or exceeding
    } else {
      proteinScore = Math.max(0, 30 - (proteinDiff / proteinTolerance) * 30)
    }
  } else {
    proteinScore = Math.max(0, 20 - (proteinDiff / proteinTolerance) * 20)
  }

  // Carb score (0-20 points)
  const carbDiff = Math.abs(mealNutrition.carbs - targetMacros.carbs)
  const carbTolerance = targetMacros.carbs * 0.3
  if (strategy.carbsStrategy === 'low') {
    // Weight loss: penalize high carbs
    if (mealNutrition.carbs <= targetMacros.carbs) {
      carbScore = 20 // Full points for being at or under target
    } else {
      carbScore = Math.max(0, 20 - ((mealNutrition.carbs - targetMacros.carbs) / carbTolerance) * 30)
    }
  } else if (strategy.carbsStrategy === 'high') {
    // Muscle gain: reward higher carbs
    carbScore = Math.max(0, 20 - (carbDiff / carbTolerance) * 20)
  } else {
    carbScore = Math.max(0, 20 - (carbDiff / carbTolerance) * 20)
  }

  // Fat score (0-10 points)
  const fatDiff = Math.abs(mealNutrition.fats - targetMacros.fats)
  const fatTolerance = targetMacros.fats * 0.4
  fatScore = Math.max(0, 10 - (fatDiff / fatTolerance) * 10)

  // Ingredient-based bonus/malus (0-10 points bonus, up to -20 malus)
  let ingredientScore = 0
  if (mealName) {
    const nameLower = mealName.toLowerCase()

    // Check preferred foods (bonus up to +10)
    const preferredMatches = strategy.preferredFoods.filter(food =>
      nameLower.includes(food.toLowerCase())
    )
    ingredientScore += Math.min(10, preferredMatches.length * 3)

    // Check avoid foods (malus up to -20)
    const avoidMatches = strategy.avoidFoods.filter(food =>
      nameLower.includes(food.toLowerCase())
    )
    ingredientScore -= avoidMatches.length * 10
  }

  const totalScore = calorieScore + proteinScore + carbScore + fatScore + ingredientScore

  return Math.max(0, Math.min(100, Math.round(totalScore)))
}

/**
 * Convert sourced meal to planned meal item
 */
function sourcedMealToPlannedItem(
  sourcedMeal: SourcedMeal,
  slot: MealSlot,
  name: string
): PlannedMealItem {
  const baseItem: PlannedMealItem = {
    id: generateMealId(),
    dayIndex: slot.dayIndex,
    mealType: slot.mealType,
    name,
    nutrition: sourcedMeal.nutrition,
    ingredients: [],
    instructions: [],
    prepTime: 0,
    servings: 1,
    isCheatMeal: slot.isCheatMeal,
    isValidated: false,
    source: sourcedMeal.source === 'off' || sourcedMeal.source === 'ciqual' ? 'manual' : sourcedMeal.source,
  }

  // Enrich based on source
  if (sourcedMeal.recipe) {
    return {
      ...baseItem,
      name: sourcedMeal.recipe.title,
      description: sourcedMeal.recipe.description,
      prepTime: sourcedMeal.recipe.prepTime || sourcedMeal.recipe.totalTime || 30,
      servings: sourcedMeal.recipe.servings || 1,
      ingredients: sourcedMeal.recipe.ingredients.map(ing => ({
        name: ing.name,
        amount: `${ing.amount} ${ing.unit}`,
        calories: 0,
      })),
      instructions: sourcedMeal.recipe.instructions,
      imageUrl: sourcedMeal.recipe.imageUrl,
      source: 'gustar',
      sourceRecipeId: sourcedMeal.recipe.id,
    }
  }

  if (sourcedMeal.aiRecipe) {
    return {
      ...baseItem,
      name: sourcedMeal.aiRecipe.title,
      description: sourcedMeal.aiRecipe.description,
      prepTime: sourcedMeal.aiRecipe.prepTime,
      servings: sourcedMeal.aiRecipe.servings,
      ingredients: sourcedMeal.aiRecipe.ingredients.map(ing => ({
        name: ing.name,
        amount: ing.amount,
        calories: ing.calories || 0,
      })),
      instructions: sourcedMeal.aiRecipe.instructions,
      imageUrl: sourcedMeal.aiRecipe.imageUrl || undefined,
      source: 'ai',
    }
  }

  if (sourcedMeal.offProduct) {
    return {
      ...baseItem,
      name: sourcedMeal.offProduct.name,
      description: sourcedMeal.offProduct.brand ? `${sourcedMeal.offProduct.brand}` : undefined,
      prepTime: 0,
      servings: 1,
      ingredients: [{ name: sourcedMeal.offProduct.name, amount: `${sourcedMeal.offProduct.portion}g`, calories: sourcedMeal.nutrition.calories }],
      instructions: ['Pret a consommer'],
      imageUrl: sourcedMeal.offProduct.imageUrl,
      source: 'manual', // OFF products stored as manual
    }
  }

  return baseItem
}

// ============= MAIN GENERATION FUNCTIONS =============

/**
 * Generate a complete 7-day meal plan using RAG
 */
export async function generateMealPlanWithRAG(
  config: MealPlanConfig
): Promise<GeneratedMealPlan> {
  const { userProfile, dailyCalories, preferences } = config

  // Ensure static recipes are loaded
  await loadStaticRecipes()

  const mealTargets = calculateMealTargets(dailyCalories)
  const meals: PlannedMealItem[] = []
  const existingMealNames: string[] = []

  // Track source usage
  const sourceBreakdown = {
    gustar: 0,
    off: 0,
    ciqual: 0,
    ai: 0,
  }

  // Generate meals for each day (0 = Monday ... 6 = Sunday)
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    console.log(`Generating meals for day ${dayIndex + 1}/7...`)

    for (const mealType of MEAL_TYPES_ORDER) {
      const isCheatMeal =
        preferences?.includeCheatMeal &&
        preferences?.cheatMealDay === dayIndex &&
        preferences?.cheatMealType === mealType

      const slot: MealSlot = {
        dayIndex,
        mealType,
        targetCalories: isCheatMeal
          ? Math.round(mealTargets[mealType] * 1.5) // 50% more for cheat meal
          : mealTargets[mealType],
        isCheatMeal,
      }

      // Build RAG context
      const consumed: NutritionInfo = {
        calories: 0,
        proteins: 0,
        carbs: 0,
        fats: 0,
      }

      // Add already generated meals for this day to consumed
      meals
        .filter(m => m.dayIndex === dayIndex)
        .forEach(m => {
          consumed.calories += m.nutrition.calories
          consumed.proteins += m.nutrition.proteins
          consumed.carbs += m.nutrition.carbs
          consumed.fats += m.nutrition.fats
        })

      const ragContext = buildRAGContext({
        userProfile,
        mealType,
        day: dayIndex,
        dailyTarget: dailyCalories,
        consumed,
        existingMeals: existingMealNames,
      })

      // Adjust for preferences
      if (preferences?.preferQuick && ragContext.preferences) {
        ragContext.preferences.preferHomemade = false
      }

      // Get meal using RAG
      try {
        const sourcedMeal = await getRAGMeal(ragContext)

        if (sourcedMeal) {
          const mealName = sourcedMeal.recipe?.title ||
            sourcedMeal.aiRecipe?.title ||
            sourcedMeal.offProduct?.name ||
            `${mealType} jour ${dayIndex + 1}`

          const plannedMeal = sourcedMealToPlannedItem(
            sourcedMeal,
            slot,
            mealName
          )

          meals.push(plannedMeal)
          existingMealNames.push(mealName)

          // Track source
          if (sourcedMeal.source === 'gustar') sourceBreakdown.gustar++
          else if (sourcedMeal.source === 'off') sourceBreakdown.off++
          else if (sourcedMeal.source === 'ciqual') sourceBreakdown.ciqual++
          else if (sourcedMeal.source === 'ai') sourceBreakdown.ai++

          console.log(`  [${sourcedMeal.source}] ${mealType}: ${mealName} (${sourcedMeal.nutrition.calories} kcal)`)
        } else {
          console.warn(`  Failed to generate ${mealType} for day ${dayIndex + 1}`)
        }
      } catch (error) {
        console.error(`  Error generating ${mealType}:`, error)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Calculate total nutrition
  const totalNutrition = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.nutrition.calories,
      proteins: acc.proteins + meal.nutrition.proteins,
      carbs: acc.carbs + meal.nutrition.carbs,
      fats: acc.fats + meal.nutrition.fats,
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )

  return {
    meals,
    sourceBreakdown,
    totalNutrition,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Regenerate a single meal with RAG
 */
export async function regenerateMealWithRAG(
  slot: MealSlot,
  config: MealPlanConfig,
  existingMeals: PlannedMealItem[]
): Promise<PlannedMealItem | null> {
  const { userProfile, dailyCalories } = config

  // Calculate consumed for the day (excluding the meal being regenerated)
  const consumed = existingMeals
    .filter(m => m.dayIndex === slot.dayIndex)
    .reduce(
      (acc, m) => ({
        calories: acc.calories + m.nutrition.calories,
        proteins: acc.proteins + m.nutrition.proteins,
        carbs: acc.carbs + m.nutrition.carbs,
        fats: acc.fats + m.nutrition.fats,
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    )

  const existingMealNames = existingMeals.map(m => m.name)

  const ragContext = buildRAGContext({
    userProfile,
    mealType: slot.mealType,
    day: slot.dayIndex,
    dailyTarget: dailyCalories,
    consumed,
    existingMeals: existingMealNames,
  })

  const sourcedMeal = await getRAGMeal(ragContext)

  if (!sourcedMeal) return null

  const mealName = sourcedMeal.recipe?.title ||
    sourcedMeal.aiRecipe?.title ||
    sourcedMeal.offProduct?.name ||
    `${slot.mealType} regenere`

  return sourcedMealToPlannedItem(sourcedMeal, slot, mealName)
}

/**
 * Get source recommendation for a meal slot
 */
export function getMealSourceRecommendation(
  mealType: MealType,
  userProfile: UserProfile
): { source: MealSource; reason: string } {
  const context: RAGContext = {
    userProfile,
    mealType,
    targetCalories: 500, // Default
    consumed: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
    day: 0,
    existingMeals: [],
  }

  const decision = decideMealSource(context)

  return {
    source: decision.source,
    reason: decision.reason,
  }
}

/**
 * Get meals directly from a specific source
 */
export async function getMealsFromSource(
  source: MealSource,
  mealType: MealType,
  targetCalories: number,
  limit: number = 5
): Promise<Array<{ name: string; nutrition: NutritionInfo; source: MealSource }>> {
  const results: Array<{ name: string; nutrition: NutritionInfo; source: MealSource }> = []

  switch (source) {
    case 'gustar':
      await loadStaticRecipes()
      const recipes = filterStaticRecipes({
        mealType,
        maxCalories: targetCalories + 100,
        limit,
      })
      recipes.forEach(r => {
        results.push({
          name: r.titleFr,
          nutrition: r.nutrition,
          source: 'gustar',
        })
      })
      break

    case 'off':
      const searchTerms: Record<MealType, string> = {
        breakfast: 'cereales petit dejeuner',
        lunch: 'plat prepare',
        snack: 'barre cereales',
        dinner: 'soupe legumes',
      }
      const products = await searchOFF(searchTerms[mealType], limit * 2)
      products
        .filter(p => p.nutrition.calories <= targetCalories + 50)
        .slice(0, limit)
        .forEach(p => {
          results.push({
            name: p.name,
            nutrition: p.nutrition,
            source: 'off',
          })
        })
      break

    // CIQUAL and AI would need specific implementations
    default:
      break
  }

  return results
}

// ============= SINGLE MEAL GENERATION (for Repas IA) =============

/**
 * A single meal component (part of a composed meal)
 */
export interface MealComponent {
  id: string
  name: string
  type: 'starter' | 'main' | 'side' | 'dessert' | 'drink' | 'bread' | 'snack'
  nutrition: NutritionInfo
  source: MealSource
  imageUrl?: string
  prepTime?: number
  ingredients?: { name: string; amount: string; calories: number }[]
  instructions?: string[]
}

/**
 * A composed meal with multiple components
 */
export interface ComposedMeal {
  id: string
  mealType: MealType
  components: MealComponent[]
  totalNutrition: NutritionInfo
  targetCalories: number
  actualCalories: number
  description: string
}

export interface SingleMealResult {
  success: boolean
  recipe: {
    id: string
    title: string
    description: string
    ingredients: { name: string; amount: string; calories: number }[]
    instructions: string[]
    nutrition: NutritionInfo
    prepTime: number
    servings: number
    imageUrl?: string
  } | null
  // NEW: Composed meal with multiple components
  composedMeal?: ComposedMeal
  source: MealSource
  sourceLabel: string
  confidence: number
  error?: string
}

/**
 * Labels for sources in French
 */
export const SOURCE_LABELS: Record<MealSource, string> = {
  gustar: 'Recettes Gustar',
  off: 'Open Food Facts',
  ciqual: 'CIQUAL (ANSES)',
  ai: 'LymIA (IA)',
}

/**
 * Generate a single meal using RAG for the "Repas IA" feature
 * This replaces the direct OpenAI call with intelligent source selection
 * Now uses DSPy-optimized prompts based on user's source preference
 *
 * @param remainingCalories - Optional: If provided, the meal will target these calories instead of using ratios
 * @param excludeRecipeIds - Optional: Recipe IDs to exclude (e.g., for "Autre suggestion" button)
 * @param mealsLogged - Optional: Which meal types have been logged today (for smart calorie distribution)
 * @param composeFullMeal - Optional: If true, compose a multi-component meal instead of a single dish
 */
export async function generateSingleMealWithRAG(params: {
  mealType: MealType
  userProfile: UserProfile
  consumed: NutritionInfo
  calorieReduction?: boolean
  remainingCalories?: number // Target remaining calories for the day
  excludeRecipeIds?: string[] // Exclude these recipe IDs from suggestions
  mealsLogged?: MealType[] // Which meals have been logged today
  composeFullMeal?: boolean // If true, compose multi-component meal
}): Promise<SingleMealResult> {
  console.log('*'.repeat(60))
  console.log('[RAG] ===== generateSingleMealWithRAG START =====')
  console.log('[RAG] Params:', JSON.stringify({
    mealType: params.mealType,
    calorieReduction: params.calorieReduction,
    remainingCalories: params.remainingCalories,
    excludeRecipeIds: params.excludeRecipeIds,
    mealsLogged: params.mealsLogged,
    composeFullMeal: params.composeFullMeal,
  }))
  console.log('[RAG] userProfile.nutritionalNeeds:', JSON.stringify(params.userProfile.nutritionalNeeds))
  console.log('[RAG] consumed:', JSON.stringify(params.consumed))
  console.log('*'.repeat(60))

  const startTime = Date.now()

  const {
    mealType,
    userProfile,
    consumed,
    calorieReduction = false,
    remainingCalories,
    excludeRecipeIds = [],
    mealsLogged = [],
    composeFullMeal = false,
  } = params

  // Ensure static recipes are loaded
  console.log('[RAG] Loading static recipes...')
  const recipes = await loadStaticRecipes()
  console.log('[RAG] Static recipes loaded:', recipes.length)

  // Calculate target calories for this meal using smart distribution
  const dailyTarget = userProfile.nutritionalNeeds?.calories || 2000

  // Use smart calorie calculation if mealsLogged is provided
  let targetCalories: number
  let calorieReasoning: string

  if (mealsLogged.length > 0 || remainingCalories !== undefined) {
    // Smart calculation based on what's been logged
    const smartCalc = calculateSmartMealCalories({
      dailyTarget,
      consumedCalories: consumed.calories,
      mealType,
      mealsLogged,
      calorieReduction,
    })
    targetCalories = smartCalc.targetCalories
    calorieReasoning = smartCalc.reasoning

    // If remainingCalories was explicitly provided and is lower, use it
    if (remainingCalories !== undefined && remainingCalories > 0) {
      const adjustedRemaining = calorieReduction ? Math.round(remainingCalories * 0.9) : remainingCalories
      if (adjustedRemaining < targetCalories) {
        targetCalories = adjustedRemaining
        calorieReasoning = `Calories restantes explicites: ${remainingCalories} kcal`
      }
    }

    console.log('[RAG] Using SMART calories mode:', targetCalories, '|', calorieReasoning)
  } else {
    // Fall back to ratio-based calculation
    const adjustedTarget = calorieReduction ? Math.round(dailyTarget * 0.9) : dailyTarget
    const mealTargets = calculateMealTargets(adjustedTarget)
    targetCalories = mealTargets[mealType]
    calorieReasoning = `Cible standard (${Math.round(MEAL_RATIOS[mealType] * 100)}% du total)`
    console.log('[RAG] Using RATIO-based mode, meal target:', targetCalories)
  }

  console.log('[RAG] Daily target:', dailyTarget, '| Final meal target:', targetCalories, '|', calorieReasoning)

  // If composeFullMeal is requested, create a multi-component meal
  if (composeFullMeal) {
    console.log('[RAG] Composing FULL MEAL with multiple components...')

    try {
      const composedMeal = await composeMultiComponentMeal({
        mealType,
        targetCalories,
        userProfile,
        excludeRecipeIds,
      })

      if (composedMeal && composedMeal.components.length > 0) {
        const durationMs = Date.now() - startTime

        // Track success
        analytics.trackAIFeature('ai_meal', true, durationMs, {
          meal_type: mealType,
          food_source: 'gustar', // Use gustar as primary source for composed meals
          confidence_score: 85,
          calories: composedMeal.totalNutrition.calories,
          components_count: composedMeal.components.length,
        })

        // Also create a legacy recipe format for backward compatibility
        const mainComponent = composedMeal.components.find(c => c.type === 'main') || composedMeal.components[0]

        return {
          success: true,
          recipe: {
            id: composedMeal.id,
            title: composedMeal.description,
            description: `Repas compose de ${composedMeal.components.length} elements pour atteindre ${targetCalories} kcal`,
            ingredients: composedMeal.components.flatMap(c => c.ingredients || [{ name: c.name, amount: '1 portion', calories: c.nutrition.calories }]),
            instructions: mainComponent.instructions || ['Preparer chaque element du repas'],
            nutrition: composedMeal.totalNutrition,
            prepTime: composedMeal.components.reduce((sum, c) => sum + (c.prepTime || 10), 0),
            servings: 1,
            imageUrl: mainComponent.imageUrl,
          },
          composedMeal, // NEW: Include the composed meal structure
          source: 'gustar', // Primary source for composed meals
          sourceLabel: 'Repas compose LymIA',
          confidence: 0.85,
        }
      }
    } catch (error) {
      console.error('[RAG] Error composing meal:', error)
      // Fall through to single meal generation
    }
  }

  // Get DSPy-optimized prompts based on user's source preference
  const sourcePreference = userProfile.mealSourcePreference || 'balanced'
  const promptContext: MealGenerationContext = {
    mealType,
    targetCalories,
    userGoal: userProfile.goal || 'maintain',
    dietType: userProfile.dietType,
    allergies: userProfile.allergies,
    existingMeals: [],
    sourcePreference,
  }

  console.log('[RAG] Getting optimized meal prompts...')
  const optimizedPrompts = await getOptimizedMealPrompt(promptContext)
  console.log(`[RAG] DSPy prompts optimized for "${sourcePreference}" (confidence: ${optimizedPrompts.confidence})`)

  // Build RAG context with explicit target calories override
  // This ensures we use the smart calculated target calories
  const adjustedDailyTarget = calorieReduction ? Math.round(dailyTarget * 0.9) : dailyTarget
  const ragContext = buildRAGContext({
    userProfile,
    mealType,
    day: 0,
    dailyTarget: adjustedDailyTarget,
    consumed,
    existingMeals: [],
    overrideTargetCalories: targetCalories, // Use smart calculated target
    excludeRecipeIds, // Pass excluded recipe IDs for "Autre suggestion" feature
  })

  console.log(`[RAG] Generating ${mealType} with target ${targetCalories} kcal (reduction: ${calorieReduction})`)

  try {
    const sourcedMeal = await getRAGMeal(ragContext)

    if (!sourcedMeal) {
      return {
        success: false,
        recipe: null,
        source: 'ai',
        sourceLabel: SOURCE_LABELS.ai,
        confidence: 0,
        error: 'Impossible de trouver un repas correspondant',
      }
    }

    // Convert to recipe format compatible with AddMealScreen
    const recipe = {
      id: generateMealId(),
      title: sourcedMeal.recipe?.title ||
             sourcedMeal.aiRecipe?.title ||
             sourcedMeal.offProduct?.name ||
             'Repas suggere',
      description: sourcedMeal.recipe?.description ||
                   sourcedMeal.aiRecipe?.description ||
                   (sourcedMeal.offProduct?.brand ? `Par ${sourcedMeal.offProduct.brand}` : ''),
      ingredients: getIngredients(sourcedMeal),
      instructions: getInstructions(sourcedMeal),
      nutrition: sourcedMeal.nutrition,
      prepTime: getPrepTime(sourcedMeal),
      servings: getServings(sourcedMeal),
      imageUrl: getImageUrl(sourcedMeal),
    }

    console.log(`[RAG] Success: ${recipe.title} from ${sourcedMeal.source} (${Math.round(sourcedMeal.confidence * 100)}%)`)

    // Track AI meal generation success
    const durationMs = Date.now() - startTime
    analytics.trackAIFeature('ai_meal', true, durationMs, {
      meal_type: mealType,
      food_source: sourcedMeal.source,
      confidence_score: Math.round(sourcedMeal.confidence * 100),
      calories: sourcedMeal.nutrition.calories,
    })

    return {
      success: true,
      recipe,
      source: sourcedMeal.source,
      sourceLabel: SOURCE_LABELS[sourcedMeal.source],
      confidence: sourcedMeal.confidence,
    }
  } catch (error) {
    console.error('[RAG] Error generating meal:', error)
    const durationMs = Date.now() - startTime
    errorReporting.captureFeatureError('ai_meal_generation', error)
    analytics.trackAIFeature('ai_meal', false, durationMs, {
      meal_type: mealType,
      error_type: 'exception',
    })
    return {
      success: false,
      recipe: null,
      source: 'ai',
      sourceLabel: SOURCE_LABELS.ai,
      confidence: 0,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

// ============= DSPY INTEGRATION =============

/**
 * Build meal context passages for DSPy
 * Converts available meals to DSPy passages for intelligent selection
 */
function buildMealPassages(
  gustarRecipes: StaticEnrichedRecipe[],
  ciqualFoods: CIQUALFood[],
  mealType: MealType,
  targetCalories: number
): DSPyPassage[] {
  const passages: DSPyPassage[] = []

  // Add Gustar recipes as passages
  const recipesForType = getStaticRecipesByMealType(mealType)
  recipesForType.slice(0, 10).forEach((recipe, idx) => {
    passages.push({
      id: `gustar-${recipe.id}`,
      content: `Recette: ${recipe.titleFr}. ${recipe.descriptionFr}. Calories: ${recipe.nutrition.calories}kcal, Protéines: ${recipe.nutrition.proteins}g, Glucides: ${recipe.nutrition.carbs}g, Lipides: ${recipe.nutrition.fats}g. Temps: ${recipe.prepTime}min. Ingrédients: ${recipe.ingredientsFr.map(i => i.name).join(', ')}.`,
      source: 'gustar',
      similarity: 1 - Math.abs(recipe.nutrition.calories - targetCalories) / targetCalories,
    })
  })

  // Add CIQUAL foods as passages
  const ciqualForType = searchCIQUALByMealType(ciqualFoods, mealType, targetCalories)
  ciqualForType.slice(0, 10).forEach((food, idx) => {
    passages.push({
      id: `ciqual-${food.id}`,
      content: `Aliment CIQUAL: ${food.name}. Catégorie: ${food.groupName}. Calories: ${food.nutrition.calories}kcal/100g, Protéines: ${food.nutrition.proteins}g, Glucides: ${food.nutrition.carbs}g, Lipides: ${food.nutrition.fats}g. Source officielle ANSES.`,
      source: 'ciqual',
      similarity: 1 - Math.abs(food.nutrition.calories - targetCalories) / targetCalories,
    })
  })

  return passages
}

/**
 * Use DSPy to intelligently select the best meal
 * Returns the selected meal ID and reasoning
 */
async function selectMealWithDSPy(
  passages: DSPyPassage[],
  userProfile: UserProfile,
  mealType: MealType,
  targetCalories: number,
  existingMeals: string[]
): Promise<{ selectedId: string | null; reasoning: string; confidence: number }> {
  try {
    // Check if DSPy is available
    const isEnabled = await dspyClient.isEnabled()
    if (!isEnabled) {
      console.log('[DSPy] Not available, using fallback selection')
      return { selectedId: null, reasoning: 'DSPy non disponible', confidence: 0 }
    }

    // Build the question for DSPy
    const question = `Quel est le meilleur ${getMealTypeFrench(mealType)} pour un utilisateur avec objectif "${userProfile.goal}", régime "${userProfile.dietType || 'omnivore'}", cible ${targetCalories} calories? Éviter: ${existingMeals.slice(-5).join(', ') || 'aucun'}.`

    // Build user context for DSPy
    const dspyContext = profileToDSPyContext(userProfile, {
      targetCalories,
      caloriesToday: 0,
      recentPatterns: existingMeals.slice(-5),
    })

    // Run DSPy pipeline
    const result = await dspyClient.runPipeline(question, passages, dspyContext, true)

    if (result && result.selected_passage_ids.length > 0) {
      console.log(`[DSPy] Selected: ${result.selected_passage_ids[0]} (confidence: ${result.confidence})`)
      return {
        selectedId: result.selected_passage_ids[0],
        reasoning: result.selection_rationale,
        confidence: result.confidence,
      }
    }

    return { selectedId: null, reasoning: 'Aucune sélection DSPy', confidence: 0 }
  } catch (error) {
    console.error('[DSPy] Selection error:', error)
    return { selectedId: null, reasoning: 'Erreur DSPy', confidence: 0 }
  }
}

/**
 * Get French label for meal type
 */
function getMealTypeFrench(mealType: MealType): string {
  const labels: Record<MealType, string> = {
    breakfast: 'petit-déjeuner',
    lunch: 'déjeuner',
    snack: 'collation',
    dinner: 'dîner',
  }
  return labels[mealType]
}

/**
 * Convert DSPy selection to PlannedMealItem
 */
function dspySelectionToMeal(
  selectedId: string,
  gustarRecipes: StaticEnrichedRecipe[],
  ciqualFoods: CIQUALFood[],
  mealType: MealType,
  targetCalories: number,
  userProfile: UserProfile
): PlannedMealItem | null {
  // Parse the selected ID
  const [source, ...idParts] = selectedId.split('-')
  const id = idParts.join('-')

  if (source === 'gustar') {
    const recipe = gustarRecipes.find(r => r.id === id)
    if (recipe) {
      const converted = staticToRecipe(recipe)
      return {
        id: generateMealId(),
        dayIndex: 0,
        mealType,
        name: converted.title,
        description: converted.description,
        nutrition: recipe.nutrition,
        ingredients: converted.ingredients.map(ing => ({
          name: ing.name,
          amount: `${ing.amount} ${ing.unit}`,
          calories: 0,
        })),
        instructions: converted.instructions,
        prepTime: converted.prepTime || 30,
        servings: converted.servings || 1,
        imageUrl: converted.imageUrl,
        isCheatMeal: false,
        isValidated: false,
        source: 'gustar',
        sourceRecipeId: recipe.id,
      }
    }
  }

  if (source === 'ciqual') {
    const food = ciqualFoods.find(f => f.id === id)
    if (food) {
      const portionMultiplier = targetCalories / food.nutrition.calories
      const portionGrams = Math.round(food.serving * portionMultiplier)

      return {
        id: generateMealId(),
        dayIndex: 0,
        mealType,
        name: food.name,
        description: `${portionGrams}g - Source CIQUAL (ANSES)`,
        nutrition: {
          calories: Math.round(food.nutrition.calories * portionMultiplier),
          proteins: Math.round(food.nutrition.proteins * portionMultiplier),
          carbs: Math.round(food.nutrition.carbs * portionMultiplier),
          fats: Math.round(food.nutrition.fats * portionMultiplier),
        },
        ingredients: [{ name: food.name, amount: `${portionGrams}g`, calories: Math.round(food.nutrition.calories * portionMultiplier) }],
        instructions: ['Préparer selon tes préférences'],
        prepTime: 10,
        servings: 1,
        isCheatMeal: false,
        isValidated: false,
        source: 'manual',
      }
    }
  }

  return null
}

/**
 * Intelligent meal plan agent that combines multiple sources
 * Uses DSPy for intelligent selection when available
 * Now uses DSPy-optimized prompts based on user's source preference
 * Based on user profile, preferences, and nutritional needs
 */
export async function generateFlexibleMealPlanWithRAG(params: {
  userProfile: UserProfile
  dailyCalories: number
  days: 1 | 3 | 7
  calorieReduction?: boolean
  preferences?: MealPlanConfig['preferences']
  useDSPy?: boolean // Enable DSPy for intelligent selection
}): Promise<GeneratedMealPlan & { days: number; dspyUsed?: boolean; promptOptimization?: { preference: string; confidence: number } }> {
  const { userProfile, dailyCalories, days, calorieReduction = false, preferences, useDSPy = true } = params

  const startTime = Date.now()
  console.log(`[Agent] ===== MEAL PLAN GENERATION =====`)
  console.log(`[Agent] Days: ${days}, Calories: ${dailyCalories}, Reduction: ${calorieReduction}, DSPy: ${useDSPy}`)
  console.log(`[Agent] User goal: ${userProfile.goal}, Diet: ${userProfile.dietType || 'standard'}`)

  const adjustedCalories = calorieReduction ? Math.round(dailyCalories * 0.9) : dailyCalories
  const sourcePreference = userProfile.mealSourcePreference || 'balanced'

  // Get DSPy-optimized prompts for the generation (using lunch as reference for overall strategy)
  const promptContext: MealGenerationContext = {
    mealType: 'lunch',
    targetCalories: Math.round(adjustedCalories * 0.35), // Lunch ratio
    userGoal: userProfile.goal || 'maintain',
    dietType: userProfile.dietType,
    allergies: userProfile.allergies,
    existingMeals: [],
    sourcePreference,
  }
  const optimizedPrompts = await getOptimizedMealPrompt(promptContext)
  console.log(`[Agent] DSPy prompts optimized for "${sourcePreference}" (confidence: ${optimizedPrompts.confidence})`)

  // Load all data sources in parallel + check DSPy availability
  const [gustarRecipes, ciqualFoods, dspyEnabled] = await Promise.all([
    loadStaticRecipes(),
    loadCIQUALData(),
    useDSPy ? dspyClient.isEnabled() : Promise.resolve(false),
  ])

  console.log(`[Agent] Sources loaded - Gustar: ${gustarRecipes.length}, CIQUAL: ${ciqualFoods.length}, DSPy: ${dspyEnabled}`)

  const mealTargets = calculateMealTargets(adjustedCalories)
  const meals: PlannedMealItem[] = []
  const usedIds = new Set<string>()
  const existingMealNames: string[] = []

  const sourceBreakdown = { gustar: 0, off: 0, ciqual: 0, ai: 0 }
  let dspyUsedCount = 0

  // Determine source distribution based on user profile (uses mealSourcePreference)
  const sourceStrategy = determineSourceStrategy(userProfile)
  console.log(`[Agent] Strategy for "${sourcePreference}": ${JSON.stringify(sourceStrategy)}`)

  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    console.log(`[Agent] Generating day ${dayIndex + 1}/${days}`)

    for (const mealType of MEAL_TYPES_ORDER) {
      const targetCalories = mealTargets[mealType]
      let plannedMeal: PlannedMealItem | null = null

      // Try DSPy intelligent selection first if available
      if (dspyEnabled) {
        console.log(`  [DSPy] Attempting intelligent selection for ${mealType}...`)

        // Build passages from available meals
        const passages = buildMealPassages(gustarRecipes, ciqualFoods, mealType, targetCalories)

        // Use DSPy to select the best meal
        const dspyResult = await selectMealWithDSPy(
          passages,
          userProfile,
          mealType,
          targetCalories,
          existingMealNames
        )

        if (dspyResult.selectedId && dspyResult.confidence > 0.5) {
          // Convert DSPy selection to PlannedMealItem
          plannedMeal = dspySelectionToMeal(
            dspyResult.selectedId,
            gustarRecipes,
            ciqualFoods,
            mealType,
            targetCalories,
            userProfile
          )

          if (plannedMeal) {
            dspyUsedCount++
            // Track source
            if (dspyResult.selectedId.startsWith('gustar')) {
              sourceBreakdown.gustar++
            } else if (dspyResult.selectedId.startsWith('ciqual')) {
              sourceBreakdown.ciqual++
            }
            console.log(`  [DSPy] Selected: ${plannedMeal.name} (confidence: ${dspyResult.confidence})`)
          }
        }
      }

      // Fallback to strategy-based selection if DSPy didn't work
      if (!plannedMeal) {
        // Agent decides which source to use based on strategy and context
        const sourceDecision = agentDecideSource(
          mealType,
          sourceStrategy,
          dayIndex,
          meals.filter(m => m.dayIndex === dayIndex)
        )

        // Try primary source
        switch (sourceDecision.primary) {
          case 'gustar':
            plannedMeal = selectFromGustar(gustarRecipes, mealType, targetCalories, userProfile, usedIds)
            if (plannedMeal) sourceBreakdown.gustar++
            break

          case 'ciqual':
            plannedMeal = selectFromCIQUAL(ciqualFoods, mealType, targetCalories, userProfile, usedIds)
            if (plannedMeal) sourceBreakdown.ciqual++
            break

          case 'off':
            plannedMeal = await selectFromOFF(mealType, targetCalories, userProfile, usedIds)
            if (plannedMeal) sourceBreakdown.off++
            break
        }

        // Fallback to other sources if primary failed
        if (!plannedMeal && sourceDecision.fallback) {
          for (const fallback of sourceDecision.fallback) {
            if (fallback === 'gustar' && !plannedMeal) {
              plannedMeal = selectFromGustar(gustarRecipes, mealType, targetCalories, userProfile, usedIds)
              if (plannedMeal) sourceBreakdown.gustar++
            }
            if (fallback === 'ciqual' && !plannedMeal) {
              plannedMeal = selectFromCIQUAL(ciqualFoods, mealType, targetCalories, userProfile, usedIds)
              if (plannedMeal) sourceBreakdown.ciqual++
            }
            if (fallback === 'off' && !plannedMeal) {
              plannedMeal = await selectFromOFF(mealType, targetCalories, userProfile, usedIds)
              if (plannedMeal) sourceBreakdown.off++
            }
            if (plannedMeal) break
          }
        }
      }

      if (plannedMeal) {
        plannedMeal.dayIndex = dayIndex
        plannedMeal.mealType = mealType
        meals.push(plannedMeal)
        existingMealNames.push(plannedMeal.name)
        usedIds.add(plannedMeal.sourceRecipeId || plannedMeal.id)
        console.log(`  [${plannedMeal.source}] ${mealType}: ${plannedMeal.name} (${plannedMeal.nutrition.calories} kcal)`)
      }
    }
  }

  console.log(`[Agent] DSPy used for ${dspyUsedCount}/${days * 4} meals`)

  console.log(`[Agent] ===== GENERATION COMPLETE =====`)
  console.log(`[Agent] Total meals: ${meals.length}`)
  console.log(`[Agent] Sources: G=${sourceBreakdown.gustar} C=${sourceBreakdown.ciqual} O=${sourceBreakdown.off}`)

  const totalNutrition = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.nutrition.calories,
      proteins: acc.proteins + meal.nutrition.proteins,
      carbs: acc.carbs + meal.nutrition.carbs,
      fats: acc.fats + meal.nutrition.fats,
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )

  // Track meal plan generation
  const durationMs = Date.now() - startTime
  analytics.trackAIFeature('meal_plan', true, durationMs, {
    plan_duration_days: days,
    meals_count: meals.length,
    source_gustar: sourceBreakdown.gustar,
    source_ciqual: sourceBreakdown.ciqual,
    source_off: sourceBreakdown.off,
    dspy_used: dspyUsedCount > 0,
    calories: totalNutrition.calories,
  })

  return {
    meals,
    sourceBreakdown,
    totalNutrition,
    generatedAt: new Date().toISOString(),
    days,
    dspyUsed: dspyUsedCount > 0,
    promptOptimization: {
      preference: sourcePreference,
      confidence: optimizedPrompts.confidence,
    },
  }
}

/**
 * Agent determines source strategy based on user profile
 *
 * Sources:
 * - CIQUAL = Produits frais, données officielles ANSES (fruits, légumes, viandes, poissons)
 * - Gustar = Recettes maison complètes avec instructions
 * - OFF = Produits commerciaux pratiques (snacks, plats préparés)
 *
 * User preferences (mealSourcePreference):
 * - 'fresh' = Priorité produits frais (CIQUAL)
 * - 'recipes' = Priorité plats élaborés (Gustar)
 * - 'quick' = Priorité snacks/rapide (OFF)
 * - 'balanced' = Mix équilibré intelligent
 */
function determineSourceStrategy(profile: UserProfile): {
  gustar: number  // Weight 0-1
  ciqual: number
  off: number
} {
  // Check user's meal source preference first
  const preference = profile.mealSourcePreference || 'balanced'

  // Base strategy selon la préférence utilisateur
  let strategy: { gustar: number; ciqual: number; off: number }

  switch (preference) {
    case 'fresh':
      // Produits frais - CIQUAL prioritaire (fruits, légumes, viandes, poissons)
      strategy = { gustar: 0.20, ciqual: 0.70, off: 0.10 }
      break
    case 'recipes':
      // Plats élaborés - Gustar prioritaire (recettes maison complètes)
      strategy = { gustar: 0.65, ciqual: 0.25, off: 0.10 }
      break
    case 'quick':
      // Snacks/Rapide - OFF prioritaire (produits du commerce pratiques)
      strategy = { gustar: 0.20, ciqual: 0.30, off: 0.50 }
      break
    case 'balanced':
    default:
      // Équilibré - mix intelligent, CIQUAL légèrement prioritaire (plus sain)
      strategy = { gustar: 0.35, ciqual: 0.50, off: 0.15 }
      break
  }

  // Ajustements fins selon l'objectif (modifications mineures)
  if (profile.goal === 'weight_loss' && preference === 'balanced') {
    // Perte de poids + balanced = plus de CIQUAL pour précision calorique
    strategy.ciqual += 0.10
    strategy.off -= 0.10
  } else if (profile.goal === 'muscle_gain' && preference === 'balanced') {
    // Prise de muscle + balanced = plus de Gustar pour recettes protéinées
    strategy.gustar += 0.10
    strategy.off -= 0.10
  }

  // Ajustement pour régime végétarien/vegan
  if (profile.dietType === 'vegetarian' || profile.dietType === 'vegan') {
    // CIQUAL a beaucoup d'aliments végétaux de qualité
    strategy.ciqual = Math.min(0.80, strategy.ciqual + 0.10)
    strategy.off = Math.max(0.05, strategy.off - 0.10)
  }

  console.log(`[Agent] Strategy for preference="${preference}": G=${strategy.gustar} C=${strategy.ciqual} O=${strategy.off}`)
  return strategy
}

/**
 * Agent decides which source to use for a specific meal
 * Respecte la stratégie calculée depuis les préférences utilisateur
 */
function agentDecideSource(
  mealType: MealType,
  strategy: { gustar: number; ciqual: number; off: number },
  dayIndex: number,
  dayMeals: PlannedMealItem[]
): { primary: MealSource; fallback: MealSource[] } {
  // Count sources used today to ensure variety
  const todaySources = dayMeals.map(m => m.source)
  const gustarCount = todaySources.filter(s => s === 'gustar').length
  const manualCount = todaySources.filter(s => s === 'manual').length // CIQUAL/OFF stored as manual

  // Determine dominant source from strategy
  const dominantSource: MealSource =
    strategy.ciqual >= strategy.gustar && strategy.ciqual >= strategy.off ? 'ciqual' :
    strategy.gustar >= strategy.off ? 'gustar' : 'off'

  // Build fallback order based on strategy weights
  const sortedSources: MealSource[] = [
    { source: 'ciqual' as MealSource, weight: strategy.ciqual },
    { source: 'gustar' as MealSource, weight: strategy.gustar },
    { source: 'off' as MealSource, weight: strategy.off },
  ]
    .sort((a, b) => b.weight - a.weight)
    .map(s => s.source)

  // If Gustar is overused, switch to next preferred source
  if (gustarCount >= 2) {
    const fallback = sortedSources.filter(s => s !== 'gustar')
    return { primary: fallback[0], fallback: [...fallback.slice(1), 'gustar'] }
  }
  // If CIQUAL/OFF (manual) is overused, switch to Gustar
  if (manualCount >= 3) {
    return { primary: 'gustar', fallback: sortedSources.filter(s => s !== 'gustar') }
  }

  // Apply strategy weights with some randomness
  const rand = Math.random()
  const firstThreshold = sortedSources[0] === 'ciqual' ? strategy.ciqual :
                         sortedSources[0] === 'gustar' ? strategy.gustar : strategy.off
  const secondWeight = sortedSources[1] === 'ciqual' ? strategy.ciqual :
                       sortedSources[1] === 'gustar' ? strategy.gustar : strategy.off
  const secondThreshold = firstThreshold + secondWeight

  if (rand < firstThreshold) {
    return { primary: sortedSources[0], fallback: sortedSources.slice(1) }
  } else if (rand < secondThreshold) {
    return { primary: sortedSources[1], fallback: [sortedSources[0], sortedSources[2]] }
  } else {
    return { primary: sortedSources[2], fallback: [sortedSources[0], sortedSources[1]] }
  }
}

/**
 * Select meal from Gustar recipes using macro-aware scoring
 */
function selectFromGustar(
  recipes: StaticEnrichedRecipe[],
  mealType: MealType,
  targetCalories: number,
  profile: UserProfile,
  usedIds: Set<string>
): PlannedMealItem | null {
  const recipesForType = getStaticRecipesByMealType(mealType)

  // Calculate macro targets for this meal based on user's daily goals
  const dailyMacros = profile.nutritionalNeeds ? {
    proteins: profile.nutritionalNeeds.proteins,
    carbs: profile.nutritionalNeeds.carbs,
    fats: profile.nutritionalNeeds.fats,
  } : { proteins: 100, carbs: 200, fats: 65 } // Fallback defaults

  const userGoal = profile.goal || 'maintain'
  const mealMacroTargets = calculateMealMacroTargets(dailyMacros, mealType, userGoal)

  const suitable = recipesForType
    .filter(r => !usedIds.has(r.id))
    .filter(r => r.nutrition.calories <= targetCalories + 150 && r.nutrition.calories >= targetCalories * 0.5)
    .filter(r => {
      if (!profile.allergies?.length) return true
      const content = `${r.titleFr} ${r.ingredientsFr.map(i => i.name).join(' ')}`.toLowerCase()
      return !profile.allergies.some(a => content.includes(a.toLowerCase()))
    })

  if (suitable.length === 0) return null

  // Score each meal by how well it matches macro targets for the user's goal
  // Include recipe name for ingredient-based scoring
  const scoredMeals = suitable.map(r => ({
    recipe: r,
    score: scoreMealByMacros(r.nutrition, mealMacroTargets, userGoal, targetCalories, r.titleFr),
  }))

  // Sort by macro score (highest first)
  scoredMeals.sort((a, b) => b.score - a.score)

  // Log top candidates for debugging
  if (scoredMeals.length > 0) {
    const top3 = scoredMeals.slice(0, 3)
    console.log(`[RAG:Gustar] ${mealType} macro targets: P=${mealMacroTargets.proteins}g C=${mealMacroTargets.carbs}g F=${mealMacroTargets.fats}g (goal: ${userGoal})`)
    console.log(`[RAG:Gustar] Top 3 matches:`, top3.map(m => `${m.recipe.titleFr} (score=${m.score}, P=${m.recipe.nutrition.proteins}g C=${m.recipe.nutrition.carbs}g)`).join(', '))
  }

  // Pick from top 3 scored meals for variety (but prioritize higher scores)
  const topCandidates = scoredMeals.slice(0, Math.min(3, scoredMeals.length))
  // Weighted random: higher score = higher chance
  const totalScore = topCandidates.reduce((sum, m) => sum + m.score, 0)
  let random = Math.random() * totalScore
  let selected = topCandidates[0].recipe

  for (const candidate of topCandidates) {
    random -= candidate.score
    if (random <= 0) {
      selected = candidate.recipe
      break
    }
  }

  usedIds.add(selected.id)
  const recipe = staticToRecipe(selected)

  return {
    id: generateMealId(),
    dayIndex: 0,
    mealType,
    name: recipe.title,
    description: recipe.description,
    nutrition: selected.nutrition,
    ingredients: recipe.ingredients.map(ing => ({
      name: ing.name,
      amount: `${ing.amount} ${ing.unit}`,
      calories: 0,
    })),
    instructions: recipe.instructions,
    prepTime: recipe.prepTime || 30,
    servings: recipe.servings || 1,
    imageUrl: recipe.imageUrl,
    isCheatMeal: false,
    isValidated: false,
    source: 'gustar',
    sourceRecipeId: recipe.id,
  }
}

/**
 * Select meal from Open Food Facts using macro-aware scoring
 */
async function selectFromOFF(
  mealType: MealType,
  targetCalories: number,
  profile: UserProfile,
  usedIds: Set<string>
): Promise<PlannedMealItem | null> {
  // Calculate macro targets for this meal
  const dailyMacros = profile.nutritionalNeeds ? {
    proteins: profile.nutritionalNeeds.proteins,
    carbs: profile.nutritionalNeeds.carbs,
    fats: profile.nutritionalNeeds.fats,
  } : { proteins: 100, carbs: 200, fats: 65 }

  const userGoal = profile.goal || 'maintain'
  const mealMacroTargets = calculateMealMacroTargets(dailyMacros, mealType, userGoal)

  // Search terms by meal type - prioritize protein-rich options for weight loss
  const searchTermsWeightLoss: Record<MealType, string[]> = {
    breakfast: ['yaourt grec', 'skyr', 'fromage blanc', 'oeufs', 'flocons avoine'],
    lunch: ['poulet', 'thon', 'saumon', 'salade protéinée', 'blanc de dinde'],
    snack: ['fromage blanc', 'skyr', 'amandes', 'noix', 'oeuf dur'],
    dinner: ['poisson', 'blanc de poulet', 'tofu', 'légumes vapeur', 'soupe protéinée'],
  }

  const searchTermsDefault: Record<MealType, string[]> = {
    breakfast: ['céréales petit déjeuner', 'muesli', 'yaourt nature', 'pain complet', 'flocons avoine'],
    lunch: ['salade composée', 'sandwich', 'wrap', 'plat préparé', 'taboulé'],
    snack: ['barre céréales', 'compote', 'fruit sec', 'biscuit', 'yaourt'],
    dinner: ['soupe légumes', 'plat cuisiné', 'légumes vapeur', 'poisson'],
  }

  // Use protein-focused search terms for weight loss goal
  const searchTerms = userGoal === 'weight_loss' ? searchTermsWeightLoss : searchTermsDefault
  const terms = searchTerms[mealType] || ['aliment']
  const randomTerm = terms[Math.floor(Math.random() * terms.length)]

  console.log(`[OFF] Searching for "${randomTerm}" (${mealType}, goal: ${userGoal})...`)

  try {
    const products = await searchOFF(randomTerm, 30) // Fetch more for better selection

    if (products.length === 0) {
      console.log('[OFF] No products found')
      return null
    }

    // Filter by calories, nutriscore, and unused
    const suitable = products
      .filter(p => !usedIds.has(p.code))
      .filter(p => {
        const calOk = p.nutrition.calories <= targetCalories + 100 && p.nutrition.calories >= targetCalories * 0.3
        const scoreOk = !p.nutriscore || ['a', 'b', 'c'].includes(p.nutriscore)
        return calOk && scoreOk
      })
      .filter(p => {
        // Check allergies
        if (!profile.allergies?.length) return true
        const name = p.name.toLowerCase()
        return !profile.allergies.some(a => name.includes(a.toLowerCase()))
      })

    if (suitable.length === 0) {
      console.log('[OFF] No suitable products after filtering')
      return null
    }

    // Score each product by macro match
    const scoredProducts = suitable.map(p => {
      const portionMultiplier = p.nutrition.calories > 0
        ? Math.min(2, Math.max(0.5, targetCalories / p.nutrition.calories))
        : 1

      const adjustedNutrition: NutritionInfo = {
        calories: Math.round(p.nutrition.calories * portionMultiplier),
        proteins: Math.round(p.nutrition.proteins * portionMultiplier),
        carbs: Math.round(p.nutrition.carbs * portionMultiplier),
        fats: Math.round(p.nutrition.fats * portionMultiplier),
      }

      // Base macro score (includes ingredient-based scoring from product name)
      let score = scoreMealByMacros(adjustedNutrition, mealMacroTargets, userGoal, targetCalories, p.name)

      // Bonus for good Nutriscore
      const nutriscoreBonus: Record<string, number> = { a: 10, b: 5, c: 0, d: -5, e: -10 }
      score += nutriscoreBonus[p.nutriscore || 'c'] || 0

      return { product: p, portionMultiplier, adjustedNutrition, score }
    })

    // Sort by combined score
    scoredProducts.sort((a, b) => b.score - a.score)

    // Log top candidates
    if (scoredProducts.length > 0) {
      const top3 = scoredProducts.slice(0, 3)
      console.log(`[RAG:OFF] ${mealType} macro targets: P=${mealMacroTargets.proteins}g C=${mealMacroTargets.carbs}g (goal: ${userGoal})`)
      console.log(`[RAG:OFF] Top 3:`, top3.map(m => `${m.product.name} (score=${m.score}, P=${m.adjustedNutrition.proteins}g, NS=${m.product.nutriscore || '?'})`).join(', '))
    }

    // Weighted random selection from top 5
    const topCandidates = scoredProducts.slice(0, Math.min(5, scoredProducts.length))
    const totalScore = topCandidates.reduce((sum, m) => sum + Math.max(1, m.score), 0) // Ensure positive scores
    let random = Math.random() * totalScore
    let selectedItem = topCandidates[0]

    for (const candidate of topCandidates) {
      random -= Math.max(1, candidate.score)
      if (random <= 0) {
        selectedItem = candidate
        break
      }
    }

    const { product: selected, portionMultiplier, adjustedNutrition } = selectedItem
    usedIds.add(selected.code)
    const adjustedPortion = Math.round(selected.portion * portionMultiplier)

    console.log(`[OFF] Selected: ${selected.name} (${adjustedNutrition.calories} kcal, P=${adjustedNutrition.proteins}g, Nutriscore ${selected.nutriscore || '?'})`)

    return {
      id: generateMealId(),
      dayIndex: 0,
      mealType,
      name: selected.name,
      description: selected.brand
        ? `${selected.brand} - ${adjustedPortion}g (Nutriscore ${selected.nutriscore?.toUpperCase() || '?'})`
        : `${adjustedPortion}g - Open Food Facts`,
      nutrition: adjustedNutrition,
      ingredients: [{
        name: selected.name,
        amount: `${adjustedPortion}g`,
        calories: adjustedNutrition.calories
      }],
      instructions: ['Prêt à consommer'],
      prepTime: 0,
      servings: 1,
      imageUrl: selected.imageUrl,
      isCheatMeal: false,
      isValidated: false,
      source: 'manual', // OFF products stored as manual
    }
  } catch (error) {
    console.error('[OFF] Search error:', error)
    return null
  }
}

/**
 * Select meal from CIQUAL foods using macro-aware scoring
 */
function selectFromCIQUAL(
  foods: CIQUALFood[],
  mealType: MealType,
  targetCalories: number,
  profile: UserProfile,
  usedIds: Set<string>
): PlannedMealItem | null {
  // Calculate macro targets for this meal
  const dailyMacros = profile.nutritionalNeeds ? {
    proteins: profile.nutritionalNeeds.proteins,
    carbs: profile.nutritionalNeeds.carbs,
    fats: profile.nutritionalNeeds.fats,
  } : { proteins: 100, carbs: 200, fats: 65 }

  const userGoal = profile.goal || 'maintain'
  const mealMacroTargets = calculateMealMacroTargets(dailyMacros, mealType, userGoal)

  const suitable = searchCIQUALByMealType(foods, mealType, targetCalories)
    .filter(f => !usedIds.has(f.id))
    .filter(f => {
      if (!profile.allergies?.length) return true
      const name = f.name.toLowerCase()
      return !profile.allergies.some(a => name.includes(a.toLowerCase()))
    })

  if (suitable.length === 0) return null

  // Calculate portion-adjusted nutrition and score for each food
  const scoredFoods = suitable.map(f => {
    // Calculate portion to match target calories
    const portionMultiplier = targetCalories / f.nutrition.calories
    const adjustedNutrition: NutritionInfo = {
      calories: Math.round(f.nutrition.calories * portionMultiplier),
      proteins: Math.round(f.nutrition.proteins * portionMultiplier),
      carbs: Math.round(f.nutrition.carbs * portionMultiplier),
      fats: Math.round(f.nutrition.fats * portionMultiplier),
    }

    return {
      food: f,
      portionMultiplier,
      adjustedNutrition,
      score: scoreMealByMacros(adjustedNutrition, mealMacroTargets, userGoal, targetCalories, f.name),
    }
  })

  // Sort by macro score (highest first)
  scoredFoods.sort((a, b) => b.score - a.score)

  // Log top candidates
  if (scoredFoods.length > 0) {
    const top3 = scoredFoods.slice(0, 3)
    console.log(`[RAG:CIQUAL] ${mealType} macro targets: P=${mealMacroTargets.proteins}g C=${mealMacroTargets.carbs}g (goal: ${userGoal})`)
    console.log(`[RAG:CIQUAL] Top 3:`, top3.map(m => `${m.food.name} (score=${m.score}, P=${m.adjustedNutrition.proteins}g)`).join(', '))
  }

  // Weighted random selection from top 5
  const topCandidates = scoredFoods.slice(0, Math.min(5, scoredFoods.length))
  const totalScore = topCandidates.reduce((sum, m) => sum + m.score, 0)
  let random = Math.random() * totalScore
  let selectedItem = topCandidates[0]

  for (const candidate of topCandidates) {
    random -= candidate.score
    if (random <= 0) {
      selectedItem = candidate
      break
    }
  }

  const { food: selected, portionMultiplier, adjustedNutrition } = selectedItem
  usedIds.add(selected.id)
  const portionGrams = Math.round(selected.serving * portionMultiplier)

  return {
    id: generateMealId(),
    dayIndex: 0,
    mealType,
    name: selected.name,
    description: `${portionGrams}g - Source CIQUAL (ANSES)`,
    nutrition: adjustedNutrition,
    ingredients: [{ name: selected.name, amount: `${portionGrams}g`, calories: adjustedNutrition.calories }],
    instructions: ['Préparer selon tes préférences'],
    prepTime: 10,
    servings: 1,
    isCheatMeal: false,
    isValidated: false,
    source: 'manual', // CIQUAL stored as manual
  }
}

// Helper functions for extracting data from SourcedMeal
function getIngredients(meal: SourcedMeal): { name: string; amount: string; calories: number }[] {
  if (meal.recipe) {
    return meal.recipe.ingredients.map(ing => ({
      name: ing.name,
      amount: `${ing.amount} ${ing.unit}`,
      calories: 0,
    }))
  }
  if (meal.aiRecipe) {
    return meal.aiRecipe.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount,
      calories: ing.calories || 0,
    }))
  }
  if (meal.offProduct) {
    return [{
      name: meal.offProduct.name,
      amount: `${meal.offProduct.portion}g`,
      calories: meal.nutrition.calories,
    }]
  }
  return []
}

function getInstructions(meal: SourcedMeal): string[] {
  if (meal.recipe) return meal.recipe.instructions
  if (meal.aiRecipe) return meal.aiRecipe.instructions
  if (meal.offProduct) return ['Pret a consommer']
  return []
}

function getPrepTime(meal: SourcedMeal): number {
  if (meal.recipe) return meal.recipe.prepTime || meal.recipe.totalTime || 30
  if (meal.aiRecipe) return meal.aiRecipe.prepTime
  return 0
}

function getServings(meal: SourcedMeal): number {
  if (meal.recipe) return meal.recipe.servings || 1
  if (meal.aiRecipe) return meal.aiRecipe.servings
  return 1
}

function getImageUrl(meal: SourcedMeal): string | undefined {
  if (meal.recipe) return meal.recipe.imageUrl
  if (meal.aiRecipe) return meal.aiRecipe.imageUrl || undefined
  if (meal.offProduct) return meal.offProduct.imageUrl
  return undefined
}

export default {
  generateMealPlanWithRAG,
  regenerateMealWithRAG,
  getMealSourceRecommendation,
  getMealsFromSource,
  // New RAG-powered functions
  generateSingleMealWithRAG,
  generateFlexibleMealPlanWithRAG,
  SOURCE_LABELS,
}
