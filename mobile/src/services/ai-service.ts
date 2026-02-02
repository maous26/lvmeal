/**
 * AI Service for Mobile - OpenAI Integration
 *
 * Features:
 * - Food photo analysis (GPT-4 Vision)
 * - Voice/text food description analysis
 * - Recipe generation
 * - Recipe translation (German to French)
 * - Meal suggestions
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { z } from 'zod'
import {
  FOOD_ANALYSIS_PROMPT,
  FOOD_DESCRIPTION_PROMPT,
  RECIPE_GENERATION_PROMPT,
  RECIPE_TRANSLATION_PROMPT,
  MEAL_PLANNER_SYSTEM_PROMPT,
  MEAL_TYPE_GUIDELINES,
} from '../lib/ai/prompts'
import { getFoodDataForPrompt } from './food-data-rag'
import { generateUserProfileContext, generateRemainingNutritionContext } from '../lib/ai/user-context'
import { getThemedPrompt } from '../lib/ai/themes'
import { withRetry } from './ai-error-handler'
import type { UserProfile, NutritionInfo } from '../types'

// ============= TYPES =============

export interface AnalyzedFood {
  name: string
  estimatedWeight: number
  confidence: number
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
    fiber?: number
  }
}

export interface FoodAnalysisResult {
  success: boolean
  foods: AnalyzedFood[]
  totalNutrition: NutritionInfo
  mealTitle?: string // AI-generated meal title (e.g., "Poulet rôti aux légumes")
  description?: string
  error?: string
}

export interface AIRecipe {
  title: string
  description: string
  ingredients: { name: string; amount: string; calories: number }[]
  instructions: string[]
  nutrition: NutritionInfo
  prepTime: number
  servings: number
  imageUrl?: string | null
}

export interface AIRecipeResult {
  success: boolean
  recipe?: AIRecipe
  error?: string
}

export interface TranslatedRecipe {
  titleFr: string
  descriptionFr: string
  ingredientsFr: { name: string; amount: number; unit: string; calories?: number }[]
  instructionsFr: string[]
  nutrition: NutritionInfo
}

export interface MealSuggestion {
  title: string
  description: string
  nutrition: NutritionInfo
  prepTime: number
  difficulty: 'easy' | 'medium' | 'hard'
  ingredients: string[]
}

// ============= CONFIG =============

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'
const API_KEY_STORAGE_KEY = 'openai_api_key'

// Get API key from environment (Expo public env vars)
const ENV_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || null

let cachedApiKey: string | null = null

// ============= API KEY MANAGEMENT =============

export async function setOpenAIApiKey(apiKey: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
  cachedApiKey = apiKey
}

export async function getOpenAIApiKey(): Promise<string | null> {
  // Priority: cached > AsyncStorage > environment variable
  if (cachedApiKey) return cachedApiKey

  // Try AsyncStorage first
  const storedKey = await AsyncStorage.getItem(API_KEY_STORAGE_KEY)
  if (storedKey) {
    cachedApiKey = storedKey
    return cachedApiKey
  }

  // Fall back to environment variable
  if (ENV_API_KEY) {
    cachedApiKey = ENV_API_KEY
    return cachedApiKey
  }

  return null
}

export async function hasOpenAIApiKey(): Promise<boolean> {
  const key = await getOpenAIApiKey()
  return key !== null && key.length > 0
}

export async function clearOpenAIApiKey(): Promise<void> {
  await AsyncStorage.removeItem(API_KEY_STORAGE_KEY)
  cachedApiKey = null
}

// ============= OPENAI API CALL =============

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>
}

async function callOpenAI(
  messages: ChatMessage[],
  options: {
    model?: string
    maxTokens?: number
    temperature?: number
    timeout?: number
    maxRetries?: number
  } = {}
): Promise<string> {
  const apiKey = await getOpenAIApiKey()
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const { model = 'gpt-4o-mini', maxTokens = 1500, temperature = 0.7, timeout = 30000, maxRetries = 2 } = options

  // Utilise withRetry pour les appels critiques
  return withRetry(
    async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `API Error: ${response.status}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (!content) {
          throw new Error('No response from AI')
        }

        return content
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timeout')
        }
        throw error
      }
    },
    {
      serviceName: `ai_service_${model}`,
      config: {
        maxRetries,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
      },
      onRetry: (attempt, error) => {
        console.warn(`[AIService] Retry ${attempt} for ${model}:`, error.message)
      },
      shouldRetry: (error) => {
        // Ne pas retry pour les erreurs de quota ou clé invalide
        return error.type !== 'quota_exceeded' && error.type !== 'invalid_key'
      },
    }
  )
}

function extractJSON<T = Record<string, unknown>>(text: string): T {
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    return JSON.parse(cleaned) as T
  }

  const firstBrace = cleaned.indexOf('{')
  const firstBracket = cleaned.indexOf('[')
  const start =
    firstBrace === -1 ? firstBracket :
    firstBracket === -1 ? firstBrace :
    Math.min(firstBrace, firstBracket)

  if (start === -1) {
    throw new Error('Could not parse AI response')
  }

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
      return JSON.parse(cleaned.slice(start, i + 1)) as T
    }
  }

  throw new Error('Could not parse AI response')
}

const zCoercedNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => {
      if (typeof v === 'string' && v.trim() !== '') return Number(v)
      return v
    },
    z.number().finite().min(min).max(max)
  )

const AiRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(''),
  ingredients: z.array(z.object({
    name: z.string().min(1),
    amount: z.string().min(1),
    calories: zCoercedNumber(0, 5000),
  })).min(3),
  instructions: z.array(z.string().min(1)).min(3),
  nutrition: z.object({
    calories: zCoercedNumber(0, 6000),
    proteins: zCoercedNumber(0, 400),
    carbs: zCoercedNumber(0, 600),
    fats: zCoercedNumber(0, 300),
  }),
  prepTime: zCoercedNumber(0, 240),
  servings: zCoercedNumber(1, 20).optional().default(1),
  imageUrl: z.string().nullable().optional(),
}).passthrough()

// ============= FOOD ANALYSIS =============

/**
 * Analyze a food image using GPT-4 Vision
 */
