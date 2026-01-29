/**
 * Food Data RAG Service
 *
 * Retrieves accurate nutritional data from CIQUAL and Open Food Facts
 * for use in AI prompts. This replaces hardcoded unit weights with
 * real database values.
 *
 * Key Features:
 * - Extract food names from user input (text or list)
 * - Query CIQUAL database for French reference foods
 * - Query Open Food Facts for branded products
 * - Return structured data for AI prompt injection
 *
 * Usage:
 * When analyzing "10 amandes", this service:
 * 1. Extracts "amandes" from input
 * 2. Queries CIQUAL/OFF for "amandes"
 * 3. Returns: { name: "Amande", per100g: 634kcal, typicalUnit: 1.2g }
 * 4. AI uses this to calculate: 10 * 1.2g = 12g → 76kcal
 */

import { searchOFF, searchCIQUAL, type OFFProduct, type CIQUALFood } from './rag-service'

// ============= TYPES =============

export interface FoodDataResult {
  /** Food name as found in database */
  name: string
  /** Nutrition per 100g */
  per100g: {
    calories: number
    proteins: number
    carbs: number
    fats: number
    fiber?: number
  }
  /** Typical unit weight in grams (if countable food) */
  typicalUnitWeight?: number
  /** Description of unit (e.g., "1 amande", "1 oeuf") */
  unitDescription?: string
  /** Data source */
  source: 'ciqual' | 'off' | 'estimated'
  /** Confidence score 0-1 */
  confidence: number
}

export interface FoodRAGContext {
  /** Foods found in databases with their data */
  foods: FoodDataResult[]
  /** Formatted string for prompt injection */
  promptContext: string
  /** Whether any foods were found */
  hasData: boolean
}

// ============= UNIT WEIGHT DATABASE =============
// Fallback unit weights when not found in CIQUAL/OFF
// These are common French foods with well-known unit weights

