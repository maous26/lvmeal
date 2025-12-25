'use client'

import { useState, useCallback, useRef } from 'react'

export interface Recipe {
  id: string
  title: string
  titleOriginal?: string // Keep original for reference
  description: string
  image: string | null
  prepTime: number | null
  cookTime: number | null
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  ingredients: { name: string; amount: number; unit: string }[]
  instructions: string[]
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  } | null
  sourceUrl: string | null
  sourceName: string
  isEnriched?: boolean
}

interface EnrichedRecipeData {
  id: string
  titleFr: string
  descriptionFr: string
  ingredientsFr?: { name: string; amount: number; unit: string }[]
  instructionsFr?: string[]
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
}

export interface SearchRecipesParams {
  query: string
  diet?: string
  limit?: number
}

export interface UseRecipesSearchResult {
  recipes: Recipe[]
  isLoading: boolean
  isEnriching: boolean
  error: string | null
  total: number
  search: (params: SearchRecipesParams) => Promise<void>
  clearResults: () => void
}

export function useRecipesSearch(): UseRecipesSearchResult {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const enrichmentCache = useRef<Map<string, EnrichedRecipeData>>(new Map())

  const enrichRecipes = useCallback(async (recipesToEnrich: Recipe[]) => {
    // Filter out already enriched recipes and those in cache
    const needsEnrichment = recipesToEnrich.filter(r => {
      if (r.isEnriched) return false
      if (enrichmentCache.current.has(r.id)) return false
      return true
    })

    if (needsEnrichment.length === 0) {
      // Apply cached enrichments
      return recipesToEnrich.map(r => {
        const cached = enrichmentCache.current.get(r.id)
        if (cached) {
          return {
            ...r,
            titleOriginal: r.title,
            title: cached.titleFr,
            description: cached.descriptionFr,
            ingredients: cached.ingredientsFr || r.ingredients,
            instructions: cached.instructionsFr || r.instructions,
            nutrition: cached.nutrition,
            isEnriched: true,
          }
        }
        return r
      })
    }

    setIsEnriching(true)

    try {
      // Batch enrich (max 3 at a time for full translation including instructions)
      const response = await fetch('/api/recipes/enrich', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipes: needsEnrichment.slice(0, 3) }),
      })

      if (response.ok) {
        const data = await response.json()
        const enrichedMap = new Map<string, EnrichedRecipeData>()

        for (const enriched of data.recipes as EnrichedRecipeData[]) {
          enrichedMap.set(enriched.id, enriched)
          enrichmentCache.current.set(enriched.id, enriched)
        }

        // Apply enrichments to all recipes
        return recipesToEnrich.map(r => {
          const enriched = enrichedMap.get(r.id) || enrichmentCache.current.get(r.id)
          if (enriched) {
            return {
              ...r,
              titleOriginal: r.title,
              title: enriched.titleFr,
              description: enriched.descriptionFr,
              ingredients: enriched.ingredientsFr || r.ingredients,
              instructions: enriched.instructionsFr || r.instructions,
              nutrition: enriched.nutrition,
              isEnriched: true,
            }
          }
          return r
        })
      }
    } catch (err) {
      console.error('Failed to enrich recipes:', err)
    } finally {
      setIsEnriching(false)
    }

    return recipesToEnrich
  }, [])

  const search = useCallback(async (params: SearchRecipesParams) => {
    const { query, diet, limit = 10 } = params

    if (!query.trim()) {
      setError('Veuillez entrer un terme de recherche')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const searchParams = new URLSearchParams({
        q: query,
        limit: limit.toString(),
      })

      if (diet) {
        searchParams.append('diet', diet)
      }

      const response = await fetch(`/api/recipes/search?${searchParams}`)

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('Le service de recettes n\'est pas configuré. Contactez l\'administrateur.')
        }
        throw new Error('Erreur lors de la recherche des recettes')
      }

      const data = await response.json()
      const rawRecipes: Recipe[] = data.recipes || []

      // Set initial results immediately
      setRecipes(rawRecipes)
      setTotal(data.total || 0)
      setIsLoading(false)

      // Then enrich in background
      if (rawRecipes.length > 0) {
        const enrichedRecipes = await enrichRecipes(rawRecipes)
        setRecipes(enrichedRecipes)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      setError(message)
      setRecipes([])
      setTotal(0)
      setIsLoading(false)
    }
  }, [enrichRecipes])

  const clearResults = useCallback(() => {
    setRecipes([])
    setError(null)
    setTotal(0)
  }, [])

  return {
    recipes,
    isLoading,
    isEnriching,
    error,
    total,
    search,
    clearResults,
  }
}
