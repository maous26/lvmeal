import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserProfile, NutritionalNeeds, WeightEntry, NutritionInfo } from '../types'
import { LymIABrain, type UserContext } from '../services/lymia-brain'

// Keys of all persisted stores to clear on full reset
// IMPORTANT: These names MUST match the 'name' property in each store's persist config
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

  // Activity multiplier (conservative values to avoid overestimating calorie needs)
  // Users tend to overestimate their activity level, so we use lower multipliers
  // to ensure better weight loss results and avoid frustration
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,    // Little or no exercise
    light: 1.3,        // Light exercise 1-3 days/week (was 1.375)
    moderate: 1.45,    // Moderate exercise 3-5 days/week (was 1.55)
    active: 1.6,       // Active 6-7 days/week (was 1.725)
    athlete: 1.75,     // Athlete/very active (was 1.9)
  }
  const tdee = bmr * (activityMultipliers[activityLevel || 'moderate'] || 1.45)

  // Goal adjustment - Déficit/surplus calorique
  let calories: number
  switch (goal) {
    case 'weight_loss':
      // Déficit de 400-500 kcal pour perte de poids progressive (~0.5kg/semaine)
      calories = tdee - 450
      break
    case 'muscle_gain':
      // Surplus modéré pour prise de masse propre
      calories = tdee + 300
      break
    default:
      calories = tdee
  }
  calories = Math.round(calories)

  // ==========================================================================
  // MACRO DISTRIBUTION - Approche nutritionnelle personnalisée selon objectif
  // Priorité : Protéines > Lipides > Glucides (complément)
  // ==========================================================================

  let proteins: number
  let fats: number
  let carbs: number

  switch (goal) {
    case 'weight_loss':
      // PERTE DE POIDS - Priorité à la préservation musculaire
      // Protéines élevées (2g/kg) pour effet thermique et satiété
      // Lipides suffisants (0.9g/kg) pour hormones et absorption vitamines
      // Glucides modérés (plafonnés à 150g) pour favoriser l'utilisation des graisses
      proteins = Math.round(weight * 2.0)
      fats = Math.round(weight * 0.9)
      // Glucides = calories restantes, mais plafonné entre 80g et 150g
      const remainingCalsLoss = calories - (proteins * 4) - (fats * 9)
      const rawCarbsLoss = Math.round(remainingCalsLoss / 4)
      carbs = Math.max(80, Math.min(150, rawCarbsLoss)) // Plancher 80g, plafond 150g
      break

    case 'muscle_gain':
      // PRISE DE MASSE - Glucides importants pour l'anabolisme
      // Protéines élevées (2g/kg) pour synthèse protéique
      // Lipides modérés (0.8g/kg)
      // Glucides élevés pour énergie et récupération
      proteins = Math.round(weight * 2.0)
      fats = Math.round(weight * 0.8)
      // Glucides = calories restantes (pas de plafond en prise de masse)
      const remainingCalsGain = calories - (proteins * 4) - (fats * 9)
      carbs = Math.max(150, Math.round(remainingCalsGain / 4)) // Minimum 150g
      break

    default:
      // MAINTIEN - Répartition équilibrée
      // Protéines modérées (1.6g/kg)
      // Lipides standards (1g/kg)
      // Glucides = complément
      proteins = Math.round(weight * 1.6)
      fats = Math.round(weight * 1.0)
      const remainingCalsMaintain = calories - (proteins * 4) - (fats * 9)
      carbs = Math.round(remainingCalsMaintain / 4)
      break
  }

  // Sécurité : s'assurer que les macros ne dépassent pas les calories totales
  const totalMacroCalories = (proteins * 4) + (carbs * 4) + (fats * 9)
  if (totalMacroCalories > calories * 1.05) {
    // Ajuster les glucides si dépassement (les glucides sont la variable d'ajustement)
    const excessCalories = totalMacroCalories - calories
    carbs = Math.max(50, carbs - Math.round(excessCalories / 4))
  }

  console.log('[NutritionalNeeds] Calculated for goal:', goal, {
    calories,
    proteins: `${proteins}g (${Math.round(proteins * 4 / calories * 100)}%)`,
    fats: `${fats}g (${Math.round(fats * 9 / calories * 100)}%)`,
    carbs: `${carbs}g (${Math.round(carbs * 4 / calories * 100)}%)`,
  })

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
          const result = await LymIABrain.calculatePersonalizedNeeds(context)

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

          return goals
        } catch (error) {
          console.error('RAG calculation failed, using fallback:', error)
          // Fallback to Harris-Benedict
          const needs = calculateNutritionalNeeds(profile)
          return needs ? {
            calories: needs.calories,
            proteins: needs.proteins,
            carbs: needs.carbs,
            fats: needs.fats,
          } : null
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

        // Auto-recalculate nutrition goals on hydration to apply formula updates
        // Use multiple timeouts to catch late profile loading
        const tryRecalculate = (attempt: number) => {
          const store = useUserStore.getState()
          console.log(`[UserStore] Recalc attempt ${attempt}, profile exists:`, !!store.profile)
          if (store.profile) {
            console.log('[UserStore] 🔄 Recalculating nutrition goals...')
            store.recalculateNutritionGoals()
          } else if (attempt < 3) {
            setTimeout(() => tryRecalculate(attempt + 1), 1000)
          }
        }
        setTimeout(() => tryRecalculate(1), 500)
      },
    }
  )
)

export default useUserStore
