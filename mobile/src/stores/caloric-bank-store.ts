import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DailyBalance } from '../types'
import { useGamificationStore, XP_REWARDS } from './gamification-store'

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

interface CaloricBankState {
  // 7-day rolling balance
  dailyBalances: DailyBalance[]

  // Week tracking
  weekStartDate: string | null
  isFirstTime: boolean

  // Cheat meal settings
  cheatMealBudget: number // calories saved for cheat meal
  lastCheatMealDate: string | null
  cheatMealFrequency: 'weekly' | 'biweekly' | 'monthly'

  // Repas plaisir tracking (max 2 per week)
  weeklyPlaisirCount: number // nombre de repas plaisir utilisés cette semaine
  plaisirDatesThisWeek: string[] // dates des repas plaisir cette semaine

  // Actions
  initializeWeek: () => void
  confirmStartDay: () => void
  updateDailyBalance: (date: string, targetCalories: number, consumedCalories: number) => void
  useCheatMeal: (calories: number) => boolean
  setCheatMealFrequency: (frequency: 'weekly' | 'biweekly' | 'monthly') => void
  cleanOldBalances: () => void

  // Getters
  getTotalSaved: () => number
  getTotalBalance: () => number
  getWeeklyBalance: () => DailyBalance[]
  canHaveCheatMeal: () => boolean
  canHavePlaisir: () => boolean
  getCurrentDayIndex: () => number
  getDaysUntilNewWeek: () => number
  isFirstTimeSetup: () => boolean
  getCheatMealSuggestion: () => { available: boolean; budget: number; suggestion: string; maxPerMeal: number; requiresSplit: boolean; remainingPlaisirMeals: number }
  getMaxPlaisirPerMeal: () => number
  requiresSplitConsumption: () => boolean
  getRemainingPlaisirMeals: () => number
  canUsePlaisirMeal: () => boolean
}

const CHEAT_MEAL_THRESHOLDS = {
  weekly: 500,
  biweekly: 1000,
  monthly: 2000,
}

// Seuil à partir duquel le solde plaisir doit être réparti sur plusieurs repas
const SPLIT_THRESHOLD = 600 // Si budget > 600 kcal, doit être consommé sur au moins 2 repas
const MAX_SINGLE_MEAL_RATIO = 0.5 // Maximum 50% du budget par repas

// Règle structurelle : max 2 repas plaisir par semaine (garde le côté événementiel)
const MAX_PLAISIR_MEALS_PER_WEEK = 2

