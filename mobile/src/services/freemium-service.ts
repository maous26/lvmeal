/**
 * Freemium Service - Gestion centralisee des limites Free vs Premium
 *
 * Philosophie LYM:
 * - Free: Fonctionnalites de base pour bien demarrer
 * - Trial (7j): Acces complet pour decouvrir la valeur
 * - Premium: Experience complete sans limites
 *
 * Credits IA:
 * - Trial: 15 credits (suffisant pour gouter, pas pour rester)
 * - Free: 3 credits/mois (frustrant, pousse a l'upgrade)
 * - Premium: Illimite
 */

import { useGamificationStore } from '../stores/gamification-store'
import { useOnboardingStore } from '../stores/onboarding-store'

// ============= CONFIGURATION FREEMIUM =============

export type FeatureAccess = 'free' | 'trial' | 'premium'

export interface FeatureConfig {
  id: string
  name: string
  description: string
  access: FeatureAccess
  aiCredits?: number  // Cout en credits IA (0 = pas de credit necessaire)
}

// Definition des features et leur acces
export const FEATURES: Record<string, FeatureConfig> = {
  // ===== FREE FOREVER =====
  meal_tracking: {
    id: 'meal_tracking',
    name: 'Suivi des repas',
    description: 'Ajouter et suivre tes repas manuellement',
    access: 'free',
    aiCredits: 0,
  },
  nutrition_goals: {
    id: 'nutrition_goals',
    name: 'Objectifs nutrition',
    description: 'Objectifs calories et macros personnalises',
    access: 'free',
    aiCredits: 0,
  },
  food_search: {
    id: 'food_search',
    name: 'Recherche aliments',
    description: 'Base CIQUAL + recherche manuelle',
    access: 'free',
    aiCredits: 0,
  },
  basic_stats: {
    id: 'basic_stats',
    name: 'Statistiques de base',
    description: 'Historique 7 jours et tendances simples',
    access: 'free',
    aiCredits: 0,
  },
  weight_tracking: {
    id: 'weight_tracking',
    name: 'Suivi du poids',
    description: 'Courbe de poids et historique',
    access: 'free',
    aiCredits: 0,
  },
  fasting_tracking: {
    id: 'fasting_tracking',
    name: 'Suivi jeune intermittent',
    description: 'Timer et rappels de fenetre alimentaire',
    access: 'free',
    aiCredits: 0,
  },

  // ===== TRIAL + PREMIUM (consomme credits) =====
  ai_meal_generator: {
    id: 'ai_meal_generator',
    name: 'Generateur repas IA',
    description: 'Suggestions de repas personnalises par IA',
    access: 'trial',
    aiCredits: 1,
  },
  photo_scanner: {
    id: 'photo_scanner',
    name: 'Scanner photo',
    description: 'Analyse nutritionnelle par photo',
    access: 'trial',
    aiCredits: 1,
  },
  voice_input: {
    id: 'voice_input',
    name: 'Saisie vocale',
    description: 'Ajouter repas par la voix',
    access: 'trial',
    aiCredits: 1,
  },
  coach_insights: {
    id: 'coach_insights',
    name: 'Insights Coach',
    description: 'Conseils quotidiens personnalises',
    access: 'trial',
    aiCredits: 1,
  },
  weekly_plan: {
    id: 'weekly_plan',
    name: 'Plan semaine',
    description: 'Generation plan repas 7 jours',
    access: 'trial',
    aiCredits: 1,
  },
  behavior_analysis: {
    id: 'behavior_analysis',
    name: 'Analyse comportementale',
    description: 'Analyse approfondie de tes habitudes',
    access: 'trial',
    aiCredits: 2,
  },

  // ===== PREMIUM ONLY =====
  unlimited_ai: {
    id: 'unlimited_ai',
    name: 'IA illimitee',
    description: 'Acces illimite a toutes les fonctions IA',
    access: 'premium',
    aiCredits: 0,  // Premium = pas de limite
  },
  advanced_stats: {
    id: 'advanced_stats',
    name: 'Statistiques avancees',
    description: 'Tendances 30j, comparaisons, predictions',
    access: 'premium',
    aiCredits: 0,
  },
  custom_recipes: {
    id: 'custom_recipes',
    name: 'Recettes personnalisees',
    description: 'Creer et sauvegarder tes propres recettes',
    access: 'premium',
    aiCredits: 0,
  },
  export_data: {
    id: 'export_data',
    name: 'Export donnees',
    description: 'Exporter tes donnees en CSV/PDF',
    access: 'premium',
    aiCredits: 0,
  },
  priority_support: {
    id: 'priority_support',
    name: 'Support prioritaire',
    description: 'Reponse rapide a tes questions',
    access: 'premium',
    aiCredits: 0,
  },
}

// ============= SERVICE =============

