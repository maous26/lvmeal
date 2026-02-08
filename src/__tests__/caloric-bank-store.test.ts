/**
 * Tests for the caloric bank store (7-day rolling period)
 */

// Mock zustand persist
jest.mock('zustand/middleware', () => ({
  persist: (fn: any) => fn,
}))

// We need to test the pure functions, so let's import the store
import { useCaloricBankStore } from '../stores/caloric-bank-store'

describe('CaloricBankStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useCaloricBankStore.getState()
    useCaloricBankStore.setState({
      weekStartDate: null,
      dailyBalances: [],
      hasConfirmedStartDay: false,
    })
  })

  describe('initializeWeek', () => {
    it('sets weekStartDate to today when not initialized', () => {
      const store = useCaloricBankStore.getState()
      store.initializeWeek()
      const state = useCaloricBankStore.getState()
      const today = new Date().toISOString().split('T')[0]
      expect(state.weekStartDate).toBe(today)
    })
  })

  describe('updateDailyBalance', () => {
    it('adds new daily balance entry', () => {
      const store = useCaloricBankStore.getState()
      store.updateDailyBalance('2025-01-15', 1800, 2100)
      const state = useCaloricBankStore.getState()
      expect(state.dailyBalances).toHaveLength(1)
      expect(state.dailyBalances[0]).toEqual({
        date: '2025-01-15',
        consumed: 1800,
        target: 2100,
        balance: 300, // target - consumed = saved
      })
    })

    it('updates existing daily balance entry', () => {
      const store = useCaloricBankStore.getState()
      store.updateDailyBalance('2025-01-15', 1800, 2100)
      store.updateDailyBalance('2025-01-15', 2000, 2100)
      const state = useCaloricBankStore.getState()
      expect(state.dailyBalances).toHaveLength(1)
      expect(state.dailyBalances[0].consumed).toBe(2000)
      expect(state.dailyBalances[0].balance).toBe(100)
    })
  })

  describe('canHavePlaisir', () => {
    it('returns false when no week started', () => {
      const store = useCaloricBankStore.getState()
      expect(store.canHavePlaisir()).toBe(false)
    })

    it('returns false on day 1-4 even with positive balance', () => {
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(today.getDate() - 2) // Day 3
      
      useCaloricBankStore.setState({
        weekStartDate: startDate.toISOString().split('T')[0],
        dailyBalances: [
          { date: startDate.toISOString().split('T')[0], consumed: 1500, target: 2100, balance: 600 },
        ],
      })
      
      const store = useCaloricBankStore.getState()
      expect(store.canHavePlaisir()).toBe(false)
    })
  })

  describe('getTotalBalance', () => {
    it('sums all balances except today', () => {
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      useCaloricBankStore.setState({
        weekStartDate: yesterdayStr,
        dailyBalances: [
          { date: yesterdayStr, consumed: 1800, target: 2100, balance: 300 },
          { date: today, consumed: 500, target: 2100, balance: 1600 },
        ],
      })

      const store = useCaloricBankStore.getState()
      // Should only count yesterday's balance (300), not today's
      expect(store.getTotalBalance()).toBe(300)
    })
  })

  describe('confirmStartDay', () => {
    it('sets hasConfirmedStartDay to true', () => {
      const store = useCaloricBankStore.getState()
      store.confirmStartDay()
      expect(useCaloricBankStore.getState().hasConfirmedStartDay).toBe(true)
    })
  })

  describe('resetToToday', () => {
    it('resets only if not confirmed', () => {
      useCaloricBankStore.setState({
        weekStartDate: '2025-01-01',
        dailyBalances: [{ date: '2025-01-01', consumed: 2000, target: 2100, balance: 100 }],
        hasConfirmedStartDay: false,
      })

      const store = useCaloricBankStore.getState()
      store.resetToToday()
      
      const state = useCaloricBankStore.getState()
      const today = new Date().toISOString().split('T')[0]
      expect(state.weekStartDate).toBe(today)
      expect(state.dailyBalances).toHaveLength(0)
    })

    it('does not reset if already confirmed', () => {
      useCaloricBankStore.setState({
        weekStartDate: '2025-01-01',
        dailyBalances: [{ date: '2025-01-01', consumed: 2000, target: 2100, balance: 100 }],
        hasConfirmedStartDay: true,
      })

      const store = useCaloricBankStore.getState()
      store.resetToToday()
      
      const state = useCaloricBankStore.getState()
      expect(state.weekStartDate).toBe('2025-01-01')
    })
  })
})
