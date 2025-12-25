import { NextRequest, NextResponse } from 'next/server'

// Unit type for serving sizes
type ServingUnit = 'g' | 'ml' | 'unit'

// Types for food products
interface FoodProduct {
  id: string
  name: string
  brand?: string
  imageUrl?: string | null
  nutrition: {
    calories: number // per 100g or per serving
    proteins: number
    carbs: number
    fats: number
    fiber?: number | null
    sugar?: number | null
    sodium?: number | null
    saturatedFat?: number | null
  }
  servingSize?: number // base serving size (100g for CIQUAL, variable for OFF)
  servingUnit?: ServingUnit // unit type: g, ml, or unit
  category?: string
  source: 'openfoodfacts' | 'ciqual' | 'local'
  isGeneric?: boolean // true = generic/reference food (CIQUAL), false = branded product (OFF)
}

// CIQUAL food type (from our JSON)
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

// Open Food Facts API response type
interface OpenFoodFactsProduct {
  code: string
  product_name?: string
  product_name_fr?: string
  brands?: string
  image_url?: string
  image_front_small_url?: string
  countries_tags?: string[]
  nutriments?: {
    'energy-kcal_100g'?: number
    proteins_100g?: number
    carbohydrates_100g?: number
    fat_100g?: number
    fiber_100g?: number
    sugars_100g?: number
    salt_100g?: number
    sodium_100g?: number
    'saturated-fat_100g'?: number
  }
  serving_size?: string
  categories_tags?: string[]
  nutriscore_grade?: string
}

// ============= CACHES =============

// Cache for CIQUAL data (loaded once)
let ciqualCache: CiqualFood[] | null = null
let ciqualSearchIndex: { id: string; name: string; groupName: string; originalName: string }[] | null = null

// In-memory cache for Open Food Facts results (TTL: 10 minutes)
interface CacheEntry {
  data: FoodProduct[]
  timestamp: number
}
const offCache = new Map<string, CacheEntry>()
const OFF_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

// Clean expired cache entries periodically
function cleanOffCache() {
  const now = Date.now()
  for (const [key, entry] of offCache.entries()) {
    if (now - entry.timestamp > OFF_CACHE_TTL) {
      offCache.delete(key)
    }
  }
}

// Load CIQUAL data
async function loadCiqual(): Promise<CiqualFood[]> {
  if (ciqualCache) return ciqualCache

  try {
    const ciqualData = await import('@/data/ciqual.json')
    ciqualCache = ciqualData.default as CiqualFood[]
    return ciqualCache
  } catch (error) {
    console.error('Error loading CIQUAL data:', error)
    return []
  }
}

// Load CIQUAL search index
async function loadCiqualSearchIndex(): Promise<typeof ciqualSearchIndex> {
  if (ciqualSearchIndex) return ciqualSearchIndex

  try {
    const indexData = await import('@/data/ciqual-search-index.json')
    ciqualSearchIndex = indexData.default
    return ciqualSearchIndex
  } catch (error) {
    console.error('Error loading CIQUAL search index:', error)
    return []
  }
}

// Normalize search query for better matching
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim()
}

