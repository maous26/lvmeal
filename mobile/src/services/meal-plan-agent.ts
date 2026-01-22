/**
 * Meal Plan Agent - Smart 7-day meal planning
 * Adapted from webapp: src/app/actions/weekly-planner.ts
 *
 * Priority for meal sourcing:
 * 1. Gustar.io (German recipes via RapidAPI)
 * 2. CIQUAL (French food database)
 * 3. Open Food Facts (branded products)
 * 4. AI generation (OpenAI fallback)
 */

import { gustarRecipes, type DietaryPreference } from './gustar-recipes'
import { generatePlanMeal, generateShoppingList as generateShoppingListAI } from './ai-service'
import { searchFoods } from './food-search'
import { shouldEnrichRecipe } from './gustar-enrichment'
import {
  loadStaticRecipes,
  filterStaticRecipes,
  hasStaticRecipes,
  type StaticEnrichedRecipe,
} from './static-recipes'
import type { UserProfile, MealType } from '../types'
import type { PlannedMealItem, ShoppingList, ShoppingItem } from '../stores/meal-plan-store'

// ============= TYPES =============

import type { MealSourcePreference } from '../types'

export type RecipeComplexity = 'basique' | 'elabore' | 'mix'
export type CookingLevel = 'beginner' | 'intermediate' | 'advanced'

export interface WeeklyPlanPreferences {
  dailyCalories: number
  proteins: number
  carbs: number
  fats: number
  dietType?: string
  allergies?: string[]
  includeCheatMeal?: boolean
  cookingTimeWeekday?: number
  cookingTimeWeekend?: number
  complexity?: RecipeComplexity
  cookingLevel?: CookingLevel
  mealSourcePreference?: MealSourcePreference
  goal?: string // weight_loss, muscle_gain, health
}

// ============= CONSTANTS =============

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

// ============= SOURCE STRATEGY =============

interface SourceStrategy {
  gustar: number  // Weight 0-1 for Gustar recipes
  ciqual: number  // Weight 0-1 for CIQUAL products
  off: number     // Weight 0-1 for Open Food Facts
}

// ============= GOAL-BASED COMPOSITION =============

/**
 * Nutritional scoring criteria based on user goal.
 * Higher score = better match for the user's objective.
 */
interface NutritionCriteria {
  // Ideal macro ratios (as % of calories)
  proteinRatio: { min: number; ideal: number; max: number }
  carbRatio: { min: number; ideal: number; max: number }
  fatRatio: { min: number; ideal: number; max: number }
  // Caloric density preference (kcal per 100g)
  caloricDensity: { prefer: 'low' | 'medium' | 'high'; maxPer100g?: number }
  // Protein density preference (g protein per 100 kcal)
  proteinDensity: { min: number; ideal: number }
}

/**
 * Get nutrition criteria based on user goal.
 */
function getNutritionCriteria(goal?: string): NutritionCriteria {
  switch (goal) {
    case 'lose':
    case 'weight_loss':
      // Weight loss: high protein, moderate carbs, lower fat, low caloric density
      return {
        proteinRatio: { min: 25, ideal: 30, max: 40 },
        carbRatio: { min: 30, ideal: 40, max: 50 },
        fatRatio: { min: 20, ideal: 25, max: 35 },
        caloricDensity: { prefer: 'low', maxPer100g: 150 },
        proteinDensity: { min: 8, ideal: 12 }, // g protein per 100 kcal
      }

    case 'gain':
    case 'muscle':
    case 'muscle_gain':
      // Muscle gain: very high protein, high carbs, moderate fat
      return {
        proteinRatio: { min: 30, ideal: 35, max: 45 },
        carbRatio: { min: 35, ideal: 45, max: 55 },
        fatRatio: { min: 15, ideal: 20, max: 30 },
        caloricDensity: { prefer: 'medium' },
        proteinDensity: { min: 10, ideal: 15 },
      }

    case 'maintain':
    case 'health':
    default:
      // Balanced: standard macro distribution
      return {
        proteinRatio: { min: 15, ideal: 25, max: 35 },
        carbRatio: { min: 40, ideal: 50, max: 60 },
        fatRatio: { min: 20, ideal: 25, max: 35 },
        caloricDensity: { prefer: 'medium' },
        proteinDensity: { min: 6, ideal: 10 },
      }
  }
}

/**
 * Score a meal based on how well it matches the user's nutritional goals.
 * Returns a score from 0 to 100.
 */
function scoreMealForGoal(
  meal: PlannedMealItem,
  criteria: NutritionCriteria,
  targetCalories: number
): number {
  const { calories, proteins, carbs, fats } = meal.nutrition

  // Skip meals with no nutrition data
  if (calories === 0) return 50 // Neutral score

  let score = 0

  // 1. Protein density score (40 points) - most important for all goals
  const proteinPer100kcal = calories > 0 ? (proteins / calories) * 100 : 0
  if (proteinPer100kcal >= criteria.proteinDensity.ideal) {
    score += 40
  } else if (proteinPer100kcal >= criteria.proteinDensity.min) {
    score += 25 + ((proteinPer100kcal - criteria.proteinDensity.min) / (criteria.proteinDensity.ideal - criteria.proteinDensity.min)) * 15
  } else {
    score += (proteinPer100kcal / criteria.proteinDensity.min) * 25
  }

  // 2. Caloric density score (30 points)
  // Estimate calories per 100g based on meal data
  const estimatedPer100g = calories // Most CIQUAL data is per 100g
  if (criteria.caloricDensity.prefer === 'low') {
    if (criteria.caloricDensity.maxPer100g && estimatedPer100g <= criteria.caloricDensity.maxPer100g) {
      score += 30
    } else if (estimatedPer100g <= 200) {
      score += 25
    } else if (estimatedPer100g <= 300) {
      score += 15
    } else {
      score += 5
    }
  } else if (criteria.caloricDensity.prefer === 'high') {
    if (estimatedPer100g >= 300) {
      score += 30
    } else if (estimatedPer100g >= 200) {
      score += 20
    } else {
      score += 10
    }
  } else {
    // Medium preference - balanced scoring
    if (estimatedPer100g >= 100 && estimatedPer100g <= 300) {
      score += 30
    } else {
      score += 15
    }
  }

  // 3. Macro balance score (30 points)
  const totalMacroCalories = (proteins * 4) + (carbs * 4) + (fats * 9)
  if (totalMacroCalories > 0) {
    const actualProteinRatio = ((proteins * 4) / totalMacroCalories) * 100
    const actualCarbRatio = ((carbs * 4) / totalMacroCalories) * 100
    const actualFatRatio = ((fats * 9) / totalMacroCalories) * 100

    // Check if ratios are within acceptable ranges
    let macroScore = 0

    // Protein ratio check
    if (actualProteinRatio >= criteria.proteinRatio.min && actualProteinRatio <= criteria.proteinRatio.max) {
      macroScore += 10
      if (Math.abs(actualProteinRatio - criteria.proteinRatio.ideal) <= 5) {
        macroScore += 5 // Bonus for being close to ideal
      }
    }

    // Carb ratio check
    if (actualCarbRatio >= criteria.carbRatio.min && actualCarbRatio <= criteria.carbRatio.max) {
      macroScore += 5
    }

    // Fat ratio check
    if (actualFatRatio >= criteria.fatRatio.min && actualFatRatio <= criteria.fatRatio.max) {
      macroScore += 5
    }

    score += macroScore
  }

  return Math.min(100, Math.round(score))
}

