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

// Extended nutrition info for Nutri-Score calculation
export interface ExtendedNutritionInfo extends NutritionInfo {
  sugar?: number      // grams per 100g
  saturatedFat?: number // grams per 100g
  fiber?: number      // grams per 100g
  sodium?: number     // mg per 100g (salt = sodium * 2.5)
  fruits?: number     // % fruits/vegetables/nuts
}

export interface CIQUALFood {
  code: string
  name: string
  category: string
  nutrition: NutritionInfo
  extendedNutrition?: ExtendedNutritionInfo // For Nutri-Score calculation
  portion: number // grams
  nutriscore?: NutriScoreGrade // Calculated Nutri-Score
}

// Nutri-Score grades (A is best, E is worst)
export type NutriScoreGrade = 'a' | 'b' | 'c' | 'd' | 'e' | 'unknown'

export interface OFFProduct {
  code: string
  name: string
  brand?: string
  imageUrl?: string
  nutrition: NutritionInfo
  extendedNutrition?: ExtendedNutritionInfo // Extended nutrition data
  portion: number // grams
  nutriscore?: NutriScoreGrade
  nova?: number // NOVA classification (1-4)
}

export interface RAGContext {
  userProfile: UserProfile
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  targetCalories: number
  consumed: NutritionInfo
  day: number // 0-6
  existingMeals: string[]
  excludeRecipeIds?: string[] // Recipe IDs to exclude (for "Autre suggestion" button)
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

// ============= NUTRI-SCORE CALCULATION =============

/**
 * Calculate Nutri-Score based on nutritional values per 100g
 * Based on the official French/EU Nutri-Score algorithm
 *
 * Negative points (0-40): energy, sugar, saturated fat, sodium
 * Positive points (0-15): fiber, protein, fruits/vegetables/nuts
 * Final score = negative - positive
 *
 * Grade thresholds:
 * A: -1 to -15 (best)
 * B: 0 to 2
 * C: 3 to 10
 * D: 11 to 18
 * E: 19+ (worst)
 */
export function calculateNutriScore(nutrition: ExtendedNutritionInfo): { score: number; grade: NutriScoreGrade } {
  // Default values if not provided
  const energy = nutrition.calories * 4.184 // Convert kcal to kJ
  const sugar = nutrition.sugar ?? 0
  const saturatedFat = nutrition.saturatedFat ?? 0
  const sodium = nutrition.sodium ?? 0
  const fiber = nutrition.fiber ?? 0
  const proteins = nutrition.proteins
  const fruits = nutrition.fruits ?? 0

  // === NEGATIVE POINTS ===

  // Energy points (kJ/100g)
  let energyPoints = 0
  if (energy > 3350) energyPoints = 10
  else if (energy > 3015) energyPoints = 9
  else if (energy > 2680) energyPoints = 8
  else if (energy > 2345) energyPoints = 7
  else if (energy > 2010) energyPoints = 6
  else if (energy > 1675) energyPoints = 5
  else if (energy > 1340) energyPoints = 4
  else if (energy > 1005) energyPoints = 3
  else if (energy > 670) energyPoints = 2
  else if (energy > 335) energyPoints = 1

  // Sugar points (g/100g)
  let sugarPoints = 0
  if (sugar > 45) sugarPoints = 10
  else if (sugar > 40) sugarPoints = 9
  else if (sugar > 36) sugarPoints = 8
  else if (sugar > 31) sugarPoints = 7
  else if (sugar > 27) sugarPoints = 6
  else if (sugar > 22.5) sugarPoints = 5
  else if (sugar > 18) sugarPoints = 4
  else if (sugar > 13.5) sugarPoints = 3
  else if (sugar > 9) sugarPoints = 2
  else if (sugar > 4.5) sugarPoints = 1

  // Saturated fat points (g/100g)
  let satFatPoints = 0
  if (saturatedFat > 10) satFatPoints = 10
  else if (saturatedFat > 9) satFatPoints = 9
  else if (saturatedFat > 8) satFatPoints = 8
  else if (saturatedFat > 7) satFatPoints = 7
  else if (saturatedFat > 6) satFatPoints = 6
  else if (saturatedFat > 5) satFatPoints = 5
  else if (saturatedFat > 4) satFatPoints = 4
  else if (saturatedFat > 3) satFatPoints = 3
  else if (saturatedFat > 2) satFatPoints = 2
  else if (saturatedFat > 1) satFatPoints = 1

  // Sodium points (mg/100g)
  let sodiumPoints = 0
  if (sodium > 900) sodiumPoints = 10
  else if (sodium > 810) sodiumPoints = 9
  else if (sodium > 720) sodiumPoints = 8
  else if (sodium > 630) sodiumPoints = 7
  else if (sodium > 540) sodiumPoints = 6
  else if (sodium > 450) sodiumPoints = 5
  else if (sodium > 360) sodiumPoints = 4
  else if (sodium > 270) sodiumPoints = 3
  else if (sodium > 180) sodiumPoints = 2
  else if (sodium > 90) sodiumPoints = 1

  const negativePoints = energyPoints + sugarPoints + satFatPoints + sodiumPoints

  // === POSITIVE POINTS ===

  // Fiber points (g/100g)
  let fiberPoints = 0
  if (fiber > 4.7) fiberPoints = 5
  else if (fiber > 3.7) fiberPoints = 4
  else if (fiber > 2.8) fiberPoints = 3
  else if (fiber > 1.9) fiberPoints = 2
  else if (fiber > 0.9) fiberPoints = 1

  // Protein points (g/100g)
  let proteinPoints = 0
  if (proteins > 8) proteinPoints = 5
  else if (proteins > 6.4) proteinPoints = 4
  else if (proteins > 4.8) proteinPoints = 3
  else if (proteins > 3.2) proteinPoints = 2
  else if (proteins > 1.6) proteinPoints = 1

  // Fruits/vegetables/nuts points (%)
  let fruitsPoints = 0
  if (fruits > 80) fruitsPoints = 5
  else if (fruits > 60) fruitsPoints = 2
  else if (fruits > 40) fruitsPoints = 1

  // Special rule: if negative >= 11 and fruits < 5, don't count proteins
  let positivePoints = fiberPoints + fruitsPoints
  if (negativePoints < 11 || fruitsPoints >= 5) {
    positivePoints += proteinPoints
  }

  // Calculate final score
  const score = negativePoints - positivePoints

  // Determine grade
  let grade: NutriScoreGrade
  if (score <= -1) grade = 'a'
  else if (score <= 2) grade = 'b'
  else if (score <= 10) grade = 'c'
  else if (score <= 18) grade = 'd'
  else grade = 'e'

  return { score, grade }
}

/**
 * Estimate Nutri-Score from basic nutrition when extended data is not available
 * This is an approximation and may not be as accurate as the official algorithm
 */
export function estimateNutriScore(nutrition: NutritionInfo): NutriScoreGrade {
  const { calories, proteins, carbs, fats } = nutrition

  // Simple heuristic based on available data
  let score = 0

  // Calories penalty (per 100g equivalent)
  if (calories > 400) score += 4
  else if (calories > 300) score += 3
  else if (calories > 200) score += 2
  else if (calories > 100) score += 1

  // Fat penalty
  if (fats > 20) score += 4
  else if (fats > 15) score += 3
  else if (fats > 10) score += 2
  else if (fats > 5) score += 1

  // Protein bonus
  if (proteins > 15) score -= 3
  else if (proteins > 10) score -= 2
  else if (proteins > 5) score -= 1

  // Carbs (neutral unless very high)
  if (carbs > 60) score += 2
  else if (carbs > 40) score += 1

  // Convert to grade
  if (score <= 0) return 'a'
  if (score <= 3) return 'b'
  if (score <= 6) return 'c'
  if (score <= 9) return 'd'
  return 'e'
}

// ============= OPEN FOOD FACTS API =============

const OFF_API_BASE = 'https://world.openfoodfacts.org/api/v2'
const OFF_FR_API_BASE = 'https://fr.openfoodfacts.org/api/v2'

/**
 * Search Open Food Facts for a product
 * Returns products with Nutri-Score and extended nutrition data
 */
export async function searchOFF(query: string, limit: number = 10): Promise<OFFProduct[]> {
  try {
    // Request extended nutrition fields for Nutri-Score
    const fields = 'code,product_name_fr,product_name,brands,image_url,nutriments,serving_size,nutriscore_grade,nova_group,fruits-vegetables-nuts_100g'
    const url = `${OFF_FR_API_BASE}/search?search_terms=${encodeURIComponent(query)}&fields=${fields}&page_size=${limit}&json=1`

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

      // Extended nutrition data per 100g
      const extendedNutrition: ExtendedNutritionInfo = {
        calories: nutriments['energy-kcal_100g'] || 0,
        proteins: nutriments.proteins_100g || 0,
        carbs: nutriments.carbohydrates_100g || 0,
        fats: nutriments.fat_100g || 0,
        sugar: nutriments.sugars_100g,
        saturatedFat: nutriments['saturated-fat_100g'],
        fiber: nutriments.fiber_100g,
        sodium: nutriments.sodium_100g ? nutriments.sodium_100g * 1000 : undefined, // Convert to mg
        fruits: product['fruits-vegetables-nuts_100g'],
      }

      // Get Nutri-Score from API or calculate it
      let nutriscore: NutriScoreGrade = product.nutriscore_grade?.toLowerCase() as NutriScoreGrade
      if (!nutriscore || !['a', 'b', 'c', 'd', 'e'].includes(nutriscore)) {
        // Calculate if not provided by API
        if (extendedNutrition.sugar !== undefined || extendedNutrition.saturatedFat !== undefined) {
          const calculated = calculateNutriScore(extendedNutrition)
          nutriscore = calculated.grade
        } else {
          nutriscore = estimateNutriScore(extendedNutrition)
        }
      }

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
        extendedNutrition,
        portion,
        nutriscore,
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
 * Returns product with Nutri-Score and extended nutrition data
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

    // Extended nutrition data per 100g
    const extendedNutrition: ExtendedNutritionInfo = {
      calories: nutriments['energy-kcal_100g'] || 0,
      proteins: nutriments.proteins_100g || 0,
      carbs: nutriments.carbohydrates_100g || 0,
      fats: nutriments.fat_100g || 0,
      sugar: nutriments.sugars_100g,
      saturatedFat: nutriments['saturated-fat_100g'],
      fiber: nutriments.fiber_100g,
      sodium: nutriments.sodium_100g ? nutriments.sodium_100g * 1000 : undefined,
      fruits: product['fruits-vegetables-nuts_100g'],
    }

    // Get Nutri-Score from API or calculate it
    let nutriscore: NutriScoreGrade = product.nutriscore_grade?.toLowerCase() as NutriScoreGrade
    if (!nutriscore || !['a', 'b', 'c', 'd', 'e'].includes(nutriscore)) {
      if (extendedNutrition.sugar !== undefined || extendedNutrition.saturatedFat !== undefined) {
        const calculated = calculateNutriScore(extendedNutrition)
        nutriscore = calculated.grade
      } else {
        nutriscore = estimateNutriScore(extendedNutrition)
      }
    }

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
      extendedNutrition,
      portion,
      nutriscore,
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
 * Returns foods with calculated Nutri-Score based on extended nutrition data
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
      sugar?: number
      saturatedFat?: number
      fiber?: number
      sodium?: number
      portion?: number
    }

    const nutrition: NutritionInfo = {
      calories: meta.calories || 0,
      proteins: meta.proteins || 0,
      carbs: meta.carbs || 0,
      fats: meta.fats || 0,
    }

    // Build extended nutrition for Nutri-Score calculation
    const extendedNutrition: ExtendedNutritionInfo = {
      ...nutrition,
      sugar: meta.sugar,
      saturatedFat: meta.saturatedFat,
      fiber: meta.fiber,
      sodium: meta.sodium,
    }

    // Calculate Nutri-Score for CIQUAL foods
    let nutriscore: NutriScoreGrade
    if (meta.sugar !== undefined || meta.saturatedFat !== undefined) {
      const calculated = calculateNutriScore(extendedNutrition)
      nutriscore = calculated.grade
    } else {
      // Estimate if extended data not available
      nutriscore = estimateNutriScore(nutrition)
    }

    return {
      code: meta.code || entry.id,
      name: meta.name || entry.content.slice(0, 50),
      category: meta.category || 'general',
      nutrition,
      extendedNutrition,
      portion: meta.portion || 100,
      nutriscore,
    }
  })
}

