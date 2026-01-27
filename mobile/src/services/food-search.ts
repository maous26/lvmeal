/**
 * Food Search Service - Autonomous for Mobile
 *
 * Features:
 * - CIQUAL database (2000+ French reference foods)
 * - Open Food Facts API (millions of branded products)
 * - Custom recipes (user-created recipes)
 * - In-memory cache with TTL
 * - Optimized search with scoring
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FoodItem, NutritionInfo, NutriScoreGrade } from '../types'
import { analyzeForConversion, detectDryFood, type ConversionResult } from './cooking-conversion'
import { useCustomRecipesStore } from '../stores/custom-recipes-store'
import { useLocalOffStore, localOffProductToFoodItem } from '../stores/local-off-store'
import { logger } from '../lib/logger'
import {
  OpenFoodFactsSearchResponseSchema,
  OpenFoodFactsBarcodeResponseSchema,
  safeParse,
} from '../lib/schemas'

// ============= TYPES =============

type ServingUnit = 'g' | 'ml' | 'unit'

interface CiqualFood {
  id: string
  code: string
  name: string
  groupCode: string
  groupName: string
  subGroupCode: string
  subGroupName: string
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
    fiber?: number | null
    sugar?: number | null
    sodium?: number | null
    saturatedFat?: number | null
  }
  serving: number
  servingUnit: string
  source: 'ciqual'
}

interface CiqualSearchIndex {
  id: string
  name: string
  groupName: string
  originalName: string
}

interface OpenFoodFactsProduct {
  code: string
  product_name?: string
  product_name_fr?: string
  brands?: string
  image_url?: string
  image_front_small_url?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
    fiber_100g?: number
    sugars_100g?: number
    sodium_100g?: number
    'saturated-fat_100g'?: number
  }
  serving_size?: string
  categories_tags?: string[]
  nutriscore_grade?: string // Official Nutri-Score from OFF (a, b, c, d, e)
}

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// ============= CACHE =============

// Cache configuration
const CACHE_TTL_MEMORY = 30 * 60 * 1000 // 30 minutes for memory cache (session)
const CACHE_TTL_STORAGE = 24 * 60 * 60 * 1000 // 24 hours for AsyncStorage (persistent)
const CACHE_KEY_PREFIX = 'food_search_'
const MAX_MEMORY_ENTRIES = 100 // Increase max memory entries
const MAX_STORAGE_ENTRIES = 500 // Max entries in AsyncStorage

class FoodSearchCache {
  private memoryCache = new Map<string, CacheEntry<any[]>>()
  private hitCount = 0
  private missCount = 0

  async get(key: string): Promise<any[] | null> {
    // Check memory first (fastest)
    const memEntry = this.memoryCache.get(key)
    if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL_MEMORY) {
      this.hitCount++
      logger.log(`[FoodSearchCache] Memory HIT for "${key}" (${this.hitCount} hits, ${this.missCount} misses)`)
      return memEntry.data
    }

    // Check AsyncStorage (persistent cache with longer TTL)
    try {
      const stored = await AsyncStorage.getItem(CACHE_KEY_PREFIX + key)
      if (stored) {
        const entry: CacheEntry<any[]> = JSON.parse(stored)
        if (Date.now() - entry.timestamp < CACHE_TTL_STORAGE) {
          // Refresh memory cache with storage data
          this.memoryCache.set(key, entry)
          this.hitCount++
          logger.log(`[FoodSearchCache] Storage HIT for "${key}" (${this.hitCount} hits, ${this.missCount} misses)`)
          return entry.data
        } else {
          // Expired, remove from storage
          AsyncStorage.removeItem(CACHE_KEY_PREFIX + key).catch(() => {})
        }
      }
    } catch (e) {
      // Ignore cache errors
    }

    this.missCount++
    logger.log(`[FoodSearchCache] MISS for "${key}" (${this.hitCount} hits, ${this.missCount} misses)`)
    return null
  }

  async set(key: string, data: any[]): Promise<void> {
    const entry: CacheEntry<any[]> = {
      data,
      timestamp: Date.now(),
    }

    // Set memory cache
    this.memoryCache.set(key, entry)

    // Set AsyncStorage (async, don't wait) for persistence across app restarts
    AsyncStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry)).catch(() => {})

    // Clean old entries if too many
    if (this.memoryCache.size > MAX_MEMORY_ENTRIES) {
      this.cleanOldEntries()
    }
  }

  private cleanOldEntries() {
    const now = Date.now()
    // Remove expired entries first
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL_MEMORY) {
        this.memoryCache.delete(key)
      }
    }

    // If still too many, remove oldest entries
    if (this.memoryCache.size > MAX_MEMORY_ENTRIES) {
      const entries = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)

      // Remove oldest 20%
      const toRemove = Math.ceil(entries.length * 0.2)
      for (let i = 0; i < toRemove; i++) {
        this.memoryCache.delete(entries[i][0])
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memoryEntries: this.memoryCache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount + this.missCount > 0
        ? Math.round((this.hitCount / (this.hitCount + this.missCount)) * 100)
        : 0,
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear()
    this.hitCount = 0
    this.missCount = 0

    try {
      const allKeys = await AsyncStorage.getAllKeys()
      const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_KEY_PREFIX))
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys)
      }
    } catch (e) {
      logger.warn('[FoodSearchCache] Error clearing storage cache:', e)
    }
  }
}

// ============= CIQUAL DATABASE =============

let ciqualData: CiqualFood[] | null = null
let ciqualSearchIndex: CiqualSearchIndex[] | null = null

async function loadCiqual(): Promise<CiqualFood[]> {
  if (ciqualData) return ciqualData

  try {
    const data = require('../data/ciqual.json')
    ciqualData = data as CiqualFood[]
    return ciqualData
  } catch (error) {
    logger.error('Error loading CIQUAL data:', error)
    return []
  }
}

async function loadCiqualSearchIndex(): Promise<CiqualSearchIndex[]> {
  if (ciqualSearchIndex) return ciqualSearchIndex

  try {
    const data = require('../data/ciqual-search-index.json')
    ciqualSearchIndex = data as CiqualSearchIndex[]
    return ciqualSearchIndex
  } catch (error) {
    logger.error('Error loading CIQUAL search index:', error)
    return []
  }
}

// ============= HELPERS =============

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim()
}

/**
 * Normalize a name for comparison (remove accents)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Get singular form of a French word (simple heuristic)
 * "lentilles" -> "lentille", "carottes" -> "carotte"
 */
