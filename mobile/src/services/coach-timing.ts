/**
 * CoachTiming - Adaptive timing and actionability scoring
 *
 * Phase 3 features:
 * 1. Adaptive timing based on user app open patterns
 * 2. Actionability scoring for message prioritization
 * 3. Window-based delivery decisions
 */

import { useCoachState } from './coach-state'
import type { MessagePriority, MessageCategory } from './message-center'

// ============= TYPES =============

export interface TimingWindow {
  start: number // Hour (0-23)
  end: number   // Hour (0-23)
  label: string
  isActive: boolean
}

export interface ActionabilityScore {
  score: number // 0-100
  factors: {
    urgency: number      // How time-sensitive
    relevance: number    // How relevant to current context
    actionable: number   // How easy to act on
    personalized: number // How personalized to user
  }
  recommendation: 'push' | 'inbox' | 'defer' | 'skip'
}

// ============= TIMING WINDOWS =============

/**
 * Get default timing windows for message delivery
 * Based on typical daily patterns
 */
export function getDefaultTimingWindows(): TimingWindow[] {
  const hour = new Date().getHours()

  return [
    {
      start: 7,
      end: 9,
      label: 'Matin',
      isActive: hour >= 7 && hour < 9,
    },
    {
      start: 12,
      end: 14,
      label: 'Midi',
      isActive: hour >= 12 && hour < 14,
    },
    {
      start: 18,
      end: 21,
      label: 'Soir',
      isActive: hour >= 18 && hour < 21,
    },
  ]
}

/**
 * Get adaptive timing windows based on user patterns
 */
export function getAdaptiveTimingWindows(): TimingWindow[] {
  const coachState = useCoachState.getState()
  const preferredHours = coachState.engagement.preferredHours
  const hour = new Date().getHours()

  // If we have enough data, use user preferences
  if (preferredHours.length >= 2) {
    return preferredHours.map((prefHour, index) => {
      const labels = ['Premier créneau', 'Second créneau', 'Troisième créneau']
      return {
        start: Math.max(0, prefHour - 1),
        end: Math.min(23, prefHour + 1),
        label: labels[index] || `Créneau ${index + 1}`,
        isActive: Math.abs(hour - prefHour) <= 1,
      }
    })
  }

  // Fallback to defaults
  return getDefaultTimingWindows()
}

/**
 * Check if current time is in any active timing window
 */
export function isInTimingWindow(): boolean {
  const windows = getAdaptiveTimingWindows()
  return windows.some(w => w.isActive)
}

/**
 * Get next timing window start time
 */
export function getNextTimingWindow(): { hour: number; label: string } | null {
  const windows = getAdaptiveTimingWindows()
  const currentHour = new Date().getHours()

  // Find next window
  const futureWindows = windows
    .filter(w => w.start > currentHour)
    .sort((a, b) => a.start - b.start)

  if (futureWindows.length > 0) {
    return { hour: futureWindows[0].start, label: futureWindows[0].label }
  }

  // Wrap to tomorrow's first window
  const sortedWindows = [...windows].sort((a, b) => a.start - b.start)
  if (sortedWindows.length > 0) {
    return { hour: sortedWindows[0].start, label: sortedWindows[0].label }
  }

  return null
}

// ============= ACTIONABILITY SCORING =============

interface ScoringContext {
  priority: MessagePriority
  category: MessageCategory
  hasAction: boolean
  urgencyWindow?: number // Hours until no longer actionable
  confidence?: number
  isAI: boolean
  userDismissCount: number // How many times user dismissed this topic
}

/**
 * Calculate actionability score for a message
 * Higher score = more likely to be shown
 */
