import React, { useState, useMemo, useCallback } from 'react'
import { View, StyleSheet, SafeAreaView } from 'react-native'
import {
  OnboardingLayout,
  StepWelcome,
  StepBasicInfo,
  StepGoal,
  StepActivity,
  StepDiet,
  StepCooking,
  StepLifestyle,
  StepMetabolism,
  StepSportInitiation,
  StepMetabolicProgram,
  StepWellnessProgram,
  StepAnalysis,
} from '../components/onboarding'
import { useSportInitiationStore } from '../stores/sport-initiation-store'
import { useMetabolicBoostStore } from '../stores/metabolic-boost-store'
import { useWellnessProgramStore } from '../stores/wellness-program-store'
import { useUserStore } from '../stores/user-store'
import { colors } from '../constants/theme'
import type { UserProfile, NutritionalNeeds } from '../types'

type OnboardingStep = 'welcome' | 'basic-info' | 'activity' | 'sport-initiation' | 'goal' | 'diet' | 'cooking' | 'metabolism' | 'metabolic-program' | 'wellness-program' | 'lifestyle' | 'analysis'

const stepConfig: Record<OnboardingStep, { title: string; subtitle: string }> = {
  welcome: { title: '', subtitle: '' },
  'basic-info': { title: 'Parlez-nous de vous', subtitle: 'Etape 1' },
  activity: { title: "Votre niveau d'activite", subtitle: 'Etape 2' },
  'sport-initiation': { title: 'Reprendre le sport', subtitle: 'Programme Sport' },
  goal: { title: 'Quel est votre objectif ?', subtitle: 'Etape 3' },
  diet: { title: 'Vos preferences alimentaires', subtitle: 'Etape 4' },
  cooking: { title: 'En cuisine', subtitle: 'Etape 5' },
  metabolism: { title: 'Mieux te connaitre', subtitle: 'Etape 6' },
  'metabolic-program': { title: 'Programme Metabolisme', subtitle: 'Programme personnalise' },
  'wellness-program': { title: 'Programme Bien-etre', subtitle: 'Programme personnalise' },
  lifestyle: { title: 'Tes habitudes de vie', subtitle: 'Etape 7' },
  analysis: { title: 'Ton programme personnalise', subtitle: 'Resume' },
}

