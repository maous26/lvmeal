import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserProfile, NutritionalNeeds, WeightEntry, NutritionInfo } from '../types'
import type { BlobPaletteId } from '../constants/theme'
import { LymIABrain, type UserContext } from '../services/lymia-brain'
import { addToSyncQueue } from '../services/cloud-sync-service'
import { calculateNutritionalNeeds } from '../services/nutrition-calculator'

// Keys of all persisted stores to clear on full reset
// IMPORTANT: These names MUST match the 'name' property in each store's persist config
// NOTE: 'lym-onboarding-store' is INTENTIONALLY NOT included here to prevent trial abuse
//       The signupDate must persist even when user resets data or changes account
const ALL_STORE_KEYS = [
  'presence-user',              // user-store.ts
  'presence-gamification-v4',   // gamification-store.ts (CORRECTED - was missing -v4)
  'presence-caloric-bank',      // caloric-bank-store.ts
  'presence-meals-storage',     // meals-store.ts
  'lym-message-center',         // (legacy)
  'presence-wellness',          // wellness-store.ts
  'coach-storage',              // coach-store.ts (CORRECTED - was presence-coach-store)
  'meditation-storage',         // meditation-store.ts (CORRECTED - was presence-meditation)
  'metabolic-boost-storage',    // metabolic-boost-store.ts (CORRECTED - was presence-metabolic-boost)
  'wellness-program-storage',   // wellness-program-store.ts (CORRECTED - was presence-wellness-program)
  'presence-sport-program',     // sport-program-store.ts
  'presence-meal-plan',         // meal-plan-store.ts
  'presence-recipes',           // recipes-store.ts (ADDED)
  'presence-custom-recipes',    // custom-recipes-store.ts (ADDED)
  'gustar-recipes-storage',     // gustar-store.ts (ADDED)
  'lymia-chat-storage',         // chat-store.ts (ADDED)
  'meal-input-preferences',     // meal-input-preferences-store.ts (ADDED)
  'presence-devices',           // devices-store.ts (ADDED)
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
  _hasHydrated: boolean // Track if store has hydrated from AsyncStorage
  weightHistory: WeightEntry[]
  nutritionGoals: NutritionGoals | null
  lastRAGUpdate: string | null // Track when RAG last calculated needs
  notificationPreferences: NotificationPreferences
  blobPalette: BlobPaletteId // Blob color palette preference (light mode only)

  // Actions
  setProfile: (profile: Partial<UserProfile>) => void
  updateProfile: (updates: Partial<UserProfile>) => void
  clearProfile: () => void
  setNutritionGoals: (goals: NutritionGoals | null) => void
  resetStore: () => void
  resetAllData: () => Promise<void> // Clear ALL app data (all stores)
  addWeightEntry: (entry: WeightEntry) => void
  cleanWeightHistory: () => void
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
  // Blob palette preference
  setBlobPalette: (palette: BlobPaletteId) => void
}

// Nutritional calculation is now centralized in services/nutrition-calculator.ts
// This eliminates duplication with lymia-brain.ts and OnboardingScreen.tsx

// Track hydration state for persist middleware (legacy - use _hasHydrated in store instead)
let hasHydrated = false

