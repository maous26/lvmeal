/**
 * Check-in Scheduler
 *
 * Manages when to show check-in prompts.
 * Rules:
 * - 2-3 times per week maximum
 * - At least 48h between check-ins
 * - Preferred days: Monday, Thursday, Saturday
 * - Never obligatory
 */

import { useGoalsStore } from '../goals/stores/goals-store'

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  /** Preferred days of week (0 = Sunday, 1 = Monday, etc.) */
  preferredDays: [1, 4, 6], // Monday, Thursday, Saturday
  /** Minimum hours between check-ins */
  minHoursBetweenCheckins: 48,
  /** Maximum prompts per week */
  maxPromptsPerWeek: 3,
  /** Fallback: show prompt if no checkin for this many days */
  fallbackDaysWithoutCheckin: 4,
}

// =============================================================================
// SCHEDULER FUNCTIONS
// =============================================================================

/**
 * Check if today is a preferred day for check-in
 */
export function isTodayPreferredDay(): boolean {
  const today = new Date().getDay()
  return CONFIG.preferredDays.includes(today)
}

/**
 * Get hours since last check-in
 */
export function getHoursSinceLastCheckin(lastCheckinDate: string | null): number | null {
  if (!lastCheckinDate) return null

  const lastCheckin = new Date(lastCheckinDate)
  const now = new Date()
  return (now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60)
}

/**
 * Get days since last check-in
 */
export function getDaysSinceLastCheckin(lastCheckinDate: string | null): number | null {
  const hours = getHoursSinceLastCheckin(lastCheckinDate)
  if (hours === null) return null
  return Math.floor(hours / 24)
}

/**
 * Main function: should we show the check-in prompt?
 * This is also available via useGoalsStore().shouldShowCheckinPrompt()
 *
 * @returns boolean - true if we should show the prompt
 */
export function shouldShowCheckinPrompt(): boolean {
  // Use the store's implementation
  return useGoalsStore.getState().shouldShowCheckinPrompt()
}

/**
 * Mark that a prompt was shown (call when prompt is displayed)
 */
export function markPromptShown(): void {
  useGoalsStore.getState().markPromptShown()
}

/**
 * Mark that user skipped the prompt
 */
export function markPromptSkipped(): void {
  useGoalsStore.getState().markPromptSkipped()
}

/**
 * Get next suggested check-in day
 * Returns null if no specific day is suggested
 */
export function getNextSuggestedCheckinDay(): Date | null {
  const { checkinPromptState } = useGoalsStore.getState()
  const today = new Date()
  const todayDayOfWeek = today.getDay()

  // Find next preferred day
  const sortedPreferred = [...CONFIG.preferredDays].sort((a, b) => a - b)

  // Find next preferred day after today
  let nextDay = sortedPreferred.find(day => day > todayDayOfWeek)

  if (nextDay === undefined) {
    // Wrap to next week
    nextDay = sortedPreferred[0]
  }

  // Calculate date
  const daysUntilNext = nextDay > todayDayOfWeek
    ? nextDay - todayDayOfWeek
    : 7 - todayDayOfWeek + nextDay

  const nextDate = new Date(today)
  nextDate.setDate(nextDate.getDate() + daysUntilNext)
  nextDate.setHours(10, 0, 0, 0) // Suggest 10 AM

  // Check if it respects the 48h minimum
  if (checkinPromptState.lastCheckinDate) {
    const hoursSinceLast = getHoursSinceLastCheckin(checkinPromptState.lastCheckinDate)
    const hoursUntilNext = daysUntilNext * 24

    if (hoursSinceLast !== null && hoursSinceLast + hoursUntilNext < CONFIG.minHoursBetweenCheckins) {
      // Push to the day after
      nextDate.setDate(nextDate.getDate() + 1)
    }
  }

  return nextDate
}

/**
 * Format date for display (FR)
 */
export function formatCheckinDay(date: Date): string {
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
  return days[date.getDay()]
}

// =============================================================================
// HOOK FOR COMPONENTS
// =============================================================================

/**
 * Hook to use in components for check-in scheduling
 * Returns current status and actions
 */
export function useCheckinScheduler() {
  const store = useGoalsStore()

  return {
    shouldShowPrompt: store.shouldShowCheckinPrompt(),
    lastCheckinDate: store.checkinPromptState.lastCheckinDate,
    daysSinceLastCheckin: getDaysSinceLastCheckin(store.checkinPromptState.lastCheckinDate),
    onPromptShown: store.markPromptShown,
    onPromptSkipped: store.markPromptSkipped,
    getNextSuggestedDay: getNextSuggestedCheckinDay,
  }
}

export default useCheckinScheduler