const COMMON_UNIT_WEIGHTS: Record<string, { weight: number; unit: string; kcalPer100g: number }> = {
  // Fruits à coque
  'amande': { weight: 1.2, unit: '1 amande', kcalPer100g: 634 },
  'noix': { weight: 5, unit: '1 noix', kcalPer100g: 654 },
  'noisette': { weight: 1.5, unit: '1 noisette', kcalPer100g: 628 },
  'pistache': { weight: 0.6, unit: '1 pistache', kcalPer100g: 562 },
  'cacahuete': { weight: 0.8, unit: '1 cacahuète', kcalPer100g: 567 },
  'noix de cajou': { weight: 1.5, unit: '1 noix de cajou', kcalPer100g: 553 },
  'noix de pecan': { weight: 4, unit: '1 noix de pécan', kcalPer100g: 691 },
  'noix de macadamia': { weight: 2.5, unit: '1 noix de macadamia', kcalPer100g: 718 },
  'noix du bresil': { weight: 5, unit: '1 noix du Brésil', kcalPer100g: 656 },

  // Fruits secs
  'datte': { weight: 8, unit: '1 datte Deglet', kcalPer100g: 282 },
  'datte medjool': { weight: 24, unit: '1 datte Medjool', kcalPer100g: 277 },
  'pruneau': { weight: 10, unit: '1 pruneau', kcalPer100g: 240 },
  'abricot sec': { weight: 8, unit: '1 abricot sec', kcalPer100g: 241 },
  'figue seche': { weight: 20, unit: '1 figue sèche', kcalPer100g: 249 },
  'raisin sec': { weight: 0.5, unit: '1 raisin sec', kcalPer100g: 299 },

  // Olives
  'olive verte': { weight: 4, unit: '1 olive verte', kcalPer100g: 145 },
  'olive noire': { weight: 3, unit: '1 olive noire', kcalPer100g: 115 },
  'olive': { weight: 3.5, unit: '1 olive', kcalPer100g: 130 },

  // Oeufs
  'oeuf': { weight: 50, unit: '1 oeuf moyen', kcalPer100g: 140 },
  'oeuf de caille': { weight: 10, unit: '1 oeuf de caille', kcalPer100g: 158 },

  // Fruits frais
  'pomme': { weight: 180, unit: '1 pomme moyenne', kcalPer100g: 52 },
  'banane': { weight: 120, unit: '1 banane (sans peau)', kcalPer100g: 89 },
  'orange': { weight: 150, unit: '1 orange moyenne', kcalPer100g: 47 },
  'clementine': { weight: 60, unit: '1 clémentine', kcalPer100g: 47 },
  'kiwi': { weight: 75, unit: '1 kiwi', kcalPer100g: 61 },
  'fraise': { weight: 12, unit: '1 fraise', kcalPer100g: 32 },
  'cerise': { weight: 8, unit: '1 cerise', kcalPer100g: 63 },
  'raisin': { weight: 5, unit: '1 grain de raisin', kcalPer100g: 67 },
  'abricot': { weight: 45, unit: '1 abricot', kcalPer100g: 48 },
  'peche': { weight: 150, unit: '1 pêche', kcalPer100g: 39 },
  'poire': { weight: 180, unit: '1 poire', kcalPer100g: 57 },
  'mangue': { weight: 200, unit: '1 mangue (chair)', kcalPer100g: 60 },
  'avocat': { weight: 150, unit: '1 avocat (chair)', kcalPer100g: 160 },

  // Légumes
  'tomate': { weight: 100, unit: '1 tomate moyenne', kcalPer100g: 18 },
  'tomate cerise': { weight: 15, unit: '1 tomate cerise', kcalPer100g: 18 },
  'carotte': { weight: 80, unit: '1 carotte moyenne', kcalPer100g: 41 },
  'concombre': { weight: 300, unit: '1 concombre', kcalPer100g: 16 },
  'courgette': { weight: 200, unit: '1 courgette', kcalPer100g: 17 },
  'poivron': { weight: 150, unit: '1 poivron', kcalPer100g: 31 },
  'oignon': { weight: 100, unit: '1 oignon moyen', kcalPer100g: 40 },
  'ail': { weight: 4, unit: '1 gousse d\'ail', kcalPer100g: 149 },
  'champignon': { weight: 15, unit: '1 champignon', kcalPer100g: 22 },
  'pomme de terre': { weight: 150, unit: '1 pomme de terre moyenne', kcalPer100g: 77 },

  // Pain & Viennoiseries
  'tranche de pain': { weight: 30, unit: '1 tranche', kcalPer100g: 265 },
  'croissant': { weight: 45, unit: '1 croissant', kcalPer100g: 406 },
  'pain au chocolat': { weight: 65, unit: '1 pain au chocolat', kcalPer100g: 414 },
  'baguette': { weight: 250, unit: '1 baguette', kcalPer100g: 289 },

  // Produits laitiers
  'yaourt': { weight: 125, unit: '1 yaourt', kcalPer100g: 60 },
  'yaourt grec': { weight: 150, unit: '1 yaourt grec', kcalPer100g: 97 },

  // Viande/Poisson
  'tranche de jambon': { weight: 30, unit: '1 tranche', kcalPer100g: 107 },
  'saucisse': { weight: 50, unit: '1 saucisse', kcalPer100g: 268 },
  'chipolata': { weight: 50, unit: '1 chipolata', kcalPer100g: 268 },
  'crevette': { weight: 10, unit: '1 crevette moyenne', kcalPer100g: 99 },

  // Autres
  'carre de chocolat': { weight: 5, unit: '1 carré', kcalPer100g: 545 },
  'carre de sucre': { weight: 5, unit: '1 morceau', kcalPer100g: 400 },

  // Féculents CUITS (valeurs pour aliments cuits, pas crus!)
  'pates': { weight: 200, unit: '1 portion de pâtes', kcalPer100g: 131 },
  'pates bolognaise': { weight: 300, unit: '1 assiette', kcalPer100g: 140 },
  'spaghetti': { weight: 200, unit: '1 portion', kcalPer100g: 131 },
  'spaghetti bolognaise': { weight: 300, unit: '1 assiette', kcalPer100g: 140 },
  'riz': { weight: 150, unit: '1 portion de riz', kcalPer100g: 130 },
  'riz blanc': { weight: 150, unit: '1 portion', kcalPer100g: 130 },
  'riz complet': { weight: 150, unit: '1 portion', kcalPer100g: 123 },
  'quinoa': { weight: 150, unit: '1 portion', kcalPer100g: 120 },
  'semoule': { weight: 150, unit: '1 portion', kcalPer100g: 112 },
  'puree': { weight: 200, unit: '1 portion', kcalPer100g: 95 },
  'puree de pommes de terre': { weight: 200, unit: '1 portion', kcalPer100g: 95 },

  // Plats préparés courants
  'lasagnes': { weight: 350, unit: '1 portion', kcalPer100g: 135 },
  'lasagne': { weight: 350, unit: '1 portion', kcalPer100g: 135 },
  'hachis parmentier': { weight: 300, unit: '1 portion', kcalPer100g: 120 },
  'gratin dauphinois': { weight: 200, unit: '1 portion', kcalPer100g: 150 },
  'couscous': { weight: 400, unit: '1 assiette', kcalPer100g: 140 },
  'paella': { weight: 350, unit: '1 portion', kcalPer100g: 150 },
  'risotto': { weight: 300, unit: '1 portion', kcalPer100g: 130 },
  'pizza': { weight: 250, unit: '1/2 pizza', kcalPer100g: 250 },
  'burger': { weight: 200, unit: '1 burger', kcalPer100g: 250 },
  'wrap': { weight: 180, unit: '1 wrap', kcalPer100g: 200 },
  'tacos': { weight: 200, unit: '1 tacos', kcalPer100g: 200 },
  'kebab': { weight: 300, unit: '1 kebab', kcalPer100g: 220 },
}

