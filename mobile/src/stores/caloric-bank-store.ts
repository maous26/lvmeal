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
  getCheatMealSuggestion: () => { available: boolean; budget: number; suggestion: string }
}

const CHEAT_MEAL_THRESHOLDS = {
  weekly: 500,
  biweekly: 1000,
  monthly: 2000,
}

export const useCaloricBankStore = create<CaloricBankState>()(
  persist(
    (set, get) => ({
      dailyBalances: [],
      weekStartDate: null,
      isFirstTime: true,
      cheatMealBudget: 0,
      lastCheatMealDate: null,
      cheatMealFrequency: 'weekly',

      initializeWeek: () => {
        const { weekStartDate } = get()
        if (!weekStartDate) {
          set({ weekStartDate: getTodayString(), isFirstTime: true })
        } else {
          // Check if 7 days have passed
          const start = new Date(weekStartDate)
          const today = new Date()
          const daysPassed = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          if (daysPassed >= 7) {
            set({ weekStartDate: getTodayString(), dailyBalances: [], cheatMealBudget: 0 })
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
        const { cheatMealBudget, canHaveCheatMeal } = get()

        if (!canHaveCheatMeal() || calories > cheatMealBudget) {
          return false
        }

        const today = getTodayString()

        set((state) => {
          // Mark today as cheat day
          const updatedBalances = state.dailyBalances.map(b =>
            b.date === today ? { ...b, isCheatDay: true } : b
          )

          return {
            dailyBalances: updatedBalances,
            cheatMealBudget: Math.max(0, state.cheatMealBudget - calories),
            lastCheatMealDate: today,
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

      getCheatMealSuggestion: () => {
        const { cheatMealBudget, canHaveCheatMeal: checkCanHave, cheatMealFrequency } = get()
        const available = checkCanHave()
        const threshold = CHEAT_MEAL_THRESHOLDS[cheatMealFrequency]

        let suggestion = ''
        if (available) {
          if (cheatMealBudget >= 800) {
            suggestion = 'Tu peux te faire plaisir avec un bon restaurant !'
          } else if (cheatMealBudget >= 500) {
            suggestion = 'Un bon burger ou une pizza te feraient du bien ?'
          } else {
            suggestion = 'Un dessert gourmand serait parfait !'
          }
        } else {
          const remaining = threshold - cheatMealBudget
          suggestion = `Encore ${remaining} kcal a economiser pour debloquer ton repas plaisir`
        }

        return {
          available,
          budget: cheatMealBudget,
          suggestion,
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
      }),
    }
  )
)

export default useCaloricBankStore
