import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { OnboardingHero } from './OnboardingHero'
import { OnboardingBenefits } from './OnboardingBenefits'

interface StepWelcomeProps {
  onStart: () => void
}

type WelcomePhase = 'hero' | 'benefits'

export function StepWelcome({ onStart }: StepWelcomeProps) {
  const [phase, setPhase] = useState<WelcomePhase>('hero')

  if (phase === 'hero') {
    return <OnboardingHero onGetStarted={() => setPhase('benefits')} />
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
