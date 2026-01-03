import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { View, StyleSheet, SafeAreaView } from 'react-native'
import Constants from 'expo-constants'
import {
  OnboardingLayout,
  StepWelcome,
  StepSetupChoice,
  StepBasicInfo,
  StepGoal,
  StepActivity,
  StepDiet,
  StepCooking,
  StepLifestyle,
  StepMetabolism,
  StepMetabolicProgram,
  StepWellnessProgram,
  StepAnalysis,
  StepQuickSetup,
  StepCloudSync,
} from '../components/onboarding'
import { useMetabolicBoostStore } from '../stores/metabolic-boost-store'
import { useWellnessProgramStore } from '../stores/wellness-program-store'
import { useUserStore } from '../stores/user-store'
import { useOnboardingStore } from '../stores/onboarding-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useTheme } from '../contexts/ThemeContext'
import { lymInsights } from '../services/lym-insights-service'
import type { UserProfile, NutritionalNeeds } from '../types'

type OnboardingStep = 'welcome' | 'setup-choice' | 'quick-setup' | 'basic-info' | 'activity' | 'goal' | 'diet' | 'cooking' | 'metabolism' | 'metabolic-program' | 'wellness-program' | 'lifestyle' | 'analysis' | 'cloud-sync'

const stepConfig: Record<OnboardingStep, { title: string; subtitle: string; valueProposition?: string }> = {
  welcome: { title: '', subtitle: '' },
  'setup-choice': { title: '', subtitle: '' }, // Has its own layout
  'quick-setup': { title: '', subtitle: '' }, // Has its own layout
  'basic-info': {
    title: 'Faisons connaissance',
    subtitle: 'TON PROFIL',
    valueProposition: "Ces infos permettent de calculer précisément tes besoins caloriques et de personnaliser tes recommandations.",
  },
  activity: {
    title: 'Comment tu bouges ?',
    subtitle: 'TON ACTIVITÉ',
    valueProposition: "Ton niveau d'activité influence directement tes besoins énergétiques. On adapte tout à ton rythme de vie réel.",
  },
  goal: {
    title: 'Ton objectif principal',
    subtitle: 'TA MOTIVATION',
    valueProposition: "Chaque objectif a sa stratégie. On adapte les conseils et les macros pour t'aider à y arriver.",
  },
  diet: {
    title: 'Comment tu manges ?',
    subtitle: 'TES PRÉFÉRENCES',
    valueProposition: "Pour te proposer des recettes et conseils qui correspondent vraiment à ton mode d'alimentation.",
  },
  cooking: {
    title: 'Et en cuisine ?',
    subtitle: 'TON STYLE',
    valueProposition: "On adapte les recettes à ton niveau et au temps dont tu disposes. Pas de pression !",
  },
  metabolism: {
    title: 'Ton historique alimentaire',
    subtitle: 'MIEUX TE COMPRENDRE',
    valueProposition: "Ces questions nous aident à détecter si tu as besoin d'une approche plus douce. Zéro jugement, que de la bienveillance.",
  },
  'metabolic-program': {
    title: 'Programme Métabolique',
    subtitle: 'SPÉCIALEMENT POUR TOI',
    valueProposition: "Un accompagnement sur-mesure pour réparer ton métabolisme en douceur et retrouver une relation saine avec la nourriture.",
  },
  'wellness-program': {
    title: 'Programme Bien-être',
    subtitle: 'PRENDS SOIN DE TOI',
    valueProposition: "Sommeil, stress, hydratation... Parce que bien manger, c'est aussi bien vivre.",
  },
  lifestyle: {
    title: 'Tes habitudes de vie',
    subtitle: 'TON ÉQUILIBRE',
    valueProposition: "Le sommeil et le stress impactent directement ton métabolisme. On prend tout en compte !",
  },
  analysis: {
    title: 'Ton programme est prêt !',
    subtitle: 'RÉCAPITULATIF',
  },
  'cloud-sync': {
    title: '',
    subtitle: '',
  },
}

// Check if running in Expo Go (OAuth doesn't work reliably in Expo Go)
const isExpoGo = Constants.appOwnership === 'expo'