/**
 * Check if a meal matches diet restrictions.
 */
function matchesDiet(meal: PlannedMealItem, dietType?: string): boolean {
  if (!dietType || dietType === 'omnivore') return true

  const mealName = meal.name.toLowerCase()
  const ingredients = meal.ingredients.map(i => i.name.toLowerCase()).join(' ')
  const combined = `${mealName} ${ingredients}`

  switch (dietType.toLowerCase()) {
    case 'vegetarian':
    case 'végétarien':
      // Exclude meat and fish
      const meatKeywords = ['poulet', 'boeuf', 'bœuf', 'porc', 'viande', 'jambon', 'bacon', 'saucisse',
        'steak', 'escalope', 'filet de', 'côte de', 'rôti', 'agneau', 'veau', 'canard', 'dinde',
        'poisson', 'saumon', 'thon', 'cabillaud', 'crevette', 'fruits de mer', 'anchois']
      return !meatKeywords.some(kw => combined.includes(kw))

    case 'vegan':
    case 'végan':
      // Exclude all animal products
      const animalKeywords = ['poulet', 'boeuf', 'bœuf', 'porc', 'viande', 'jambon', 'bacon',
        'poisson', 'saumon', 'thon', 'crevette', 'lait', 'fromage', 'yaourt', 'yogourt',
        'crème', 'beurre', 'œuf', 'oeuf', 'miel', 'gélatine']
      return !animalKeywords.some(kw => combined.includes(kw))

    case 'pescatarian':
    case 'pescétarien':
      // Allow fish, exclude meat
      const landMeatKeywords = ['poulet', 'boeuf', 'bœuf', 'porc', 'viande', 'jambon', 'bacon',
        'steak', 'escalope', 'rôti', 'agneau', 'veau', 'canard', 'dinde']
      return !landMeatKeywords.some(kw => combined.includes(kw))

    case 'halal':
      // Exclude pork and alcohol
      const haramKeywords = ['porc', 'jambon', 'bacon', 'saucisse de porc', 'lard', 'alcool', 'vin', 'bière']
      return !haramKeywords.some(kw => combined.includes(kw))

    case 'keto':
    case 'cétogène':
      // Prefer low carb (this is a soft preference, handled more in scoring)
      return meal.nutrition.carbs < 20 || (meal.nutrition.carbs / meal.nutrition.calories * 100) < 10

    default:
      return true
  }
}

/**
 * Check if a meal contains any allergens to exclude.
 */
function containsAllergen(meal: PlannedMealItem, allergies?: string[]): boolean {
  if (!allergies || allergies.length === 0) return false

  const mealName = meal.name.toLowerCase()
  const ingredients = meal.ingredients.map(i => i.name.toLowerCase()).join(' ')
  const combined = `${mealName} ${ingredients}`

  const allergenKeywords: Record<string, string[]> = {
    gluten: ['blé', 'farine', 'pain', 'pâtes', 'semoule', 'orge', 'seigle', 'avoine', 'croissant', 'brioche'],
    lactose: ['lait', 'fromage', 'yaourt', 'yogourt', 'crème', 'beurre', 'lactose'],
    dairy: ['lait', 'fromage', 'yaourt', 'yogourt', 'crème', 'beurre'],
    eggs: ['œuf', 'oeuf', 'omelette', 'mayonnaise'],
    nuts: ['noix', 'amande', 'noisette', 'pistache', 'cajou', 'pécan', 'macadamia'],
    peanuts: ['arachide', 'cacahuète', 'beurre de cacahuète'],
    soy: ['soja', 'tofu', 'tempeh', 'edamame'],
    fish: ['poisson', 'saumon', 'thon', 'cabillaud', 'anchois', 'sardine', 'maquereau'],
    shellfish: ['crevette', 'crabe', 'homard', 'moule', 'huître', 'fruits de mer'],
    sesame: ['sésame', 'tahini'],
  }

  for (const allergy of allergies) {
    const allergyLower = allergy.toLowerCase()
    const keywords = allergenKeywords[allergyLower]
    if (keywords && keywords.some(kw => combined.includes(kw))) {
      return true
    }
    // Also check if the allergy name itself is in the meal
    if (combined.includes(allergyLower)) {
      return true
    }
  }

  return false
}

/**
 * Determine source selection strategy based on user preferences and meal type.
 *
 * Rules:
 * - Breakfast & Snack: simple products (CIQUAL/OFF), fewer recipes
 * - Lunch & Dinner: recipes possible based on preference
 * - Goal adjustments: weight_loss = more CIQUAL precision, muscle_gain = more protein recipes
 */
function determineSourceStrategy(
  mealSourcePreference: MealSourcePreference = 'balanced',
  mealType: MealType,
  goal?: string
): SourceStrategy {
  const isSimpleMeal = mealType === 'breakfast' || mealType === 'snack'
  const isMainMeal = mealType === 'lunch' || mealType === 'dinner'

  let strategy: SourceStrategy

  switch (mealSourcePreference) {
    case 'fresh':
      // Fresh products priority (CIQUAL)
      if (isSimpleMeal) {
        strategy = { gustar: 0, ciqual: 0.90, off: 0.10 }
      } else {
        strategy = { gustar: 0.20, ciqual: 0.70, off: 0.10 }
      }
      break

    case 'recipes':
      // Homemade recipes priority (Gustar)
      if (isSimpleMeal) {
        strategy = { gustar: 0.10, ciqual: 0.80, off: 0.10 }
      } else {
        strategy = { gustar: 0.70, ciqual: 0.20, off: 0.10 }
      }
      break

    case 'quick':
      // Quick/practical products priority (OFF)
      if (isSimpleMeal) {
        strategy = { gustar: 0.10, ciqual: 0.30, off: 0.60 }
      } else {
        strategy = { gustar: 0.30, ciqual: 0.30, off: 0.40 }
      }
      break

    case 'balanced':
    default:
      // Balanced mix based on meal type
      if (isSimpleMeal) {
        strategy = { gustar: 0.10, ciqual: 0.70, off: 0.20 }
      } else {
        strategy = { gustar: 0.40, ciqual: 0.45, off: 0.15 }
      }
      break
  }

  // Goal-based adjustments (only for main meals)
  if (isMainMeal && goal) {
    if (goal === 'weight_loss' || goal === 'lose') {
      // Weight loss: more CIQUAL for caloric precision
      strategy.ciqual = Math.min(0.80, strategy.ciqual + 0.10)
      strategy.off = Math.max(0.05, strategy.off - 0.10)
    } else if (goal === 'muscle_gain' || goal === 'muscle' || goal === 'gain') {
      // Muscle gain: more Gustar for protein-rich recipes
      strategy.gustar = Math.min(0.75, strategy.gustar + 0.10)
      strategy.off = Math.max(0.05, strategy.off - 0.10)
    }
  }

  return strategy
}

// ============= HELPERS =============

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

/**
 * Map user diet type to Gustar API diet parameter
 */
function mapDietToGustar(dietType?: string): DietaryPreference | undefined {
  if (!dietType) return undefined

  const dietMap: Record<string, DietaryPreference> = {
    vegetarian: 'vegetarian',
    vegan: 'vegan',
    pescatarian: 'pescatarian',
    keto: 'keto',
    paleo: 'paleo',
  }

  return dietMap[dietType.toLowerCase()]
}

