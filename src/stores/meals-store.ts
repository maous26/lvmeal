import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Meal, MealType, NutritionInfo, DailyMeals, FoodItem, MealItem } from '@/types'

// Helper to get today's date string
function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

// Helper to generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Calculate total nutrition from meal items
function calculateTotalNutrition(items: MealItem[]): NutritionInfo {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + Math.round(item.food.nutrition.calories * item.quantity),
      proteins: acc.proteins + Math.round(item.food.nutrition.proteins * item.quantity),
      carbs: acc.carbs + Math.round(item.food.nutrition.carbs * item.quantity),
      fats: acc.fats + Math.round(item.food.nutrition.fats * item.quantity),
      fiber: (acc.fiber || 0) + Math.round((item.food.nutrition.fiber || 0) * item.quantity),
      sugar: (acc.sugar || 0) + Math.round((item.food.nutrition.sugar || 0) * item.quantity),
      sodium: (acc.sodium || 0) + Math.round((item.food.nutrition.sodium || 0) * item.quantity),
      saturatedFat: (acc.saturatedFat || 0) + Math.round((item.food.nutrition.saturatedFat || 0) * item.quantity),
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 } as NutritionInfo
  )
}

interface MealsState {
  // Data
  meals: Record<string, Meal[]> // key: YYYY-MM-DD, value: meals for that day
  currentDate: string
  recentFoods: FoodItem[]
  favoriteFoods: FoodItem[]

  // Hydration
  hydration: Record<string, number> // key: YYYY-MM-DD, value: ml consumed

  // Actions - Navigation
  setCurrentDate: (date: string) => void
  goToToday: () => void

  // Actions - Meals
  addMeal: (meal: Omit<Meal, 'id' | 'createdAt' | 'updatedAt' | 'totalNutrition'> & { items: MealItem[] }) => Meal
  addFoodToMeal: (food: FoodItem, mealType: MealType, date?: string, quantity?: number) => void
  updateMeal: (mealId: string, updates: Partial<Meal>) => void
  deleteMeal: (mealId: string, date: string) => void
  removeItemFromMeal: (mealId: string, itemId: string) => void
  updateItemQuantity: (mealId: string, itemId: string, quantity: number, servingUnit?: string) => void
  getMealsForDate: (date: string) => Meal[]
  getMealsByType: (date: string, type: MealType) => Meal[]

  // Actions - Food
  addToRecentFoods: (food: FoodItem) => void
  addToFavorites: (food: FoodItem) => void
  removeFromFavorites: (foodId: string) => void

  // Actions - Hydration
  addHydration: (amount: number, date?: string) => void
  getHydration: (date: string) => number

  // Computed
  getDailyNutrition: (date: string) => NutritionInfo
  getTodayProgress: () => { nutrition: NutritionInfo; mealsLogged: number }
}