// Base steps for FULL onboarding - conditional steps are inserted dynamically
// Flow: welcome (marketing) → setup-choice → basic-info → ... → analysis → cloud-sync
// Quick mode: welcome → setup-choice → quick-setup (no cloud-sync)
// Note: cloud-sync is skipped in Expo Go because OAuth doesn't work reliably
const baseSteps: OnboardingStep[] = isExpoGo
  ? ['welcome', 'setup-choice', 'basic-info', 'activity', 'goal', 'diet', 'cooking', 'metabolism', 'lifestyle', 'analysis']
  : ['welcome', 'setup-choice', 'basic-info', 'activity', 'goal', 'diet', 'cooking', 'metabolism', 'lifestyle', 'analysis', 'cloud-sync']

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
  const [isQuickMode, setIsQuickMode] = useState(false)
  // Store quick profile temporarily before cloud-sync
  const [pendingQuickProfile, setPendingQuickProfile] = useState<Partial<UserProfile> | null>(null)
  // Store AI-calculated needs from StepAnalysis
  const [aiCalculatedNeeds, setAiCalculatedNeeds] = useState<NutritionalNeeds | null>(null)
  // Track onboarding start time for duration calculation
  const [onboardingStartTime] = useState<number>(Date.now())

  // Track onboarding started on mount
  useEffect(() => {
    lymInsights.trackOnboardingStarted()
  }, [])

  // Theme
  const { colors } = useTheme()

  // User store for persistent profile storage
  const { setProfile: setStoreProfile, setOnboarded } = useUserStore()
  const { setSignupDate } = useOnboardingStore()
  const { startTrial } = useGamificationStore()

  // Program stores for enrollment
  const { enroll: enrollMetabolicBoost } = useMetabolicBoostStore()
  const { enroll: enrollWellnessProgram } = useWellnessProgramStore()

  // Build steps dynamically based on user profile
  // ORDRE DE PRIORITÉ:
  // 1. Diagnostic métabolisme d'ABORD (après cooking)
  // 2. metabolic-program: si métabolisme adaptatif détecté (après metabolism)
  // 3. wellness-program: proposé à TOUS sauf si métabo accepté
  const steps = useMemo(() => {
    let dynamicSteps = [...baseSteps]

    // 1. Si métabolisme adaptatif détecté, proposer Programme Métabo (après metabolism step)
    if (profile.metabolismProfile === 'adaptive') {
      const metabolismIndex = dynamicSteps.indexOf('metabolism') + 1
      dynamicSteps = [...dynamicSteps.slice(0, metabolismIndex), 'metabolic-program' as OnboardingStep, ...dynamicSteps.slice(metabolismIndex)]
    }

    // 2. Wellness-program: proposé à TOUS sauf si métabo accepté
    const shouldProposeWellness = profile.metabolismProfile !== 'adaptive' || profile.wantsMetabolicProgram === false

    if (shouldProposeWellness) {
      const metabolicIndex = dynamicSteps.indexOf('metabolic-program')
      const metabolismIndex = dynamicSteps.indexOf('metabolism')

      // Trouver le bon point d'insertion (après metabolic-program > après metabolism)
      let insertAfter = -1
      if (metabolicIndex !== -1) {
        insertAfter = metabolicIndex
      } else if (metabolismIndex !== -1) {
        insertAfter = metabolismIndex
      }

      if (insertAfter !== -1) {
        dynamicSteps = [...dynamicSteps.slice(0, insertAfter + 1), 'wellness-program' as OnboardingStep, ...dynamicSteps.slice(insertAfter + 1)]
      }
    }

    return dynamicSteps
  }, [profile.metabolismProfile, profile.wantsMetabolicProgram])

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
      case 'cloud-sync':
        return true
      default:
        return false
    }
  }, [currentStep, profile])

  // Finalize onboarding and save profile
  const finalizeOnboarding = useCallback(async () => {
    setLoading(true)
    // Use AI-calculated needs if available, otherwise fall back to Harris-Benedict
    const needs = aiCalculatedNeeds || calculateNeeds(profile)

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

    // If user wants metabolic boost program, enroll them
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

    // Initialize the 7-day trial (signup date for progressive unlock)
    setSignupDate()

    // Start the AI trial period (unlimited AI credits for 7 days)
    startTrial()

    // Track onboarding completed with duration
    const durationSeconds = Math.round((Date.now() - onboardingStartTime) / 1000)
    lymInsights.trackOnboardingCompleted(durationSeconds)

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))

    setLoading(false)
    onComplete()
  }, [profile, aiCalculatedNeeds, onboardingStartTime, setStoreProfile, setOnboarded, startTrial, enrollMetabolicBoost, enrollWellnessProgram, onComplete, setSignupDate])

  const handleNext = useCallback(async () => {
    // Analysis step: in Expo Go finalize directly, otherwise go to cloud-sync
    if (currentStep === 'analysis') {
      if (isExpoGo) {
        // Skip cloud-sync in Expo Go and finalize directly
        await finalizeOnboarding()
        return
      }
      const nextIndex = stepIndex + 1
      if (nextIndex < steps.length) {
        setCurrentStep(steps[nextIndex])
      }
      return
    }

    const nextIndex = stepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex])
    }
  }, [currentStep, stepIndex, steps, finalizeOnboarding])

  // Finalize quick setup (called after cloud-sync)
  const finalizeQuickSetup = useCallback(async () => {
    if (!pendingQuickProfile) return

    setLoading(true)

    // Save to Zustand store
    setStoreProfile(pendingQuickProfile)
    setOnboarded(true)

    // Initialize the 7-day trial
    setSignupDate()
    startTrial()

    // Track onboarding completed (quick mode)
    const durationSeconds = Math.round((Date.now() - onboardingStartTime) / 1000)
    lymInsights.trackOnboardingCompleted(durationSeconds, ['full_profile_skipped'])

    await new Promise(resolve => setTimeout(resolve, 300))

    setLoading(false)
    setPendingQuickProfile(null)
    onComplete()
  }, [pendingQuickProfile, onboardingStartTime, setStoreProfile, setOnboarded, setSignupDate, startTrial, onComplete])

  // Handle cloud sync completion (connected or skipped)
  const handleCloudSyncComplete = useCallback(async (connected: boolean) => {
    // User connected with Google - finalize based on mode
    if (pendingQuickProfile) {
      await finalizeQuickSetup()
    } else {
      await finalizeOnboarding()
    }
  }, [pendingQuickProfile, finalizeQuickSetup, finalizeOnboarding])

  const handleCloudSyncSkip = useCallback(async () => {
    // User skipped cloud sync - finalize anyway based on mode
    if (pendingQuickProfile) {
      await finalizeQuickSetup()
    } else {
      await finalizeOnboarding()
    }
  }, [pendingQuickProfile, finalizeQuickSetup, finalizeOnboarding])

  const handleBack = useCallback(() => {
    const prevIndex = stepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex])
    }
  }, [stepIndex, steps])

  const needs = useMemo(() => calculateNeeds(profile), [profile])

  // Handle quick setup completion - go to cloud-sync before finalizing (skip in Expo Go)
  const handleQuickSetupComplete = useCallback(async (quickProfile: Partial<UserProfile>) => {
    // Calculate nutritional needs with quick profile
    const needs = calculateNeeds(quickProfile)

    const profileWithNeeds: Partial<UserProfile> = {
      ...quickProfile,
      nutritionalNeeds: needs,
      quickSetupCompleted: true,
      onboardingCompleted: false, // Can complete full onboarding later
    }

    // In Expo Go, skip cloud-sync and finalize directly
    if (isExpoGo) {
      setLoading(true)
      setStoreProfile(profileWithNeeds)
      setOnboarded(true)
      setSignupDate()
      startTrial()
      // Track onboarding completed (quick mode, Expo Go)
      const durationSeconds = Math.round((Date.now() - onboardingStartTime) / 1000)
      lymInsights.trackOnboardingCompleted(durationSeconds, ['full_profile_skipped', 'expo_go'])
      await new Promise(resolve => setTimeout(resolve, 300))
      setLoading(false)
      onComplete()
      return
    }

    // Store temporarily and go to cloud-sync
    setPendingQuickProfile(profileWithNeeds)
    setCurrentStep('cloud-sync')
  }, [setStoreProfile, setOnboarded, setSignupDate, startTrial, onComplete])

  // Switch from quick mode to full onboarding
  const handleSwitchToFull = useCallback(() => {
    setIsQuickMode(false)
    setCurrentStep('basic-info')
  }, [])

  // Enter quick setup mode (from setup-choice)
  const handleEnterQuickMode = useCallback(() => {
    setIsQuickMode(true)
    setCurrentStep('quick-setup')
  }, [])

  // Enter full setup mode (from setup-choice)
  const handleEnterFullMode = useCallback(() => {
    setIsQuickMode(false)
    setCurrentStep('basic-info')
  }, [])

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        // Welcome = marketing screens (hero + benefits carousel)
        // After benefits, goes to setup-choice
        return (
          <StepWelcome
            onStart={handleNext}
          />
        )
      case 'setup-choice':
        // Choice between quick (Express) or full (Personnalisé) setup
        return (
          <StepSetupChoice
            onQuickSetup={handleEnterQuickMode}
            onFullSetup={handleEnterFullMode}
          />
        )
      case 'quick-setup':
        return (
          <StepQuickSetup
            onComplete={handleQuickSetupComplete}
            onBack={() => setCurrentStep('setup-choice')}
            onSwitchToFull={handleSwitchToFull}
          />
        )
      case 'basic-info':
        return <StepBasicInfo data={profile} onChange={setProfile} />
      case 'activity':
        return <StepActivity data={profile} onChange={setProfile} />
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
        return <StepAnalysis profile={profile} needs={needs} onNeedsCalculated={setAiCalculatedNeeds} />
      case 'cloud-sync':
        return (
          <StepCloudSync
            onComplete={handleCloudSyncComplete}
            onSkip={handleCloudSyncSkip}
          />
        )
      default:
        return null
    }
  }

  // Welcome, Setup Choice, Quick Setup, and Cloud Sync steps have their own full-screen layout
  if (currentStep === 'welcome' || currentStep === 'setup-choice' || currentStep === 'quick-setup' || currentStep === 'cloud-sync') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
        {renderStep()}
      </SafeAreaView>
    )
  }

  // Don't show back button for first operational step (basic-info) - can't go back to setup-choice
  const showBackButton = currentStep !== 'basic-info' && stepIndex > 2

  return (
    <OnboardingLayout
      step={stepIndex - 2} // Subtract 2 for welcome and setup-choice which have their own layout
      totalSteps={steps.length - 3} // Subtract welcome, setup-choice, and cloud-sync
      title={config.title}
      subtitle={config.subtitle}
      valueProposition={config.valueProposition}
      onBack={showBackButton ? handleBack : undefined}
      onNext={handleNext}
      nextLabel={currentStep === 'analysis' ? 'C\'est parti !' : 'Continuer'}
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
  },
})

export default OnboardingScreen
