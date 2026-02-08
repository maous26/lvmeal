import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, NutritionalNeeds, WeightEntry } from '@/types'

interface UserState {
  profile: Partial<UserProfile> | null
  isLoading: boolean
  isOnboarded: boolean
  weightHistory: WeightEntry[]

  // Actions
  setProfile: (profile: Partial<UserProfile>) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  clearProfile: () => void
  addWeightEntry: (entry: WeightEntry) => void
  setOnboarded: (value: boolean) => void
  calculateNeeds: () => NutritionalNeeds | null
  migrateFromLocalStorage: () => void
}

// Harris-Benedict BMR calculation with adaptive metabolism support
export function calculateNutritionalNeeds(profile: Partial<UserProfile>): NutritionalNeeds | null {
  const { weight, height, age, gender, activityLevel, goal, metabolismProfile = 'standard' } = profile

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

  // Goal adjustment - adaptive metabolism gets gentler approach
  let calories: number

  if (metabolismProfile === 'adaptive') {
    switch (goal) {
      case 'weight_loss':
        calories = tdee - 100 // Gentle deficit (vs -400 for standard)
        break
      case 'muscle_gain':
        calories = tdee + 200
        break
      default:
        calories = tdee
    }
  } else {
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
  }
  calories = Math.round(calories)

  // Macro distribution - adaptive gets higher protein & fat
  let proteinPerKg: number
  let fatPercentage: number

  if (metabolismProfile === 'adaptive') {
    proteinPerKg = 2.0 // Higher protein for metabolic health
    fatPercentage = 0.30 // Higher fat for hormonal balance
  } else {
    proteinPerKg = goal === 'muscle_gain' ? 2.0 : goal === 'weight_loss' ? 1.8 : 1.6
    fatPercentage = 0.25
  }

  const proteins = Math.round(weight * proteinPerKg)
  const fats = Math.round((calories * fatPercentage) / 9)
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

      setProfile: (profile) => {
        const needs = calculateNutritionalNeeds(profile)
        set({
          profile: { ...profile, nutritionalNeeds: needs || undefined },
          isOnboarded: profile.onboardingCompleted || false,
        })
        // Also sync to legacy localStorage for backward compatibility
        if (typeof window !== 'undefined') {
          localStorage.setItem('userProfile', JSON.stringify({ ...profile, nutritionalNeeds: needs || undefined }))
        }
      },

      updateProfile: (updates) => {
        const currentProfile = get().profile || {}
        const newProfile = { ...currentProfile, ...updates }
        const needs = calculateNutritionalNeeds(newProfile)
        const finalProfile = { ...newProfile, nutritionalNeeds: needs || undefined }
        set({
          profile: finalProfile,
        })
        // Also sync to legacy localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('userProfile', JSON.stringify(finalProfile))
        }
      },

      clearProfile: () => {
        set({ profile: null, isOnboarded: false, weightHistory: [] })
        // Also clear legacy localStorage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('userProfile')
        }
      },

      // Migration function to sync legacy localStorage to store
      migrateFromLocalStorage: () => {
        if (typeof window === 'undefined') return

        const { profile } = get()
        // Only migrate if store is empty but localStorage has data
        if (!profile) {
          const legacyProfile = localStorage.getItem('userProfile')
          if (legacyProfile) {
            try {
              const parsed = JSON.parse(legacyProfile) as Partial<UserProfile>
              const needs = calculateNutritionalNeeds(parsed)
              set({
                profile: { ...parsed, nutritionalNeeds: needs || parsed.nutritionalNeeds },
                isOnboarded: parsed.onboardingCompleted || false,
              })
            } catch {
              // Invalid JSON, ignore
            }
          }
        }
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
      partialize: (state) => ({
        profile: state.profile,
        isOnboarded: state.isOnboarded,
        weightHistory: state.weightHistory,
      }),
    }
  )
)
