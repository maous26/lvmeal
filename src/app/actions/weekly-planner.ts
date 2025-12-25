'use server'

import OpenAI from 'openai'
import { MEAL_PLANNER_SYSTEM_PROMPT, MEAL_TYPE_GUIDELINES, SIMPLE_RECIPE_GUIDELINES } from '@/lib/ai/prompts'
import { getRandomTheme, getSeasonalTheme } from '@/lib/ai/themes'
import { generateUserProfileContext } from '@/lib/ai/user-context'
import type { UserProfile, FastingSchedule } from '@/types/user'

// OpenAI client (initialized lazily)
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

function isOpenAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}

function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?|\n?```/g, '').trim()
}

// Gustar API configuration
const RAPIDAPI_HOST = 'gustar-io-deutsche-rezepte.p.rapidapi.com'
const GUSTAR_BASE_URL = `https://${RAPIDAPI_HOST}`

function isGustarAvailable(): boolean {
  return !!process.env.RAPIDAPI_KEY
}

function getGustarHeaders(): HeadersInit {
  return {
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
    'Content-Type': 'application/json',
  }
}

export interface WeeklyPlanPreferences {
  dailyCalories: number
  proteins: number
  carbs: number
  fats: number
  dietType?: string
  allergies?: string[]
  goals?: string
  includeCheatMeal?: boolean
  cookingSkillLevel?: 'beginner' | 'intermediate' | 'advanced'
  cookingTimeWeekday?: number
  cookingTimeWeekend?: number
  fastingSchedule?: FastingSchedule
  weeklyBudget?: number
  pricePreference?: 'economy' | 'balanced' | 'premium'
}

export interface MealPlanDay {
  day: string
  meals: MealPlanMeal[]
  totalCalories: number
}

export interface MealPlanMeal {
  type: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  name: string
  description?: string
  calories: number
  proteins: number
  carbs: number
  fats: number
  prepTime: number
  imageUrl?: string | null
  recipeId?: string
  isCheatMeal?: boolean
  isFasting?: boolean
  source: 'gustar' | 'ciqual' | 'openfoodfacts' | 'ai' | 'user'
  ingredients?: { name: string; amount: number; unit: string }[]
}

export interface WeeklyPlan {
  days: MealPlanDay[]
  cheatMealDay?: number // Index of the day with cheat meal (0-6)
  cheatMealProposed?: boolean // Whether cheat meal has been proposed at day 5
}

export interface ConsumedMealsContext {
  todayCalories: number
  weekCalories: number
  averageDailyCalories: number
  recentMeals: { name: string; type: string; calories: number }[]
}

/**
 * Search recipes from Gustar API
 */
async function searchGustarRecipes(
  query: string,
  dietType?: string,
  maxPrepTime?: number,
  limit: number = 5
): Promise<MealPlanMeal[]> {
  if (!isGustarAvailable()) {
    return []
  }

  try {
    const searchParams = new URLSearchParams({
      text: query,
      limit: limit.toString(),
    })

    // Map diet types
    if (dietType) {
      const dietMap: Record<string, string> = {
        vegetarian: 'vegetarian',
        vegan: 'vegan',
        pescatarian: 'pescatarian',
        keto: 'keto',
        paleo: 'paleo',
      }
      if (dietMap[dietType]) {
        searchParams.append('diet', dietMap[dietType])
      }
    }

    if (maxPrepTime) {
      searchParams.append('maxPrepTime', maxPrepTime.toString())
    }

    const response = await fetch(`${GUSTAR_BASE_URL}/search_api?${searchParams}`, {
      method: 'GET',
      headers: getGustarHeaders(),
    })

    if (!response.ok) {
      console.error('Gustar API error:', response.status)
      return []
    }

    const data = await response.json()
    const results = data.results || data.recipes || []

    return results.map((recipe: Record<string, unknown>) => ({
      type: 'lunch' as const, // Will be overridden
      name: String(recipe.title || recipe.name || 'Recette'),
      description: recipe.description as string | undefined,
      calories: Number(recipe.nutrition?.calories || recipe.calories || 0),
      proteins: Number(recipe.nutrition?.proteins || recipe.proteins || 0),
      carbs: Number(recipe.nutrition?.carbs || recipe.carbs || 0),
      fats: Number(recipe.nutrition?.fats || recipe.fats || 0),
      prepTime: Number(recipe.prepTime || recipe.prep_time || 30),
      imageUrl: recipe.image as string | undefined,
      recipeId: String(recipe.id || recipe._id || ''),
      source: 'gustar' as const,
      ingredients: Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map((ing: unknown) => {
            if (typeof ing === 'string') return { name: ing, amount: 1, unit: '' }
            const i = ing as Record<string, unknown>
            return {
              name: String(i.name || i.ingredient || ''),
              amount: Number(i.amount || i.quantity || 1),
              unit: String(i.unit || ''),
            }
          })
        : [],
    }))
  } catch (error) {
    console.error('Error searching Gustar recipes:', error)
    return []
  }
}

