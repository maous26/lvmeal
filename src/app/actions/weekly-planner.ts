'use server'

import OpenAI from 'openai'
import { z } from 'zod'
import { MEAL_TYPE_GUIDELINES, SIMPLE_RECIPE_GUIDELINES } from '@/lib/ai/prompts'
import { getRandomTheme, getSeasonalTheme } from '@/lib/ai/themes'
import { generateUserProfileContext } from '@/lib/ai/user-context'
import type { UserProfile, FastingSchedule, MealSourcePreference } from '@/types/user'

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

function extractFirstJsonValue(text: string): string | null {
  const cleaned = cleanJsonResponse(text)
  // Fast path
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return cleaned
  }

  const firstBrace = cleaned.indexOf('{')
  const firstBracket = cleaned.indexOf('[')
  const start =
    firstBrace === -1 ? firstBracket :
    firstBracket === -1 ? firstBrace :
    Math.min(firstBrace, firstBracket)

  if (start === -1) return null

  const openChar = cleaned[start]
  const closeChar = openChar === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === openChar) depth++
    if (ch === closeChar) depth--

    if (depth === 0) {
      return cleaned.slice(start, i + 1)
    }
  }

  return null
}

const zCoercedNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => {
      if (typeof v === 'string' && v.trim() !== '') return Number(v)
      return v
    },
    z.number().finite().min(min).max(max)
  )

const AiIngredientSchema = z.object({
  name: z.string().min(1),
  amount: zCoercedNumber(0, 5000),
  unit: z.string().optional().default(''),
})

const AiMealRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  calories: zCoercedNumber(0, 6000),
  proteins: zCoercedNumber(0, 400),
  carbs: zCoercedNumber(0, 600),
  fats: zCoercedNumber(0, 300),
  prepTime: zCoercedNumber(0, 240),
  ingredients: z.array(AiIngredientSchema).optional().default([]),
}).passthrough()

const AiCheatMealSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  calories: zCoercedNumber(0, 6000),
  proteins: zCoercedNumber(0, 400),
  carbs: zCoercedNumber(0, 600),
  fats: zCoercedNumber(0, 300),
  prepTime: zCoercedNumber(0, 240),
  mealType: z.enum(['breakfast', 'lunch', 'snack', 'dinner']).optional().default('dinner'),
}).passthrough()

const AiShoppingListSchema = z.object({
  categories: z.array(z.object({
    name: z.string().min(1),
    items: z.array(z.object({
      name: z.string().min(1),
      quantity: z.string().min(1),
      priceEstimate: zCoercedNumber(0, 1000),
    })).optional().default([]),
    subtotal: zCoercedNumber(0, 10000).optional(),
  })).optional().default([]),
  totalEstimate: zCoercedNumber(0, 100000).optional(),
  savingsTips: z.array(z.string()).optional().default([]),
}).passthrough()

const AiRecipeDetailsSchema = z.object({
  ingredients: z.array(z.object({
    name: z.string().min(1),
    quantity: z.string().min(1),
    unit: z.string().optional().default(''),
  })).min(3),
  instructions: z.array(z.string().min(1)).min(3),
  tips: z.array(z.string().min(1)).optional().default([]),
}).passthrough()

function normalizeMealRecipe(
  recipe: z.infer<typeof AiMealRecipeSchema>,
  calorieTarget: number,
  maxCookingTime: number
): z.infer<typeof AiMealRecipeSchema> {
  const target = Math.max(0, Math.round(calorieTarget))
  const normalizedPrep = Math.min(Math.round(recipe.prepTime), Math.max(0, Math.round(maxCookingTime)))

  let calories = Math.round(recipe.calories)
  if (target > 0) {
    const minOk = Math.round(target * 0.75)
    const maxOk = Math.round(target * 1.25)
    if (calories < minOk || calories > maxOk) {
      calories = target
    }
  }

  // If macros are missing/near-zero, fill with a reasonable default split.
  const p = Math.round(recipe.proteins)
  const c = Math.round(recipe.carbs)
  const f = Math.round(recipe.fats)
  const macroEnergy = p * 4 + c * 4 + f * 9

  if (calories > 0 && macroEnergy < calories * 0.25) {
    const proteinCalories = Math.round(calories * 0.25)
    const carbCalories = Math.round(calories * 0.45)
    const fatCalories = Math.max(0, calories - proteinCalories - carbCalories)
    return {
      ...recipe,
      calories,
      proteins: Math.max(0, Math.round(proteinCalories / 4)),
      carbs: Math.max(0, Math.round(carbCalories / 4)),
      fats: Math.max(0, Math.round(fatCalories / 9)),
      prepTime: normalizedPrep,
    }
  }

  return {
    ...recipe,
    calories,
    proteins: Math.max(0, p),
    carbs: Math.max(0, c),
    fats: Math.max(0, f),
    prepTime: normalizedPrep,
  }
}

