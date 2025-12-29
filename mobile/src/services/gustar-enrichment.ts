/**
 * Gustar Recipe Enrichment Service
 *
 * Background service to enrich German recipes with French translations.
 * - Runs in background without blocking UI
 * - Batches requests to reduce API calls
 * - Persists results to Zustand store
 * - Filters out unhealthy recipes (too sweet/salty) based on RAG criteria
 */

import { useGustarStore, type EnrichedGustarRecipe } from '../stores/gustar-store'
import { enrichRecipesBatch, hasOpenAIApiKey, type RecipeToEnrich } from './ai-service'
import type { GustarRecipe, GustarNutrition } from './gustar-recipes'
import type { Recipe } from '../types'

// Enrichment queue state
let isEnriching = false
let enrichmentQueue: Array<{ recipe: Recipe | GustarRecipe; resolve: (result: EnrichedGustarRecipe | null) => void }> = []

// Batch size and delay
const BATCH_SIZE = 3
const BATCH_DELAY_MS = 500

// ============= HEALTH FILTERS (based on RAG/OMS recommendations) =============

// Maximum sugar per serving (grams) - OMS recommends limiting added sugars
const MAX_SUGAR_SAVORY = 15 // For savory dishes
const MAX_SUGAR_DESSERT = 25 // For desserts (more lenient)

// Maximum sodium per serving (mg) - OMS recommends <2000mg/day
const MAX_SODIUM_PER_SERVING = 600

// Ingredients that indicate high sugar content (German terms from Gustar)
const HIGH_SUGAR_INGREDIENTS = [
  // German terms
  'zucker', 'honig', 'sirup', 'karamell', 'schokolade', 'marmelade', 'nutella',
  'ahornsirup', 'agavensirup', 'puderzucker', 'kandiszucker', 'rohrzucker',
  // Sauces
  'ketchup', 'barbecue', 'teriyaki', 'sweet chili', 'süß-sauer',
  // French terms (for already enriched)
  'sucre', 'miel', 'sirop', 'caramel', 'confiture', 'chocolat',
]

// Ingredients that indicate high sodium content (German terms from Gustar)
const HIGH_SODIUM_INGREDIENTS = [
  // German terms
  'brühwürfel', 'bouillon', 'sojasauce', 'sojasoße', 'oliven', 'sardellen', 'anchovis',
  'speck', 'bacon', 'schinken', 'salami', 'wurst', 'parmesan', 'feta', 'roquefort',
  'kapern', 'essiggurken', 'senf',
  // French terms
  'bouillon cube', 'sauce soja', 'anchois', 'lardons', 'jambon', 'bacon',
]

// Recipe categories to exclude from daily plans (only for cheat meals)
const EXCLUDED_CATEGORIES = [
  // German dessert/pastry terms
  'kuchen', 'torte', 'dessert', 'nachtisch', 'süßspeise', 'gebäck', 'plätzchen',
  'muffin', 'brownie', 'cookie', 'mousse', 'creme', 'eis', 'sorbet',
  // Party/heavy dishes
  'raclette', 'fondue', 'tartiflette', 'burger', 'pizza',
  // French terms
  'gateau', 'tarte sucree', 'patisserie', 'confiserie',
]

/**
 * Check if a recipe is too sweet based on ingredients and nutrition
 */
function isTooSweet(recipe: Recipe | GustarRecipe): boolean {
  const title = recipe.title.toLowerCase()
  const ingredients = getIngredientNames(recipe)

  // Check nutrition if available
  const nutrition = getNutrition(recipe)
  if (nutrition?.sugar !== undefined && nutrition.sugar > MAX_SUGAR_SAVORY) {
    // Allow desserts to have more sugar
    if (!isLikelyDessert(title)) {
      console.log(`GustarEnrichment: Filtered ${recipe.title} - too much sugar (${nutrition.sugar}g)`)
      return true
    } else if (nutrition.sugar > MAX_SUGAR_DESSERT) {
      console.log(`GustarEnrichment: Filtered ${recipe.title} - dessert too sweet (${nutrition.sugar}g)`)
      return true
    }
  }

  // Count high-sugar ingredients
  const sugarIngredientCount = HIGH_SUGAR_INGREDIENTS.filter(ing =>
    ingredients.some(i => i.includes(ing)) || title.includes(ing)
  ).length

  // If 3+ high-sugar ingredients in a savory dish, it's probably too sweet
  if (sugarIngredientCount >= 3 && !isLikelyDessert(title)) {
    console.log(`GustarEnrichment: Filtered ${recipe.title} - too many sweet ingredients (${sugarIngredientCount})`)
    return true
  }

  return false
}

