/**
 * Sport Initiation Store - Programme d'initiation sportive pour sedentaires
 *
 * Programme progressif en 4 phases adapte au profil:
 * 1. Activation (2 sem) - Premiers pas, routines douces
 * 2. Mouvement (3 sem) - Marche active, mobilite
 * 3. Renforcement (4 sem) - Exercices au poids du corps
 * 4. Autonomie - Programme personnalise continu
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LymIABrain, type UserContext, type ProgramAdaptation } from '../services/lymia-brain'
import type { UserProfile } from '../types'

export type SportPhase = 'activation' | 'movement' | 'strengthening' | 'autonomy'

export type FitnessLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'

export interface PhaseConfig {
  id: SportPhase
  name: string
  description: string
  durationWeeks: number // 0 = ongoing
  objectives: string[]
  dailyTargets: {
    steps: number
    activeMinutes: number
    stretchingMinutes: number
  }
  weeklyTargets: {
    workoutSessions: number
    walkingMinutes: number
    mobilityMinutes: number
  }
  exercises: string[]
}

export const SPORT_PHASE_CONFIGS: Record<SportPhase, PhaseConfig> = {
  activation: {
    id: 'activation',
    name: 'Activation',
    description: 'Decouvrir le mouvement et creer des habitudes',
    durationWeeks: 2,
    objectives: [
      'Marcher 15-20 min par jour',
      'Faire 5 min d\'etirements matin/soir',
      'Prendre les escaliers quand possible',
      'Se lever toutes les heures',
    ],
    dailyTargets: { steps: 3000, activeMinutes: 15, stretchingMinutes: 10 },
    weeklyTargets: { workoutSessions: 0, walkingMinutes: 105, mobilityMinutes: 70 },
    exercises: [
      'Marche tranquille',
      'Etirements doux',
      'Respiration profonde',
      'Lever de chaise',
    ],
  },
  movement: {
    id: 'movement',
    name: 'Mouvement',
    description: 'Augmenter progressivement l\'activite quotidienne',
    durationWeeks: 3,
    objectives: [
      'Marcher 25-30 min par jour',
      'Introduire 2 seances mobilite/semaine',
      'Essayer une activite plaisir (velo, natation...)',
      'Atteindre 5000 pas/jour',
    ],
    dailyTargets: { steps: 5000, activeMinutes: 25, stretchingMinutes: 10 },
    weeklyTargets: { workoutSessions: 2, walkingMinutes: 175, mobilityMinutes: 40 },
    exercises: [
      'Marche rapide',
      'Mobilite articulaire',
      'Squats assistes (chaise)',
      'Montees de genoux',
    ],
  },
  strengthening: {
    id: 'strengthening',
    name: 'Renforcement',
    description: 'Construire force et endurance de base',
    durationWeeks: 4,
    objectives: [
      '2-3 seances renforcement/semaine',
      'Exercices au poids du corps',
      'Atteindre 7000 pas/jour',
      'Marcher 30-40 min par jour',
    ],
    dailyTargets: { steps: 7000, activeMinutes: 35, stretchingMinutes: 10 },
    weeklyTargets: { workoutSessions: 3, walkingMinutes: 210, mobilityMinutes: 30 },
    exercises: [
      'Squats',
      'Pompes (mur ou genoux)',
      'Fentes assistees',
      'Planche (genoux)',
      'Pont fessiers',
    ],
  },
  autonomy: {
    id: 'autonomy',
    name: 'Autonomie',
    description: 'Maintenir et progresser selon tes envies',
    durationWeeks: 0,
    objectives: [
      '3-4 seances sport/semaine',
      'Atteindre 8000-10000 pas/jour',
      'Essayer de nouvelles activites',
      'Ecouter son corps',
    ],
    dailyTargets: { steps: 8000, activeMinutes: 45, stretchingMinutes: 10 },
    weeklyTargets: { workoutSessions: 4, walkingMinutes: 200, mobilityMinutes: 30 },
    exercises: [
      'Programme personnalise',
      'Cardio au choix',
      'Renforcement progressif',
      'Activites plaisir',
    ],
  },
}

export interface DailySportLog {
  date: string
  steps?: number
  activeMinutes?: number
  stretchingMinutes?: number
  workoutCompleted?: boolean
  workoutType?: string
  energyLevel?: 1 | 2 | 3 | 4 | 5
  painLevel?: 0 | 1 | 2 | 3 // 0 = aucune douleur
  enjoyment?: 1 | 2 | 3 | 4 | 5
  notes?: string
}

export interface WeekSportSummary {
  weekNumber: number
  startDate: string
  endDate: string
  phase: SportPhase
  avgSteps: number
  totalActiveMinutes: number
  workoutsCompleted: number
  avgEnergy: number
  avgEnjoyment: number
  completionRate: number // 0-100
  insights: string[]
}

export interface SportInitiationState {
  // Program state
  isEnrolled: boolean
  enrolledAt: string | null
  currentPhase: SportPhase
  currentWeek: number
  phaseStartDate: string | null

  // User profile for personalization
  fitnessLevel: FitnessLevel
  hasHealthConditions: boolean
  preferredActivities: string[]
  availableMinutesPerDay: number

  // Tracking
  dailyLogs: DailySportLog[]
  weekSummaries: WeekSportSummary[]

  // Progress
  totalWeeksCompleted: number
  currentStreak: number
  longestStreak: number
  totalWorkouts: number

  // Actions
  enroll: (profile?: {
    fitnessLevel?: FitnessLevel
    hasHealthConditions?: boolean
    preferredActivities?: string[]
    availableMinutesPerDay?: number
  }) => void
  unenroll: () => void
  logDaily: (log: Omit<DailySportLog, 'date'>) => void
  getTodayLog: () => DailySportLog | null
  getCurrentPhaseConfig: () => PhaseConfig
  getPhaseProgress: () => { current: number; total: number; percentage: number }
  checkPhaseCompletion: () => boolean
  advancePhase: () => void
  getWeeklyProgress: () => {
    steps: { current: number; target: number; percentage: number }
    workouts: { current: number; target: number; percentage: number }
    activeMinutes: { current: number; target: number; percentage: number }
  }
  generateWeekSummary: () => WeekSportSummary | null
  updateProfile: (updates: Partial<{
    fitnessLevel: FitnessLevel
    hasHealthConditions: boolean
    preferredActivities: string[]
    availableMinutesPerDay: number
  }>) => void
  // NEW: LymIA Brain powered evaluation
  evaluateProgressionWithAI: (userProfile: UserProfile) => Promise<ProgramAdaptation>
}

const getToday = () => new Date().toISOString().split('T')[0]

const getWeekStart = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

/**
 * Calculate extra calories burned based on sport activity
 * Uses MET (Metabolic Equivalent of Task) values
 */
