import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Meal, MealType, MealItem, DailyData, NutritionInfo, FoodItem } from '../types'
import { getDateKey, generateId } from '../lib/utils'

interface MealsState {
  dailyData: Record<string, DailyData>
  currentDate: string
  recentFoods: FoodItem[]
  favoriteFoods: FoodItem[]

  // Actions
  setCurrentDate: (date: string) => void
  addMeal: (type: MealType, items: MealItem[]) => void
  updateMeal: (mealId: string, items: MealItem[]) => void
  deleteMeal: (mealId: string, date?: string) => void
  addItemToMeal: (mealId: string, item: MealItem) => void
  removeItemFromMeal: (mealId: string, itemId: string) => void
  updateWaterIntake: (amount: number) => void
  addToRecent: (food: FoodItem) => void
  addToFavorites: (food: FoodItem) => void
  removeFromFavorites: (foodId: string) => void

  // Getters
  getTodayData: () => DailyData
  getMealsByType: (date: string, type: MealType) => Meal[]
  getMealsForDate: (date: string) => Meal[]
  getDailyTotals: (date?: string) => NutritionInfo
  getDailyNutrition: (date?: string) => NutritionInfo
  getHydration: (date?: string) => number
}

const createEmptyDailyData = (date: string): DailyData => ({
  date,
  meals: [],
  hydration: 0,
  totalNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
})

const calculateMealNutrition = (items: MealItem[]): NutritionInfo => {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + Math.round(item.food.nutrition.calories * item.quantity),
      proteins: acc.proteins + Math.round(item.food.nutrition.proteins * item.quantity),
      carbs: acc.carbs + Math.round(item.food.nutrition.carbs * item.quantity),
      fats: acc.fats + Math.round(item.food.nutrition.fats * item.quantity),
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )
}

const calculateDailyTotals = (meals: Meal[]): NutritionInfo => {
  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totalNutrition.calories,
      proteins: acc.proteins + meal.totalNutrition.proteins,
      carbs: acc.carbs + meal.totalNutrition.carbs,
      fats: acc.fats + meal.totalNutrition.fats,
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )
}

