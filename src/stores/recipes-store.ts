import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Type pour une recette favorite (compatible avec les recettes Gustar et les suggestions)
export interface FavoriteRecipe {
  id: string
  title: string
  description?: string
  imageUrl?: string
  prepTime: number
  cookTime: number
  totalTime: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
  ingredients: Array<{
    id: string
    name: string
    quantity: number
    unit: string
    preparation?: string
  }>
  instructions: string[]
  tags: string[]
  allergens: string[]
  source: 'gustar' | 'ai' | 'manual' | 'suggestion'
  sourceUrl?: string
  externalId?: string
  rating?: number
  ratingCount?: number
  addedAt: string
}

interface RecipesState {
  // Recettes favorites
  favorites: FavoriteRecipe[]

  // Actions
  addToFavorites: (recipe: Omit<FavoriteRecipe, 'addedAt'>) => void
  removeFromFavorites: (recipeId: string) => void
  isFavorite: (recipeId: string) => boolean
  getFavoriteById: (recipeId: string) => FavoriteRecipe | undefined
  searchFavorites: (query: string) => FavoriteRecipe[]
  getFavoritesByTag: (tag: string) => FavoriteRecipe[]
}

export const useRecipesStore = create<RecipesState>()(
  persist(
    (set, get) => ({
      favorites: [],

      addToFavorites: (recipe) => {
        const existingIndex = get().favorites.findIndex(
          (f) => f.id === recipe.id || (f.externalId && f.externalId === recipe.externalId)
        )

        if (existingIndex === -1) {
          set((state) => ({
            favorites: [
              {
                ...recipe,
                addedAt: new Date().toISOString(),
              },
              ...state.favorites,
            ],
          }))
        }
      },

      removeFromFavorites: (recipeId) => {
        set((state) => ({
          favorites: state.favorites.filter((f) => f.id !== recipeId),
        }))
      },

      isFavorite: (recipeId) => {
        return get().favorites.some((f) => f.id === recipeId || f.externalId === recipeId)
      },

      getFavoriteById: (recipeId) => {
        return get().favorites.find((f) => f.id === recipeId || f.externalId === recipeId)
      },

      searchFavorites: (query) => {
        const lowerQuery = query.toLowerCase()
        return get().favorites.filter(
          (f) =>
            f.title.toLowerCase().includes(lowerQuery) ||
            f.tags.some((t) => t.toLowerCase().includes(lowerQuery)) ||
            f.ingredients.some((i) => i.name.toLowerCase().includes(lowerQuery))
        )
      },

      getFavoritesByTag: (tag) => {
        const lowerTag = tag.toLowerCase()
        return get().favorites.filter((f) =>
          f.tags.some((t) => t.toLowerCase().includes(lowerTag))
        )
      },
    }),
    {
      name: 'presence-recipes-storage',
      partialize: (state) => ({
        favorites: state.favorites,
      }),
    }
  )
)
