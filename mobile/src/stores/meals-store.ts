import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Meal, MealType, MealItem, DailyData, NutritionInfo, FoodItem } from '../types'
import { getDateKey, generateId } from '../lib/utils'
import { useCaloricBankStore } from './caloric-bank-store'
import { useUserStore } from './user-store'

interface MealsState {
  dailyData: Record<string, DailyData>
  currentDate: string
  recentFoods: FoodItem[]
  favoriteFoods: FoodItem[]
  _hasHydrated: boolean

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

// Ensure nutrition object is valid (fixes corrupted data from storage)
const ensureValidNutrition = (nutrition: unknown): NutritionInfo => {
  if (!nutrition || typeof nutrition !== 'object') {
    return { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  }
  const n = nutrition as Record<string, unknown>
  return {
    calories: typeof n.calories === 'number' ? n.calories : 0,
    proteins: typeof n.proteins === 'number' ? n.proteins : 0,
    carbs: typeof n.carbs === 'number' ? n.carbs : 0,
    fats: typeof n.fats === 'number' ? n.fats : 0,
  }
}

// Clean corrupted daily data entries (null totalNutrition, invalid meals, etc.)
const cleanDailyData = (dailyData: Record<string, unknown>): Record<string, DailyData> => {
  if (!dailyData || typeof dailyData !== 'object') {
    return {}
  }

  const cleaned: Record<string, DailyData> = {}

  for (const [date, data] of Object.entries(dailyData)) {
    if (!data || typeof data !== 'object') {
      cleaned[date] = createEmptyDailyData(date)
      continue
    }

    const d = data as Record<string, unknown>
    const meals = Array.isArray(d.meals) ? d.meals : []

    // Clean each meal's totalNutrition
    const cleanedMeals = meals.map((meal: unknown) => {
      if (!meal || typeof meal !== 'object') return null
      const m = meal as Record<string, unknown>
      return {
        ...m,
        totalNutrition: ensureValidNutrition(m.totalNutrition),
      }
    }).filter(Boolean) as Meal[]

    cleaned[date] = {
      date: typeof d.date === 'string' ? d.date : date,
      meals: cleanedMeals,
      hydration: typeof d.hydration === 'number' ? d.hydration : 0,
      totalNutrition: ensureValidNutrition(d.totalNutrition),
    }
  }

  return cleaned
}

const calculateMealNutrition = (items: MealItem[]): NutritionInfo => {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.food.nutrition.calories * item.quantity,
      proteins: acc.proteins + item.food.nutrition.proteins * item.quantity,
      carbs: acc.carbs + item.food.nutrition.carbs * item.quantity,
      fats: acc.fats + item.food.nutrition.fats * item.quantity,
    }),
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )
}

const calculateDailyTotals = (meals: Meal[]): NutritionInfo => {
  return meals.reduce(
    (acc, meal) => {
      // Safety check for corrupted meal data where totalNutrition might be null
      const nutrition = meal.totalNutrition
      if (!nutrition || typeof nutrition !== 'object') {
        return acc
      }
      return {
        calories: acc.calories + (nutrition.calories || 0),
        proteins: acc.proteins + (nutrition.proteins || 0),
        carbs: acc.carbs + (nutrition.carbs || 0),
        fats: acc.fats + (nutrition.fats || 0),
      }
    },
    { calories: 0, proteins: 0, carbs: 0, fats: 0 }
  )
}

// Sync calories with CaloricBankStore
const syncCaloricBank = (date: string, consumedCalories: number) => {
  const nutritionGoals = useUserStore.getState().nutritionGoals
  const targetCalories = nutritionGoals?.calories || 2000
  useCaloricBankStore.getState().updateDailyBalance(date, targetCalories, consumedCalories)
  console.log('[MealsStore] Synced CaloricBank:', { date, targetCalories, consumedCalories })
}