class FreemiumService {
  /**
   * Verifie si l'utilisateur a acces a une feature
   */
  hasAccess(featureId: string): boolean {
    const feature = FEATURES[featureId]
    if (!feature) return false

    const gamification = useGamificationStore.getState()
    const onboarding = useOnboardingStore.getState()

    // Premium = tout acces
    if (gamification.isPremium || onboarding.isSubscribed) {
      return true
    }

    // Free features = toujours accessibles
    if (feature.access === 'free') {
      return true
    }

    // Trial features = accessibles pendant le trial
    if (feature.access === 'trial') {
      if (gamification.isInTrialPeriod()) {
        return true
      }
      // Apres trial: besoin de credits IA
      if (feature.aiCredits && feature.aiCredits > 0) {
        return gamification.getAICreditsRemaining() >= feature.aiCredits
      }
      return false
    }

    // Premium features = uniquement pour abonnes
    return false
  }

  /**
   * Verifie si l'utilisateur peut utiliser une feature IA (avec credits)
   * Retourne { allowed, reason, creditsNeeded, creditsRemaining }
   */
  canUseAIFeature(featureId: string): {
    allowed: boolean
    reason?: string
    creditsNeeded: number
    creditsRemaining: number
    isPremium: boolean
  } {
    const feature = FEATURES[featureId]
    const gamification = useGamificationStore.getState()
    const onboarding = useOnboardingStore.getState()

    const isPremium = gamification.isPremium || onboarding.isSubscribed
    const creditsRemaining = gamification.getAICreditsRemaining()
    const creditsNeeded = feature?.aiCredits || 0

    // Premium = toujours autorise
    if (isPremium) {
      return {
        allowed: true,
        creditsNeeded: 0,
        creditsRemaining: 999,
        isPremium: true,
      }
    }

    // Pas de credits necessaires
    if (creditsNeeded === 0) {
      return {
        allowed: true,
        creditsNeeded: 0,
        creditsRemaining,
        isPremium: false,
      }
    }

    // Verifier les credits
    if (creditsRemaining >= creditsNeeded) {
      return {
        allowed: true,
        creditsNeeded,
        creditsRemaining,
        isPremium: false,
      }
    }

    // Pas assez de credits
    const inTrial = gamification.isInTrialPeriod()
    const trialDays = gamification.getTrialDaysRemaining()

    let reason: string
    if (inTrial && trialDays > 0) {
      reason = `Plus que ${creditsRemaining} credits. Passe a Premium pour un acces illimite.`
    } else if (!inTrial) {
      reason = `Tu as utilise tes ${3} credits du mois. Passe a Premium pour continuer.`
    } else {
      reason = 'Credits epuises. Passe a Premium pour un acces illimite a l\'IA.'
    }

    return {
      allowed: false,
      reason,
      creditsNeeded,
      creditsRemaining,
      isPremium: false,
    }
  }

  /**
   * Consomme des credits IA pour une feature
   */
  consumeCredits(featureId: string): boolean {
    const feature = FEATURES[featureId]
    if (!feature || !feature.aiCredits) return true

    const gamification = useGamificationStore.getState()

    // Premium = pas de consommation
    if (gamification.isPremium) return true

    // Consommer les credits
    for (let i = 0; i < feature.aiCredits; i++) {
      if (!gamification.useAICredit()) {
        return false
      }
    }
    return true
  }

  /**
   * Retourne le statut complet de l'utilisateur
   */
  getUserStatus(): {
    tier: 'free' | 'trial' | 'premium'
    creditsRemaining: number
    creditsTotal: number
    trialDaysRemaining: number
    isTrialActive: boolean
    isPremium: boolean
  } {
    const gamification = useGamificationStore.getState()
    const onboarding = useOnboardingStore.getState()

    const isPremium = gamification.isPremium || onboarding.isSubscribed
    const isTrialActive = gamification.isInTrialPeriod()
    const trialDaysRemaining = gamification.getTrialDaysRemaining()
    const creditsRemaining = gamification.getAICreditsRemaining()

    let tier: 'free' | 'trial' | 'premium'
    let creditsTotal: number

    if (isPremium) {
      tier = 'premium'
      creditsTotal = 999
    } else if (isTrialActive) {
      tier = 'trial'
      creditsTotal = 15
    } else {
      tier = 'free'
      creditsTotal = 3
    }

    return {
      tier,
      creditsRemaining,
      creditsTotal,
      trialDaysRemaining,
      isTrialActive,
      isPremium,
    }
  }

  /**
   * Retourne la liste des features par niveau d'acces
   */
  getFeaturesByAccess(): {
    free: FeatureConfig[]
    trial: FeatureConfig[]
    premium: FeatureConfig[]
  } {
    const free: FeatureConfig[] = []
    const trial: FeatureConfig[] = []
    const premium: FeatureConfig[] = []

    for (const feature of Object.values(FEATURES)) {
      switch (feature.access) {
        case 'free':
          free.push(feature)
          break
        case 'trial':
          trial.push(feature)
          break
        case 'premium':
          premium.push(feature)
          break
      }
    }

    return { free, trial, premium }
  }

  /**
   * Retourne les features accessibles a l'utilisateur
   */
  getAccessibleFeatures(): FeatureConfig[] {
    return Object.values(FEATURES).filter(f => this.hasAccess(f.id))
  }

  /**
   * Retourne les features verrouillees pour l'utilisateur
   */
  getLockedFeatures(): FeatureConfig[] {
    return Object.values(FEATURES).filter(f => !this.hasAccess(f.id))
  }
}

// Export singleton
export const freemiumService = new FreemiumService()

// Export pour usage direct
export default freemiumService
