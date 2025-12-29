/**
 * RAG Service - Retrieval-Augmented Generation for LymIA Coach
 *
 * Handles:
 * - Intelligent source selection for meal plans (Gustar, CIQUAL, OFF, AI)
 * - Knowledge base queries for coach responses
 * - Context-aware meal recommendations
 */

import { queryKnowledgeBase, isSupabaseConfigured, type KnowledgeBaseEntry } from './supabase-client'
import { loadStaticRecipes, filterStaticRecipes, getStaticRecipesByMealType, staticToRecipe, type StaticEnrichedRecipe } from './static-recipes'
import { generatePlanMeal, type AIRecipe } from './ai-service'
import { LymIABrain, type UserContext } from './lymia-brain'
import type { UserProfile, Recipe, NutritionInfo } from '../types'

// ============= TYPES =============

export type MealSource = 'gustar' | 'ciqual' | 'off' | 'ai'

export interface MealSourceDecision {
  source: MealSource
  confidence: number // 0-1
  reason: string
  fallbackSources: MealSource[]
}

export interface SourcedMeal {
  source: MealSource
  recipe?: Recipe
  aiRecipe?: AIRecipe
  ciqualFood?: CIQUALFood
  offProduct?: OFFProduct
  nutrition: NutritionInfo
  confidence: number
}

export interface CIQUALFood {
  code: string
  name: string
  category: string
  nutrition: NutritionInfo
  portion: number // grams
}

export interface OFFProduct {
  code: string
  name: string
  brand?: string
  imageUrl?: string
  nutrition: NutritionInfo
  portion: number // grams
  nutriscore?: string
  nova?: number
}

export interface RAGContext {
  userProfile: UserProfile
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  targetCalories: number
  consumed: NutritionInfo
  day: number // 0-6
  existingMeals: string[]
  preferences?: {
    preferHomemade?: boolean
    preferQuick?: boolean
    preferHealthy?: boolean
  }
}

export interface CoachQuery {
  query: string
  userContext: RAGContext
  categories?: KnowledgeBaseEntry['category'][]
}

export interface CoachResponse {
  answer: string
  sources: Array<{
    title: string
    source: string
    relevance: number
  }>
  suggestedActions?: string[]
}

// ============= OPEN FOOD FACTS API =============

const OFF_API_BASE = 'https://world.openfoodfacts.org/api/v2'
const OFF_FR_API_BASE = 'https://fr.openfoodfacts.org/api/v2'

/**
 * Search Open Food Facts for a product
 */
export async function searchOFF(query: string, limit: number = 10): Promise<OFFProduct[]> {
  try {
    const url = `${OFF_FR_API_BASE}/search?search_terms=${encodeURIComponent(query)}&fields=code,product_name_fr,brands,image_url,nutriments,serving_size,nutriscore_grade,nova_group&page_size=${limit}&json=1`

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Presence-App/1.0' },
    })

    if (!response.ok) return []

    const data = await response.json()
    const products: OFFProduct[] = []

    for (const product of data.products || []) {
      if (!product.nutriments) continue

      const nutriments = product.nutriments
      const portion = parseFloat(product.serving_size) || 100

      products.push({
        code: product.code,
        name: product.product_name_fr || product.product_name || 'Produit inconnu',
        brand: product.brands,
        imageUrl: product.image_url,
        nutrition: {
          calories: Math.round((nutriments['energy-kcal_100g'] || 0) * portion / 100),
          proteins: Math.round((nutriments.proteins_100g || 0) * portion / 100),
          carbs: Math.round((nutriments.carbohydrates_100g || 0) * portion / 100),
          fats: Math.round((nutriments.fat_100g || 0) * portion / 100),
        },
        portion,
        nutriscore: product.nutriscore_grade,
        nova: product.nova_group,
      })
    }

    return products
  } catch (error) {
    console.warn('OFF search error:', error)
    return []
  }
}

/**
 * Get OFF product by barcode
 */