/**
 * Check if a recipe is too salty based on ingredients and nutrition
 */
function isTooSalty(recipe: Recipe | GustarRecipe): boolean {
  const title = recipe.title.toLowerCase()
  const ingredients = getIngredientNames(recipe)

  // Check nutrition if available
  const nutrition = getNutrition(recipe)
  if (nutrition?.sodium !== undefined && nutrition.sodium > MAX_SODIUM_PER_SERVING) {
    console.log(`GustarEnrichment: Filtered ${recipe.title} - too much sodium (${nutrition.sodium}mg)`)
    return true
  }

  // Count high-sodium ingredients
  const saltIngredientCount = HIGH_SODIUM_INGREDIENTS.filter(ing =>
    ingredients.some(i => i.includes(ing)) || title.includes(ing)
  ).length

  // If 3+ high-sodium ingredients, it's probably too salty
  if (saltIngredientCount >= 3) {
    console.log(`GustarEnrichment: Filtered ${recipe.title} - too many salty ingredients (${saltIngredientCount})`)
    return true
  }

  return false
}

/**
 * Check if recipe belongs to an excluded category (party dishes, heavy desserts)
 */
function isExcludedCategory(recipe: Recipe | GustarRecipe): boolean {
  const title = recipe.title.toLowerCase()

  for (const category of EXCLUDED_CATEGORIES) {
    if (title.includes(category)) {
      console.log(`GustarEnrichment: Filtered ${recipe.title} - excluded category (${category})`)
      return true
    }
  }

  return false
}

/**
 * Check if a recipe title suggests it's a dessert
 */
function isLikelyDessert(title: string): boolean {
  const dessertTerms = ['kuchen', 'torte', 'dessert', 'nachtisch', 'süß', 'mousse',
    'pudding', 'eis', 'sorbet', 'creme', 'gateau', 'tarte', 'cake', 'brownie', 'cookie']
  return dessertTerms.some(term => title.includes(term))
}

/**
 * Get ingredient names as lowercase strings
 */
function getIngredientNames(recipe: Recipe | GustarRecipe): string[] {
  if ('image' in recipe) {
    // GustarRecipe
    return (recipe as GustarRecipe).ingredients.map(i => i.name.toLowerCase())
  } else {
    // Recipe
    return (recipe as Recipe).ingredients.map(i => i.name.toLowerCase())
  }
}

/**
 * Get nutrition from recipe if available
 */
function getNutrition(recipe: Recipe | GustarRecipe): GustarNutrition | null {
  if ('image' in recipe) {
    return (recipe as GustarRecipe).nutrition || null
  } else {
    const r = recipe as Recipe
    if (r.nutritionPerServing) {
      return {
        calories: r.nutritionPerServing.calories,
        proteins: r.nutritionPerServing.proteins,
        carbs: r.nutritionPerServing.carbs,
        fats: r.nutritionPerServing.fats,
        sugar: (r.nutritionPerServing as { sugar?: number }).sugar,
        sodium: (r.nutritionPerServing as { sodium?: number }).sodium,
      }
    }
    return null
  }
}

/**
 * Check if a recipe should be enriched based on health criteria
 * Returns true if recipe passes all health filters
 */
export function shouldEnrichRecipe(recipe: Recipe | GustarRecipe): boolean {
  // Skip excluded categories (party dishes, heavy desserts)
  if (isExcludedCategory(recipe)) {
    return false
  }

  // Skip recipes that are too sweet
  if (isTooSweet(recipe)) {
    return false
  }

  // Skip recipes that are too salty
  if (isTooSalty(recipe)) {
    return false
  }

  return true
}

/**
 * Check if a recipe is already enriched in the store
 */
export function isRecipeEnriched(recipeId: string): boolean {
  return useGustarStore.getState().hasEnrichedRecipe(recipeId)
}

/**
 * Get enriched recipe from store
 */
export function getEnrichedRecipe(recipeId: string): EnrichedGustarRecipe | null {
  return useGustarStore.getState().getEnrichedRecipe(recipeId)
}

/**
 * Get multiple enriched recipes from store
 */
export function getEnrichedRecipes(recipeIds: string[]): Map<string, EnrichedGustarRecipe> {
  const store = useGustarStore.getState()
  const result = new Map<string, EnrichedGustarRecipe>()
  recipeIds.forEach((id) => {
    const recipe = store.enrichedRecipes[id]
    if (recipe) {
      result.set(id, recipe)
    }
  })
  return result
}

/**
 * Convert GustarRecipe or Recipe to RecipeToEnrich format
 */
