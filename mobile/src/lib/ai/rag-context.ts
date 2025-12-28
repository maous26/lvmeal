/**
 * RAG Context Generator
 *
 * Generates comprehensive user context for RAG-powered LymIA coach.
 * Simplified version that builds context from passed data.
 */

import type { UserProfile, NutritionInfo } from '../../types'

// ============= TYPES =============

export interface FullRAGContext {
  // User Profile
  profile: {
    firstName?: string
    age?: number
    gender?: string
    weight?: number
    height?: number
    targetWeight?: number
    bmi?: number
    activityLevel?: string
    goal?: string
    dietType?: string
    religiousDiet?: string
    allergies: string[]
  }

  // Metabolism
  metabolism: {
    bmr: number
    tdee: number
    dailyTarget: number
    deficitOrSurplus: number
  }

  // Today's Nutrition
  nutritionToday: {
    consumed: NutritionInfo
    remaining: NutritionInfo
    target: NutritionInfo
    mealsLogged: number
    percentComplete: number
  }

  // History (7 days)
  history: {
    avgCalories: number
    avgProteins: number
    daysOnTrack: number
    trend: 'improving' | 'stable' | 'declining'
  }

  // Wellness
  wellness: {
    sleepHours?: number
    sleepQuality?: number
    stressLevel?: number
    energyLevel?: number
    hydration?: number
    steps?: number
    currentStreak: number
    longestStreak: number
  }

  // Sport
  sport: {
    currentPhase?: string
    phaseName?: string
    weekInPhase?: number
    totalWeeks?: number
    weeklySessionsCompleted: number
    weeklySessionsTarget: number
  }

  // Gamification
  gamification: {
    level: number
    xp: number
    xpToNextLevel: number
    badges: string[]
    recentBadge?: string
  }

  // Caloric Bank
  caloricBank: {
    weeklyBalance: number
    cheatMealBudget: number
    cheatMealUsed: boolean
    daysUntilCheatMeal: number
  }

  // Meal Plan
  mealPlan: {
    hasActivePlan: boolean
    currentDay?: number
    mealsPlannedToday: number
    complianceRate: number
  }

  // Timestamp
  generatedAt: string
}

// ============= CONTEXT GENERATORS =============

/**
 * Build RAG context from provided data
 */
export function buildFullRAGContext(data: {
  profile: Partial<UserProfile>
  consumed: NutritionInfo
  target: NutritionInfo
  mealsLogged: number
  wellness?: {
    sleepHours?: number
    stressLevel?: number
    energyLevel?: number
    hydration?: number
    streak?: number
  }
  gamification?: {
    level?: number
    xp?: number
    xpToNextLevel?: number
  }
}): FullRAGContext {
  const { profile, consumed, target, mealsLogged, wellness, gamification } = data

  // Calculate BMI
  const bmi = profile.weight && profile.height
    ? Math.round((profile.weight / Math.pow(profile.height / 100, 2)) * 10) / 10
    : undefined

  // Calculate metabolism (approximate)
  const tdee = target.calories
  const bmr = Math.round(tdee / 1.55)

  const remaining: NutritionInfo = {
    calories: Math.max(0, target.calories - consumed.calories),
    proteins: Math.max(0, target.proteins - consumed.proteins),
    carbs: Math.max(0, target.carbs - consumed.carbs),
    fats: Math.max(0, target.fats - consumed.fats),
  }

  const percentComplete = Math.round((consumed.calories / target.calories) * 100)

  return {
    profile: {
      firstName: profile.firstName,
      age: profile.age,
      gender: profile.gender,
      weight: profile.weight,
      height: profile.height,
      targetWeight: profile.targetWeight,
      bmi,
      activityLevel: profile.activityLevel,
      goal: profile.goal,
      dietType: profile.dietType,
      religiousDiet: profile.religiousDiet || undefined,
      allergies: profile.allergies || [],
    },

    metabolism: {
      bmr,
      tdee,
      dailyTarget: target.calories,
      deficitOrSurplus: profile.goal === 'weight_loss' ? -400 : profile.goal === 'muscle_gain' ? 300 : 0,
    },

    nutritionToday: {
      consumed,
      remaining,
      target,
      mealsLogged,
      percentComplete,
    },

    history: {
      avgCalories: consumed.calories,
      avgProteins: consumed.proteins,
      daysOnTrack: 0,
      trend: 'stable',
    },

    wellness: {
      sleepHours: wellness?.sleepHours,
      stressLevel: wellness?.stressLevel,
      energyLevel: wellness?.energyLevel,
      hydration: wellness?.hydration,
      currentStreak: wellness?.streak || 0,
      longestStreak: wellness?.streak || 0,
    },

    sport: {
      weeklySessionsCompleted: 0,
      weeklySessionsTarget: 3,
    },

    gamification: {
      level: gamification?.level || 1,
      xp: gamification?.xp || 0,
      xpToNextLevel: gamification?.xpToNextLevel || 100,
      badges: [],
    },

    caloricBank: {
      weeklyBalance: 0,
      cheatMealBudget: 0,
      cheatMealUsed: false,
      daysUntilCheatMeal: 0,
    },

    mealPlan: {
      hasActivePlan: false,
      mealsPlannedToday: 0,
      complianceRate: 0,
    },

    generatedAt: new Date().toISOString(),
  }
}

/**
 * Get full RAG context using store getters
 * This is a convenience function that pulls data from stores
 */