// ============= FOOD NAME EXTRACTION =============

/**
 * Extract potential food names from user input
 * Handles French text with quantities like "10 amandes" or "une pomme et 2 oeufs"
 */
export function extractFoodNames(input: string): string[] {
  const normalizedInput = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents for matching

  const foods: string[] = []

  // Pattern: number + food name (e.g., "10 amandes", "2 oeufs")
  const quantityPattern = /(\d+)\s+([a-z\s]+?)(?:\s+et\s+|\s*,\s*|$)/g
  let match

  while ((match = quantityPattern.exec(normalizedInput)) !== null) {
    const foodName = match[2].trim()
    if (foodName.length > 2) {
      foods.push(foodName)
    }
  }

  // Pattern: "une/un/des" + food name
  const articlePattern = /(?:une?|des|du|de la|de l')\s+([a-z\s]+?)(?:\s+et\s+|\s*,\s*|$)/g

  while ((match = articlePattern.exec(normalizedInput)) !== null) {
    const foodName = match[1].trim()
    if (foodName.length > 2 && !foods.includes(foodName)) {
      foods.push(foodName)
    }
  }

  // If no patterns matched, try to split by common separators
  if (foods.length === 0) {
    const parts = normalizedInput.split(/\s+et\s+|,|\s+avec\s+/)
    for (const part of parts) {
      const cleanPart = part.replace(/^\d+\s*/, '').trim()
      if (cleanPart.length > 2) {
        foods.push(cleanPart)
      }
    }
  }

  return Array.from(new Set(foods)) // Remove duplicates
}

// ============= DATABASE QUERIES =============

/**
 * Search for a food in CIQUAL database
 */
async function searchFoodInCIQUAL(foodName: string): Promise<FoodDataResult | null> {
  try {
    const results = await searchCIQUAL(foodName)

    if (results.length === 0) return null

    // Find best match
    const best = results[0]

    // Check if we have unit weight data in our fallback
    const unitData = findUnitWeight(foodName)

    return {
      name: best.name,
      per100g: {
        calories: best.nutrition.calories,
        proteins: best.nutrition.proteins,
        carbs: best.nutrition.carbs,
        fats: best.nutrition.fats,
        fiber: best.extendedNutrition?.fiber,
      },
      typicalUnitWeight: unitData?.weight,
      unitDescription: unitData?.unit,
      source: 'ciqual',
      confidence: 0.9,
    }
  } catch (error) {
    console.warn('[FoodRAG] CIQUAL search error:', error)
    return null
  }
}

/**
 * Search for a food in Open Food Facts
 */
async function searchFoodInOFF(foodName: string): Promise<FoodDataResult | null> {
  try {
    const results = await searchOFF(foodName, 5)

    if (results.length === 0) return null

    // Find best match (prefer products with complete nutrition data)
    const best = results.find(r =>
      r.extendedNutrition &&
      r.extendedNutrition.calories > 0 &&
      r.extendedNutrition.proteins !== undefined
    ) || results[0]

    // Check if we have unit weight data
    const unitData = findUnitWeight(foodName)

    // Try to extract unit weight from product serving size
    let typicalUnitWeight = unitData?.weight
    if (!typicalUnitWeight && best.portion && best.portion !== 100) {
      typicalUnitWeight = best.portion
    }

    return {
      name: best.name,
      per100g: {
        calories: best.extendedNutrition?.calories || best.nutrition.calories,
        proteins: best.extendedNutrition?.proteins || best.nutrition.proteins,
        carbs: best.extendedNutrition?.carbs || best.nutrition.carbs,
        fats: best.extendedNutrition?.fats || best.nutrition.fats,
        fiber: best.extendedNutrition?.fiber,
      },
      typicalUnitWeight,
      unitDescription: unitData?.unit,
      source: 'off',
      confidence: 0.8,
    }
  } catch (error) {
    console.warn('[FoodRAG] OFF search error:', error)
    return null
  }
}

/**
 * Find unit weight from our fallback database
 */
function findUnitWeight(foodName: string): { weight: number; unit: string; kcalPer100g: number } | null {
  const normalized = foodName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  // Direct match
  if (COMMON_UNIT_WEIGHTS[normalized]) {
    return COMMON_UNIT_WEIGHTS[normalized]
  }

  // Partial match (e.g., "amandes grillees" matches "amande")
  for (const [key, value] of Object.entries(COMMON_UNIT_WEIGHTS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value
    }
  }

  // Handle plural forms
  const singular = normalized.replace(/s$/, '')
  if (COMMON_UNIT_WEIGHTS[singular]) {
    return COMMON_UNIT_WEIGHTS[singular]
  }

  return null
}

/**
 * Get fallback data from our unit weight database
 */
function getFallbackData(foodName: string): FoodDataResult | null {
  const unitData = findUnitWeight(foodName)

  if (!unitData) return null

  // Estimate macros based on food type
  let proteins = 0, carbs = 0, fats = 0

  // Nuts are high fat, moderate protein
  if (['amande', 'noix', 'noisette', 'pistache', 'cacahuete'].some(n => foodName.includes(n))) {
    proteins = Math.round(unitData.kcalPer100g * 0.1 / 4) // ~10% calories from protein
    fats = Math.round(unitData.kcalPer100g * 0.75 / 9) // ~75% calories from fat
    carbs = Math.round(unitData.kcalPer100g * 0.15 / 4) // ~15% calories from carbs
  }
  // Dried fruits are high carb
  else if (['datte', 'pruneau', 'abricot sec', 'figue', 'raisin sec'].some(n => foodName.includes(n))) {
    proteins = Math.round(unitData.kcalPer100g * 0.05 / 4)
    carbs = Math.round(unitData.kcalPer100g * 0.9 / 4)
    fats = Math.round(unitData.kcalPer100g * 0.05 / 9)
  }
  // Fresh fruits
  else if (['pomme', 'banane', 'orange', 'fraise', 'cerise', 'kiwi'].some(n => foodName.includes(n))) {
    proteins = 1
    carbs = Math.round(unitData.kcalPer100g / 4)
    fats = 0
  }
  // Eggs
  else if (foodName.includes('oeuf')) {
    proteins = 12
    fats = 10
    carbs = 1
  }

  return {
    name: unitData.unit.replace(/^1\s+/, '').charAt(0).toUpperCase() +
          unitData.unit.replace(/^1\s+/, '').slice(1),
    per100g: {
      calories: unitData.kcalPer100g,
      proteins,
      carbs,
      fats,
    },
    typicalUnitWeight: unitData.weight,
    unitDescription: unitData.unit,
    source: 'estimated',
    confidence: 0.7,
  }
}

// ============= MAIN RAG FUNCTION =============

/**
 * Query databases for food data and build context for AI prompt
 */
export async function getFoodDataForPrompt(input: string): Promise<FoodRAGContext> {
  const foodNames = extractFoodNames(input)

  console.log('[FoodRAG] Extracted food names:', foodNames)

  if (foodNames.length === 0) {
    return {
      foods: [],
      promptContext: '',
      hasData: false,
    }
  }

  const foods: FoodDataResult[] = []

  // Query databases for each food - OPTIMIZED for speed
  // 1. Check local database first (instant)
  // 2. Only query remote APIs if not found locally
  for (const foodName of foodNames) {
    // First: Try our local unit weight database (instant, no network)
    let result = getFallbackData(foodName)

    // If not in local DB, try remote APIs in parallel with timeout
    if (!result) {
      try {
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))

        // Run CIQUAL and OFF in parallel, first to respond wins
        const [ciqualResult, offResult] = await Promise.all([
          Promise.race([searchFoodInCIQUAL(foodName), timeoutPromise]),
          Promise.race([searchFoodInOFF(foodName), timeoutPromise]),
        ])

        // Prefer CIQUAL (French reference) over OFF
        result = ciqualResult || offResult
      } catch (error) {
        console.log(`[FoodRAG] API error for "${foodName}", using estimate`)
      }
    }

    if (result) {
      foods.push(result)
      console.log(`[FoodRAG] Found data for "${foodName}":`, {
        name: result.name,
        calories: result.per100g.calories,
        unitWeight: result.typicalUnitWeight,
        source: result.source,
      })
    } else {
      console.log(`[FoodRAG] No data found for "${foodName}"`)
    }
  }

  // Build prompt context
  const promptContext = buildPromptContext(foods)

  return {
    foods,
    promptContext,
    hasData: foods.length > 0,
  }
}