/**
 * Search foods from Ciqual database
 */
async function searchCiqualFoods(
  query: string,
  limit: number = 5
): Promise<MealPlanMeal[]> {
  try {
    // Import Ciqual data dynamically (it's a large file)
    const ciqualData = await import('@/data/ciqual.json').then(m => m.default)

    const queryLower = query.toLowerCase()
    const matches = ciqualData
      .filter((food: { name: string }) => food.name.toLowerCase().includes(queryLower))
      .slice(0, limit)

    return matches.map((food: Record<string, unknown>) => ({
      type: 'lunch' as const,
      name: String(food.name),
      description: `${food.groupName || ''} - ${food.subGroupName || ''}`.trim() || undefined,
      calories: Number((food.nutrition as Record<string, number>)?.calories || 0),
      proteins: Number((food.nutrition as Record<string, number>)?.proteins || 0),
      carbs: Number((food.nutrition as Record<string, number>)?.carbs || 0),
      fats: Number((food.nutrition as Record<string, number>)?.fats || 0),
      prepTime: 10,
      source: 'ciqual' as const,
    }))
  } catch (error) {
    console.error('Error searching Ciqual:', error)
    return []
  }
}

/**
 * Search products from Open Food Facts
 */
async function searchOpenFoodFacts(
  query: string,
  limit: number = 5
): Promise<MealPlanMeal[]> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${limit}&countries_tags_fr=france`,
      { next: { revalidate: 3600 } }
    )

    if (!response.ok) {
      return []
    }

    const data = await response.json()
    const products = data.products || []

    return products.map((product: Record<string, unknown>) => {
      const nutriments = (product.nutriments || {}) as Record<string, number>
      return {
        type: 'lunch' as const,
        name: String(product.product_name_fr || product.product_name || 'Produit'),
        description: product.brands as string | undefined,
        calories: Math.round(nutriments['energy-kcal_100g'] || nutriments.energy_100g / 4.184 || 0),
        proteins: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
        carbs: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
        fats: Math.round((nutriments.fat_100g || 0) * 10) / 10,
        prepTime: 5,
        imageUrl: product.image_front_small_url as string | undefined,
        source: 'openfoodfacts' as const,
      }
    }).filter((p: MealPlanMeal) => p.calories > 0)
  } catch (error) {
    console.error('Error searching Open Food Facts:', error)
    return []
  }
}

/**
 * Get meal suggestions based on type and preferences
 */
async function getMealSuggestions(
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner',
  preferences: WeeklyPlanPreferences,
  usedNames: string[],
  isWeekend: boolean
): Promise<MealPlanMeal[]> {
  const queries: Record<string, string[]> = {
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

  const allSuggestions: MealPlanMeal[] = []

  // 1. First try Gustar API
  const gustarResults = await searchGustarRecipes(randomQuery, preferences.dietType, maxPrepTime, 3)
  allSuggestions.push(...gustarResults)

  // 2. Then Ciqual
  const ciqualResults = await searchCiqualFoods(randomQuery, 3)
  allSuggestions.push(...ciqualResults)

  // 3. Then Open Food Facts
  const offResults = await searchOpenFoodFacts(randomQuery, 2)
  allSuggestions.push(...offResults)

  // Filter out already used meals
  return allSuggestions
    .filter(meal => !usedNames.includes(meal.name.toLowerCase()))
    .map(meal => ({ ...meal, type: mealType }))
}

/**
 * Generate a meal using AI (fallback when no good matches found)
 */
async function generateMealWithAI(
  day: string,
  mealType: { type: 'breakfast' | 'lunch' | 'snack' | 'dinner'; name: string; calorieTarget: number },
  preferences: WeeklyPlanPreferences,
  profileContext: string,
  usedTitles: string[],
  theme: string,
  isWeekend: boolean,
  isCheatMeal: boolean
): Promise<MealPlanMeal> {
  if (!isOpenAIAvailable()) {
    return getFallbackMeal(mealType, isCheatMeal)
  }

  const client = getOpenAIClient()
  const maxCookingTime = isWeekend
    ? (preferences.cookingTimeWeekend || 45)
    : (preferences.cookingTimeWeekday || 20)

  const mealGuideline = isCheatMeal
    ? MEAL_TYPE_GUIDELINES.cheat_meal
    : MEAL_TYPE_GUIDELINES[mealType.type] || ''

  const prompt = `${SIMPLE_RECIPE_GUIDELINES}