export async function analyzeFood(imageBase64: string): Promise<FoodAnalysisResult> {
  try {
    // Ensure we have the full data URL format
    let imageUrl = imageBase64
    if (!imageBase64.startsWith('data:')) {
      imageUrl = `data:image/jpeg;base64,${imageBase64}`
    }

    const response = await callOpenAI(
      [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'auto', // Upgraded from 'low' for better recognition accuracy
              },
            },
            {
              type: 'text',
              text: FOOD_ANALYSIS_PROMPT,
            },
          ],
        },
      ],
      { model: 'gpt-4o-mini', maxTokens: 1024 }
    )

    const result = extractJSON(response) as { foods?: AnalyzedFood[]; mealTitle?: string; description?: string }
    const foods: AnalyzedFood[] = result.foods || []

    const totalNutrition = foods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.nutrition.calories,
        proteins: acc.proteins + food.nutrition.proteins,
        carbs: acc.carbs + food.nutrition.carbs,
        fats: acc.fats + food.nutrition.fats,
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    )

    return {
      success: true,
      foods,
      totalNutrition,
      mealTitle: result.mealTitle,
      description: result.description,
    }
  } catch (error) {
    console.error('Food analysis error:', error)
    return {
      success: false,
      foods: [],
      totalNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
      error: error instanceof Error ? error.message : "Erreur lors de l'analyse",
    }
  }
}

/**
 * Analyze food from voice/text description
 * Uses RAG to fetch real nutritional data from CIQUAL/OFF databases
 */