// ============= SOURCE SELECTION LOGIC =============

/**
 * Decide which source to use for a meal based on context
 */
export function decideMealSource(context: RAGContext): MealSourceDecision {
  console.log('[RAG:decide] decideMealSource called')
  const { userProfile, mealType, targetCalories, preferences } = context
  console.log('[RAG:decide] mealType:', mealType, 'targetCalories:', targetCalories)

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

  console.log('[RAG:decide] Decision:', { source, confidence, reason, fallbackSources })
  return { source, confidence, reason, fallbackSources }
}

// ============= MEAL RETRIEVAL =============

/**
 * Get meal from Gustar (pre-enriched recipes)
 */
async function getMealFromGustar(context: RAGContext): Promise<SourcedMeal | null> {
  console.log('[RAG:Gustar] ======= getMealFromGustar START =======')
  console.log('[RAG:Gustar] Loading static recipes...')
  const allRecipes = await loadStaticRecipes()
  console.log('[RAG:Gustar] Total recipes loaded:', allRecipes.length)

  const { mealType, targetCalories, userProfile, excludeRecipeIds = [] } = context
  console.log(`[RAG:Gustar] Filtering for ${mealType}, target ${targetCalories} kcal`)
  if (excludeRecipeIds.length > 0) {
    console.log(`[RAG:Gustar] Excluding ${excludeRecipeIds.length} recipe(s):`, excludeRecipeIds)
  }

  // Filter recipes by meal type and calories
  let recipes = filterStaticRecipes({
    mealType,
    maxCalories: targetCalories + 100,
    limit: 20, // Fetch more to account for exclusions
  })

  // Exclude specific recipe IDs (for "Autre suggestion" feature)
  if (excludeRecipeIds.length > 0) {
    recipes = recipes.filter(r => !excludeRecipeIds.includes(r.id))
    console.log(`[RAG:Gustar] After exclusion: ${recipes.length} recipes`)
  }

  console.log(`[RAG:Gustar] Filtered recipes: ${recipes.length}`)

  if (recipes.length === 0) {
    // Fallback: get any recipe for this meal type (excluding excluded ones)
    console.log(`[RAG:Gustar] No filtered recipes, trying fallback by meal type`)
    let fallback = getStaticRecipesByMealType(mealType)
    if (excludeRecipeIds.length > 0) {
      fallback = fallback.filter(r => !excludeRecipeIds.includes(r.id))
    }
    console.log(`[RAG:Gustar] Fallback recipes: ${fallback.length}`)
    if (fallback.length === 0) return null

    const recipe = fallback[Math.floor(Math.random() * fallback.length)]
    console.log(`[RAG:Gustar] Using fallback: ${recipe.titleFr}`)
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

  // Pick from top 3 for variety (instead of always the best match)
  const candidates = allergyFree.length > 0 ? allergyFree : sorted
  const topCandidates = candidates.slice(0, Math.min(3, candidates.length))
  const best = topCandidates[Math.floor(Math.random() * topCandidates.length)]
  console.log(`[RAG:Gustar] Selected: ${best.titleFr} (${best.nutrition.calories} kcal) from ${topCandidates.length} candidates`)

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
  console.log('='.repeat(50))
  console.log('[RAG] === getRAGMeal START ===')
  console.log(`[RAG] Context: mealType=${context.mealType}, targetCalories=${context.targetCalories}`)
  console.log(`[RAG] Full context:`, JSON.stringify(context, null, 2))
  console.log('='.repeat(50))

  const decision = decideMealSource(context)

  console.log(`[RAG] Source decision: ${decision.source} (${Math.round(decision.confidence * 100)}%) - ${decision.reason}`)

  // Try primary source
  let meal: SourcedMeal | null = null

  try {
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
    console.log(`[RAG] Primary source result: ${meal ? 'SUCCESS' : 'NULL'}`)
  } catch (error) {
    console.error(`[RAG] Primary source error:`, error)
  }

  // Try fallbacks if primary failed
  if (!meal && decision.fallbackSources.length > 0) {
    console.log(`[RAG] Trying fallbacks: ${decision.fallbackSources.join(', ')}`)

    for (const fallback of decision.fallbackSources) {
      console.log(`[RAG] Trying fallback: ${fallback}`)

      try {
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
        console.log(`[RAG] Fallback ${fallback} result: ${meal ? 'SUCCESS' : 'NULL'}`)
      } catch (error) {
        console.error(`[RAG] Fallback ${fallback} error:`, error)
      }

      if (meal) break
    }
  }

  console.log(`[RAG] === getRAGMeal END === Result: ${meal ? meal.source : 'NULL'}`)
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
  overrideTargetCalories?: number // Optional override to bypass remaining-based calculation
  excludeRecipeIds?: string[] // Recipe IDs to exclude (for "Autre suggestion")
}): RAGContext {
  const { userProfile, mealType, day, dailyTarget, consumed, existingMeals, overrideTargetCalories, excludeRecipeIds } = params

  // Calculate target calories for this meal
  const mealRatios: Record<string, number> = {
    breakfast: 0.25,
    lunch: 0.35,
    snack: 0.1,
    dinner: 0.3,
  }

  let targetCalories: number
  if (overrideTargetCalories !== undefined) {
    // Use override if provided (for single meal generation)
    targetCalories = overrideTargetCalories
  } else {
    // Calculate from remaining calories (for meal plan generation)
    const remaining = dailyTarget - consumed.calories
    targetCalories = Math.max(100, Math.round(remaining * (mealRatios[mealType] || 0.25)))
  }

  console.log(`[RAG:Context] mealType=${mealType}, daily=${dailyTarget}, consumed=${consumed.calories}, override=${overrideTargetCalories}, final target=${targetCalories}`)

  return {
    userProfile,
    mealType,
    targetCalories,
    consumed,
    day,
    existingMeals,
    excludeRecipeIds,
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
