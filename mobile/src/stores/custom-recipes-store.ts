/**
 * Custom Recipes Store
 *
 * Permet aux utilisateurs de créer leurs propres recettes
 * avec calcul automatique des macros basé sur CIQUAL
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Recipe, NutritionInfo, RecipeIngredient } from '../types'

// ============= TYPES =============

export interface CustomRecipeIngredient {
  id: string
  name: string
  quantity: number // en grammes ou ml
  unit: 'g' | 'ml' | 'unit'
  // Nutrition pour 100g (depuis CIQUAL)
  nutritionPer100g: NutritionInfo
  // Source de l'ingrédient
  source: 'ciqual' | 'openfoodfacts' | 'manual'
  sourceId?: string // ID dans la source
}

export interface CustomRecipe {
  id: string
  title: string
  description?: string
  servings: number // nombre de portions
  ingredients: CustomRecipeIngredient[]
  instructions?: string[]
  prepTime?: number // en minutes
  cookTime?: number
  // Nutrition calculée
  nutritionTotal: NutritionInfo // pour toute la recette
  nutritionPerServing: NutritionInfo // par portion
  // Méta
  createdAt: string
  updatedAt: string
  isFavorite: boolean
  usageCount: number // combien de fois utilisée
  imageUri?: string // photo locale
  tags?: string[]
  category?: string // petit-déj, déjeuner, dîner, collation
}

interface CustomRecipesState {
  recipes: CustomRecipe[]

  // Actions CRUD
  addRecipe: (recipe: Omit<CustomRecipe, 'id' | 'createdAt' | 'updatedAt' | 'nutritionTotal' | 'nutritionPerServing' | 'isFavorite' | 'usageCount'>) => CustomRecipe
  updateRecipe: (id: string, updates: Partial<Omit<CustomRecipe, 'id' | 'createdAt'>>) => void
  deleteRecipe: (id: string) => void

  // Favoris
  toggleFavorite: (id: string) => void
  getFavorites: () => CustomRecipe[]

  // Usage
  incrementUsage: (id: string) => void

  // Getters
  getRecipeById: (id: string) => CustomRecipe | undefined
  getRecipesByCategory: (category: string) => CustomRecipe[]
  searchRecipes: (query: string) => CustomRecipe[]

  // Conversion vers Recipe standard
  toStandardRecipe: (customRecipe: CustomRecipe) => Recipe
}

// ============= HELPERS =============

function generateId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Calcule la nutrition totale et par portion
 */
function calculateNutrition(
  ingredients: CustomRecipeIngredient[],
  servings: number
): { total: NutritionInfo; perServing: NutritionInfo } {
  const total: NutritionInfo = {
    calories: 0,
    proteins: 0,
    carbs: 0,
    fats: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    saturatedFat: 0,
  }

  for (const ing of ingredients) {
    // Les valeurs nutritionnelles sont pour 100g
    // On calcule en fonction de la quantité réelle
    const factor = ing.quantity / 100

    total.calories += Math.round((ing.nutritionPer100g.calories || 0) * factor)
    total.proteins += Math.round((ing.nutritionPer100g.proteins || 0) * factor * 10) / 10
    total.carbs += Math.round((ing.nutritionPer100g.carbs || 0) * factor * 10) / 10
    total.fats += Math.round((ing.nutritionPer100g.fats || 0) * factor * 10) / 10
    total.fiber = (total.fiber || 0) + Math.round((ing.nutritionPer100g.fiber || 0) * factor * 10) / 10
    total.sugar = (total.sugar || 0) + Math.round((ing.nutritionPer100g.sugar || 0) * factor * 10) / 10
    total.sodium = (total.sodium || 0) + Math.round((ing.nutritionPer100g.sodium || 0) * factor)
    total.saturatedFat = (total.saturatedFat || 0) + Math.round((ing.nutritionPer100g.saturatedFat || 0) * factor * 10) / 10
  }

  // Arrondir les totaux
  total.calories = Math.round(total.calories)
  total.proteins = Math.round(total.proteins * 10) / 10
  total.carbs = Math.round(total.carbs * 10) / 10
  total.fats = Math.round(total.fats * 10) / 10

  // Calculer par portion
  const perServing: NutritionInfo = {
    calories: Math.round(total.calories / servings),
    proteins: Math.round((total.proteins / servings) * 10) / 10,
    carbs: Math.round((total.carbs / servings) * 10) / 10,
    fats: Math.round((total.fats / servings) * 10) / 10,
    fiber: total.fiber ? Math.round((total.fiber / servings) * 10) / 10 : undefined,
    sugar: total.sugar ? Math.round((total.sugar / servings) * 10) / 10 : undefined,
    sodium: total.sodium ? Math.round(total.sodium / servings) : undefined,
    saturatedFat: total.saturatedFat ? Math.round((total.saturatedFat / servings) * 10) / 10 : undefined,
  }

  return { total, perServing }
}

