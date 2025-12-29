/**
 * Gustar Recipe Enrichment Service
 *
 * Background service to enrich German recipes with French translations.
 * - Runs in background without blocking UI
 * - Batches requests to reduce API calls
 * - Persists results to Zustand store
 * - Filters out unhealthy recipes using RAG-based health criteria:
 *   - Too much sugar (OMS guidelines)
 *   - Too much sodium (OMS guidelines)
 *   - Too much saturated fat
 *   - Excessive calories per serving
 *   - Ultra-processed foods (NOVA 4)
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

// ============= RAG-BASED HEALTH CRITERIA (OMS/ANSES recommendations) =============

// Maximum sugar per serving (grams) - OMS: <10% of daily calories from added sugars
const MAX_SUGAR_SAVORY = 10 // Reduced: savory dishes should have minimal sugar
const MAX_SUGAR_DESSERT = 20 // Desserts allowed more but still limited
const MAX_SUGAR_BREAKFAST = 15 // Breakfast can have moderate sugar (fruit, honey)

// Maximum sodium per serving (mg) - OMS: <2000mg/day total
const MAX_SODIUM_PER_SERVING = 500 // Reduced to allow for other meals

// Maximum saturated fat per serving (grams) - ANSES: <10% of daily calories
const MAX_SATURATED_FAT = 8 // ~72kcal, reasonable for one serving

// Maximum total fat percentage - Healthy meals should be <35% fat by calories
const MAX_FAT_PERCENTAGE = 40 // 40% of calories from fat max

// Maximum calories per serving by meal type
const MAX_CALORIES = {
  breakfast: 500,
  lunch: 700,
  snack: 250,
  dinner: 600,
  default: 650,
}

// Ingredients that indicate high sugar content (German terms from Gustar)
const HIGH_SUGAR_INGREDIENTS = [
  // German terms
  'zucker', 'honig', 'sirup', 'karamell', 'schokolade', 'marmelade', 'nutella',
  'ahornsirup', 'agavensirup', 'puderzucker', 'kandiszucker', 'rohrzucker',
  // Sauces with hidden sugars
  'ketchup', 'barbecue', 'teriyaki', 'sweet chili', 'süß-sauer', 'hoisin',
  // Processed sweet items
  'glasur', 'zuckerguss', 'marzipan', 'fondant', 'praline',
  // French terms (for already enriched)
  'sucre', 'miel', 'sirop', 'caramel', 'confiture', 'chocolat', 'praline',
]

// Ingredients that indicate high sodium content (German terms from Gustar)
const HIGH_SODIUM_INGREDIENTS = [
  // German terms
  'brühwürfel', 'bouillon', 'sojasauce', 'sojasoße', 'oliven', 'sardellen', 'anchovis',
  'speck', 'bacon', 'schinken', 'salami', 'wurst', 'parmesan', 'feta', 'roquefort',
  'kapern', 'essiggurken', 'senf', 'gepökelt', 'geräuchert',
  // French terms
  'bouillon cube', 'sauce soja', 'anchois', 'lardons', 'jambon', 'bacon',
  'charcuterie', 'saucisse', 'saucisson',
]

// Ingredients indicating high saturated fat (to filter out)
const HIGH_SATURATED_FAT_INGREDIENTS = [
  // German terms
  'sahne', 'schlagsahne', 'crème fraîche', 'butter', 'schmalz', 'speck',
  'kokosmilch', 'kokosöl', 'palmöl', 'mascarpone', 'rahm',
  // Fatty meats
  'bauchspeck', 'schweinebauch', 'entenbrust', 'gänsebrust', 'lamm',
  // French terms
  'crème', 'beurre', 'lard', 'saindoux', 'graisse', 'lait de coco',
  'crème épaisse', 'crème fraîche épaisse',
]

// Ultra-processed indicators (NOVA 4) - should be excluded
const ULTRA_PROCESSED_INDICATORS = [
  // German terms
  'fertiggericht', 'instant', 'tiefkühl', 'fertig', 'pulver',
  'geschmacksverstärker', 'konservierungsmittel', 'farbstoff',
  // Processed products
  'chicken nuggets', 'fish sticks', 'fischstäbchen', 'würstchen',
  'hot dog', 'corn dog', 'kroketten',
  // French terms
  'plat préparé', 'surgelé', 'instantané', 'lyophilisé',
]

// Recipe categories to exclude from daily plans (only for cheat meals)
const EXCLUDED_CATEGORIES = [
  // German dessert/pastry terms
  'kuchen', 'torte', 'dessert', 'nachtisch', 'süßspeise', 'gebäck', 'plätzchen',
  'muffin', 'brownie', 'cookie', 'mousse', 'creme', 'eis', 'sorbet',
  // Party/heavy dishes - high calorie, high fat
  'raclette', 'fondue', 'tartiflette', 'burger', 'pizza', 'lasagne',
  'gratin dauphinois', 'carbonara', 'alfredo', 'cordon bleu',
  // Fried foods
  'frittiert', 'paniert', 'gebacken', 'schnitzel', 'pommes', 'fritten',
  // French terms
  'gateau', 'tarte sucree', 'patisserie', 'confiserie', 'frites', 'friture',
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
 * Check if recipe is too fatty (high saturated fat or excessive fat percentage)
 * RAG criteria: ANSES recommends <10% of calories from saturated fat
 */
