/**
 * useAICredits Hook - Gestion des credits IA pour les features freemium
 *
 * Utilisation:
 * const { canUse, checkAndConsume, showExhaustedModal, ExhaustedModal } = useAICredits('photo_scanner')
 */

import { useState, useCallback } from 'react'
import { freemiumService } from '../services/freemium-service'
import { CreditsExhaustedModal } from '../components/CreditsExhaustedModal'

type AIFeatureId =
  | 'ai_meal_generator'
  | 'photo_scanner'
  | 'voice_input'
  | 'coach_insights'
  | 'weekly_plan'
  | 'behavior_analysis'

interface UseAICreditsResult {
  /** Verifie si l'utilisateur peut utiliser la feature (a assez de credits) */
  canUse: boolean
  /** Credits restants */
  creditsRemaining: number
  /** Est-ce un utilisateur Premium */
  isPremium: boolean
  /** Raison si non autorise */
  reason?: string
  /** Verifie les credits et consomme si autorise. Retourne true si OK */
  checkAndConsume: () => boolean
  /** Affiche le modal "credits epuises" */
  showExhaustedModal: boolean
  /** Fonction pour fermer le modal */
  closeExhaustedModal: () => void
  /** Nom de la feature pour le modal */
  featureName: string
}

const FEATURE_NAMES: Record<AIFeatureId, string> = {
  ai_meal_generator: 'le generateur de repas',
  photo_scanner: 'le scanner photo',
  voice_input: 'la saisie vocale',
  coach_insights: 'les conseils du coach',
  weekly_plan: 'le plan semaine',
  behavior_analysis: 'l\'analyse comportementale',
}

export function useAICredits(featureId: AIFeatureId): UseAICreditsResult {
  const [showExhaustedModal, setShowExhaustedModal] = useState(false)

  const status = freemiumService.canUseAIFeature(featureId)
  const featureName = FEATURE_NAMES[featureId]

  const checkAndConsume = useCallback((): boolean => {
    const currentStatus = freemiumService.canUseAIFeature(featureId)

    if (!currentStatus.allowed) {
      // Pas assez de credits, afficher le modal
      setShowExhaustedModal(true)
      return false
    }

    // Consommer les credits
    const consumed = freemiumService.consumeCredits(featureId)
    if (!consumed) {
      setShowExhaustedModal(true)
      return false
    }

    return true
  }, [featureId])

  const closeExhaustedModal = useCallback(() => {
    setShowExhaustedModal(false)
  }, [])

  return {
    canUse: status.allowed,
    creditsRemaining: status.creditsRemaining,
    isPremium: status.isPremium,
    reason: status.reason,
    checkAndConsume,
    showExhaustedModal,
    closeExhaustedModal,
    featureName,
  }
}

export default useAICredits
