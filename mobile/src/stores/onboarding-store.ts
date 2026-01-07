/**
 * Onboarding Store - Gestion du trial 7 jours et déverrouillage progressif
 *
 * Philosophie LYM:
 * - Jour 1: Journal simple (pas de chiffres)
 * - Jour 2: Suggestions adaptées
 * - Jour 3: Anticipation douce (mini planning)
 * - Jour 4: Coach LYM (relation)
 * - Jour 5: Contextes de vie (sport/bien-être)
 * - Jour 6: Équilibre & adaptation
 * - Jour 7: Paywall (relation installée)
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  scheduleOnboardingNotifications,
  cancelOnboardingNotifications,
} from '../services/onboarding-notifications-service'

// Features déverrouillées progressivement
export type FeatureKey =
  | 'journal_simple'      // Jour 1
  | 'suggestions'         // Jour 2
  | 'anticipation'        // Jour 3
  | 'coach_lym'           // Jour 4
  | 'contextes_vie'       // Jour 5
  | 'equilibre'           // Jour 6
  | 'premium'             // Jour 7+ (abonné)

// Configuration des features par jour
export const FEATURE_UNLOCK_DAYS: Record<FeatureKey, number> = {
  journal_simple: 1,
  suggestions: 2,
  anticipation: 3,
  coach_lym: 4,
  contextes_vie: 5,
  equilibre: 6,
  premium: 7,
}

// Messages de découverte pour chaque feature (philosophie LYM)
export const FEATURE_DISCOVERY_MESSAGES: Record<FeatureKey, {
  title: string
  message: string
  icon: string
}> = {
  journal_simple: {
    title: 'Bienvenue',
    message: 'Note simplement ce que tu manges.\nLYM s\'occupe du reste.',
    icon: '📝',
  },
  suggestions: {
    title: 'LYM s\'adapte',
    message: 'LYM commence à s\'adapter à toi.\nDes suggestions personnalisées arrivent.',
    icon: '✨',
  },
  anticipation: {
    title: 'Moins de charge mentale',
    message: 'Moins de décisions à prendre.\nLYM t\'aide à anticiper en douceur.',
    icon: '🗓️',
  },
  coach_lym: {
    title: 'Ton coach personnel',
    message: 'LYM t\'accompagne, pas à pas.\nPose-lui des questions, il est là pour toi.',
    icon: '💬',
  },
  contextes_vie: {
    title: 'Ton énergie compte',
    message: 'LYM prend aussi en compte ton énergie.\nTon sport, ton bien-être, tout est lié.',
    icon: '⚡',
  },
  equilibre: {
    title: 'Intelligence invisible',
    message: 'LYM s\'adapte à ton rythme réel.\nSans pression, sans culpabilité.',
    icon: '🌿',
  },
  premium: {
    title: 'Continue avec LYM',
    message: 'LYM commence à bien te connaître.\nPour continuer cet accompagnement...',
    icon: '💜',
  },
}

// Pricing
export const SUBSCRIPTION_PRICE = 12.90
export const TRIAL_DAYS = 7

interface OnboardingState {
  // Date d'inscription (fin de l'onboarding initial)
  signupDate: string | null

  // Features déjà découvertes (tooltip affiché)
  discoveredFeatures: FeatureKey[]

  // Abonnement
  isSubscribed: boolean
  subscriptionDate: string | null
  subscriptionEndDate: string | null

  // Paywall affiché
  hasSeenPaywall: boolean

  // Actions
  setSignupDate: () => void
  getDaysSinceSignup: () => number
  isFeatureUnlocked: (feature: FeatureKey) => boolean
  getUnlockedFeatures: () => FeatureKey[]
  getNextFeatureToUnlock: () => { feature: FeatureKey; daysUntil: number } | null
  markFeatureDiscovered: (feature: FeatureKey) => void
  isFeatureDiscovered: (feature: FeatureKey) => boolean
  getNewlyUnlockedFeature: () => FeatureKey | null

  // Trial
  isTrialActive: () => boolean
  isTrialExpired: () => boolean
  getTrialDaysRemaining: () => number

  // Subscription
  subscribe: () => void
  cancelSubscription: () => void

  // Paywall
  markPaywallSeen: () => void

  // Reset (debug)
  resetOnboarding: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      signupDate: null,
      discoveredFeatures: [],
      isSubscribed: false,
      subscriptionDate: null,
      subscriptionEndDate: null,
      hasSeenPaywall: false,

      setSignupDate: () => {
        if (!get().signupDate) {
          set({ signupDate: new Date().toISOString() })
          // Schedule onboarding notifications for 7 days
          scheduleOnboardingNotifications().catch(console.error)
        }
      },

      getDaysSinceSignup: () => {
        const { signupDate } = get()
        if (!signupDate) return 0

        const signup = new Date(signupDate)
        const now = new Date()
        const diffTime = now.getTime() - signup.getTime()
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

        return Math.max(1, diffDays + 1) // Jour 1 = jour de l'inscription
      },

      isFeatureUnlocked: (feature: FeatureKey) => {
        const { isSubscribed } = get()

        // Si abonné, tout est débloqué
        if (isSubscribed) return true

        const daysSinceSignup = get().getDaysSinceSignup()
        const unlockDay = FEATURE_UNLOCK_DAYS[feature]

        // Premium nécessite abonnement
        if (feature === 'premium') return isSubscribed

        return daysSinceSignup >= unlockDay
      },

      getUnlockedFeatures: () => {
        const features: FeatureKey[] = [
          'journal_simple',
          'suggestions',
          'anticipation',
          'coach_lym',
          'contextes_vie',
          'equilibre',
        ]

        return features.filter(f => get().isFeatureUnlocked(f))
      },

      getNextFeatureToUnlock: () => {
        const daysSinceSignup = get().getDaysSinceSignup()
        const features: FeatureKey[] = [
          'suggestions',
          'anticipation',
          'coach_lym',
          'contextes_vie',
          'equilibre',
        ]

        for (const feature of features) {
          const unlockDay = FEATURE_UNLOCK_DAYS[feature]
          if (daysSinceSignup < unlockDay) {
            return {
              feature,
              daysUntil: unlockDay - daysSinceSignup,
            }
          }
        }

        return null
      },

      markFeatureDiscovered: (feature: FeatureKey) => {
        const { discoveredFeatures } = get()
        if (!discoveredFeatures.includes(feature)) {
          set({ discoveredFeatures: [...discoveredFeatures, feature] })
        }
      },

      isFeatureDiscovered: (feature: FeatureKey) => {
        return get().discoveredFeatures.includes(feature)
      },

      getNewlyUnlockedFeature: () => {
        const { discoveredFeatures, isSubscribed } = get()
        const unlockedFeatures = get().getUnlockedFeatures()

        // Trouver une feature débloquée mais pas encore découverte
        for (const feature of unlockedFeatures) {
          if (!discoveredFeatures.includes(feature)) {
            return feature
          }
        }

        return null
      },

      // Trial
      isTrialActive: () => {
        const { signupDate, isSubscribed } = get()
        if (isSubscribed) return false
        if (!signupDate) return false

        const daysSinceSignup = get().getDaysSinceSignup()
        return daysSinceSignup <= TRIAL_DAYS
      },

      isTrialExpired: () => {
        const { signupDate, isSubscribed } = get()
        if (isSubscribed) return false
        if (!signupDate) return false

        const daysSinceSignup = get().getDaysSinceSignup()
        return daysSinceSignup > TRIAL_DAYS
      },

      getTrialDaysRemaining: () => {
        const { signupDate, isSubscribed } = get()
        if (isSubscribed) return 0
        if (!signupDate) return TRIAL_DAYS

        const daysSinceSignup = get().getDaysSinceSignup()
        return Math.max(0, TRIAL_DAYS - daysSinceSignup + 1)
      },

      // Subscription
      subscribe: () => {
        const now = new Date()
        const endDate = new Date(now)
        endDate.setMonth(endDate.getMonth() + 1)

        set({
          isSubscribed: true,
          subscriptionDate: now.toISOString(),
          subscriptionEndDate: endDate.toISOString(),
        })

        // Cancel remaining onboarding notifications (user is now premium)
        cancelOnboardingNotifications().catch(console.error)
      },

      cancelSubscription: () => {
        set({
          isSubscribed: false,
          subscriptionDate: null,
          subscriptionEndDate: null,
        })
      },

      // Paywall
      markPaywallSeen: () => {
        set({ hasSeenPaywall: true })
      },

      // Reset
      resetOnboarding: () => {
        set({
          signupDate: null,
          discoveredFeatures: [],
          isSubscribed: false,
          subscriptionDate: null,
          subscriptionEndDate: null,
          hasSeenPaywall: false,
        })
      },
    }),
    {
      name: 'lym-onboarding-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