function isTooFatty(recipe: Recipe | GustarRecipe): boolean {
  const title = recipe.title.toLowerCase()
  const ingredients = getIngredientNames(recipe)
  const nutrition = getNutrition(recipe)

  // Check fat percentage if nutrition is available
  if (nutrition && nutrition.calories > 0 && nutrition.fats !== undefined) {
    const fatCalories = nutrition.fats * 9
    const fatPercentage = (fatCalories / nutrition.calories) * 100

    if (fatPercentage > MAX_FAT_PERCENTAGE) {
      console.log(`GustarEnrichment: Filtered ${recipe.title} - too much fat (${Math.round(fatPercentage)}% of calories)`)
      return true
    }
  }

  // Check for saturated fat if available
  if (nutrition && (nutrition as { saturatedFat?: number }).saturatedFat !== undefined) {
    const satFat = (nutrition as { saturatedFat?: number }).saturatedFat!
    if (satFat > MAX_SATURATED_FAT) {
      console.log(`GustarEnrichment: Filtered ${recipe.title} - too much saturated fat (${satFat}g)`)
      return true
    }
  }

  // Count high saturated fat ingredients
  const fatIngredientCount = HIGH_SATURATED_FAT_INGREDIENTS.filter(ing =>
    ingredients.some(i => i.includes(ing)) || title.includes(ing)
  ).length

  // If 3+ high-fat ingredients, it's probably too fatty
  if (fatIngredientCount >= 3) {
    console.log(`GustarEnrichment: Filtered ${recipe.title} - too many fatty ingredients (${fatIngredientCount})`)
    return true
  }

  return false
}

/**
 * Check if recipe appears to be ultra-processed (NOVA 4)
 * RAG criteria: Avoid ultra-processed foods
 */
function isUltraProcessed(recipe: Recipe | GustarRecipe): boolean {
  const title = recipe.title.toLowerCase()
  const ingredients = getIngredientNames(recipe)

  // Check for ultra-processed indicators in title or ingredients
  for (const indicator of ULTRA_PROCESSED_INDICATORS) {
    if (title.includes(indicator) || ingredients.some(i => i.includes(indicator))) {
      console.log(`GustarEnrichment: Filtered ${recipe.title} - ultra-processed indicator (${indicator})`)
      return true
    }
  }

  return false
}

/**
 * Check if recipe has too many calories for its meal type
 * RAG criteria: Respect meal-appropriate portions
 */
