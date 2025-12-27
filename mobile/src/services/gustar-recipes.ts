/**
 * Gustar.io Deutsche Rezepte API Service
 *
 * API Documentation: https://rapidapi.com/gustario-gustario-default/api/gustar-io-deutsche-rezepte
 * Official site: https://gustar.io/apis/
 *
 * Features:
 * - 200,000+ German recipes database
 * - Dietary filters (vegan, vegetarian, gluten-free, keto, etc.)
 * - Nutritional information
 * - Recipe search by ingredients
 */

const RAPIDAPI_HOST = 'gustar-io-deutsche-rezepte.p.rapidapi.com'
const BASE_URL = `https://${RAPIDAPI_HOST}`

// Dietary preferences supported by the Gustar API
// Note: "omnivore" is NOT supported - only these specific diets
export type DietaryPreference =
  | 'vegetarian'
  | 'vegan'
  | 'glutenfree'
  | 'pescatarian'
  | 'paleo'
  | 'keto'
  | 'lowcarb'
  | 'dairyfree'
  | 'lowfodmap'

// List of valid diet values for API validation
const VALID_DIETS: DietaryPreference[] = [
  'vegetarian',
  'vegan',
  'glutenfree',
  'pescatarian',
  'paleo',
  'keto',
  'lowcarb',
  'dairyfree',
  'lowfodmap',
]

// Check if a diet value is valid for the API
function isValidDiet(diet: string | undefined): diet is DietaryPreference {
  return diet !== undefined && VALID_DIETS.includes(diet as DietaryPreference)
}

export interface GustarRecipe {
  id: string
  title: string
  description?: string
  image?: string
  prepTime?: number // in minutes
  cookTime?: number // in minutes
  servings?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  ingredients: GustarIngredient[]
  instructions: string[]
  nutrition?: GustarNutrition
  dietary?: DietaryPreference[]
  sourceUrl?: string
  sourceName?: string
}

export interface GustarIngredient {
  name: string
  amount: number
  unit: string
  notes?: string
}

export interface GustarNutrition {
  calories: number
  proteins: number
  carbs: number
  fats: number
  fiber?: number
  sugar?: number
  sodium?: number
}

export interface SearchRecipesParams {
  query: string
  diet?: DietaryPreference
  maxPrepTime?: number
  limit?: number
  offset?: number
}

export interface SearchRecipesResponse {
  recipes: GustarRecipe[]
  total: number
  hasMore: boolean
}

class GustarRecipesService {
  private apiKey: string | null = null

  /**
   * Initialize the service with RapidAPI key
   */
  init(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0
  }

  /**
   * Get headers for API requests (GET)
   */
  private getHeaders(): HeadersInit {
    if (!this.apiKey) {
      throw new Error('Gustar API key not configured. Call init() first.')
    }
    // Don't include Content-Type for GET requests - can cause 400 errors
    return {
      'X-RapidAPI-Host': RAPIDAPI_HOST,
      'X-RapidAPI-Key': this.apiKey,
    }
  }