// Detect serving unit based on food name and category
function detectServingUnit(name: string, category?: string): ServingUnit {
  const nameLower = name.toLowerCase()
  const categoryLower = (category || '').toLowerCase()

  // Liquids - ml
  const liquidKeywords = [
    'lait', 'milk', 'jus', 'juice', 'eau', 'water', 'boisson', 'drink', 'soda',
    'coca', 'cola', 'limonade', 'sirop', 'vin', 'wine', 'bière', 'beer', 'alcool',
    'smoothie', 'thé', 'tea', 'café', 'coffee', 'infusion', 'bouillon', 'soupe liquide',
    'nectar', 'cidre', 'cider', 'whisky', 'vodka', 'rhum', 'rum', 'gin',
    'huile', 'oil', 'vinaigre', 'vinegar', 'sauce soja', 'soy sauce',
    'crème liquide', 'cream', 'yaourt à boire', 'kéfir', 'kombucha'
  ]

  const liquidCategories = [
    'boissons', 'beverages', 'drinks', 'liquides', 'liquids', 'jus', 'juices',
    'laits', 'milks', 'eaux', 'waters', 'sodas', 'alcools', 'vins', 'wines', 'bières', 'beers'
  ]

  // Check for liquids
  if (liquidKeywords.some(kw => nameLower.includes(kw)) ||
      liquidCategories.some(cat => categoryLower.includes(cat))) {
    return 'ml'
  }

  // Unit items (counted, not weighed) - unit
  const unitKeywords = [
    'pomme', 'apple', 'poire', 'pear', 'banane', 'banana', 'orange', 'citron', 'lemon',
    'kiwi', 'mangue', 'mango', 'pêche', 'peach', 'abricot', 'apricot', 'prune', 'plum',
    'cerise', 'cherry', 'fraise', 'strawberry', 'framboise', 'raspberry',
    'oeuf', 'œuf', 'egg', 'eggs', 'oeufs', 'œufs',
    'croissant', 'pain au chocolat', 'brioche', 'muffin', 'cookie', 'biscuit',
    'baguette', 'sandwich', 'burger', 'hamburger', 'hot-dog', 'hotdog',
    'pizza', 'quiche', 'tarte', 'gâteau', 'cake', 'cupcake', 'donut', 'doughnut',
    'bonbon', 'candy', 'chocolat individuel', 'carré de chocolat',
    'avocat', 'avocado', 'tomate', 'tomato', 'concombre', 'cucumber', 'courgette', 'zucchini',
    'carotte', 'carrot', 'pomme de terre', 'potato', 'patate',
    'oignon', 'onion', 'ail', 'garlic', 'échalote', 'shallot',
    'poivron', 'pepper', 'aubergine', 'eggplant',
    'yaourt', 'yogurt', 'yoghurt', 'pot de', 'portion individuelle',
    'sachet', 'portion', 'unité', 'pièce', 'tranche', 'slice'
  ]

  // Check for unit items
  if (unitKeywords.some(kw => nameLower.includes(kw))) {
    return 'unit'
  }

  // Default to grams
  return 'g'
}

// Search CIQUAL database (very fast - local data)
async function searchCiqual(query: string, limit: number): Promise<FoodProduct[]> {
  const foods = await loadCiqual()
  const searchIndex = await loadCiqualSearchIndex()

  if (!foods.length || !searchIndex?.length) return []

  const normalizedQuery = normalizeQuery(query)
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1)

  // Score each food based on match quality
  const scored: { score: number; id: string }[] = []

  for (const item of searchIndex) {
    let score = 0
    const normalizedName = item.name
    const normalizedGroup = item.groupName

    // Exact match gets highest score
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
      if (normalizedGroup.includes(word)) {
        score += 5
      }
    }

    if (score > 0) {
      scored.push({ score, id: item.id })
    }
  }

  // Sort by score and take top results
  scored.sort((a, b) => b.score - a.score)

  const results: FoodProduct[] = []
  const foodsMap = new Map(foods.map(f => [f.id, f]))

  for (let i = 0; i < Math.min(scored.length, limit); i++) {
    const food = foodsMap.get(scored[i].id)
    if (food) {
      const servingUnit = detectServingUnit(food.name, food.groupName)
      results.push({
        id: food.id,
        name: food.name,
        category: food.groupName,
        imageUrl: null,
        nutrition: {
          calories: food.nutrition.calories,
          proteins: food.nutrition.proteins,
          carbs: food.nutrition.carbs,
          fats: food.nutrition.fats,
          fiber: food.nutrition.fiber,
          sugar: food.nutrition.sugar,
          sodium: food.nutrition.sodium,
          saturatedFat: food.nutrition.saturatedFat,
        },
        servingSize: food.serving,
        servingUnit,
        source: 'ciqual',
        isGeneric: true,
      })
    }
  }

  return results
}

// Transform OFF product to our format
function transformOffProduct(p: OpenFoodFactsProduct): FoodProduct | null {
  if (!p.product_name && !p.product_name_fr) return null
  if (!p.nutriments || p.nutriments['energy-kcal_100g'] === undefined) return null

  const name = p.product_name_fr || p.product_name || 'Produit inconnu'
  const brand = p.brands?.split(',')[0]?.trim()
  const category = p.categories_tags?.[0]?.replace(/^(en|fr):/, '')
  const fullName = brand ? `${name} - ${brand}` : name

  // Detect serving unit from product name and category
  const servingUnit = detectServingUnit(fullName, category)

  return {
    id: `off-${p.code}`,
    name: fullName,
    brand,
    imageUrl: p.image_front_small_url || p.image_url || null,
    nutrition: {
      calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
      proteins: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
      carbs: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10,
      fats: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
      fiber: p.nutriments.fiber_100g ?? null,
      sugar: p.nutriments.sugars_100g ?? null,
      sodium: p.nutriments.sodium_100g ? Math.round(p.nutriments.sodium_100g * 1000) : null,
      saturatedFat: p.nutriments['saturated-fat_100g'] ?? null,
    },
    servingSize: p.serving_size ? parseFloat(p.serving_size) || 100 : 100,
    servingUnit,
    category,
    source: 'openfoodfacts',
    isGeneric: false,
  }
}

