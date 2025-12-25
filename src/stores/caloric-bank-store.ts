import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Helper to get today's date string (YYYY-MM-DD)
function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

// Calculate days between two dates (can be negative if date2 < date1)
function daysBetween(startDate: string, endDate: string): number {
  const d1 = new Date(startDate)
  const d2 = new Date(endDate)
  const diffTime = d2.getTime() - d1.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

// Maximum daily variance allowed (10% of target)
const MAX_DAILY_VARIANCE_PERCENT = 0.10

interface DailyBalance {
  date: string // YYYY-MM-DD
  consumed: number
  target: number
  balance: number // target - consumed (positive = saved, negative = overspent)
}

// Check if a day exceeds the 10% limit
function isExceedingLimit(consumed: number, target: number): boolean {
  const variance = Math.abs(target - consumed)
  const maxVariance = target * MAX_DAILY_VARIANCE_PERCENT
  return variance > maxVariance
}

// Clamp balance to ±10% of target
function clampBalance(balance: number, target: number): number {
  const maxVariance = target * MAX_DAILY_VARIANCE_PERCENT
  return Math.max(-maxVariance, Math.min(maxVariance, balance))
}

interface CaloricBankState {
  // The start date of the current 7-day period
  weekStartDate: string | null

  // Daily balances for the current period
  dailyBalances: DailyBalance[]

  // Whether the user has confirmed their start day (first time setup)
  hasConfirmedStartDay: boolean

  // Actions
  initializeWeek: () => void
  checkAndAutoReset: () => boolean // Auto-reset if 7 days have passed
  confirmStartDay: () => void // Confirm the start day (first time only)
  resetToToday: () => void // Reset to today (only before confirmation)
  updateDailyBalance: (date: string, consumed: number, target: number) => void

  // Computed getters
  getCurrentDayIndex: () => number // 0-6 based on weekStartDate
  getTotalBalance: () => number // Sum of all balances (excluding today), raw values
  getCappedTotalBalance: (dailyTarget: number) => number // Sum of balances capped at ±10% per day
  getMaxCredit: (dailyTarget: number) => number // Maximum possible credit (6 days * 10% of target)
  getDaysExceedingLimit: () => DailyBalance[] // Days where variance exceeds 10%
  canHavePlaisir: () => boolean // True if day 5-7 and balance > 0
  getDaysUntilPlaisir: () => number // Days until plaisir is available
  getDaysUntilNewWeek: () => number // Days until new week starts
  isFirstTimeSetup: () => boolean // True if user hasn't confirmed start day yet
}

export const useCaloricBankStore = create<CaloricBankState>()(
  persist(
    (set, get) => ({
      weekStartDate: null,
      dailyBalances: [],
      hasConfirmedStartDay: false,

      initializeWeek: () => {
        const state = get()
        // First, check if we need to auto-reset
        if (state.weekStartDate) {
          state.checkAndAutoReset()
          return
        }
        // Initialize if no week started yet
        set({
          weekStartDate: getTodayString(),
          dailyBalances: [],
        })
      },

      confirmStartDay: () => {
        set({ hasConfirmedStartDay: true })
      },

      resetToToday: () => {
        const state = get()
        // Only allow reset if user hasn't confirmed yet
        if (!state.hasConfirmedStartDay) {
          set({
            weekStartDate: getTodayString(),
            dailyBalances: [],
          })
        }
      },

      checkAndAutoReset: () => {
        const state = get()
        if (!state.weekStartDate) return false

        const dayIndex = daysBetween(state.weekStartDate, getTodayString())

        // Auto-reset after 7 days (index >= 7 means we're on day 8+)
        if (dayIndex >= 7) {
          set({
            weekStartDate: getTodayString(),
            dailyBalances: [],
          })
          return true
        }
        return false
      },

      updateDailyBalance: (date, consumed, target) => {
        set((state) => {
          const balance = target - consumed
          const existingIndex = state.dailyBalances.findIndex(b => b.date === date)

          if (existingIndex >= 0) {
            const updated = [...state.dailyBalances]
            updated[existingIndex] = { date, consumed, target, balance }
            return { dailyBalances: updated }
          } else {
            return {
              dailyBalances: [...state.dailyBalances, { date, consumed, target, balance }]
            }
          }
        })
      },

      getCurrentDayIndex: () => {
        const state = get()
        if (!state.weekStartDate) return 0
        const days = daysBetween(state.weekStartDate, getTodayString())
        // Clamp to 0-6 range (in case auto-reset hasn't run yet)
        return Math.min(Math.max(0, days), 6)
      },

      getTotalBalance: () => {
        const state = get()
        const today = getTodayString()
        // Sum all balances except today's (today is still in progress)
        return state.dailyBalances
          .filter(b => b.date !== today)
          .reduce((sum, b) => sum + b.balance, 0)
      },

      getCappedTotalBalance: (dailyTarget: number) => {
        const state = get()
        const today = getTodayString()
        // Sum all balances except today's, but cap each day at ±10% of target
        return state.dailyBalances
          .filter(b => b.date !== today)
          .reduce((sum, b) => {
            const cappedBalance = clampBalance(b.balance, b.target || dailyTarget)
            return sum + cappedBalance
          }, 0)
      },

      getMaxCredit: (dailyTarget: number) => {
        // Maximum credit = 6 days * 10% of daily target
        // (Day 7 is when you can use the credit)
        return Math.round(6 * dailyTarget * MAX_DAILY_VARIANCE_PERCENT)
      },

      getDaysExceedingLimit: () => {
        const state = get()
        return state.dailyBalances.filter(b => isExceedingLimit(b.consumed, b.target))
      },

      canHavePlaisir: () => {
        const state = get()
        const dayIndex = state.getCurrentDayIndex()
        const balance = state.getTotalBalance()
        // Available from day 5 (index 4) to day 7 (index 6) with positive balance
        return dayIndex >= 4 && balance > 0
      },

      getDaysUntilPlaisir: () => {
        const state = get()
        const dayIndex = state.getCurrentDayIndex()
        // Plaisir available from day 5 (index 4)
        return Math.max(0, 4 - dayIndex)
      },

      getDaysUntilNewWeek: () => {
        const state = get()
        const dayIndex = state.getCurrentDayIndex()
        // New week starts at day 8 (after 7 days complete)
        return Math.max(0, 7 - dayIndex)
      },

      isFirstTimeSetup: () => {
        const state = get()
        return !state.hasConfirmedStartDay
      },
    }),
    {
      name: 'presence-caloric-bank',
      partialize: (state) => ({
        weekStartDate: state.weekStartDate,
        dailyBalances: state.dailyBalances,
        hasConfirmedStartDay: state.hasConfirmedStartDay,
      }),
    }
  )
)