function getSingularForm(word: string): string | null {
  if (word.length > 3 && word.endsWith('s')) {
    return word.slice(0, -1)
  }
  return null
}

function detectServingUnit(name: string, category?: string): ServingUnit {
  const nameLower = name.toLowerCase()
  const categoryLower = (category || '').toLowerCase()

  // Liquids
  const liquidKeywords = [
    'lait', 'jus', 'eau', 'boisson', 'soda', 'coca', 'limonade', 'sirop',
    'vin', 'biere', 'alcool', 'smoothie', 'the', 'cafe', 'infusion',
    'bouillon', 'nectar', 'cidre', 'huile', 'vinaigre', 'creme liquide',
  ]

  if (liquidKeywords.some(kw => nameLower.includes(kw)) ||
      categoryLower.includes('boisson') || categoryLower.includes('liquide')) {
    return 'ml'
  }

  // Unit items
  const unitKeywords = [
    'pomme', 'poire', 'banane', 'orange', 'citron', 'kiwi', 'mangue',
    'oeuf', 'croissant', 'pain au chocolat', 'brioche', 'muffin',
    'baguette', 'sandwich', 'burger', 'pizza', 'quiche', 'tarte',
    'yaourt', 'pot de', 'portion', 'tranche',
  ]

  if (unitKeywords.some(kw => nameLower.includes(kw))) {
    return 'unit'
  }

  return 'g'
}

// ============= CIQUAL SEARCH =============

/**
 * Smart search algorithm that prioritizes:
 * 1. Exact matches and short base food names over derivatives
 * 2. Word boundary matches (not substring matches)
 * 3. Multi-word queries: all words must be present
 */