// Reactive hydration hook - reads from store state for proper reactivity
export const useUserStoreHydration = () => useUserStore((s) => s._hasHydrated)

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      profile: null,
      isLoading: false,
      isOnboarded: false,
      hasSeenCoachWelcome: false,
      _hasHydrated: false,
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
      blobPalette: 'default',

      setProfile: (profile) => {
        // MERGE with existing profile instead of replacing
        const currentProfile = get().profile || {}
        const mergedProfile = { ...currentProfile, ...profile }

        console.log('[UserStore] setProfile called with:', {
          hasProfile: !!profile,
          keys: profile ? Object.keys(profile) : [],
          weight: profile?.weight,
          goal: profile?.goal,
          onboardingCompleted: profile?.onboardingCompleted,
          mergedKeys: Object.keys(mergedProfile),
        })
        // ALWAYS recalculate using Mifflin-St Jeor + ISSN/ANSES formulas
        // This ensures consistency and uses the latest calculation method
        const needs = calculateNutritionalNeeds(mergedProfile)
        const goals = needs ? {
          calories: needs.calories,
          proteins: needs.proteins,
          carbs: needs.carbs,
          fats: needs.fats,
        } : null
        console.log('[UserStore] Calculated goals:', goals)
        const finalProfile = { ...mergedProfile, nutritionalNeeds: needs || undefined }
        // Preserve hasSeenCoachWelcome when setting profile (important for cloud restore)
        const currentHasSeenCoachWelcome = get().hasSeenCoachWelcome
        set({
          profile: finalProfile,
          isOnboarded: profile.onboardingCompleted || false,
          nutritionGoals: goals,
          // Keep hasSeenCoachWelcome true if it was already true (don't reset on reconnect)
          hasSeenCoachWelcome: currentHasSeenCoachWelcome || false,
        })
        // Sync profile to cloud (include all fields needed by syncProfile)
        addToSyncQueue({
          type: 'profile',
          action: 'upsert',
          data: {
            profile: finalProfile,
            nutritionGoals: goals,
            notificationPrefs: get().notificationPreferences,
            hasSeenCoachWelcome: currentHasSeenCoachWelcome || false,
          },
        })
        console.log('[UserStore] Profile added to sync queue')
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
        // Sync profile to cloud (include all fields needed by syncProfile)
        addToSyncQueue({
          type: 'profile',
          action: 'upsert',
          data: {
            profile: finalProfile,
            nutritionGoals: goals,
            notificationPrefs: get().notificationPreferences,
            hasSeenCoachWelcome: get().hasSeenCoachWelcome,
          },
        })
        console.log('[UserStore] Profile update added to sync queue')
      },

      clearProfile: () => {
        // Note: On conserve hasSeenCoachWelcome pour éviter de réafficher le message de bienvenue
        // même si le profil est réinitialisé (cas de re-onboarding après inconsistent state)
        set({ profile: null, isOnboarded: false, weightHistory: [], nutritionGoals: null })
      },

      setNutritionGoals: (goals: NutritionGoals | null) => {
        console.log('[UserStore] setNutritionGoals called with:', goals)
        set({ nutritionGoals: goals })
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
        // Validate weight is in reasonable range (30-200 kg)
        // This catches unit conversion errors (pounds vs kg)
        if (entry.weight < 30 || entry.weight > 200) {
          console.warn(`[UserStore] Rejecting invalid weight entry: ${entry.weight} kg (outside 30-200 range)`)
          return
        }

        // Check for duplicate entries (same date and weight)
        const existingEntry = get().weightHistory.find(
          e => e.date.split('T')[0] === entry.date.split('T')[0] && Math.abs(e.weight - entry.weight) < 0.1
        )
        if (existingEntry) {
          console.log(`[UserStore] Skipping duplicate weight entry for ${entry.date.split('T')[0]}`)
          // Still update profile weight even if entry is duplicate
          // This ensures profile stays in sync with latest weight
          const state = get()
          if (state.profile && state.profile.weight !== entry.weight) {
            set({ profile: { ...state.profile, weight: entry.weight } })
          }
          return
        }

        set((state) => ({
          weightHistory: [...state.weightHistory, entry],
          profile: state.profile ? { ...state.profile, weight: entry.weight } : null,
        }))
      },

      // Clean up corrupted weight history (removes entries outside 30-200 kg range)
      // Also syncs profile weight with latest valid entry
      cleanWeightHistory: () => {
        const { weightHistory, profile } = get()
        const validEntries = weightHistory.filter(entry => {
          const isValid = entry.weight >= 30 && entry.weight <= 200
          if (!isValid) {
            console.log(`[UserStore] Removing invalid weight entry: ${entry.weight} kg on ${entry.date}`)
          }
          return isValid
        })

        // Sort by date to find the most recent entry
        const sortedEntries = [...validEntries].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        const latestWeight = sortedEntries[0]?.weight

        // Update state: clean history + sync profile weight
        const updates: Partial<{ weightHistory: typeof validEntries; profile: typeof profile }> = {}

        if (validEntries.length !== weightHistory.length) {
          console.log(`[UserStore] Cleaned weight history: removed ${weightHistory.length - validEntries.length} invalid entries`)
          updates.weightHistory = validEntries
        }

        // Sync profile weight with latest entry if different
        if (latestWeight && profile && profile.weight && Math.abs(profile.weight - latestWeight) > 0.1) {
          console.log(`[UserStore] Syncing profile weight: ${profile.weight} → ${latestWeight} kg`)
          updates.profile = { ...profile, weight: latestWeight }
        }

        if (Object.keys(updates).length > 0) {
          set(updates)
        }
      },

      setOnboarded: (value) => {
        set({ isOnboarded: value })
      },

      setHasSeenCoachWelcome: (value) => {
        set({ hasSeenCoachWelcome: value })
        // Sync to cloud so this persists across devices/reinstalls
        if (value) {
          const state = get()
          addToSyncQueue({
            type: 'profile',
            action: 'upsert',
            data: {
              profile: state.profile || {},
              nutritionGoals: state.nutritionGoals,
              notificationPrefs: state.notificationPreferences,
              hasSeenCoachWelcome: true,
            },
          })
        }
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

      setBlobPalette: (palette: BlobPaletteId) => {
        set({ blobPalette: palette })
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
        blobPalette: state.blobPalette,
      }),
      onRehydrateStorage: () => (state) => {
        // Set reactive hydration state in store
        useUserStore.setState({ _hasHydrated: true })
        console.log('[UserStore] Hydrated, state keys:', state ? Object.keys(state) : 'null')
        console.log('[UserStore] Hydrated, profile:', JSON.stringify(state?.profile)?.substring(0, 200))
        console.log('[UserStore] Hydrated, nutritionGoals:', JSON.stringify(state?.nutritionGoals))

        // Clean up any corrupted weight history on startup
        setTimeout(() => {
          useUserStore.getState().cleanWeightHistory()
        }, 200)

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

        // If profile exists but no goals, calculate them
        // Use state.profile directly since getState() might not have merged yet
        if (state?.profile && !state?.nutritionGoals) {
          console.log('[UserStore] 🔄 Profile found but no nutritionGoals, calculating...')
          // Small delay to ensure store is ready, then recalculate
          setTimeout(() => {
            const store = useUserStore.getState()
            if (store.profile && !store.nutritionGoals) {
              console.log('[UserStore] 🔄 Recalculating nutrition goals...')
              store.recalculateNutritionGoals()
              console.log('[UserStore] ✅ Goals calculated:', store.nutritionGoals)
            }
          }, 100)
        }
      },
    }
  )
)

export default useUserStore
