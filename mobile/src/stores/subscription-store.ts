/**
 * Subscription Store - Zustand state management for subscriptions
 *
 * Manages subscription state across the app:
 * - Premium status
 * - Available plans
 * - Purchase flow
 * - Trial status
 * - Entitlement checks
 */

// ============================================================================
// BETA TEST MODE - Everyone gets premium for free
// Set to false to restore normal subscription behavior
// ============================================================================
const BETA_TEST_MODE = true

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  revenueCatService,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type PurchaseResult,
} from '../services/revenuecat-service'
import { analytics } from '../services/analytics-service'

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionState {
  // Status
  isInitialized: boolean
  isLoading: boolean
  isPremium: boolean
  isInTrial: boolean

  // Subscription details
  status: SubscriptionStatus | null
  plans: SubscriptionPlan[]

  // Trial tracking
  trialStartDate: string | null
  trialEndDate: string | null
  hasUsedTrial: boolean

  // Error handling
  error: string | null

  // Hydration
  _hasHydrated: boolean

  // Actions
  initialize: (userId?: string) => Promise<void>
  refreshStatus: () => Promise<void>
  fetchPlans: () => Promise<SubscriptionPlan[]>
  purchase: (plan: SubscriptionPlan) => Promise<PurchaseResult>
  restore: () => Promise<PurchaseResult>
  startTrial: () => void
  checkTrialStatus: () => boolean
  setHasHydrated: (state: boolean) => void
  reset: () => void
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  isInitialized: false,
  isLoading: false,
  isPremium: false,
  isInTrial: false,
  status: null,
  plans: [],
  trialStartDate: null,
  trialEndDate: null,
  hasUsedTrial: false,
  error: null,
  _hasHydrated: false,
}