/**
 * Calculate daily calorie targets based on repas plaisir settings
 */
function calculateDailyCalorieTargets(
  baseCalories: number,
  includeRepasPlaisir: boolean,
  repasPlaisirDay: number = 5
): { dailyTargets: number[]; repasPlaisirBonus: number } {
  const dailyTargets: number[] = []

  if (!includeRepasPlaisir) {
    for (let i = 0; i < 7; i++) {
      dailyTargets.push(baseCalories)
    }
    return { dailyTargets, repasPlaisirBonus: 0 }
  }

  const savingsPercentage = 0.10
  const savedPerDay = Math.round(baseCalories * savingsPercentage)
  const daysToSave = repasPlaisirDay
  const totalSavings = savedPerDay * daysToSave

  for (let i = 0; i < 7; i++) {
    if (i < repasPlaisirDay) {
      dailyTargets.push(baseCalories - savedPerDay)
    } else if (i === repasPlaisirDay) {
      dailyTargets.push(baseCalories + totalSavings)
    } else {
      dailyTargets.push(baseCalories)
    }
  }

  return { dailyTargets, repasPlaisirBonus: totalSavings }
}

// ============= FOOD SOURCES =============

/**
 * Get recipes from pre-enriched static JSON file (already in French)
 * This is the PRIMARY source for recipes - fast and reliable
 */
async function getStaticEnrichedRecipes(
  mealType: MealType,
  maxPrepTime?: number,
  limit: number = 5
): Promise<PlannedMealItem[]> {
  try {
    // Ensure recipes are loaded
    if (!hasStaticRecipes()) {
      await loadStaticRecipes()
    }

    // Filter recipes by meal type and prep time
    const filtered = filterStaticRecipes({
      mealType,
      maxPrepTime,
      limit: limit * 2, // Get more to allow filtering
    })

    if (filtered.length === 0) {
      console.log(`MealPlanAgent: No static recipes found for ${mealType}`)
      return []
    }

    // Shuffle to get variety
    const shuffled = [...filtered].sort(() => Math.random() - 0.5)

    console.log(`MealPlanAgent: Found ${shuffled.length} static recipes for ${mealType}`)

    return shuffled.slice(0, limit).map(recipe => ({
      id: generateId(),
      dayIndex: 0,
      mealType,
      name: recipe.titleFr, // Already in French!
      description: recipe.descriptionFr,
      prepTime: recipe.prepTime || 30,
      servings: recipe.servings || 2,
      nutrition: recipe.nutrition || { calories: 0, proteins: 0, carbs: 0, fats: 0 },
      ingredients: recipe.ingredientsFr.map(i => ({
        name: i.name,
        amount: `${i.amount} ${i.unit}`.trim(),
      })),
      instructions: recipe.instructionsFr,
      isValidated: false,
      source: 'gustar' as const,
      sourceRecipeId: recipe.id,
      imageUrl: recipe.imageUrl,
    }))
  } catch (error) {
    console.error('Static recipes error:', error)
    return []
  }
}

/**
 * Search recipes from Gustar.io API (FALLBACK only - if static recipes don't have enough)
 * Filters out unhealthy recipes (too sweet/salty) based on RAG criteria
 */
async function searchGustarRecipes(
  query: string,
  dietType?: string,
  maxPrepTime?: number,
  limit: number = 5
): Promise<PlannedMealItem[]> {
  try {
    if (!gustarRecipes.isConfigured()) {
      return []
    }

    // Request more recipes than needed to account for health filtering
    const result = await gustarRecipes.searchRecipes({
      query,
      diet: mapDietToGustar(dietType),
      maxPrepTime,
      limit: limit * 2, // Request double to filter out unhealthy ones
    })

    // Filter out unhealthy recipes (too sweet, too salty, excluded categories)
    const healthyRecipes = result.recipes.filter(recipe => {
      // Create a minimal recipe object for health check
      const recipeForCheck = {
        id: recipe.id,
        title: recipe.title,
        ingredients: recipe.ingredients,
        nutrition: recipe.nutrition,
        image: recipe.image, // This indicates it's a GustarRecipe
      }
      return shouldEnrichRecipe(recipeForCheck as any)
    })

    if (healthyRecipes.length < result.recipes.length) {
      console.log(`MealPlanAgent: Filtered ${result.recipes.length - healthyRecipes.length} unhealthy Gustar recipes`)
    }

    return healthyRecipes.slice(0, limit).map(recipe => ({
      id: generateId(),
      dayIndex: 0,
      mealType: 'lunch' as MealType,
      name: recipe.title,
      description: recipe.description,
      prepTime: recipe.prepTime || 30,
      servings: recipe.servings || 2,
      nutrition: recipe.nutrition || { calories: 0, proteins: 0, carbs: 0, fats: 0 },
      ingredients: recipe.ingredients.map(i => ({
        name: i.name,
        amount: `${i.amount} ${i.unit}`.trim(),
      })),
      instructions: recipe.instructions,
      isValidated: false,
      source: 'gustar' as const,
      sourceRecipeId: recipe.id,
      imageUrl: recipe.image,
    }))
  } catch (error) {
    console.error('Gustar search error:', error)
    return []
  }
}

// Portions réalistes par type d'aliment (en grammes)
const REALISTIC_PORTIONS: Record<string, { min: number; max: number; unit: string }> = {
  // Produits laitiers
  yaourt: { min: 125, max: 150, unit: 'g' },
  'fromage blanc': { min: 100, max: 150, unit: 'g' },
  fromage: { min: 30, max: 40, unit: 'g' },
  lait: { min: 200, max: 250, unit: 'ml' },
  // Fruits
  pomme: { min: 150, max: 200, unit: 'g' },
  banane: { min: 100, max: 150, unit: 'g' },
  compote: { min: 100, max: 130, unit: 'g' },
  fruit: { min: 100, max: 150, unit: 'g' },
  // Céréales et féculents
  cereales: { min: 30, max: 50, unit: 'g' },
  muesli: { min: 40, max: 60, unit: 'g' },
  pain: { min: 40, max: 80, unit: 'g' },
  tartine: { min: 30, max: 50, unit: 'g' },
  brioche: { min: 40, max: 70, unit: 'g' },
  croissant: { min: 45, max: 60, unit: 'g' },
  // Accompagnements
  confiture: { min: 20, max: 30, unit: 'g' },
  miel: { min: 15, max: 25, unit: 'g' },
  beurre: { min: 10, max: 15, unit: 'g' },
  // Par défaut
  default: { min: 100, max: 150, unit: 'g' },
}

/**
 * Get realistic portion for a food item
 */
function getRealisticPortion(foodName: string): { amount: number; unit: string } {
  const lowerName = foodName.toLowerCase()

  for (const [key, portion] of Object.entries(REALISTIC_PORTIONS)) {
    if (key !== 'default' && lowerName.includes(key)) {
      // Return a value in the middle of the range
      const amount = Math.round((portion.min + portion.max) / 2)
      return { amount, unit: portion.unit }
    }
  }

  return { amount: 100, unit: 'g' }
}

/**
 * Calculate nutrition for a specific portion size
 */
function scaleNutrition(
  nutrition: { calories: number; proteins: number; carbs: number; fats: number },
  baseSize: number,
  targetSize: number
): { calories: number; proteins: number; carbs: number; fats: number } {
  const factor = targetSize / baseSize
  return {
    calories: Math.round(nutrition.calories * factor),
    proteins: Math.round(nutrition.proteins * factor * 10) / 10,
    carbs: Math.round(nutrition.carbs * factor * 10) / 10,
    fats: Math.round(nutrition.fats * factor * 10) / 10,
  }
}