export const useMealsStore = create<MealsState>()(
  persist(
    (set, get) => ({
      meals: {},
      currentDate: getTodayString(),
      recentFoods: [],
      favoriteFoods: [],
      hydration: {},

      setCurrentDate: (date) => set({ currentDate: date }),

      goToToday: () => set({ currentDate: getTodayString() }),

      addMeal: (mealData) => {
        const id = generateId()
        const now = new Date().toISOString()
        const totalNutrition = calculateTotalNutrition(mealData.items)

        const meal: Meal = {
          ...mealData,
          id,
          totalNutrition,
          createdAt: now,
          updatedAt: now,
        }

        set((state) => {
          const dateMeals = state.meals[mealData.date] || []
          return {
            meals: {
              ...state.meals,
              [mealData.date]: [...dateMeals, meal],
            },
          }
        })

        // Add foods to recent
        mealData.items.forEach((item) => {
          get().addToRecentFoods(item.food)
        })

        return meal
      },

      addFoodToMeal: (food, mealType, date, quantity = 1) => {
        const targetDate = date || getTodayString()
        const existingMeals = get().getMealsByType(targetDate, mealType)

        if (existingMeals.length > 0) {
          // Add to existing meal
          const meal = existingMeals[0]
          const newItem: MealItem = {
            id: generateId(),
            food,
            quantity,
          }
          get().updateMeal(meal.id, {
            items: [...meal.items, newItem],
          })
        } else {
          // Create new meal
          const now = new Date()
          get().addMeal({
            type: mealType,
            date: targetDate,
            time: now.toTimeString().slice(0, 5),
            items: [{
              id: generateId(),
              food,
              quantity,
            }],
            source: 'manual',
            isPlanned: false,
          })
        }

        // Add to recent foods
        get().addToRecentFoods(food)
      },

      updateMeal: (mealId, updates) => {
        set((state) => {
          const newMeals = { ...state.meals }
          for (const date in newMeals) {
            const index = newMeals[date].findIndex((m) => m.id === mealId)
            if (index !== -1) {
              const meal = newMeals[date][index]
              const updatedMeal = { ...meal, ...updates, updatedAt: new Date().toISOString() }
              if (updates.items) {
                updatedMeal.totalNutrition = calculateTotalNutrition(updates.items)
              }
              newMeals[date] = [
                ...newMeals[date].slice(0, index),
                updatedMeal,
                ...newMeals[date].slice(index + 1),
              ]
              break
            }
          }
          return { meals: newMeals }
        })
      },

      deleteMeal: (mealId, date) => {
        set((state) => ({
          meals: {
            ...state.meals,
            [date]: (state.meals[date] || []).filter((m) => m.id !== mealId),
          },
        }))
      },

      removeItemFromMeal: (mealId, itemId) => {
        set((state) => {
          const newMeals = { ...state.meals }
          for (const date in newMeals) {
            const mealIndex = newMeals[date].findIndex((m) => m.id === mealId)
            if (mealIndex !== -1) {
              const meal = newMeals[date][mealIndex]
              const updatedItems = meal.items.filter((item) => item.id !== itemId)

              // Si le repas n'a plus d'items, on le supprime
              if (updatedItems.length === 0) {
                newMeals[date] = newMeals[date].filter((m) => m.id !== mealId)
              } else {
                const updatedMeal = {
                  ...meal,
                  items: updatedItems,
                  totalNutrition: calculateTotalNutrition(updatedItems),
                  updatedAt: new Date().toISOString(),
                }
                newMeals[date] = [
                  ...newMeals[date].slice(0, mealIndex),
                  updatedMeal,
                  ...newMeals[date].slice(mealIndex + 1),
                ]
              }
              break
            }
          }
          return { meals: newMeals }
        })
      },

      updateItemQuantity: (mealId, itemId, quantity, servingUnit) => {
        set((state) => {
          const newMeals = { ...state.meals }
          for (const date in newMeals) {
            const mealIndex = newMeals[date].findIndex((m) => m.id === mealId)
            if (mealIndex !== -1) {
              const meal = newMeals[date][mealIndex]
              const updatedItems = meal.items.map((item) => {
                if (item.id === itemId) {
                  const updatedFood = servingUnit
                    ? { ...item.food, servingUnit }
                    : item.food
                  return { ...item, quantity, food: updatedFood }
                }
                return item
              })

              const updatedMeal = {
                ...meal,
                items: updatedItems,
                totalNutrition: calculateTotalNutrition(updatedItems),
                updatedAt: new Date().toISOString(),
              }
              newMeals[date] = [
                ...newMeals[date].slice(0, mealIndex),
                updatedMeal,
                ...newMeals[date].slice(mealIndex + 1),
              ]
              break
            }
          }
          return { meals: newMeals }
        })
      },

      getMealsForDate: (date) => {
        return get().meals[date] || []
      },

      getMealsByType: (date, type) => {
        return (get().meals[date] || []).filter((m) => m.type === type)
      },

      addToRecentFoods: (food) => {
        set((state) => {
          const filtered = state.recentFoods.filter((f) => f.id !== food.id)
          return {
            recentFoods: [food, ...filtered].slice(0, 20), // Keep last 20
          }
        })
      },

      addToFavorites: (food) => {
        set((state) => {
          if (state.favoriteFoods.some((f) => f.id === food.id)) return state
          return {
            favoriteFoods: [...state.favoriteFoods, food],
          }
        })
      },

      removeFromFavorites: (foodId) => {
        set((state) => ({
          favoriteFoods: state.favoriteFoods.filter((f) => f.id !== foodId),
        }))
      },

      addHydration: (amount, date) => {
        const targetDate = date || getTodayString()
        set((state) => ({
          hydration: {
            ...state.hydration,
            [targetDate]: (state.hydration[targetDate] || 0) + amount,
          },
        }))
      },

      getHydration: (date) => {
        return get().hydration[date] || 0
      },

      getDailyNutrition: (date) => {
        const meals = get().meals[date] || []
        return meals.reduce(
          (acc, meal) => ({
            calories: acc.calories + meal.totalNutrition.calories,
            proteins: acc.proteins + meal.totalNutrition.proteins,
            carbs: acc.carbs + meal.totalNutrition.carbs,
            fats: acc.fats + meal.totalNutrition.fats,
            fiber: (acc.fiber || 0) + (meal.totalNutrition.fiber || 0),
            sugar: (acc.sugar || 0) + (meal.totalNutrition.sugar || 0),
            sodium: (acc.sodium || 0) + (meal.totalNutrition.sodium || 0),
            saturatedFat: (acc.saturatedFat || 0) + (meal.totalNutrition.saturatedFat || 0),
          }),
          { calories: 0, proteins: 0, carbs: 0, fats: 0 } as NutritionInfo
        )
      },

      getTodayProgress: () => {
        const today = getTodayString()
        const nutrition = get().getDailyNutrition(today)
        const mealsLogged = (get().meals[today] || []).length
        return { nutrition, mealsLogged }
      },
    }),
    {
      name: 'presence-meals',
      partialize: (state) => ({
        meals: state.meals,
        recentFoods: state.recentFoods,
        favoriteFoods: state.favoriteFoods,
        hydration: state.hydration,
      }),
    }
  )
)
