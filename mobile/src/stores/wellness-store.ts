import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { WellnessEntry, WellnessTargets, WellnessStreaks, LifestyleHabits } from '../types'
import { useGamificationStore, XP_REWARDS } from './gamification-store'
import { trackAppEvent } from '../services/weekly-challenges-service'
import { useUserStore } from './user-store'

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

interface WellnessState {
  entries: Record<string, WellnessEntry> // key: YYYY-MM-DD
  targets: WellnessTargets
  streaks: WellnessStreaks
  lastCheckinDate: string | null

  // Actions
  logWellnessEntry: (entry: Omit<WellnessEntry, 'id' | 'date' | 'createdAt'>) => void
  updateEntry: (date: string, updates: Partial<WellnessEntry>) => void
  logSleep: (hours: number, quality: 1 | 2 | 3 | 4 | 5) => void
  logSteps: (steps: number) => void
  logWater: (liters: number) => void
  setTargets: (targets: Partial<WellnessTargets>) => void
  initializeFromLifestyle: (habits: LifestyleHabits) => void
  updateStreaks: () => void

  // Getters
  todayScore: () => number // Computed property for today's score
  getTodayEntry: () => WellnessEntry | null
  getEntryForDate: (date: string) => WellnessEntry | null
  getWellnessScore: (date?: string) => number
  getWeeklyAverage: () => {
    sleep: number
    energy: number
    stress: number
    steps: number
  }
}

const DEFAULT_TARGETS: WellnessTargets = {
  sleepHours: 7,
  steps: 8000,
  waterMl: 2500,
  waterLiters: 2.5,
  fiberG: 30,
}