/**
 * Search foods from CIQUAL database only (OFF is too slow for plan generation)
 * Returns foods with REALISTIC portions (not just 100g)
 */
async function searchFoodDatabases(
  query: string,
  limit: number = 5
): Promise<PlannedMealItem[]> {
  try {
    // Use only CIQUAL for plan generation (faster and more reliable)
    const result = await searchFoods({
      query,
      limit,
      source: 'generic', // Use CIQUAL only - skip OFF to avoid timeouts during plan generation
    })

    return result.products.map(food => {
      // Determine actual source
      const actualSource = food.source === 'openfoodfacts' ? 'openfoodfacts' : 'ciqual'

      // Include brand in name for Open Food Facts products
      const displayName = actualSource === 'openfoodfacts' && food.brand
        ? `${food.name} - ${food.brand}`
        : food.name

      // Get realistic portion for this food type
      const portion = getRealisticPortion(food.name)
      const baseSize = food.servingSize || 100

      // Scale nutrition to the realistic portion
      const scaledNutrition = scaleNutrition(food.nutrition, baseSize, portion.amount)

      return {
        id: generateId(),
        dayIndex: 0,
        mealType: 'lunch' as MealType,
        name: displayName,
        description: food.brand || food.category || 'Produit alimentaire',
        prepTime: 5, // Quick prep for simple products
        servings: 1,
        nutrition: scaledNutrition,
        // For CIQUAL/OFF products, we don't have recipe ingredients/instructions
        // The product itself IS the ingredient with realistic portion
        ingredients: [{
          name: food.name,
          amount: `${portion.amount}${portion.unit}`,
          calories: scaledNutrition.calories,
        }],
        instructions: ['Prêt à consommer ou à préparer selon tes préférences.'],
        isValidated: false,
        source: actualSource as 'ciqual' | 'openfoodfacts',
        // Store base nutrition for later scaling
        _baseNutritionPer100g: food.nutrition,
      } as PlannedMealItem
    })
  } catch (error) {
    console.warn('Food database search error:', error)
    return []
  }
}

// Recettes basiques françaises (≤4 ingrédients, rapides)
// IMPORTANT: Petit-dej français = traditionnellement SUCRÉ (tartines confiture, céréales, viennoiseries)
// Collations = fruits, yaourts, compotes (pas de sandwichs salés)
const BASIQUE_QUERIES: Record<MealType, string[]> = {
  breakfast: ['tartine confiture', 'cereales lait', 'yaourt miel', 'pain beurre miel', 'brioche', 'croissant'],
  lunch: ['pates beurre', 'riz thon', 'omelette', 'croque monsieur', 'steak puree', 'poulet riz'],
  snack: ['pomme', 'banane', 'compote', 'yaourt fruits', 'fromage blanc miel', 'pain chocolat'],
  dinner: ['soupe legumes', 'omelette herbes', 'salade verte', 'oeufs coque', 'poisson citron'],
}

// Recettes élaborées françaises (+5 ingrédients)
const ELABORE_QUERIES: Record<MealType, string[]> = {
  breakfast: ['crepes maison', 'pancakes sirop', 'bowl flocons avoine fruits', 'pain perdu', 'granola maison'],
  lunch: ['poulet basquaise', 'boeuf bourguignon', 'blanquette veau', 'salade nicoise', 'hachis parmentier'],
  snack: ['smoothie fruits', 'banana bread', 'gateau yaourt', 'fruits salade'],
  dinner: ['ratatouille', 'gratin legumes', 'risotto champignons', 'curry legumes', 'tarte legumes'],
}

// ============= FRENCH BREAKFAST/SNACK FILTERS =============
// Le petit-déjeuner français est traditionnellement SUCRÉ (tartines, céréales, viennoiseries)
// Les collations sont des fruits, yaourts, compotes

// Mots-clés qui CONFIRMENT un petit-déjeuner/collation français sucré (whitelist)
const SWEET_BREAKFAST_KEYWORDS = [
  // Céréales et muesli
  'muesli', 'müsli', 'cereales', 'céréales', 'granola', 'flocons', 'porridge', 'avoine',
  // Viennoiseries
  'croissant', 'brioche', 'pain au chocolat', 'chocolatine', 'viennoiserie',
  // Tartines sucrées
  'tartine', 'confiture', 'miel', 'nutella', 'pate a tartiner', 'pâte à tartiner',
  // Crêpes et pancakes
  'crepe', 'crêpe', 'pancake', 'gaufre', 'pain perdu',
  // Fruits et compotes
  'fruit', 'compote', 'smoothie', 'jus',
  // Produits laitiers sucrés
  'yaourt', 'yogourt', 'fromage blanc', 'petit suisse',
  // Pâtisseries petit-déj
  'muffin', 'cake', 'banana bread', 'gateau', 'gâteau', 'biscuit',
]

// Mots-clés qui EXCLUENT un petit-déjeuner (plats salés non-français)
const SAVORY_BREAKFAST_KEYWORDS = [
  // Oeufs salés (sauf oeufs brouillés simples)
  'omelette', 'omelett', 'œuf', 'oeuf', 'egg',
  // Viandes et charcuteries
  'jambon', 'bacon', 'saucisse', 'chorizo', 'ham', 'wurst', 'schinken', 'salami',
  // Fromages salés (pas fromage blanc qui est sucré)
  'fromage de chèvre', 'chevre', 'feta', 'cheddar', 'käse', 'cheese',
  'au fromage', // "Petit Déjeuner au Fromage" = salé
  // Légumes salés
  'epinard', 'épinard', 'spinat', 'tomate', 'champignon', 'avocat',
  'legume', 'légume', 'rucola', 'roquette',
  // Condiments salés
  'ketchup', 'curry', 'moutarde',
  // Plats internationaux
  'burger', 'américain', 'americain', 'turc', 'anglais', 'english',
  'gröstl', 'turkish', 'american', 'vitalite', 'vitalité', 'energisant', 'énergisant',
  // Sandwichs
  'sandwich', 'toast salé', 'tartine salée',
  // Soupes
  'soupe', 'miso',
]

/**
 * Check if a meal is suitable for French breakfast (must be SWEET)
 * Returns true if the meal should be EXCLUDED (is savory/not French style)
 */
function isNotFrenchSweetBreakfast(name: string): boolean {
  const lowerName = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents for matching

  // First check: Is it explicitly sweet? (whitelist)
  const isSweet = SWEET_BREAKFAST_KEYWORDS.some(keyword => {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return lowerName.includes(normalizedKeyword)
  })

  // If it's sweet, it's OK for French breakfast
  if (isSweet) {
    return false // Don't exclude
  }

  // Second check: Does it contain savory keywords? (blacklist)
  const isSavory = SAVORY_BREAKFAST_KEYWORDS.some(keyword => {
    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return lowerName.includes(normalizedKeyword)
  })

  if (isSavory) {
    console.log(`MealPlanAgent: Excluded non-French breakfast: ${name}`)
    return true // Exclude
  }

  // If neither sweet nor savory keywords found, allow it (benefit of doubt)
  return false
}

/**
 * Get max ingredients based on complexity
 */