export async function getOFFByBarcode(barcode: string): Promise<OFFProduct | null> {
  try {
    const url = `${OFF_API_BASE}/product/${barcode}.json`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Presence-App/1.0' },
    })

    if (!response.ok) return null

    const data = await response.json()
    const product = data.product

    if (!product || !product.nutriments) return null

    const nutriments = product.nutriments
    const portion = parseFloat(product.serving_size) || 100

    return {
      code: product.code,
      name: product.product_name_fr || product.product_name || 'Produit inconnu',
      brand: product.brands,
      imageUrl: product.image_url,
      nutrition: {
        calories: Math.round((nutriments['energy-kcal_100g'] || 0) * portion / 100),
        proteins: Math.round((nutriments.proteins_100g || 0) * portion / 100),
        carbs: Math.round((nutriments.carbohydrates_100g || 0) * portion / 100),
        fats: Math.round((nutriments.fat_100g || 0) * portion / 100),
      },
      portion,
      nutriscore: product.nutriscore_grade,
      nova: product.nova_group,
    }
  } catch (error) {
    console.warn('OFF barcode error:', error)
    return null
  }
}

// ============= CIQUAL (via local data or API) =============

// For now, CIQUAL data would come from the knowledge base or bundled JSON
// In production, we'd have a CIQUAL database or API

/**
 * Search CIQUAL foods (via knowledge base)
 */
export async function searchCIQUAL(query: string): Promise<CIQUALFood[]> {
  if (!isSupabaseConfigured()) return []

  const result = await queryKnowledgeBase(query, {
    source: 'ciqual',
    category: 'nutrition',
    limit: 10,
  })

  if (!result) return []

  return result.entries.map(entry => {
    const meta = entry.metadata as {
      code?: string
      name?: string
      category?: string
      calories?: number
      proteins?: number
      carbs?: number
      fats?: number
      portion?: number
    }

    return {
      code: meta.code || entry.id,
      name: meta.name || entry.content.slice(0, 50),
      category: meta.category || 'general',
      nutrition: {
        calories: meta.calories || 0,
        proteins: meta.proteins || 0,
        carbs: meta.carbs || 0,
        fats: meta.fats || 0,
      },
      portion: meta.portion || 100,
    }
  })
}

// ============= SOURCE SELECTION LOGIC =============

/**
 * Decide which source to use for a meal based on context
 */
export function decideMealSource(context: RAGContext): MealSourceDecision {
  const { userProfile, mealType, targetCalories, preferences } = context

  // Check for complex dietary restrictions
  const hasComplexRestrictions = (userProfile.allergies?.length || 0) > 2 ||
    userProfile.religiousDiet !== undefined ||
    ['vegan', 'keto', 'paleo'].includes(userProfile.dietType || '')

  // Check for very specific calorie targets
  const isStrictCalories = targetCalories < 200 || targetCalories > 800

  // Decision logic
  let source: MealSource = 'gustar'
  let confidence = 0.8
  let reason = ''
  const fallbackSources: MealSource[] = []

  // Snacks -> prefer OFF/CIQUAL (simple foods)
  if (mealType === 'snack') {
    source = 'off'
    confidence = 0.85
    reason = 'Collation simple - Open Food Facts pour aliments du commerce'
    fallbackSources.push('ciqual', 'ai')
  }
  // Breakfast -> Gustar has good breakfast recipes
  else if (mealType === 'breakfast') {
    if (preferences?.preferQuick) {
      source = 'off'
      confidence = 0.75
      reason = 'Petit-dejeuner rapide - produits du commerce'
      fallbackSources.push('gustar', 'ai')
    } else {
      source = 'gustar'
      confidence = 0.8
      reason = 'Petit-dejeuner maison - recettes enrichies Gustar'
      fallbackSources.push('ai', 'off')
    }
  }
  // Lunch/Dinner -> Gustar for elaborate meals
  else if (mealType === 'lunch' || mealType === 'dinner') {
    if (hasComplexRestrictions) {
      source = 'ai'
      confidence = 0.9
      reason = 'Restrictions complexes - IA pour personnalisation max'
      fallbackSources.push('gustar')
    } else {
      source = 'gustar'
      confidence = 0.85
      reason = 'Repas elabore - recettes completes avec instructions'
      fallbackSources.push('ai', 'ciqual')
    }
  }

  // Override: strict calories need AI precision
  if (isStrictCalories && source !== 'ai') {
    source = 'ai'
    confidence = 0.9
    reason = 'Budget calorique strict - IA pour precision'
    fallbackSources.unshift('gustar')
  }

  // Override: user prefers homemade
  if (preferences?.preferHomemade && source === 'off') {
    source = 'gustar'
    confidence = 0.8
    reason = 'Preference fait maison - recettes Gustar'
    fallbackSources.unshift('ai')
  }

  return { source, confidence, reason, fallbackSources }
}

