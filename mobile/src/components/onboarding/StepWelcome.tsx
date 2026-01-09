import React from 'react'
import { OnboardingHero } from './OnboardingHero'

interface StepWelcomeProps {
  onStart: () => void
  onHaveAccount?: () => void
}

/**
 * Welcome step = Single marketing screen with hero image + benefits grid
 * After this, the user goes to setup-choice to pick quick or full onboarding
 */
export function StepWelcome({ onStart, onHaveAccount }: StepWelcomeProps) {
  return (
    <OnboardingHero
      onGetStarted={onStart}
      onHaveAccount={onHaveAccount}
    />
  )
}

export default StepWelcome