function getMaxIngredientsForComplexity(complexity: RecipeComplexity): number {
  switch (complexity) {
    case 'basique': return 4
    case 'elabore': return 15
    case 'mix': return 10
  }
}

/**
 * Get meal suggestions from all sources
 *
 * STRATEGY based on user's mealSourcePreference:
 * - 'fresh': Priorité CIQUAL (produits frais)
 * - 'recipes': Priorité Gustar (recettes maison)
 * - 'quick': Priorité OFF (produits rapides)
 * - 'balanced': Mix intelligent selon le type de repas
 *
 * Rules by meal type:
 * - Petit-déjeuner & Collation: produits simples, moins de recettes élaborées
 * - Déjeuner & Dîner: recettes possibles selon la préférence
 */
async function getMealSuggestions(
  mealType: MealType,
  preferences: WeeklyPlanPreferences,
  usedNames: string[],
  isWeekend: boolean
): Promise<PlannedMealItem[]> {
  const complexity = preferences.complexity || 'mix'
  const sourcePreference = preferences.mealSourcePreference || 'balanced'
  const goal = preferences.goal

  // Get source strategy based on user preferences
  const strategy = determineSourceStrategy(sourcePreference, mealType, goal)
  console.log(`MealPlanAgent: Source strategy for ${mealType} (pref: ${sourcePreference}):`, strategy)

  // Adjust prep time based on complexity and cooking level
  let maxPrepTime = isWeekend
    ? (preferences.cookingTimeWeekend || 45)
    : (preferences.cookingTimeWeekday || 20)

  // Basique recipes should be faster
  if (complexity === 'basique') {
    maxPrepTime = Math.min(maxPrepTime, 20)
  }

  // Adjust for cooking level
  if (preferences.cookingLevel === 'beginner') {
    maxPrepTime = Math.min(maxPrepTime, 25)
  }

  const allSuggestions: PlannedMealItem[] = []

  // Calculate how many items to fetch from each source (total ~15)
  const totalItems = 15
  const gustarLimit = Math.round(totalItems * strategy.gustar)
  const ciqualLimit = Math.round(totalItems * strategy.ciqual)
  // const offLimit = Math.round(totalItems * strategy.off) // OFF not used directly yet

  // ===== GUSTAR (Recettes enrichies) =====
  if (gustarLimit > 0) {
    const staticRecipes = await getStaticEnrichedRecipes(mealType, maxPrepTime, gustarLimit)
    allSuggestions.push(...staticRecipes)
    console.log(`MealPlanAgent: Got ${staticRecipes.length} Gustar recipes for ${mealType}`)

    // Fallback to Gustar API if not enough static recipes
    if (staticRecipes.length < gustarLimit / 2) {
      const queries = complexity === 'basique' ? BASIQUE_QUERIES[mealType] : ELABORE_QUERIES[mealType]
      const randomQuery = queries[Math.floor(Math.random() * queries.length)]
      const gustarResults = await searchGustarRecipes(
        randomQuery,
        preferences.dietType,
        maxPrepTime,
        Math.ceil(gustarLimit / 2)
      )
      allSuggestions.push(...gustarResults)
    }
  }

  // ===== CIQUAL (Produits frais) =====
  if (ciqualLimit > 0) {
    const queries = BASIQUE_QUERIES[mealType]
    const numQueries = Math.min(3, queries.length)
    const itemsPerQuery = Math.ceil(ciqualLimit / numQueries)

    for (let i = 0; i < numQueries; i++) {
      const query = queries[i]
      const foodResults = await searchFoodDatabases(query, itemsPerQuery)
      allSuggestions.push(...foodResults)
    }
    console.log(`MealPlanAgent: Got ${allSuggestions.length - (gustarLimit > 0 ? gustarLimit : 0)} CIQUAL products for ${mealType}`)
  }

  // ===== Fallback: ensure we have at least some suggestions =====
  if (allSuggestions.length < 3) {
    console.log(`MealPlanAgent: Not enough suggestions, adding fallback for ${mealType}`)
    const queries = BASIQUE_QUERIES[mealType]
    const randomQuery = queries[Math.floor(Math.random() * queries.length)]
    const fallbackResults = await searchFoodDatabases(randomQuery, 5)
    allSuggestions.push(...fallbackResults)
  }

  // Filter out already used meals and apply complexity filter
  const maxIngredients = getMaxIngredientsForComplexity(complexity)

  // Get nutrition criteria for scoring based on user goal
  const nutritionCriteria = getNutritionCriteria(goal)

  // Filter and score meals
  const filteredAndScored = allSuggestions
    .filter(meal => {
      // Filter by used names
      if (usedNames.includes(meal.name.toLowerCase())) return false

      // For basique, filter by ingredient count
      if (complexity === 'basique' && meal.ingredients.length > maxIngredients) return false

      // IMPORTANT: French tradition - breakfast and snacks should be SWEET
      // Use comprehensive filter to exclude savory/non-French breakfast items
      if ((mealType === 'breakfast' || mealType === 'snack') && isNotFrenchSweetBreakfast(meal.name)) {
        return false
      }

      // Filter by diet type (vegetarian, vegan, etc.)
      if (!matchesDiet(meal, preferences.dietType)) {
        console.log(`MealPlanAgent: Excluded ${meal.name} - doesn't match diet ${preferences.dietType}`)
        return false
      }

      // Filter by allergens
      if (containsAllergen(meal, preferences.allergies)) {
        console.log(`MealPlanAgent: Excluded ${meal.name} - contains allergen`)
        return false
      }

      return true
    })
    .map(meal => {
      // Score each meal based on nutritional fit for the user's goal
      const score = scoreMealForGoal(meal, nutritionCriteria, preferences.dailyCalories / 4)
      return { meal: { ...meal, mealType }, score }
    })
    // Sort by score (highest first) to prioritize meals that best match the user's goal
    .sort((a, b) => b.score - a.score)

  // Log top scoring meals for debugging
  if (filteredAndScored.length > 0) {
    const topMeals = filteredAndScored.slice(0, 3)
    console.log(`MealPlanAgent: Top ${mealType} meals for goal "${goal || 'maintain'}":`,
      topMeals.map(m => `${m.meal.name} (score: ${m.score})`).join(', '))
  }

  return filteredAndScored.map(item => item.meal)
}

/**
 * Generate meal with AI (fallback)
 */
async function generateMealWithAI(
  dayIndex: number,
  mealType: MealType,
  targetCalories: number,
  preferences: WeeklyPlanPreferences,
  usedTitles: string[],
  isCheatMeal: boolean
): Promise<PlannedMealItem | null> {
  try {
    const userProfile: Partial<UserProfile> = {
      dietType: preferences.dietType as UserProfile['dietType'],
      allergies: preferences.allergies,
    }

    // Convert dayIndex (0=Monday) to JS day (0=Sunday)
    const jsDay = dayIndex === 6 ? 0 : dayIndex + 1

    const result = await generatePlanMeal({
      day: jsDay,
      mealType,
      userProfile: userProfile as UserProfile,
      targetCalories,
      existingMeals: usedTitles.slice(-10),
      isCheatMeal,
    })

    if (result.success && result.recipe) {
      return {
        id: generateId(),
        dayIndex,
        mealType,
        name: result.recipe.title,
        description: result.recipe.description,
        prepTime: result.recipe.prepTime,
        servings: result.recipe.servings,
        nutrition: result.recipe.nutrition,
        ingredients: result.recipe.ingredients.map(i => ({
          name: i.name,
          amount: i.amount,
          calories: i.calories,
        })),
        instructions: result.recipe.instructions,
        isCheatMeal,
        isValidated: false,
        source: 'ai',
      }
    }

    return null
  } catch (error) {
    console.error('AI meal generation error:', error)
    return null
  }
}

