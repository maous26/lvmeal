import { NextRequest, NextResponse } from 'next/server'

const RAPIDAPI_HOST = 'gustar-io-deutsche-rezepte.p.rapidapi.com'
const BASE_URL = `https://${RAPIDAPI_HOST}`

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || searchParams.get('query')
  const diet = searchParams.get('diet')
  const limit = searchParams.get('limit') || '10'
  const offset = searchParams.get('offset') || '0'

  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required' },
      { status: 400 }
    )
  }

  const apiKey = process.env.RAPIDAPI_KEY

  if (!apiKey) {
    console.error('RAPIDAPI_KEY not configured')
    return NextResponse.json(
      { error: 'Recipe API not configured' },
      { status: 503 }
    )
  }

  try {
    const params = new URLSearchParams({
      text: query,
      limit,
      offset,
    })

    if (diet) {
      params.append('diet', diet)
    }

    const response = await fetch(`${BASE_URL}/search_api?${params}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': apiKey,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gustar API error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch recipes', details: response.statusText },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Transform response to a consistent format
    const recipes = transformRecipes(data)

    return NextResponse.json({
      recipes,
      total: data.total || recipes.length,
      query,
    })
  } catch (error) {
    console.error('Recipe search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

interface ApiRecipe {
  id?: string
  _id?: string
  title?: string
  name?: string
  description?: string
  image?: string
  image_urls?: string[]
  prepTime?: number
  cookTime?: number
  totalTime?: number
  servings?: number
  portions?: number
  difficulty?: string
  ingredients?: unknown[]
  instructions?: unknown
  steps?: unknown
  nutrition?: Record<string, number>
  sourceUrl?: string
  source_url?: string
  source?: string
  sourceName?: string
}

function transformRecipes(data: unknown) {
  // API returns array directly, not { results: [...] }
  const results = Array.isArray(data) ? data : (data as { results?: ApiRecipe[] })?.results || []

  return results.map((recipe: ApiRecipe) => {
    // totalTime is in seconds, convert to minutes
    const totalTimeMinutes = recipe.totalTime ? Math.round(recipe.totalTime / 60) : null

    return {
      id: recipe.id || recipe._id || Math.random().toString(36).slice(2),
      title: recipe.title || recipe.name || 'Sans titre',
      description: recipe.description || '',
      image: recipe.image_urls?.[0] || recipe.image || null,
      prepTime: recipe.prepTime || totalTimeMinutes || null,
      cookTime: recipe.cookTime || null,
      servings: recipe.servings || recipe.portions || 4,
      difficulty: mapDifficulty(recipe.difficulty),
      ingredients: transformIngredients(recipe.ingredients),
      instructions: transformInstructions(recipe.instructions || recipe.steps),
      nutrition: recipe.nutrition ? {
        calories: recipe.nutrition.calories || recipe.nutrition.kcal || 0,
        proteins: recipe.nutrition.proteins || recipe.nutrition.protein || 0,
        carbs: recipe.nutrition.carbs || recipe.nutrition.carbohydrates || 0,
        fats: recipe.nutrition.fats || recipe.nutrition.fat || 0,
      } : null,
      sourceUrl: recipe.source || recipe.sourceUrl || null,
      sourceName: recipe.source_url || recipe.sourceName || 'Gustar.io',
    }
  })
}

function mapDifficulty(diff?: string): 'easy' | 'medium' | 'hard' {
  if (!diff) return 'medium'
  const lower = diff.toLowerCase()
  if (lower.includes('easy') || lower.includes('einfach') || lower.includes('leicht')) return 'easy'
  if (lower.includes('hard') || lower.includes('schwer') || lower.includes('difficile')) return 'hard'
  return 'medium'
}

interface IngredientInput {
  name?: string
  ingredient?: string
  amount?: number
  quantity?: number
  unit?: string
}

function transformIngredients(ingredients?: unknown[]): { name: string; amount: number; unit: string }[] {
  if (!Array.isArray(ingredients)) return []

  return ingredients.map((ing) => {
    if (typeof ing === 'string') {
      return { name: ing, amount: 1, unit: '' }
    }
    const ingredient = ing as IngredientInput
    return {
      name: ingredient.name || ingredient.ingredient || '',
      amount: ingredient.amount || ingredient.quantity || 1,
      unit: ingredient.unit || '',
    }
  })
}

interface StepInput {
  text?: string
  description?: string
}

function transformInstructions(instructions?: unknown): string[] {
  if (!instructions) return []
  if (typeof instructions === 'string') return [instructions]
  if (Array.isArray(instructions)) {
    return instructions.map((step) => {
      if (typeof step === 'string') return step
      const s = step as StepInput
      return s.text || s.description || String(step)
    })
  }
  return []
}
