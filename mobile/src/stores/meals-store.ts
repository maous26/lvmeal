import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Meal, MealType, MealItem, DailyData, NutritionInfo, FoodItem } from '../types'
import { getDateKey, generateId } from '../lib/utils'

interface MealsState {
  dailyData: Record<string, DailyData>
  currentDate: string

  // Actions
  setCurrentDate: (date: string) => void
  addMeal: (type: MealType, items: MealItem[]) => void
  updateMeal: (mealId: string, items: MealItem[]) => void
  deleteMeal: (mealId: string, date?: string) => void
  addItemToMeal: (mealId: string, item: MealItem) => void
  removeItemFromMeal: (mealId: string, itemId: string) => void
  updateWaterIntake: (amount: number) => void

  // Getters
  getTodayData: () => DailyData
  getMealsByType: (date: string, type: MealType) => Meal[]
  getDailyTotals: (date?: string) => NutritionInfo
}

const createEmptyDailyData = (date: string): DailyData => ({
  date,
  meals: [],
  waterIntake: 0,
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

      setCurrentDate: (date) => set({ currentDate: date }),

      addMeal: (type, items) => {
        const { currentDate, dailyData } = get()
        const dayData = dailyData[currentDate] || createEmptyDailyData(currentDate)

        const newMeal: Meal = {
          id: generateId(),
          type,
          items,
          totalNutrition: calculateMealNutrition(items),
          createdAt: new Date().toISOString(),
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

        const updatedMeals = dayData.meals.map((meal) =>
          meal.id === mealId
            ? { ...meal, items, totalNutrition: calculateMealNutrition(items) }
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

        const updatedMeals = dayData.meals.filter((meal) => meal.id !== mealId)

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

        const updatedMeals = dayData.meals.map((meal) => {
          if (meal.id === mealId) {
            const newItems = [...meal.items, item]
            return {
              ...meal,
              items: newItems,
              totalNutrition: calculateMealNutrition(newItems),
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
          .map((meal) => {
            if (meal.id === mealId) {
              const newItems = meal.items.filter((item) => item.id !== itemId)
              if (newItems.length === 0) return null
              return {
                ...meal,
                items: newItems,
                totalNutrition: calculateMealNutrition(newItems),
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
              waterIntake: Math.max(0, dayData.waterIntake + amount),
            },
          },
        })
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
    }),
    {
      name: 'presence-meals-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export default useMealsStore