async function searchCiqual(query: string, limit: number): Promise<FoodItem[]> {
  const foods = await loadCiqual()
  const searchIndex = await loadCiqualSearchIndex()

  if (!foods.length || !searchIndex?.length) return []

  const normalizedQuery = normalizeQuery(query)
  const singularQuery = getSingularForm(normalizedQuery)
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1)
  // Also get singular forms of query words for matching
  const singularQueryWords = queryWords.map(w => getSingularForm(w)).filter(Boolean) as string[]

  // Score each food
  const scored: { score: number; id: string; name: string }[] = []

  for (const item of searchIndex) {
    const normalizedName = normalizeName(item.name)
    // Split on spaces, commas, parentheses, slashes, hyphens, and apostrophes
    const nameWords = normalizedName.split(/[\s,()/''-]+/).filter(w => w.length > 1)

    // For multi-word queries, ALL words must be present (check both plural and singular forms)
    if (queryWords.length > 1) {
      const allWordsPresent = queryWords.every((qw, idx) => {
        const singular = singularQueryWords[idx]
        return nameWords.some(nw =>
          nw === qw || nw.startsWith(qw) ||
          (singular && (nw === singular || nw.startsWith(singular)))
        )
      })
      if (!allWordsPresent) continue
    }

    let score = 0

    // === EXACT MATCH BONUS ===
    if (normalizedName === normalizedQuery || (singularQuery && normalizedName === singularQuery)) {
      score = 1000 // Perfect match
    }
    // === WORD BOUNDARY MATCHING ===
    else {
      // Check if query matches a complete word in the name (also check singular form)
      const queryIsCompleteWord = nameWords.some(w => w === normalizedQuery || (singularQuery && w === singularQuery))
      // First word exactly matches OR first word starts with query (for single-word queries)
      const firstWordExactMatch = nameWords[0] === normalizedQuery || (singularQuery && nameWords[0] === singularQuery)
      const firstWordStartsWithQuery = nameWords[0]?.startsWith(normalizedQuery) || (singularQuery && nameWords[0]?.startsWith(singularQuery))

      // For single-word queries, prioritize exact word matches over substring matches
      // This prevents "laitue" from ranking higher than "lait entier" when searching "lait"
      const isSubstringMatch = !queryIsCompleteWord && normalizedName.includes(normalizedQuery)

      if (queryIsCompleteWord && nameWords.length === 1) {
        // Single word name that matches exactly
        score = 900
      } else if (firstWordExactMatch && nameWords.length <= 3) {
        // First word exactly matches query - likely a base food (e.g., "Lait entier")
        score = 850
      } else if (queryIsCompleteWord && nameWords.length <= 2) {
        // Short name (1-2 words) containing the query as a word
        score = 800
      } else if (queryIsCompleteWord) {
        // Query is a complete word in a longer name
        score = 600
      } else if (firstWordStartsWithQuery && nameWords.length <= 2) {
        // First word starts with query in a short name
        score = 550
      } else if (firstWordStartsWithQuery) {
        // Name starts with query but has more words
        score = 500
      } else if (normalizedName.startsWith(normalizedQuery)) {
        // Name starts with query (substring)
        score = 400
      } else if (isSubstringMatch) {
        // Name contains query as substring (e.g., "laitue" contains "lait")
        // Lower score for substring-only matches
        score = 150
      }

      // === MULTI-WORD QUERY BONUS ===
      if (queryWords.length > 1) {
        let wordMatchCount = 0
        let exactWordMatches = 0

        for (const qw of queryWords) {
          // Exact word match (word boundary)
          if (nameWords.some(nw => nw === qw)) {
            exactWordMatches++
            wordMatchCount++
          }
          // Word starts with query word
          else if (nameWords.some(nw => nw.startsWith(qw))) {
            wordMatchCount++
          }
        }

        // Bonus for having all query words as exact matches
        if (exactWordMatches === queryWords.length) {
          score += 150
        }
        // Bonus for partial matches
        score += wordMatchCount * 30
      }
    }

    // === LENGTH PENALTY ===
    // Shorter names are usually base foods, longer names are derivatives
    // "oeuf" (4 chars) should rank higher than "oeuf brouillé au fromage" (25 chars)
    if (score > 0) {
      const lengthPenalty = Math.min(normalizedName.length * 2, 100)
      score -= lengthPenalty

      // Extra penalty for very long names (likely composite/prepared foods)
      if (normalizedName.length > 30) {
        score -= 50
      }
    }

    // === CATEGORY BONUS ===
    // Boost if query word appears in group name
    for (const word of queryWords) {
      if (item.groupName.toLowerCase().includes(word)) {
        score += 10
      }
    }

    if (score > 0) {
      scored.push({ score, id: item.id, name: normalizedName })
    }
  }

  // Sort by score (highest first), then by name length (shortest first for ties)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.name.length - b.name.length
  })

  // Map to FoodItem
  const results: FoodItem[] = []
  const foodsMap = new Map(foods.map(f => [f.id, f]))

  for (let i = 0; i < Math.min(scored.length, limit); i++) {
    const food = foodsMap.get(scored[i].id)
    if (food) {
      const servingUnit = detectServingUnit(food.name, food.groupName)
      results.push({
        id: food.id,
        name: food.name,
        category: food.groupName || undefined,
        nutrition: {
          calories: food.nutrition.calories,
          proteins: food.nutrition.proteins,
          carbs: food.nutrition.carbs,
          fats: food.nutrition.fats,
          fiber: food.nutrition.fiber ?? undefined,
          sugar: food.nutrition.sugar ?? undefined,
          sodium: food.nutrition.sodium ?? undefined,
          saturatedFat: food.nutrition.saturatedFat ?? undefined,
        },
        servingSize: food.serving,
        servingUnit: servingUnit,
        source: 'ciqual',
      })
    }
  }

  return results
}