export async function analyzeFoodDescription(description: string): Promise<FoodAnalysisResult> {
  try {
    // Fetch real food data from CIQUAL/OFF for accurate unit weights
    console.log('[AI] Fetching RAG data for:', description)
    const ragData = await getFoodDataForPrompt(description)

    if (ragData.hasData) {
      console.log('[AI] RAG found data for foods:', ragData.foods.map(f => f.name))
    } else {
      console.log('[AI] No RAG data found, using fallback')
    }

    // Build prompt with RAG context (or fallback to hardcoded values)
    const prompt = FOOD_DESCRIPTION_PROMPT(description, ragData.promptContext || undefined)

    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-4o-mini', maxTokens: 1024 }
    )

    const result = extractJSON(response) as { foods?: AnalyzedFood[]; description?: string }
    const foods: AnalyzedFood[] = result.foods || []

    const totalNutrition = foods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.nutrition.calories,
        proteins: acc.proteins + food.nutrition.proteins,
        carbs: acc.carbs + food.nutrition.carbs,
        fats: acc.fats + food.nutrition.fats,
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    )

    return {
      success: true,
      foods,
      totalNutrition,
      description: result.description,
    }
  } catch (error) {
    console.error('Food description analysis error:', error)
    return {
      success: false,
      foods: [],
      totalNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
      error: error instanceof Error ? error.message : "Erreur lors de l'analyse",
    }
  }
}

// ============= RECIPE GENERATION =============

/**
 * Generate a recipe based on user preferences
 */
export async function generateRecipe(params: {
  mealType: string
  description?: string
  maxCalories?: number
  dietType?: string
  restrictions?: string[]
}): Promise<AIRecipeResult> {
  try {
    const prompt = RECIPE_GENERATION_PROMPT(params)
    const response = await callOpenAI([{ role: 'user', content: prompt }], { maxTokens: 1500 })

    const recipe = extractJSON<AIRecipe>(response)

    return {
      success: true,
      recipe,
    }
  } catch (error) {
    console.error('Recipe generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la generation',
    }
  }
}

/**
 * Generate a personalized meal suggestion based on user profile and remaining nutrition
 */
export async function suggestMeal(params: {
  mealType: string
  userProfile: UserProfile
  consumed: NutritionInfo
  theme?: string
}): Promise<AIRecipeResult> {
  try {
    const { mealType, userProfile, consumed, theme } = params

    const userContext = generateUserProfileContext(userProfile)
    const nutritionContext = generateRemainingNutritionContext(
      userProfile.nutritionalNeeds || { calories: 2000, proteins: 100, carbs: 250, fats: 70, fiber: 30, water: 2 },
      consumed
    )
    const mealGuidelines = MEAL_TYPE_GUIDELINES[mealType] || ''
    const themePrompt = theme || getThemedPrompt()

    const prompt = `${MEAL_PLANNER_SYSTEM_PROMPT}

${userContext}

${nutritionContext}

${mealGuidelines}

${themePrompt}

Genere une recette pour ce ${mealType} qui respecte toutes ces contraintes.

Reponds UNIQUEMENT en JSON:
{
  "title": "Nom de la recette",
  "description": "Description courte et appetissante",
  "ingredients": [
    { "name": "ingredient", "amount": "quantite", "calories": 50 }
  ],
  "instructions": ["etape 1", "etape 2"],
  "nutrition": {
    "calories": 450,
    "proteins": 25,
    "carbs": 40,
    "fats": 15
  },
  "prepTime": 30,
  "servings": 2
}`

    const response = await callOpenAI([{ role: 'user', content: prompt }], { maxTokens: 1500 })
    const recipe = extractJSON<AIRecipe>(response)

    // OPTIMIZATION: Don't wait for image - return recipe immediately
    // Image generation takes 10-20s and blocks the modal
    // Set imageUrl to null, caller can generate image separately if needed
    recipe.imageUrl = null

    return {
      success: true,
      recipe,
    }
  } catch (error) {
    console.error('Meal suggestion error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la suggestion',
    }
  }
}

// ============= IMAGE GENERATION =============

