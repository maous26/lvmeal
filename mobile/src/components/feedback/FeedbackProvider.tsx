/**
 * FeedbackProvider - Provider global pour le bouton de feedback
 *
 * Wrap l'app pour afficher le bouton flottant sur tous les écrans.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { FeedbackButton } from './FeedbackButton'

interface FeedbackContextType {
  /** Masquer temporairement le bouton (ex: pendant onboarding) */
  hideFeedbackButton: () => void
  /** Réafficher le bouton */
  showFeedbackButton: () => void
  /** État de visibilité */
  isVisible: boolean
}

const FeedbackContext = createContext<FeedbackContextType>({
  hideFeedbackButton: () => {},
  showFeedbackButton: () => {},
  isVisible: true,
})

export function useFeedback() {
  return useContext(FeedbackContext)
}

interface FeedbackProviderProps {
  children: ReactNode
  /** Position du bouton (bottom offset en plus du safe area) */
  bottomOffset?: number
  /** Masquer par défaut (ex: pendant onboarding) */
  initiallyHidden?: boolean
}

export function FeedbackProvider({
  children,
  bottomOffset = 100,
  initiallyHidden = false,
}: FeedbackProviderProps) {
  const [isVisible, setIsVisible] = useState(!initiallyHidden)

  const hideFeedbackButton = () => setIsVisible(false)
  const showFeedbackButton = () => setIsVisible(true)

  return (
    <FeedbackContext.Provider value={{ hideFeedbackButton, showFeedbackButton, isVisible }}>
      {children}
      {isVisible && <FeedbackButton bottomOffset={bottomOffset} />}
    </FeedbackContext.Provider>
  )
}

export default FeedbackProvider