export function calculateSportCaloriesBurned(
  phase: SportPhase,
  weight: number = 70 // kg
): number {
  const config = SPORT_PHASE_CONFIGS[phase]

  // MET values for different activities:
  // - Walking (slow): 2.5 MET
  // - Walking (moderate): 3.5 MET
  // - Light exercise/stretching: 2.5 MET
  // - Bodyweight exercises: 4.0 MET

  // Daily active minutes converted to extra calories
  // Formula: Calories = MET × weight(kg) × time(hours)
  const activeMinutes = config.dailyTargets.activeMinutes
  const stretchingMinutes = config.dailyTargets.stretchingMinutes

  // Average MET based on phase intensity
  const phaseMET: Record<SportPhase, number> = {
    activation: 2.5,    // Light walking, stretching
    movement: 3.0,      // Moderate walking, mobility
    strengthening: 3.5, // Bodyweight exercises
    autonomy: 4.0,      // Mixed training
  }

  const met = phaseMET[phase]
  const totalMinutes = activeMinutes + stretchingMinutes

  // Calories burned = MET × weight × hours
  // We subtract 1 MET to account for baseline metabolism already in TDEE
  const extraCalories = (met - 1) * weight * (totalMinutes / 60)

  return Math.round(extraCalories)
}

/**
 * Get the recommended calorie adjustment for sport program
 * This should be ADDED to the user's daily calorie goal
 */