// ============= CUSTOM RECIPES SEARCH =============

/**
 * Search user's custom recipes
 * Returns recipes that match the query, converted to FoodItem format
 */
function searchCustomRecipes(query: string, limit: number): FoodItem[] {
  try {
    // Get recipes from the store (direct state access, not hook)
    const { recipes } = useCustomRecipesStore.getState()

    if (!recipes || recipes.length === 0) return []

    const normalizedQuery = query.toLowerCase().trim()
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1)

    // Score each recipe
    const scored: { score: number; recipe: typeof recipes[0] }[] = []

    for (const recipe of recipes) {
      const normalizedTitle = recipe.title.toLowerCase()
      const titleWords = normalizedTitle.split(/\s+/)

      let score = 0

      // Exact title match
      if (normalizedTitle === normalizedQuery) {
        score = 1000
      }
      // Title starts with query
      else if (normalizedTitle.startsWith(normalizedQuery)) {
        score = 800
      }
      // Title contains query
      else if (normalizedTitle.includes(normalizedQuery)) {
        score = 600
      }
      // Check word matches
      else {
        let wordMatches = 0
        for (const qw of queryWords) {
          if (titleWords.some(tw => tw === qw || tw.startsWith(qw))) {
            wordMatches++
          }
        }
        if (wordMatches > 0) {
          score = 400 + (wordMatches * 50)
        }
      }

      // Check ingredients for matches
      if (score === 0) {
        for (const ing of recipe.ingredients) {
          const ingName = ing.name.toLowerCase()
          if (ingName.includes(normalizedQuery) || queryWords.some(qw => ingName.includes(qw))) {
            score = 200
            break
          }
        }
      }

      // Bonus for favorites
      if (recipe.isFavorite && score > 0) {
        score += 100
      }

      // Bonus for frequently used
      if (recipe.usageCount > 0 && score > 0) {
        score += Math.min(recipe.usageCount * 10, 50)
      }

      if (score > 0) {
        scored.push({ score, recipe })
      }
    }

    // Sort by score
    scored.sort((a, b) => b.score - a.score)

    // Convert to FoodItem format
    const results: FoodItem[] = []
    for (let i = 0; i < Math.min(scored.length, limit); i++) {
      const recipe = scored[i].recipe
      results.push({
        id: recipe.id,
        name: `🍳 ${recipe.title}`, // Prefix to identify as custom recipe
        category: recipe.category || 'Recette personnalisee',
        nutrition: recipe.nutritionPerServing,
        servingSize: 1,
        servingUnit: 'portion',
        source: 'recipe',
        isRecipe: true,
        recipeId: recipe.id,
      })
    }

    return results
  } catch (error) {
    logger.error('[searchCustomRecipes] Error:', error)
    return []
  }
}

