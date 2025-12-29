/**
 * Food Search Service - Autonomous for Mobile
 *
 * Features:
 * - CIQUAL database (2000+ French reference foods)
 * - Open Food Facts API (millions of branded products)
 * - In-memory cache with TTL
 * - Optimized search with scoring
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FoodItem, NutritionInfo, NutriScoreGrade } from '../types'

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

const CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const CACHE_KEY_PREFIX = 'food_search_'

class FoodSearchCache {
  private memoryCache = new Map<string, CacheEntry<FoodItem[]>>()

  async get(key: string): Promise<FoodItem[] | null> {
    // Check memory first
    const memEntry = this.memoryCache.get(key)
    if (memEntry && Date.now() - memEntry.timestamp < CACHE_TTL) {
      return memEntry.data
    }

    // Check AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(CACHE_KEY_PREFIX + key)
      if (stored) {
        const entry: CacheEntry<FoodItem[]> = JSON.parse(stored)
        if (Date.now() - entry.timestamp < CACHE_TTL) {
          // Refresh memory cache
          this.memoryCache.set(key, entry)
          return entry.data
        }
      }
    } catch (e) {
      // Ignore cache errors
    }

    return null
  }

  async set(key: string, data: FoodItem[]): Promise<void> {
    const entry: CacheEntry<FoodItem[]> = {
      data,
      timestamp: Date.now(),
    }

    // Set memory cache
    this.memoryCache.set(key, entry)

    // Set AsyncStorage (async, don't wait)
    AsyncStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry)).catch(() => {})

    // Clean old entries if too many
    if (this.memoryCache.size > 50) {
      this.cleanOldEntries()
    }
  }

  private cleanOldEntries() {
    const now = Date.now()
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        this.memoryCache.delete(key)
      }
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
    console.error('Error loading CIQUAL data:', error)
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
    console.error('Error loading CIQUAL search index:', error)
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

async function searchCiqual(query: string, limit: number): Promise<FoodItem[]> {
  const foods = await loadCiqual()
  const searchIndex = await loadCiqualSearchIndex()

  if (!foods.length || !searchIndex?.length) return []

  const normalizedQuery = normalizeQuery(query)
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1)

  // Score each food
  const scored: { score: number; id: string }[] = []

  for (const item of searchIndex) {
    let score = 0
    const normalizedName = item.name

    // Exact match
    if (normalizedName === normalizedQuery) {
      score = 100
    }
    // Name starts with query
    else if (normalizedName.startsWith(normalizedQuery)) {
      score = 50
    }
    // Name contains query
    else if (normalizedName.includes(normalizedQuery)) {
      score = 30
    }

    // Check each query word
    for (const word of queryWords) {
      if (normalizedName.includes(word)) {
        score += 10
      }
      if (item.groupName.includes(word)) {
        score += 5
      }
    }

    if (score > 0) {
      scored.push({ score, id: item.id })
    }
  }

  // Sort by score
  scored.sort((a, b) => b.score - a.score)

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
    console.log(`[OFF] ${p.product_name_fr || p.product_name} - Nutri-Score: ${nutriscore.toUpperCase()}`)
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
      console.warn('Open Food Facts API error:', response.status)
      return []
    }

    const data = await response.json()
    const products = data.products || []

    const results: FoodItem[] = []
    for (const p of products) {
      const product = transformOffProduct(p)
      if (product) {
        results.push(product)
        if (results.length >= limit) break
      }
    }

    return results
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Timeout is not a critical error, just skip OFF results
      console.warn('Open Food Facts request timed out - skipping')
    } else {
      console.warn('Error searching Open Food Facts:', error)
    }
    return []
  }
}

// ============= BARCODE LOOKUP =============

export async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
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

    const data = await response.json()

    if (data.status !== 1 || !data.product) {
      return null
    }

    return transformOffProduct(data.product)
  } catch (error) {
    console.error('Error looking up barcode:', error)
    return null
  }
}

// ============= MAIN SEARCH SERVICE =============

const cache = new FoodSearchCache()

export type SearchSource = 'all' | 'generic' | 'branded'

export interface SearchFoodsOptions {
  query: string
  limit?: number
  source?: SearchSource
}

export interface SearchFoodsResult {
  products: FoodItem[]
  total: number
  sources: string[]
  fromCache: boolean
}

export async function searchFoods(options: SearchFoodsOptions): Promise<SearchFoodsResult> {
  const { query, limit = 20, source = 'all' } = options

  if (!query || query.length < 2) {
    return { products: [], total: 0, sources: [], fromCache: false }
  }

  // Check cache
  const cacheKey = `${query.toLowerCase()}-${limit}-${source}`
  const cached = await cache.get(cacheKey)
  if (cached) {
    return {
      products: cached,
      total: cached.length,
      sources: source === 'all' ? ['ciqual', 'openfoodfacts'] : [source === 'generic' ? 'ciqual' : 'openfoodfacts'],
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

  const finalProducts = products.slice(0, limit)

  // Cache results
  await cache.set(cacheKey, finalProducts)

  return {
    products: finalProducts,
    total: products.length,
    sources: source === 'all' ? ['ciqual', 'openfoodfacts'] : [source === 'generic' ? 'ciqual' : 'openfoodfacts'],
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
  // Clear memory cache
  cache['memoryCache'].clear()

  // Clear AsyncStorage cache
  try {
    const allKeys = await AsyncStorage.getAllKeys()
    const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_KEY_PREFIX))
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys)
      console.log(`[FoodSearch] Cleared ${cacheKeys.length} cached entries`)
    }
  } catch (e) {
    console.warn('[FoodSearch] Error clearing cache:', e)
  }
}

export default {
  searchFoods,
  lookupBarcode,
  clearFoodSearchCache,
  preloadCiqual,
}
