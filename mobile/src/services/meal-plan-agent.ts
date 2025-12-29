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
import type { UserProfile, MealType } from '../types'
import type { PlannedMealItem, ShoppingList, ShoppingItem } from '../stores/meal-plan-store'

// ============= TYPES =============

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
}

// ============= CONSTANTS =============

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

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
 * Search recipes from Gustar.io API
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

    const result = await gustarRecipes.searchRecipes({
      query,
      diet: mapDietToGustar(dietType),
      maxPrepTime,
      limit,
    })

    return result.recipes.map(recipe => ({
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

/**
 * Search foods from CIQUAL database only (OFF is too slow for plan generation)
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

    return result.products.map(food => ({
      id: generateId(),
      dayIndex: 0,
      mealType: 'lunch' as MealType,
      name: food.name,
      description: food.brand || food.category,
      prepTime: 10,
      servings: 1,
      nutrition: {
        calories: food.nutrition.calories,
        proteins: food.nutrition.proteins,
        carbs: food.nutrition.carbs,
        fats: food.nutrition.fats,
      },
      ingredients: [],
      instructions: [],
      isValidated: false,
      source: 'gustar' as const,
    }))
  } catch (error) {
    console.warn('Food database search error:', error)
    return []
  }
}

/**
 * Get meal suggestions from all sources
 */
async function getMealSuggestions(
  mealType: MealType,
  preferences: WeeklyPlanPreferences,
  usedNames: string[],
  isWeekend: boolean
): Promise<PlannedMealItem[]> {
  const queries: Record<MealType, string[]> = {
    breakfast: ['petit déjeuner', 'oeufs', 'tartine', 'yaourt fruits', 'flocons avoine'],
    lunch: ['poulet légumes', 'salade composée', 'poisson grillé', 'pâtes', 'riz'],
    snack: ['fruit', 'yaourt', 'noix', 'fromage blanc'],
    dinner: ['soupe', 'salade', 'légumes grillés', 'poisson vapeur', 'omelette'],
  }

  const typeQueries = queries[mealType] || ['repas']
  const randomQuery = typeQueries[Math.floor(Math.random() * typeQueries.length)]

  const maxPrepTime = isWeekend
    ? (preferences.cookingTimeWeekend || 45)
    : (preferences.cookingTimeWeekday || 20)

  const allSuggestions: PlannedMealItem[] = []

  // 1. Try Gustar API first
  const gustarResults = await searchGustarRecipes(
    randomQuery,
    preferences.dietType,
    maxPrepTime,
    3
  )
  allSuggestions.push(...gustarResults)

  // 2. Try food databases (CIQUAL + OFF)
  const foodResults = await searchFoodDatabases(randomQuery, 3)
  allSuggestions.push(...foodResults)

  // Filter out already used meals
  return allSuggestions
    .filter(meal => !usedNames.includes(meal.name.toLowerCase()))
    .map(meal => ({ ...meal, mealType }))
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

/**
 * Get fallback meal when all sources fail
 */
function getFallbackMeal(
  dayIndex: number,
  mealType: MealType,
  targetCalories: number,
  isCheatMeal: boolean
): PlannedMealItem {
  const fallbacks: Record<MealType, { name: string; description: string }> = {
    breakfast: { name: 'Tartines beurre confiture', description: 'Petit-déjeuner classique' },
    lunch: { name: isCheatMeal ? 'Burger Gourmand' : 'Poulet grillé légumes', description: isCheatMeal ? 'Repas plaisir' : 'Déjeuner équilibré' },
    snack: { name: 'Yaourt et fruits', description: 'Collation légère' },
    dinner: { name: isCheatMeal ? 'Pizza Quattro Formaggi' : 'Soupe de légumes', description: isCheatMeal ? 'Pizza généreuse' : 'Dîner léger' },
  }

  const fallback = fallbacks[mealType]
  const proteinRatio = mealType === 'snack' ? 0.15 : 0.25

  return {
    id: generateId(),
    dayIndex,
    mealType,
    name: fallback.name,
    description: fallback.description,
    prepTime: mealType === 'snack' ? 5 : 25,
    servings: 1,
    nutrition: {
      calories: targetCalories,
      proteins: Math.round(targetCalories * proteinRatio / 4),
      carbs: Math.round(targetCalories * 0.45 / 4),
      fats: Math.round(targetCalories * 0.30 / 9),
    },
    ingredients: [],
    instructions: [],
    isCheatMeal,
    isValidated: false,
    source: 'ai',
  }
}

// ============= MAIN AGENT =============

class MealPlanAgent {
  private apiKeyConfigured = false

  /**
   * Initialize the agent with RapidAPI key
   */
  init(rapidApiKey: string) {
    gustarRecipes.init(rapidApiKey)
    this.apiKeyConfigured = true
  }

  /**
   * Check if agent is ready
   */
  isReady(): boolean {
    return this.apiKeyConfigured
  }

  /**
   * Generate meal plan for specified duration (1, 3, or 7 days)
   */
  async generateWeekPlan(
    preferences: WeeklyPlanPreferences,
    onProgress?: (day: number, total: number) => void,
    duration: 1 | 3 | 7 = 7
  ): Promise<PlannedMealItem[]> {
    console.log(`Generating ${duration}-day meal plan...`)
    console.log('Daily calorie target:', preferences.dailyCalories)
    console.log('Repas plaisir enabled:', preferences.includeCheatMeal)

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
          meal = getFallbackMeal(dayIndex, mealType, targetCalories, isRepasPlaisirMeal ?? false)
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

    console.log(`\nGenerated ${meals.length} meals total`)
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