function toRecipeToEnrich(recipe: Recipe | GustarRecipe): RecipeToEnrich {
  // Check if it's a GustarRecipe (has 'image' property) or Recipe (has 'imageUrl')
  const isGustarRecipe = 'image' in recipe

  if (isGustarRecipe) {
    const gr = recipe as GustarRecipe
    return {
      id: gr.id,
      title: gr.title,
      description: gr.description,
      ingredients: gr.ingredients.map((ing) => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
      })),
      instructions: gr.instructions,
      servings: gr.servings || 2,
      nutrition: gr.nutrition || null,
    }
  } else {
    const r = recipe as Recipe
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      ingredients: r.ingredients.map((ing) => ({
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
      })),
      instructions: r.instructions,
      servings: r.servings,
      nutrition: r.nutritionPerServing || null,
    }
  }
}

/**
 * Convert enrichment result to EnrichedGustarRecipe
 */
function toEnrichedGustarRecipe(
  original: Recipe | GustarRecipe,
  enriched: { titleFr: string; descriptionFr: string; ingredientsFr: Array<{ name: string; amount: number; unit: string }>; instructionsFr: string[]; nutrition: { calories: number; proteins: number; carbs: number; fats: number } }
): EnrichedGustarRecipe {
  const isGustarRecipe = 'image' in original
  const now = Date.now()

  if (isGustarRecipe) {
    const gr = original as GustarRecipe
    return {
      id: gr.id,
      originalTitle: gr.title,
      originalDescription: gr.description,
      titleFr: enriched.titleFr,
      descriptionFr: enriched.descriptionFr,
      ingredientsFr: enriched.ingredientsFr,
      instructionsFr: enriched.instructionsFr,
      nutrition: enriched.nutrition,
      imageUrl: gr.image,
      prepTime: gr.prepTime,
      cookTime: gr.cookTime,
      totalTime: (gr.prepTime || 0) + (gr.cookTime || 0),
      servings: gr.servings || 2,
      difficulty: gr.difficulty,
      source: 'Gustar.io',
      sourceUrl: gr.sourceUrl,
      enrichedAt: now,
      lastUsedAt: now,
    }
  } else {
    const r = original as Recipe
    return {
      id: r.id,
      originalTitle: r.title,
      originalDescription: r.description,
      titleFr: enriched.titleFr,
      descriptionFr: enriched.descriptionFr,
      ingredientsFr: enriched.ingredientsFr,
      instructionsFr: enriched.instructionsFr,
      nutrition: enriched.nutrition,
      imageUrl: r.imageUrl,
      prepTime: r.prepTime,
      cookTime: r.cookTime,
      totalTime: r.totalTime,
      servings: r.servings,
      difficulty: r.difficulty,
      source: r.source || 'Gustar.io',
      sourceUrl: r.sourceUrl,
      enrichedAt: now,
      lastUsedAt: now,
    }
  }
}

/**
 * Process enrichment queue in batches
 */