export function getSportCalorieAdjustment(
  isEnrolled: boolean,
  phase: SportPhase,
  weight: number = 70
): number {
  if (!isEnrolled) return 0
  return calculateSportCaloriesBurned(phase, weight)
}

export const useSportInitiationStore = create<SportInitiationState>()(
  persist(
    (set, get) => ({
      // Initial state
      isEnrolled: false,
      enrolledAt: null,
      currentPhase: 'activation',
      currentWeek: 1,
      phaseStartDate: null,

      fitnessLevel: 'sedentary',
      hasHealthConditions: false,
      preferredActivities: [],
      availableMinutesPerDay: 30,

      dailyLogs: [],
      weekSummaries: [],

      totalWeeksCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalWorkouts: 0,

      enroll: (profile) => {
        const now = new Date().toISOString()
        set({
          isEnrolled: true,
          enrolledAt: now,
          currentPhase: 'activation',
          currentWeek: 1,
          phaseStartDate: now,
          fitnessLevel: profile?.fitnessLevel || 'sedentary',
          hasHealthConditions: profile?.hasHealthConditions || false,
          preferredActivities: profile?.preferredActivities || [],
          availableMinutesPerDay: profile?.availableMinutesPerDay || 30,
        })

        // Update calorie bonus in user store
        // Import dynamically to avoid circular dependency
        const { useUserStore } = require('./user-store')
        const userState = useUserStore.getState()
        const weight = userState.profile?.weight || 70
        const bonus = calculateSportCaloriesBurned('activation', weight)
        userState.updateSportCalorieBonus(bonus)
      },

      unenroll: () => {
        set({
          isEnrolled: false,
          enrolledAt: null,
          currentPhase: 'activation',
          currentWeek: 1,
          phaseStartDate: null,
        })

        // Remove calorie bonus
        const { useUserStore } = require('./user-store')
        useUserStore.getState().updateSportCalorieBonus(0)
      },

      logDaily: (log) => {
        const today = getToday()
        const state = get()

        // Check if already logged today
        const existingIndex = state.dailyLogs.findIndex((l) => l.date === today)
        const newLog: DailySportLog = { date: today, ...log }

        let newStreak = state.currentStreak
        let longestStreak = state.longestStreak
        let totalWorkouts = state.totalWorkouts

        // Update streak
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        const loggedYesterday = state.dailyLogs.some((l) => l.date === yesterdayStr)

        if (existingIndex === -1) {
          // New log for today
          if (loggedYesterday || state.dailyLogs.length === 0) {
            newStreak = state.currentStreak + 1
          } else {
            newStreak = 1
          }
        }

        if (newStreak > longestStreak) {
          longestStreak = newStreak
        }

        // Count workouts
        if (log.workoutCompleted && existingIndex === -1) {
          totalWorkouts = state.totalWorkouts + 1
        }

        const newLogs =
          existingIndex >= 0
            ? state.dailyLogs.map((l, i) => (i === existingIndex ? { ...l, ...newLog } : l))
            : [...state.dailyLogs, newLog]

        set({
          dailyLogs: newLogs,
          currentStreak: newStreak,
          longestStreak,
          totalWorkouts,
        })
      },

      getTodayLog: () => {
        const today = getToday()
        return get().dailyLogs.find((l) => l.date === today) || null
      },

      getCurrentPhaseConfig: () => {
        return SPORT_PHASE_CONFIGS[get().currentPhase]
      },

      getPhaseProgress: () => {
        const { currentWeek, currentPhase } = get()
        const config = SPORT_PHASE_CONFIGS[currentPhase]
        const total = config.durationWeeks || 52 // Use 52 for ongoing phases
        const current = Math.min(currentWeek, total)
        return {
          current,
          total: config.durationWeeks || 0,
          percentage: config.durationWeeks > 0 ? Math.round((current / total) * 100) : 0,
        }
      },

      checkPhaseCompletion: () => {
        const { currentWeek, currentPhase } = get()
        const config = SPORT_PHASE_CONFIGS[currentPhase]

        // Can't complete ongoing phase
        if (config.durationWeeks === 0) return false

        return currentWeek > config.durationWeeks
      },

      advancePhase: () => {
        const { currentPhase, totalWeeksCompleted, currentWeek } = get()
        const phases: SportPhase[] = ['activation', 'movement', 'strengthening', 'autonomy']
        const currentIndex = phases.indexOf(currentPhase)

        if (currentIndex < phases.length - 1) {
          const nextPhase = phases[currentIndex + 1]
          set({
            currentPhase: nextPhase,
            currentWeek: 1,
            phaseStartDate: new Date().toISOString(),
            totalWeeksCompleted: totalWeeksCompleted + currentWeek - 1,
          })

          // Update calorie bonus for new phase (more intense = more calories)
          const { useUserStore } = require('./user-store')
          const userState = useUserStore.getState()
          const weight = userState.profile?.weight || 70
          const bonus = calculateSportCaloriesBurned(nextPhase, weight)
          userState.updateSportCalorieBonus(bonus)
        }
      },

      getWeeklyProgress: () => {
        const state = get()
        const config = SPORT_PHASE_CONFIGS[state.currentPhase]
        const weekStart = getWeekStart(new Date())

        // Get logs for this week
        const weekLogs = state.dailyLogs.filter((l) => l.date >= weekStart)

        const totalSteps = weekLogs.reduce((sum, l) => sum + (l.steps || 0), 0)
        const avgSteps = weekLogs.length > 0 ? Math.round(totalSteps / 7) : 0

        const totalActiveMinutes = weekLogs.reduce((sum, l) => sum + (l.activeMinutes || 0), 0)
        const workoutsCompleted = weekLogs.filter((l) => l.workoutCompleted).length

        return {
          steps: {
            current: avgSteps,
            target: config.dailyTargets.steps,
            percentage: Math.min(100, Math.round((avgSteps / config.dailyTargets.steps) * 100)),
          },
          workouts: {
            current: workoutsCompleted,
            target: config.weeklyTargets.workoutSessions,
            percentage:
              config.weeklyTargets.workoutSessions > 0
                ? Math.min(
                    100,
                    Math.round((workoutsCompleted / config.weeklyTargets.workoutSessions) * 100)
                  )
                : 100,
          },
          activeMinutes: {
            current: totalActiveMinutes,
            target: config.weeklyTargets.walkingMinutes,
            percentage: Math.min(
              100,
              Math.round((totalActiveMinutes / config.weeklyTargets.walkingMinutes) * 100)
            ),
          },
        }
      },

      generateWeekSummary: () => {
        const state = get()
        const weekStart = getWeekStart(new Date())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)

        const weekLogs = state.dailyLogs.filter(
          (l) => l.date >= weekStart && l.date <= weekEnd.toISOString().split('T')[0]
        )

        if (weekLogs.length === 0) return null

        const avgSteps =
          weekLogs.reduce((sum, l) => sum + (l.steps || 0), 0) / Math.max(weekLogs.length, 1)
        const totalActiveMinutes = weekLogs.reduce((sum, l) => sum + (l.activeMinutes || 0), 0)
        const workoutsCompleted = weekLogs.filter((l) => l.workoutCompleted).length
        const avgEnergy =
          weekLogs.filter((l) => l.energyLevel).reduce((sum, l) => sum + (l.energyLevel || 0), 0) /
          Math.max(weekLogs.filter((l) => l.energyLevel).length, 1)
        const avgEnjoyment =
          weekLogs.filter((l) => l.enjoyment).reduce((sum, l) => sum + (l.enjoyment || 0), 0) /
          Math.max(weekLogs.filter((l) => l.enjoyment).length, 1)

        const config = SPORT_PHASE_CONFIGS[state.currentPhase]
        const stepsCompletion = (avgSteps / config.dailyTargets.steps) * 100
        const workoutsCompletion =
          config.weeklyTargets.workoutSessions > 0
            ? (workoutsCompleted / config.weeklyTargets.workoutSessions) * 100
            : 100
        const completionRate = Math.round((stepsCompletion + workoutsCompletion) / 2)

        // Generate insights
        const insights: string[] = []
        if (avgEnergy >= 4) insights.push('Excellent niveau d\'energie cette semaine!')
        if (avgEnergy <= 2) insights.push('Energie basse - pense a bien te reposer')
        if (workoutsCompleted >= config.weeklyTargets.workoutSessions)
          insights.push('Objectif seances atteint!')
        if (avgSteps >= config.dailyTargets.steps) insights.push('Bravo pour les pas quotidiens!')

        const summary: WeekSportSummary = {
          weekNumber: state.currentWeek,
          startDate: weekStart,
          endDate: weekEnd.toISOString().split('T')[0],
          phase: state.currentPhase,
          avgSteps: Math.round(avgSteps),
          totalActiveMinutes,
          workoutsCompleted,
          avgEnergy: Math.round(avgEnergy * 10) / 10,
          avgEnjoyment: Math.round(avgEnjoyment * 10) / 10,
          completionRate: Math.min(100, completionRate),
          insights,
        }

        return summary
      },

      updateProfile: (updates) => {
        set((state) => ({
          ...state,
          ...updates,
        }))
      },

      // NEW: Evaluate progression using LymIA Brain
      evaluateProgressionWithAI: async (userProfile) => {
        const state = get()
        const { currentPhase, currentWeek, dailyLogs } = state

        // Get recent logs for wellness data
        const weekStart = getWeekStart(new Date())
        const recentLogs = dailyLogs.filter((l) => l.date >= weekStart)
        const weekSummary = state.generateWeekSummary()

        // Calculate averages
        const avgEnergy = recentLogs.length > 0
          ? recentLogs.reduce((sum, l) => sum + (l.energyLevel || 3), 0) / recentLogs.length
          : undefined
        const avgEnjoyment = recentLogs.length > 0
          ? recentLogs.reduce((sum, l) => sum + (l.enjoyment || 3), 0) / recentLogs.length
          : undefined

        // Build LymIA context
        const userContext: UserContext = {
          profile: userProfile,
          todayNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          weeklyAverage: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          currentStreak: state.currentStreak,
          lastMeals: [],
          wellnessData: {
            energyLevel: avgEnergy,
            // Convert enjoyment to a stress-like metric (inverse)
            stressLevel: avgEnjoyment ? (6 - avgEnjoyment) * 2 : undefined,
          },
          programProgress: {
            type: 'sport_initiation',
            phase: ['activation', 'movement', 'strengthening', 'autonomy'].indexOf(currentPhase) + 1,
            weekInPhase: currentWeek,
            completionRate: weekSummary ? weekSummary.completionRate / 100 : 0,
          },
        }

        try {
          return await LymIABrain.evaluateProgramProgress(userContext, 'sport_initiation')
        } catch (error) {
          console.error('LymIA sport evaluation failed:', error)
          // Fallback to basic check
          const canProgress = state.checkPhaseCompletion()
          return {
            shouldProgress: canProgress,
            nextPhaseReady: canProgress,
            adjustments: [],
            decision: canProgress ? 'Pret pour la phase suivante' : 'Continuer la phase actuelle',
            reasoning: 'Evaluation basique (fallback)',
            confidence: 0.5,
            sources: [],
          }
        }
      },
    }),
    {
      name: 'presence-sport-initiation',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isEnrolled: state.isEnrolled,
        enrolledAt: state.enrolledAt,
        currentPhase: state.currentPhase,
        currentWeek: state.currentWeek,
        phaseStartDate: state.phaseStartDate,
        fitnessLevel: state.fitnessLevel,
        hasHealthConditions: state.hasHealthConditions,
        preferredActivities: state.preferredActivities,
        availableMinutesPerDay: state.availableMinutesPerDay,
        dailyLogs: state.dailyLogs,
        weekSummaries: state.weekSummaries,
        totalWeeksCompleted: state.totalWeeksCompleted,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
        totalWorkouts: state.totalWorkouts,
      }),
    }
  )
)

export default useSportInitiationStore