${mealGuideline}

${profileContext}

Thème du jour: ${theme}

Génère une recette de ${mealType.name} pour ${day}${isCheatMeal ? ' (CHEAT MEAL - repas plaisir!)' : ''}.

CONTRAINTES:
- Calories cibles: ${Math.round(mealType.calorieTarget)} kcal
- Type de régime: ${preferences.dietType || 'équilibré'}
- Allergies à éviter: ${preferences.allergies?.join(', ') || 'aucune'}
- À ÉVITER (déjà au menu): ${usedTitles.slice(-10).join(', ') || 'aucun'}
- Temps de préparation MAX: ${maxCookingTime} minutes

Réponds UNIQUEMENT en JSON:
{
  "title": "Nom du plat",
  "description": "Description en 1 phrase",
  "calories": ${Math.round(mealType.calorieTarget)},
  "proteins": 25,
  "carbs": 35,
  "fats": 12,
  "prepTime": ${Math.min(maxCookingTime, 25)},
  "ingredients": [
    { "name": "ingrédient", "amount": 100, "unit": "g" }
  ]
}`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = response.choices[0]?.message?.content
    if (!textContent) {
      throw new Error('No response from AI')
    }

    const jsonStr = cleanJsonResponse(textContent)
    const recipe = JSON.parse(jsonStr)

    return {
      type: mealType.type,
      name: recipe.title,
      description: recipe.description,
      calories: recipe.calories,
      proteins: recipe.proteins,
      carbs: recipe.carbs,
      fats: recipe.fats,
      prepTime: recipe.prepTime,
      isCheatMeal,
      source: 'ai',
      ingredients: recipe.ingredients,
    }
  } catch (error) {
    console.error(`Error generating meal with AI for ${day} ${mealType.type}:`, error)
    return getFallbackMeal(mealType, isCheatMeal)
  }
}

function getFallbackMeal(
  mealType: { type: 'breakfast' | 'lunch' | 'snack' | 'dinner'; calorieTarget: number },
  isCheatMeal: boolean
): MealPlanMeal {
  const fallbacks: Record<string, MealPlanMeal> = {
    breakfast: {
      type: 'breakfast',
      name: 'Tartines au beurre et confiture',
      description: 'Petit-déjeuner français classique',
      calories: Math.round(mealType.calorieTarget),
      proteins: 8,
      carbs: 50,
      fats: 12,
      prepTime: 5,
      isCheatMeal: false,
      source: 'ai',
    },
    lunch: {
      type: 'lunch',
      name: isCheatMeal ? 'Burger Gourmand Maison' : 'Poulet grillé et légumes',
      description: isCheatMeal ? 'Le burger réconfort par excellence' : 'Déjeuner équilibré',
      calories: Math.round(mealType.calorieTarget),
      proteins: isCheatMeal ? 40 : 35,
      carbs: isCheatMeal ? 80 : 40,
      fats: isCheatMeal ? 50 : 15,
      prepTime: 25,
      isCheatMeal,
      source: 'ai',
    },
    snack: {
      type: 'snack',
      name: 'Yaourt et fruits',
      description: 'Collation légère',
      calories: Math.round(mealType.calorieTarget),
      proteins: 8,
      carbs: 20,
      fats: 3,
      prepTime: 2,
      isCheatMeal: false,
      source: 'ai',
    },
    dinner: {
      type: 'dinner',
      name: isCheatMeal ? 'Pizza Quattro Formaggi' : 'Soupe de légumes',
      description: isCheatMeal ? 'Une pizza généreuse aux quatre fromages' : 'Dîner léger et réconfortant',
      calories: Math.round(mealType.calorieTarget),
      proteins: isCheatMeal ? 30 : 8,
      carbs: isCheatMeal ? 70 : 25,
      fats: isCheatMeal ? 35 : 8,
      prepTime: isCheatMeal ? 30 : 20,
      isCheatMeal,
      source: 'ai',
    },
  }
  return fallbacks[mealType.type]
}

/**
 * Generate a complete 7-day meal plan
 * Priority: Gustar API > Ciqual > Open Food Facts > AI generation
 */
export async function generateWeeklyPlanWithDetails(
  preferences: WeeklyPlanPreferences,
  userProfile?: UserProfile,
  consumedContext?: ConsumedMealsContext
): Promise<{ success: boolean; plan?: WeeklyPlan; error?: string }> {
  try {
    console.log('Generating weekly meal plan...')
    console.log('Sources available:', {
      gustar: isGustarAvailable(),
      openai: isOpenAIAvailable(),
    })

    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    const weekPlan: MealPlanDay[] = []
    const usedRecipeNames: string[] = []

    // Add recently consumed meals to avoid repetition
    if (consumedContext?.recentMeals) {
      usedRecipeNames.push(...consumedContext.recentMeals.map(m => m.name.toLowerCase()))
    }

    const profileContext = userProfile ? generateUserProfileContext(userProfile) : ''

    // Calculate remaining calories if user has already eaten today
    let adjustedDailyCalories = preferences.dailyCalories
    if (consumedContext?.todayCalories) {
      const remaining = preferences.dailyCalories - consumedContext.todayCalories
      if (remaining > 0) {
        console.log(`User has consumed ${consumedContext.todayCalories} kcal today, ${remaining} remaining`)
      }
    }

    // Determine Cheat Meal day (will be proposed at day 5)
    let cheatMealDayIndex = -1
    let cheatMealType: 'lunch' | 'dinner' = 'dinner'

    if (preferences.includeCheatMeal) {
      // Default to Saturday or Sunday
      cheatMealDayIndex = 5 + Math.floor(Math.random() * 2) // 5 or 6
      cheatMealType = Math.random() > 0.5 ? 'dinner' : 'lunch'
    }

    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const dayMeals: MealPlanMeal[] = []
      const isWeekend = i >= 5

      const dailyTheme = Math.random() > 0.5 ? getRandomTheme() : getSeasonalTheme()

      const mealTypes = [
        { type: 'breakfast' as const, name: 'Petit-déjeuner', calorieTarget: adjustedDailyCalories * 0.25 },
        { type: 'lunch' as const, name: 'Déjeuner', calorieTarget: adjustedDailyCalories * 0.35 },
        { type: 'snack' as const, name: 'Collation', calorieTarget: adjustedDailyCalories * 0.10 },
        { type: 'dinner' as const, name: 'Dîner', calorieTarget: adjustedDailyCalories * 0.30 },
      ]

      for (const mealType of mealTypes) {
        const isCheatMeal = i === cheatMealDayIndex && mealType.type === cheatMealType

        // Check fasting window for breakfast
        let skipMeal = false
        if (preferences.fastingSchedule && preferences.fastingSchedule.type !== 'none') {
          const windowStart = parseInt(preferences.fastingSchedule.eatingWindowStart || '12')
          if (mealType.type === 'breakfast' && windowStart >= 12) {
            skipMeal = true
          }
        }

        if (skipMeal) {
          dayMeals.push({
            type: mealType.type,
            name: 'Jeûne - Eau/Thé/Café',
            description: 'Période de jeûne - hydratation uniquement',
            calories: 0,
            proteins: 0,
            carbs: 0,
            fats: 0,
            prepTime: 0,
            isFasting: true,
            source: 'ai',
          })
          continue
        }

        let meal: MealPlanMeal | null = null

        // Skip cheat meal for now if it's before day 5 (will be proposed later)
        if (!isCheatMeal) {
          // 1. Try to find meals from existing sources
          const suggestions = await getMealSuggestions(mealType.type, preferences, usedRecipeNames, isWeekend)

          if (suggestions.length > 0) {
            // Find a meal that fits the calorie target (±30%)
            const targetMin = mealType.calorieTarget * 0.7
            const targetMax = mealType.calorieTarget * 1.3

            meal = suggestions.find(s => s.calories >= targetMin && s.calories <= targetMax)

            if (!meal && suggestions.length > 0) {
              // If no exact match, take the first one and adjust portion description
              meal = { ...suggestions[0] }
            }
          }
        }

        // 2. If no suitable meal found, generate with AI
        if (!meal) {
          meal = await generateMealWithAI(
            day,
            mealType,
            preferences,
            profileContext,
            usedRecipeNames,
            dailyTheme,
            isWeekend,
            isCheatMeal
          )
        }

        usedRecipeNames.push(meal.name.toLowerCase())
        dayMeals.push(meal)
      }

      const totalCalories = dayMeals.reduce((sum, m) => sum + (m?.calories || 0), 0)

      weekPlan.push({
        day,
        meals: dayMeals,
        totalCalories,
      })
    }

    console.log('Weekly plan generated successfully!')

    return {
      success: true,
      plan: {
        days: weekPlan,
        cheatMealDay: cheatMealDayIndex,
        cheatMealProposed: false,
      },
    }
  } catch (error) {
    console.error('Error generating weekly plan:', error)
    return { success: false, error: 'Impossible de générer le plan hebdomadaire' }
  }
}

/**
 * Propose cheat meal modification for day 6 or 7
 * Called when user reaches day 5
 */
export async function proposeCheatMealDay(
  currentPlan: WeeklyPlan,
  preferences: WeeklyPlanPreferences,
  preferredDay: 5 | 6 // Samedi (5) ou Dimanche (6)
): Promise<{ success: boolean; updatedPlan?: WeeklyPlan; error?: string }> {
  try {
    if (!isOpenAIAvailable()) {
      return { success: false, error: "L'IA n'est pas disponible" }
    }

    const client = getOpenAIClient()
    const day = preferredDay === 5 ? 'Samedi' : 'Dimanche'

    const prompt = `Génère un REPAS PLAISIR (cheat meal) gourmand mais pas trop excessif.