function parseJsonOrThrow(textContent: string): unknown {
  const jsonCandidate = extractFirstJsonValue(textContent)
  if (!jsonCandidate) {
    throw new Error('No JSON found in AI response')
  }
  return JSON.parse(jsonCandidate)
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
  mealSourcePreference?: MealSourcePreference
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

  const sourcePreference: MealSourcePreference = preferences.mealSourcePreference || 'balanced'
  const preferredOrder: Array<'gustar' | 'ciqual' | 'openfoodfacts'> = (() => {
    switch (sourcePreference) {
      case 'fresh':
        return ['ciqual', 'gustar', 'openfoodfacts']
      case 'recipes':
        return ['gustar', 'ciqual', 'openfoodfacts']
      case 'quick':
        return ['openfoodfacts', 'ciqual', 'gustar']
      default:
        return ['gustar', 'ciqual', 'openfoodfacts']
    }
  })()

  for (const source of preferredOrder) {
    if (source === 'gustar') {
      const gustarResults = await searchGustarRecipes(randomQuery, preferences.dietType, maxPrepTime, 3)
      allSuggestions.push(...gustarResults)
    }
    if (source === 'ciqual') {
      const ciqualResults = await searchCiqualFoods(randomQuery, 3)
      allSuggestions.push(...ciqualResults)
    }
    if (source === 'openfoodfacts') {
      const offResults = await searchOpenFoodFacts(randomQuery, 2)
      allSuggestions.push(...offResults)
    }
  }

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

    let parsed: unknown
    try {
      parsed = parseJsonOrThrow(textContent)
    } catch (parseError) {
      // One repair attempt (common failure: extra text, trailing commas, wrong types)
      const repairPrompt = `Corrige la sortie suivante pour qu'elle devienne un JSON STRICTEMENT valide (aucun texte autour), conforme au schéma attendu.

SORTIE À CORRIGER:
${textContent}

RAPPEL DU SCHÉMA:
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
}
`

      const repaired = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 600,
        temperature: 0,
        messages: [{ role: 'user', content: repairPrompt }],
      })

      const repairedText = repaired.choices[0]?.message?.content
      if (!repairedText) throw parseError
      parsed = parseJsonOrThrow(repairedText)
    }

    const recipe = normalizeMealRecipe(
      AiMealRecipeSchema.parse(parsed),
      mealType.calorieTarget,
      maxCookingTime
    )

    return {
      type: mealType.type,
      name: recipe.title,
      description: recipe.description ?? undefined,
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
 * Calculate daily calorie targets based on repas plaisir settings
 * If repas plaisir is enabled:
 * - Days BEFORE repas plaisir day are reduced by ~10% to save calories
 * - Repas plaisir day gets the base + ALL accumulated savings
 * - Days after repas plaisir are normal
 *
 * Example with 2100 kcal/day and repas plaisir on Saturday (day 5):
 * - Mon-Fri (days 0-4): 1890 kcal each (save 210/day = 1050 total)
 * - Saturday (day 5): 2100 + 1050 = 3150 kcal
 * - Sunday (day 6): 2100 kcal
 */
function calculateDailyCalorieTargets(
  baseCalories: number,
  includeRepasPlaisir: boolean,
  repasPlaisirDay: 5 | 6 = 5 // 5 = Samedi, 6 = Dimanche
): { dailyTargets: number[]; repasPlaisirBonus: number } {
  const dailyTargets: number[] = []

  if (!includeRepasPlaisir) {
    // No repas plaisir: each day gets the full calorie target
    for (let i = 0; i < 7; i++) {
      dailyTargets.push(baseCalories)
    }
    return { dailyTargets, repasPlaisirBonus: 0 }
  }

  // With repas plaisir: save 10% on days BEFORE repas plaisir day
  const savingsPercentage = 0.10
  const savedPerDay = Math.round(baseCalories * savingsPercentage)
  // Days 0 to (repasPlaisirDay - 1) save calories
  // If repasPlaisirDay = 5 (Saturday), we save on days 0-4 (Mon-Fri) = 5 days
  // If repasPlaisirDay = 6 (Sunday), we save on days 0-5 (Mon-Sat) = 6 days
  const daysToSave = repasPlaisirDay // Number of days that save (0-indexed)
  const totalSavings = savedPerDay * daysToSave

  console.log(`Repas plaisir calculation: ${baseCalories} base, ${savedPerDay}/day saved, ${daysToSave} days = ${totalSavings} total savings`)
  console.log(`Repas plaisir day ${repasPlaisirDay} will have: ${baseCalories} + ${totalSavings} = ${baseCalories + totalSavings} kcal`)

  for (let i = 0; i < 7; i++) {
    if (i < repasPlaisirDay) {
      // Days before repas plaisir: reduced calories
      dailyTargets.push(baseCalories - savedPerDay)
    } else if (i === repasPlaisirDay) {
      // Repas plaisir day: base + ALL accumulated savings
      dailyTargets.push(baseCalories + totalSavings)
    } else {
      // Days after repas plaisir: normal calories
      dailyTargets.push(baseCalories)
    }
  }

  return { dailyTargets, repasPlaisirBonus: totalSavings }
}

/**
 * Generate a complete 7-day meal plan
 * Priority: Gustar API > Ciqual > Open Food Facts > AI generation
 *
 * CRITICAL: Respects user's daily calorie target (±10%)
 * If repas plaisir is enabled, reduces calories on days 1-5/6 to save for the repas plaisir
 */
export async function generateWeeklyPlanWithDetails(
  preferences: WeeklyPlanPreferences,
  userProfile?: UserProfile,
  consumedContext?: ConsumedMealsContext
): Promise<{ success: boolean; plan?: WeeklyPlan; error?: string }> {
  try {
    console.log('Generating weekly meal plan...')
    console.log('User daily calorie target:', preferences.dailyCalories)
    console.log('Repas plaisir enabled:', preferences.includeCheatMeal)
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

    // Determine repas plaisir day (will be confirmed at day 5)
    // Default to Saturday (index 5)
    const repasPlaisirDayIndex: 5 | 6 = 5

    // Calculate daily calorie targets respecting repas plaisir
    const { dailyTargets, repasPlaisirBonus } = calculateDailyCalorieTargets(
      preferences.dailyCalories,
      preferences.includeCheatMeal || false,
      repasPlaisirDayIndex
    )

    console.log('Daily calorie targets:', dailyTargets)
    if (repasPlaisirBonus > 0) {
      console.log(`Repas plaisir bonus on day ${repasPlaisirDayIndex}: +${repasPlaisirBonus} kcal`)
    }

    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const dayMeals: MealPlanMeal[] = []
      const isWeekend = i >= 5
      const dailyCalorieTarget = dailyTargets[i]
      const isRepasPlaisirDay = preferences.includeCheatMeal && i === repasPlaisirDayIndex

      const dailyTheme = Math.random() > 0.5 ? getRandomTheme() : getSeasonalTheme()

      // Calculate meal calorie targets based on daily target
      // Standard distribution: Breakfast 25%, Lunch 35%, Snack 10%, Dinner 30%
      const mealTypes = [
        { type: 'breakfast' as const, name: 'Petit-déjeuner', calorieTarget: Math.round(dailyCalorieTarget * 0.25) },
        { type: 'lunch' as const, name: 'Déjeuner', calorieTarget: Math.round(dailyCalorieTarget * 0.35) },
        { type: 'snack' as const, name: 'Collation', calorieTarget: Math.round(dailyCalorieTarget * 0.10) },
        { type: 'dinner' as const, name: 'Dîner', calorieTarget: Math.round(dailyCalorieTarget * 0.30) },
      ]

      // Track calories for this day to ensure we hit the target
      let dayCaloriesUsed = 0
      const tolerance = 0.10 // ±10% tolerance

      for (let mealIdx = 0; mealIdx < mealTypes.length; mealIdx++) {
        const mealType = mealTypes[mealIdx]
        const isLastMeal = mealIdx === mealTypes.length - 1

        // For the last meal, adjust to hit daily target
        let targetCalories = mealType.calorieTarget
        if (isLastMeal) {
          const remaining = dailyCalorieTarget - dayCaloriesUsed
          targetCalories = Math.max(remaining, mealType.calorieTarget * 0.5) // At least 50% of normal
        }

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
        const isRepasPlaisirMeal = isRepasPlaisirDay && mealType.type === 'dinner'

        // 1. Try to find meals from existing sources
        if (!isRepasPlaisirMeal) {
          const suggestions = await getMealSuggestions(mealType.type, preferences, usedRecipeNames, isWeekend)

          if (suggestions.length > 0) {
            // Find a meal that fits the calorie target (±20% for sources, we'll adjust)
            const targetMin = targetCalories * 0.8
            const targetMax = targetCalories * 1.2

            meal = suggestions.find(s => s.calories >= targetMin && s.calories <= targetMax)

            if (!meal) {
              // If no exact match, find closest and scale
              const closest = suggestions.reduce((prev, curr) =>
                Math.abs(curr.calories - targetCalories) < Math.abs(prev.calories - targetCalories) ? curr : prev
              )

              if (closest.calories > 0) {
                // Scale the meal to match target calories
                const scaleFactor = targetCalories / closest.calories
                meal = {
                  ...closest,
                  calories: Math.round(closest.calories * scaleFactor),
                  proteins: Math.round(closest.proteins * scaleFactor),
                  carbs: Math.round(closest.carbs * scaleFactor),
                  fats: Math.round(closest.fats * scaleFactor),
                  description: closest.description ? `${closest.description} (portion ajustée)` : 'Portion ajustée',
                }
              }
            }
          }
        }

        // 2. If no suitable meal found, generate with AI with EXACT calorie target
        if (!meal) {
          meal = await generateMealWithAI(
            day,
            { ...mealType, calorieTarget: targetCalories },
            preferences,
            profileContext,
            usedRecipeNames,
            dailyTheme,
            isWeekend,
            isRepasPlaisirMeal
          )
        }

        // Ensure meal has correct calories (force it)
        if (meal && Math.abs(meal.calories - targetCalories) > targetCalories * 0.15) {
          // Meal calories are too far off, scale them
          const scaleFactor = targetCalories / (meal.calories || targetCalories)
          meal = {
            ...meal,
            calories: Math.round(targetCalories),
            proteins: Math.round((meal.proteins || 0) * scaleFactor),
            carbs: Math.round((meal.carbs || 0) * scaleFactor),
            fats: Math.round((meal.fats || 0) * scaleFactor),
          }
        }

        usedRecipeNames.push(meal.name.toLowerCase())
        dayMeals.push(meal)
        dayCaloriesUsed += meal.calories
      }

      const totalCalories = dayMeals.reduce((sum, m) => sum + (m?.calories || 0), 0)

      // Validate day is within tolerance
      const minAcceptable = dailyCalorieTarget * (1 - tolerance)
      const maxAcceptable = dailyCalorieTarget * (1 + tolerance)

      if (totalCalories < minAcceptable || totalCalories > maxAcceptable) {
        console.warn(`Day ${day}: ${totalCalories} kcal is outside target range [${Math.round(minAcceptable)}-${Math.round(maxAcceptable)}]`)
        // Adjust the last non-fasting meal to hit target
        const lastMealIdx = dayMeals.findLastIndex(m => !m.isFasting)
        if (lastMealIdx >= 0) {
          const adjustment = dailyCalorieTarget - totalCalories
          const adjustedMeal = dayMeals[lastMealIdx]
          adjustedMeal.calories = Math.max(50, adjustedMeal.calories + adjustment)
          console.log(`Adjusted ${adjustedMeal.name}: ${adjustment > 0 ? '+' : ''}${adjustment} kcal`)
        }
      }

      weekPlan.push({
        day,
        meals: dayMeals,
        totalCalories: dayMeals.reduce((sum, m) => sum + (m?.calories || 0), 0),
      })
    }

    // Log final plan summary
    console.log('Weekly plan generated successfully!')
    console.log('Daily totals:', weekPlan.map(d => `${d.day}: ${d.totalCalories} kcal`))

    return {
      success: true,
      plan: {
        days: weekPlan,
        cheatMealDay: preferences.includeCheatMeal ? repasPlaisirDayIndex : undefined,
        cheatMealProposed: false,
      },
    }
  } catch (error) {
    console.error('Error generating weekly plan:', error)
    return { success: false, error: 'Impossible de générer le plan hebdomadaire' }
  }
}

