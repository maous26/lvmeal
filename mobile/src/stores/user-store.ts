import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserProfile, NutritionalNeeds, WeightEntry, NutritionInfo } from '../types'
import { LymIABrain, type UserContext } from '../services/lymia-brain'

// Keys of all persisted stores to clear on full reset
// IMPORTANT: These names MUST match the 'name' property in each store's persist config
// NOTE: 'lym-onboarding-store' is INTENTIONALLY NOT included here to prevent trial abuse
//       The signupDate must persist even when user resets data or changes account
const ALL_STORE_KEYS = [
  'presence-user',          // user-store.ts
  'presence-gamification',
  'presence-caloric-bank',
  'presence-meals-storage', // meals-store.ts
  'lym-message-center',
  'presence-wellness',
  'presence-coach-store',
  'presence-meditation',
  'presence-metabolic-boost',
  'presence-wellness-program',
  'presence-sport-program',
  'presence-meal-plan',     // meal-plan-store.ts
]

interface NutritionGoals {
  calories: number
  proteins: number
  carbs: number
  fats: number
  // Sport program calorie adjustment
  sportCaloriesBonus?: number
}

// Notification preferences for AI Coach and Meal Reminders
export interface NotificationPreferences {
  dailyInsightsEnabled: boolean
  alertsEnabled: boolean
  celebrationsEnabled: boolean
  lastNotificationDate: string | null
  // Meal reminder preferences
  mealRemindersEnabled: boolean
  mealReminderTimes?: {
    breakfast?: number // Hour 0-23
    lunch?: number
    snack?: number
    dinner?: number
  }
  // Coach proactive notifications
  coachProactiveEnabled: boolean
}

interface UserState {
  profile: Partial<UserProfile> | null
  isLoading: boolean
  isOnboarded: boolean
  hasSeenCoachWelcome: boolean // Track if user has seen coach welcome modal
  weightHistory: WeightEntry[]
  nutritionGoals: NutritionGoals | null
  lastRAGUpdate: string | null // Track when RAG last calculated needs
  notificationPreferences: NotificationPreferences

  // Actions
  setProfile: (profile: Partial<UserProfile>) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  clearProfile: () => void
  resetStore: () => void
  resetAllData: () => Promise<void> // Clear ALL app data (all stores)
  addWeightEntry: (entry: WeightEntry) => void
  setOnboarded: (value: boolean) => void
  setHasSeenCoachWelcome: (value: boolean) => void
  calculateNeeds: () => NutritionalNeeds | null
  // NEW: RAG-powered personalized calculation
  calculatePersonalizedNeeds: (weeklyNutrition?: NutritionInfo, wellnessData?: UserContext['wellnessData']) => Promise<NutritionGoals | null>
  // Sport program calorie adjustment
  updateSportCalorieBonus: (bonus: number) => void
  getEffectiveCalories: () => number
  // Force recalculation of nutritional needs (useful after formula updates)
  recalculateNutritionGoals: () => void
  // Notification preferences
  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) => void
}

