/**
 * CoachState - Persistent state for the Coach system
 *
 * Manages:
 * - Last shown message by topic (to avoid repetition)
 * - Last push notification timestamp (to limit interruptions)
 * - Dismiss counts by topic (to reduce frequency for unwanted topics)
 * - User engagement patterns (for adaptive timing)
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ============= TYPES =============

export type CoachTopic =
  | 'nutrition'
  | 'hydration'
  | 'fasting'
  | 'sleep'
  | 'activity'
  | 'progress'
  | 'wellness'
  | 'motivation'

export interface TopicState {
  lastShownAt: string | null
  lastPushAt: string | null
  dismissCount: number
  lastDismissAt: string | null
}

export interface EngagementPattern {
  // When user typically opens the app
  preferredHours: number[]
  // Average session duration in minutes
  avgSessionDuration: number
  // Days since last active
  daysSinceActive: number
  // Last app open timestamp
  lastActiveAt: string | null
}

export interface CoachStateData {
  // Per-topic tracking
  topicStates: Record<CoachTopic, TopicState>

  // Global push tracking
  lastPushAt: string | null
  pushCountToday: number
  lastPushCountResetDate: string | null

  // Engagement patterns for adaptive timing
  engagement: EngagementPattern

  // App open history (last 7 days, hours only)
  appOpenHistory: { date: string; hour: number }[]
}

// ============= CONSTANTS =============

const DEFAULT_TOPIC_STATE: TopicState = {
  lastShownAt: null,
  lastPushAt: null,
  dismissCount: 0,
  lastDismissAt: null,
}

const ALL_TOPICS: CoachTopic[] = [
  'nutrition',
  'hydration',
  'fasting',
  'sleep',
  'activity',
  'progress',
  'wellness',
  'motivation',
]

const DEFAULT_ENGAGEMENT: EngagementPattern = {
  preferredHours: [8, 12, 19], // Default: morning, lunch, evening
  avgSessionDuration: 2,
  daysSinceActive: 0,
  lastActiveAt: null,
}

// ============= STORE =============

interface CoachStateStore extends CoachStateData {
  // Actions
  recordMessageShown: (topic: CoachTopic, wasPush: boolean) => void
  recordDismiss: (topic: CoachTopic) => void
  recordAppOpen: () => void
  resetDailyPushCount: () => void

  // Queries
  canShowTopic: (topic: CoachTopic, minHoursSinceShown: number) => boolean
  canSendPush: (maxPushPerDay: number) => boolean
  getTopicCooldownHours: (topic: CoachTopic) => number
  isInPreferredWindow: () => boolean
  getTopicPriority: (topic: CoachTopic) => number // Lower = higher priority based on engagement
}

const createDefaultTopicStates = (): Record<CoachTopic, TopicState> => {
  const states: Partial<Record<CoachTopic, TopicState>> = {}
  for (const topic of ALL_TOPICS) {
    states[topic] = { ...DEFAULT_TOPIC_STATE }
  }
  return states as Record<CoachTopic, TopicState>
}

export const useCoachState = create<CoachStateStore>()(
  persist(
    (set, get) => ({
      // Initial state
      topicStates: createDefaultTopicStates(),
      lastPushAt: null,
      pushCountToday: 0,
      lastPushCountResetDate: null,
      engagement: DEFAULT_ENGAGEMENT,
      appOpenHistory: [],

      // Record when a message is shown
      recordMessageShown: (topic: CoachTopic, wasPush: boolean) => {
        const now = new Date().toISOString()

        set((state) => {
          const newTopicStates = { ...state.topicStates }
          newTopicStates[topic] = {
            ...newTopicStates[topic],
            lastShownAt: now,
            lastPushAt: wasPush ? now : newTopicStates[topic].lastPushAt,
          }

          return {
            topicStates: newTopicStates,
            lastPushAt: wasPush ? now : state.lastPushAt,
            pushCountToday: wasPush ? state.pushCountToday + 1 : state.pushCountToday,
          }
        })
      },

      // Record when user dismisses a message
      recordDismiss: (topic: CoachTopic) => {
        const now = new Date().toISOString()

        set((state) => {
          const newTopicStates = { ...state.topicStates }
          newTopicStates[topic] = {
            ...newTopicStates[topic],
            dismissCount: newTopicStates[topic].dismissCount + 1,
            lastDismissAt: now,
          }
          return { topicStates: newTopicStates }
        })
      },

      // Record app open for engagement tracking
      recordAppOpen: () => {
        const now = new Date()
        const hour = now.getHours()
        const dateStr = now.toISOString().split('T')[0]

        set((state) => {
          // Add to history (keep last 50 opens)
          const newHistory = [
            { date: dateStr, hour },
            ...state.appOpenHistory,
          ].slice(0, 50)

          // Calculate preferred hours from history
          const hourCounts: Record<number, number> = {}
          for (const entry of newHistory) {
            hourCounts[entry.hour] = (hourCounts[entry.hour] || 0) + 1
          }

          // Get top 3 most common hours
          const sortedHours = Object.entries(hourCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([h]) => parseInt(h))

          const preferredHours = sortedHours.length >= 2
            ? sortedHours
            : DEFAULT_ENGAGEMENT.preferredHours

          // Calculate days since active
          const lastActive = state.engagement.lastActiveAt
          let daysSinceActive = 0
          if (lastActive) {
            const lastDate = new Date(lastActive)
            daysSinceActive = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
          }

          return {
            appOpenHistory: newHistory,
            engagement: {
              ...state.engagement,
              preferredHours,
              daysSinceActive,
              lastActiveAt: now.toISOString(),
            },
          }
        })

        // Reset daily push count if new day
        get().resetDailyPushCount()
      },

      // Reset push count at start of new day
      resetDailyPushCount: () => {
        const today = new Date().toISOString().split('T')[0]
        const { lastPushCountResetDate } = get()

        if (lastPushCountResetDate !== today) {
          set({
            pushCountToday: 0,
            lastPushCountResetDate: today,
          })
        }
      },

      // Check if we can show a message for a topic
      canShowTopic: (topic: CoachTopic, minHoursSinceShown: number) => {
        const { topicStates } = get()
        const state = topicStates[topic]

        if (!state.lastShownAt) return true

        const lastShown = new Date(state.lastShownAt).getTime()
        const hoursSince = (Date.now() - lastShown) / (1000 * 60 * 60)

        // Adjust cooldown based on dismiss count (more dismisses = longer cooldown)
        const dismissMultiplier = Math.min(4, 1 + state.dismissCount * 0.5)
        const adjustedCooldown = minHoursSinceShown * dismissMultiplier

        return hoursSince >= adjustedCooldown
      },

      // Check if we can send a push notification
      canSendPush: (maxPushPerDay: number) => {
        const { lastPushAt, pushCountToday } = get()

        // Check daily limit
        if (pushCountToday >= maxPushPerDay) return false

        // Check minimum gap between pushes (2 hours)
        if (lastPushAt) {
          const lastPush = new Date(lastPushAt).getTime()
          const hoursSince = (Date.now() - lastPush) / (1000 * 60 * 60)
          if (hoursSince < 2) return false
        }

        return true
      },

      // Get cooldown hours for a topic (adjusted by dismiss count)
      getTopicCooldownHours: (topic: CoachTopic) => {
        const { topicStates } = get()
        const state = topicStates[topic]

        // Base cooldowns by topic
        const baseCooldowns: Record<CoachTopic, number> = {
          nutrition: 4,
          hydration: 2,
          fasting: 8,
          sleep: 12,
          activity: 6,
          progress: 24,
          wellness: 12,
          motivation: 8,
        }

        const base = baseCooldowns[topic]
        const dismissMultiplier = Math.min(4, 1 + state.dismissCount * 0.5)

        return Math.round(base * dismissMultiplier)
      },

      // Check if current time is in user's preferred window
      isInPreferredWindow: () => {
        const { engagement } = get()
        const currentHour = new Date().getHours()

        // Check if within ±1 hour of any preferred hour
        for (const prefHour of engagement.preferredHours) {
          if (Math.abs(currentHour - prefHour) <= 1) {
            return true
          }
        }

        return false
      },

      // Get priority score for a topic (lower = should show sooner)
      getTopicPriority: (topic: CoachTopic) => {
        const { topicStates } = get()
        const state = topicStates[topic]

        let score = 50 // Base score

        // Increase score (lower priority) if recently shown
        if (state.lastShownAt) {
          const hoursSince = (Date.now() - new Date(state.lastShownAt).getTime()) / (1000 * 60 * 60)
          score -= Math.min(30, hoursSince * 2) // More time = lower score = higher priority
        }

        // Increase score if frequently dismissed
        score += state.dismissCount * 10

        // Cap between 0 and 100
        return Math.max(0, Math.min(100, score))
      },
    }),
    {
      name: 'lym-coach-state',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        topicStates: state.topicStates,
        lastPushAt: state.lastPushAt,
        pushCountToday: state.pushCountToday,
        lastPushCountResetDate: state.lastPushCountResetDate,
        engagement: state.engagement,
        appOpenHistory: state.appOpenHistory.slice(0, 30), // Keep only last 30
      }),
    }
  )
)

export default useCoachState