// ============= OPEN FOOD FACTS =============

function transformOffProduct(p: OpenFoodFactsProduct): FoodItem | null {
  if (!p.product_name && !p.product_name_fr) return null
  if (!p.nutriments || p.nutriments['energy-kcal_100g'] === undefined) return null

  const name = p.product_name_fr || p.product_name || 'Produit inconnu'
  const brand = p.brands?.split(',')[0]?.trim()
  const category = p.categories_tags?.[0]?.replace(/^(en|fr):/, '')
  const fullName = brand ? `${name} - ${brand}` : name
  const servingUnit = detectServingUnit(fullName, category)

  // Map official Nutri-Score grade from OFF API
  const validGrades = ['a', 'b', 'c', 'd', 'e']
  const rawGrade = p.nutriscore_grade?.toLowerCase()
  const nutriscore = rawGrade && validGrades.includes(rawGrade)
    ? rawGrade as NutriScoreGrade
    : undefined

  // Debug log
  if (nutriscore) {
    logger.log(`[OFF] ${p.product_name_fr || p.product_name} - Nutri-Score: ${nutriscore.toUpperCase()}`)
  }

  return {
    id: `off-${p.code}`,
    name: fullName,
    brand,
    imageUrl: p.image_front_small_url || p.image_url || undefined,
    nutrition: {
      calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
      proteins: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
      carbs: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10,
      fats: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
      fiber: p.nutriments.fiber_100g ?? undefined,
      sugar: p.nutriments.sugars_100g ?? undefined,
      sodium: p.nutriments.sodium_100g ? Math.round(p.nutriments.sodium_100g * 1000) : undefined,
      saturatedFat: p.nutriments['saturated-fat_100g'] ?? undefined,
    },
    servingSize: p.serving_size ? parseFloat(p.serving_size) || 100 : 100,
    servingUnit,
    category,
    source: 'openfoodfacts',
    barcode: p.code,
    nutriscore,
  }
}

async function searchOpenFoodFacts(query: string, limit: number, timeoutMs: number = 5000): Promise<FoodItem[]> {
  const results: FoodItem[] = []

  // 1. First, search local OFF database (user-added products)
  const localProducts = useLocalOffStore.getState().searchProducts(query, Math.min(limit, 5))
  for (const localProduct of localProducts) {
    results.push(localOffProductToFoodItem(localProduct))
  }

  // 2. Then, search official Open Food Facts API
  try {
    const searchUrl = new URL('https://world.openfoodfacts.org/cgi/search.pl')
    searchUrl.searchParams.set('search_terms', query)
    searchUrl.searchParams.set('search_simple', '1')
    searchUrl.searchParams.set('action', 'process')
    searchUrl.searchParams.set('json', '1')
    searchUrl.searchParams.set('page_size', String(Math.min(limit + 5, 25)))
    searchUrl.searchParams.set('lc', 'fr')
    searchUrl.searchParams.set('tagtype_0', 'countries')
    searchUrl.searchParams.set('tag_contains_0', 'contains')
    searchUrl.searchParams.set('tag_0', 'france')
    searchUrl.searchParams.set('sort_by', 'unique_scans_n')
    searchUrl.searchParams.set('fields', 'code,product_name,product_name_fr,brands,image_front_small_url,nutriments,serving_size,categories_tags,nutriscore_grade')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'PresenceMobile/1.0 (nutrition-tracker)',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      logger.warn('Open Food Facts API error:', response.status)
      return results // Return local results even if API fails
    }

    const rawData = await response.json()

    // Validate response with Zod schema
    const validatedData = safeParse(OpenFoodFactsSearchResponseSchema, rawData)
    if (!validatedData) {
      logger.warn('[OFF] Invalid API response structure')
      return results
    }

    const products = validatedData.products

    // Add API results, avoiding duplicates (by barcode)
    const existingBarcodes = new Set(results.map(r => r.barcode))
    for (const p of products) {
      if (existingBarcodes.has(p.code)) continue // Skip if already in local results

      const product = transformOffProduct(p)
      if (product) {
        results.push(product)
        if (results.length >= limit) break
      }
    }

    return results.slice(0, limit)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Timeout is not a critical error, just skip OFF results
      logger.warn('Open Food Facts request timed out - skipping')
    } else {
      logger.warn('Error searching Open Food Facts:', error)
    }
    // Return local results even if API fails
    return results
  }
}