// ============= STORE =============

export const useCustomRecipesStore = create<CustomRecipesState>()(
  persist(
    (set, get) => ({
      recipes: [],

      addRecipe: (recipeData) => {
        const { total, perServing } = calculateNutrition(
          recipeData.ingredients,
          recipeData.servings
        )

        const newRecipe: CustomRecipe = {
          ...recipeData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          nutritionTotal: total,
          nutritionPerServing: perServing,
          isFavorite: false,
          usageCount: 0,
        }

        set((state) => ({
          recipes: [newRecipe, ...state.recipes],
        }))

        return newRecipe
      },

      updateRecipe: (id, updates) => {
        set((state) => ({
          recipes: state.recipes.map((recipe) => {
            if (recipe.id !== id) return recipe

            // Recalculer la nutrition si les ingrédients ou portions changent
            const newIngredients = updates.ingredients || recipe.ingredients
            const newServings = updates.servings || recipe.servings
            const { total, perServing } = calculateNutrition(newIngredients, newServings)

            return {
              ...recipe,
              ...updates,
              nutritionTotal: total,
              nutritionPerServing: perServing,
              updatedAt: new Date().toISOString(),
            }
          }),
        }))
      },

      deleteRecipe: (id) => {
        set((state) => ({
          recipes: state.recipes.filter((r) => r.id !== id),
        }))
      },

      toggleFavorite: (id) => {
        set((state) => ({
          recipes: state.recipes.map((r) =>
            r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
          ),
        }))
      },

      getFavorites: () => {
        return get().recipes.filter((r) => r.isFavorite)
      },

      incrementUsage: (id) => {
        set((state) => ({
          recipes: state.recipes.map((r) =>
            r.id === id ? { ...r, usageCount: r.usageCount + 1 } : r
          ),
        }))
      },

      getRecipeById: (id) => {
        return get().recipes.find((r) => r.id === id)
      },

      getRecipesByCategory: (category) => {
        return get().recipes.filter((r) => r.category === category)
      },

      searchRecipes: (query) => {
        const normalizedQuery = query.toLowerCase().trim()
        if (!normalizedQuery) return get().recipes

        return get().recipes.filter((r) => {
          const titleMatch = r.title.toLowerCase().includes(normalizedQuery)
          const tagMatch = r.tags?.some((t) => t.toLowerCase().includes(normalizedQuery))
          const ingredientMatch = r.ingredients.some((i) =>
            i.name.toLowerCase().includes(normalizedQuery)
          )
          return titleMatch || tagMatch || ingredientMatch
        })
      },

      toStandardRecipe: (customRecipe) => {
        return {
          id: customRecipe.id,
          title: customRecipe.title,
          description: customRecipe.description,
          prepTime: customRecipe.prepTime || 0,
          cookTime: customRecipe.cookTime,
          totalTime: (customRecipe.prepTime || 0) + (customRecipe.cookTime || 0),
          servings: customRecipe.servings,
          difficulty: 'medium' as const,
          category: customRecipe.category,
          ingredients: customRecipe.ingredients.map((ing) => ({
            id: ing.id,
            name: ing.name,
            amount: ing.quantity,
            unit: ing.unit,
            calories: Math.round((ing.nutritionPer100g.calories * ing.quantity) / 100),
          })),
          instructions: customRecipe.instructions || [],
          nutrition: customRecipe.nutritionTotal,
          nutritionPerServing: customRecipe.nutritionPerServing,
          tags: customRecipe.tags,
          source: 'custom',
          isFavorite: customRecipe.isFavorite,
          createdAt: customRecipe.createdAt,
        }
      },
    }),
    {
      name: 'presence-custom-recipes',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export default useCustomRecipesStore