const DALLE_API_URL = 'https://api.openai.com/v1/images/generations'

/**
 * Generate a food image using DALL-E 3
 */
export async function generateRecipeImage(recipeTitle: string): Promise<string | null> {
  try {
    const apiKey = await getOpenAIApiKey()
    if (!apiKey) {
      console.log('No API key for image generation')
      return null
    }

    const prompt = `Professional food photography of "${recipeTitle}".
Appetizing plated dish, elegant presentation on a white ceramic plate,
soft natural lighting from the side, shallow depth of field,
garnished beautifully, restaurant quality, top-down angle,
clean minimalist background, high resolution, photorealistic.
Style: Modern French cuisine photography, Michelin star presentation.`

    const response = await fetch(DALLE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural',
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error('DALL-E error:', error)
      return null
    }

    const data = await response.json()
    return data.data?.[0]?.url || null
  } catch (error) {
    console.error('Image generation error:', error)
    return null
  }
}

// ============= RECIPE TRANSLATION =============

/**
 * Translate a German recipe to French and enrich with nutrition data
 */
export async function translateRecipe(recipe: {
  title: string
  description?: string
  ingredients: { name: string; amount: number; unit: string }[]
  instructions: string[]
}): Promise<{ success: boolean; translated?: TranslatedRecipe; error?: string }> {
  try {
    const prompt = RECIPE_TRANSLATION_PROMPT(recipe)
    const response = await callOpenAI([{ role: 'user', content: prompt }], { maxTokens: 2000 })
    const translated = extractJSON<TranslatedRecipe>(response)

    return {
      success: true,
      translated,
    }
  } catch (error) {
    console.error('Recipe translation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la traduction',
    }
  }
}

/**
 * Batch translate multiple recipes
 */
export async function translateRecipesBatch(
  recipes: Array<{
    id: string
    title: string
    description?: string
    ingredients: { name: string; amount: number; unit: string }[]
    instructions: string[]
  }>
): Promise<Map<string, TranslatedRecipe>> {
  const results = new Map<string, TranslatedRecipe>()

  // Process in parallel with limit of 3
  const batchSize = 3
  for (let i = 0; i < recipes.length; i += batchSize) {
    const batch = recipes.slice(i, i + batchSize)
    const promises = batch.map(async recipe => {
      const result = await translateRecipe(recipe)
      if (result.success && result.translated) {
        results.set(recipe.id, result.translated)
      }
    })
    await Promise.all(promises)
  }

  return results
}

/**
 * Fast batch translation for Gustar recipes (titles and descriptions only)
 * Optimized for quick display - translates multiple recipes in a single API call
 */
export async function translateGustarRecipesFast(
  recipes: Array<{
    id: string
    title: string
    description?: string
  }>
): Promise<Map<string, { titleFr: string; descriptionFr: string }>> {
  const results = new Map<string, { titleFr: string; descriptionFr: string }>()

  if (recipes.length === 0) return results

  try {
    const recipesInfo = recipes
      .map(
        (r, i) =>
          `[${i + 1}] ID: ${r.id}
Titre: ${r.title}
Description: ${r.description || 'Non disponible'}`
      )
      .join('\n\n')

    const prompt = `Tu es un expert en traduction culinaire allemand-français.
Traduis ces ${recipes.length} titres et descriptions de recettes allemandes en français.

${recipesInfo}

RÈGLES:
- Titres: naturels, appétissants, typiquement français
- Descriptions: courtes (1-2 phrases max), appétissantes
- Si pas de description originale, invente-en une courte et appétissante

Réponds UNIQUEMENT avec un JSON valide (sans markdown):
[
  {
    "id": "id_original",
    "titleFr": "Titre traduit",
    "descriptionFr": "Description traduite"
  }
]`

    const response = await callOpenAI([{ role: 'user', content: prompt }], {
      maxTokens: 2000,
      temperature: 0.7,
      timeout: 20000,
    })

    // Parse response
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const translations = JSON.parse(cleanJson) as Array<{
      id: string
      titleFr: string
      descriptionFr: string
    }>

    // Map results
    for (const t of translations) {
      results.set(t.id, { titleFr: t.titleFr, descriptionFr: t.descriptionFr })
    }
  } catch (error) {
    console.warn('Fast translation error:', error instanceof Error ? error.message : 'Unknown')
    // Return empty map - recipes will display in German
  }

  return results
}