/**
 * Build formatted context string for AI prompt injection
 */
function buildPromptContext(foods: FoodDataResult[]): string {
  if (foods.length === 0) return ''

  const lines = ['DONNÉES NUTRITIONNELLES DE RÉFÉRENCE (sources: CIQUAL/OFF):']

  for (const food of foods) {
    let line = `- ${food.name}: ${food.per100g.calories} kcal/100g`
    line += ` | P:${food.per100g.proteins}g G:${food.per100g.carbs}g L:${food.per100g.fats}g`

    if (food.typicalUnitWeight && food.unitDescription) {
      line += ` | ${food.unitDescription} = ${food.typicalUnitWeight}g`
    }

    line += ` [${food.source.toUpperCase()}]`
    lines.push(line)
  }

  lines.push('')
  lines.push('RÈGLE CRITIQUE: Utilise ces valeurs EXACTES pour les calculs.')
  lines.push('Si l\'utilisateur mentionne un nombre (ex: "10 amandes"):')
  lines.push('1. Poids total = nombre × poids unitaire')
  lines.push('2. Calories = (poids total / 100) × kcal/100g')

  return lines.join('\n')
}

// ============= EXPORTS =============

export default {
  getFoodDataForPrompt,
  extractFoodNames,
  findUnitWeight,
  COMMON_UNIT_WEIGHTS,
}
