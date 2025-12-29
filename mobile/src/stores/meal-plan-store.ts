/**
 * Meal Plan Store - 7-day meal planning with persistence
 *
 * Features:
 * - Persist weekly meal plans
 * - Move meals between days/types
 * - Delete individual meals
 * - Track shopping list
 * - Integration with Gustar.io and AI recipes
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { MealType, NutritionInfo, Recipe } from '../types'

// ============= TYPES =============

export interface PlannedMealItem {
  id: string
  dayIndex: number // 0 = Monday, 6 = Sunday
  mealType: MealType
  name: string
  description?: string
  prepTime: number
  servings: number
  nutrition: NutritionInfo
  ingredients: { name: string; amount: string; calories?: number }[]
  instructions: string[]
  isCheatMeal?: boolean
  isValidated: boolean
  source: 'gustar' | 'ai' | 'manual' | 'favorite' | 'ciqual' | 'openfoodfacts'
  sourceRecipeId?: string // Original recipe ID if from Gustar or favorites
  imageUrl?: string
}

export interface ShoppingItem {
  id: string
  name: string
  quantity: string
  category: string
  estimatedPrice: number
  isChecked: boolean
}

export interface ShoppingList {
  id: string
  items: ShoppingItem[]
  categories: { name: string; items: ShoppingItem[]; subtotal: number }[]
  total: number
  tips: string[]
  generatedAt: string
}

export interface WeekPlan {
  id: string
  meals: PlannedMealItem[]
  generatedAt: string
  weekStart: string // ISO date string for Monday
  shoppingList?: ShoppingList
  savedAt?: string // ISO date string when user saved the plan
}

interface MealPlanState {
  // Current week plan
  currentPlan: WeekPlan | null

  // Historical plans (optional, for reference)
  planHistory: WeekPlan[]

  // Actions
  setPlan: (plan: WeekPlan) => void
  clearPlan: () => void

  // Meal management
  addMeal: (meal: PlannedMealItem) => void
  updateMeal: (mealId: string, updates: Partial<PlannedMealItem>) => void
  deleteMeal: (mealId: string) => void
  moveMeal: (mealId: string, newDayIndex: number, newMealType: MealType) => void
  swapMeals: (mealId1: string, mealId2: string) => void
  toggleMealValidation: (mealId: string) => void
  regenerateMeal: (mealId: string, newMeal: PlannedMealItem) => void

  // Shopping list
  setShoppingList: (list: ShoppingList) => void
  toggleShoppingItem: (itemId: string) => void
  clearShoppingList: () => void

  // Getters
  getMealsForDay: (dayIndex: number) => PlannedMealItem[]
  getMealBySlot: (dayIndex: number, mealType: MealType) => PlannedMealItem | undefined
  getDailyNutrition: (dayIndex: number) => NutritionInfo
  getWeeklyNutrition: () => NutritionInfo
  getProgress: () => { validated: number; total: number; percentage: number }
  getAllIngredients: () => { name: string; amount: string }[]
  getValidatedMealsIngredients: () => { name: string; amount: string; calories: number }[]
  getValidatedMeals: () => PlannedMealItem[]
  hasUnsavedChanges: () => boolean
  resetPlanToOriginal: () => void
  savePlan: () => void
}

// ============= HELPERS =============

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

const emptyNutrition: NutritionInfo = {
  calories: 0,
  proteins: 0,
  carbs: 0,
  fats: 0,
}

// ============= STORE =============

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
      currentPlan: null,
      planHistory: [],

      setPlan: (plan) => {
        set((state) => {
          // Archive current plan if exists
          const history = state.currentPlan
            ? [state.currentPlan, ...state.planHistory].slice(0, 5) // Keep last 5 plans
            : state.planHistory

          return {
            currentPlan: plan,
            planHistory: history,
          }
        })
      },

      clearPlan: () => {
        set({ currentPlan: null })
      },

      addMeal: (meal) => {
        set((state) => {
          if (!state.currentPlan) return state

          return {
            currentPlan: {
              ...state.currentPlan,
              meals: [...state.currentPlan.meals, meal],
            },
          }
        })
      },

      updateMeal: (mealId, updates) => {
        set((state) => {
          if (!state.currentPlan) return state

          return {
            currentPlan: {
              ...state.currentPlan,
              meals: state.currentPlan.meals.map((m) =>
                m.id === mealId ? { ...m, ...updates } : m
              ),
            },
          }
        })
      },

      deleteMeal: (mealId) => {
        set((state) => {
          if (!state.currentPlan) return state

          return {
            currentPlan: {
              ...state.currentPlan,
              meals: state.currentPlan.meals.filter((m) => m.id !== mealId),
            },
          }
        })
      },

      moveMeal: (mealId, newDayIndex, newMealType) => {
        set((state) => {
          if (!state.currentPlan) return state

          // Check if target slot is occupied
          const existingMeal = state.currentPlan.meals.find(
            (m) => m.dayIndex === newDayIndex && m.mealType === newMealType && m.id !== mealId
          )

          let newMeals = state.currentPlan.meals

          if (existingMeal) {
            // Swap meals: move existing meal to the original slot
            const movingMeal = state.currentPlan.meals.find((m) => m.id === mealId)
            if (movingMeal) {
              newMeals = state.currentPlan.meals.map((m) => {
                if (m.id === mealId) {
                  return { ...m, dayIndex: newDayIndex, mealType: newMealType }
                }
                if (m.id === existingMeal.id) {
                  return { ...m, dayIndex: movingMeal.dayIndex, mealType: movingMeal.mealType }
                }
                return m
              })
            }
          } else {
            // Simple move
            newMeals = state.currentPlan.meals.map((m) =>
              m.id === mealId ? { ...m, dayIndex: newDayIndex, mealType: newMealType } : m
            )
          }

          return {
            currentPlan: {
              ...state.currentPlan,
              meals: newMeals,
            },
          }
        })
      },

      swapMeals: (mealId1, mealId2) => {
        set((state) => {
          if (!state.currentPlan) return state

          const meal1 = state.currentPlan.meals.find((m) => m.id === mealId1)
          const meal2 = state.currentPlan.meals.find((m) => m.id === mealId2)

          if (!meal1 || !meal2) return state

          return {
            currentPlan: {
              ...state.currentPlan,
              meals: state.currentPlan.meals.map((m) => {
                if (m.id === mealId1) {
                  return { ...m, dayIndex: meal2.dayIndex, mealType: meal2.mealType }
                }
                if (m.id === mealId2) {
                  return { ...m, dayIndex: meal1.dayIndex, mealType: meal1.mealType }
                }
                return m
              }),
            },
          }
        })
      },

      toggleMealValidation: (mealId) => {
        set((state) => {
          if (!state.currentPlan) return state

          return {
            currentPlan: {
              ...state.currentPlan,
              meals: state.currentPlan.meals.map((m) =>
                m.id === mealId ? { ...m, isValidated: !m.isValidated } : m
              ),
            },
          }
        })
      },

      regenerateMeal: (mealId, newMeal) => {
        set((state) => {
          if (!state.currentPlan) return state

          return {
            currentPlan: {
              ...state.currentPlan,
              meals: state.currentPlan.meals.map((m) =>
                m.id === mealId ? { ...newMeal, id: mealId } : m
              ),
            },
          }
        })
      },

      // Shopping list
      setShoppingList: (list) => {
        set((state) => {
          if (!state.currentPlan) return state

          return {
            currentPlan: {
              ...state.currentPlan,
              shoppingList: list,
            },
          }
        })
      },

      toggleShoppingItem: (itemId) => {
        set((state) => {
          if (!state.currentPlan?.shoppingList) return state

          const updateItems = (items: ShoppingItem[]) =>
            items.map((i) => (i.id === itemId ? { ...i, isChecked: !i.isChecked } : i))

          return {
            currentPlan: {
              ...state.currentPlan,
              shoppingList: {
                ...state.currentPlan.shoppingList,
                items: updateItems(state.currentPlan.shoppingList.items),
                categories: state.currentPlan.shoppingList.categories.map((cat) => ({
                  ...cat,
                  items: updateItems(cat.items),
                })),
              },
            },
          }
        })
      },

      clearShoppingList: () => {
        set((state) => {
          if (!state.currentPlan) return state

          return {
            currentPlan: {
              ...state.currentPlan,
              shoppingList: undefined,
            },
          }
        })
      },

      // Getters
      getMealsForDay: (dayIndex) => {
        const { currentPlan } = get()
        if (!currentPlan) return []
        return currentPlan.meals
          .filter((m) => m.dayIndex === dayIndex)
          .sort((a, b) => {
            const order = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 }
            return order[a.mealType] - order[b.mealType]
          })
      },

      getMealBySlot: (dayIndex, mealType) => {
        const { currentPlan } = get()
        if (!currentPlan) return undefined
        return currentPlan.meals.find(
          (m) => m.dayIndex === dayIndex && m.mealType === mealType
        )
      },

      getDailyNutrition: (dayIndex) => {
        const meals = get().getMealsForDay(dayIndex)
        return meals.reduce(
          (acc, meal) => ({
            calories: acc.calories + (meal.nutrition.calories || 0),
            proteins: acc.proteins + (meal.nutrition.proteins || 0),
            carbs: acc.carbs + (meal.nutrition.carbs || 0),
            fats: acc.fats + (meal.nutrition.fats || 0),
          }),
          { ...emptyNutrition }
        )
      },

      getWeeklyNutrition: () => {
        const { currentPlan } = get()
        if (!currentPlan) return { ...emptyNutrition }

        return currentPlan.meals.reduce(
          (acc, meal) => ({
            calories: acc.calories + (meal.nutrition.calories || 0),
            proteins: acc.proteins + (meal.nutrition.proteins || 0),
            carbs: acc.carbs + (meal.nutrition.carbs || 0),
            fats: acc.fats + (meal.nutrition.fats || 0),
          }),
          { ...emptyNutrition }
        )
      },

      getProgress: () => {
        const { currentPlan } = get()
        if (!currentPlan || currentPlan.meals.length === 0) {
          return { validated: 0, total: 0, percentage: 0 }
        }

        const validated = currentPlan.meals.filter((m) => m.isValidated).length
        const total = currentPlan.meals.length

        return {
          validated,
          total,
          percentage: Math.round((validated / total) * 100),
        }
      },

      getAllIngredients: () => {
        const { currentPlan } = get()
        if (!currentPlan) return []

        const ingredientMap = new Map<string, string>()

        currentPlan.meals.forEach((meal) => {
          meal.ingredients.forEach((ing) => {
            const key = ing.name.toLowerCase().trim()
            if (ingredientMap.has(key)) {
              // Combine quantities (simplified - just concatenate)
              ingredientMap.set(key, `${ingredientMap.get(key)} + ${ing.amount}`)
            } else {
              ingredientMap.set(key, ing.amount)
            }
          })
        })

        return Array.from(ingredientMap.entries()).map(([name, amount]) => ({
          name,
          amount,
        }))
      },

      getValidatedMealsIngredients: () => {
        const { currentPlan } = get()
        if (!currentPlan) return []

        const ingredientMap = new Map<string, { amount: string; calories: number }>()

        // Only get ingredients from validated meals
        currentPlan.meals
          .filter((meal) => meal.isValidated)
          .forEach((meal) => {
            meal.ingredients.forEach((ing) => {
              const key = ing.name.toLowerCase().trim()
              if (ingredientMap.has(key)) {
                const existing = ingredientMap.get(key)!
                ingredientMap.set(key, {
                  amount: `${existing.amount} + ${ing.amount}`,
                  calories: existing.calories + (ing.calories || 0),
                })
              } else {
                ingredientMap.set(key, {
                  amount: ing.amount,
                  calories: ing.calories || 0,
                })
              }
            })
          })

        return Array.from(ingredientMap.entries()).map(([name, data]) => ({
          name,
          amount: data.amount,
          calories: data.calories,
        }))
      },

      getValidatedMeals: () => {
        const { currentPlan } = get()
        if (!currentPlan) return []
        return currentPlan.meals.filter((meal) => meal.isValidated)
      },

      hasUnsavedChanges: () => {
        const { currentPlan } = get()
        if (!currentPlan) return false
        // Plan has unsaved changes if it exists and was modified after generation
        return currentPlan.meals.length > 0
      },

      resetPlanToOriginal: () => {
        set((state) => {
          // Reset all validations
          if (!state.currentPlan) return state
          return {
            currentPlan: {
              ...state.currentPlan,
              meals: state.currentPlan.meals.map((m) => ({ ...m, isValidated: false })),
              shoppingList: undefined,
            },
          }
        })
      },

      savePlan: () => {
        set((state) => {
          if (!state.currentPlan) return state
          // Mark plan as saved (all validated meals are now confirmed)
          return {
            currentPlan: {
              ...state.currentPlan,
              savedAt: new Date().toISOString(),
            },
          }
        })
      },
    }),
    {
      name: 'presence-meal-plan',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentPlan: state.currentPlan,
        planHistory: state.planHistory,
      }),
    }
  )
)

export default useMealPlanStore
