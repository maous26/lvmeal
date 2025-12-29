/**
 * Metabolic Boost Store - Programme de relance metabolique
 *
 * Gere le programme progressif en 4 phases:
 * 1. Decouverte (2 sem) - Stabilisation
 * 2. Marche Active (3 sem) - Activite douce
 * 3. Resistance Intro (4 sem) - Construction musculaire
 * 4. Programme Complet - Maintenance
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LymIABrain, type UserContext, type ProgramAdaptation } from '../services/lymia-brain'
import { PhaseMessages } from '../services/phase-context'
import type { UserProfile } from '../types'

export type MetabolicPhase = 'discovery' | 'walking' | 'resistance' | 'full_program'

export interface PhaseConfig {
  id: MetabolicPhase
  name: string
  description: string
  durationWeeks: number // 0 = ongoing
  objectives: string[]
  dailyTargets: {
    steps: number
    sleepHours: number
    waterLiters: number
    proteinPerKg: number
  }
  weeklyTargets: {
    walkingMinutes: number
    strengthSessions: number
    mobilityMinutes: number
  }
}

export const PHASE_CONFIGS: Record<MetabolicPhase, PhaseConfig> = {
  discovery: {
    id: 'discovery',
    name: 'Decouverte',
    description: 'Stabiliser tes apports et etablir une base solide',
    durationWeeks: 2,
    objectives: [
      'Manger a ta faim sans restriction',
      'Marcher 20-30 min par jour',
      'Dormir 7-8h minimum',
      'Boire 2L d\'eau par jour',
    ],
    dailyTargets: { steps: 5000, sleepHours: 7, waterLiters: 2, proteinPerKg: 1.6 },
    weeklyTargets: { walkingMinutes: 150, strengthSessions: 0, mobilityMinutes: 0 },
  },
  walking: {
    id: 'walking',
    name: 'Marche Active',
    description: 'Augmenter progressivement l\'activite sans stress',
    durationWeeks: 3,
    objectives: [
      'Marcher 30-45 min par jour',
      'Introduire 2 seances mobilite/semaine',
      'Augmenter calories de 100/semaine si energie OK',
      'Maintenir proteines a 1.8g/kg',
    ],
    dailyTargets: { steps: 7000, sleepHours: 7, waterLiters: 2, proteinPerKg: 1.8 },
    weeklyTargets: { walkingMinutes: 210, strengthSessions: 0, mobilityMinutes: 40 },
  },
  resistance: {
    id: 'resistance',
    name: 'Introduction Resistance',
    description: 'Construire de la masse maigre pour relancer le metabolisme',
    durationWeeks: 4,
    objectives: [
      '2-3 seances renforcement/semaine',
      'Exercices au poids du corps',
      'Progression lente et securisee',
      'Recuperation prioritaire',
    ],
    dailyTargets: { steps: 8000, sleepHours: 7.5, waterLiters: 2.5, proteinPerKg: 2.0 },
    weeklyTargets: { walkingMinutes: 180, strengthSessions: 3, mobilityMinutes: 30 },
  },
  full_program: {
    id: 'full_program',
    name: 'Programme Complet',
    description: 'Metabolisme relance, maintenir les acquis',
    durationWeeks: 0,
    objectives: [
      '3-4 seances sport/semaine',
      'Mix cardio et musculation',
      'NEAT optimise au quotidien',
      'Gestion stress et sommeil',
    ],
    dailyTargets: { steps: 10000, sleepHours: 7.5, waterLiters: 2.5, proteinPerKg: 2.0 },
    weeklyTargets: { walkingMinutes: 150, strengthSessions: 4, mobilityMinutes: 30 },
  },
}

export interface DailyLog {
  date: string
  steps?: number
  sleepHours?: number
  sleepQuality?: 1 | 2 | 3 | 4 | 5
  waterLiters?: number
  energyLevel?: 1 | 2 | 3 | 4 | 5
  stressLevel?: 1 | 2 | 3 | 4 | 5
  mood?: 1 | 2 | 3 | 4 | 5
  strengthSession?: boolean
  walkingMinutes?: number
  mobilityMinutes?: number
  notes?: string
}

export interface WeekSummary {
  weekNumber: number
  startDate: string
  endDate: string
  phase: MetabolicPhase
  avgSteps: number
  avgSleep: number
  avgEnergy: number
  avgStress: number
  totalWalkingMinutes: number
  strengthSessionsCompleted: number
  completionRate: number // 0-100
  insights: string[]
}

export interface PhaseTransitionNotification {
  id: string
  fromPhase: MetabolicPhase
  toPhase: MetabolicPhase
  title: string
  message: string
  tips: string[]
  createdAt: string
  isRead: boolean
}

export interface MetabolicBoostState {
  // Program state
  isEnrolled: boolean
  enrolledAt: string | null
  currentPhase: MetabolicPhase
  currentWeek: number
  phaseStartDate: string | null

  // Tracking
  dailyLogs: DailyLog[]
  weekSummaries: WeekSummary[]

  // Progress
  totalWeeksCompleted: number
  currentStreak: number
  longestStreak: number

  // Device sync
  lastDeviceSync: string | null
  deviceStepsToday: number

  // Phase transition notifications
  phaseTransitionNotifications: PhaseTransitionNotification[]

  // Actions
  enroll: () => void
  unenroll: () => void
  logDaily: (log: Omit<DailyLog, 'date'>) => void
  getTodayLog: () => DailyLog | null
  getWeekLogs: (weekNumber?: number) => DailyLog[]
  calculateWeekSummary: (weekNumber: number) => WeekSummary | null
  checkPhaseProgression: () => { canProgress: boolean; reason?: string }
  progressToNextPhase: () => boolean
  getCurrentPhaseConfig: () => PhaseConfig
  getProgressPercentage: () => number
  syncDeviceSteps: (steps: number) => void
  // Phase transition
  getUnreadTransitionNotification: () => PhaseTransitionNotification | null
  markTransitionNotificationRead: (id: string) => void
  // NEW: LymIA Brain powered evaluation
  evaluateProgressionWithAI: (userProfile: UserProfile) => Promise<ProgramAdaptation>
}

const getDateString = () => new Date().toISOString().split('T')[0]

const getWeekNumber = (startDate: string, currentDate: string): number => {
  const start = new Date(startDate)
  const current = new Date(currentDate)
  const diffTime = current.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

export const useMetabolicBoostStore = create<MetabolicBoostState>()(
  persist(
    (set, get) => ({
      isEnrolled: false,
      enrolledAt: null,
      currentPhase: 'discovery',
      currentWeek: 1,
      phaseStartDate: null,
      dailyLogs: [],
      weekSummaries: [],
      totalWeeksCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastDeviceSync: null,
      deviceStepsToday: 0,
      phaseTransitionNotifications: [],

      enroll: () => {
        const now = getDateString()
        set({
          isEnrolled: true,
          enrolledAt: now,
          currentPhase: 'discovery',
          currentWeek: 1,
          phaseStartDate: now,
          dailyLogs: [],
          weekSummaries: [],
          totalWeeksCompleted: 0,
          currentStreak: 0,
        })
      },

      unenroll: () => {
        set({
          isEnrolled: false,
          enrolledAt: null,
          currentPhase: 'discovery',
          currentWeek: 1,
          phaseStartDate: null,
        })
      },

      logDaily: (log) => {
        const today = getDateString()
        const { dailyLogs, currentStreak, longestStreak, deviceStepsToday } = get()

        // Merge with device steps if available
        const steps = log.steps ?? deviceStepsToday

        const existingIndex = dailyLogs.findIndex(l => l.date === today)
        const newLog: DailyLog = { ...log, date: today, steps }

        let updatedLogs: DailyLog[]
        if (existingIndex >= 0) {
          updatedLogs = [...dailyLogs]
          updatedLogs[existingIndex] = { ...updatedLogs[existingIndex], ...newLog }
        } else {
          updatedLogs = [...dailyLogs, newLog]
        }

        // Update streak
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        const hasYesterdayLog = dailyLogs.some(l => l.date === yesterdayStr)

        const newStreak = hasYesterdayLog ? currentStreak + 1 : 1
        const newLongest = Math.max(longestStreak, newStreak)

        set({
          dailyLogs: updatedLogs,
          currentStreak: newStreak,
          longestStreak: newLongest,
        })
      },

      getTodayLog: () => {
        const today = getDateString()
        return get().dailyLogs.find(l => l.date === today) || null
      },

      getWeekLogs: (weekNumber) => {
        const { dailyLogs, phaseStartDate, currentWeek } = get()
        if (!phaseStartDate) return []

        const week = weekNumber ?? currentWeek
        const startDate = new Date(phaseStartDate)
        startDate.setDate(startDate.getDate() + (week - 1) * 7)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 6)

        return dailyLogs.filter(log => {
          const logDate = new Date(log.date)
          return logDate >= startDate && logDate <= endDate
        })
      },

      calculateWeekSummary: (weekNumber) => {
        const { phaseStartDate, currentPhase, getWeekLogs } = get()
        if (!phaseStartDate) return null

        const logs = getWeekLogs(weekNumber)
        if (logs.length === 0) return null

        const startDate = new Date(phaseStartDate)
        startDate.setDate(startDate.getDate() + (weekNumber - 1) * 7)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 6)

        const avgSteps = logs.reduce((sum, l) => sum + (l.steps || 0), 0) / logs.length
        const avgSleep = logs.reduce((sum, l) => sum + (l.sleepHours || 0), 0) / logs.length
        const avgEnergy = logs.reduce((sum, l) => sum + (l.energyLevel || 3), 0) / logs.length
        const avgStress = logs.reduce((sum, l) => sum + (l.stressLevel || 3), 0) / logs.length
        const totalWalking = logs.reduce((sum, l) => sum + (l.walkingMinutes || 0), 0)
        const strengthSessions = logs.filter(l => l.strengthSession).length

        // Completion rate based on logging consistency
        const completionRate = (logs.length / 7) * 100

        // Generate insights
        const insights: string[] = []
        const config = PHASE_CONFIGS[currentPhase]

        if (avgSteps >= config.dailyTargets.steps) {
          insights.push('Objectif pas quotidien atteint')
        }
        if (avgSleep >= config.dailyTargets.sleepHours) {
          insights.push('Sommeil suffisant cette semaine')
        }
        if (avgEnergy >= 3.5) {
          insights.push('Bonne energie globale')
        }
        if (avgStress <= 2.5) {
          insights.push('Stress bien gere')
        }

        return {
          weekNumber,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          phase: currentPhase,
          avgSteps: Math.round(avgSteps),
          avgSleep: Math.round(avgSleep * 10) / 10,
          avgEnergy: Math.round(avgEnergy * 10) / 10,
          avgStress: Math.round(avgStress * 10) / 10,
          totalWalkingMinutes: totalWalking,
          strengthSessionsCompleted: strengthSessions,
          completionRate: Math.round(completionRate),
          insights,
        }
      },

      checkPhaseProgression: () => {
        const { currentPhase, currentWeek, calculateWeekSummary } = get()
        const config = PHASE_CONFIGS[currentPhase]

        // Full program doesn't progress
        if (currentPhase === 'full_program') {
          return { canProgress: false, reason: 'Programme complet atteint' }
        }

        // Check minimum weeks
        if (currentWeek < config.durationWeeks) {
          return { canProgress: false, reason: `Semaine ${currentWeek}/${config.durationWeeks}` }
        }

        // Check last week's completion
        const lastWeekSummary = calculateWeekSummary(currentWeek)
        if (!lastWeekSummary || lastWeekSummary.completionRate < 70) {
          return { canProgress: false, reason: 'Completion < 70% cette semaine' }
        }

        // Check energy level (don't progress if energy too low)
        if (lastWeekSummary.avgEnergy < 2.5) {
          return { canProgress: false, reason: 'Energie trop basse pour progresser' }
        }

        return { canProgress: true }
      },

      progressToNextPhase: () => {
        const { currentPhase, checkPhaseProgression, weekSummaries, currentWeek, calculateWeekSummary, totalWeeksCompleted, phaseTransitionNotifications } = get()
        const { canProgress } = checkPhaseProgression()

        if (!canProgress) return false

        // Save current week summary
        const summary = calculateWeekSummary(currentWeek)
        const updatedSummaries = summary ? [...weekSummaries, summary] : weekSummaries

        // Determine next phase
        const phases: MetabolicPhase[] = ['discovery', 'walking', 'resistance', 'full_program']
        const currentIndex = phases.indexOf(currentPhase)
        const nextPhase = phases[currentIndex + 1] || 'full_program'

        // Create phase transition notification
        const transitionMessage = PhaseMessages.getPhaseTransitionMessage(currentPhase, nextPhase)
        const notification: PhaseTransitionNotification = {
          id: `transition_${Date.now()}`,
          fromPhase: currentPhase,
          toPhase: nextPhase,
          title: transitionMessage.title,
          message: transitionMessage.message,
          tips: transitionMessage.tips,
          createdAt: new Date().toISOString(),
          isRead: false,
        }

        set({
          currentPhase: nextPhase,
          currentWeek: 1,
          phaseStartDate: getDateString(),
          weekSummaries: updatedSummaries,
          totalWeeksCompleted: totalWeeksCompleted + PHASE_CONFIGS[currentPhase].durationWeeks,
          phaseTransitionNotifications: [...phaseTransitionNotifications, notification],
        })

        return true
      },

      getCurrentPhaseConfig: () => {
        return PHASE_CONFIGS[get().currentPhase]
      },

      getProgressPercentage: () => {
        const { currentPhase, currentWeek, totalWeeksCompleted } = get()
        const config = PHASE_CONFIGS[currentPhase]

        // Total program is approximately 9 weeks (2+3+4)
        const totalExpectedWeeks = 9
        const completedWeeks = totalWeeksCompleted + (currentWeek - 1)

        if (currentPhase === 'full_program') return 100

        return Math.min(100, Math.round((completedWeeks / totalExpectedWeeks) * 100))
      },

      syncDeviceSteps: (steps) => {
        set({
          deviceStepsToday: steps,
          lastDeviceSync: new Date().toISOString(),
        })

        // Also update today's log if exists
        const today = getDateString()
        const { dailyLogs } = get()
        const existingIndex = dailyLogs.findIndex(l => l.date === today)

        if (existingIndex >= 0) {
          const updatedLogs = [...dailyLogs]
          updatedLogs[existingIndex] = { ...updatedLogs[existingIndex], steps }
          set({ dailyLogs: updatedLogs })
        }
      },

      // Get unread phase transition notification (returns most recent)
      getUnreadTransitionNotification: () => {
        const { phaseTransitionNotifications } = get()
        return phaseTransitionNotifications.find(n => !n.isRead) || null
      },

      // Mark transition notification as read
      markTransitionNotificationRead: (id: string) => {
        const { phaseTransitionNotifications } = get()
        set({
          phaseTransitionNotifications: phaseTransitionNotifications.map(n =>
            n.id === id ? { ...n, isRead: true } : n
          ),
        })
      },

      // NEW: Evaluate progression using LymIA Brain
      evaluateProgressionWithAI: async (userProfile) => {
        const { currentPhase, currentWeek, getWeekLogs, calculateWeekSummary } = get()

        // Get recent wellness data from logs
        const recentLogs = getWeekLogs(currentWeek)
        const weekSummary = calculateWeekSummary(currentWeek)

        // Calculate averages
        const avgSleep = recentLogs.length > 0
          ? recentLogs.reduce((sum, l) => sum + (l.sleepHours || 7), 0) / recentLogs.length
          : undefined
        const avgEnergy = recentLogs.length > 0
          ? recentLogs.reduce((sum, l) => sum + (l.energyLevel || 3), 0) / recentLogs.length
          : undefined
        const avgStress = recentLogs.length > 0
          ? recentLogs.reduce((sum, l) => sum + (l.stressLevel || 3), 0) / recentLogs.length
          : undefined

        // Build LymIA context
        const userContext: UserContext = {
          profile: userProfile,
          todayNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          weeklyAverage: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          currentStreak: recentLogs.length,
          lastMeals: [],
          wellnessData: {
            sleepHours: avgSleep,
            stressLevel: avgStress ? avgStress * 2 : undefined, // Scale 1-5 to 1-10
            energyLevel: avgEnergy,
          },
          programProgress: {
            type: 'metabolic_boost',
            phase: ['discovery', 'walking', 'resistance', 'full_program'].indexOf(currentPhase) + 1,
            weekInPhase: currentWeek,
            completionRate: weekSummary ? weekSummary.completionRate / 100 : 0,
          },
        }

        try {
          return await LymIABrain.evaluateProgramProgress(userContext, 'metabolic_boost')
        } catch (error) {
          console.error('LymIA metabolic evaluation failed:', error)
          // Fallback to basic check
          const { canProgress, reason } = get().checkPhaseProgression()
          return {
            shouldProgress: canProgress,
            nextPhaseReady: canProgress,
            adjustments: [],
            decision: canProgress ? 'Pret pour progression' : (reason || 'Pas encore pret'),
            reasoning: reason || 'Evaluation basique (fallback)',
            confidence: 0.5,
            sources: [],
          }
        }
      },
    }),
    {
      name: 'metabolic-boost-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export default useMetabolicBoostStore