export function calculateActionabilityScore(ctx: ScoringContext): ActionabilityScore {
  const factors = {
    urgency: 0,
    relevance: 0,
    actionable: 0,
    personalized: 0,
  }

  // 1. URGENCY (0-25)
  // Based on priority and urgency window
  const priorityUrgency: Record<MessagePriority, number> = {
    P0: 25,
    P1: 20,
    P2: 10,
    P3: 5,
  }
  factors.urgency = priorityUrgency[ctx.priority]

  // Boost if short urgency window
  if (ctx.urgencyWindow !== undefined) {
    if (ctx.urgencyWindow <= 1) factors.urgency = Math.min(25, factors.urgency + 10)
    else if (ctx.urgencyWindow <= 3) factors.urgency = Math.min(25, factors.urgency + 5)
  }

  // 2. RELEVANCE (0-25)
  // Based on category and time of day
  const hour = new Date().getHours()
  const categoryRelevanceByTime: Record<MessageCategory, (h: number) => number> = {
    nutrition: (h) => {
      // More relevant around meal times
      if ((h >= 7 && h <= 9) || (h >= 12 && h <= 14) || (h >= 18 && h <= 21)) return 25
      return 15
    },
    hydration: (h) => {
      // More relevant in afternoon
      if (h >= 14 && h <= 18) return 25
      return 20
    },
    sleep: (h) => {
      // More relevant in evening/morning
      if (h >= 20 || h <= 8) return 25
      return 10
    },
    sport: (h) => {
      // More relevant in morning/evening
      if ((h >= 6 && h <= 10) || (h >= 17 && h <= 20)) return 25
      return 15
    },
    stress: () => 20, // Always relevant
    progress: () => 20,
    wellness: () => 20,
    system: () => 15,
  }
  factors.relevance = categoryRelevanceByTime[ctx.category]?.(hour) ?? 15

  // 3. ACTIONABLE (0-25)
  // Based on whether there's a clear action
  if (ctx.hasAction) {
    factors.actionable = 25
  } else {
    factors.actionable = 10 // Still valuable as insight
  }

  // 4. PERSONALIZED (0-25)
  // Based on AI, confidence, and user engagement
  if (ctx.isAI) {
    factors.personalized = Math.round((ctx.confidence ?? 0.8) * 25)
  } else {
    factors.personalized = 15 // Rule-based is somewhat personalized
  }

  // Reduce if user frequently dismisses this topic
  if (ctx.userDismissCount > 0) {
    const dismissPenalty = Math.min(15, ctx.userDismissCount * 3)
    factors.personalized = Math.max(0, factors.personalized - dismissPenalty)
    factors.relevance = Math.max(0, factors.relevance - dismissPenalty)
  }

  // Calculate total score
  const score = factors.urgency + factors.relevance + factors.actionable + factors.personalized

  // Determine recommendation
  let recommendation: ActionabilityScore['recommendation']
  if (score >= 80 && ctx.priority <= 'P1') {
    recommendation = 'push'
  } else if (score >= 50) {
    recommendation = 'inbox'
  } else if (score >= 30) {
    recommendation = 'defer' // Wait for better timing
  } else {
    recommendation = 'skip' // Don't show at all
  }

  return { score, factors, recommendation }
}

/**
 * Should we defer delivery to a better time?
 * Returns the recommended delay in hours, or 0 if immediate delivery is best
 */
export function shouldDeferDelivery(
  priority: MessagePriority,
  score: ActionabilityScore
): number {
  // P0 always immediate
  if (priority === 'P0') return 0

  // If in timing window, deliver now
  if (isInTimingWindow()) return 0

  // If score recommends defer, wait for next window
  if (score.recommendation === 'defer') {
    const nextWindow = getNextTimingWindow()
    if (nextWindow) {
      const currentHour = new Date().getHours()
      let hoursUntil = nextWindow.hour - currentHour
      if (hoursUntil < 0) hoursUntil += 24 // Next day
      return Math.min(hoursUntil, 6) // Max 6 hour defer
    }
  }

  // P1 with push recommendation but not in window: defer up to 2h
  if (priority === 'P1' && score.recommendation === 'push') {
    const nextWindow = getNextTimingWindow()
    if (nextWindow) {
      const currentHour = new Date().getHours()
      let hoursUntil = nextWindow.hour - currentHour
      if (hoursUntil < 0) hoursUntil += 24
      return Math.min(hoursUntil, 2) // Max 2 hour defer for P1
    }
  }

  return 0
}

// ============= QUIET HOURS =============

/**
 * Check if we're in quiet hours (no push notifications)
 */
export function isInQuietHours(
  quietStart: number = 22,
  quietEnd: number = 8
): boolean {
  const hour = new Date().getHours()

  if (quietStart > quietEnd) {
    // Spans midnight (e.g., 22:00 to 08:00)
    return hour >= quietStart || hour < quietEnd
  }

  return hour >= quietStart && hour < quietEnd
}

/**
 * Adjust delivery for quiet hours
 * Returns 'defer' with hours to wait, or 'allow'
 */
export function adjustForQuietHours(
  priority: MessagePriority,
  quietStart: number = 22,
  quietEnd: number = 8
): { action: 'allow' | 'defer'; hoursToWait?: number } {
  // P0 ignores quiet hours
  if (priority === 'P0') {
    return { action: 'allow' }
  }

  if (!isInQuietHours(quietStart, quietEnd)) {
    return { action: 'allow' }
  }

  // Calculate hours until quiet hours end
  const hour = new Date().getHours()
  let hoursToWait: number

  if (hour >= quietStart) {
    // After quiet start, wait until next day's quietEnd
    hoursToWait = (24 - hour) + quietEnd
  } else {
    // Before quiet end
    hoursToWait = quietEnd - hour
  }

  return { action: 'defer', hoursToWait }
}

export default {
  getDefaultTimingWindows,
  getAdaptiveTimingWindows,
  isInTimingWindow,
  getNextTimingWindow,
  calculateActionabilityScore,
  shouldDeferDelivery,
  isInQuietHours,
  adjustForQuietHours,
}
