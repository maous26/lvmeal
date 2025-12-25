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
}

export interface WeeklyPlan {
  days: MealPlanDay[]
}

/**
 * Generate a complete 7-day meal plan
 */
export async function generateWeeklyPlanWithDetails(
  preferences: WeeklyPlanPreferences,
  userProfile?: UserProfile
): Promise<{ success: boolean; plan?: WeeklyPlan; error?: string }> {
  try {
    if (!isOpenAIAvailable()) {
      return {
        success: false,
        error: "L'IA n'est pas configurée. Veuillez configurer OPENAI_API_KEY."
      }
    }

    const client = getOpenAIClient()
    console.log('Generating weekly meal plan...')

    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    const weekPlan: MealPlanDay[] = []
    const usedRecipeTitles: string[] = []

    const profileContext = userProfile ? generateUserProfileContext(userProfile) : ''

    // Determine Cheat Meal slot if requested
    let cheatMealDayIndex = -1
    let cheatMealType: 'lunch' | 'dinner' = 'dinner'

    if (preferences.includeCheatMeal) {
      const weekendIndices = [4, 5, 6]
      cheatMealDayIndex = weekendIndices[Math.floor(Math.random() * weekendIndices.length)]
      cheatMealType = Math.random() > 0.5 ? 'dinner' : 'lunch'
    }

    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const dayMeals: MealPlanMeal[] = []

      const dailyTheme = Math.random() > 0.5 ? getRandomTheme() : getSeasonalTheme()

      const mealTypes = [
        { type: 'breakfast' as const, name: 'Petit-déjeuner', calorieTarget: preferences.dailyCalories * 0.25 },
        { type: 'lunch' as const, name: 'Déjeuner', calorieTarget: preferences.dailyCalories * 0.35 },
        { type: 'snack' as const, name: 'Collation', calorieTarget: preferences.dailyCalories * 0.10 },
        { type: 'dinner' as const, name: 'Dîner', calorieTarget: preferences.dailyCalories * 0.30 },
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
            isFasting: true
          })
          continue
        }

        const meal = await generateMeal(
          client,
          day,
          mealType,
          preferences,
          profileContext,
          usedRecipeTitles,
          dailyTheme,
          i >= 5, // isWeekend
          isCheatMeal
        )

        usedRecipeTitles.push(meal.name)
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
    return { success: true, plan: { days: weekPlan } }
  } catch (error) {
    console.error('Error generating weekly plan:', error)
    return { success: false, error: 'Impossible de générer le plan hebdomadaire' }
  }
}

async function generateMeal(
  client: OpenAI,
  day: string,
  mealType: { type: 'breakfast' | 'lunch' | 'snack' | 'dinner'; name: string; calorieTarget: number },
  preferences: WeeklyPlanPreferences,
  profileContext: string,
  usedTitles: string[],
  theme: string,
  isWeekend: boolean,
  isCheatMeal: boolean
): Promise<MealPlanMeal> {
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
  "prepTime": ${Math.min(maxCookingTime, 25)}
}`

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
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
    }
  } catch (error) {
    console.error(`Error generating meal for ${day} ${mealType.type}:`, error)
    // Fallback meal
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
      isCheatMeal: false
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
      isCheatMeal
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
      isCheatMeal: false
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
      isCheatMeal
    }
  }
  return fallbacks[mealType.type]
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
    if (!isOpenAIAvailable()) {
      return {
        success: false,
        error: "L'IA n'est pas configurée."
      }
    }

    const client = getOpenAIClient()
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    const day = days[dayIndex]

    const profileContext = userProfile ? generateUserProfileContext(userProfile) : ''

    // Collect titles from other days to avoid duplicates
    const usedRecipeTitles: string[] = []
    existingPlan.days.forEach((d, idx) => {
      if (idx !== dayIndex) {
        d.meals.forEach((m) => {
          if (m.name) usedRecipeTitles.push(m.name)
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
          isFasting: true
        })
        continue
      }

      const meal = await generateMeal(
        client,
        day,
        mealType,
        preferences,
        profileContext,
        usedRecipeTitles,
        theme,
        isWeekend,
        false
      )

      usedRecipeTitles.push(meal.name)
      dayMeals.push(meal)
    }

    const totalCalories = dayMeals.reduce((sum, m) => sum + (m?.calories || 0), 0)

    return {
      success: true,
      dayPlan: {
        day,
        meals: dayMeals,
        totalCalories,
      }
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
        error: "L'IA n'est pas configurée."
      }
    }

    const client = getOpenAIClient()

    // Collect all meal names with details
    const allMeals: string[] = []
    weeklyPlan.days.forEach((day) => {
      day.meals.forEach((meal) => {
        if (meal.name && !meal.isFasting) {
          allMeals.push(`- ${meal.name} (${meal.calories} kcal, P:${meal.proteins}g)`)
        }
      })
    })

    const budgetContext = budget ? `Budget hebdomadaire maximum: ${budget}€. Respecte ce budget!` : ''

    const prompt = `Tu es un expert en courses alimentaires en France. Génère une liste de courses COMPLÈTE et RÉALISTE.

REPAS DE LA SEMAINE (${allMeals.length} repas):
${allMeals.join('\n')}

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
export async function generateRecipeDetails(meal: {
  name: string
  description?: string
  calories: number
  proteins: number
  carbs: number
  fats: number
  prepTime: number
  type: string
}, userProfile?: UserProfile) {
  try {
    if (!isOpenAIAvailable()) {
      return {
        success: false,
        error: "L'IA n'est pas configurée."
      }
    }

    const client = getOpenAIClient()
    const profileContext = userProfile ? generateUserProfileContext(userProfile) : ''

    const mealTypeLabels: Record<string, string> = {
      breakfast: 'petit-déjeuner',
      lunch: 'déjeuner',
      snack: 'collation',
      dinner: 'dîner'
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