// Base steps - conditional steps are inserted dynamically
const baseSteps: OnboardingStep[] = ['welcome', 'basic-info', 'activity', 'goal', 'diet', 'cooking', 'metabolism', 'lifestyle', 'analysis']

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

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [profile, setProfile] = useState<Partial<UserProfile>>({})
  const [loading, setLoading] = useState(false)

  // User store for persistent profile storage
  const { setProfile: setStoreProfile, setOnboarded } = useUserStore()
  const { enroll: enrollSportInitiation } = useSportInitiationStore()

  // Program stores for enrollment
  const { enroll: enrollMetabolicBoost } = useMetabolicBoostStore()
  const { enroll: enrollWellnessProgram } = useWellnessProgramStore()

  // Build steps dynamically based on user profile
  // PRIORITY ORDER:
  // 1. metabolic-program: FIRST if user has adaptive metabolism (after metabolism step)
  // 2. sport-initiation: after metabolic-program IF user refused metabolic AND is sedentary
  //    OR directly after activity if no metabolic issues
  // 3. wellness-program: if user refused metabolic program
  const steps = useMemo(() => {
    let dynamicSteps = [...baseSteps]

    // 1. If adaptive metabolism detected, propose Metabolic Program FIRST (after metabolism step)
    if (profile.metabolismProfile === 'adaptive') {
      const metabolismIndex = dynamicSteps.indexOf('metabolism') + 1
      dynamicSteps = [...dynamicSteps.slice(0, metabolismIndex), 'metabolic-program' as OnboardingStep, ...dynamicSteps.slice(metabolismIndex)]
    }

    // 2. Insert sport-initiation for sedentary users
    //    - If user has adaptive metabolism: only show if they REFUSED metabolic program
    //    - If user doesn't have adaptive metabolism: show after activity step
    if (profile.activityLevel === 'sedentary') {
      if (profile.metabolismProfile === 'adaptive') {
        // User has metabolism issues - only propose sport if they refused metabolic
        if (profile.wantsMetabolicProgram === false) {
          const metabolicProgramIndex = dynamicSteps.indexOf('metabolic-program')
          if (metabolicProgramIndex !== -1) {
            dynamicSteps = [...dynamicSteps.slice(0, metabolicProgramIndex + 1), 'sport-initiation' as OnboardingStep, ...dynamicSteps.slice(metabolicProgramIndex + 1)]
          }
        }
      } else {
        // No metabolism issues - propose sport directly after activity
        const activityIndex = dynamicSteps.indexOf('activity') + 1
        dynamicSteps = [...dynamicSteps.slice(0, activityIndex), 'sport-initiation' as OnboardingStep, ...dynamicSteps.slice(activityIndex)]
      }
    }

    // 3. Insert wellness-program if user refused metabolic program
    //    Wellness comes after sport-initiation if present, otherwise after metabolic-program
    if (profile.metabolismProfile === 'adaptive' && profile.wantsMetabolicProgram === false) {
      // Find the right insertion point (after sport-initiation if present, otherwise after metabolic-program)
      const sportIndex = dynamicSteps.indexOf('sport-initiation')
      const metabolicIndex = dynamicSteps.indexOf('metabolic-program')
      const insertAfter = sportIndex !== -1 ? sportIndex : metabolicIndex

      if (insertAfter !== -1) {
        dynamicSteps = [...dynamicSteps.slice(0, insertAfter + 1), 'wellness-program' as OnboardingStep, ...dynamicSteps.slice(insertAfter + 1)]
      }
    }

    return dynamicSteps
  }, [profile.activityLevel, profile.metabolismProfile, profile.wantsMetabolicProgram])

  const stepIndex = steps.indexOf(currentStep)
  const config = stepConfig[currentStep]

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 'welcome':
        return true
      case 'basic-info':
        return !!(profile.firstName && profile.age && profile.height && profile.weight)
      case 'activity':
        return !!profile.activityLevel
      case 'sport-initiation':
        // Must make a choice (yes or no)
        return profile.wantsSportInitiation !== undefined
      case 'goal':
        return !!profile.goal
      case 'diet':
        return !!profile.dietType
      case 'cooking':
        // Can always proceed - defaults are fine
        return true
      case 'metabolism':
        // Can always proceed - questions are optional diagnostic
        return true
      case 'metabolic-program':
        // Must make a choice (yes or no)
        return profile.wantsMetabolicProgram !== undefined
      case 'wellness-program':
        // Must make a choice (yes or no)
        return profile.wantsWellnessProgram !== undefined
      case 'lifestyle':
        // Can always proceed - helps personalization
        return true
      case 'analysis':
        return true
      default:
        return false
    }
  }, [currentStep, profile])

  const handleNext = useCallback(async () => {
    if (currentStep === 'analysis') {
      setLoading(true)
      // Save profile
      const needs = calculateNeeds(profile)

      // Initialize sport program for adaptive profiles
      const finalProfile: Partial<UserProfile> = {
        ...profile,
        nutritionalNeeds: needs,
        onboardingCompleted: true,
      }

      // If adaptive metabolism, initialize progressive nutritional strategy
      if (profile.metabolismProfile === 'adaptive') {
        finalProfile.nutritionalStrategy = {
          approach: 'progressive', // Start with progressive for adaptive metabolism
          currentPhase: 'maintenance',
          weekInPhase: 1,
          deficitAmount: 0, // Start at maintenance
          proteinPriority: true,
          focusMetabolicHealth: true,
        }
        finalProfile.sportTrackingEnabled = true
        // sportProgram will be generated by the sport store when starting
      }

      // If user wants sport initiation program, enroll them
      // Note: Sport blocks Metabolic program
      if (profile.wantsSportInitiation) {
        finalProfile.sportInitiationActive = true
        enrollSportInitiation({
          fitnessLevel: 'sedentary',
          hasHealthConditions: false,
          preferredActivities: ['walking', 'stretching'],
          availableMinutesPerDay: 15,
        })
      }

      // If user wants metabolic boost program, enroll them
      // Note: Metabolic blocks both Sport and Wellness
      if (profile.wantsMetabolicProgram) {
        finalProfile.metabolicProgramActive = true
        enrollMetabolicBoost()
      }

      // If user wants wellness program, enroll them
      // Note: Wellness blocks Metabolic only (can be combined with Sport)
      if (profile.wantsWellnessProgram) {
        finalProfile.wellnessProgramActive = true
        enrollWellnessProgram()
      }

      // Save to Zustand store (persisted via AsyncStorage)
      setStoreProfile(finalProfile)
      setOnboarded(true)

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))

      setLoading(false)
      onComplete()
      return
    }

    const nextIndex = stepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex])
    }
  }, [currentStep, stepIndex, steps, profile, setStoreProfile, setOnboarded, enrollSportInitiation, enrollMetabolicBoost, enrollWellnessProgram, onComplete])

  const handleBack = useCallback(() => {
    const prevIndex = stepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex])
    }
  }, [stepIndex, steps])

  const needs = useMemo(() => calculateNeeds(profile), [profile])

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <StepWelcome onStart={handleNext} />
      case 'basic-info':
        return <StepBasicInfo data={profile} onChange={setProfile} />
      case 'activity':
        return <StepActivity data={profile} onChange={setProfile} />
      case 'sport-initiation':
        return <StepSportInitiation data={profile} onChange={setProfile} />
      case 'goal':
        return <StepGoal data={profile} onChange={setProfile} />
      case 'diet':
        return <StepDiet data={profile} onChange={setProfile} />
      case 'cooking':
        return <StepCooking data={profile} onChange={setProfile} />
      case 'metabolism':
        return <StepMetabolism data={profile} onChange={setProfile} />
      case 'metabolic-program':
        return <StepMetabolicProgram data={profile} onChange={setProfile} />
      case 'wellness-program':
        return <StepWellnessProgram data={profile} onChange={setProfile} />
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
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContent}>
          {renderStep()}
        </View>
      </SafeAreaView>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  welcomeContent: {
    flex: 1,
    padding: 24,
  },
})

export default OnboardingScreen