CONTRAINTES:
- Calories max: 1200 kcal
- Doit être appétissant et réconfortant
- Type de régime de base: ${preferences.dietType || 'omnivore'}
- Allergies à éviter: ${preferences.allergies?.join(', ') || 'aucune'}

Réponds UNIQUEMENT en JSON:
{
  "title": "Nom fun du plat",
  "description": "Description gourmande",
  "calories": 900,
  "proteins": 35,
  "carbs": 80,
  "fats": 45,
  "prepTime": 30,
  "mealType": "dinner"
}`

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      temperature: 0.6,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = response.choices[0]?.message?.content
    if (!textContent) {
      throw new Error('No response from AI')
    }

    const jsonStr = cleanJsonResponse(textContent)
    const cheatMeal = JSON.parse(jsonStr)

    // Update the plan with the cheat meal
    const updatedDays = currentPlan.days.map((dayPlan, index) => {
      if (index !== preferredDay) return dayPlan

      const mealType = cheatMeal.mealType === 'lunch' ? 'lunch' : 'dinner'
      const updatedMeals = dayPlan.meals.map(meal => {
        if (meal.type === mealType) {
          return {
            ...meal,
            name: cheatMeal.title,
            description: cheatMeal.description,
            calories: cheatMeal.calories,
            proteins: cheatMeal.proteins,
            carbs: cheatMeal.carbs,
            fats: cheatMeal.fats,
            prepTime: cheatMeal.prepTime,
            isCheatMeal: true,
            source: 'ai' as const,
          }
        }
        return meal
      })

      return {
        ...dayPlan,
        meals: updatedMeals,
        totalCalories: updatedMeals.reduce((sum, m) => sum + m.calories, 0),
      }
    })

    return {
      success: true,
      updatedPlan: {
        ...currentPlan,
        days: updatedDays,
        cheatMealDay: preferredDay,
        cheatMealProposed: true,
      },
    }
  } catch (error) {
    console.error('Error proposing cheat meal:', error)
    return { success: false, error: 'Impossible de proposer le repas plaisir' }
  }
}

/**
 * Regenerate a specific day in the plan
 */
export async function regenerateDayPlan(
  dayIndex: number,
  preferences: WeeklyPlanPreferences,
  existingPlan: WeeklyPlan,
  userProfile?: UserProfile
): Promise<{ success: boolean; dayPlan?: MealPlanDay; error?: string }> {
  try {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    const day = days[dayIndex]

    const profileContext = userProfile ? generateUserProfileContext(userProfile) : ''

    // Collect titles from other days to avoid duplicates
    const usedRecipeNames: string[] = []
    existingPlan.days.forEach((d, idx) => {
      if (idx !== dayIndex) {
        d.meals.forEach((m) => {
          if (m.name) usedRecipeNames.push(m.name.toLowerCase())
        })
      }
    })

    const dayMeals: MealPlanMeal[] = []
    const isWeekend = dayIndex >= 5
    const theme = getRandomTheme()

    const mealTypes = [
      { type: 'breakfast' as const, name: 'Petit-déjeuner', calorieTarget: preferences.dailyCalories * 0.25 },
      { type: 'lunch' as const, name: 'Déjeuner', calorieTarget: preferences.dailyCalories * 0.35 },
      { type: 'snack' as const, name: 'Collation', calorieTarget: preferences.dailyCalories * 0.10 },
      { type: 'dinner' as const, name: 'Dîner', calorieTarget: preferences.dailyCalories * 0.30 },
    ]

    for (const mealType of mealTypes) {
      // Check fasting
      let skipMeal = false
      if (preferences.fastingSchedule?.type && preferences.fastingSchedule.type !== 'none') {
        const windowStart = parseInt(preferences.fastingSchedule.eatingWindowStart || '12')
        if (mealType.type === 'breakfast' && windowStart >= 12) {
          skipMeal = true
        }
      }

      if (skipMeal) {
        dayMeals.push({
          type: mealType.type,
          name: 'Jeûne - Eau/Thé/Café',
          description: 'Période de jeûne - hydratation uniquement',
          calories: 0,
          proteins: 0,
          carbs: 0,
          fats: 0,
          prepTime: 0,
          isFasting: true,
          source: 'ai',
        })
        continue
      }

      // Try existing sources first
      const suggestions = await getMealSuggestions(mealType.type, preferences, usedRecipeNames, isWeekend)
      let meal: MealPlanMeal | null = null

      if (suggestions.length > 0) {
        const targetMin = mealType.calorieTarget * 0.7
        const targetMax = mealType.calorieTarget * 1.3
        meal = suggestions.find(s => s.calories >= targetMin && s.calories <= targetMax) || suggestions[0]
      }

      if (!meal) {
        meal = await generateMealWithAI(
          day,
          mealType,
          preferences,
          profileContext,
          usedRecipeNames,
          theme,
          isWeekend,
          false
        )
      }

      usedRecipeNames.push(meal.name.toLowerCase())
      dayMeals.push(meal)
    }

    const totalCalories = dayMeals.reduce((sum, m) => sum + (m?.calories || 0), 0)

    return {
      success: true,
      dayPlan: {
        day,
        meals: dayMeals,
        totalCalories,
      },
    }
  } catch (error) {
    console.error('Error regenerating day:', error)
    return { success: false, error: 'Impossible de régénérer le jour' }
  }
}

/**
 * Generate shopping list from weekly plan
 */
export async function generateShoppingList(weeklyPlan: WeeklyPlan, budget?: number) {
  try {
    if (!isOpenAIAvailable()) {
      return {
        success: false,
        error: "L'IA n'est pas configurée.",
      }
    }

    const client = getOpenAIClient()

    // Collect all meal names and ingredients
    const allMeals: string[] = []
    const allIngredients: string[] = []

    weeklyPlan.days.forEach((day) => {
      day.meals.forEach((meal) => {
        if (meal.name && !meal.isFasting) {
          allMeals.push(`- ${meal.name} (${meal.calories} kcal, P:${meal.proteins}g)`)
          if (meal.ingredients) {
            meal.ingredients.forEach(ing => {
              allIngredients.push(`${ing.amount} ${ing.unit} ${ing.name}`)
            })
          }
        }
      })
    })

    const budgetContext = budget ? `Budget hebdomadaire maximum: ${budget}€. Respecte ce budget!` : ''

    const ingredientsContext = allIngredients.length > 0
      ? `\n\nINGRÉDIENTS DÉJÀ IDENTIFIÉS:\n${allIngredients.join('\n')}`
      : ''

    const prompt = `Tu es un expert en courses alimentaires en France. Génère une liste de courses COMPLÈTE et RÉALISTE.