export function getFullRAGContext(): FullRAGContext {
  // Import stores dynamically to avoid circular dependencies
  const { useUserStore } = require('../../stores/user-store')
  const { useMealsStore } = require('../../stores/meals-store')
  const { useWellnessStore } = require('../../stores/wellness-store')
  const { useGamificationStore } = require('../../stores/gamification-store')

  const userState = useUserStore.getState()
  const mealsState = useMealsStore.getState()
  const wellnessState = useWellnessStore.getState()
  const gamificationState = useGamificationStore.getState()

  const profile = userState.profile || {}
  const needs = userState.nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 70 }

  const today = new Date().toISOString().split('T')[0]
  const todayData = mealsState.getTodayData?.() || { totalNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 }, meals: [] }
  const todayEntry = wellnessState.getEntryForDate?.(today)
  const streakInfo = gamificationState.getStreakInfo?.() || { current: 0, longest: 0 }

  return buildFullRAGContext({
    profile,
    consumed: todayData.totalNutrition,
    target: needs,
    mealsLogged: todayData.meals?.length || 0,
    wellness: {
      sleepHours: todayEntry?.sleepHours,
      stressLevel: todayEntry?.stressLevel,
      energyLevel: todayEntry?.energyLevel,
      hydration: todayEntry?.waterLiters,
      streak: streakInfo.current,
    },
    gamification: {
      level: gamificationState.currentLevel || 1,
      xp: gamificationState.totalXp || 0,
      xpToNextLevel: gamificationState.xpForNextLevel || 100,
    },
  })
}

/**
 * Convert RAG context to prompt string for LLM
 */
export function ragContextToPrompt(context: FullRAGContext): string {
  const sections: string[] = []

  // Profile section
  sections.push(`PROFIL UTILISATEUR:
- Prenom: ${context.profile.firstName || 'Non renseigne'}
- Age: ${context.profile.age || '?'} ans
- Genre: ${context.profile.gender || 'Non renseigne'}
- Poids: ${context.profile.weight || '?'} kg
- Taille: ${context.profile.height || '?'} cm
- IMC: ${context.profile.bmi || '?'}
- Objectif poids: ${context.profile.targetWeight ? `${context.profile.targetWeight} kg` : 'Non defini'}
- Niveau d'activite: ${context.profile.activityLevel || 'Moderement actif'}
- Objectif: ${context.profile.goal || 'Maintien'}
- Regime alimentaire: ${context.profile.dietType || 'Omnivore'}
${context.profile.religiousDiet ? `- Regime religieux: ${context.profile.religiousDiet}` : ''}
${context.profile.allergies.length > 0 ? `- ALLERGIES (EVITER ABSOLUMENT): ${context.profile.allergies.join(', ')}` : ''}`)

  // Metabolism section
  sections.push(`METABOLISME:
- BMR (metabolisme de base): ${context.metabolism.bmr} kcal
- TDEE (depense totale): ${context.metabolism.tdee} kcal
- Objectif calorique quotidien: ${context.metabolism.dailyTarget} kcal
- Deficit/Surplus: ${context.metabolism.deficitOrSurplus > 0 ? '+' : ''}${context.metabolism.deficitOrSurplus} kcal`)

  // Today's nutrition
  sections.push(`NUTRITION AUJOURD'HUI:
- Calories consommees: ${context.nutritionToday.consumed.calories}/${context.nutritionToday.target.calories} kcal (${context.nutritionToday.percentComplete}%)
- Proteines: ${context.nutritionToday.consumed.proteins}/${context.nutritionToday.target.proteins}g
- Glucides: ${context.nutritionToday.consumed.carbs}/${context.nutritionToday.target.carbs}g
- Lipides: ${context.nutritionToday.consumed.fats}/${context.nutritionToday.target.fats}g
- Repas logges: ${context.nutritionToday.mealsLogged}
- Budget restant: ${context.nutritionToday.remaining.calories} kcal`)

  // Wellness
  if (context.wellness.sleepHours || context.wellness.stressLevel || context.wellness.energyLevel) {
    sections.push(`BIEN-ETRE AUJOURD'HUI:
${context.wellness.sleepHours ? `- Sommeil: ${context.wellness.sleepHours}h` : ''}
${context.wellness.stressLevel ? `- Stress: ${context.wellness.stressLevel}/10` : ''}
${context.wellness.energyLevel ? `- Energie: ${context.wellness.energyLevel}/10` : ''}
${context.wellness.hydration ? `- Hydratation: ${context.wellness.hydration}L` : ''}
- Streak actuel: ${context.wellness.currentStreak} jours`)
  }

  // Gamification
  sections.push(`PROGRESSION:
- Niveau: ${context.gamification.level}
- XP: ${context.gamification.xp}/${context.gamification.xp + context.gamification.xpToNextLevel}`)

  return sections.join('\n\n')
}

/**
 * Generate a short context summary for quick queries
 */
export function getShortRAGContext(context: FullRAGContext): string {
  const parts: string[] = []

  // Key stats
  parts.push(`${context.profile.firstName || 'Utilisateur'}, ${context.profile.age || '?'} ans`)

  if (context.profile.goal) {
    const goalLabels: Record<string, string> = {
      weight_loss: 'Perte de poids',
      muscle_gain: 'Prise de muscle',
      maintenance: 'Maintien',
      health: 'Sante',
    }
    parts.push(goalLabels[context.profile.goal] || context.profile.goal)
  }

  parts.push(`${context.nutritionToday.consumed.calories}/${context.nutritionToday.target.calories} kcal`)

  if (context.profile.allergies.length > 0) {
    parts.push(`Allergies: ${context.profile.allergies.join(', ')}`)
  }

  return parts.join(' | ')
}

export default {
  buildFullRAGContext,
  getFullRAGContext,
  ragContextToPrompt,
  getShortRAGContext,
}