// Fallback recipes by complexity (French staples) WITH realistic portions and nutrition
interface FallbackRecipe {
  name: string
  description: string
  prepTime: number
  ingredients: Array<{ name: string; amount: string; calories: number }>
  nutrition: { calories: number; proteins: number; carbs: number; fats: number }
}

const FALLBACK_BASIQUE: Record<MealType, FallbackRecipe[]> = {
  breakfast: [
    {
      name: 'Tartines beurre confiture',
      description: 'Petit-dejeuner classique francais',
      prepTime: 5,
      ingredients: [
        { name: 'Pain de campagne', amount: '60g (2 tranches)', calories: 150 },
        { name: 'Beurre', amount: '10g', calories: 75 },
        { name: 'Confiture', amount: '25g', calories: 65 },
      ],
      nutrition: { calories: 290, proteins: 5, carbs: 48, fats: 9 },
    },
    {
      name: 'Yaourt miel et fruits',
      description: 'Petit-dejeuner leger et equilibre',
      prepTime: 2,
      ingredients: [
        { name: 'Yaourt nature', amount: '125g', calories: 70 },
        { name: 'Miel', amount: '20g', calories: 65 },
        { name: 'Banane', amount: '100g', calories: 90 },
      ],
      nutrition: { calories: 225, proteins: 6, carbs: 45, fats: 2 },
    },
    {
      name: 'Bol de cereales au lait',
      description: 'Petit-dejeuner rapide',
      prepTime: 3,
      ingredients: [
        { name: 'Cereales petit-dejeuner', amount: '40g', calories: 150 },
        { name: 'Lait demi-ecreme', amount: '200ml', calories: 90 },
      ],
      nutrition: { calories: 240, proteins: 8, carbs: 42, fats: 5 },
    },
    {
      name: 'Pain grille et fromage blanc',
      description: 'Petit-dejeuner proteine',
      prepTime: 5,
      ingredients: [
        { name: 'Pain complet', amount: '50g (2 tranches)', calories: 120 },
        { name: 'Fromage blanc 0%', amount: '100g', calories: 45 },
        { name: 'Miel', amount: '15g', calories: 50 },
      ],
      nutrition: { calories: 215, proteins: 12, carbs: 38, fats: 2 },
    },
  ],
  lunch: [
    {
      name: 'Pates au beurre parmesan',
      description: 'Dejeuner express',
      prepTime: 15,
      ingredients: [
        { name: 'Pates', amount: '100g', calories: 350 },
        { name: 'Beurre', amount: '15g', calories: 110 },
        { name: 'Parmesan', amount: '20g', calories: 80 },
      ],
      nutrition: { calories: 540, proteins: 18, carbs: 70, fats: 20 },
    },
    {
      name: 'Riz au thon',
      description: 'Dejeuner simple',
      prepTime: 15,
      ingredients: [
        { name: 'Riz', amount: '80g', calories: 280 },
        { name: 'Thon au naturel', amount: '100g', calories: 110 },
        { name: 'Huile olive', amount: '10ml', calories: 90 },
      ],
      nutrition: { calories: 480, proteins: 28, carbs: 62, fats: 12 },
    },
    {
      name: 'Omelette nature',
      description: 'Dejeuner proteines',
      prepTime: 10,
      ingredients: [
        { name: 'Oeufs', amount: '3 oeufs (180g)', calories: 260 },
        { name: 'Beurre', amount: '10g', calories: 75 },
      ],
      nutrition: { calories: 335, proteins: 22, carbs: 2, fats: 27 },
    },
    {
      name: 'Croque-monsieur',
      description: 'Classique francais',
      prepTime: 10,
      ingredients: [
        { name: 'Pain de mie', amount: '4 tranches (80g)', calories: 200 },
        { name: 'Jambon', amount: '50g', calories: 60 },
        { name: 'Fromage emmental', amount: '40g', calories: 150 },
        { name: 'Beurre', amount: '10g', calories: 75 },
      ],
      nutrition: { calories: 485, proteins: 25, carbs: 38, fats: 25 },
    },
  ],
  snack: [
    {
      name: 'Pomme',
      description: 'Collation fruit',
      prepTime: 1,
      ingredients: [
        { name: 'Pomme', amount: '150g', calories: 80 },
      ],
      nutrition: { calories: 80, proteins: 0.5, carbs: 20, fats: 0 },
    },
    {
      name: 'Yaourt nature',
      description: 'Collation lactee',
      prepTime: 1,
      ingredients: [
        { name: 'Yaourt nature', amount: '125g', calories: 70 },
      ],
      nutrition: { calories: 70, proteins: 5, carbs: 6, fats: 2 },
    },
    {
      name: 'Fromage blanc',
      description: 'Collation proteinee',
      prepTime: 1,
      ingredients: [
        { name: 'Fromage blanc 0%', amount: '100g', calories: 45 },
      ],
      nutrition: { calories: 45, proteins: 8, carbs: 4, fats: 0 },
    },
  ],
  dinner: [
    {
      name: 'Soupe de legumes',
      description: 'Diner leger',
      prepTime: 15,
      ingredients: [
        { name: 'Legumes varies', amount: '200g', calories: 80 },
        { name: 'Bouillon', amount: '300ml', calories: 20 },
      ],
      nutrition: { calories: 100, proteins: 3, carbs: 18, fats: 1 },
    },
    {
      name: 'Omelette aux herbes',
      description: 'Diner rapide',
      prepTime: 10,
      ingredients: [
        { name: 'Oeufs', amount: '2 oeufs (120g)', calories: 170 },
        { name: 'Herbes fraiches', amount: '5g', calories: 2 },
        { name: 'Beurre', amount: '10g', calories: 75 },
      ],
      nutrition: { calories: 247, proteins: 14, carbs: 1, fats: 20 },
    },
    {
      name: 'Salade verte vinaigrette',
      description: 'Diner tres leger',
      prepTime: 5,
      ingredients: [
        { name: 'Salade verte', amount: '100g', calories: 15 },
        { name: 'Vinaigrette', amount: '15ml', calories: 70 },
      ],
      nutrition: { calories: 85, proteins: 1, carbs: 3, fats: 8 },
    },
  ],
}