// ============= BARCODE LOOKUP =============

export interface BarcodeResult {
  food: FoodItem
  /** If the food is dry and needs cooking conversion */
  conversionAvailable: boolean
  /** Converted version if available */
  convertedFood?: FoodItem
  /** Conversion rule ID */
  conversionRule?: string
}

export async function lookupBarcode(barcode: string): Promise<BarcodeResult | null> {
  // 1. First, check local OFF database (user-added products)
  const localProduct = useLocalOffStore.getState().getProductByBarcode(barcode)
  if (localProduct) {
    logger.log(`[lookupBarcode] Found in local OFF database: ${localProduct.product_name}`)
    const food = localOffProductToFoodItem(localProduct)
    const conversion = analyzeForConversion(food)

    return {
      food,
      conversionAvailable: conversion.needsConversion,
      convertedFood: conversion.convertedFood,
      conversionRule: conversion.rule?.id,
    }
  }

  // 2. Then, check official Open Food Facts API
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,product_name_fr,brands,image_front_small_url,nutriments,serving_size,categories_tags,nutriscore_grade`,
      {
        headers: {
          'User-Agent': 'PresenceMobile/1.0 (nutrition-tracker)',
        },
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const rawData = await response.json()

    // Validate response with Zod schema
    const validatedData = safeParse(OpenFoodFactsBarcodeResponseSchema, rawData)
    if (!validatedData) {
      logger.warn('[OFF] Invalid barcode response structure')
      return null
    }

    if (validatedData.status !== 1 || !validatedData.product) {
      return null
    }

    const food = transformOffProduct(validatedData.product)
    if (!food) return null

    // Check if this is a dry food that needs cooking conversion
    const conversion = analyzeForConversion(food)

    return {
      food,
      conversionAvailable: conversion.needsConversion,
      convertedFood: conversion.convertedFood,
      conversionRule: conversion.rule?.id,
    }
  } catch (error) {
    logger.error('Error looking up barcode:', error)
    return null
  }
}

/**
 * Simple barcode lookup that returns just the food item
 * For backwards compatibility
 */
export async function lookupBarcodeSimple(barcode: string): Promise<FoodItem | null> {
  const result = await lookupBarcode(barcode)
  return result?.food || null
}

// ============= MAIN SEARCH SERVICE =============

const cache = new FoodSearchCache()

export type SearchSource = 'all' | 'generic' | 'branded' | 'custom'

export interface SearchFoodsOptions {
  query: string
  limit?: number
  source?: SearchSource
}

export interface FoodItemWithConversion extends FoodItem {
  /** If the food is dry and needs cooking conversion */
  conversionAvailable?: boolean
  /** Converted version if available */
  convertedFood?: FoodItem
  /** Conversion rule ID */
  conversionRule?: string
}

export interface SearchFoodsResult {
  products: FoodItemWithConversion[]
  total: number
  sources: string[]
  fromCache: boolean
}

export async function searchFoods(options: SearchFoodsOptions): Promise<SearchFoodsResult> {
  const { query, limit = 20, source = 'all' } = options

  if (!query || query.length < 2) {
    return { products: [], total: 0, sources: [], fromCache: false }
  }

  // If source is 'custom', only search custom recipes
  if (source === 'custom') {
    const customRecipes = searchCustomRecipes(query, limit)
    return {
      products: customRecipes,
      total: customRecipes.length,
      sources: ['custom'],
      fromCache: false,
    }
  }

  // Always search custom recipes first (not cached, always fresh) for 'all' source
  const customRecipes = source === 'all' ? searchCustomRecipes(query, 5) : []

  // Normalize query for cache key (lowercase, no accents, trimmed)
  // This ensures "thon", "Thon", "THON" all use the same cache entry
  const normalizedCacheQuery = normalizeQuery(query)
  const cacheKey = `${normalizedCacheQuery}-${limit}-${source}`
  const cached = await cache.get(cacheKey)
  if (cached) {
    // Prepend custom recipes to cached results
    const combinedProducts = [...customRecipes, ...cached].slice(0, limit)
    return {
      products: combinedProducts,
      total: combinedProducts.length,
      sources: source === 'all' ? ['custom', 'ciqual', 'openfoodfacts'] : [source === 'generic' ? 'ciqual' : 'openfoodfacts'],
      fromCache: true,
    }
  }

  // Execute searches in parallel
  const searchPromises: Promise<FoodItem[]>[] = []

  if (source === 'all' || source === 'generic') {
    searchPromises.push(
      searchCiqual(query, source === 'generic' ? limit : Math.ceil(limit / 2))
    )
  }

  if (source === 'all' || source === 'branded') {
    searchPromises.push(
      searchOpenFoodFacts(query, source === 'branded' ? limit : Math.ceil(limit / 2))
    )
  }

  const results = await Promise.all(searchPromises)

  // Merge results
  const products: FoodItem[] = []
  for (const result of results) {
    products.push(...result)
  }

  // Sort by complete nutrition data
  products.sort((a, b) => {
    const aHasCalories = a.nutrition.calories > 0 ? 1 : 0
    const bHasCalories = b.nutrition.calories > 0 ? 1 : 0
    return bHasCalories - aHasCalories
  })

  // Add conversion info to each product
  const productsWithConversion: FoodItemWithConversion[] = products.slice(0, limit).map(food => {
    const conversion = analyzeForConversion(food)
    if (conversion.needsConversion) {
      return {
        ...food,
        conversionAvailable: true,
        convertedFood: conversion.convertedFood,
        conversionRule: conversion.rule?.id,
      }
    }
    return food
  })

  // Cache results (without custom recipes, they're always fetched fresh)
  await cache.set(cacheKey, productsWithConversion)

  // Prepend custom recipes to final results
  const finalProducts = [...customRecipes, ...productsWithConversion].slice(0, limit)

  return {
    products: finalProducts,
    total: finalProducts.length,
    sources: customRecipes.length > 0
      ? ['custom', ...(source === 'all' ? ['ciqual', 'openfoodfacts'] : [source === 'generic' ? 'ciqual' : 'openfoodfacts'])]
      : (source === 'all' ? ['ciqual', 'openfoodfacts'] : [source === 'generic' ? 'ciqual' : 'openfoodfacts']),
    fromCache: false,
  }
}

// ============= PRELOAD & CACHE MANAGEMENT =============

export async function preloadCiqual(): Promise<void> {
  await loadCiqual()
  await loadCiqualSearchIndex()
}

/**
 * Clear the food search cache (useful after code updates)
 */
export async function clearFoodSearchCache(): Promise<void> {
  await cache.clearAll()
  logger.log('[FoodSearch] Cache cleared')
}

/**
 * Get cache statistics for debugging/monitoring
 */
export function getFoodSearchCacheStats() {
  return cache.getStats()
}

// Re-export cooking conversion utilities for convenience
export {
  detectDryFood,
  convertToCooked,
  analyzeForConversion,
  COOKING_CONVERSION_RULES,
} from './cooking-conversion'

export default {
  searchFoods,
  lookupBarcode,
  lookupBarcodeSimple,
  clearFoodSearchCache,
  getFoodSearchCacheStats,
  preloadCiqual,
}
