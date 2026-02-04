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
import { supabase } from '../services/supabase-client'

// ============================================================================
// MANUAL PREMIUM CHECK (via Supabase)
// ============================================================================

interface ManualPremiumStatus {
  isPremium: boolean
  planType: string | null
  expiresAt: string | null
}

/**
 * Check if user has manual premium subscription granted via admin console
 */
async function checkManualPremiumStatus(userId: string): Promise<ManualPremiumStatus> {
  try {
    console.log('[SubscriptionStore] Checking manual premium for userId:', userId)
    const { data, error } = await supabase.rpc('check_premium_status', {
      check_user_id: userId,
    })

    console.log('[SubscriptionStore] RPC response - data:', JSON.stringify(data), 'error:', error?.message)

    if (error) {
      console.log('[SubscriptionStore] Manual premium check error:', error.message)
      return { isPremium: false, planType: null, expiresAt: null }
    }

    const result = {
      isPremium: data?.isPremium || false,
      planType: data?.planType || null,
      expiresAt: data?.expiresAt || null,
    }
    console.log('[SubscriptionStore] Manual premium result:', JSON.stringify(result))
    return result
  } catch (err) {
    console.log('[SubscriptionStore] Manual premium check failed:', err)
    return { isPremium: false, planType: null, expiresAt: null }
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionState {
  // Status
  isInitialized: boolean
  isLoading: boolean
  isPremium: boolean
  isInTrial: boolean
  isManualPremium: boolean // Premium granted via admin console

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
  isManualPremium: false,
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
       * Also checks for manual premium granted via admin console
       */
      initialize: async (userId?: string) => {
        const { isInitialized } = get()

        // If already initialized, just refresh manual premium status
        if (isInitialized) {
          if (userId) {
            const manualPremium = await checkManualPremiumStatus(userId)
            if (manualPremium.isPremium) {
              console.log('[SubscriptionStore] Re-check: Manual premium detected:', manualPremium.planType)
              set({
                isPremium: true,
                isManualPremium: true
              })
            }
          }
          return
        }

        set({ isLoading: true, error: null })

        try {
          // Check manual premium status first (via Supabase admin console)
          let manualPremium: ManualPremiumStatus = { isPremium: false, planType: null, expiresAt: null }
          if (userId) {
            manualPremium = await checkManualPremiumStatus(userId)
            if (manualPremium.isPremium) {
              console.log('[SubscriptionStore] Manual premium detected:', manualPremium.planType)
            }
          }

          // Initialize RevenueCat
          await revenueCatService.initialize(userId)

          // Get subscription status from RevenueCat
          const status = await revenueCatService.getSubscriptionStatus()

          // Check if in trial
          const isInTrial = status.isInTrial || get().checkTrialStatus()

          // Premium if: RevenueCat says so, OR manual premium, OR in trial
          const isPremium = status.isPremium || manualPremium.isPremium || isInTrial

          set({
            isInitialized: true,
            isLoading: false,
            isPremium,
            isInTrial,
            isManualPremium: manualPremium.isPremium,
            status,
          })

          console.log('[SubscriptionStore] Initialized, premium:', isPremium, '(manual:', manualPremium.isPremium, ')')
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
       * Also re-checks manual premium from admin console
       */
      refreshStatus: async () => {
        set({ isLoading: true, error: null })

        try {
          // Check manual premium status
          const { data: { session } } = await supabase.auth.getSession()
          let manualPremium: ManualPremiumStatus = { isPremium: false, planType: null, expiresAt: null }
          if (session?.user?.id) {
            manualPremium = await checkManualPremiumStatus(session.user.id)
          }

          // Get RevenueCat status
          const status = await revenueCatService.getSubscriptionStatus()
          const isInTrial = status.isInTrial || get().checkTrialStatus()

          // Premium if: RevenueCat says so, OR manual premium, OR in trial
          const isPremium = status.isPremium || manualPremium.isPremium || isInTrial

          set({
            isLoading: false,
            isPremium,
            isInTrial,
            isManualPremium: manualPremium.isPremium,
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
          isManualPremium: false,
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
  const isManualPremium = useSubscriptionStore((s) => s.isManualPremium)

  if (isManualPremium) return 'Premium' // Manual premium from admin console
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