// ============= RECIPE ENRICHMENT =============

export interface RecipeToEnrich {
  id: string
  title: string
  description?: string
  ingredients: Array<{ name: string; amount: number; unit: string }>
  instructions?: string[]
  servings: number
  nutrition?: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  } | null
}

export interface EnrichedRecipe {
  id: string
  titleFr: string
  descriptionFr: string
  ingredientsFr: Array<{ name: string; amount: number; unit: string }>
  instructionsFr: string[]
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
}

/**
 * Enrich a single Gustar recipe with full French translation and nutrition
 * Rewrites the recipe completely in French with proper instructions
 */
export async function enrichRecipe(recipe: RecipeToEnrich): Promise<EnrichedRecipe | null> {
  try {
    const needsNutrition = !recipe.nutrition ||
      recipe.nutrition.calories === 0 ||
      recipe.nutrition.proteins === 0

    const ingredientsList = recipe.ingredients
      .map(ing => `${ing.amount} ${ing.unit} ${ing.name}`)
      .join('\n')

    const instructionsList = recipe.instructions?.length
      ? recipe.instructions.join('\n')
      : 'Aucune instruction fournie'

    const prompt = `Tu es un expert en nutrition et en traduction culinaire.

Voici une recette en allemand à enrichir et traduire complètement en français:

**Titre:** ${recipe.title}
**Description:** ${recipe.description || 'Aucune description'}
**Portions:** ${recipe.servings}
**Ingrédients:**
${ingredientsList}
**Instructions:**
${instructionsList}

${needsNutrition ? 'Les données nutritionnelles sont manquantes ou incomplètes.' : `Données nutritionnelles existantes: ${JSON.stringify(recipe.nutrition)}`}

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans \`\`\`) contenant:
{
  "titleFr": "Titre traduit en français (naturel et appétissant)",
  "descriptionFr": "Description traduite en français (2-3 phrases, donne envie)",
  "ingredientsFr": [
    { "name": "nom de l'ingrédient en français", "amount": quantité, "unit": "unité en français" },
    ...
  ],
  "instructionsFr": [
    "Étape 1 en français...",
    "Étape 2 en français...",
    ...
  ],
  "nutrition": {
    "calories": <nombre estimé de kcal par portion>,
    "proteins": <grammes de protéines par portion>,
    "carbs": <grammes de glucides par portion>,
    "fats": <grammes de lipides par portion>
  }
}

Instructions importantes:
- Traduis TOUS les ingrédients en français avec les bonnes unités (g, ml, c. à soupe, etc.)
- ${recipe.instructions?.length ? 'Traduis les instructions en français, étape par étape, de façon claire et détaillée.' : 'Génère des instructions de préparation logiques et détaillées en français basées sur le titre et les ingrédients (4-8 étapes).'}
- ${needsNutrition ? 'Estime les valeurs nutritionnelles par portion.' : 'Garde les valeurs nutritionnelles si correctes.'}

Réponds UNIQUEMENT avec le JSON, rien d'autre.`

    const response = await callOpenAI([{ role: 'user', content: prompt }], {
      maxTokens: 1500,
      temperature: 0.7,
      timeout: 30000,
    })

    // Parse the JSON response
    const cleanJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const enrichedData = JSON.parse(cleanJson)

    return {
      id: recipe.id,
      titleFr: enrichedData.titleFr,
      descriptionFr: enrichedData.descriptionFr,
      ingredientsFr: enrichedData.ingredientsFr || recipe.ingredients,
      instructionsFr: enrichedData.instructionsFr || [],
      nutrition: enrichedData.nutrition,
    }
  } catch (error) {
    console.warn('Recipe enrichment error:', error instanceof Error ? error.message : 'Unknown')
    return null
  }
}

