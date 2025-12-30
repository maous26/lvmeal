/**
 * Hook pour gérer le déverrouillage progressif des features
 *
 * Utilisation:
 * const { isUnlocked, showDiscovery, markDiscovered } = useFeatureUnlock('coach_lym')
 */

import { useCallback, useEffect, useState } from 'react'
import { useOnboardingStore, FeatureKey, FEATURE_DISCOVERY_MESSAGES } from '../stores/onboarding-store'

interface UseFeatureUnlockReturn {
  // La feature est-elle débloquée?
  isUnlocked: boolean

  // Faut-il afficher le modal de découverte?
  showDiscovery: boolean

  // Infos de la feature
  featureInfo: typeof FEATURE_DISCOVERY_MESSAGES[FeatureKey]

  // Marquer comme découverte (fermer le modal)
  markDiscovered: () => void

  // Jours restants avant déverrouillage (si locked)
  daysUntilUnlock: number | null

  // Trial info
  isTrialActive: boolean
  trialDaysRemaining: number
  isTrialExpired: boolean

  // Subscription
  isSubscribed: boolean
}

export function useFeatureUnlock(feature: FeatureKey): UseFeatureUnlockReturn {
  const {
    isFeatureUnlocked,
    isFeatureDiscovered,
    markFeatureDiscovered,
    getNextFeatureToUnlock,
    isTrialActive,
    getTrialDaysRemaining,
    isTrialExpired,
    isSubscribed,
  } = useOnboardingStore()

  const [showDiscovery, setShowDiscovery] = useState(false)

  const isUnlocked = isFeatureUnlocked(feature)
  const isDiscovered = isFeatureDiscovered(feature)
  const featureInfo = FEATURE_DISCOVERY_MESSAGES[feature]

  // Calculer les jours restants
  const nextFeature = getNextFeatureToUnlock()
  const daysUntilUnlock = nextFeature?.feature === feature ? nextFeature.daysUntil : null

  // Afficher le modal si feature débloquée mais pas encore découverte
  useEffect(() => {
    if (isUnlocked && !isDiscovered) {
      // Petit délai pour une meilleure UX
      const timer = setTimeout(() => {
        setShowDiscovery(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isUnlocked, isDiscovered])

  const markDiscovered = useCallback(() => {
    markFeatureDiscovered(feature)
    setShowDiscovery(false)
  }, [feature, markFeatureDiscovered])

  return {
    isUnlocked,
    showDiscovery,
    featureInfo,
    markDiscovered,
    daysUntilUnlock,
    isTrialActive: isTrialActive(),
    trialDaysRemaining: getTrialDaysRemaining(),
    isTrialExpired: isTrialExpired(),
    isSubscribed,
  }
}

/**
 * Hook pour vérifier si une feature doit afficher un "lock" overlay
 */
export function useFeatureLock(feature: FeatureKey) {
  const { isFeatureUnlocked, isSubscribed, isTrialExpired } = useOnboardingStore()

  const isUnlocked = isFeatureUnlocked(feature)
  const trialExpired = isTrialExpired()

  // Si trial expiré et non abonné, tout est locké sauf journal_simple
  const isLocked = !isUnlocked || (trialExpired && !isSubscribed && feature !== 'journal_simple')

  return {
    isLocked,
    isSubscribed,
    isTrialExpired: trialExpired,
  }
}

/**
 * Hook pour récupérer la prochaine feature à débloquer
 */
export function useNextFeature() {
  const { getNextFeatureToUnlock, getDaysSinceSignup } = useOnboardingStore()

  const nextFeature = getNextFeatureToUnlock()
  const currentDay = getDaysSinceSignup()

  if (!nextFeature) return null

  return {
    ...nextFeature,
    info: FEATURE_DISCOVERY_MESSAGES[nextFeature.feature],
    currentDay,
  }
}

/**
 * Hook pour la logique du paywall
 */
export function usePaywall() {
  const {
    isSubscribed,
    isTrialExpired,
    getTrialDaysRemaining,
    getDaysSinceSignup,
    hasSeenPaywall,
    markPaywallSeen,
    subscribe,
  } = useOnboardingStore()

  const trialExpired = isTrialExpired()
  const trialDaysRemaining = getTrialDaysRemaining()
  const daysSinceSignup = getDaysSinceSignup()

  // Afficher le paywall si:
  // - Trial expiré ET non abonné
  // - OU Jour 7+ et jamais vu le paywall
  const shouldShowPaywall =
    (trialExpired && !isSubscribed) ||
    (daysSinceSignup >= 7 && !hasSeenPaywall && !isSubscribed)

  return {
    shouldShowPaywall,
    isSubscribed,
    trialDaysRemaining,
    daysSinceSignup,
    hasSeenPaywall,
    markPaywallSeen,
    subscribe,
  }
}