export const useMealsStore = create<MealsState>()(
  persist(
    (set, get) => ({
      dailyData: {},
      currentDate: getDateKey(),
      recentFoods: [],
      favoriteFoods: [],

      setCurrentDate: (date) => set({ currentDate: date }),

      addMeal: (type, items) => {
        const { currentDate, dailyData } = get()
        const dayData = dailyData[currentDate] || createEmptyDailyData(currentDate)

        const now = new Date().toISOString()
        const newMeal: Meal = {
          id: generateId(),
          type,
          date: currentDate,
          time: now.split('T')[1].substring(0, 5),
          items,
          totalNutrition: calculateMealNutrition(items),
          source: 'manual',
          isPlanned: false,
          createdAt: now,
          updatedAt: now,
        }

        const updatedMeals = [...dayData.meals, newMeal]

        set({
          dailyData: {
            ...dailyData,
            [currentDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: calculateDailyTotals(updatedMeals),
            },
          },
        })
      },

      updateMeal: (mealId, items) => {
        const { currentDate, dailyData } = get()
        const dayData = dailyData[currentDate]
        if (!dayData) return

        const updatedMeals = dayData.meals.map((meal: Meal) =>
          meal.id === mealId
            ? { ...meal, items, totalNutrition: calculateMealNutrition(items), updatedAt: new Date().toISOString() }
            : meal
        )

        set({
          dailyData: {
            ...dailyData,
            [currentDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: calculateDailyTotals(updatedMeals),
            },
          },
        })
      },

      deleteMeal: (mealId, date) => {
        const targetDate = date || get().currentDate
        const { dailyData } = get()
        const dayData = dailyData[targetDate]
        if (!dayData) return

        const updatedMeals = dayData.meals.filter((meal: Meal) => meal.id !== mealId)

        set({
          dailyData: {
            ...dailyData,
            [targetDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: calculateDailyTotals(updatedMeals),
            },
          },
        })
      },

      addItemToMeal: (mealId, item) => {
        const { currentDate, dailyData } = get()
        const dayData = dailyData[currentDate]
        if (!dayData) return

        const updatedMeals = dayData.meals.map((meal: Meal) => {
          if (meal.id === mealId) {
            const newItems = [...meal.items, item]
            return {
              ...meal,
              items: newItems,
              totalNutrition: calculateMealNutrition(newItems),
              updatedAt: new Date().toISOString(),
            }
          }
          return meal
        })

        set({
          dailyData: {
            ...dailyData,
            [currentDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: calculateDailyTotals(updatedMeals),
            },
          },
        })
      },

      removeItemFromMeal: (mealId, itemId) => {
        const { currentDate, dailyData } = get()
        const dayData = dailyData[currentDate]
        if (!dayData) return

        const updatedMeals = dayData.meals
          .map((meal: Meal) => {
            if (meal.id === mealId) {
              const newItems = meal.items.filter((item: MealItem) => item.id !== itemId)
              if (newItems.length === 0) return null
              return {
                ...meal,
                items: newItems,
                totalNutrition: calculateMealNutrition(newItems),
                updatedAt: new Date().toISOString(),
              }
            }
            return meal
          })
          .filter(Boolean) as Meal[]

        set({
          dailyData: {
            ...dailyData,
            [currentDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: calculateDailyTotals(updatedMeals),
            },
          },
        })
      },

      updateWaterIntake: (amount) => {
        const { currentDate, dailyData } = get()
        const dayData = dailyData[currentDate] || createEmptyDailyData(currentDate)

        set({
          dailyData: {
            ...dailyData,
            [currentDate]: {
              ...dayData,
              hydration: Math.max(0, dayData.hydration + amount),
            },
          },
        })
      },

      addToRecent: (food) => {
        const { recentFoods } = get()
        // Remove if already exists, then add to front
        const filtered = recentFoods.filter(f => f.id !== food.id)
        const updated = [food, ...filtered].slice(0, 20) // Keep max 20
        set({ recentFoods: updated })
      },

      addToFavorites: (food) => {
        const { favoriteFoods } = get()
        if (favoriteFoods.some(f => f.id === food.id)) return
        set({ favoriteFoods: [...favoriteFoods, food] })
      },

      removeFromFavorites: (foodId) => {
        const { favoriteFoods } = get()
        set({ favoriteFoods: favoriteFoods.filter(f => f.id !== foodId) })
      },

      getTodayData: () => {
        const { currentDate, dailyData } = get()
        return dailyData[currentDate] || createEmptyDailyData(currentDate)
      },

      getMealsByType: (date, type) => {
        const { dailyData } = get()
        const dayData = dailyData[date]
        if (!dayData) return []
        return dayData.meals.filter((meal) => meal.type === type)
      },

      getDailyTotals: (date) => {
        const targetDate = date || get().currentDate
        const { dailyData } = get()
        const dayData = dailyData[targetDate]
        if (!dayData) return { calories: 0, proteins: 0, carbs: 0, fats: 0 }
        return dayData.totalNutrition
      },

      getMealsForDate: (date) => {
        const { dailyData } = get()
        const dayData = dailyData[date]
        if (!dayData) return []
        return dayData.meals
      },

      getDailyNutrition: (date) => {
        const targetDate = date || get().currentDate
        const { dailyData } = get()
        const dayData = dailyData[targetDate]
        if (!dayData) return { calories: 0, proteins: 0, carbs: 0, fats: 0 }
        return dayData.totalNutrition
      },

      getHydration: (date) => {
        const targetDate = date || get().currentDate
        const { dailyData } = get()
        const dayData = dailyData[targetDate]
        if (!dayData) return 0
        return dayData.hydration
      },
    }),
    {
      name: 'presence-meals-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export default useMealsStore
