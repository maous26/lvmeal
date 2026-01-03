/**
 * Cooking Conversion Service
 *
 * Converts dry/raw food nutritional values to cooked values.
 *
 * Problem: Barcode scans and OFF return "as sold" values (dry),
 * but users eat cooked food which has different nutrition per 100g
 * due to water absorption.
 *
 * Example: Lentils dry = 316 kcal/100g, cooked = 88 kcal/100g
 */

import type { FoodItem, NutritionInfo } from '../types'

// =============================================================================
// TYPES
// =============================================================================

export interface CookingConversionRule {
  /** Unique identifier */
  id: string
  /** Display name in French */
  name: string
  /** Keywords to detect this food category (lowercase, no accents) */
  keywords: string[]
  /** OFF categories that match (lowercase) */
  offCategories: string[]
  /**
   * Conversion factor: cooked_value = dry_value * factor
   * Based on water absorption during cooking
   * Factor < 1 means calories decrease per 100g when cooked
   */
  factor: number
  /** CIQUAL cooked equivalent search term (if available) */
  ciqualCookedSearch?: string
}

export interface ConversionResult {
  /** Whether conversion is applicable */
  needsConversion: boolean
  /** The matching rule if found */
  rule?: CookingConversionRule
  /** Converted food item (if conversion applied) */
  convertedFood?: FoodItem
  /** Original food item */
  originalFood: FoodItem
}

// =============================================================================
// CONVERSION RULES
// =============================================================================

/**
 * Conversion factors based on CIQUAL data comparison (dry vs cooked)
 *
 * Calculation: cooked_kcal / dry_kcal
 * - Lentilles: 88 / 316 = 0.278
 * - Riz blanc: 127 / 356 = 0.357
 * - Pâtes: 131 / 351 = 0.373
 * - Quinoa: 120 / 368 = 0.326
 * - Pois chiches: 139 / 316 = 0.440
 * - Haricots secs: 91 / 284 = 0.320
 */
export const COOKING_CONVERSION_RULES: CookingConversionRule[] = [
  // LÉGUMINEUSES
  {
    id: 'lentilles',
    name: 'Lentilles',
    keywords: ['lentille', 'lentilles', 'lentils'],
    offCategories: ['lentilles', 'lentils', 'legumineuses'],
    factor: 0.28,
    ciqualCookedSearch: 'lentille cuite',
  },
  {
    id: 'pois_chiches',
    name: 'Pois chiches',
    keywords: ['pois chiche', 'pois chiches', 'chickpea', 'chickpeas'],
    offCategories: ['pois-chiches', 'chickpeas'],
    factor: 0.44,
    ciqualCookedSearch: 'pois chiche cuit',
  },
  {
    id: 'haricots_secs',
    name: 'Haricots secs',
    keywords: ['haricot sec', 'haricots secs', 'haricot rouge', 'haricot blanc', 'haricot noir', 'flageolet'],
    offCategories: ['haricots', 'beans', 'legumineuses'],
    factor: 0.32,
    ciqualCookedSearch: 'haricot cuit',
  },
  {
    id: 'pois_casses',
    name: 'Pois cassés',
    keywords: ['pois casse', 'pois casses', 'split peas'],
    offCategories: ['pois-casses', 'split-peas'],
    factor: 0.35,
    ciqualCookedSearch: 'pois cassé cuit',
  },

  // CÉRÉALES
  {
    id: 'riz',
    name: 'Riz',
    keywords: ['riz', 'rice', 'basmati', 'jasmin', 'thai'],
    offCategories: ['riz', 'rice', 'rices'],
    factor: 0.36,
    ciqualCookedSearch: 'riz cuit',
  },
  {
    id: 'pates',
    name: 'Pâtes',
    keywords: ['pate', 'pates', 'pasta', 'spaghetti', 'tagliatelle', 'penne', 'fusilli', 'macaroni', 'coquillette', 'farfalle', 'rigatoni'],
    offCategories: ['pates', 'pasta', 'pastas', 'pates-alimentaires'],
    factor: 0.37,
    ciqualCookedSearch: 'pâtes cuites',
  },
  {
    id: 'quinoa',
    name: 'Quinoa',
    keywords: ['quinoa'],
    offCategories: ['quinoa'],
    factor: 0.33,
    ciqualCookedSearch: 'quinoa cuit',
  },
  {
    id: 'boulgour',
    name: 'Boulgour',
    keywords: ['boulgour', 'bulgur', 'boulghour'],
    offCategories: ['boulgour', 'bulgur'],
    factor: 0.30,
    ciqualCookedSearch: 'boulgour cuit',
  },
  {
    id: 'couscous',
    name: 'Couscous',
    keywords: ['couscous', 'semoule'],
    offCategories: ['couscous', 'semolina'],
    factor: 0.35,
    ciqualCookedSearch: 'couscous cuit',
  },
  {
    id: 'orge',
    name: 'Orge',
    keywords: ['orge', 'barley'],
    offCategories: ['orge', 'barley'],
    factor: 0.30,
    ciqualCookedSearch: 'orge cuit',
  },
  {
    id: 'epeautre',
    name: 'Épeautre',
    keywords: ['epeautre', 'spelt', 'petit epeautre'],
    offCategories: ['epeautre', 'spelt'],
    factor: 0.32,
    ciqualCookedSearch: 'épeautre cuit',
  },
]

