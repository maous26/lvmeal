import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserProfile, NutritionalNeeds, WeightEntry } from '../types'

interface NutritionGoals {
  calories: number
  proteins: number
  carbs: number
  fats: number
}

interface UserState {
  profile: Partial<UserProfile> | null
  isLoading: boolean
  isOnboarded: boolean
  weightHistory: WeightEntry[]
  nutritionGoals: NutritionGoals | null

  // Actions
  setProfile: (profile: Partial<UserProfile>) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  clearProfile: () => void
  resetStore: () => void
  addWeightEntry: (entry: WeightEntry) => void
  setOnboarded: (value: boolean) => void
  calculateNeeds: () => NutritionalNeeds | null
}

// Harris-Benedict BMR calculation
function calculateNutritionalNeeds(profile: Partial<UserProfile>): NutritionalNeeds | null {
  const { weight, height, age, gender, activityLevel, goal } = profile

  if (!weight || !height || !age) return null

  // Calculate BMR
  let bmr: number
  if (gender === 'female') {
    bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)
  } else {
    bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
  }

  // Activity multiplier
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    athlete: 1.9,
  }
  const tdee = bmr * (activityMultipliers[activityLevel || 'moderate'] || 1.55)

  // Goal adjustment
  let calories: number
  switch (goal) {
    case 'weight_loss':
      calories = tdee - 400
      break
    case 'muscle_gain':
      calories = tdee + 300
      break
    default:
      calories = tdee
  }
  calories = Math.round(calories)

  // Macro distribution
  const proteinPerKg = goal === 'muscle_gain' ? 2.0 : goal === 'weight_loss' ? 1.8 : 1.6
  const proteins = Math.round(weight * proteinPerKg)
  const fats = Math.round((calories * 0.25) / 9)
  const carbs = Math.round((calories - (proteins * 4) - (fats * 9)) / 4)

  return {
    calories,
    proteins,
    carbs,
    fats,
    fiber: 30,
    water: 2.5,
    calcium: 1000,
    iron: gender === 'female' ? 18 : 8,
    vitaminD: 600,
    vitaminC: 90,
    vitaminB12: 2.4,
    zinc: 11,
    magnesium: 400,
    potassium: 3500,
    omega3: 1.6,
  }
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      isLoading: false,
      isOnboarded: false,
      weightHistory: [],
      nutritionGoals: null,

      setProfile: (profile) => {
        const needs = calculateNutritionalNeeds(profile)
        const goals = needs ? {
          calories: needs.calories,
          proteins: needs.proteins,
          carbs: needs.carbs,
          fats: needs.fats,
        } : null
        set({
          profile: { ...profile, nutritionalNeeds: needs || undefined },
          isOnboarded: profile.onboardingCompleted || false,
          nutritionGoals: goals,
        })
      },

      updateProfile: (updates) => {
        const currentProfile = get().profile || {}
        const newProfile = { ...currentProfile, ...updates }
        const needs = calculateNutritionalNeeds(newProfile)
        const finalProfile = { ...newProfile, nutritionalNeeds: needs || undefined }
        set({
          profile: finalProfile,
        })
      },

      clearProfile: () => {
        set({ profile: null, isOnboarded: false, weightHistory: [], nutritionGoals: null })
      },

      resetStore: () => {
        set({ profile: null, isOnboarded: false, weightHistory: [], nutritionGoals: null })
      },

      addWeightEntry: (entry) => {
        set((state) => ({
          weightHistory: [...state.weightHistory, entry],
          profile: state.profile ? { ...state.profile, weight: entry.weight } : null,
        }))
      },

      setOnboarded: (value) => {
        set({ isOnboarded: value })
      },

      calculateNeeds: () => {
        const { profile } = get()
        if (!profile) return null
        return calculateNutritionalNeeds(profile)
      },
    }),
    {
      name: 'presence-user',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profile: state.profile,
        isOnboarded: state.isOnboarded,
        weightHistory: state.weightHistory,
        nutritionGoals: state.nutritionGoals,
      }),
    }
  )
)

export default useUserStore
