import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DailyWellness } from '@/types'
import { useGamificationStore, XP_REWARDS } from './gamification-store'

// Helper to get today's date string
function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

// Calculate wellness score (0-100)
function calculateWellnessScore(entry: DailyWellness, targets: WellnessTargets): number {
  let score = 0

  // Protein score (20 points) - based on percentage of target
  const proteinRatio = Math.min(entry.proteinGrams / targets.proteinGrams, 1)
  score += proteinRatio * 20

  // Fiber score (15 points) - 30g target
  const fiberRatio = Math.min(entry.fiberGrams / targets.fiberGrams, 1)
  score += fiberRatio * 15

  // Sleep score (20 points) - 7-9h optimal range
  if (entry.sleepHours >= 7 && entry.sleepHours <= 9) {
    score += 15
    // Bonus for quality
    if (entry.sleepQuality >= 3) score += 5
  } else if (entry.sleepHours >= 6 && entry.sleepHours < 7) {
    score += 10
    if (entry.sleepQuality >= 4) score += 3
  } else if (entry.sleepHours > 9) {
    score += 12 // Too much sleep is not ideal either
  } else {
    score += Math.max(0, (entry.sleepHours / 7) * 10)
  }

  // Hydration score (10 points) - 2.5L target
  const waterRatio = Math.min(entry.waterLiters / targets.waterLiters, 1)
  score += waterRatio * 10

  // Activity score (20 points) - based on steps
  const stepsRatio = Math.min(entry.steps / targets.dailySteps, 1)
  score += stepsRatio * 15
  // NEAT bonus
  if (entry.neatMinutes >= 30) score += 5
  else score += (entry.neatMinutes / 30) * 5

  // Stress & Energy score (15 points)
  // Low stress = good (1=zen, 5=stressed)
  const stressScore = (5 - entry.stressLevel) / 4 * 7.5
  // High energy = good
  const energyScore = (entry.energyLevel - 1) / 4 * 7.5
  score += stressScore + energyScore

  return Math.round(Math.min(100, Math.max(0, score)))
}

interface WellnessTargets {
  proteinGrams: number
  fiberGrams: number
  waterLiters: number
  dailySteps: number
  sleepHours: number
}

interface WellnessState {
  // Data
  entries: Record<string, DailyWellness> // key: YYYY-MM-DD
  targets: WellnessTargets
  currentDate: string

  // Computed
  todayScore: number
  weeklyAverageScore: number
  streaks: {
    sleep7h: number
    fiber30g: number
    water2L: number
    steps: number
    lowStress: number
  }

  // Actions
  setCurrentDate: (date: string) => void
  updateEntry: (date: string, updates: Partial<DailyWellness>) => void
  setTargets: (targets: Partial<WellnessTargets>) => void

  // Quick log actions
  logSleep: (hours: number, quality: 1 | 2 | 3 | 4 | 5) => void
  logStress: (level: 1 | 2 | 3 | 4 | 5) => void
  logEnergy: (level: 1 | 2 | 3 | 4 | 5) => void
  logSteps: (steps: number) => void
  logNeat: (minutes: number) => void
  logWater: (liters: number) => void
  logFiber: (grams: number) => void
  logProtein: (grams: number) => void
  logMenstrualPhase: (phase: DailyWellness['menstrualPhase']) => void

  // Computed actions
  getEntryForDate: (date: string) => DailyWellness | null
  getWeekEntries: (startDate: string) => DailyWellness[]
  calculateScore: (date: string) => number
  getInsights: () => WellnessInsight[]
}

interface WellnessInsight {
  type: 'positive' | 'improvement' | 'warning'
  category: 'sleep' | 'stress' | 'nutrition' | 'activity'
  message: string
  actionable?: string
}

const defaultTargets: WellnessTargets = {
  proteinGrams: 120, // Will be personalized
  fiberGrams: 30,
  waterLiters: 2.5,
  dailySteps: 7000,
  sleepHours: 8,
}

const createEmptyEntry = (date: string): DailyWellness => ({
  date,
  sleepHours: 0,
  sleepQuality: 3,
  fiberGrams: 0,
  proteinGrams: 0,
  waterLiters: 0,
  steps: 0,
  neatMinutes: 0,
  stressLevel: 3,
  energyLevel: 3,
})