  /**
   * Get headers for API requests (POST)
   */
  private getPostHeaders(): HeadersInit {
    if (!this.apiKey) {
      throw new Error('Gustar API key not configured. Call init() first.')
    }
    return {
      'X-RapidAPI-Host': RAPIDAPI_HOST,
      'X-RapidAPI-Key': this.apiKey,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Search recipes by text query
   */
  async searchRecipes(params: SearchRecipesParams): Promise<SearchRecipesResponse> {
    const { query, diet, maxPrepTime, limit = 10, offset = 0 } = params

    const searchParams = new URLSearchParams({
      text: query,
      limit: limit.toString(),
      offset: offset.toString(),
    })

    // Only add diet parameter if it's a valid Gustar API value
    // "omnivore" and other non-standard values will be ignored
    if (isValidDiet(diet)) {
      searchParams.append('diet', diet)
    }

    if (maxPrepTime) {
      searchParams.append('maxPrepTime', maxPrepTime.toString())
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

      const url = `${BASE_URL}/search_api?${searchParams}`
      const headers = this.getHeaders()

      console.log('Gustar API request:', url)
      console.log('Gustar API key configured:', this.apiKey ? `${this.apiKey.substring(0, 8)}...` : 'NONE')

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        // Log more details for debugging
        const errorText = await response.text().catch(() => 'Unable to read error')
        console.warn(`Gustar API returned ${response.status}: ${errorText}`)
        // Return empty result instead of throwing
        return { recipes: [], total: 0, hasMore: false }
      }

      const data = await response.json()
      console.log('Gustar API success! Raw response length:', Array.isArray(data) ? data.length : 'not array')

      // Transform response to our format
      return this.transformSearchResponse(data)
    } catch (error) {
      // Silently handle errors and return empty results
      console.warn('Gustar search unavailable:', error instanceof Error ? error.message : 'Unknown error')
      return { recipes: [], total: 0, hasMore: false }
    }
  }

  /**
   * Get nutritional information for a recipe or ingredients
   */
  async getNutrition(recipeId: string): Promise<GustarNutrition | null> {
    try {
      const response = await fetch(`${BASE_URL}/nutrition?recipeId=${recipeId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return this.transformNutritionResponse(data)
    } catch (error) {
      console.error('Error fetching nutrition:', error)
      return null
    }
  }

  /**
   * Classify dietary preferences for a recipe
   */
  async classifyDiet(ingredients: string[]): Promise<DietaryPreference[]> {
    try {
      const response = await fetch(`${BASE_URL}/dietClassifier`, {
        method: 'POST',
        headers: this.getPostHeaders(),
        body: JSON.stringify({ ingredients }),
      })

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return data.diets || []
    } catch (error) {
      console.error('Error classifying diet:', error)
      return []
    }
  }

  /**
   * Transform API search response to our format
   */
  private transformSearchResponse(apiResponse: unknown): SearchRecipesResponse {
    // API returns array directly, not wrapped in object
    const recipesArray = Array.isArray(apiResponse) ? apiResponse : []

    const recipes: GustarRecipe[] = recipesArray.map((item: unknown) =>
      this.transformRecipe(item)
    )

    return {
      recipes,
      total: recipes.length,
      hasMore: recipes.length >= 10, // Assume more if we got a full page
    }
  }

  /**
   * Transform single recipe from API format
   */
  private transformRecipe(apiRecipe: unknown): GustarRecipe {
    const recipe = apiRecipe as Record<string, unknown>

    // Extract image from image_urls array
    const imageUrls = recipe.image_urls as string[] | undefined
    const image = imageUrls && imageUrls.length > 0 ? imageUrls[0] : undefined

    // totalTime is in seconds, convert to minutes
    const totalTimeSeconds = recipe.totalTime as number | undefined
    const prepTime = totalTimeSeconds ? Math.round(totalTimeSeconds / 60) : undefined

    // Map difficulty from string
    const difficultyStr = recipe.difficulty as string | undefined
    const difficulty = difficultyStr === 'easy' ? 'easy' : difficultyStr === 'hard' ? 'hard' : 'medium'

    return {
      id: String(recipe.id || recipe._id || recipe.source || Math.random().toString(36)),
      title: String(recipe.title || recipe.name || 'Untitled'),
      description: recipe.keywords as string | undefined,
      image,
      prepTime,
      cookTime: undefined,
      servings: recipe.portions as number | undefined,
      difficulty: difficultyStr ? difficulty : undefined,
      ingredients: this.transformIngredients(recipe.ingredients),
      instructions: this.transformInstructions(recipe.instructions || recipe.steps),
      nutrition: recipe.nutrition ? this.transformNutritionResponse(recipe.nutrition) : undefined,
      dietary: recipe.dietary as DietaryPreference[] | undefined,
      sourceUrl: recipe.source as string | undefined,
      sourceName: recipe.source_url as string | undefined,
    }
  }

  /**
   * Transform ingredients array
   */
  private transformIngredients(ingredients: unknown): GustarIngredient[] {
    if (!Array.isArray(ingredients)) return []

    return ingredients.map((ing: unknown) => {
      if (typeof ing === 'string') {
        return { name: ing, amount: 1, unit: '' }
      }
      const ingredient = ing as Record<string, unknown>
      return {
        name: String(ingredient.name || ingredient.ingredient || ''),
        amount: Number(ingredient.amount || ingredient.quantity || 1),
        unit: String(ingredient.unit || ''),
        notes: ingredient.notes as string | undefined,
      }
    })
  }

  /**
   * Transform instructions array
   */
  private transformInstructions(instructions: unknown): string[] {
    if (!instructions) return []
    if (typeof instructions === 'string') return [instructions]
    if (Array.isArray(instructions)) {
      return instructions.map((step: unknown) =>
        typeof step === 'string' ? step : String((step as Record<string, unknown>).text || step)
      )
    }
    return []
  }

  /**
   * Transform nutrition data
   */
  private transformNutritionResponse(nutrition: unknown): GustarNutrition {
    const data = nutrition as Record<string, unknown>
    return {
      calories: Number(data.calories || data.kcal || 0),
      proteins: Number(data.proteins || data.protein || 0),
      carbs: Number(data.carbs || data.carbohydrates || 0),
      fats: Number(data.fats || data.fat || 0),
      fiber: data.fiber as number | undefined,
      sugar: data.sugar as number | undefined,
      sodium: data.sodium as number | undefined,
    }
  }
}

// Export singleton instance
export const gustarRecipes = new GustarRecipesService()

// Export types for use in components
export type { GustarRecipesService }