// ============= MEAL RETRIEVAL =============

/**
 * Get meal from Gustar (pre-enriched recipes)
 */
async function getMealFromGustar(context: RAGContext): Promise<SourcedMeal | null> {
  await loadStaticRecipes()

  const { mealType, targetCalories, userProfile } = context

  // Filter recipes by meal type and calories
  const recipes = filterStaticRecipes({
    mealType,
    maxCalories: targetCalories + 100,
    limit: 10,
  })

  if (recipes.length === 0) {
    // Fallback: get any recipe for this meal type
    const fallback = getStaticRecipesByMealType(mealType)
    if (fallback.length === 0) return null

    const recipe = fallback[Math.floor(Math.random() * fallback.length)]
    return {
      source: 'gustar',
      recipe: staticToRecipe(recipe),
      nutrition: recipe.nutrition,
      confidence: 0.6,
    }
  }

  // Find best match by calories
  const sorted = recipes.sort((a, b) => {
    const diffA = Math.abs(a.nutrition.calories - targetCalories)
    const diffB = Math.abs(b.nutrition.calories - targetCalories)
    return diffA - diffB
  })

  // Check for allergies
  const allergyFree = sorted.filter(recipe => {
    if (!userProfile.allergies?.length) return true
    const content = `${recipe.titleFr} ${recipe.ingredientsFr.map(i => i.name).join(' ')}`.toLowerCase()
    return !userProfile.allergies.some(allergy => content.includes(allergy.toLowerCase()))
  })

  const best = allergyFree[0] || sorted[0]

  return {
    source: 'gustar',
    recipe: staticToRecipe(best),
    nutrition: best.nutrition,
    confidence: 0.85,
  }
}

/**
 * Get meal from Open Food Facts
 */
async function getMealFromOFF(context: RAGContext): Promise<SourcedMeal | null> {
  const { mealType, targetCalories } = context

  // Search terms by meal type
  const searchTerms: Record<string, string[]> = {
    breakfast: ['cereales', 'muesli', 'yaourt', 'pain', 'confiture'],
    lunch: ['salade', 'sandwich', 'wrap', 'plat prepare'],
    snack: ['barre cereales', 'fruit sec', 'biscuit', 'compote'],
    dinner: ['soupe', 'plat cuisine', 'legumes'],
  }

  const terms = searchTerms[mealType] || ['aliment']
  const randomTerm = terms[Math.floor(Math.random() * terms.length)]

  const products = await searchOFF(randomTerm, 20)

  if (products.length === 0) return null

  // Filter by calories and nutriscore
  const suitable = products.filter(p => {
    const calOk = p.nutrition.calories <= targetCalories + 50 && p.nutrition.calories >= targetCalories * 0.5
    const scoreOk = !p.nutriscore || ['a', 'b', 'c'].includes(p.nutriscore)
    return calOk && scoreOk
  })

  if (suitable.length === 0) return null

  const best = suitable[0]

  return {
    source: 'off',
    offProduct: best,
    nutrition: best.nutrition,
    confidence: 0.75,
  }
}

/**
 * Get meal from AI generation
 */
async function getMealFromAI(context: RAGContext): Promise<SourcedMeal | null> {
  const { day, mealType, userProfile, targetCalories, existingMeals } = context

  const result = await generatePlanMeal({
    day,
    mealType,
    userProfile,
    targetCalories,
    existingMeals,
  })

  if (!result.success || !result.recipe) return null

  return {
    source: 'ai',
    aiRecipe: result.recipe,
    nutrition: result.recipe.nutrition,
    confidence: 0.9,
  }
}

// ============= MAIN RAG FUNCTIONS =============

/**
 * Get a meal using RAG source selection
 */