async function processEnrichmentQueue() {
  if (isEnriching || enrichmentQueue.length === 0) return

  isEnriching = true
  console.log(`GustarEnrichment: Processing ${enrichmentQueue.length} recipes in queue`)

  try {
    while (enrichmentQueue.length > 0) {
      // Take a batch
      const batch = enrichmentQueue.splice(0, BATCH_SIZE)

      // Filter out already enriched recipes
      const toProcess = batch.filter((item) => !isRecipeEnriched(item.recipe.id))

      if (toProcess.length === 0) {
        // All already enriched, resolve with cached values
        batch.forEach((item) => {
          const cached = getEnrichedRecipe(item.recipe.id)
          item.resolve(cached)
        })
        continue
      }

      // Convert to enrichment format
      const recipesToEnrich = toProcess.map((item) => toRecipeToEnrich(item.recipe))

      try {
        // Call AI enrichment
        const enrichedMap = await enrichRecipesBatch(recipesToEnrich)

        // Process results
        const enrichedRecipes: EnrichedGustarRecipe[] = []

        toProcess.forEach((item) => {
          const enriched = enrichedMap.get(item.recipe.id)
          if (enriched) {
            const fullEnriched = toEnrichedGustarRecipe(item.recipe, enriched)
            enrichedRecipes.push(fullEnriched)
            item.resolve(fullEnriched)
          } else {
            item.resolve(null)
          }
        })

        // Resolve any that were already cached
        batch.forEach((item) => {
          if (!toProcess.includes(item)) {
            const cached = getEnrichedRecipe(item.recipe.id)
            item.resolve(cached)
          }
        })

        // Persist to store
        if (enrichedRecipes.length > 0) {
          useGustarStore.getState().addEnrichedRecipes(enrichedRecipes)
          console.log(`GustarEnrichment: Saved ${enrichedRecipes.length} enriched recipes`)
        }
      } catch (error) {
        console.warn('GustarEnrichment: Batch failed:', error)
        // Resolve all with null on error
        batch.forEach((item) => item.resolve(null))
      }

      // Small delay between batches to avoid rate limiting
      if (enrichmentQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }
  } finally {
    isEnriching = false
  }
}

/**
 * Queue a recipe for enrichment (non-blocking)
 * Returns immediately if already enriched, otherwise queues for background processing
 * Skips recipes that don't pass health filters (too sweet/salty)
 */
export function queueForEnrichment(recipe: Recipe | GustarRecipe): Promise<EnrichedGustarRecipe | null> {
  // Check if already enriched
  const cached = getEnrichedRecipe(recipe.id)
  if (cached) {
    return Promise.resolve(cached)
  }

  // Check if recipe passes health filters
  if (!shouldEnrichRecipe(recipe)) {
    return Promise.resolve(null)
  }

  // Add to queue
  return new Promise((resolve) => {
    enrichmentQueue.push({ recipe, resolve })
    // Start processing (non-blocking)
    setTimeout(() => processEnrichmentQueue(), 0)
  })
}

/**
 * Queue multiple recipes for enrichment
 * Applies health filters to skip unhealthy recipes (too sweet/salty)
 */
export function queueRecipesForEnrichment(recipes: Array<Recipe | GustarRecipe>): void {
  // Filter out already enriched AND unhealthy recipes
  const toQueue = recipes.filter((r) => {
    if (isRecipeEnriched(r.id)) return false
    if (!shouldEnrichRecipe(r)) return false
    return true
  })

  const filtered = recipes.length - toQueue.length
  if (filtered > 0) {
    console.log(`GustarEnrichment: Filtered ${filtered} recipes (already enriched or unhealthy)`)
  }

  if (toQueue.length === 0) {
    console.log('GustarEnrichment: No recipes to enrich after filtering')
    return
  }

  console.log(`GustarEnrichment: Queueing ${toQueue.length} healthy recipes for enrichment`)

  toQueue.forEach((recipe) => {
    enrichmentQueue.push({
      recipe,
      resolve: () => {}, // Fire-and-forget
    })
  })

  // Start processing
  setTimeout(() => processEnrichmentQueue(), 0)
}

/**
 * Enrich recipes synchronously (blocks until done)
 * Use sparingly - prefer queueForEnrichment for better UX
 * Applies health filters to skip unhealthy recipes
 */
export async function enrichRecipesSync(
  recipes: Array<Recipe | GustarRecipe>
): Promise<Map<string, EnrichedGustarRecipe>> {
  const hasKey = await hasOpenAIApiKey()
  if (!hasKey) {
    console.log('GustarEnrichment: No OpenAI key, skipping')
    return new Map()
  }

  const result = new Map<string, EnrichedGustarRecipe>()

  // First, get any already enriched
  recipes.forEach((r) => {
    const cached = getEnrichedRecipe(r.id)
    if (cached) {
      result.set(r.id, cached)
    }
  })

  // Filter out already enriched AND unhealthy recipes
  const toEnrich = recipes.filter((r) => {
    if (result.has(r.id)) return false
    if (!shouldEnrichRecipe(r)) {
      console.log(`GustarEnrichment: Skipping unhealthy recipe: ${r.title}`)
      return false
    }
    return true
  })

  if (toEnrich.length === 0) {
    return result
  }

  // Enrich remaining
  const recipesToEnrich = toEnrich.map(toRecipeToEnrich)

  try {
    const enrichedMap = await enrichRecipesBatch(recipesToEnrich)
    const newEnriched: EnrichedGustarRecipe[] = []

    toEnrich.forEach((recipe) => {
      const enriched = enrichedMap.get(recipe.id)
      if (enriched) {
        const fullEnriched = toEnrichedGustarRecipe(recipe, enriched)
        newEnriched.push(fullEnriched)
        result.set(recipe.id, fullEnriched)
      }
    })

    // Persist
    if (newEnriched.length > 0) {
      useGustarStore.getState().addEnrichedRecipes(newEnriched)
    }
  } catch (error) {
    console.warn('GustarEnrichment: Sync enrichment failed:', error)
  }

  return result
}

/**
 * Get store stats
 */
export function getEnrichmentStats(): { total: number; pending: number } {
  const state = useGustarStore.getState()
  return {
    total: Object.keys(state.enrichedRecipes).length,
    pending: enrichmentQueue.length,
  }
}