/**
 * Batch enrich multiple Gustar recipes (max 3 at a time)
 * Returns a Map of recipe id -> enriched data
 */
export async function enrichRecipesBatch(
  recipes: RecipeToEnrich[]
): Promise<Map<string, EnrichedRecipe>> {
  const results = new Map<string, EnrichedRecipe>()

  if (recipes.length === 0) return results

  // Limit batch size to 3 for complete enrichment
  const batch = recipes.slice(0, 3)

  try {
    const recipesInfo = batch.map((r, i) => {
      const needsNutrition = !r.nutrition || r.nutrition.calories === 0
      const ingredientsList = r.ingredients
        .map(ing => `${ing.amount} ${ing.unit} ${ing.name}`)
        .join(', ')
      const instructionsList = r.instructions?.length
        ? r.instructions.join(' | ')
        : 'Aucune'

      return `
[Recette ${i + 1}]
ID: ${r.id}
Titre: ${r.title}
Description: ${r.description || 'Aucune'}
Portions: ${r.servings}
Ingrédients: ${ingredientsList}
Instructions: ${instructionsList}
Nutrition existante: ${needsNutrition ? 'MANQUANTE' : JSON.stringify(r.nutrition)}`
    }).join('\n\n')

    const prompt = `Tu es un expert en nutrition et traduction culinaire.

Voici ${batch.length} recettes en allemand à enrichir et traduire COMPLÈTEMENT en français:

${recipesInfo}

Réponds UNIQUEMENT avec un JSON valide (sans markdown) contenant un tableau:
[
  {
    "id": "id_de_la_recette",
    "titleFr": "Titre en français",
    "descriptionFr": "Description appétissante en français (2-3 phrases)",
    "ingredientsFr": [
      { "name": "ingrédient en français", "amount": quantité, "unit": "unité" },
      ...
    ],
    "instructionsFr": [
      "Étape 1...",
      "Étape 2...",
      ...
    ],
    "nutrition": { "calories": X, "proteins": X, "carbs": X, "fats": X }
  },
  ...
]

Pour chaque recette:
- Traduis le titre et la description en français
- Traduis TOUS les ingrédients en français avec les bonnes unités
- Traduis ou génère 4-8 étapes de préparation claires et détaillées en français
- Estime ou corrige les valeurs nutritionnelles par portion

Important: Réponds UNIQUEMENT avec le JSON, rien d'autre.`

    const response = await callOpenAI([{ role: 'user', content: prompt }], {
      maxTokens: 4000,
      temperature: 0.7,
      timeout: 45000,
    })

    const cleanJson = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const enrichedRecipes = JSON.parse(cleanJson) as EnrichedRecipe[]

    for (const enriched of enrichedRecipes) {
      results.set(enriched.id, enriched)
    }

    console.log(`Enriched ${results.size}/${batch.length} recipes successfully`)
  } catch (error) {
    console.warn('Batch enrichment error:', error instanceof Error ? error.message : 'Unknown')
  }

  return results
}

// ============= SHOPPING LIST =============

/**
 * Generate a shopping list from meal plan
 */