export async function getRAGMeal(context: RAGContext): Promise<SourcedMeal | null> {
  const decision = decideMealSource(context)

  console.log(`RAG: ${decision.source} selected (${Math.round(decision.confidence * 100)}%) - ${decision.reason}`)

  // Try primary source
  let meal: SourcedMeal | null = null

  switch (decision.source) {
    case 'gustar':
      meal = await getMealFromGustar(context)
      break
    case 'off':
      meal = await getMealFromOFF(context)
      break
    case 'ciqual':
      // CIQUAL needs knowledge base - fallback to OFF for now
      meal = await getMealFromOFF(context)
      break
    case 'ai':
      meal = await getMealFromAI(context)
      break
  }

  // Try fallbacks if primary failed
  if (!meal && decision.fallbackSources.length > 0) {
    for (const fallback of decision.fallbackSources) {
      console.log(`RAG: Trying fallback source: ${fallback}`)

      switch (fallback) {
        case 'gustar':
          meal = await getMealFromGustar(context)
          break
        case 'off':
          meal = await getMealFromOFF(context)
          break
        case 'ai':
          meal = await getMealFromAI(context)
          break
      }

      if (meal) break
    }
  }

  return meal
}

/**
 * Query knowledge base for coach response
 */
export async function queryCoach(query: CoachQuery): Promise<CoachResponse | null> {
  if (!isSupabaseConfigured()) {
    // Fallback: return null, coach will use AI directly without RAG
    return null
  }

  const categories = query.categories || ['nutrition', 'wellness', 'metabolism', 'sport', 'health']

  // Query knowledge base for relevant content
  const results = await Promise.all(
    categories.map(cat => queryKnowledgeBase(query.query, { category: cat, limit: 3 }))
  )

  const allEntries: Array<{ entry: KnowledgeBaseEntry; score: number }> = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (!result) continue

    for (let j = 0; j < result.entries.length; j++) {
      allEntries.push({
        entry: result.entries[j],
        score: result.similarity_scores[j] || 0.5,
      })
    }
  }

  // Sort by relevance
  allEntries.sort((a, b) => b.score - a.score)

  // Take top 5 most relevant
  const topEntries = allEntries.slice(0, 5)

  if (topEntries.length === 0) {
    return null
  }

  return {
    answer: '', // Will be generated by LLM with this context
    sources: topEntries.map(e => ({
      title: (e.entry.metadata?.title as string) || e.entry.content.slice(0, 50),
      source: e.entry.source,
      relevance: e.score,
    })),
    suggestedActions: [],
  }
}

/**
 * Get intelligent meal recommendations using LymIA Brain
 * This is the PREFERRED method - uses full AI context
 */
export async function getLymIAMealRecommendations(
  context: RAGContext,
  existingMealNames: string[] = []
): Promise<{
  suggestions: Array<{
    name: string
    calories: number
    proteins: number
    carbs: number
    fats: number
    prepTime: number
    reason: string
  }>
  reasoning: string
}> {
  // Build LymIA context from RAG context
  const userContext: UserContext = {
    profile: context.userProfile,
    todayNutrition: context.consumed,
    weeklyAverage: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
    currentStreak: 0,
    lastMeals: existingMealNames,
    wellnessData: {},
  }

  try {
    const result = await LymIABrain.getMealRecommendations(
      userContext,
      context.mealType,
      context.targetCalories
    )

    return {
      suggestions: result.suggestions,
      reasoning: result.reasoning,
    }
  } catch (error) {
    console.error('LymIA meal recommendations failed:', error)
    return {
      suggestions: [],
      reasoning: 'Service temporairement indisponible',
    }
  }
}

/**
 * Build RAG context from user stores
 */
export function buildRAGContext(params: {
  userProfile: UserProfile
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  day: number
  dailyTarget: number
  consumed: NutritionInfo
  existingMeals: string[]
}): RAGContext {
  const { userProfile, mealType, day, dailyTarget, consumed, existingMeals } = params

  // Calculate remaining calories for this meal
  const remaining = dailyTarget - consumed.calories
  const mealRatios: Record<string, number> = {
    breakfast: 0.25,
    lunch: 0.35,
    snack: 0.1,
    dinner: 0.3,
  }

  const targetCalories = Math.max(100, Math.round(remaining * (mealRatios[mealType] || 0.25)))

  return {
    userProfile,
    mealType,
    targetCalories,
    consumed,
    day,
    existingMeals,
    preferences: {
      preferHomemade: true,
      preferHealthy: userProfile.goal === 'health' || userProfile.goal === 'weight_loss',
    },
  }
}

export default {
  // Source selection
  decideMealSource,
  getRAGMeal,
  buildRAGContext,

  // LymIA Brain integration
  getLymIAMealRecommendations,

  // External APIs
  searchOFF,
  getOFFByBarcode,
  searchCIQUAL,

  // Coach
  queryCoach,
}
