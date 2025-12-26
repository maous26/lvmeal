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
import { useUserStore } from '@/stores/user-store'
import type { UserProfile, NutritionalNeeds } from '@/types'

type OnboardingStep = 'welcome' | 'basic-info' | 'activity' | 'goal' | 'diet' | 'metabolism' | 'lifestyle' | 'analysis'

const stepConfig: Record<OnboardingStep, { title: string; subtitle: string }> = {
  welcome: { title: '', subtitle: '' },
  'basic-info': { title: 'Parlez-nous de vous', subtitle: 'Étape 1 sur 7' },
  activity: { title: 'Votre niveau d\'activité', subtitle: 'Étape 2 sur 7' },
  goal: { title: 'Quel est votre objectif ?', subtitle: 'Étape 3 sur 7' },
  diet: { title: 'Vos préférences alimentaires', subtitle: 'Étape 4 sur 7' },
  metabolism: { title: 'Mieux te connaître', subtitle: 'Étape 5 sur 7' },
  lifestyle: { title: 'Tes habitudes de vie', subtitle: 'Étape 6 sur 7' },
  analysis: { title: 'Ton programme personnalisé', subtitle: 'Étape 7 sur 7' },
}

const steps: OnboardingStep[] = ['welcome', 'basic-info', 'activity', 'goal', 'diet', 'metabolism', 'lifestyle', 'analysis']

// Calculate nutritional needs based on profile (with adaptive metabolism support)
function calculateNeeds(profile: Partial<UserProfile>): NutritionalNeeds {
  const {
    weight = 70,
    height = 170,
    age = 30,
    gender = 'male',
    activityLevel = 'moderate',
    goal = 'maintenance',
    metabolismProfile = 'standard'
  } = profile

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

  // Goal adjustment - ADAPTIVE METABOLISM GETS GENTLER APPROACH
  let calories: number

  if (metabolismProfile === 'adaptive') {
    // For adaptive metabolism: start at maintenance or very gentle deficit
    switch (goal) {
      case 'weight_loss':
        // Maximum 100-200 kcal deficit for adaptive profiles (vs 400 for standard)
        calories = tdee - 100
        break
      case 'muscle_gain':
        calories = tdee + 200
        break
      default:
        calories = tdee
    }
  } else {
    // Standard approach
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
  }
  calories = Math.round(calories)

  // Macro distribution - ADAPTIVE GETS HIGHER PROTEIN & FAT
  let proteinPerKg: number
  let fatPercentage: number

  if (metabolismProfile === 'adaptive') {
    // Higher protein for metabolic health
    proteinPerKg = 2.0
    // Higher fat for hormonal balance (30%)
    fatPercentage = 0.30
  } else {
    proteinPerKg = goal === 'muscle_gain' ? 2.0 : goal === 'weight_loss' ? 1.8 : 1.6
    fatPercentage = 0.25
  }

  const proteins = Math.round(weight * proteinPerKg)
  const fats = Math.round((calories * fatPercentage) / 9)
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