// Search Open Food Facts with caching
async function searchOpenFoodFacts(query: string, limit: number): Promise<FoodProduct[]> {
  const cacheKey = `${query.toLowerCase()}-${limit}`

  // Check cache first
  const cached = offCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < OFF_CACHE_TTL) {
    return cached.data
  }

  try {
    // Single optimized query - reduced page size for faster response
    const searchUrl = new URL('https://world.openfoodfacts.org/cgi/search.pl')
    searchUrl.searchParams.set('search_terms', query)
    searchUrl.searchParams.set('search_simple', '1')
    searchUrl.searchParams.set('action', 'process')
    searchUrl.searchParams.set('json', '1')
    searchUrl.searchParams.set('page_size', String(Math.min(limit + 5, 25))) // Limit to 25 max for speed
    searchUrl.searchParams.set('lc', 'fr')
    searchUrl.searchParams.set('tagtype_0', 'countries')
    searchUrl.searchParams.set('tag_contains_0', 'contains')
    searchUrl.searchParams.set('tag_0', 'france')
    searchUrl.searchParams.set('sort_by', 'unique_scans_n')
    // Request only necessary fields to reduce payload
    searchUrl.searchParams.set('fields', 'code,product_name,product_name_fr,brands,image_front_small_url,nutriments,serving_size,categories_tags')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'PresenceApp/1.0 (nutrition-tracker)',
      },
      signal: controller.signal,
      cache: 'force-cache', // Use HTTP cache
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error('Open Food Facts API error:', response.status)
      return []
    }

    const data = await response.json()
    const products = data.products || []

    // Transform products
    const results: FoodProduct[] = []
    for (const p of products) {
      const product = transformOffProduct(p)
      if (product) {
        results.push(product)
        if (results.length >= limit) break
      }
    }

    // Store in cache
    offCache.set(cacheKey, { data: results, timestamp: Date.now() })

    // Clean old cache entries occasionally
    if (offCache.size > 100) {
      cleanOffCache()
    }

    return results
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Open Food Facts request timed out')
    } else {
      console.error('Error searching Open Food Facts:', error)
    }
    return []
  }
}

// Search for food products
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '20')
  const source = searchParams.get('source') || 'all'

  if (!query || query.length < 2) {
    return NextResponse.json({
      products: [],
      message: 'Query must be at least 2 characters',
    })
  }

  const products: FoodProduct[] = []

  // Execute searches in parallel for better performance
  const searchPromises: Promise<FoodProduct[]>[] = []

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

  // Wait for all searches to complete
  const results = await Promise.all(searchPromises)

  // Merge results - CIQUAL first (faster, more reliable), then OFF
  for (const result of results) {
    products.push(...result)
  }

  // Sort: complete nutrition data first
  products.sort((a, b) => {
    const aHasCalories = a.nutrition.calories > 0 ? 1 : 0
    const bHasCalories = b.nutrition.calories > 0 ? 1 : 0
    return bHasCalories - aHasCalories
  })

  // Return with cache headers
  const response = NextResponse.json({
    products: products.slice(0, limit),
    total: products.length,
    sources: source === 'all' ? ['ciqual', 'openfoodfacts'] : [source === 'generic' ? 'ciqual' : 'openfoodfacts'],
  })

  // Set cache headers for client-side caching
  response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')

  return response
}

// Get product by barcode
export async function POST(request: NextRequest) {
  try {
    const { barcode } = await request.json()

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barcode is required' },
        { status: 400 }
      )
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,product_name_fr,brands,image_front_small_url,nutriments,serving_size,categories_tags`,
      {
        headers: {
          'User-Agent': 'PresenceApp/1.0 (nutrition-tracker)',
        },
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const data = await response.json()

    if (data.status !== 1 || !data.product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const product = transformOffProduct(data.product)

    if (!product) {
      return NextResponse.json(
        { error: 'Product has no nutrition data' },
        { status: 404 }
      )
    }

    return NextResponse.json({ product })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out' },
        { status: 504 }
      )
    }
    console.error('Error fetching product by barcode:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