// Mifflin-St Jeor BMR calculation (more accurate than Harris-Benedict)
// This MUST match the calculation in lymia-brain.ts for consistency
function calculateNutritionalNeeds(profile: Partial<UserProfile>): NutritionalNeeds | null {
  const { weight, height, age, gender, activityLevel, goal } = profile

  if (!weight || !height || !age) return null

  // Mifflin-St Jeor BMR formula (validated, more accurate than Harris-Benedict)
  let bmr: number
  if (gender === 'female') {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5
  }

  // Activity multiplier (standard Mifflin-St Jeor / WHO values)
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,    // Little or no exercise
    light: 1.375,      // Light exercise 1-3 days/week
    moderate: 1.55,    // Moderate exercise 3-5 days/week
    active: 1.725,     // Active 6-7 days/week
    athlete: 1.9,      // Athlete/very active
  }
  const tdee = bmr * (activityMultipliers[activityLevel || 'moderate'] || 1.55)

  // Goal adjustment - Déficit/surplus calorique (ANSES recommendations)
  let calories: number
  switch (goal) {
    case 'weight_loss':
      // Déficit de 400 kcal pour perte de poids progressive (~0.5kg/semaine)
      calories = tdee - 400
      break
    case 'muscle_gain':
      // Surplus modéré pour prise de masse propre
      calories = tdee + 300
      break
    default:
      calories = tdee
  }
  // Round to nearest 50 for cleaner display (matches lymia-brain.ts)
  calories = Math.round(calories / 50) * 50

  // ==========================================================================
  // MACRO DISTRIBUTION - Based on g/kg body weight (ISSN + ANSES guidelines)
  // Using RANGES that adapt to the individual profile
  // This MUST match the calculation in lymia-brain.ts for consistency
  // ==========================================================================

  // Protein: g/kg based on goal and activity (ISSN Position Stand)
  // - Sedentary adult: 0.83 g/kg (ANSES)
  // - Weight loss (preserve muscle): 1.6-2.4 g/kg (ISSN)
  // - Muscle gain: 1.6-2.2 g/kg (ISSN)
  // - Maintenance active: 1.2-1.6 g/kg
  let proteinPerKg: number
  switch (goal) {
    case 'weight_loss':
      // ISSN: 1.6-2.4 g/kg for weight loss
      if (activityLevel === 'athlete' || activityLevel === 'active') {
        proteinPerKg = 2.2
      } else if (activityLevel === 'moderate') {
        proteinPerKg = 2.0
      } else {
        proteinPerKg = 1.8
      }
      break
    case 'muscle_gain':
      // ISSN: 1.6-2.2 g/kg for muscle building
      if (activityLevel === 'athlete' || activityLevel === 'active') {
        proteinPerKg = 2.2
      } else {
        proteinPerKg = 1.8
      }
      break
    default:
      // Maintenance: 1.0-1.6 g/kg
      if (activityLevel === 'athlete' || activityLevel === 'active') {
        proteinPerKg = 1.6
      } else if (activityLevel === 'moderate') {
        proteinPerKg = 1.4
      } else {
        proteinPerKg = 1.0
      }
  }

  // Fat: g/kg based on goal (ANSES: 35-40% AET, minimum ~0.8g/kg for hormones)
  let fatPerKg: number
  switch (goal) {
    case 'weight_loss':
      fatPerKg = 0.9
      break
    case 'muscle_gain':
      fatPerKg = 0.8
      break
    default:
      fatPerKg = 1.0
  }

  // Calculate base macros
  let proteins = Math.round(weight * proteinPerKg)
  const fats = Math.round(weight * fatPerKg)

  // ==========================================================================
  // LIFESTYLE HABITS ADJUSTMENTS (from onboarding data)
  // These baseline adjustments reflect the user's typical lifestyle
  // This MUST match the calculation in lymia-brain.ts for consistency
  // ==========================================================================

  let adjustedCalories = calories
  const adjustmentReasons: string[] = []

  // Adaptive metabolism: reduce deficit
  if (profile.metabolismProfile === 'adaptive' || profile.metabolismFactors?.restrictiveDietsHistory) {
    if (goal === 'weight_loss') {
      adjustedCalories = Math.round((tdee - 200) / 50) * 50
      adjustmentReasons.push('Métabolisme adaptatif: déficit réduit')
    }
    proteins = Math.round(proteins * 1.1)
    adjustmentReasons.push('Protéines +10%')
  }

  // Baseline stress from onboarding (stressLevelDaily)
  const baselineStress = profile.lifestyleHabits?.stressLevelDaily
  if (baselineStress === 'high' || baselineStress === 'very_high') {
    proteins = Math.round(proteins * 1.05)
    adjustmentReasons.push('Stress quotidien élevé: protéines +5%')
  }

  // Baseline sleep quality from onboarding (sleepQualityPerception)
  const baselineSleepQuality = profile.lifestyleHabits?.sleepQualityPerception
  if (baselineSleepQuality === 'poor' && goal === 'weight_loss') {
    adjustedCalories += 100
    adjustmentReasons.push('Sommeil difficile: déficit réduit')
  }

  // Baseline sleep hours from onboarding (averageSleepHours)
  const baselineSleepHours = profile.lifestyleHabits?.averageSleepHours
  if (baselineSleepHours && baselineSleepHours < 6) {
    proteins = Math.round(proteins * 1.05)
    adjustmentReasons.push('Sommeil court: protéines +5%')
  }

  // Carbs: remaining calories (variable d'ajustement)
  const proteinCalories = proteins * 4
  const fatCalories = fats * 9
  const remainingForCarbs = adjustedCalories - proteinCalories - fatCalories
  const carbs = Math.max(80, Math.round(remainingForCarbs / 4)) // Minimum 80g for brain

  console.log('[NutritionalNeeds] Calculated (ISSN/ANSES g/kg):', {
    goal,
    activityLevel,
    baseCalories: calories,
    adjustedCalories,
    proteinPerKg,
    fatPerKg,
    proteins: `${proteins}g (${Math.round(proteins * 4 / adjustedCalories * 100)}%)`,
    fats: `${fats}g (${Math.round(fats * 9 / adjustedCalories * 100)}%)`,
    carbs: `${carbs}g (${Math.round(carbs * 4 / adjustedCalories * 100)}%)`,
    adjustments: adjustmentReasons,
  })

  return {
    calories: adjustedCalories,
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

// Track hydration state for persist middleware
let hasHydrated = false

export const useUserStoreHydration = () => hasHydrated

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      isLoading: false,
      isOnboarded: false,
      hasSeenCoachWelcome: false,
      weightHistory: [],
      nutritionGoals: null,
      lastRAGUpdate: null,
      notificationPreferences: {
        dailyInsightsEnabled: true,
        alertsEnabled: true,
        celebrationsEnabled: true,
        mealRemindersEnabled: true,
        coachProactiveEnabled: true,
        lastNotificationDate: null,
      },

      setProfile: (profile) => {
        console.log('[UserStore] setProfile called with:', {
          hasProfile: !!profile,
          keys: profile ? Object.keys(profile) : [],
          weight: profile?.weight,
          goal: profile?.goal,
          onboardingCompleted: profile?.onboardingCompleted,
        })
        // Use pre-calculated needs from profile if available (from AI/RAG),
        // otherwise calculate using Harris-Benedict formula
        const needs = profile.nutritionalNeeds || calculateNutritionalNeeds(profile)
        const goals = needs ? {
          calories: needs.calories,
          proteins: needs.proteins,
          carbs: needs.carbs,
          fats: needs.fats,
        } : null
        console.log('[UserStore] Calculated goals:', goals)
        set({
          profile: { ...profile, nutritionalNeeds: needs || undefined },
          isOnboarded: profile.onboardingCompleted || false,
          nutritionGoals: goals,
        })
        // Verify persistence after a short delay
        setTimeout(async () => {
          try {
            const stored = await AsyncStorage.getItem('presence-user')
            console.log('[UserStore] Persisted data check:', stored ? JSON.parse(stored) : null)
          } catch (e) {
            console.error('[UserStore] Persistence check error:', e)
          }
        }, 500)
      },

      updateProfile: (updates) => {
        const currentProfile = get().profile || {}
        const newProfile = { ...currentProfile, ...updates }
        const needs = calculateNutritionalNeeds(newProfile)
        const finalProfile = { ...newProfile, nutritionalNeeds: needs || undefined }
        // Recalculer aussi nutritionGoals pour garder la cohérence
        const goals = needs ? {
          calories: needs.calories,
          proteins: needs.proteins,
          carbs: needs.carbs,
          fats: needs.fats,
        } : get().nutritionGoals
        set({
          profile: finalProfile,
          nutritionGoals: goals,
        })
      },

      clearProfile: () => {
        // Note: On conserve hasSeenCoachWelcome pour éviter de réafficher le message de bienvenue
        // même si le profil est réinitialisé (cas de re-onboarding après inconsistent state)
        set({ profile: null, isOnboarded: false, weightHistory: [], nutritionGoals: null })
      },

      resetStore: () => {
        // Reset complet du store - réinitialise aussi hasSeenCoachWelcome
        set({ profile: null, isOnboarded: false, hasSeenCoachWelcome: false, weightHistory: [], nutritionGoals: null })
      },

      resetAllData: async () => {
        console.log('[UserStore] Resetting ALL app data...')
        // Clear all persisted stores from AsyncStorage
        try {
          await AsyncStorage.multiRemove(ALL_STORE_KEYS)
          console.log('[UserStore] All store data cleared from AsyncStorage')
        } catch (error) {
          console.error('[UserStore] Error clearing stores:', error)
        }
        // Reset current store state
        set({ profile: null, isOnboarded: false, hasSeenCoachWelcome: false, weightHistory: [], nutritionGoals: null, lastRAGUpdate: null })
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

      setHasSeenCoachWelcome: (value) => {
        set({ hasSeenCoachWelcome: value })
      },

      calculateNeeds: () => {
        const { profile } = get()
        if (!profile) return null
        return calculateNutritionalNeeds(profile)
      },

      // NEW: RAG-powered personalized calculation
      calculatePersonalizedNeeds: async (weeklyNutrition, wellnessData) => {
        const { profile } = get()
        if (!profile) return null

        // Build context for LymIA Brain
        const context: UserContext = {
          profile: profile as UserProfile,
          todayNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          weeklyAverage: weeklyNutrition || { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          currentStreak: 0,
          lastMeals: [],
          wellnessData: wellnessData || {},
        }

        try {
          console.log('[UserStore] Calling LymIABrain.calculatePersonalizedNeeds...')
          const result = await LymIABrain.calculatePersonalizedNeeds(context)
          console.log('[UserStore] LymIABrain result:', JSON.stringify(result))

          const goals: NutritionGoals = {
            calories: result.calories,
            proteins: result.proteins,
            carbs: result.carbs,
            fats: result.fats,
          }

          // Update store with personalized goals
          set({
            nutritionGoals: goals,
            lastRAGUpdate: new Date().toISOString(),
          })

          console.log('[UserStore] ✅ Goals updated from RAG:', goals)
          return goals
        } catch (error) {
          console.error('[UserStore] RAG calculation failed, using fallback:', error)
          // Fallback to Harris-Benedict
          const needs = calculateNutritionalNeeds(profile)
          const fallbackGoals = needs ? {
            calories: needs.calories,
            proteins: needs.proteins,
            carbs: needs.carbs,
            fats: needs.fats,
          } : null
          console.log('[UserStore] Fallback goals:', fallbackGoals)
          return fallbackGoals
        }
      },

      // Update sport calorie bonus when enrolling/unenrolling from sport program
      updateSportCalorieBonus: (bonus: number) => {
        const currentGoals = get().nutritionGoals
        if (!currentGoals) return

        set({
          nutritionGoals: {
            ...currentGoals,
            sportCaloriesBonus: bonus > 0 ? bonus : undefined,
          },
        })
      },

      // Get effective daily calories (base + sport bonus)
      getEffectiveCalories: () => {
        const goals = get().nutritionGoals
        if (!goals) return 0
        return goals.calories + (goals.sportCaloriesBonus || 0)
      },

      // Force recalculation of nutrition goals using current profile
      // Useful when formula is updated or user wants to refresh their targets
      recalculateNutritionGoals: () => {
        console.log('🔄🔄🔄 [UserStore] recalculateNutritionGoals CALLED 🔄🔄🔄')
        const profile = get().profile
        if (!profile) {
          console.log('[UserStore] No profile to recalculate')
          return
        }
        console.log('[UserStore] Profile found:', { weight: profile.weight, goal: profile.goal })
        const oldGoals = get().nutritionGoals
        console.log('[UserStore] OLD goals:', oldGoals)

        const needs = calculateNutritionalNeeds(profile)
        if (needs) {
          const goals = {
            calories: needs.calories,
            proteins: needs.proteins,
            carbs: needs.carbs,
            fats: needs.fats,
            // Preserve sport bonus if exists
            sportCaloriesBonus: oldGoals?.sportCaloriesBonus,
          }
          set({
            profile: { ...profile, nutritionalNeeds: needs },
            nutritionGoals: goals,
          })
          console.log('✅✅✅ [UserStore] NEW goals:', goals, '✅✅✅')
        }
      },

      updateNotificationPreferences: (prefs) => {
        set((state) => ({
          notificationPreferences: {
            ...state.notificationPreferences,
            ...prefs,
          },
        }))
      },
    }),
    {
      name: 'presence-user',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profile: state.profile,
        isOnboarded: state.isOnboarded,
        hasSeenCoachWelcome: state.hasSeenCoachWelcome,
        weightHistory: state.weightHistory,
        nutritionGoals: state.nutritionGoals,
        lastRAGUpdate: state.lastRAGUpdate,
        notificationPreferences: state.notificationPreferences,
      }),
      onRehydrateStorage: () => (state, error) => {
        hasHydrated = true
        console.log('[UserStore] Hydrated, state keys:', state ? Object.keys(state) : 'null')
        console.log('[UserStore] Hydrated, profile:', JSON.stringify(state?.profile)?.substring(0, 200))
        console.log('[UserStore] Hydrated, nutritionGoals:', JSON.stringify(state?.nutritionGoals))

        // ONE-TIME FIX: Goals were calculated with wrong formula or AI returned incorrect values.
        // Force recalculation using the deterministic Mifflin-St Jeor formula.
        // For a male, 95kg, 185cm, 50yo, moderate activity, weight_loss goal:
        // Expected: BMR ~1861, TDEE ~2885, -400 = ~2450-2500 kcal
        // If we see < 2300 kcal, the calculation was wrong and needs fixing.
        // TODO: Remove this block after 2025-01-15
        if (state?.nutritionGoals && state?.profile && state.nutritionGoals.calories < 2300) {
          console.log('[UserStore] 🔄 ONE-TIME FIX: Goals seem incorrect, recalculating with Mifflin-St Jeor...')
          console.log('[UserStore] Current goals:', state.nutritionGoals)
          setTimeout(() => {
            const store = useUserStore.getState()
            if (store.profile) {
              store.recalculateNutritionGoals()
              console.log('[UserStore] ✅ Recalculation complete, new goals:', store.nutritionGoals)
            }
          }, 500)
          return
        }

        if (state?.nutritionGoals) {
          console.log('[UserStore] ✅ nutritionGoals already exist, preserving them')
          return
        }

        // Only recalculate if no goals exist
        const tryRecalculate = (attempt: number) => {
          const store = useUserStore.getState()
          console.log(`[UserStore] Recalc attempt ${attempt}, profile exists:`, !!store.profile)
          if (store.profile && !store.nutritionGoals) {
            console.log('[UserStore] 🔄 No nutritionGoals found, calculating initial goals...')
            store.recalculateNutritionGoals()
          } else if (attempt < 3 && !store.nutritionGoals) {
            setTimeout(() => tryRecalculate(attempt + 1), 1000)
          }
        }
        setTimeout(() => tryRecalculate(1), 500)
      },
    }
  )
)

export default useUserStore