// =============================================================================
// DETECTION FUNCTIONS
// =============================================================================

/**
 * Normalize text for matching (lowercase, no accents)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Check if a food item is a dry/raw product that needs cooking conversion
 */
export function detectDryFood(food: FoodItem): CookingConversionRule | null {
  const normalizedName = normalizeText(food.name)
  const normalizedCategory = food.category ? normalizeText(food.category) : ''

  // Skip if already marked as cooked
  const cookedKeywords = ['cuit', 'cuite', 'cuites', 'cuits', 'cooked', 'bouilli', 'bouillie']
  if (cookedKeywords.some(kw => normalizedName.includes(kw))) {
    return null
  }

  // Skip if it's a prepared dish (not raw ingredient)
  const preparedKeywords = ['salade de', 'soupe', 'plat', 'prepare', 'cuisine', 'conserve']
  if (preparedKeywords.some(kw => normalizedName.includes(kw))) {
    return null
  }

  // Check each rule
  for (const rule of COOKING_CONVERSION_RULES) {
    // Check keywords in name
    const matchesKeyword = rule.keywords.some(kw => normalizedName.includes(kw))

    // Check OFF categories
    const matchesCategory = rule.offCategories.some(cat =>
      normalizedCategory.includes(cat) ||
      (food.category && normalizeText(food.category).includes(cat))
    )

    if (matchesKeyword || matchesCategory) {
      // Extra validation: check calorie range matches dry food
      // Dry foods typically have 280-380 kcal/100g
      // Cooked foods typically have 80-150 kcal/100g
      const calories = food.nutrition.calories
      if (calories >= 250 && calories <= 400) {
        return rule
      }
    }
  }

  return null
}

/**
 * Check if food is already in cooked form (low calories for starch)
 */
export function isAlreadyCooked(food: FoodItem): boolean {
  const normalizedName = normalizeText(food.name)

  // Explicit cooked keywords
  const cookedKeywords = ['cuit', 'cuite', 'cuites', 'cuits', 'cooked', 'bouilli', 'bouillie']
  if (cookedKeywords.some(kw => normalizedName.includes(kw))) {
    return true
  }

  // Check if it matches a dry food category but has low calories (already cooked values)
  for (const rule of COOKING_CONVERSION_RULES) {
    const matchesKeyword = rule.keywords.some(kw => normalizedName.includes(kw))
    if (matchesKeyword && food.nutrition.calories < 200) {
      return true
    }
  }

  return false
}

// =============================================================================
// CONVERSION FUNCTIONS
// =============================================================================

/**
 * Apply cooking conversion to nutrition values
 */
export function applyConversion(nutrition: NutritionInfo, factor: number): NutritionInfo {
  return {
    calories: Math.round(nutrition.calories * factor),
    proteins: Math.round(nutrition.proteins * factor * 10) / 10,
    carbs: Math.round(nutrition.carbs * factor * 10) / 10,
    fats: Math.round(nutrition.fats * factor * 10) / 10,
    fiber: nutrition.fiber ? Math.round(nutrition.fiber * factor * 10) / 10 : undefined,
    sugar: nutrition.sugar ? Math.round(nutrition.sugar * factor * 10) / 10 : undefined,
    sodium: nutrition.sodium ? Math.round(nutrition.sodium * factor) : undefined,
    saturatedFat: nutrition.saturatedFat ? Math.round(nutrition.saturatedFat * factor * 10) / 10 : undefined,
  }
}

export interface ConvertedFoodItem extends FoodItem {
  /** Original food ID before conversion */
  convertedFrom: string
  /** Conversion rule used */
  conversionRuleId: string
  /** Original calories before conversion */
  originalCalories: number
}

/**
 * Convert a dry food item to its cooked equivalent
 */
export function convertToCooked(food: FoodItem, rule: CookingConversionRule): ConvertedFoodItem {
  return {
    ...food,
    id: `${food.id}_cooked`,
    name: `${food.name} (cuit)`,
    nutrition: applyConversion(food.nutrition, rule.factor),
    // Mark as converted for tracking
    convertedFrom: food.id,
    conversionRuleId: rule.id,
    originalCalories: food.nutrition.calories,
  }
}

/**
 * Analyze a food item and return conversion info
 */
export function analyzeForConversion(food: FoodItem): ConversionResult {
  // Check if already cooked
  if (isAlreadyCooked(food)) {
    return {
      needsConversion: false,
      originalFood: food,
    }
  }

  // Check if needs conversion
  const rule = detectDryFood(food)

  if (rule) {
    return {
      needsConversion: true,
      rule,
      convertedFood: convertToCooked(food, rule),
      originalFood: food,
    }
  }

  return {
    needsConversion: false,
    originalFood: food,
  }
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Process a list of food items and mark those needing conversion
 */
export function analyzeFoodsForConversion(foods: FoodItem[]): Array<FoodItem & { conversionAvailable?: boolean; conversionRule?: string }> {
  return foods.map(food => {
    const analysis = analyzeForConversion(food)

    if (analysis.needsConversion && analysis.rule) {
      return {
        ...food,
        conversionAvailable: true,
        conversionRule: analysis.rule.id,
      }
    }

    return food
  })
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  detectDryFood,
  isAlreadyCooked,
  convertToCooked,
  applyConversion,
  analyzeForConversion,
  analyzeFoodsForConversion,
  COOKING_CONVERSION_RULES,
}