REPAS DE LA SEMAINE (${allMeals.length} repas):
${allMeals.join('\n')}
${ingredientsContext}

${budgetContext}

INSTRUCTIONS:
1. Analyse chaque repas et détermine TOUS les ingrédients nécessaires
2. Consolide les ingrédients similaires
3. Estime les quantités réalistes pour une personne sur la semaine
4. Utilise les prix moyens en France (supermarchés classiques)
5. Organise par rayon de supermarché

Réponds UNIQUEMENT avec ce JSON:
{
  "categories": [
    {
      "name": "Fruits & Légumes",
      "items": [
        { "name": "Tomates grappe", "quantity": "1 kg", "priceEstimate": 3.50 }
      ],
      "subtotal": 6.50
    }
  ],
  "totalEstimate": 75.50,
  "savingsTips": [
    "Achetez les légumes de saison pour économiser"
  ]
}`

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = response.choices[0]?.message?.content
    if (!textContent) {
      throw new Error('No response from AI')
    }

    const jsonStr = cleanJsonResponse(textContent)
    let shoppingList

    try {
      shoppingList = JSON.parse(jsonStr)
    } catch {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        shoppingList = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Could not parse shopping list JSON')
      }
    }

    // Recalculate totals
    let total = 0
    shoppingList.categories?.forEach((cat: { items?: { priceEstimate?: number }[]; subtotal?: number }) => {
      let catTotal = 0
      if (cat.items && Array.isArray(cat.items)) {
        cat.items.forEach((item) => {
          catTotal += item.priceEstimate || 0
        })
      }
      cat.subtotal = Math.round(catTotal * 100) / 100
      total += catTotal
    })
    shoppingList.totalEstimate = Math.round(total * 100) / 100

    return { success: true, shoppingList }
  } catch (error) {
    console.error('Error generating shopping list:', error)
    return { success: false, error: 'Impossible de générer la liste de courses' }
  }
}

/**
 * Generate detailed recipe for a meal
 */
export async function generateRecipeDetails(
  meal: {
    name: string
    description?: string
    calories: number
    proteins: number
    carbs: number
    fats: number
    prepTime: number
    type: string
    ingredients?: { name: string; amount: number; unit: string }[]
  },
  userProfile?: UserProfile
) {
  // If meal already has ingredients, return them formatted
  if (meal.ingredients && meal.ingredients.length > 0) {
    return {
      success: true,
      recipe: {
        ingredients: meal.ingredients.map(ing => ({
          name: ing.name,
          quantity: String(ing.amount),
          unit: ing.unit,
        })),
        instructions: [
          'Préparer tous les ingrédients',
          'Suivre les étapes de préparation habituelles',
          'Servir et déguster',
        ],
        tips: ['Recette basée sur les ingrédients fournis'],
      },
    }
  }

  try {
    if (!isOpenAIAvailable()) {
      return {
        success: false,
        error: "L'IA n'est pas configurée.",
      }
    }

    const client = getOpenAIClient()
    const profileContext = userProfile ? generateUserProfileContext(userProfile) : ''

    const mealTypeLabels: Record<string, string> = {
      breakfast: 'petit-déjeuner',
      lunch: 'déjeuner',
      snack: 'collation',
      dinner: 'dîner',
    }

    const prompt = `Tu es un chef cuisinier français expert. Crée une recette COMPLÈTE et DÉTAILLÉE.