/**
 * Propose repas plaisir modification for day 6 or 7
 * Called when user reaches day 5 (Vendredi)
 *
 * Recalculates the remaining days:
 * - If user chooses Samedi (5): day 6 gets accumulated savings, day 7 is normal
 * - If user chooses Dimanche (6): day 6 is reduced, day 7 gets all savings
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
    const dayName = preferredDay === 5 ? 'Samedi' : 'Dimanche'

    // Calculate the accumulated savings from days 0-4 (Lundi-Vendredi)
    // Plus potentially day 5 if user chose Sunday
    const savedPerDay = Math.round(preferences.dailyCalories * 0.10)
    const daysAlreadySaved = 5 // Days 0-4 already saved
    let totalSavingsForRepasPlaisir = savedPerDay * daysAlreadySaved

    if (preferredDay === 6) {
      // If Sunday, also save from Saturday
      totalSavingsForRepasPlaisir += savedPerDay
    }

    // The repas plaisir meal gets a significant calorie boost
    const repasPlaisirCalories = Math.round(preferences.dailyCalories * 0.40) + Math.round(totalSavingsForRepasPlaisir * 0.5)

    const prompt = `Génère un REPAS PLAISIR gourmand et festif pour ${dayName}.

CONTEXTE:
- L'utilisateur a économisé des calories toute la semaine pour ce moment
- C'est un repas de récompense, il doit être généreux et savoureux
- Calories cibles pour ce repas: ${repasPlaisirCalories} kcal

CONTRAINTES:
- Ce repas doit faire environ ${repasPlaisirCalories} kcal
- Doit être appétissant, réconfortant et festif
- Type de régime de base: ${preferences.dietType || 'omnivore'}
- Allergies à éviter: ${preferences.allergies?.join(', ') || 'aucune'}

Réponds UNIQUEMENT en JSON:
{
  "title": "Nom fun et gourmand du plat",
  "description": "Description appétissante",
  "calories": ${repasPlaisirCalories},
  "proteins": 45,
  "carbs": 90,
  "fats": 50,
  "prepTime": 35,
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

    let parsed: unknown
    try {
      parsed = parseJsonOrThrow(textContent)
    } catch (parseError) {
      const repairPrompt = `Corrige la sortie suivante pour qu'elle devienne un JSON STRICTEMENT valide (aucun texte autour) conforme au schéma attendu.

SORTIE À CORRIGER:
${textContent}

RAPPEL DU SCHÉMA:
{
  "title": "Nom fun et gourmand du plat",
  "description": "Description appétissante",
  "calories": ${repasPlaisirCalories},
  "proteins": 45,
  "carbs": 90,
  "fats": 50,
  "prepTime": 35,
  "mealType": "dinner"
}
`

      const repaired = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        temperature: 0,
        messages: [{ role: 'user', content: repairPrompt }],
      })
      const repairedText = repaired.choices[0]?.message?.content
      if (!repairedText) throw parseError
      parsed = parseJsonOrThrow(repairedText)
    }

    const repasPlaisir = AiCheatMealSchema.parse(parsed)

    // Update the plan with the repas plaisir
    const updatedDays = currentPlan.days.map((dayPlan, index) => {
      // If user chose Sunday and this is Saturday, reduce it
      if (preferredDay === 6 && index === 5) {
        const reducedTarget = preferences.dailyCalories - savedPerDay
        const updatedMeals = dayPlan.meals.map(meal => {
          if (meal.isFasting) return meal
          // Scale down each meal proportionally
          const scaleFactor = reducedTarget / preferences.dailyCalories
          return {
            ...meal,
            calories: Math.round(meal.calories * scaleFactor),
            proteins: Math.round(meal.proteins * scaleFactor),
            carbs: Math.round(meal.carbs * scaleFactor),
            fats: Math.round(meal.fats * scaleFactor),
          }
        })
        return {
          ...dayPlan,
          meals: updatedMeals,
          totalCalories: updatedMeals.reduce((sum, m) => sum + m.calories, 0),
        }
      }

      // Update the repas plaisir day
      if (index === preferredDay) {
        const mealType = repasPlaisir.mealType === 'lunch' ? 'lunch' : 'dinner'
        const updatedMeals = dayPlan.meals.map(meal => {
          if (meal.type === mealType) {
            return {
              ...meal,
              name: repasPlaisir.title,
              description: repasPlaisir.description,
              calories: repasPlaisir.calories,
              proteins: repasPlaisir.proteins,
              carbs: repasPlaisir.carbs,
              fats: repasPlaisir.fats,
              prepTime: repasPlaisir.prepTime,
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
      }

      return dayPlan
    })

    console.log(`Repas plaisir set for ${dayName} with ${repasPlaisir.calories} kcal (savings: ${totalSavingsForRepasPlaisir} kcal)`)

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
    console.error('Error proposing repas plaisir:', error)
    return { success: false, error: 'Impossible de proposer le repas plaisir' }
  }
}

/**
 * Regenerate a specific day in the plan
 * Respects the calorie target for that specific day (including repas plaisir logic)
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

    // Calculate the correct daily target for this day
    const repasPlaisirDay = existingPlan.cheatMealDay as 5 | 6 | undefined
    const { dailyTargets } = calculateDailyCalorieTargets(
      preferences.dailyCalories,
      preferences.includeCheatMeal || false,
      repasPlaisirDay || 5
    )
    const dailyCalorieTarget = dailyTargets[dayIndex]

    console.log(`Regenerating ${day} with target: ${dailyCalorieTarget} kcal`)

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
    const isRepasPlaisirDay = preferences.includeCheatMeal && dayIndex === repasPlaisirDay

    const mealTypes = [
      { type: 'breakfast' as const, name: 'Petit-déjeuner', calorieTarget: Math.round(dailyCalorieTarget * 0.25) },
      { type: 'lunch' as const, name: 'Déjeuner', calorieTarget: Math.round(dailyCalorieTarget * 0.35) },
      { type: 'snack' as const, name: 'Collation', calorieTarget: Math.round(dailyCalorieTarget * 0.10) },
      { type: 'dinner' as const, name: 'Dîner', calorieTarget: Math.round(dailyCalorieTarget * 0.30) },
    ]

    let dayCaloriesUsed = 0

    for (let mealIdx = 0; mealIdx < mealTypes.length; mealIdx++) {
      const mealType = mealTypes[mealIdx]
      const isLastMeal = mealIdx === mealTypes.length - 1

      // For the last meal, adjust to hit daily target
      let targetCalories = mealType.calorieTarget
      if (isLastMeal) {
        const remaining = dailyCalorieTarget - dayCaloriesUsed
        targetCalories = Math.max(remaining, mealType.calorieTarget * 0.5)
      }

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

      let meal: MealPlanMeal | null = null
      const isRepasPlaisirMeal = isRepasPlaisirDay && mealType.type === 'dinner'

      // Try existing sources first (except for repas plaisir)
      if (!isRepasPlaisirMeal) {
        const suggestions = await getMealSuggestions(mealType.type, preferences, usedRecipeNames, isWeekend)

        if (suggestions.length > 0) {
          const targetMin = targetCalories * 0.8
          const targetMax = targetCalories * 1.2
          meal = suggestions.find(s => s.calories >= targetMin && s.calories <= targetMax)

          if (!meal) {
            const closest = suggestions.reduce((prev, curr) =>
              Math.abs(curr.calories - targetCalories) < Math.abs(prev.calories - targetCalories) ? curr : prev
            )

            if (closest.calories > 0) {
              const scaleFactor = targetCalories / closest.calories
              meal = {
                ...closest,
                calories: Math.round(closest.calories * scaleFactor),
                proteins: Math.round(closest.proteins * scaleFactor),
                carbs: Math.round(closest.carbs * scaleFactor),
                fats: Math.round(closest.fats * scaleFactor),
                description: closest.description ? `${closest.description} (portion ajustée)` : 'Portion ajustée',
              }
            }
          }
        }
      }

      if (!meal) {
        meal = await generateMealWithAI(
          day,
          { ...mealType, calorieTarget: targetCalories },
          preferences,
          profileContext,
          usedRecipeNames,
          theme,
          isWeekend,
          isRepasPlaisirMeal
        )
      }

      // Force correct calories
      if (meal && Math.abs(meal.calories - targetCalories) > targetCalories * 0.15) {
        const scaleFactor = targetCalories / (meal.calories || targetCalories)
        meal = {
          ...meal,
          calories: Math.round(targetCalories),
          proteins: Math.round((meal.proteins || 0) * scaleFactor),
          carbs: Math.round((meal.carbs || 0) * scaleFactor),
          fats: Math.round((meal.fats || 0) * scaleFactor),
        }
      }

      usedRecipeNames.push(meal.name.toLowerCase())
      dayMeals.push(meal)
      dayCaloriesUsed += meal.calories
    }

    const totalCalories = dayMeals.reduce((sum, m) => sum + (m?.calories || 0), 0)

    // Final adjustment if needed
    const tolerance = 0.10
    const minAcceptable = dailyCalorieTarget * (1 - tolerance)
    const maxAcceptable = dailyCalorieTarget * (1 + tolerance)

    if (totalCalories < minAcceptable || totalCalories > maxAcceptable) {
      const lastMealIdx = dayMeals.findLastIndex(m => !m.isFasting)
      if (lastMealIdx >= 0) {
        const adjustment = dailyCalorieTarget - totalCalories
        dayMeals[lastMealIdx].calories = Math.max(50, dayMeals[lastMealIdx].calories + adjustment)
      }
    }

    return {
      success: true,
      dayPlan: {
        day,
        meals: dayMeals,
        totalCalories: dayMeals.reduce((sum, m) => sum + (m?.calories || 0), 0),
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

    let parsed: unknown
    try {
      parsed = parseJsonOrThrow(textContent)
    } catch (parseError) {
      const repairPrompt = `Corrige la sortie suivante pour qu'elle devienne un JSON STRICTEMENT valide (aucun texte autour) conforme au schéma attendu.

SORTIE À CORRIGER:
${textContent}

RAPPEL DU SCHÉMA:
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
}
`

      const repaired = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 1200,
        temperature: 0,
        messages: [{ role: 'user', content: repairPrompt }],
      })
      const repairedText = repaired.choices[0]?.message?.content
      if (!repairedText) throw parseError
      parsed = parseJsonOrThrow(repairedText)
    }

    const shoppingList = AiShoppingListSchema.parse(parsed)

    // Recalculate totals
    let total = 0
    shoppingList.categories.forEach((cat) => {
      let catTotal = 0
      cat.items.forEach((item) => {
        catTotal += item.priceEstimate || 0
      })
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

    let parsed: unknown
    try {
      parsed = parseJsonOrThrow(textContent)
    } catch (parseError) {
      const repairPrompt = `Corrige la sortie suivante pour qu'elle devienne un JSON STRICTEMENT valide (aucun texte autour) conforme au schéma attendu.

SORTIE À CORRIGER:
${textContent}

RAPPEL DU SCHÉMA:
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
}
`
      const repaired = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 1200,
        temperature: 0,
        messages: [{ role: 'user', content: repairPrompt }],
      })
      const repairedText = repaired.choices[0]?.message?.content
      if (!repairedText) throw parseError
      parsed = parseJsonOrThrow(repairedText)
    }

    const recipe = AiRecipeDetailsSchema.parse(parsed)
    return { success: true, recipe }
  } catch (error) {
    console.error('Error generating recipe details:', error)
    return { success: false, error: 'Impossible de générer les détails de la recette' }
  }
}