export async function generateShoppingList(params: {
  meals: Array<{ title: string; ingredients: string[] }>
  budget?: number
  servings?: number
}): Promise<{
  success: boolean
  list?: {
    categories: Array<{
      name: string
      items: Array<{ name: string; quantity: string; estimatedPrice: number }>
      subtotal: number
    }>
    total: number
    tips: string[]
  }
  error?: string
}> {
  try {
    const { meals, budget, servings = 2 } = params

    const prompt = `Tu es un assistant cuisine expert du marche francais.
Genere une liste de courses organisee par rayon de supermarche.

REPAS PREVUS:
${meals.map(m => `- ${m.title}: ${m.ingredients.join(', ')}`).join('\n')}

Nombre de portions par repas: ${servings}
${budget ? `Budget maximum: ${budget}EUR` : ''}

REGLES:
- Regrouper les ingredients similaires
- Estimer les quantites reelles a acheter
- Prix basés sur les supermarches francais (Carrefour, Leclerc, etc.)
- Proposer 2-3 astuces economie

Reponds UNIQUEMENT en JSON:
{
  "categories": [
    {
      "name": "Fruits et Legumes",
      "items": [
        { "name": "Tomates", "quantity": "500g", "estimatedPrice": 2.50 }
      ],
      "subtotal": 5.00
    }
  ],
  "total": 35.00,
  "tips": ["Astuce 1", "Astuce 2"]
}`

    const response = await callOpenAI([{ role: 'user', content: prompt }], {
      model: 'gpt-4o',
      maxTokens: 2000,
    })

    const list = extractJSON(response) as {
      categories: Array<{
        name: string
        items: Array<{ name: string; quantity: string; estimatedPrice: number }>
        subtotal: number
      }>
      total: number
      tips: string[]
    }

    return {
      success: true,
      list,
    }
  } catch (error) {
    console.error('Shopping list generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la generation',
    }
  }
}

// ============= WEEKLY PLANNER =============

/**
 * Generate a meal for a specific day/type in weekly plan
 */