export const useWellnessStore = create<WellnessState>()(
  persist(
    (set, get) => ({
      entries: {},
      targets: DEFAULT_TARGETS,
      streaks: {
        sleep7h: 0,
        hydration: 0,
        steps: 0,
        fiber: 0,
      },
      lastCheckinDate: null,

      logWellnessEntry: (entryData) => {
        const today = getTodayString()
        const entry: WellnessEntry = {
          ...entryData,
          id: generateId(),
          date: today,
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          entries: {
            ...state.entries,
            [today]: entry,
          },
          lastCheckinDate: today,
        }))

        // Update streaks
        get().updateStreaks()

        // Gamification
        const gamification = useGamificationStore.getState()
        gamification.addXP(XP_REWARDS.LOG_WELLNESS_CHECKIN, 'Check-in bien-etre')

        // Bonus XP for good values
        if (entryData.sleepHours && entryData.sleepHours >= 7) {
          gamification.addXP(XP_REWARDS.GOOD_SLEEP_7H, '7h+ de sommeil')
        }
        if (entryData.stressLevel && entryData.stressLevel <= 2) {
          gamification.addXP(XP_REWARDS.LOW_STRESS_DAY, 'Stress faible')
        }
        if (entryData.energyLevel && entryData.energyLevel >= 4) {
          gamification.addXP(XP_REWARDS.HIGH_ENERGY_DAY, 'Energie elevee')
        }

        // Check wellness score badge
        const score = get().getWellnessScore(today)
        if (score >= 80) {
          gamification.addXP(XP_REWARDS.WELLNESS_SCORE_80, 'Score wellness >= 80')
        }
      },

      updateEntry: (date, updates) => {
        set((state) => {
          const existing = state.entries[date]
          if (!existing) return state

          return {
            entries: {
              ...state.entries,
              [date]: { ...existing, ...updates },
            },
          }
        })
      },

      logSleep: (hours, quality) => {
        const today = getTodayString()
        set((state) => {
          const existing = state.entries[today]
          const entry: WellnessEntry = existing || {
            id: generateId(),
            date: today,
            createdAt: new Date().toISOString(),
          }

          return {
            entries: {
              ...state.entries,
              [today]: {
                ...entry,
                sleepHours: hours,
                sleepQuality: quality,
              },
            },
          }
        })

        const gamification = useGamificationStore.getState()
        gamification.addXP(XP_REWARDS.LOG_SLEEP, 'Sommeil enregistré')
        if (hours >= 7) {
          gamification.addXP(XP_REWARDS.GOOD_SLEEP_7H, '7h+ de sommeil')
        }

        // Track for weekly challenges
        const userId = useUserStore.getState().profile?.id
        if (userId) {
          trackAppEvent(userId, 'SLEEP_LOGGED', hours).catch(() => {})
        }

        get().updateStreaks()
      },

      logSteps: (steps) => {
        const today = getTodayString()
        set((state) => {
          const existing = state.entries[today]
          const entry: WellnessEntry = existing || {
            id: generateId(),
            date: today,
            createdAt: new Date().toISOString(),
          }

          return {
            entries: {
              ...state.entries,
              [today]: {
                ...entry,
                steps,
              },
            },
          }
        })

        if (steps >= get().targets.steps) {
          const gamification = useGamificationStore.getState()
          gamification.addXP(XP_REWARDS.REACH_STEPS_TARGET, 'Objectif pas atteint')
        }

        get().updateStreaks()
      },

      logWater: (liters) => {
        const today = getTodayString()
        set((state) => {
          const existing = state.entries[today]
          const entry: WellnessEntry = existing || {
            id: generateId(),
            date: today,
            createdAt: new Date().toISOString(),
          }

          return {
            entries: {
              ...state.entries,
              [today]: {
                ...entry,
                waterLiters: liters,
              },
            },
          }
        })

        if (liters >= get().targets.waterLiters) {
          const gamification = useGamificationStore.getState()
          gamification.addXP(XP_REWARDS.REACH_HYDRATION_TARGET, 'Objectif hydratation atteint')
        }

        // Track for weekly challenges
        const userId = useUserStore.getState().profile?.id
        if (userId) {
          trackAppEvent(userId, 'WATER_LOGGED', liters).catch(() => {})
        }
      },

      setTargets: (targets) => {
        set((state) => ({
          targets: { ...state.targets, ...targets },
        }))
      },

      initializeFromLifestyle: (habits) => {
        // Personnaliser les objectifs selon les habitudes de l'utilisateur
        const personalizedTargets: Partial<WellnessTargets> = {}

        // Objectif eau basé sur waterIntakeDaily de l'onboarding
        if (habits.waterIntakeDaily) {
          // Objectif = +0.5L par rapport à la consommation actuelle (pour encourager)
          // Mais minimum 2L, maximum 3L
          const waterGoal = Math.min(3, Math.max(2, habits.waterIntakeDaily + 0.5))
          personalizedTargets.waterLiters = waterGoal
          personalizedTargets.waterMl = waterGoal * 1000
        }

        // Objectif sommeil basé sur averageSleepHours
        if (habits.averageSleepHours) {
          // Si l'utilisateur dort déjà 7h+, on garde 7h
          // Sinon objectif = actuel + 0.5h (progressif)
          const sleepGoal = habits.averageSleepHours >= 7
            ? 7
            : Math.min(7, habits.averageSleepHours + 0.5)
          personalizedTargets.sleepHours = sleepGoal
        }

        if (Object.keys(personalizedTargets).length > 0) {
          set((state) => ({
            targets: { ...state.targets, ...personalizedTargets },
          }))
        }
      },

      updateStreaks: () => {
        const { entries, targets } = get()
        const today = new Date()
        let sleepStreak = 0
        let stepsStreak = 0

        // Count consecutive days
        for (let i = 0; i < 100; i++) {
          const date = new Date(today)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]
          const entry = entries[dateStr]

          if (!entry) break

          if (entry.sleepHours && entry.sleepHours >= targets.sleepHours) {
            sleepStreak++
          } else if (i > 0) {
            break
          }

          if (entry.steps && entry.steps >= targets.steps) {
            stepsStreak++
          }
        }

        set((state) => ({
          streaks: {
            ...state.streaks,
            sleep7h: sleepStreak,
            steps: stepsStreak,
          },
        }))

        // Update gamification metrics
        const gamification = useGamificationStore.getState()
        gamification.setMetric('sleep_7h_streak', sleepStreak)
      },

      todayScore: () => {
        return get().getWellnessScore(getTodayString())
      },

      getTodayEntry: () => {
        const today = getTodayString()
        return get().entries[today] || null
      },

      getEntryForDate: (date) => {
        return get().entries[date] || null
      },

      getWellnessScore: (date) => {
        const targetDate = date || getTodayString()
        const entry = get().entries[targetDate]
        if (!entry) return 0

        let score = 0
        let factors = 0

        // Sleep (max 25 points)
        if (entry.sleepHours) {
          factors++
          const sleepScore = Math.min(25, (entry.sleepHours / 8) * 25)
          score += sleepScore
        }

        // Sleep quality (max 15 points)
        if (entry.sleepQuality) {
          factors++
          score += (entry.sleepQuality / 5) * 15
        }

        // Energy (max 20 points)
        if (entry.energyLevel) {
          factors++
          score += (entry.energyLevel / 5) * 20
        }

        // Stress (inverted - lower is better, max 20 points)
        if (entry.stressLevel) {
          factors++
          score += ((6 - entry.stressLevel) / 5) * 20
        }

        // Mood (max 10 points)
        if (entry.mood) {
          factors++
          score += (entry.mood / 5) * 10
        }

        // Steps (max 10 points)
        if (entry.steps) {
          factors++
          const { targets } = get()
          score += Math.min(10, (entry.steps / targets.steps) * 10)
        }

        return factors > 0 ? Math.round(score) : 0
      },

      getWeeklyAverage: () => {
        const { entries } = get()
        const today = new Date()
        let totalSleep = 0
        let totalEnergy = 0
        let totalStress = 0
        let totalSteps = 0
        let count = 0

        for (let i = 0; i < 7; i++) {
          const date = new Date(today)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]
          const entry = entries[dateStr]

          if (entry) {
            count++
            totalSleep += entry.sleepHours || 0
            totalEnergy += entry.energyLevel || 0
            totalStress += entry.stressLevel || 0
            totalSteps += entry.steps || 0
          }
        }

        return {
          sleep: count > 0 ? Math.round((totalSleep / count) * 10) / 10 : 0,
          energy: count > 0 ? Math.round((totalEnergy / count) * 10) / 10 : 0,
          stress: count > 0 ? Math.round((totalStress / count) * 10) / 10 : 0,
          steps: count > 0 ? Math.round(totalSteps / count) : 0,
        }
      },
    }),
    {
      name: 'presence-wellness',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        entries: state.entries,
        targets: state.targets,
        streaks: state.streaks,
        lastCheckinDate: state.lastCheckinDate,
      }),
    }
  )
)

export default useWellnessStore