export const useMealsStore = create<MealsState>()(
  persist(
    (set, get) => ({
      dailyData: {},
      currentDate: getDateKey(),
      recentFoods: [],
      _hasHydrated: false,
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

        const newTotals = calculateDailyTotals(updatedMeals)

        console.log('[MealsStore] Adding meal:', {
          type,
          date: currentDate,
          itemsCount: items.length,
          totalCalories: newMeal.totalNutrition.calories,
          totalMealsAfter: updatedMeals.length,
        })

        set({
          dailyData: {
            ...dailyData,
            [currentDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: newTotals,
            },
          },
        })

        // Sync with CaloricBankStore
        syncCaloricBank(currentDate, newTotals.calories)
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

        const newTotals = calculateDailyTotals(updatedMeals)

        set({
          dailyData: {
            ...dailyData,
            [currentDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: newTotals,
            },
          },
        })

        // Sync with CaloricBankStore
        syncCaloricBank(currentDate, newTotals.calories)
      },

      deleteMeal: (mealId, date) => {
        const targetDate = date || get().currentDate
        const { dailyData } = get()
        const dayData = dailyData[targetDate]
        if (!dayData) return

        const updatedMeals = dayData.meals.filter((meal: Meal) => meal.id !== mealId)
        const newTotals = calculateDailyTotals(updatedMeals)

        set({
          dailyData: {
            ...dailyData,
            [targetDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: newTotals,
            },
          },
        })

        // Sync with CaloricBankStore
        syncCaloricBank(targetDate, newTotals.calories)
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

        const newTotals = calculateDailyTotals(updatedMeals)

        set({
          dailyData: {
            ...dailyData,
            [currentDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: newTotals,
            },
          },
        })

        // Sync with CaloricBankStore
        syncCaloricBank(currentDate, newTotals.calories)
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

        const newTotals = calculateDailyTotals(updatedMeals)

        set({
          dailyData: {
            ...dailyData,
            [currentDate]: {
              ...dayData,
              meals: updatedMeals,
              totalNutrition: newTotals,
            },
          },
        })

        // Sync with CaloricBankStore
        syncCaloricBank(currentDate, newTotals.calories)
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
        // Safety check for corrupted data where totalNutrition might be null
        const nutrition = dayData.totalNutrition
        if (!nutrition || typeof nutrition !== 'object') {
          return { calories: 0, proteins: 0, carbs: 0, fats: 0 }
        }
        return {
          calories: nutrition.calories || 0,
          proteins: nutrition.proteins || 0,
          carbs: nutrition.carbs || 0,
          fats: nutrition.fats || 0,
        }
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
        // Safety check for corrupted data where totalNutrition might be null
        const nutrition = dayData.totalNutrition
        if (!nutrition || typeof nutrition !== 'object') {
          return { calories: 0, proteins: 0, carbs: 0, fats: 0 }
        }
        return {
          calories: nutrition.calories || 0,
          proteins: nutrition.proteins || 0,
          carbs: nutrition.carbs || 0,
          fats: nutrition.fats || 0,
        }
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
      onRehydrateStorage: () => (state) => {
        console.log('[MealsStore] Hydrating, dailyData dates:', state?.dailyData ? Object.keys(state.dailyData) : 'none')

        // Clean corrupted data on hydration
        if (state?.dailyData) {
          const cleanedData = cleanDailyData(state.dailyData as Record<string, unknown>)
          const originalKeys = Object.keys(state.dailyData)
          const cleanedKeys = Object.keys(cleanedData)

          if (originalKeys.length !== cleanedKeys.length) {
            console.log('[MealsStore] Cleaned corrupted entries:', originalKeys.length - cleanedKeys.length)
          }

          // Check if any data was actually corrupted and fixed
          let fixedCount = 0
          for (const key of cleanedKeys) {
            const original = (state.dailyData as Record<string, unknown>)[key] as Record<string, unknown> | undefined
            if (original && (!original.totalNutrition || typeof original.totalNutrition !== 'object')) {
              fixedCount++
            }
          }
          if (fixedCount > 0) {
            console.log('[MealsStore] Fixed', fixedCount, 'entries with null/invalid totalNutrition')
          }

          useMealsStore.setState({ dailyData: cleanedData, _hasHydrated: true })
        } else {
          useMealsStore.setState({ _hasHydrated: true })
        }
      },
    }
  )
)

// Hydration hook - must be defined AFTER useMealsStore
export const useMealsStoreHydration = () => useMealsStore((s) => s._hasHydrated)

export default useMealsStore
