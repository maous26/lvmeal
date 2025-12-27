import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Recipe, MealType } from '../types'
import { useGamificationStore, XP_REWARDS } from './gamification-store'

// AI Recipe with rating
export interface AIRecipeRating {
  recipeId: string
  recipe: Recipe
  rating: number // 1-5 stars
  comment?: string
  mealType: MealType
  createdAt: string
  usedCount: number // How many times the user made this recipe
}

interface RecipesState {
  // Favorites
  favoriteRecipes: Recipe[]

  // Recent searches
  recentSearches: string[]

  // Recently viewed
  recentlyViewed: Recipe[]

  // AI Recipes with ratings
  aiRecipes: AIRecipeRating[]

  // Actions
  addToFavorites: (recipe: Recipe) => void
  removeFromFavorites: (recipeId: string) => void
  isFavorite: (recipeId: string) => boolean
  addRecentSearch: (query: string) => void
  clearRecentSearches: () => void
  addToRecentlyViewed: (recipe: Recipe) => void

  // AI Recipe actions
  addAIRecipe: (recipe: Recipe, mealType: MealType) => void
  rateAIRecipe: (recipeId: string, rating: number, comment?: string) => void
  incrementAIRecipeUsage: (recipeId: string) => void
  getTopRatedAIRecipes: (mealType?: MealType, limit?: number) => AIRecipeRating[]
  getAIRecipesByMealType: (mealType: MealType) => AIRecipeRating[]

  // Getters
  getFavorites: () => Recipe[]
  getRecentSearches: () => string[]
  getRecentlyViewed: () => Recipe[]
}

export const useRecipesStore = create<RecipesState>()(
  persist(
    (set, get) => ({
      favoriteRecipes: [],
      recentSearches: [],
      recentlyViewed: [],
      aiRecipes: [],

      addToFavorites: (recipe) => {
        set((state) => {
          if (state.favoriteRecipes.some(r => r.id === recipe.id)) {
            return state
          }

          const gamification = useGamificationStore.getState()
          gamification.addXP(XP_REWARDS.ADD_RECIPE_TO_FAVORITES, 'Recette ajoutee aux favoris')
          gamification.incrementMetric('favorite_recipes')

          // Check for first recipe badge
          if (state.favoriteRecipes.length === 0) {
            gamification.addXP(XP_REWARDS.FIRST_RECIPE_SAVED, 'Premiere recette sauvegardee')
          }

          return {
            favoriteRecipes: [...state.favoriteRecipes, { ...recipe, isFavorite: true }],
          }
        })
      },

      removeFromFavorites: (recipeId) => {
        set((state) => ({
          favoriteRecipes: state.favoriteRecipes.filter(r => r.id !== recipeId),
        }))
      },

      isFavorite: (recipeId) => {
        return get().favoriteRecipes.some(r => r.id === recipeId)
      },

      addRecentSearch: (query) => {
        if (!query.trim()) return

        set((state) => {
          const filtered = state.recentSearches.filter(
            s => s.toLowerCase() !== query.toLowerCase()
          )
          return {
            recentSearches: [query, ...filtered].slice(0, 10),
          }
        })
      },

      clearRecentSearches: () => {
        set({ recentSearches: [] })
      },

      addToRecentlyViewed: (recipe) => {
        set((state) => {
          const filtered = state.recentlyViewed.filter(r => r.id !== recipe.id)
          return {
            recentlyViewed: [recipe, ...filtered].slice(0, 20),
          }
        })
      },

      getFavorites: () => get().favoriteRecipes,

      getRecentSearches: () => get().recentSearches,

      getRecentlyViewed: () => get().recentlyViewed,

      // AI Recipe functions
      addAIRecipe: (recipe, mealType) => {
        set((state) => {
          // Check if recipe already exists
          if (state.aiRecipes.some(r => r.recipeId === recipe.id)) {
            return state
          }

          const newAIRecipe: AIRecipeRating = {
            recipeId: recipe.id,
            recipe,
            rating: 0, // Not rated yet
            mealType,
            createdAt: new Date().toISOString(),
            usedCount: 0,
          }

          return {
            aiRecipes: [newAIRecipe, ...state.aiRecipes],
          }
        })
      },

      rateAIRecipe: (recipeId, rating, comment) => {
        set((state) => ({
          aiRecipes: state.aiRecipes.map(r =>
            r.recipeId === recipeId
              ? { ...r, rating, comment }
              : r
          ),
        }))

        // Award XP for rating a recipe
        const gamification = useGamificationStore.getState()
        gamification.addXP(5, 'Recette notee')
      },

      incrementAIRecipeUsage: (recipeId) => {
        set((state) => ({
          aiRecipes: state.aiRecipes.map(r =>
            r.recipeId === recipeId
              ? { ...r, usedCount: r.usedCount + 1 }
              : r
          ),
        }))
      },

      getTopRatedAIRecipes: (mealType, limit = 10) => {
        const { aiRecipes } = get()
        let filtered = aiRecipes.filter(r => r.rating > 0)

        if (mealType) {
          filtered = filtered.filter(r => r.mealType === mealType)
        }

        // Sort by rating (desc), then by usage count (desc)
        return filtered
          .sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating
            return b.usedCount - a.usedCount
          })
          .slice(0, limit)
      },

      getAIRecipesByMealType: (mealType) => {
        return get().aiRecipes.filter(r => r.mealType === mealType)
      },
    }),
    {
      name: 'presence-recipes',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        favoriteRecipes: state.favoriteRecipes,
        recentSearches: state.recentSearches,
        recentlyViewed: state.recentlyViewed,
        aiRecipes: state.aiRecipes,
      }),
    }
  )
)

export default useRecipesStore
