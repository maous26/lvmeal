'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  OnboardingLayout,
  StepWelcome,
  StepBasicInfo,
  StepActivity,
  StepGoal,
  StepDiet,
  StepMetabolism,
  StepLifestyle,
  StepAnalysis,
} from '@/components/onboarding'
import { useUserStore, calculateNutritionalNeeds } from '@/stores/user-store'
import type { UserProfile, NutritionalNeeds } from '@/types'

type OnboardingStep = 'welcome' | 'basic-info' | 'activity' | 'goal' | 'diet' | 'metabolism' | 'lifestyle' | 'analysis'

const stepConfig: Record<OnboardingStep, { title: string; subtitle: string }> = {
  welcome: { title: '', subtitle: '' },
  'basic-info': { title: 'Parle-nous de toi', subtitle: 'Étape 1 sur 7' },
  activity: { title: 'Ton niveau d\'activité', subtitle: 'Étape 2 sur 7' },
  goal: { title: 'Quel est ton objectif ?', subtitle: 'Étape 3 sur 7' },
  diet: { title: 'Tes préférences alimentaires', subtitle: 'Étape 4 sur 7' },
  metabolism: { title: 'Mieux te connaître', subtitle: 'Étape 5 sur 7' },
  lifestyle: { title: 'Tes habitudes de vie', subtitle: 'Étape 6 sur 7' },
  analysis: { title: 'Ton programme personnalisé', subtitle: 'Étape 7 sur 7' },
}

const steps: OnboardingStep[] = ['welcome', 'basic-info', 'activity', 'goal', 'diet', 'metabolism', 'lifestyle', 'analysis']

// Wrapper for the unified calculation from user-store (with defaults for onboarding)
function calculateNeeds(profile: Partial<UserProfile>): NutritionalNeeds {
  const profileWithDefaults = {
    weight: 70,
    height: 170,
    age: 30,
    gender: 'male' as const,
    activityLevel: 'moderate' as const,
    goal: 'maintenance' as const,
    metabolismProfile: 'standard' as const,
    ...profile,
  }
  return calculateNutritionalNeeds(profileWithDefaults) || {
    calories: 2000, proteins: 100, carbs: 250, fats: 70,
    fiber: 30, water: 2.5, calcium: 1000, iron: 8,
    vitaminD: 600, vitaminC: 90, vitaminB12: 2.4, zinc: 11,
    magnesium: 400, potassium: 3500, omega3: 1.6,
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState<OnboardingStep>('welcome')
  const [profile, setProfile] = React.useState<Partial<UserProfile>>({})
  const [loading, setLoading] = React.useState(false)

  // User store for persistent profile storage
  const { setProfile: setStoreProfile, setOnboarded } = useUserStore()

  const stepIndex = steps.indexOf(currentStep)
  const config = stepConfig[currentStep]

  const canProceed = React.useMemo(() => {
    switch (currentStep) {
      case 'welcome':
        return true
      case 'basic-info':
        return !!(profile.firstName && profile.age && profile.height && profile.weight)
      case 'activity':
        return !!profile.activityLevel
      case 'goal':
        return !!profile.goal
      case 'diet':
        return !!profile.dietType
      case 'metabolism':
        // Can always proceed - questions are optional diagnostic
        return true
      case 'lifestyle':
        // Can always proceed - helps personalization
        return true
      case 'analysis':
        return true
      default:
        return false
    }
  }, [currentStep, profile])

  const handleNext = async () => {
    if (currentStep === 'analysis') {
      setLoading(true)
      // Save profile to localStorage or API
      const needs = calculateNeeds(profile)

      // Initialize sport program for adaptive profiles
      const finalProfile: Partial<UserProfile> = {
        ...profile,
        nutritionalNeeds: needs,
        onboardingCompleted: true,
      }

      // If adaptive metabolism, initialize gentle nutritional strategy
      if (profile.metabolismProfile === 'adaptive') {
        finalProfile.nutritionalStrategy = {
          approach: 'gentle',
          currentPhase: 'maintenance',
          weekInPhase: 1,
          deficitAmount: 0, // Start at maintenance
          proteinPriority: true,
          focusMetabolicHealth: true,
        }
        finalProfile.sportTrackingEnabled = true
        finalProfile.sportProgram = {
          currentPhase: 'neat_focus',
          weekInPhase: 1,
          dailyStepsGoal: 5000,
          weeklyWalkingMinutes: 60,
          resistanceSessionsPerWeek: 0,
          restDaysPerWeek: 2,
          neatActivities: ['Prendre les escaliers', 'Marcher en téléphonant', 'Se lever toutes les heures'],
        }
      }

      // Save to Zustand store (persisted) AND localStorage for backward compatibility
      setStoreProfile(finalProfile)
      setOnboarded(true)
      localStorage.setItem('userProfile', JSON.stringify(finalProfile))

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))

      setLoading(false)
      router.push('/')
      return
    }

    const nextIndex = stepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex])
    }
  }

  const handleBack = () => {
    const prevIndex = stepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex])
    }
  }

  const needs = calculateNeeds(profile)

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <StepWelcome onStart={handleNext} />
      case 'basic-info':
        return <StepBasicInfo data={profile} onChange={setProfile} />
      case 'activity':
        return <StepActivity data={profile} onChange={setProfile} />
      case 'goal':
        return <StepGoal data={profile} onChange={setProfile} />
      case 'diet':
        return <StepDiet data={profile} onChange={setProfile} />
      case 'metabolism':
        return <StepMetabolism data={profile} onChange={setProfile} />
      case 'lifestyle':
        return <StepLifestyle data={profile} onChange={setProfile} />
      case 'analysis':
        return <StepAnalysis profile={profile} needs={needs} />
      default:
        return null
    }
  }

  // Welcome step has its own layout
  if (currentStep === 'welcome') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col p-6 safe-area-inset">
        {renderStep()}
      </div>
    )
  }

  return (
    <OnboardingLayout
      step={stepIndex}
      totalSteps={steps.length - 1}
      title={config.title}
      subtitle={config.subtitle}
      onBack={stepIndex > 1 ? handleBack : undefined}
      onNext={handleNext}
      nextLabel={currentStep === 'analysis' ? 'Commencer' : 'Continuer'}
      nextDisabled={!canProceed}
      loading={loading}
      showProgress
    >
      {renderStep()}
    </OnboardingLayout>
  )
}
