/**
 * Goals Store - LYM Health Module
 *
 * Manages health priorities, routine equilibre, and check-in state.
 * No toxic metrics (streaks, scores, completion rates).
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  HealthPriority,
  HealthCheckin,
  CheckinPromptState,
  RoutineEquilibreEntry,
  WeeklyPresence,
} from '../types'

// =============================================================================
// HELPERS
// =============================================================================

const getDateString = () => new Date().toISOString().split('T')[0]

const getWeekStart = (date: Date = new Date()): string => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface GoalsState {
  // Health priorities (for goal = health)
  healthPriorities: HealthPriority[]

  // Routine Equilibre (ex-Metabolic Boost, optional)
  routineEquilibreEnabled: boolean
  routineEntries: RoutineEquilibreEntry[]

  // Check-in state
  checkins: HealthCheckin[]
  checkinPromptState: CheckinPromptState

  // Actions - Health Priorities
  setHealthPriorities: (priorities: HealthPriority[]) => void
  addHealthPriority: (priority: HealthPriority) => void
  removeHealthPriority: (priority: HealthPriority) => void

  // Actions - Routine Equilibre
  enableRoutineEquilibre: () => void
  disableRoutineEquilibre: () => void
  logRoutineEntry: (entry: Omit<RoutineEquilibreEntry, 'date'>) => void
  getTodayRoutineEntry: () => RoutineEquilibreEntry | null
  getWeeklyPresence: () => WeeklyPresence

  // Actions - Check-in
  submitCheckin: (checkin: Omit<HealthCheckin, 'id' | 'date' | 'createdAt'>) => void
  getLastCheckin: () => HealthCheckin | null
  shouldShowCheckinPrompt: () => boolean
  markPromptShown: () => void
  markPromptSkipped: () => void

  // Getters
  hasHealthPriority: (priority: HealthPriority) => boolean
  getCheckinForDate: (date: string) => HealthCheckin | null
  getRecentCheckins: (days?: number) => HealthCheckin[]
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      // Initial state
      healthPriorities: [],
      routineEquilibreEnabled: false,
      routineEntries: [],
      checkins: [],
      checkinPromptState: {
        lastCheckinDate: null,
        lastPromptDate: null,
        promptsThisWeek: 0,
      },

      // =========================================================================
      // HEALTH PRIORITIES
      // =========================================================================

      setHealthPriorities: (priorities) => {
        // Max 3 priorities
        const limited = priorities.slice(0, 3)
        set({ healthPriorities: limited })
      },

      addHealthPriority: (priority) => {
        const { healthPriorities } = get()
        if (healthPriorities.length >= 3 || healthPriorities.includes(priority)) {
          return
        }
        set({ healthPriorities: [...healthPriorities, priority] })
      },

      removeHealthPriority: (priority) => {
        const { healthPriorities } = get()
        set({ healthPriorities: healthPriorities.filter(p => p !== priority) })
      },

      hasHealthPriority: (priority) => {
        return get().healthPriorities.includes(priority)
      },

      // =========================================================================
      // ROUTINE EQUILIBRE
      // =========================================================================

      enableRoutineEquilibre: () => {
        set({ routineEquilibreEnabled: true })
      },

      disableRoutineEquilibre: () => {
        set({ routineEquilibreEnabled: false })
      },

      logRoutineEntry: (entry) => {
        const today = getDateString()
        const { routineEntries } = get()

        // Find existing entry for today
        const existingIndex = routineEntries.findIndex(e => e.date === today)

        if (existingIndex >= 0) {
          // Update existing
          const updated = [...routineEntries]
          updated[existingIndex] = { ...updated[existingIndex], ...entry, date: today }
          set({ routineEntries: updated })
        } else {
          // Add new
          set({ routineEntries: [...routineEntries, { ...entry, date: today }] })
        }
      },

      getTodayRoutineEntry: () => {
        const today = getDateString()
        return get().routineEntries.find(e => e.date === today) || null
      },

      getWeeklyPresence: () => {
        const weekStart = getWeekStart()
        const { routineEntries } = get()

        // Count days with at least one entry this week
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        const daysPresent = routineEntries.filter(entry => {
          const entryDate = new Date(entry.date)
          return entryDate >= new Date(weekStart) && entryDate < weekEnd
        }).length

        return {
          daysPresent: Math.min(daysPresent, 7),
          weekStart,
        }
      },

      // =========================================================================
      // CHECK-IN
      // =========================================================================

      submitCheckin: (checkinData) => {
        const today = getDateString()
        const { checkins, checkinPromptState } = get()

        const newCheckin: HealthCheckin = {
          id: generateId(),
          date: today,
          createdAt: new Date().toISOString(),
          ...checkinData,
        }

        // Remove existing checkin for today if any
        const filtered = checkins.filter(c => c.date !== today)

        // Reset prompts count for the week if it's a new week
        const currentWeekStart = getWeekStart()
        const lastPromptWeekStart = checkinPromptState.lastPromptDate
          ? getWeekStart(new Date(checkinPromptState.lastPromptDate))
          : null

        const promptsThisWeek =
          lastPromptWeekStart === currentWeekStart ? checkinPromptState.promptsThisWeek : 0

        set({
          checkins: [...filtered, newCheckin],
          checkinPromptState: {
            lastCheckinDate: today,
            lastPromptDate: today,
            promptsThisWeek,
          },
        })
      },

      getLastCheckin: () => {
        const { checkins } = get()
        if (checkins.length === 0) return null
        return checkins.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0]
      },

      getCheckinForDate: (date) => {
        return get().checkins.find(c => c.date === date) || null
      },

      getRecentCheckins: (days = 7) => {
        const { checkins } = get()
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)

        return checkins
          .filter(c => new Date(c.date) >= cutoff)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      },

      shouldShowCheckinPrompt: () => {
        const { checkinPromptState } = get()
        const today = getDateString()
        const now = new Date()

        // Don't show if already checked in today
        if (checkinPromptState.lastCheckinDate === today) {
          return false
        }

        // Don't show if prompt was shown today
        if (checkinPromptState.lastPromptDate === today) {
          return false
        }

        // Check 48h minimum since last checkin
        if (checkinPromptState.lastCheckinDate) {
          const lastCheckin = new Date(checkinPromptState.lastCheckinDate)
          const hoursSince = (now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60)
          if (hoursSince < 48) {
            return false
          }
        }

        // Max 3 prompts per week
        const currentWeekStart = getWeekStart()
        const lastPromptWeekStart = checkinPromptState.lastPromptDate
          ? getWeekStart(new Date(checkinPromptState.lastPromptDate))
          : null

        const promptsThisWeek =
          lastPromptWeekStart === currentWeekStart ? checkinPromptState.promptsThisWeek : 0

        if (promptsThisWeek >= 3) {
          return false
        }

        // Show on preferred days (Mon, Thu, Sat) or any day if no checkin in 4+ days
        const dayOfWeek = now.getDay()
        const preferredDays = [1, 4, 6] // Mon, Thu, Sat

        if (preferredDays.includes(dayOfWeek)) {
          return true
        }

        // Fallback: show if no checkin in 4+ days
        if (checkinPromptState.lastCheckinDate) {
          const lastCheckin = new Date(checkinPromptState.lastCheckinDate)
          const daysSince = Math.floor(
            (now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24)
          )
          return daysSince >= 4
        }

        // First time user: show on preferred days
        return preferredDays.includes(dayOfWeek)
      },

      markPromptShown: () => {
        const { checkinPromptState } = get()
        const today = getDateString()
        const currentWeekStart = getWeekStart()
        const lastPromptWeekStart = checkinPromptState.lastPromptDate
          ? getWeekStart(new Date(checkinPromptState.lastPromptDate))
          : null

        const promptsThisWeek =
          lastPromptWeekStart === currentWeekStart ? checkinPromptState.promptsThisWeek + 1 : 1

        set({
          checkinPromptState: {
            ...checkinPromptState,
            lastPromptDate: today,
            promptsThisWeek,
          },
        })
      },

      markPromptSkipped: () => {
        // Same as markPromptShown - we count skips too
        get().markPromptShown()
      },
    }),
    {
      name: 'lym-goals-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        healthPriorities: state.healthPriorities,
        routineEquilibreEnabled: state.routineEquilibreEnabled,
        routineEntries: state.routineEntries,
        checkins: state.checkins,
        checkinPromptState: state.checkinPromptState,
      }),
    }
  )
)

export default useGoalsStore
