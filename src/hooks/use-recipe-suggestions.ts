'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUserStore } from '@/stores/user-store'
import { useMealsStore } from '@/stores/meals-store'
import { useWellnessStore } from '@/stores/wellness-store'

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
  // These can be overridden, but will default to user profile values
  goal?: string
  dietType?: string
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
  const { limit = 6, caloricBalance = 0, currentDay = 0 } = options

  // Get ALL user data from stores
  const { profile } = useUserStore()
  const { getDailyNutrition } = useMealsStore()
  const { todayScore, getEntryForDate } = useWellnessStore()

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
      // Build comprehensive params from user profile
      const params = new URLSearchParams({
        limit: limit.toString(),
        caloricBalance: caloricBalance.toString(),
        currentDay: currentDay.toString(),
      })

      // User profile data
      if (profile) {
        // Goal (weight_loss, muscle_gain, maintenance)
        const goal = options.goal || profile.goal || ''
        if (goal) params.set('goal', goal)

        // Diet type (vegetarian, vegan, halal, casher, etc.)
        const dietType = options.dietType || profile.dietType || ''
        if (dietType) params.set('dietType', dietType)

        // Metabolism profile (standard, adaptive)
        if (profile.metabolismProfile) {
          params.set('metabolismProfile', profile.metabolismProfile)
        }

        // Allergies and restrictions
        if (profile.allergies && profile.allergies.length > 0) {
          params.set('allergies', profile.allergies.join(','))
        }

        // Food preferences (likes/dislikes)
        if (profile.foodPreferences) {
          if (profile.foodPreferences.likes && profile.foodPreferences.likes.length > 0) {
            params.set('likedFoods', profile.foodPreferences.likes.join(','))
          }
          if (profile.foodPreferences.dislikes && profile.foodPreferences.dislikes.length > 0) {
            params.set('dislikedFoods', profile.foodPreferences.dislikes.join(','))
          }
        }

        // Activity level (affects calorie needs)
        if (profile.activityLevel) {
          params.set('activityLevel', profile.activityLevel)
        }

        // Calorie and macro targets
        if (profile.dailyCaloriesTarget) {
          params.set('calorieTarget', profile.dailyCaloriesTarget.toString())
        }
        if (profile.proteinTarget) {
          params.set('proteinTarget', profile.proteinTarget.toString())
        }

        // Gender (affects nutritional recommendations)
        if (profile.gender) {
          params.set('gender', profile.gender)
        }

        // Age (affects nutritional recommendations)
        if (profile.age) {
          params.set('age', profile.age.toString())
        }

        // Current weight (for portion sizing)
        if (profile.weight) {
          params.set('weight', profile.weight.toString())
        }
      }

      // Today's nutrition data (to suggest meals that complete macros)
      const today = new Date().toISOString().split('T')[0]
      const todayNutrition = getDailyNutrition(today)
      if (todayNutrition.calories > 0) {
        params.set('consumedCalories', todayNutrition.calories.toString())
        params.set('consumedProteins', todayNutrition.proteins.toString())
        params.set('consumedCarbs', todayNutrition.carbs.toString())
        params.set('consumedFats', todayNutrition.fats.toString())
      }

      // Wellness data (affects recommendations for adaptive profiles)
      const todayEntry = getEntryForDate(today)
      if (todayEntry) {
        if (todayEntry.stressLevel) {
          params.set('stressLevel', todayEntry.stressLevel.toString())
        }
        if (todayEntry.sleepHours) {
          params.set('sleepHours', todayEntry.sleepHours.toString())
        }
        if (todayEntry.energyLevel) {
          params.set('energyLevel', todayEntry.energyLevel.toString())
        }
      }

      // Wellness score
      if (todayScore > 0) {
        params.set('wellnessScore', todayScore.toString())
      }

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
  }, [limit, caloricBalance, currentDay, options.goal, options.dietType, profile, getDailyNutrition, getEntryForDate, todayScore])

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
