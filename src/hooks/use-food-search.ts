'use client'

import { useState, useCallback, useRef } from 'react'

export type FoodSource = 'all' | 'generic' | 'branded'

export type ServingUnit = 'g' | 'ml' | 'unit'

export interface FoodProduct {
  id: string
  name: string
  brand?: string
  imageUrl?: string | null
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
  servingSize?: number
  servingUnit?: ServingUnit
  category?: string
  source: 'openfoodfacts' | 'ciqual' | 'local'
  isGeneric?: boolean // true = generic/CIQUAL, false = branded/OFF
}

export interface SearchOptions {
  query: string
  source?: FoodSource
  limit?: number
}

export interface UseFoodSearchResult {
  products: FoodProduct[]
  isLoading: boolean
  isLoadingMore: boolean // True when loading additional results (OFF)
  error: string | null
  search: (options: SearchOptions) => Promise<void>
  scanBarcode: (barcode: string) => Promise<FoodProduct | null>
  clear: () => void
}

export function useFoodSearch(): UseFoodSearchResult {
  const [products, setProducts] = useState<FoodProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track current search to avoid race conditions
  const searchIdRef = useRef(0)

  const search = useCallback(async (options: SearchOptions) => {
    const { query, source = 'all', limit = 20 } = options

    if (!query || query.length < 2) {
      setProducts([])
      return
    }

    // Increment search ID to track this specific search
    const currentSearchId = ++searchIdRef.current

    setIsLoading(true)
    setError(null)

    // For "all" source, we use progressive loading:
    // 1. First quickly fetch CIQUAL (generic) results
    // 2. Then fetch OFF (branded) results and merge
    if (source === 'all') {
      try {
        // Step 1: Quick fetch of generic results (CIQUAL - local, instant)
        const genericParams = new URLSearchParams({
          q: query,
          source: 'generic',
          limit: String(Math.ceil(limit / 2)),
        })

        const genericResponse = await fetch(`/api/food/search?${genericParams}`)

        // Check if this search is still current
        if (currentSearchId !== searchIdRef.current) return

        if (genericResponse.ok) {
          const genericData = await genericResponse.json()
          setProducts(genericData.products || [])
          setIsLoading(false)
          setIsLoadingMore(true)
        }

        // Step 2: Fetch branded results (OFF - slower, external API)
        const brandedParams = new URLSearchParams({
          q: query,
          source: 'branded',
          limit: String(Math.ceil(limit / 2)),
        })

        const brandedResponse = await fetch(`/api/food/search?${brandedParams}`)

        // Check if this search is still current
        if (currentSearchId !== searchIdRef.current) return

        if (brandedResponse.ok) {
          const brandedData = await brandedResponse.json()

          // Merge results: CIQUAL first, then OFF
          setProducts(prev => {
            const combined = [...prev, ...(brandedData.products || [])]
            // Sort: complete nutrition data first
            combined.sort((a, b) => {
              const aHasCalories = a.nutrition.calories > 0 ? 1 : 0
              const bHasCalories = b.nutrition.calories > 0 ? 1 : 0
              return bHasCalories - aHasCalories
            })
            return combined.slice(0, limit)
          })
        }
      } catch (err) {
        if (currentSearchId === searchIdRef.current) {
          console.error('Error searching food:', err)
          setError(err instanceof Error ? err.message : 'Erreur inconnue')
        }
      } finally {
        if (currentSearchId === searchIdRef.current) {
          setIsLoading(false)
          setIsLoadingMore(false)
        }
      }
    } else {
      // Single source search (generic or branded only)
      try {
        const params = new URLSearchParams({
          q: query,
          source,
          limit: String(limit),
        })

        const response = await fetch(`/api/food/search?${params}`)

        // Check if this search is still current
        if (currentSearchId !== searchIdRef.current) return

        if (!response.ok) {
          throw new Error('Erreur lors de la recherche')
        }

        const data = await response.json()
        setProducts(data.products || [])
      } catch (err) {
        if (currentSearchId === searchIdRef.current) {
          console.error('Error searching food:', err)
          setError(err instanceof Error ? err.message : 'Erreur inconnue')
          setProducts([])
        }
      } finally {
        if (currentSearchId === searchIdRef.current) {
          setIsLoading(false)
          setIsLoadingMore(false)
        }
      }
    }
  }, [])

  const scanBarcode = useCallback(async (barcode: string): Promise<FoodProduct | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/food/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barcode }),
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('Produit non trouvé')
          return null
        }
        throw new Error('Erreur lors du scan')
      }

      const data = await response.json()
      return data.product || null
    } catch (err) {
      console.error('Error scanning barcode:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    // Increment search ID to invalidate any pending searches
    searchIdRef.current++
    setProducts([])
    setError(null)
    setIsLoading(false)
    setIsLoadingMore(false)
  }, [])

  return {
    products,
    isLoading,
    isLoadingMore,
    error,
    search,
    scanBarcode,
    clear,
  }
}