export const useCaloricBankStore = create<CaloricBankState>()(
  persist(
    (set, get) => ({
      dailyBalances: [],
      weekStartDate: null,
      isFirstTime: true,
      cheatMealBudget: 0,
      lastCheatMealDate: null,
      cheatMealFrequency: 'weekly',
      weeklyPlaisirCount: 0,
      plaisirDatesThisWeek: [],

      initializeWeek: () => {
        const { weekStartDate } = get()
        if (!weekStartDate) {
          set({ weekStartDate: getTodayString(), isFirstTime: true, weeklyPlaisirCount: 0, plaisirDatesThisWeek: [] })
        } else {
          // Check if 7 days have passed
          const start = new Date(weekStartDate)
          const today = new Date()
          const daysPassed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          if (daysPassed >= 7) {
            // Nouvelle semaine : reset du budget ET du compteur de repas plaisir
            set({ weekStartDate: getTodayString(), dailyBalances: [], cheatMealBudget: 0, weeklyPlaisirCount: 0, plaisirDatesThisWeek: [] })
          }
        }
      },

      confirmStartDay: () => {
        set({ isFirstTime: false })
      },

      updateDailyBalance: (date, targetCalories, consumedCalories) => {
        const balance = targetCalories - consumedCalories

        set((state) => {
          const existingIndex = state.dailyBalances.findIndex(b => b.date === date)
          const newBalance: DailyBalance = {
            date,
            targetCalories,
            consumedCalories,
            balance,
            isCheatDay: false,
          }

          let updatedBalances: DailyBalance[]
          if (existingIndex >= 0) {
            updatedBalances = [...state.dailyBalances]
            updatedBalances[existingIndex] = newBalance
          } else {
            updatedBalances = [...state.dailyBalances, newBalance]
          }

          // Keep only last 7 days
          updatedBalances = updatedBalances
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 7)

          // Calculate new cheat meal budget
          const totalSaved = updatedBalances.reduce((acc, b) => acc + Math.max(0, b.balance), 0)

          return {
            dailyBalances: updatedBalances,
            cheatMealBudget: totalSaved,
          }
        })

        // Clean old balances
        get().cleanOldBalances()
      },

      useCheatMeal: (calories) => {
        const { cheatMealBudget, canHaveCheatMeal, getMaxPlaisirPerMeal, canUsePlaisirMeal } = get()
        const maxPerMeal = getMaxPlaisirPerMeal()

        // Vérifie si le cheat meal est disponible
        if (!canHaveCheatMeal()) {
          return false
        }

        // Vérifie si on a encore des repas plaisir disponibles cette semaine (max 2)
        if (!canUsePlaisirMeal()) {
          return false
        }

        // Vérifie si les calories demandées dépassent le budget total
        if (calories > cheatMealBudget) {
          return false
        }

        // Vérifie si les calories demandées dépassent le max par repas (règle de répartition)
        if (calories > maxPerMeal) {
          return false
        }

        const today = getTodayString()

        set((state) => {
          // Mark today as cheat day
          const updatedBalances = state.dailyBalances.map(b =>
            b.date === today ? { ...b, isCheatDay: true } : b
          )

          // Ajoute cette date aux repas plaisir de la semaine (si pas déjà fait aujourd'hui)
          const newPlaisirDates = state.plaisirDatesThisWeek.includes(today)
            ? state.plaisirDatesThisWeek
            : [...state.plaisirDatesThisWeek, today]

          return {
            dailyBalances: updatedBalances,
            cheatMealBudget: Math.max(0, state.cheatMealBudget - calories),
            lastCheatMealDate: today,
            weeklyPlaisirCount: newPlaisirDates.length,
            plaisirDatesThisWeek: newPlaisirDates,
          }
        })

        // Gamification
        const gamification = useGamificationStore.getState()
        gamification.incrementMetric('repas_plaisir_earned')
        gamification.addXP(XP_REWARDS.LOG_MEAL, 'Repas plaisir utilise')

        return true
      },

      setCheatMealFrequency: (frequency) => {
        set({ cheatMealFrequency: frequency })
      },

      cleanOldBalances: () => {
        const today = new Date()
        const sevenDaysAgo = new Date(today)
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const cutoffDate = sevenDaysAgo.toISOString().split('T')[0]

        set((state) => ({
          dailyBalances: state.dailyBalances.filter(b => b.date >= cutoffDate),
        }))
      },

      getTotalSaved: () => {
        const { dailyBalances } = get()
        return dailyBalances.reduce((acc, b) => acc + Math.max(0, b.balance), 0)
      },

      getTotalBalance: () => {
        const { dailyBalances } = get()
        return dailyBalances.reduce((acc, b) => acc + Math.max(0, b.balance), 0)
      },

      getCurrentDayIndex: () => {
        const { weekStartDate } = get()
        if (!weekStartDate) return 0
        const start = new Date(weekStartDate)
        const today = new Date()
        return Math.min(6, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
      },

      getDaysUntilNewWeek: () => {
        const { weekStartDate } = get()
        if (!weekStartDate) return 7
        const start = new Date(weekStartDate)
        const today = new Date()
        const daysPassed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        return Math.max(0, 7 - daysPassed)
      },

      isFirstTimeSetup: () => {
        return get().isFirstTime
      },

      canHavePlaisir: () => {
        const { getCurrentDayIndex, getTotalBalance } = get()
        const dayIndex = getCurrentDayIndex()
        const balance = getTotalBalance()
        // Can have plaisir on days 5-7 (index 4-6) if balance > 200
        return dayIndex >= 4 && balance > 200
      },

      getWeeklyBalance: () => {
        const { dailyBalances } = get()
        return dailyBalances.sort((a, b) => a.date.localeCompare(b.date))
      },

      canHaveCheatMeal: () => {
        const { cheatMealBudget, lastCheatMealDate, cheatMealFrequency } = get()
        const threshold = CHEAT_MEAL_THRESHOLDS[cheatMealFrequency]

        if (cheatMealBudget < threshold) {
          return false
        }

        if (!lastCheatMealDate) {
          return true
        }

        const lastDate = new Date(lastCheatMealDate)
        const today = new Date()
        const daysSince = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

        const minDays = {
          weekly: 7,
          biweekly: 14,
          monthly: 30,
        }

        return daysSince >= minDays[cheatMealFrequency]
      },

      // Vérifie si le budget doit être réparti sur plusieurs repas
      requiresSplitConsumption: () => {
        const { cheatMealBudget } = get()
        return cheatMealBudget > SPLIT_THRESHOLD
      },

      // Retourne le maximum de calories consommables par repas plaisir
      getMaxPlaisirPerMeal: () => {
        const { cheatMealBudget } = get()

        // Si le budget est <= au seuil, on peut tout consommer en un repas
        if (cheatMealBudget <= SPLIT_THRESHOLD) {
          return cheatMealBudget
        }

        // Sinon, maximum 50% du budget par repas (doit être réparti sur au moins 2 repas)
        return Math.floor(cheatMealBudget * MAX_SINGLE_MEAL_RATIO)
      },

      // Retourne le nombre de repas plaisir restants cette semaine
      getRemainingPlaisirMeals: () => {
        const { weeklyPlaisirCount } = get()
        return Math.max(0, MAX_PLAISIR_MEALS_PER_WEEK - weeklyPlaisirCount)
      },

      // Vérifie si on peut encore utiliser un repas plaisir cette semaine
      canUsePlaisirMeal: () => {
        const { weeklyPlaisirCount } = get()
        return weeklyPlaisirCount < MAX_PLAISIR_MEALS_PER_WEEK
      },

      getCheatMealSuggestion: () => {
        const { cheatMealBudget, canHaveCheatMeal: checkCanHave, cheatMealFrequency, getMaxPlaisirPerMeal, requiresSplitConsumption, getRemainingPlaisirMeals, canUsePlaisirMeal } = get()
        const budgetAvailable = checkCanHave()
        const canUseThisWeek = canUsePlaisirMeal()
        const available = budgetAvailable && canUseThisWeek
        const threshold = CHEAT_MEAL_THRESHOLDS[cheatMealFrequency]
        const maxPerMeal = getMaxPlaisirPerMeal()
        const requiresSplit = requiresSplitConsumption()
        const remainingMeals = getRemainingPlaisirMeals()

        let suggestion = ''

        // Cas où on a déjà utilisé les 2 repas plaisir de la semaine
        if (budgetAvailable && !canUseThisWeek) {
          suggestion = `Tu as déjà profité de tes 2 repas plaisir cette semaine. Nouvelle semaine, nouveaux plaisirs !`
        } else if (available) {
          // Messages bienveillants : on dit le budget, on encourage la différence sans nommer d'aliments
          if (requiresSplit) {
            // Budget conséquent - 2 repas plaisir
            if (remainingMeals === 2) {
              suggestion = `+${maxPerMeal} kcal bonus par repas plaisir cette semaine. Choisis quelque chose qui te fait vraiment envie — pas juste plus de la même chose.`
            } else {
              suggestion = `+${maxPerMeal} kcal bonus pour ton repas plaisir. L'idée ? Un moment différent, pas une version XXL de ton quotidien.`
            }
          } else {
            // Budget normal - un seul repas
            if (remainingMeals === 2) {
              suggestion = `+${cheatMealBudget} kcal bonus pour un repas plaisir. Choisis quelque chose qui te fait vraiment envie — pas juste plus de la même chose.`
            } else {
              suggestion = `Dernier repas plaisir de la semaine ! +${cheatMealBudget} kcal pour te faire vraiment plaisir.`
            }
          }
        } else {
          const remaining = threshold - cheatMealBudget
          suggestion = `Encore ${remaining} kcal à économiser pour débloquer ton repas plaisir de la semaine`
        }

        return {
          available,
          budget: cheatMealBudget,
          suggestion,
          maxPerMeal,
          requiresSplit,
          remainingPlaisirMeals: remainingMeals,
        }
      },
    }),
    {
      name: 'presence-caloric-bank',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        dailyBalances: state.dailyBalances,
        weekStartDate: state.weekStartDate,
        isFirstTime: state.isFirstTime,
        cheatMealBudget: state.cheatMealBudget,
        lastCheatMealDate: state.lastCheatMealDate,
        cheatMealFrequency: state.cheatMealFrequency,
        weeklyPlaisirCount: state.weeklyPlaisirCount,
        plaisirDatesThisWeek: state.plaisirDatesThisWeek,
      }),
    }
  )
)

export default useCaloricBankStore