export async function generatePlanMeal(params: {
  day: number // 0-6 (Sunday-Saturday)
  mealType: string
  userProfile: UserProfile
  targetCalories: number
  existingMeals: string[] // titles of meals already in the plan to avoid repetition
  isCheatMeal?: boolean
}): Promise<AIRecipeResult> {
  try {
    const { day, mealType, userProfile, targetCalories, existingMeals, isCheatMeal } = params

    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

    // Build user profile context (onboarding + préférences)
    const profileContext = generateUserProfileContext(userProfile)
    const preferenceHint = userProfile.mealSourcePreference
      ? `Preference de style (non stricte): ${userProfile.mealSourcePreference} (fresh=produits bruts, recipes=recettes, quick=rapide, balanced=mix)`
      : ''

    // Meal type specific constraints - based on French RAG knowledge
    const mealConstraints: Record<string, { description: string; minCal: number; maxCal: number; examples: string }> = {
      breakfast: {
        description: 'Petit-dejeuner SUCRE traditionnel francais (PAS de plats sales)',
        minCal: 250,
        maxCal: 500,
        examples: 'Tartines beurre-confiture, tartines miel, bol de cereales, yaourt nature avec miel, pain grille avec pate a tartiner, crepes maison, pancakes, bowl flocons avoine avec fruits et miel, pain perdu, croissant (week-end). INTERDIT: omelette, oeufs, jambon, fromage sale, bacon, sandwichs sales'
      },
      lunch: {
        description: 'Dejeuner complet avec proteines, feculents et legumes',
        minCal: 400,
        maxCal: 700,
        examples: 'Pates au beurre parmesan, riz au thon, omelette, croque-monsieur, poulet basquaise, boeuf bourguignon, salade nicoise, hachis parmentier'
      },
      snack: {
        description: 'Collation/gouter francais SUCRE (tradition depuis 1941)',
        minCal: 100,
        maxCal: 200,
        examples: 'Yaourt nature, pomme, banane, fromage blanc, pain avec carre de chocolat, compote, smoothie fruits, banana bread, gateau yaourt. INTERDIT: sandwichs, plats sales, fromages sales'
      },
      dinner: {
        description: 'Diner leger francais (soupe, salade, plat leger)',
        minCal: 350,
        maxCal: 600,
        examples: 'Soupe de legumes, omelette aux fines herbes, salade verte, poisson papillote, ratatouille, gratin de legumes, risotto aux champignons'
      },
    }

    const constraint = mealConstraints[mealType] || mealConstraints.lunch

    // Clamp target calories to realistic range
    const clampedCalories = Math.max(constraint.minCal, Math.min(constraint.maxCal, targetCalories))

    // Avoid repetition - only show last 5 meals
    const recentMeals = existingMeals.slice(-5)

    const prompt = `Tu es un chef cuisinier francais. Cree une recette FAIT MAISON.

REGLES STRICTES:
- Recette cuisinee a la maison avec ingredients frais
- PAS de plats industriels, pre-emballes, surgeles ou fast-food
- PAS de soupes en boite, conserves preparees, ou plats a rechauffer
- Calories totales: exactement ${clampedCalories} kcal (+-50 kcal)

${profileContext}
${preferenceHint}

Type: ${constraint.description}
Exemples acceptes: ${constraint.examples}
Jour: ${dayNames[day]}
${isCheatMeal ? 'NOTE: Repas plaisir du week-end - peut etre plus gourmand mais toujours fait maison!' : ''}
${recentMeals.length > 0 ? `Eviter (deja dans le plan): ${recentMeals.join(', ')}` : ''}

Reponds UNIQUEMENT en JSON valide:
{
  "title": "Nom du plat",
  "description": "Description courte",
  "ingredients": [
    {"name": "ingredient", "amount": "quantite avec unite", "calories": nombre}
  ],
  "instructions": ["etape 1", "etape 2"],
  "nutrition": {"calories": ${clampedCalories}, "proteins": nombre, "carbs": nombre, "fats": nombre},
  "prepTime": nombre_minutes,
  "servings": 1
}`

    const response = await callOpenAI([{ role: 'user', content: prompt }], {
      maxTokens: 1200,
      timeout: 45000,
    })

    let parsed: unknown
    try {
      parsed = extractJSON(response)
    } catch {
      const repairPrompt = `Corrige la sortie suivante pour qu'elle devienne un JSON STRICTEMENT valide (aucun texte autour) conforme au schema attendu.

SORTIE A CORRIGER:
${response}

SCHEMA:
{
  "title": "Nom du plat",
  "description": "Description courte",
  "ingredients": [
    {"name": "ingredient", "amount": "quantite avec unite", "calories": 123}
  ],
  "instructions": ["etape 1", "etape 2"],
  "nutrition": {"calories": ${clampedCalories}, "proteins": 30, "carbs": 40, "fats": 15},
  "prepTime": 20,
  "servings": 1
}
`
      const repaired = await callOpenAI([{ role: 'user', content: repairPrompt }], {
        maxTokens: 900,
        temperature: 0,
        timeout: 45000,
      })
      parsed = extractJSON(repaired)
    }

    const recipe = AiRecipeSchema.parse(parsed) as AIRecipe

    // Normalize nutrition sanity
    const diff = Math.abs(recipe.nutrition.calories - clampedCalories)
    if (diff > clampedCalories * 0.25) {
      recipe.nutrition.calories = clampedCalories
    }
    recipe.nutrition.proteins = Math.max(0, Math.round(recipe.nutrition.proteins))
    recipe.nutrition.carbs = Math.max(0, Math.round(recipe.nutrition.carbs))
    recipe.nutrition.fats = Math.max(0, Math.round(recipe.nutrition.fats))
    recipe.prepTime = Math.max(0, Math.round(recipe.prepTime))
    recipe.servings = 1

    return {
      success: true,
      recipe,
    }
  } catch (error) {
    console.error('Plan meal generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la generation',
    }
  }
}

const aiService = {
  // API Key
  setOpenAIApiKey,
  getOpenAIApiKey,
  hasOpenAIApiKey,
  clearOpenAIApiKey,
  // Food Analysis
  analyzeFood,
  analyzeFoodDescription,
  // Recipe
  generateRecipe,
  suggestMeal,
  translateRecipe,
  translateRecipesBatch,
  translateGustarRecipesFast,
  generateRecipeImage,
  // Planning
  generateShoppingList,
  generatePlanMeal,
}

export default aiService
