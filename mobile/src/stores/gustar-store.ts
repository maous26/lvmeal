/**
 * Gustar Recipes Store
 *
 * Persisted store for enriched Gustar recipes.
 * - Stores enriched French versions of German recipes
 * - Persists to AsyncStorage for instant loading
 * - Background enrichment for new recipes
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Recipe } from '../types'

// Enriched recipe with French content
export interface EnrichedGustarRecipe {
  id: string
  // Original German data
  originalTitle: string
  originalDescription?: string
  // French translations
  titleFr: string
  descriptionFr: string
  ingredientsFr: Array<{ name: string; amount: number; unit: string }>
  instructionsFr: string[]
  // Nutrition (estimated or from API)
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
  // Metadata
  imageUrl?: string
  prepTime?: number
  cookTime?: number
  totalTime?: number
  servings: number
  difficulty?: 'easy' | 'medium' | 'hard'
  source?: string
  sourceUrl?: string
  // Timestamps
  enrichedAt: number
  lastUsedAt: number
}

interface GustarStoreState {
  // Enriched recipes cache (keyed by recipe ID)
  enrichedRecipes: Record<string, EnrichedGustarRecipe>
  // Pending enrichment queue
  pendingEnrichment: string[]
  // Last sync timestamp
  lastSyncAt: number

  // Actions
  getEnrichedRecipe: (id: string) => EnrichedGustarRecipe | null
  hasEnrichedRecipe: (id: string) => boolean
  addEnrichedRecipe: (recipe: EnrichedGustarRecipe) => void
  addEnrichedRecipes: (recipes: EnrichedGustarRecipe[]) => void
  updateLastUsed: (id: string) => void
  addToPendingEnrichment: (ids: string[]) => void
  removeFromPendingEnrichment: (ids: string[]) => void
  clearOldRecipes: (maxAge: number) => void
  getRecipeCount: () => number

  // Convert to Recipe type for components
  toRecipe: (enriched: EnrichedGustarRecipe) => Recipe
}

export const useGustarStore = create<GustarStoreState>()(
  persist(
    (set, get) => ({
      enrichedRecipes: {},
      pendingEnrichment: [],
      lastSyncAt: 0,

      getEnrichedRecipe: (id: string) => {
        const recipe = get().enrichedRecipes[id]
        if (recipe) {
          // Update last used timestamp
          get().updateLastUsed(id)
        }
        return recipe || null
      },

      hasEnrichedRecipe: (id: string) => {
        return id in get().enrichedRecipes
      },

      addEnrichedRecipe: (recipe: EnrichedGustarRecipe) => {
        set((state) => ({
          enrichedRecipes: {
            ...state.enrichedRecipes,
            [recipe.id]: recipe,
          },
          lastSyncAt: Date.now(),
        }))
      },

      addEnrichedRecipes: (recipes: EnrichedGustarRecipe[]) => {
        set((state) => {
          const newRecipes = { ...state.enrichedRecipes }
          recipes.forEach((recipe) => {
            newRecipes[recipe.id] = recipe
          })
          return {
            enrichedRecipes: newRecipes,
            lastSyncAt: Date.now(),
          }
        })
      },

      updateLastUsed: (id: string) => {
        set((state) => {
          const recipe = state.enrichedRecipes[id]
          if (!recipe) return state
          return {
            enrichedRecipes: {
              ...state.enrichedRecipes,
              [id]: { ...recipe, lastUsedAt: Date.now() },
            },
          }
        })
      },

      addToPendingEnrichment: (ids: string[]) => {
        set((state) => {
          const existing = new Set(state.pendingEnrichment)
          const enriched = new Set(Object.keys(state.enrichedRecipes))
          // Only add IDs that are not already pending or enriched
          const newIds = ids.filter((id) => !existing.has(id) && !enriched.has(id))
          return {
            pendingEnrichment: [...state.pendingEnrichment, ...newIds],
          }
        })
      },

      removeFromPendingEnrichment: (ids: string[]) => {
        set((state) => ({
          pendingEnrichment: state.pendingEnrichment.filter((id) => !ids.includes(id)),
        }))
      },

      clearOldRecipes: (maxAge: number) => {
        const now = Date.now()
        set((state) => {
          const newRecipes: Record<string, EnrichedGustarRecipe> = {}
          Object.entries(state.enrichedRecipes).forEach(([id, recipe]) => {
            if (now - recipe.lastUsedAt < maxAge) {
              newRecipes[id] = recipe
            }
          })
          return { enrichedRecipes: newRecipes }
        })
      },

      getRecipeCount: () => {
        return Object.keys(get().enrichedRecipes).length
      },

      toRecipe: (enriched: EnrichedGustarRecipe): Recipe => ({
        id: enriched.id,
        title: enriched.titleFr,
        description: enriched.descriptionFr,
        imageUrl: enriched.imageUrl,
        prepTime: enriched.prepTime || 20, // Default 20 min if not available
        cookTime: enriched.cookTime,
        totalTime: enriched.totalTime,
        servings: enriched.servings,
        difficulty: enriched.difficulty,
        ingredients: enriched.ingredientsFr.map((ing, idx) => ({
          id: `${enriched.id}-ing-${idx}`,
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
        })),
        instructions: enriched.instructionsFr,
        nutritionPerServing: enriched.nutrition,
        nutrition: {
          calories: enriched.nutrition.calories * enriched.servings,
          proteins: enriched.nutrition.proteins * enriched.servings,
          carbs: enriched.nutrition.carbs * enriched.servings,
          fats: enriched.nutrition.fats * enriched.servings,
        },
        source: enriched.source || 'Gustar.io',
        sourceUrl: enriched.sourceUrl,
      }),
    }),
    {
      name: 'gustar-recipes-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        enrichedRecipes: state.enrichedRecipes,
        lastSyncAt: state.lastSyncAt,
        // Don't persist pending queue - will be rebuilt on load
      }),
    }
  )
)

// Export type for use in components
export type { GustarStoreState }