export const useWellnessStore = create<WellnessState>()(
  persist(
    (set, get) => ({
      // Initial state
      entries: {},
      targets: defaultTargets,
      currentDate: getTodayString(),
      todayScore: 0,
      weeklyAverageScore: 0,
      streaks: {
        sleep7h: 0,
        fiber30g: 0,
        water2L: 0,
        steps: 0,
        lowStress: 0,
      },

      // Actions
      setCurrentDate: (date) => set({ currentDate: date }),

      updateEntry: (date, updates) => {
        const { entries, targets } = get()
        const existingEntry = entries[date] || createEmptyEntry(date)
        const updatedEntry = { ...existingEntry, ...updates, date }

        const newEntries = { ...entries, [date]: updatedEntry }

        // Recalculate today's score if it's today
        const today = getTodayString()
        const todayScore = date === today ? calculateWellnessScore(updatedEntry, targets) : get().todayScore

        // Calculate streaks
        const streaks = calculateStreaks(newEntries, targets)

        // Calculate weekly average
        const weeklyAverageScore = calculateWeeklyAverage(newEntries, targets, today)

        set({
          entries: newEntries,
          todayScore,
          weeklyAverageScore,
          streaks,
        })
      },

      setTargets: (newTargets) => {
        const targets = { ...get().targets, ...newTargets }
        set({ targets })
      },

      // Quick log actions
      logSleep: (hours, quality) => {
        const gamification = useGamificationStore.getState()
        get().updateEntry(getTodayString(), { sleepHours: hours, sleepQuality: quality })

        // Gamification: XP for logging sleep
        gamification.addXP(XP_REWARDS.LOG_SLEEP, 'Sommeil enregistre')

        // Bonus XP for good sleep (7h+)
        if (hours >= 7) {
          gamification.addXP(XP_REWARDS.GOOD_SLEEP_7H, 'Bonne nuit de sommeil')
          gamification.incrementMetric('sleep_7h_streak')
        } else {
          gamification.setMetric('sleep_7h_streak', 0)
        }
      },

      logStress: (level) => {
        const gamification = useGamificationStore.getState()
        get().updateEntry(getTodayString(), { stressLevel: level })

        // Gamification: XP for low stress
        if (level <= 2) {
          gamification.addXP(XP_REWARDS.LOW_STRESS_DAY, 'Journee zen')
          gamification.incrementMetric('low_stress_streak')
        } else {
          gamification.setMetric('low_stress_streak', 0)
        }
      },

      logEnergy: (level) => {
        const gamification = useGamificationStore.getState()
        get().updateEntry(getTodayString(), { energyLevel: level })

        // Gamification: XP for high energy
        if (level >= 4) {
          gamification.addXP(XP_REWARDS.HIGH_ENERGY_DAY, 'Plein d\'energie')
          gamification.incrementMetric('high_energy_streak')
        } else {
          gamification.setMetric('high_energy_streak', 0)
        }
      },

      logSteps: (steps) => {
        const gamification = useGamificationStore.getState()
        const { targets } = get()
        get().updateEntry(getTodayString(), { steps })

        // Gamification: Check for steps milestone (10k)
        if (steps >= 10000) {
          gamification.setMetric('daily_steps', steps)
        }

        // XP for reaching steps target
        if (steps >= targets.dailySteps) {
          gamification.addXP(XP_REWARDS.REACH_STEPS_TARGET, 'Objectif pas atteint')
        }
      },

      logNeat: (minutes) => {
        const current = get().entries[getTodayString()]?.neatMinutes || 0
        get().updateEntry(getTodayString(), { neatMinutes: current + minutes })
      },

      logWater: (liters) => {
        const gamification = useGamificationStore.getState()
        const { targets } = get()
        const current = get().entries[getTodayString()]?.waterLiters || 0
        const newTotal = current + liters
        get().updateEntry(getTodayString(), { waterLiters: newTotal })

        // Gamification: XP for reaching water goal
        if (newTotal >= targets.waterLiters && current < targets.waterLiters) {
          gamification.addXP(XP_REWARDS.REACH_HYDRATION_TARGET, 'Objectif hydratation atteint')
          gamification.incrementMetric('water_goal_streak')
        }
      },

      logFiber: (grams) => {
        const gamification = useGamificationStore.getState()
        const { targets } = get()
        const current = get().entries[getTodayString()]?.fiberGrams || 0
        const newTotal = current + grams
        get().updateEntry(getTodayString(), { fiberGrams: newTotal })

        // Gamification: XP for reaching fiber goal (30g)
        if (newTotal >= targets.fiberGrams && current < targets.fiberGrams) {
          gamification.addXP(XP_REWARDS.REACH_FIBER_TARGET, 'Objectif fibres atteint')
          gamification.incrementMetric('fiber_30g_streak')
        }
      },

      logProtein: (grams) => {
        const gamification = useGamificationStore.getState()
        const { targets } = get()
        const current = get().entries[getTodayString()]?.proteinGrams || 0
        const newTotal = current + grams
        get().updateEntry(getTodayString(), { proteinGrams: newTotal })

        // Gamification: Track protein goal streak
        if (newTotal >= targets.proteinGrams && current < targets.proteinGrams) {
          gamification.addXP(XP_REWARDS.REACH_PROTEIN_TARGET, 'Objectif proteines atteint')
          gamification.incrementMetric('protein_goal_streak')
        }
      },

      logMenstrualPhase: (phase) => {
        get().updateEntry(getTodayString(), { menstrualPhase: phase })
      },

      // Computed actions
      getEntryForDate: (date) => {
        return get().entries[date] || null
      },

      getWeekEntries: (startDate) => {
        const entries = get().entries
        const result: DailyWellness[] = []
        const start = new Date(startDate)

        for (let i = 0; i < 7; i++) {
          const date = new Date(start)
          date.setDate(start.getDate() + i)
          const dateStr = date.toISOString().split('T')[0]
          if (entries[dateStr]) {
            result.push(entries[dateStr])
          }
        }

        return result
      },

      calculateScore: (date) => {
        const { entries, targets } = get()
        const entry = entries[date]
        if (!entry) return 0
        return calculateWellnessScore(entry, targets)
      },

      getInsights: () => {
        const { entries, targets, streaks } = get()
        const today = getTodayString()
        const todayEntry = entries[today]
        const insights: WellnessInsight[] = []

        if (!todayEntry) return insights

        // Sleep insights
        if (streaks.sleep7h >= 7) {
          insights.push({
            type: 'positive',
            category: 'sleep',
            message: `${streaks.sleep7h} nuits de 7h+ consécutives !`,
          })
        } else if (todayEntry.sleepHours < 6) {
          insights.push({
            type: 'warning',
            category: 'sleep',
            message: 'Ton sommeil impacte ton métabolisme',
            actionable: 'Essaie de te coucher 30 min plus tôt ce soir',
          })
        }

        // Stress insights
        if (todayEntry.stressLevel >= 4) {
          insights.push({
            type: 'improvement',
            category: 'stress',
            message: 'Niveau de stress élevé détecté',
            actionable: 'Prends 5 min pour respirer profondément',
          })
        } else if (streaks.lowStress >= 5) {
          insights.push({
            type: 'positive',
            category: 'stress',
            message: `${streaks.lowStress} jours de zen consécutifs !`,
          })
        }

        // Fiber insights
        if (todayEntry.fiberGrams >= 25) {
          insights.push({
            type: 'positive',
            category: 'nutrition',
            message: 'Excellent apport en fibres !',
          })
        } else if (todayEntry.fiberGrams < 15) {
          insights.push({
            type: 'improvement',
            category: 'nutrition',
            message: 'Pense aux fibres pour ta satiété',
            actionable: 'Ajoute des légumes à ton prochain repas',
          })
        }

        // Activity insights
        if (todayEntry.steps >= targets.dailySteps) {
          insights.push({
            type: 'positive',
            category: 'activity',
            message: `Objectif de ${targets.dailySteps.toLocaleString()} pas atteint !`,
          })
        } else if (todayEntry.steps < targets.dailySteps / 2) {
          insights.push({
            type: 'improvement',
            category: 'activity',
            message: 'Bouge un peu plus aujourd\'hui',
            actionable: 'Une petite marche de 10 min ?',
          })
        }

        return insights
      },
    }),
    {
      name: 'presence-wellness',
      partialize: (state) => ({
        entries: state.entries,
        targets: state.targets,
        streaks: state.streaks,
      }),
    }
  )
)

