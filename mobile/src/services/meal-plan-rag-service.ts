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
  type MealSource,
  type SourcedMeal,
  type RAGContext,
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
import type { UserProfile, MealType, NutritionInfo, Recipe } from '../types'
import type { PlannedMealItem } from '../stores/meal-plan-store'

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
 */
export async function generateSingleMealWithRAG(params: {
  mealType: MealType
  userProfile: UserProfile
  consumed: NutritionInfo
  calorieReduction?: boolean
}): Promise<SingleMealResult> {
  console.log('[RAG] ===== generateSingleMealWithRAG START =====')
  console.log('[RAG] Params:', JSON.stringify({ mealType: params.mealType, calorieReduction: params.calorieReduction }))

  const { mealType, userProfile, consumed, calorieReduction = false } = params

  // Ensure static recipes are loaded
  console.log('[RAG] Loading static recipes...')
  const recipes = await loadStaticRecipes()
  console.log('[RAG] Static recipes loaded:', recipes.length)

  // Calculate target calories for this meal
  const dailyTarget = userProfile.nutritionalNeeds?.calories || 2000
  const adjustedTarget = calorieReduction ? Math.round(dailyTarget * 0.9) : dailyTarget

  const mealTargets = calculateMealTargets(adjustedTarget)
  const targetCalories = mealTargets[mealType]

  console.log('[RAG] Daily target:', dailyTarget, '| Adjusted:', adjustedTarget, '| Meal target:', targetCalories)

  // Build RAG context with explicit target calories override
  // This ensures we use meal-type based ratio, not remaining-based calculation
  const ragContext = buildRAGContext({
    userProfile,
    mealType,
    day: 0,
    dailyTarget: adjustedTarget,
    consumed,
    existingMeals: [],
    overrideTargetCalories: targetCalories, // Use calculated meal target, not remaining-based
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

    return {
      success: true,
      recipe,
      source: sourcedMeal.source,
      sourceLabel: SOURCE_LABELS[sourcedMeal.source],
      confidence: sourcedMeal.confidence,
    }
  } catch (error) {
    console.error('[RAG] Error generating meal:', error)
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

/**
 * Generate a multi-day meal plan with flexible duration
 */
export async function generateFlexibleMealPlanWithRAG(params: {
  userProfile: UserProfile
  dailyCalories: number
  days: 1 | 3 | 7
  calorieReduction?: boolean
  preferences?: MealPlanConfig['preferences']
}): Promise<GeneratedMealPlan & { days: number }> {
  const { userProfile, dailyCalories, days, calorieReduction = false, preferences } = params

  // Adjust calories if reduction mode
  const adjustedCalories = calorieReduction ? Math.round(dailyCalories * 0.9) : dailyCalories

  // Ensure static recipes are loaded
  await loadStaticRecipes()

  const mealTargets = calculateMealTargets(adjustedCalories)
  const meals: PlannedMealItem[] = []
  const existingMealNames: string[] = []

  // Track source usage
  const sourceBreakdown = {
    gustar: 0,
    off: 0,
    ciqual: 0,
    ai: 0,
  }

  // Generate meals for each day
  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    console.log(`[RAG] Generating meals for day ${dayIndex + 1}/${days}...`)

    for (const mealType of MEAL_TYPES_ORDER) {
      const isCheatMeal =
        preferences?.includeCheatMeal &&
        preferences?.cheatMealDay === dayIndex &&
        preferences?.cheatMealType === mealType

      const slot: MealSlot = {
        dayIndex,
        mealType,
        targetCalories: isCheatMeal
          ? Math.round(mealTargets[mealType] * 1.5)
          : mealTargets[mealType],
        isCheatMeal,
      }

      // Build consumed nutrition for this day
      const consumed: NutritionInfo = {
        calories: 0,
        proteins: 0,
        carbs: 0,
        fats: 0,
      }

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
        dailyTarget: adjustedCalories,
        consumed,
        existingMeals: existingMealNames,
      })

      if (preferences?.preferQuick && ragContext.preferences) {
        ragContext.preferences.preferHomemade = false
      }

      try {
        const sourcedMeal = await getRAGMeal(ragContext)

        if (sourcedMeal) {
          const mealName = sourcedMeal.recipe?.title ||
            sourcedMeal.aiRecipe?.title ||
            sourcedMeal.offProduct?.name ||
            `${mealType} jour ${dayIndex + 1}`

          const plannedMeal = sourcedMealToPlannedItem(sourcedMeal, slot, mealName)
          meals.push(plannedMeal)
          existingMealNames.push(mealName)

          if (sourcedMeal.source === 'gustar') sourceBreakdown.gustar++
          else if (sourcedMeal.source === 'off') sourceBreakdown.off++
          else if (sourcedMeal.source === 'ciqual') sourceBreakdown.ciqual++
          else if (sourcedMeal.source === 'ai') sourceBreakdown.ai++

          console.log(`  [${sourcedMeal.source}] ${mealType}: ${mealName} (${sourcedMeal.nutrition.calories} kcal)`)
        }
      } catch (error) {
        console.error(`  Error generating ${mealType}:`, error)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

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
    days,
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
