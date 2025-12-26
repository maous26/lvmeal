import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserProfile, NutritionGoals, GoalType, ActivityLevel } from '../types'
import { calculateBMR, calculateTDEE, calculateAge } from '../lib/utils'

interface UserState {
  profile: UserProfile | null
  nutritionGoals: NutritionGoals | null
  isLoading: boolean

  // Actions
  setProfile: (profile: Partial<UserProfile>) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  calculateGoals: () => void
  resetStore: () => void
}

const defaultGoals: NutritionGoals = {
  calories: 2000,
  proteins: 100,
  carbs: 250,
  fats: 67,
  fiber: 30,
  water: 2.5,
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      nutritionGoals: defaultGoals,
      isLoading: false,

      setProfile: (profile) => {
        set({ profile: profile as UserProfile })
        get().calculateGoals()
      },

      updateProfile: (updates) => {
        const current = get().profile
        if (current) {
          set({ profile: { ...current, ...updates } })
          get().calculateGoals()
        }
      },

      calculateGoals: () => {
        const { profile } = get()
        if (!profile) return

        const age = profile.birthDate ? calculateAge(profile.birthDate) : 30
        const bmr = calculateBMR(profile.weight, profile.height, age, profile.gender)
        const tdee = calculateTDEE(bmr, profile.activityLevel)

        // Adjust based on goal
        let calorieTarget = tdee
        const goalAdjustments: Record<GoalType, number> = {
          lose: -500,
          maintain: 0,
          gain: 300,
          muscle: 300,
        }
        calorieTarget += goalAdjustments[profile.goal] || 0

        // Calculate macros
        const proteinMultiplier = profile.goal === 'muscle' ? 2.2 : 1.8
        const proteins = Math.round(profile.weight * proteinMultiplier)
        const fats = Math.round((calorieTarget * 0.25) / 9)
        const carbCalories = calorieTarget - (proteins * 4) - (fats * 9)
        const carbs = Math.round(carbCalories / 4)

        set({
          nutritionGoals: {
            calories: Math.max(1200, Math.round(calorieTarget)),
            proteins,
            carbs: Math.max(50, carbs),
            fats,
            fiber: 30,
            water: 2.5,
          },
        })
      },

      resetStore: () => {
        set({
          profile: null,
          nutritionGoals: defaultGoals,
          isLoading: false,
        })
      },
    }),
    {
      name: 'presence-user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export default useUserStore