${profileContext}

PLAT À PRÉPARER: "${meal.name}"
Description: ${meal.description || 'Plat savoureux et équilibré'}
Type de repas: ${mealTypeLabels[meal.type] || meal.type}
Temps de préparation: ${meal.prepTime} minutes maximum

OBJECTIFS NUTRITIONNELS (pour 1 personne):
- Calories: environ ${meal.calories} kcal
- Protéines: environ ${meal.proteins}g
- Glucides: environ ${meal.carbs}g
- Lipides: environ ${meal.fats}g

INSTRUCTIONS:
1. Liste TOUS les ingrédients avec quantités PRÉCISES
2. Minimum 5-8 ingrédients
3. Instructions DÉTAILLÉES étape par étape (minimum 5 étapes)
4. Ajoute 2-3 astuces de chef

Réponds UNIQUEMENT avec ce JSON:
{
  "ingredients": [
    { "name": "Poulet (filet)", "quantity": "150", "unit": "g" }
  ],
  "instructions": [
    "Étape 1...",
    "Étape 2..."
  ],
  "tips": [
    "Astuce 1..."
  ]
}`

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = response.choices[0]?.message?.content
    if (!textContent) {
      throw new Error('No response from AI')
    }

    const jsonStr = cleanJsonResponse(textContent)
    const recipe = JSON.parse(jsonStr)

    if (!recipe.ingredients || recipe.ingredients.length < 3) {
      throw new Error('Recette incomplète')
    }
    if (!recipe.instructions || recipe.instructions.length < 3) {
      throw new Error('Instructions incomplètes')
    }

    return { success: true, recipe }
  } catch (error) {
    console.error('Error generating recipe details:', error)
    return { success: false, error: 'Impossible de générer les détails de la recette' }
  }
}