// Helper functions
function calculateStreaks(
  entries: Record<string, DailyWellness>,
  targets: WellnessTargets
): WellnessState['streaks'] {
  const today = new Date()
  const streaks = {
    sleep7h: 0,
    fiber30g: 0,
    water2L: 0,
    steps: 0,
    lowStress: 0,
  }

  // Count consecutive days backwards from today
  for (let i = 0; i < 365; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const entry = entries[dateStr]

    if (!entry) break

    const sleep7hMet = entry.sleepHours >= 7
    const fiber30gMet = entry.fiberGrams >= 25
    const water2LMet = entry.waterLiters >= 2
    const stepsMet = entry.steps >= targets.dailySteps * 0.8
    const lowStressMet = entry.stressLevel <= 2

    if (i === 0 || streaks.sleep7h === i) {
      if (sleep7hMet) streaks.sleep7h++
    }
    if (i === 0 || streaks.fiber30g === i) {
      if (fiber30gMet) streaks.fiber30g++
    }
    if (i === 0 || streaks.water2L === i) {
      if (water2LMet) streaks.water2L++
    }
    if (i === 0 || streaks.steps === i) {
      if (stepsMet) streaks.steps++
    }
    if (i === 0 || streaks.lowStress === i) {
      if (lowStressMet) streaks.lowStress++
    }
  }

  return streaks
}

function calculateWeeklyAverage(
  entries: Record<string, DailyWellness>,
  targets: WellnessTargets,
  today: string
): number {
  const todayDate = new Date(today)
  let total = 0
  let count = 0

  for (let i = 0; i < 7; i++) {
    const date = new Date(todayDate)
    date.setDate(todayDate.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const entry = entries[dateStr]

    if (entry) {
      total += calculateWellnessScore(entry, targets)
      count++
    }
  }

  return count > 0 ? Math.round(total / count) : 0
}