const FALLBACK_ELABORE: Record<MealType, FallbackRecipe[]> = {
  breakfast: [
    {
      name: 'Oeufs brouilles aux herbes',
      description: 'Petit-dejeuner gourmand',
      prepTime: 15,
      ingredients: [
        { name: 'Oeufs', amount: '3 unites', calories: 210 },
        { name: 'Beurre', amount: '15g', calories: 110 },
        { name: 'Ciboulette', amount: '5g', calories: 2 },
        { name: 'Pain de campagne', amount: '60g', calories: 150 },
      ],
      nutrition: { calories: 472, proteins: 22, carbs: 30, fats: 28 },
    },
    {
      name: 'Crepes maison',
      description: 'Petit-dejeuner festif',
      prepTime: 25,
      ingredients: [
        { name: 'Farine', amount: '100g', calories: 340 },
        { name: 'Oeufs', amount: '2 unites', calories: 140 },
        { name: 'Lait', amount: '250ml', calories: 115 },
        { name: 'Sucre', amount: '30g', calories: 120 },
        { name: 'Beurre', amount: '20g', calories: 150 },
      ],
      nutrition: { calories: 430, proteins: 12, carbs: 55, fats: 18 },
    },
  ],
  lunch: [
    {
      name: 'Poulet roti aux legumes',
      description: 'Dejeuner complet',
      prepTime: 45,
      ingredients: [
        { name: 'Poulet (cuisse)', amount: '200g', calories: 260 },
        { name: 'Carottes', amount: '100g', calories: 40 },
        { name: 'Pommes de terre', amount: '150g', calories: 130 },
        { name: 'Oignons', amount: '50g', calories: 20 },
        { name: 'Huile olive', amount: '15ml', calories: 130 },
      ],
      nutrition: { calories: 580, proteins: 42, carbs: 38, fats: 28 },
    },
    {
      name: 'Salade nicoise',
      description: 'Dejeuner mediterraneen',
      prepTime: 20,
      ingredients: [
        { name: 'Thon (conserve)', amount: '120g', calories: 130 },
        { name: 'Oeufs durs', amount: '2 unites', calories: 140 },
        { name: 'Haricots verts', amount: '100g', calories: 30 },
        { name: 'Tomates', amount: '100g', calories: 20 },
        { name: 'Olives noires', amount: '30g', calories: 50 },
        { name: 'Huile olive', amount: '15ml', calories: 130 },
      ],
      nutrition: { calories: 500, proteins: 38, carbs: 12, fats: 32 },
    },
    {
      name: 'Hachis parmentier',
      description: 'Plat traditionnel',
      prepTime: 40,
      ingredients: [
        { name: 'Boeuf hache 5%', amount: '150g', calories: 180 },
        { name: 'Pommes de terre', amount: '200g', calories: 170 },
        { name: 'Oignons', amount: '50g', calories: 20 },
        { name: 'Creme fraiche', amount: '30g', calories: 90 },
        { name: 'Fromage rape', amount: '30g', calories: 120 },
      ],
      nutrition: { calories: 580, proteins: 35, carbs: 42, fats: 28 },
    },
  ],
  snack: [
    {
      name: 'Smoothie fruits',
      description: 'Collation vitaminee',
      prepTime: 5,
      ingredients: [
        { name: 'Banane', amount: '100g', calories: 90 },
        { name: 'Fruits rouges', amount: '100g', calories: 45 },
        { name: 'Yaourt nature', amount: '100g', calories: 55 },
        { name: 'Miel', amount: '15g', calories: 50 },
      ],
      nutrition: { calories: 240, proteins: 6, carbs: 48, fats: 3 },
    },
  ],
  dinner: [
    {
      name: 'Ratatouille',
      description: 'Plat provencal',
      prepTime: 35,
      ingredients: [
        { name: 'Courgettes', amount: '150g', calories: 25 },
        { name: 'Aubergines', amount: '150g', calories: 35 },
        { name: 'Poivrons', amount: '100g', calories: 25 },
        { name: 'Tomates', amount: '150g', calories: 30 },
        { name: 'Oignons', amount: '50g', calories: 20 },
        { name: 'Huile olive', amount: '20ml', calories: 175 },
      ],
      nutrition: { calories: 310, proteins: 6, carbs: 25, fats: 20 },
    },
    {
      name: 'Gratin dauphinois',
      description: 'Accompagnement savoyard',
      prepTime: 45,
      ingredients: [
        { name: 'Pommes de terre', amount: '300g', calories: 260 },
        { name: 'Creme fraiche', amount: '100g', calories: 300 },
        { name: 'Lait', amount: '100ml', calories: 45 },
        { name: 'Beurre', amount: '20g', calories: 150 },
      ],
      nutrition: { calories: 755, proteins: 12, carbs: 55, fats: 52 },
    },
    {
      name: 'Risotto aux champignons',
      description: 'Diner italien',
      prepTime: 30,
      ingredients: [
        { name: 'Riz arborio', amount: '100g', calories: 350 },
        { name: 'Champignons', amount: '150g', calories: 30 },
        { name: 'Oignon', amount: '50g', calories: 20 },
        { name: 'Parmesan', amount: '30g', calories: 120 },
        { name: 'Huile olive', amount: '15ml', calories: 130 },
      ],
      nutrition: { calories: 650, proteins: 18, carbs: 78, fats: 28 },
    },
  ],
}

/**
 * Get fallback meal when all sources fail
 */
function getFallbackMeal(
  dayIndex: number,
  mealType: MealType,
  targetCalories: number,
  isCheatMeal: boolean,
  complexity: RecipeComplexity = 'mix'
): PlannedMealItem {
  // For cheat meals, use special recipes
  if (isCheatMeal) {
    const cheatFallbacks: Record<MealType, { name: string; description: string }> = {
      breakfast: { name: 'Brunch gourmand', description: 'Repas plaisir' },
      lunch: { name: 'Burger Gourmand', description: 'Repas plaisir' },
      snack: { name: 'Part de gateau', description: 'Gourmandise' },
      dinner: { name: 'Pizza Quattro Formaggi', description: 'Pizza genereuse' },
    }
    const cheat = cheatFallbacks[mealType]
    const proteinRatio = mealType === 'snack' ? 0.15 : 0.25

    return {
      id: generateId(),
      dayIndex,
      mealType,
      name: cheat.name,
      description: cheat.description,
      prepTime: 30,
      servings: 1,
      nutrition: {
        calories: targetCalories,
        proteins: Math.round(targetCalories * proteinRatio / 4),
        carbs: Math.round(targetCalories * 0.45 / 4),
        fats: Math.round(targetCalories * 0.30 / 9),
      },
      ingredients: [],
      instructions: [],
      isCheatMeal: true,
      isValidated: false,
      source: 'ai',
    }
  }

  // Choose fallback list based on complexity
  let fallbackList: FallbackRecipe[]
  if (complexity === 'basique') {
    fallbackList = FALLBACK_BASIQUE[mealType]
  } else if (complexity === 'elabore') {
    fallbackList = FALLBACK_ELABORE[mealType]
  } else {
    // Mix: random choice
    fallbackList = Math.random() > 0.5 ? FALLBACK_BASIQUE[mealType] : FALLBACK_ELABORE[mealType]
  }

  // Pick random from list
  const fallback = fallbackList[Math.floor(Math.random() * fallbackList.length)]

  return {
    id: generateId(),
    dayIndex,
    mealType,
    name: fallback.name,
    description: fallback.description,
    prepTime: fallback.prepTime,
    servings: 1,
    nutrition: fallback.nutrition, // Use the pre-calculated nutrition from fallback
    ingredients: fallback.ingredients.map(ing => ({ name: ing.name, amount: ing.amount, calories: ing.calories })),
    instructions: [],
    isCheatMeal: false,
    isValidated: false,
    source: 'ai',
  }
}

// ============= MAIN AGENT =============

class MealPlanAgent {
  private apiKeyConfigured = false
  private staticRecipesLoaded = false

  /**
   * Initialize the agent with RapidAPI key
   */
  async init(rapidApiKey: string) {
    gustarRecipes.init(rapidApiKey)
    this.apiKeyConfigured = true

    // Pre-load static enriched recipes (already in French)
    try {
      await loadStaticRecipes()
      this.staticRecipesLoaded = true
      console.log('MealPlanAgent: Static enriched recipes loaded')
    } catch (error) {
      console.warn('MealPlanAgent: Failed to load static recipes:', error)
    }
  }