function hasTooManyCalories(recipe: Recipe | GustarRecipe, mealType?: string): boolean {
  const nutrition = getNutrition(recipe)

  if (!nutrition || nutrition.calories === 0) return false

  const maxCals = MAX_CALORIES[mealType as keyof typeof MAX_CALORIES] || MAX_CALORIES.default

  if (nutrition.calories > maxCals) {
    console.log(`GustarEnrichment: Filtered ${recipe.title} - too many calories (${nutrition.calories} > ${maxCals})`)
    return true
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
 * Detect likely meal type from recipe title
 */
function detectMealType(title: string): string | undefined {
  const lowerTitle = title.toLowerCase()

  // Breakfast indicators
  const breakfastTerms = ['frühstück', 'breakfast', 'petit-déjeuner', 'müsli', 'porridge',
    'omelette', 'eierkuchen', 'pfannkuchen', 'toast', 'smoothie bowl']
  if (breakfastTerms.some(t => lowerTitle.includes(t))) return 'breakfast'

  // Snack indicators
  const snackTerms = ['snack', 'zwischenmahlzeit', 'collation', 'häppchen', 'riegel',
    'energie', 'protein bar']
  if (snackTerms.some(t => lowerTitle.includes(t))) return 'snack'

  // Dinner indicators (lighter)
  const dinnerTerms = ['abendessen', 'dinner', 'dîner', 'suppe', 'soup', 'salat', 'salade']
  if (dinnerTerms.some(t => lowerTitle.includes(t))) return 'dinner'

  return undefined // Default, will use default calorie limit
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
 * Check if a recipe should be enriched based on RAG health criteria
 * Uses comprehensive filtering based on OMS/ANSES nutritional guidelines:
 * - Sugar content (OMS: <10% of daily calories from added sugars)
 * - Sodium content (OMS: <2000mg/day)
 * - Saturated fat content (ANSES: <10% of daily calories)
 * - Overall fat percentage
 * - Calorie appropriateness for meal type
 * - Ultra-processed food indicators (NOVA classification)
 *
 * Returns true if recipe passes all health filters
 */
export function shouldEnrichRecipe(recipe: Recipe | GustarRecipe): boolean {
  const title = recipe.title

  // 1. Skip excluded categories (party dishes, heavy desserts, fried foods)
  if (isExcludedCategory(recipe)) {
    return false
  }

  // 2. Skip recipes that are too sweet
  if (isTooSweet(recipe)) {
    return false
  }

  // 3. Skip recipes that are too salty
  if (isTooSalty(recipe)) {
    return false
  }

  // 4. Skip recipes that are too fatty (new RAG criterion)
  if (isTooFatty(recipe)) {
    return false
  }

  // 5. Skip ultra-processed recipes (NOVA 4)
  if (isUltraProcessed(recipe)) {
    return false
  }

  // 6. Skip recipes with excessive calories for their meal type
  const mealType = detectMealType(title)
  if (hasTooManyCalories(recipe, mealType)) {
    return false
  }

  // Recipe passes all RAG-based health filters
  console.log(`GustarEnrichment: ${title} passes all health filters`)
  return true
}

/**
 * Get health score for a recipe (0-100)
 * Higher score = healthier recipe
 * Can be used to prioritize which recipes to enrich first
 */
export function getRecipeHealthScore(recipe: Recipe | GustarRecipe): number {
  let score = 100
  const nutrition = getNutrition(recipe)
  const ingredients = getIngredientNames(recipe)
  const title = recipe.title.toLowerCase()

  // Deduct points for each health concern
  if (nutrition) {
    // Sugar penalty
    if (nutrition.sugar !== undefined) {
      if (nutrition.sugar > MAX_SUGAR_SAVORY) score -= 15
      if (nutrition.sugar > MAX_SUGAR_DESSERT) score -= 15
    }

    // Sodium penalty
    if (nutrition.sodium !== undefined && nutrition.sodium > MAX_SODIUM_PER_SERVING) {
      score -= 20
    }

    // Fat percentage penalty
    if (nutrition.calories > 0 && nutrition.fats !== undefined) {
      const fatPercentage = (nutrition.fats * 9 / nutrition.calories) * 100
      if (fatPercentage > MAX_FAT_PERCENTAGE) score -= 15
      if (fatPercentage > 50) score -= 10
    }

    // Calorie penalty
    const mealType = detectMealType(title)
    const maxCals = MAX_CALORIES[mealType as keyof typeof MAX_CALORIES] || MAX_CALORIES.default
    if (nutrition.calories > maxCals) score -= 10
  }

  // Ingredient-based penalties
  const sugarCount = HIGH_SUGAR_INGREDIENTS.filter(ing =>
    ingredients.some(i => i.includes(ing))
  ).length
  score -= sugarCount * 5

  const sodiumCount = HIGH_SODIUM_INGREDIENTS.filter(ing =>
    ingredients.some(i => i.includes(ing))
  ).length
  score -= sodiumCount * 5

  const fatCount = HIGH_SATURATED_FAT_INGREDIENTS.filter(ing =>
    ingredients.some(i => i.includes(ing))
  ).length
  score -= fatCount * 5

  // Ultra-processed penalty
  const processedCount = ULTRA_PROCESSED_INDICATORS.filter(ind =>
    title.includes(ind) || ingredients.some(i => i.includes(ind))
  ).length
  score -= processedCount * 10

  // Bonus for healthy indicators
  const healthyTerms = ['salat', 'salade', 'gemüse', 'légumes', 'grill', 'gedämpft',
    'vapeur', 'vollkorn', 'complet', 'quinoa', 'linsen', 'lentilles']
  const healthyCount = healthyTerms.filter(t => title.includes(t)).length
  score += healthyCount * 5

  return Math.max(0, Math.min(100, score))
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
