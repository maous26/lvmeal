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
import { getOptimizedMealPrompt, type MealGenerationContext } from './dspy/meal-prompts'
import type { DSPyPassage } from './dspy/types'
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
 * Now uses DSPy-optimized prompts based on user's source preference
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

  const optimizedPrompts = await getOptimizedMealPrompt(promptContext)
  console.log(`[RAG] DSPy prompts optimized for "${sourcePreference}" (confidence: ${optimizedPrompts.confidence})`)

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
        instructions: ['Préparer selon vos préférences'],
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
 * Select meal from Gustar recipes
 */
function selectFromGustar(
  recipes: StaticEnrichedRecipe[],
  mealType: MealType,
  targetCalories: number,
  profile: UserProfile,
  usedIds: Set<string>
): PlannedMealItem | null {
  const recipesForType = getStaticRecipesByMealType(mealType)

  const suitable = recipesForType
    .filter(r => !usedIds.has(r.id))
    .filter(r => r.nutrition.calories <= targetCalories + 150 && r.nutrition.calories >= targetCalories * 0.5)
    .filter(r => {
      if (!profile.allergies?.length) return true
      const content = `${r.titleFr} ${r.ingredientsFr.map(i => i.name).join(' ')}`.toLowerCase()
      return !profile.allergies.some(a => content.includes(a.toLowerCase()))
    })

  if (suitable.length === 0) return null

  // Sort by calorie match
  suitable.sort((a, b) => {
    const diffA = Math.abs(a.nutrition.calories - targetCalories)
    const diffB = Math.abs(b.nutrition.calories - targetCalories)
    return diffA - diffB
  })

  // Pick from top 3 for variety
  const selected = suitable[Math.floor(Math.random() * Math.min(3, suitable.length))]
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
 * Select meal from Open Food Facts
 */
async function selectFromOFF(
  mealType: MealType,
  targetCalories: number,
  profile: UserProfile,
  usedIds: Set<string>
): Promise<PlannedMealItem | null> {
  // Search terms by meal type
  const searchTerms: Record<MealType, string[]> = {
    breakfast: ['céréales petit déjeuner', 'muesli', 'yaourt nature', 'pain complet', 'flocons avoine'],
    lunch: ['salade composée', 'sandwich', 'wrap', 'plat préparé', 'taboulé'],
    snack: ['barre céréales', 'compote', 'fruit sec', 'biscuit', 'yaourt'],
    dinner: ['soupe légumes', 'plat cuisiné', 'légumes vapeur', 'poisson'],
  }

  const terms = searchTerms[mealType] || ['aliment']
  const randomTerm = terms[Math.floor(Math.random() * terms.length)]

  console.log(`[OFF] Searching for "${randomTerm}" (${mealType})...`)

  try {
    const products = await searchOFF(randomTerm, 20)

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

    // Sort by calorie match and nutriscore
    suitable.sort((a, b) => {
      // Prefer better nutriscore
      const scoreOrder: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, unknown: 5 }
      const scoreA = scoreOrder[a.nutriscore || 'unknown'] || 5
      const scoreB = scoreOrder[b.nutriscore || 'unknown'] || 5
      if (scoreA !== scoreB) return scoreA - scoreB

      // Then by calorie match
      const diffA = Math.abs(a.nutrition.calories - targetCalories)
      const diffB = Math.abs(b.nutrition.calories - targetCalories)
      return diffA - diffB
    })

    // Pick from top 3 for variety
    const selected = suitable[Math.floor(Math.random() * Math.min(3, suitable.length))]
    usedIds.add(selected.code)

    console.log(`[OFF] Selected: ${selected.name} (${selected.nutrition.calories} kcal, Nutriscore ${selected.nutriscore || '?'})`)

    // Calculate portion to match target if needed
    const portionMultiplier = selected.nutrition.calories > 0
      ? Math.min(2, Math.max(0.5, targetCalories / selected.nutrition.calories))
      : 1
    const adjustedPortion = Math.round(selected.portion * portionMultiplier)

    return {
      id: generateMealId(),
      dayIndex: 0,
      mealType,
      name: selected.name,
      description: selected.brand
        ? `${selected.brand} - ${adjustedPortion}g (Nutriscore ${selected.nutriscore?.toUpperCase() || '?'})`
        : `${adjustedPortion}g - Open Food Facts`,
      nutrition: {
        calories: Math.round(selected.nutrition.calories * portionMultiplier),
        proteins: Math.round(selected.nutrition.proteins * portionMultiplier),
        carbs: Math.round(selected.nutrition.carbs * portionMultiplier),
        fats: Math.round(selected.nutrition.fats * portionMultiplier),
      },
      ingredients: [{
        name: selected.name,
        amount: `${adjustedPortion}g`,
        calories: Math.round(selected.nutrition.calories * portionMultiplier)
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
 * Select meal from CIQUAL foods
 */
function selectFromCIQUAL(
  foods: CIQUALFood[],
  mealType: MealType,
  targetCalories: number,
  profile: UserProfile,
  usedIds: Set<string>
): PlannedMealItem | null {
  const suitable = searchCIQUALByMealType(foods, mealType, targetCalories)
    .filter(f => !usedIds.has(f.id))
    .filter(f => {
      if (!profile.allergies?.length) return true
      const name = f.name.toLowerCase()
      return !profile.allergies.some(a => name.includes(a.toLowerCase()))
    })

  if (suitable.length === 0) return null

  // Sort by calorie match
  suitable.sort((a, b) => {
    const diffA = Math.abs(a.nutrition.calories - targetCalories)
    const diffB = Math.abs(b.nutrition.calories - targetCalories)
    return diffA - diffB
  })

  // Pick from top 5 for variety
  const selected = suitable[Math.floor(Math.random() * Math.min(5, suitable.length))]
  usedIds.add(selected.id)

  // Calculate portion to match target calories
  const portionMultiplier = targetCalories / selected.nutrition.calories
  const portionGrams = Math.round(selected.serving * portionMultiplier)

  return {
    id: generateMealId(),
    dayIndex: 0,
    mealType,
    name: selected.name,
    description: `${portionGrams}g - Source CIQUAL (ANSES)`,
    nutrition: {
      calories: Math.round(selected.nutrition.calories * portionMultiplier),
      proteins: Math.round(selected.nutrition.proteins * portionMultiplier),
      carbs: Math.round(selected.nutrition.carbs * portionMultiplier),
      fats: Math.round(selected.nutrition.fats * portionMultiplier),
    },
    ingredients: [{ name: selected.name, amount: `${portionGrams}g`, calories: Math.round(selected.nutrition.calories * portionMultiplier) }],
    instructions: ['Preparer selon vos preferences'],
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
