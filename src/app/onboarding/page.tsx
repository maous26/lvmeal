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
  StepAnalysis,
} from '@/components/onboarding'
import type { UserProfile, NutritionalNeeds } from '@/types'

type OnboardingStep = 'welcome' | 'basic-info' | 'activity' | 'goal' | 'diet' | 'analysis'

const stepConfig: Record<OnboardingStep, { title: string; subtitle: string }> = {
  welcome: { title: '', subtitle: '' },
  'basic-info': { title: 'Parlez-nous de vous', subtitle: 'Étape 1 sur 5' },
  activity: { title: 'Votre niveau d\'activité', subtitle: 'Étape 2 sur 5' },
  goal: { title: 'Quel est votre objectif ?', subtitle: 'Étape 3 sur 5' },
  diet: { title: 'Vos préférences alimentaires', subtitle: 'Étape 4 sur 5' },
  analysis: { title: 'Votre programme personnalisé', subtitle: 'Étape 5 sur 5' },
}

const steps: OnboardingStep[] = ['welcome', 'basic-info', 'activity', 'goal', 'diet', 'analysis']

// Calculate nutritional needs based on profile
function calculateNeeds(profile: Partial<UserProfile>): NutritionalNeeds {
  const { weight = 70, height = 170, age = 30, gender = 'male', activityLevel = 'moderate', goal = 'maintenance' } = profile

  // Harris-Benedict BMR calculation
  let bmr: number
  if (gender === 'female') {
    bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)
  } else {
    bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
  }

  // Activity multiplier
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    athlete: 1.9,
  }
  const tdee = bmr * activityMultipliers[activityLevel]

  // Goal adjustment
  let calories: number
  switch (goal) {
    case 'weight_loss':
      calories = tdee - 400
      break
    case 'muscle_gain':
      calories = tdee + 300
      break
    default:
      calories = tdee
  }
  calories = Math.round(calories)

  // Macro distribution
  const proteinPerKg = goal === 'muscle_gain' ? 2.0 : goal === 'weight_loss' ? 1.8 : 1.6
  const proteins = Math.round(weight * proteinPerKg)
  const fats = Math.round((calories * 0.25) / 9)
  const carbs = Math.round((calories - (proteins * 4) - (fats * 9)) / 4)

  return {
    calories,
    proteins,
    carbs,
    fats,
    fiber: 30,
    water: 2.5,
    calcium: 1000,
    iron: gender === 'female' ? 18 : 8,
    vitaminD: 600,
    vitaminC: 90,
    vitaminB12: 2.4,
    zinc: 11,
    magnesium: 400,
    potassium: 3500,
    omega3: 1.6,
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = React.useState<OnboardingStep>('welcome')
  const [profile, setProfile] = React.useState<Partial<UserProfile>>({})
  const [loading, setLoading] = React.useState(false)

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
      localStorage.setItem('userProfile', JSON.stringify({ ...profile, nutritionalNeeds: needs, onboardingCompleted: true }))

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
