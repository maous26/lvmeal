/**
 * Wellness Program Store - Programme Bien-être holistique
 *
 * Gère le programme progressif en 4 phases:
 * 1. Fondations (2 sem) - Sommeil et respiration
 * 2. Conscience (3 sem) - Méditation et pleine conscience
 * 3. Équilibre (3 sem) - Gestion du stress et routines
 * 4. Harmonie (ongoing) - Intégration et maintenance
 *
 * LOGIQUE D'AFFICHAGE:
 * - Caché si l'utilisateur est inscrit au programme Métabolisme
 * - Proposé une fois le programme Métabolisme terminé
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LymIABrain, type UserContext, type ProgramAdaptation } from '../services/lymia-brain'
import type { UserProfile } from '../types'
import { analytics } from '../services/analytics-service'

export type WellnessPhase = 'foundations' | 'awareness' | 'balance' | 'harmony'

export interface WellnessPhaseConfig {
  id: WellnessPhase
  name: string
  description: string
  durationWeeks: number // 0 = ongoing
  focus: string
  objectives: string[]
  dailyPractices: {
    breathingExercises: number // nombre de sessions/jour
    gratitudeEntries: number
    sleepHours: number
  }
  weeklyGoals: {
    meditationSessions: number // sessions TTS audio par semaine (1)
    journalEntries: number
    digitalDetoxHours: number
    socialConnections: number
  }
  techniques: string[]
}

export const WELLNESS_PHASE_CONFIGS: Record<WellnessPhase, WellnessPhaseConfig> = {
  foundations: {
    id: 'foundations',
    name: 'Fondations',
    description: 'Établir les bases du bien-être avec le sommeil et la respiration',
    durationWeeks: 2,
    focus: 'Sommeil & Respiration',
    objectives: [
      'Optimiser l\'hygiène de sommeil',
      'Maîtriser la respiration diaphragmatique',
      'Écouter les méditations guidées (1/semaine)',
      'Créer une routine du soir apaisante',
    ],
    dailyPractices: {
      breathingExercises: 2,
      gratitudeEntries: 1,
      sleepHours: 7.5,
    },
    weeklyGoals: {
      meditationSessions: 1,
      journalEntries: 3,
      digitalDetoxHours: 7,
      socialConnections: 2,
    },
    techniques: [
      'Méditation guidée audio (1x/semaine)',
      'Respiration 4-7-8 (détente)',
      'Cohérence cardiaque (5-5)',
      'Routine du soir sans écran',
    ],
  },
  awareness: {
    id: 'awareness',
    name: 'Conscience',
    description: 'Développer la pleine conscience et la méditation',
    durationWeeks: 3,
    focus: 'Méditation & Pleine Conscience',
    objectives: [
      'Écouter la méditation guidée de la semaine',
      'Développer l\'attention au moment présent',
      'Reconnaître les schémas de pensées automatiques',
      'Cultiver la bienveillance envers soi',
    ],
    dailyPractices: {
      breathingExercises: 2,
      gratitudeEntries: 2,
      sleepHours: 7.5,
    },
    weeklyGoals: {
      meditationSessions: 1,
      journalEntries: 5,
      digitalDetoxHours: 10,
      socialConnections: 3,
    },
    techniques: [
      'Méditation guidée audio (1x/semaine)',
      'Scan corporel approfondi',
      'Marche méditative',
      'Moments de pause consciente',
    ],
  },
  balance: {
    id: 'balance',
    name: 'Équilibre',
    description: 'Gérer le stress et créer des routines durables',
    durationWeeks: 3,
    focus: 'Gestion du Stress & Routines',
    objectives: [
      'Écouter la méditation guidée de la semaine',
      'Identifier les déclencheurs de stress',
      'Appliquer des techniques de régulation émotionnelle',
      'Établir des rituels matinaux et du soir',
    ],
    dailyPractices: {
      breathingExercises: 3,
      gratitudeEntries: 3,
      sleepHours: 8,
    },
    weeklyGoals: {
      meditationSessions: 1,
      journalEntries: 7,
      digitalDetoxHours: 14,
      socialConnections: 4,
    },
    techniques: [
      'Méditation guidée audio (1x/semaine)',
      'Journaling émotionnel',
      'Technique STOP (stress instantané)',
      'Visualisation positive',
    ],
  },
  harmony: {
    id: 'harmony',
    name: 'Harmonie',
    description: 'Maintenir et approfondir les acquis pour un bien-être durable',
    durationWeeks: 0, // Ongoing
    focus: 'Intégration & Maintenance',
    objectives: [
      'Réécouter les méditations selon tes besoins',
      'Intégrer les pratiques dans la vie quotidienne',
      'Cultiver les relations sociales positives',
      'Maintenir l\'équilibre à long terme',
    ],
    dailyPractices: {
      breathingExercises: 2,
      gratitudeEntries: 3,
      sleepHours: 8,
    },
    weeklyGoals: {
      meditationSessions: 1,
      journalEntries: 7,
      digitalDetoxHours: 14,
      socialConnections: 5,
    },
    techniques: [
      'Réécoute des méditations préférées',
      'Pratique libre personnalisée',
      'Cohérence cardiaque quotidienne',
      'Partage et soutien communautaire',
    ],
  },
}

export interface WellnessDailyLog {
  date: string
  // Sommeil
  sleepHours?: number
  sleepQuality?: 1 | 2 | 3 | 4 | 5
  sleepTime?: string // Heure du coucher
  wakeTime?: string // Heure du réveil
  // Respiration (méditation TTS trackée dans meditation-store)
  breathingExercises?: number
  breathingType?: '4-7-8' | 'coherence' | 'diaphragmatic' | 'box'
  // État mental
  moodLevel?: 1 | 2 | 3 | 4 | 5
  stressLevel?: 1 | 2 | 3 | 4 | 5
  anxietyLevel?: 1 | 2 | 3 | 4 | 5
  energyLevel?: 1 | 2 | 3 | 4 | 5
  // Pratiques
  gratitudeEntries?: string[]
  journalEntry?: string
  digitalDetoxMinutes?: number
  socialConnection?: boolean
  natureTime?: number // minutes en extérieur/nature
  // Notes
  notes?: string
  insights?: string // Prises de conscience
}

export interface WellnessWeekSummary {
  weekNumber: number
  startDate: string
  endDate: string
  phase: WellnessPhase
  // Moyennes
  avgSleepHours: number
  avgSleepQuality: number
  avgMood: number
  avgStress: number
  avgEnergy: number
  // Totaux (méditation TTS trackée dans meditation-store)
  totalBreathingExercises: number
  totalGratitudeEntries: number
  totalDigitalDetoxMinutes: number
  socialConnections: number
  // Performance
  completionRate: number
  objectivesAchieved: string[]
  areasToImprove: string[]
  insights: string[]
}

export interface WellnessPhaseTransition {
  id: string
  fromPhase: WellnessPhase
  toPhase: WellnessPhase
  title: string
  message: string
  newTechniques: string[]
  createdAt: string
  isRead: boolean
}

export interface WellnessProgramState {
  // Program state
  isEnrolled: boolean
  enrolledAt: string | null
  currentPhase: WellnessPhase
  currentWeek: number
  phaseStartDate: string | null
  completedAt: string | null // Date de complétion du programme

  // Tracking
  dailyLogs: WellnessDailyLog[]
  weekSummaries: WellnessWeekSummary[]

  // Progress
  totalWeeksCompleted: number
  currentStreak: number
  longestStreak: number
  totalBreathingExercises: number
  // Note: méditation TTS trackée dans meditation-store (sessionsCompleted, totalMeditationMinutes)

  // Visibility logic (interaction with Metabolic program)
  isHiddenDueToMetabolic: boolean
  wasProposedAfterMetabolic: boolean

  // Phase transitions
  phaseTransitions: WellnessPhaseTransition[]

  // Actions
  enroll: () => void
  unenroll: () => void
  reset: () => void // Reset all data (for new user or account switch)
  logDaily: (log: Omit<WellnessDailyLog, 'date'>) => void
  getTodayLog: () => WellnessDailyLog | null
  getWeekLogs: (weekNumber?: number) => WellnessDailyLog[]
  calculateWeekSummary: (weekNumber: number) => WellnessWeekSummary | null
  checkPhaseProgression: () => { canProgress: boolean; reason?: string }
  progressToNextPhase: () => boolean
  getCurrentPhaseConfig: () => WellnessPhaseConfig
  getProgressPercentage: () => number

  // Visibility management
  setHiddenDueToMetabolic: (hidden: boolean) => void
  proposeAfterMetabolic: () => void
  shouldShowProgram: (isMetabolicEnrolled: boolean, isMetabolicCompleted: boolean) => boolean

  // Phase transitions
  getUnreadTransition: () => WellnessPhaseTransition | null
  markTransitionRead: (id: string) => void

  // AI evaluation
  evaluateProgressionWithAI: (userProfile: UserProfile) => Promise<ProgramAdaptation>

  // Stats
  getTotalStats: () => {
    totalDays: number
    totalBreathingExercises: number
    avgSleepQuality: number
    avgMood: number
    streakRecord: number
  }
}

const getDateString = () => new Date().toISOString().split('T')[0]

const getWeekNumber = (startDate: string, currentDate: string): number => {
  const start = new Date(startDate)
  const current = new Date(currentDate)
  const diffTime = current.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.floor(diffDays / 7) + 1
}

// Messages de transition entre phases
const getPhaseTransitionMessage = (
  fromPhase: WellnessPhase,
  toPhase: WellnessPhase
): { title: string; message: string; techniques: string[] } => {
  const messages: Record<string, { title: string; message: string; techniques: string[] }> = {
    'foundations_awareness': {
      title: '🧘 Bienvenue dans la Phase Conscience',
      message: 'Tu as établi de solides fondations avec ton sommeil et ta respiration. Il est temps d\'approfondir ta pratique avec la méditation et la pleine conscience.',
      techniques: WELLNESS_PHASE_CONFIGS.awareness.techniques,
    },
    'awareness_balance': {
      title: '⚖️ Cap sur l\'Équilibre',
      message: 'Ta conscience s\'est développée. Maintenant, appliquons ces acquis pour gérer le stress et créer des routines durables.',
      techniques: WELLNESS_PHASE_CONFIGS.balance.techniques,
    },
    'balance_harmony': {
      title: '✨ Tu as atteint l\'Harmonie',
      message: 'Félicitations ! Tu as intégré toutes les pratiques. Maintenant, c\'est le moment de personnaliser ton parcours et de maintenir tes acquis à long terme.',
      techniques: WELLNESS_PHASE_CONFIGS.harmony.techniques,
    },
  }

  return messages[`${fromPhase}_${toPhase}`] || {
    title: 'Nouvelle Phase',
    message: 'Tu progresses vers la prochaine étape de ton parcours bien-être.',
    techniques: [],
  }
}

export const useWellnessProgramStore = create<WellnessProgramState>()(
  persist(
    (set, get) => ({
      isEnrolled: false,
      enrolledAt: null,
      currentPhase: 'foundations',
      currentWeek: 1,
      phaseStartDate: null,
      completedAt: null,
      dailyLogs: [],
      weekSummaries: [],
      totalWeeksCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalBreathingExercises: 0,
      isHiddenDueToMetabolic: false,
      wasProposedAfterMetabolic: false,
      phaseTransitions: [],

      enroll: () => {
        const now = getDateString()
        set({
          isEnrolled: true,
          enrolledAt: now,
          currentPhase: 'foundations',
          currentWeek: 1,
          phaseStartDate: now,
          completedAt: null,
          dailyLogs: [],
          weekSummaries: [],
          totalWeeksCompleted: 0,
          currentStreak: 0,
          totalBreathingExercises: 0,
          isHiddenDueToMetabolic: false,
        })

        // Track program enrollment
        analytics.track('program_started', {
          program_id: 'wellness_program',
          program_name: 'Programme Bien-être',
        })
      },

      unenroll: () => {
        set({
          isEnrolled: false,
          enrolledAt: null,
          currentPhase: 'foundations',
          currentWeek: 1,
          phaseStartDate: null,
        })
      },

      // Reset all data (for new user or account switch)
      reset: () => {
        set({
          isEnrolled: false,
          enrolledAt: null,
          currentPhase: 'foundations',
          currentWeek: 1,
          phaseStartDate: null,
          completedAt: null,
          dailyLogs: [],
          weekSummaries: [],
          totalWeeksCompleted: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalBreathingExercises: 0,
          isHiddenDueToMetabolic: false,
          wasProposedAfterMetabolic: false,
          phaseTransitions: [],
        })
      },

      logDaily: (log) => {
        const today = getDateString()
        const { dailyLogs, currentStreak, longestStreak, totalBreathingExercises } = get()

        const existingIndex = dailyLogs.findIndex(l => l.date === today)
        const existingLog = existingIndex >= 0 ? dailyLogs[existingIndex] : null
        const newLog: WellnessDailyLog = { ...log, date: today }

        let updatedLogs: WellnessDailyLog[]
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
        const hadTodayLog = existingIndex >= 0

        const newStreak = hadTodayLog ? currentStreak : (hasYesterdayLog ? currentStreak + 1 : 1)
        const newLongest = Math.max(longestStreak, newStreak)

        // Update breathing totals
        const prevBreathing = existingLog?.breathingExercises || 0
        const newBreathing = log.breathingExercises || 0

        set({
          dailyLogs: updatedLogs,
          currentStreak: newStreak,
          longestStreak: newLongest,
          totalBreathingExercises: totalBreathingExercises - prevBreathing + newBreathing,
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

        const config = WELLNESS_PHASE_CONFIGS[currentPhase]

        // Calculate averages
        const avgSleep = logs.reduce((sum, l) => sum + (l.sleepHours || 0), 0) / logs.length
        const avgSleepQuality = logs.reduce((sum, l) => sum + (l.sleepQuality || 3), 0) / logs.length
        const avgMood = logs.reduce((sum, l) => sum + (l.moodLevel || 3), 0) / logs.length
        const avgStress = logs.reduce((sum, l) => sum + (l.stressLevel || 3), 0) / logs.length
        const avgEnergy = logs.reduce((sum, l) => sum + (l.energyLevel || 3), 0) / logs.length

        // Calculate totals (méditation TTS trackée séparément dans meditation-store)
        const totalBreathing = logs.reduce((sum, l) => sum + (l.breathingExercises || 0), 0)
        const totalGratitude = logs.reduce((sum, l) => sum + (l.gratitudeEntries?.length || 0), 0)
        const totalDetox = logs.reduce((sum, l) => sum + (l.digitalDetoxMinutes || 0), 0)
        const socialConnections = logs.filter(l => l.socialConnection).length

        // Completion rate
        const completionRate = (logs.length / 7) * 100

        // Objectives achieved
        const objectivesAchieved: string[] = []
        const areasToImprove: string[] = []

        if (avgSleep >= config.dailyPractices.sleepHours) {
          objectivesAchieved.push('Objectif sommeil atteint')
        } else {
          areasToImprove.push('Améliorer la durée de sommeil')
        }

        // Note: Objectif méditation vérifié via meditation-store.sessionsCompleted

        if (avgStress <= 2.5) {
          objectivesAchieved.push('Stress bien géré')
        } else if (avgStress >= 4) {
          areasToImprove.push('Travailler sur la gestion du stress')
        }

        // Generate insights
        const insights: string[] = []
        if (avgMood >= 4) insights.push('Excellente humeur cette semaine')
        if (avgSleepQuality >= 4) insights.push('Qualité de sommeil optimale')
        if (socialConnections >= config.weeklyGoals.socialConnections) {
          insights.push('Bon équilibre social')
        }

        return {
          weekNumber,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          phase: currentPhase,
          avgSleepHours: Math.round(avgSleep * 10) / 10,
          avgSleepQuality: Math.round(avgSleepQuality * 10) / 10,
          avgMood: Math.round(avgMood * 10) / 10,
          avgStress: Math.round(avgStress * 10) / 10,
          avgEnergy: Math.round(avgEnergy * 10) / 10,
          totalBreathingExercises: totalBreathing,
          totalGratitudeEntries: totalGratitude,
          totalDigitalDetoxMinutes: totalDetox,
          socialConnections,
          completionRate: Math.round(completionRate),
          objectivesAchieved,
          areasToImprove,
          insights,
        }
      },

      checkPhaseProgression: () => {
        const { currentPhase, currentWeek, calculateWeekSummary } = get()
        const config = WELLNESS_PHASE_CONFIGS[currentPhase]

        // Harmony doesn't progress further
        if (currentPhase === 'harmony') {
          return { canProgress: false, reason: 'Programme complet - phase Harmonie atteinte' }
        }

        // Check minimum weeks
        if (currentWeek < config.durationWeeks) {
          return { canProgress: false, reason: `Semaine ${currentWeek}/${config.durationWeeks}` }
        }

        // Check last week's completion
        const lastWeekSummary = calculateWeekSummary(currentWeek)
        if (!lastWeekSummary || lastWeekSummary.completionRate < 60) {
          return { canProgress: false, reason: 'Complétion < 60% cette semaine' }
        }

        // Check mood and stress (don't progress if struggling)
        if (lastWeekSummary.avgMood < 2.5) {
          return { canProgress: false, reason: 'Humeur trop basse - prendre soin de toi d\'abord' }
        }
        if (lastWeekSummary.avgStress >= 4) {
          return { canProgress: false, reason: 'Niveau de stress élevé - consolider les acquis' }
        }

        return { canProgress: true }
      },

      progressToNextPhase: () => {
        const { currentPhase, checkPhaseProgression, weekSummaries, currentWeek, calculateWeekSummary, totalWeeksCompleted, phaseTransitions } = get()
        const { canProgress } = checkPhaseProgression()

        if (!canProgress) return false

        // Save current week summary
        const summary = calculateWeekSummary(currentWeek)
        const updatedSummaries = summary ? [...weekSummaries, summary] : weekSummaries

        // Determine next phase
        const phases: WellnessPhase[] = ['foundations', 'awareness', 'balance', 'harmony']
        const currentIndex = phases.indexOf(currentPhase)
        const nextPhase = phases[currentIndex + 1] || 'harmony'

        // Create phase transition
        const transitionMessage = getPhaseTransitionMessage(currentPhase, nextPhase)
        const transition: WellnessPhaseTransition = {
          id: `wellness_transition_${Date.now()}`,
          fromPhase: currentPhase,
          toPhase: nextPhase,
          title: transitionMessage.title,
          message: transitionMessage.message,
          newTechniques: transitionMessage.techniques,
          createdAt: new Date().toISOString(),
          isRead: false,
        }

        const isCompleted = nextPhase === 'harmony'

        set({
          currentPhase: nextPhase,
          currentWeek: 1,
          phaseStartDate: getDateString(),
          weekSummaries: updatedSummaries,
          totalWeeksCompleted: totalWeeksCompleted + WELLNESS_PHASE_CONFIGS[currentPhase].durationWeeks,
          phaseTransitions: [...phaseTransitions, transition],
          completedAt: isCompleted ? getDateString() : null,
        })

        // Track phase progression
        analytics.track('program_day_completed', {
          program_id: 'wellness_program',
          program_name: `Phase ${nextPhase}`,
          day_number: totalWeeksCompleted + WELLNESS_PHASE_CONFIGS[currentPhase].durationWeeks,
        })

        // Track program completion
        if (isCompleted) {
          analytics.track('program_completed', {
            program_id: 'wellness_program',
            program_name: 'Programme Bien-être',
          })
        }

        return true
      },

      getCurrentPhaseConfig: () => {
        return WELLNESS_PHASE_CONFIGS[get().currentPhase]
      },

      getProgressPercentage: () => {
        const { currentPhase, currentWeek, totalWeeksCompleted } = get()

        // Total program is approximately 8 weeks (2+3+3)
        const totalExpectedWeeks = 8
        const completedWeeks = totalWeeksCompleted + (currentWeek - 1)

        if (currentPhase === 'harmony') return 100

        return Math.min(100, Math.round((completedWeeks / totalExpectedWeeks) * 100))
      },

      // Visibility management for Metabolic program interaction
      setHiddenDueToMetabolic: (hidden) => {
        set({ isHiddenDueToMetabolic: hidden })
      },

      proposeAfterMetabolic: () => {
        set({
          wasProposedAfterMetabolic: true,
          isHiddenDueToMetabolic: false,
        })
      },

      shouldShowProgram: (_isMetabolicEnrolled, _isMetabolicCompleted) => {
        // Les deux programmes peuvent cohabiter - toujours afficher Wellness
        return true
      },

      getUnreadTransition: () => {
        const { phaseTransitions } = get()
        return phaseTransitions.find(t => !t.isRead) || null
      },

      markTransitionRead: (id) => {
        const { phaseTransitions } = get()
        set({
          phaseTransitions: phaseTransitions.map(t =>
            t.id === id ? { ...t, isRead: true } : t
          ),
        })
      },

      evaluateProgressionWithAI: async (userProfile) => {
        const { currentPhase, currentWeek, getWeekLogs, calculateWeekSummary } = get()

        const recentLogs = getWeekLogs(currentWeek)
        const weekSummary = calculateWeekSummary(currentWeek)

        // Calculate averages from logs
        const avgSleep = recentLogs.length > 0
          ? recentLogs.reduce((sum, l) => sum + (l.sleepHours || 7), 0) / recentLogs.length
          : undefined
        const avgMood = recentLogs.length > 0
          ? recentLogs.reduce((sum, l) => sum + (l.moodLevel || 3), 0) / recentLogs.length
          : undefined
        const avgStress = recentLogs.length > 0
          ? recentLogs.reduce((sum, l) => sum + (l.stressLevel || 3), 0) / recentLogs.length
          : undefined
        const avgEnergy = recentLogs.length > 0
          ? recentLogs.reduce((sum, l) => sum + (l.energyLevel || 3), 0) / recentLogs.length
          : undefined

        // Build LymIA context (using metabolic_boost type as fallback since wellness not in type)
        const userContext: UserContext = {
          profile: userProfile,
          todayNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          weeklyAverage: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          currentStreak: recentLogs.length,
          lastMeals: [],
          wellnessData: {
            sleepHours: avgSleep,
            stressLevel: avgStress ? avgStress * 2 : undefined,
            energyLevel: avgEnergy,
          },
          // Note: programProgress not included for wellness as it's not in the type definition
        }

        try {
          // Use metabolic_boost as proxy since wellness type not defined in LymIABrain
          return await LymIABrain.evaluateProgramProgress(userContext, 'metabolic_boost')
        } catch (error) {
          console.error('LymIA wellness evaluation failed:', error)
          // Fallback to basic check
          const { canProgress, reason } = get().checkPhaseProgression()
          return {
            shouldProgress: canProgress,
            nextPhaseReady: canProgress,
            adjustments: [],
            decision: canProgress ? 'Prêt pour progression' : (reason || 'Pas encore prêt'),
            reasoning: reason || 'Évaluation basique (fallback)',
            confidence: 0.5,
            sources: [],
          }
        }
      },

      getTotalStats: () => {
        const { dailyLogs, longestStreak, totalBreathingExercises } = get()

        const logsWithSleep = dailyLogs.filter(l => l.sleepQuality)
        const avgSleepQuality = logsWithSleep.length > 0
          ? logsWithSleep.reduce((sum, l) => sum + (l.sleepQuality || 0), 0) / logsWithSleep.length
          : 0

        const logsWithMood = dailyLogs.filter(l => l.moodLevel)
        const avgMood = logsWithMood.length > 0
          ? logsWithMood.reduce((sum, l) => sum + (l.moodLevel || 0), 0) / logsWithMood.length
          : 0

        return {
          totalDays: dailyLogs.length,
          totalBreathingExercises,
          avgSleepQuality: Math.round(avgSleepQuality * 10) / 10,
          avgMood: Math.round(avgMood * 10) / 10,
          streakRecord: longestStreak,
        }
      },
    }),
    {
      name: 'wellness-program-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

export default useWellnessProgramStore
