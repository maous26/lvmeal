/**
 * Static Recipes Service
 *
 * Loads pre-enriched recipes from the bundled JSON file.
 * Used in production to provide instant, French-only recipes.
 */

import type { Recipe } from '../types'

// Type for the pre-enriched recipe format
export interface StaticEnrichedRecipe {
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
  imageUrl?: string
  prepTime: number
  cookTime?: number
  totalTime: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  mealType?: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  source: string
  sourceUrl?: string
  originalTitle: string
  enrichedAt: string
}

interface EnrichedRecipesData {
  version: string
  generatedAt: string
  totalRecipes: number
  recipes: StaticEnrichedRecipe[]
}

// Cache for loaded recipes
let cachedRecipes: StaticEnrichedRecipe[] | null = null
let cachedRecipesMap: Map<string, StaticEnrichedRecipe> | null = null

/**
 * Load pre-enriched recipes from the bundled JSON file
 */
export async function loadStaticRecipes(): Promise<StaticEnrichedRecipe[]> {
  if (cachedRecipes) {
    return cachedRecipes
  }

  try {
    // Dynamic import to load the JSON data
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('../data/enriched-recipes.json') as EnrichedRecipesData

    cachedRecipes = data.recipes || []
    console.log(`Loaded ${cachedRecipes.length} static enriched recipes (v${data.version})`)

    // Build index map
    cachedRecipesMap = new Map()
    for (const recipe of cachedRecipes) {
      cachedRecipesMap.set(recipe.id, recipe)
    }

    return cachedRecipes
  } catch (error) {
    console.warn('Failed to load static recipes:', error)
    cachedRecipes = []
    cachedRecipesMap = new Map()
    return []
  }
}

/**
 * Get a specific recipe by ID
 */
export function getStaticRecipe(id: string): StaticEnrichedRecipe | null {
  if (!cachedRecipesMap) {
    return null
  }
  return cachedRecipesMap.get(id) || null
}

/**
 * Check if static recipes are loaded
 */
export function hasStaticRecipes(): boolean {
  return cachedRecipes !== null && cachedRecipes.length > 0
}

/**
 * Get total count of static recipes
 */
export function getStaticRecipeCount(): number {
  return cachedRecipes?.length || 0
}

/**
 * Convert static enriched recipe to Recipe type for components
 */
export function staticToRecipe(enriched: StaticEnrichedRecipe): Recipe {
  return {
    id: enriched.id,
    title: enriched.titleFr,
    description: enriched.descriptionFr,
    imageUrl: enriched.imageUrl,
    servings: enriched.servings,
    prepTime: enriched.prepTime,
    cookTime: enriched.cookTime,
    totalTime: enriched.totalTime,
    difficulty: enriched.difficulty,
    category: 'general',
    ingredients: enriched.ingredientsFr.map((ing, idx) => ({
      id: `${enriched.id}-ing-${idx}`,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
    })),
    instructions: enriched.instructionsFr,
    nutrition: {
      calories: enriched.nutrition.calories * enriched.servings,
      proteins: enriched.nutrition.proteins * enriched.servings,
      carbs: enriched.nutrition.carbs * enriched.servings,
      fats: enriched.nutrition.fats * enriched.servings,
    },
    nutritionPerServing: enriched.nutrition,
    tags: [],
    dietTypes: [],
    allergens: [],
    rating: 0, // No rating by default - only show if user rated
    ratingCount: 0,
    isFavorite: false,
    source: enriched.source,
    sourceUrl: enriched.sourceUrl,
    createdAt: enriched.enrichedAt,
  }
}

/**
 * Get all static recipes as Recipe type
 */
export function getAllStaticRecipesAsRecipe(): Recipe[] {
  if (!cachedRecipes) {
    return []
  }
  return cachedRecipes.map(staticToRecipe)
}

/**
 * Search static recipes by title (French)
 */
export function searchStaticRecipes(query: string): StaticEnrichedRecipe[] {
  if (!cachedRecipes || !query.trim()) {
    return cachedRecipes || []
  }

  const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  return cachedRecipes.filter(recipe => {
    const normalizedTitle = recipe.titleFr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const normalizedDesc = recipe.descriptionFr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    return normalizedTitle.includes(normalizedQuery) || normalizedDesc.includes(normalizedQuery)
  })
}

/**
 * Filter static recipes by criteria
 */
export function filterStaticRecipes(options: {
  maxCalories?: number
  minProtein?: number
  maxPrepTime?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  mealType?: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  limit?: number
}): StaticEnrichedRecipe[] {
  if (!cachedRecipes) {
    return []
  }

  let filtered = cachedRecipes

  if (options.mealType) {
    filtered = filtered.filter(r => r.mealType === options.mealType)
  }

  if (options.maxCalories) {
    filtered = filtered.filter(r => r.nutrition.calories <= options.maxCalories!)
  }

  if (options.minProtein) {
    filtered = filtered.filter(r => r.nutrition.proteins >= options.minProtein!)
  }

  if (options.maxPrepTime) {
    filtered = filtered.filter(r => r.prepTime <= options.maxPrepTime!)
  }

  if (options.difficulty) {
    filtered = filtered.filter(r => r.difficulty === options.difficulty)
  }

  if (options.limit) {
    filtered = filtered.slice(0, options.limit)
  }

  return filtered
}

/**
 * Get static recipes by meal type
 */
export function getStaticRecipesByMealType(mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'): StaticEnrichedRecipe[] {
  if (!cachedRecipes) {
    return []
  }
  return cachedRecipes.filter(r => r.mealType === mealType)
}

/**
 * Get random selection of static recipes
 */
export function getRandomStaticRecipes(count: number): StaticEnrichedRecipe[] {
  if (!cachedRecipes || cachedRecipes.length === 0) {
    return []
  }

  // Shuffle and take first N
  const shuffled = [...cachedRecipes].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}