  /**
   * Check if agent is ready
   */
  isReady(): boolean {
    return this.apiKeyConfigured || this.staticRecipesLoaded
  }

  /**
   * Generate meal plan for specified duration (1, 3, or 7 days)
   */
  async generateWeekPlan(
    preferences: WeeklyPlanPreferences,
    onProgress?: (day: number, total: number) => void,
    duration: 1 | 3 | 7 = 7
  ): Promise<PlannedMealItem[]> {
    console.log('===========================================')
    console.log('🍽️ MEAL PLAN GENERATION STARTED')
    console.log('===========================================')
    console.log(`Duration: ${duration} days`)
    console.log('Daily calorie target:', preferences.dailyCalories)
    console.log('Repas plaisir enabled:', preferences.includeCheatMeal)
    console.log('Recipe complexity:', preferences.complexity || 'mix')
    console.log('Cooking level:', preferences.cookingLevel || 'intermediate')
    console.log('Meal source preference:', preferences.mealSourcePreference || 'balanced')
    console.log('Goal:', preferences.goal || 'maintain')
    console.log('Diet type:', preferences.dietType || 'none')
    console.log('Allergies:', preferences.allergies?.join(', ') || 'none')

    const meals: PlannedMealItem[] = []
    const usedRecipeNames: string[] = []
    const mealTypes: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

    // Only include repas plaisir for 7-day plans on Saturday
    const repasPlaisirDayIndex = duration === 7 ? 5 : -1

    const { dailyTargets } = calculateDailyCalorieTargets(
      preferences.dailyCalories,
      preferences.includeCheatMeal || false,
      repasPlaisirDayIndex
    )

    // Limit daily targets to requested duration
    const limitedTargets = dailyTargets.slice(0, duration)
    console.log(`Daily targets (${duration} days):`, limitedTargets)

    for (let dayIndex = 0; dayIndex < duration; dayIndex++) {
      const day = DAYS[dayIndex]
      const isWeekend = dayIndex >= 5 && duration === 7
      const dailyCalorieTarget = limitedTargets[dayIndex]
      const isRepasPlaisirDay = preferences.includeCheatMeal && dayIndex === repasPlaisirDayIndex

      console.log(`\nGenerating ${day} (${dailyCalorieTarget} kcal)...`)
      onProgress?.(dayIndex + 1, duration)

      const calorieDistribution: Record<MealType, number> = {
        breakfast: Math.round(dailyCalorieTarget * 0.25),
        lunch: Math.round(dailyCalorieTarget * 0.35),
        snack: Math.round(dailyCalorieTarget * 0.10),
        dinner: Math.round(dailyCalorieTarget * 0.30),
      }

      // Generate meals in parallel for this day
      const dayMealPromises = mealTypes.map(async (mealType) => {
        const targetCalories = calorieDistribution[mealType]
        const isRepasPlaisirMeal = isRepasPlaisirDay && mealType === 'dinner'

        let meal: PlannedMealItem | null = null

        // 1. Try existing sources (except for repas plaisir)
        if (!isRepasPlaisirMeal) {
          const suggestions = await getMealSuggestions(mealType, preferences, usedRecipeNames, isWeekend)

          if (suggestions.length > 0) {
            const targetMin = targetCalories * 0.8
            const targetMax = targetCalories * 1.2

            meal = suggestions.find(s => s.nutrition.calories >= targetMin && s.nutrition.calories <= targetMax) || null

            if (!meal && suggestions[0].nutrition.calories > 0) {
              // Scale closest match
              const closest = suggestions[0]
              const scaleFactor = targetCalories / closest.nutrition.calories
              meal = {
                ...closest,
                nutrition: {
                  calories: Math.round(closest.nutrition.calories * scaleFactor),
                  proteins: Math.round(closest.nutrition.proteins * scaleFactor),
                  carbs: Math.round(closest.nutrition.carbs * scaleFactor),
                  fats: Math.round(closest.nutrition.fats * scaleFactor),
                },
                description: closest.description ? `${closest.description} (portion ajustée)` : 'Portion ajustée',
              }
            }
          }
        }

        // 2. Fallback to AI
        if (!meal) {
          meal = await generateMealWithAI(
            dayIndex,
            mealType,
            targetCalories,
            preferences,
            usedRecipeNames,
            isRepasPlaisirMeal ?? false
          )
        }

        // 3. Ultimate fallback
        if (!meal) {
          meal = getFallbackMeal(dayIndex, mealType, targetCalories, isRepasPlaisirMeal ?? false, preferences.complexity)
        }

        meal.dayIndex = dayIndex
        meal.mealType = mealType

        return meal
      })

      const dayMeals = await Promise.all(dayMealPromises)

      for (const meal of dayMeals) {
        if (meal) {
          meals.push(meal)
          usedRecipeNames.push(meal.name.toLowerCase())
        }
      }
    }

    console.log('===========================================')
    console.log(`✅ MEAL PLAN COMPLETE: ${meals.length} meals generated`)
    console.log('===========================================')
    return meals
  }

  /**
   * Generate shopping list from meals
   */
  async generateShoppingListFromMeals(
    meals: PlannedMealItem[],
    servings: number = 2
  ): Promise<ShoppingList> {
    const mealSummary = meals
      .filter(m => m.nutrition.calories > 0)
      .map(m => ({
        title: m.name,
        ingredients: m.ingredients.map(i => `${i.amount} ${i.name}`),
      }))

    try {
      const result = await generateShoppingListAI({
        meals: mealSummary,
        servings,
      })

      if (result.success && result.list) {
        const items: ShoppingItem[] = []
        const categories = result.list.categories.map(cat => {
          const catItems: ShoppingItem[] = cat.items.map(item => ({
            id: generateId(),
            name: item.name,
            quantity: item.quantity,
            category: cat.name,
            estimatedPrice: item.estimatedPrice,
            isChecked: false,
          }))
          items.push(...catItems)
          return {
            name: cat.name,
            items: catItems,
            subtotal: cat.subtotal,
          }
        })

        return {
          id: generateId(),
          items,
          categories,
          total: result.list.total,
          tips: result.list.tips,
          generatedAt: new Date().toISOString(),
        }
      }
    } catch (error) {
      console.error('Shopping list generation error:', error)
    }

    // Fallback: simple list without prices
    const uniqueIngredients = new Map<string, { amount: string; count: number }>()

    meals.forEach(meal => {
      meal.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase().trim()
        if (uniqueIngredients.has(key)) {
          uniqueIngredients.get(key)!.count++
        } else {
          uniqueIngredients.set(key, { amount: ing.amount, count: 1 })
        }
      })
    })

    const items: ShoppingItem[] = Array.from(uniqueIngredients.entries()).map(
      ([name, { amount, count }]) => ({
        id: generateId(),
        name,
        quantity: count > 1 ? `${amount} (x${count})` : amount,
        category: 'Divers',
        estimatedPrice: 0,
        isChecked: false,
      })
    )

    return {
      id: generateId(),
      items,
      categories: [{ name: 'Divers', items, subtotal: 0 }],
      total: 0,
      tips: ['Les prix ne sont pas disponibles actuellement.'],
      generatedAt: new Date().toISOString(),
    }
  }
}

// Export singleton
export const mealPlanAgent = new MealPlanAgent()

export default mealPlanAgent
