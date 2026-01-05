import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { OnboardingHero } from './OnboardingHero'
import { OnboardingBenefits } from './OnboardingBenefits'

interface StepWelcomeProps {
  onStart: () => void
  onHaveAccount?: () => void
}

type WelcomePhase = 'hero' | 'benefits'

/**
 * Welcome step = Marketing screens (Hero + Benefits carousel)
 * After this, the user goes to setup-choice to pick quick or full onboarding
 */
export function StepWelcome({ onStart, onHaveAccount }: StepWelcomeProps) {
  const [phase, setPhase] = useState<WelcomePhase>('hero')

  if (phase === 'hero') {
    return (
      <OnboardingHero
        onGetStarted={() => setPhase('benefits')}
        onHaveAccount={onHaveAccount}
      />
    )
  }

  return (
    <OnboardingBenefits
      onComplete={onStart}
      onBack={() => setPhase('hero')}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})

export default StepWelcome
