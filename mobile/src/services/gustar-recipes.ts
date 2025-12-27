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

// Dietary preferences supported by the API
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
   * Get headers for API requests
   */
  private getHeaders(): HeadersInit {
    if (!this.apiKey) {
      throw new Error('Gustar API key not configured. Call init() first.')
    }
    return {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': this.apiKey,
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

    if (diet) {
      searchParams.append('diet', diet)
    }

    if (maxPrepTime) {
      searchParams.append('maxPrepTime', maxPrepTime.toString())
    }

    try {
      const response = await fetch(`${BASE_URL}/search_api?${searchParams}`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      // Transform response to our format
      return this.transformSearchResponse(data)
    } catch (error) {
      console.error('Error searching recipes:', error)
      throw error
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
        headers: this.getHeaders(),
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
    // The actual API response structure may vary
    // This is a placeholder transformation
    const data = apiResponse as {
      results?: unknown[]
      total?: number
      hasMore?: boolean
    }

    const recipes: GustarRecipe[] = (data.results || []).map((item: unknown) =>
      this.transformRecipe(item)
    )

    return {
      recipes,
      total: data.total || recipes.length,
      hasMore: data.hasMore || false,
    }
  }

  /**
   * Transform single recipe from API format
   */
  private transformRecipe(apiRecipe: unknown): GustarRecipe {
    const recipe = apiRecipe as Record<string, unknown>

    return {
      id: String(recipe.id || recipe._id || Math.random().toString(36)),
      title: String(recipe.title || recipe.name || 'Untitled'),
      description: recipe.description as string | undefined,
      image: recipe.image as string | undefined,
      prepTime: recipe.prepTime as number | undefined,
      cookTime: recipe.cookTime as number | undefined,
      servings: recipe.servings as number | undefined,
      difficulty: recipe.difficulty as 'easy' | 'medium' | 'hard' | undefined,
      ingredients: this.transformIngredients(recipe.ingredients),
      instructions: this.transformInstructions(recipe.instructions || recipe.steps),
      nutrition: recipe.nutrition ? this.transformNutritionResponse(recipe.nutrition) : undefined,
      dietary: recipe.dietary as DietaryPreference[] | undefined,
      sourceUrl: recipe.sourceUrl as string | undefined,
      sourceName: recipe.sourceName as string | undefined,
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