// ============================================================================
// STORE
// ============================================================================

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * Initialize RevenueCat and fetch subscription status
       */
      initialize: async (userId?: string) => {
        const { isInitialized } = get()
        if (isInitialized) return

        set({ isLoading: true, error: null })

        try {
          // BETA TEST MODE: Everyone gets premium
          if (BETA_TEST_MODE) {
            console.log('[SubscriptionStore] BETA TEST MODE: Premium enabled for all users')
            set({
              isInitialized: true,
              isLoading: false,
              isPremium: true,
              isInTrial: true,
              status: null,
            })
            return
          }

          // Initialize RevenueCat
          await revenueCatService.initialize(userId)

          // Get subscription status
          const status = await revenueCatService.getSubscriptionStatus()

          // Check if in trial
          const isInTrial = status.isInTrial || get().checkTrialStatus()

          set({
            isInitialized: true,
            isLoading: false,
            isPremium: status.isPremium || isInTrial,
            isInTrial,
            status,
          })

          console.log('[SubscriptionStore] Initialized, premium:', status.isPremium)
        } catch (error: any) {
          console.error('[SubscriptionStore] Initialization failed:', error)
          set({
            isInitialized: true, // Mark as initialized even on error
            isLoading: false,
            error: error.message,
          })
        }
      },

      /**
       * Refresh subscription status
       */
      refreshStatus: async () => {
        // BETA TEST MODE: Everyone gets premium
        if (BETA_TEST_MODE) {
          set({ isPremium: true, isInTrial: true })
          return
        }

        set({ isLoading: true, error: null })

        try {
          const status = await revenueCatService.getSubscriptionStatus()
          const isInTrial = status.isInTrial || get().checkTrialStatus()

          set({
            isLoading: false,
            isPremium: status.isPremium || isInTrial,
            isInTrial,
            status,
          })
        } catch (error: any) {
          console.error('[SubscriptionStore] Refresh failed:', error)
          set({
            isLoading: false,
            error: error.message,
          })
        }
      },

      /**
       * Fetch available subscription plans
       */
      fetchPlans: async () => {
        set({ isLoading: true, error: null })

        try {
          const plans = await revenueCatService.getSubscriptionPlans()
          set({ plans, isLoading: false })
          return plans
        } catch (error: any) {
          console.error('[SubscriptionStore] Fetch plans failed:', error)
          set({
            isLoading: false,
            error: error.message,
          })
          return []
        }
      },

      /**
       * Purchase a subscription
       */
      purchase: async (plan: SubscriptionPlan) => {
        set({ isLoading: true, error: null })

        try {
          const result = await revenueCatService.purchase(plan)

          if (result.success) {
            // Refresh status after successful purchase
            const status = await revenueCatService.getSubscriptionStatus()

            set({
              isLoading: false,
              isPremium: true,
              isInTrial: status.isInTrial,
              status,
              hasUsedTrial: true,
            })

            // Track in analytics
            analytics.trackSubscription(
              'activated',
              plan.period as 'monthly' | 'yearly'
            )
          } else {
            set({
              isLoading: false,
              error: result.error || null,
            })
          }

          return result
        } catch (error: any) {
          console.error('[SubscriptionStore] Purchase failed:', error)
          set({
            isLoading: false,
            error: error.message,
          })
          return { success: false, error: error.message }
        }
      },

      /**
       * Restore previous purchases
       */
      restore: async () => {
        set({ isLoading: true, error: null })

        try {
          const result = await revenueCatService.restorePurchases()

          if (result.success) {
            const status = await revenueCatService.getSubscriptionStatus()

            set({
              isLoading: false,
              isPremium: true,
              isInTrial: status.isInTrial,
              status,
            })
          } else {
            set({
              isLoading: false,
              error: result.error || null,
            })
          }

          return result
        } catch (error: any) {
          console.error('[SubscriptionStore] Restore failed:', error)
          set({
            isLoading: false,
            error: error.message,
          })
          return { success: false, error: error.message }
        }
      },

      /**
       * Start local trial (7 days)
       */
      startTrial: () => {
        const { hasUsedTrial } = get()
        if (hasUsedTrial) return

        const now = new Date()
        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

        set({
          trialStartDate: now.toISOString(),
          trialEndDate: trialEnd.toISOString(),
          hasUsedTrial: true,
          isPremium: true,
          isInTrial: true,
        })

        // Track trial start
        analytics.trackSubscription('trial_started', 'monthly', 0, {
          trial_duration_days: 7,
        })

        console.log('[SubscriptionStore] Trial started, ends:', trialEnd.toISOString())
      },

      /**
       * Check if local trial is still active
       */
      checkTrialStatus: () => {
        const { trialEndDate, hasUsedTrial } = get()

        if (!hasUsedTrial || !trialEndDate) return false

        const now = new Date()
        const trialEnd = new Date(trialEndDate)

        const isActive = now < trialEnd
        return isActive
      },

      /**
       * Set hydration state
       */
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state })
      },

      /**
       * Reset store state
       */
      reset: () => {
        set({
          ...initialState,
          _hasHydrated: true,
        })
      },
    }),
    {
      name: 'lym-subscription-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist trial-related data
        trialStartDate: state.trialStartDate,
        trialEndDate: state.trialEndDate,
        hasUsedTrial: state.hasUsedTrial,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

// ============================================================================
// SELECTORS
// ============================================================================

/**
 * Check if user has access to premium features
 * Returns true if subscribed or in valid trial
 */
export const usePremiumAccess = () => {
  const isPremium = useSubscriptionStore((s) => s.isPremium)
  const isInTrial = useSubscriptionStore((s) => s.isInTrial)
  const checkTrialStatus = useSubscriptionStore((s) => s.checkTrialStatus)

  return isPremium || isInTrial || checkTrialStatus()
}

/**
 * Get trial days remaining
 */
export const useTrialDaysRemaining = () => {
  const trialEndDate = useSubscriptionStore((s) => s.trialEndDate)

  if (!trialEndDate) return 0

  const now = new Date()
  const trialEnd = new Date(trialEndDate)
  const msRemaining = trialEnd.getTime() - now.getTime()
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000))

  return Math.max(0, daysRemaining)
}

/**
 * Get subscription plan label
 */
export const useSubscriptionPlanLabel = () => {
  const status = useSubscriptionStore((s) => s.status)
  const isInTrial = useSubscriptionStore((s) => s.isInTrial)

  // BETA TEST MODE
  if (BETA_TEST_MODE) return 'Premium (Bêta)'

  if (isInTrial) return 'Essai gratuit'
  if (!status?.plan) return 'Gratuit'

  switch (status.plan) {
    case 'lym_premium_monthly':
      return 'Premium Mensuel'
    case 'lym_premium_yearly':
      return 'Premium Annuel'
    case 'lym_premium_lifetime':
      return 'Premium À Vie'
    default:
      return 'Premium'
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export default useSubscriptionStore
