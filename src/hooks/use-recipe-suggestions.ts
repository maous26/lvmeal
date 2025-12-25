'use client'

import { useState, useEffect, useCallback } from 'react'

interface RecipeSuggestion {
  id: string
  title: string
  description?: string
  imageUrl?: string | null
  prepTime: number
  cookTime?: number | null
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
  ingredients: { name: string; amount: number | string; unit: string }[]
  instructions: string[]
  tags: string[]
  source: string
  rating: number
  ratingCount: number
}

interface UseRecipeSuggestionsOptions {
  limit?: number
  caloricBalance?: number
  currentDay?: number // 0-indexed (0=day1, 6=day7)
  goal?: string // weight_loss, muscle_gain, maintenance
  dietType?: string // vegetarian, vegan, etc.
}

interface UseRecipeSuggestionsResult {
  recipes: RecipeSuggestion[]
  suggestedMealType: string
  isLoading: boolean
  error: string | null
  personalized: boolean
  canHavePlaisir: boolean
  refresh: () => void
}

export function useRecipeSuggestions(options: UseRecipeSuggestionsOptions = {}): UseRecipeSuggestionsResult {
  const { limit = 6, caloricBalance = 0, currentDay = 0, goal = '', dietType = '' } = options

  const [recipes, setRecipes] = useState<RecipeSuggestion[]>([])
  const [suggestedMealType, setSuggestedMealType] = useState('dinner')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [personalized, setPersonalized] = useState(false)
  const [canHavePlaisir, setCanHavePlaisir] = useState(false)

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        caloricBalance: caloricBalance.toString(),
        currentDay: currentDay.toString(),
      })
      if (goal) params.set('goal', goal)
      if (dietType) params.set('dietType', dietType)

      const response = await fetch(`/api/recipes/suggestions?${params}`)

      if (!response.ok) {
        throw new Error('Erreur lors du chargement des suggestions')
      }

      const data = await response.json()
      setRecipes(data.recipes || [])
      setSuggestedMealType(data.suggestedMealType || 'dinner')
      setPersonalized(data.personalized || false)
      setCanHavePlaisir(data.canHavePlaisir || false)
    } catch (err) {
      console.error('Error fetching suggestions:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsLoading(false)
    }
  }, [limit, caloricBalance, currentDay, goal, dietType])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  return {
    recipes,
    suggestedMealType,
    isLoading,
    error,
    personalized,
    canHavePlaisir,
    refresh: fetchSuggestions,
  }
}
