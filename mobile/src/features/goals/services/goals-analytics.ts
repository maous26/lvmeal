/**
 * Goals Analytics Service
 *
 * Tracks events for the goals/health module.
 * No toxic metrics - only actions and engagement.
 */

import { analytics } from '../../../services/analytics-service'
import { lymInsights } from '../../../services/lym-insights-service'
import type { GoalsAnalyticsEvent, HealthPriority, AdviceType } from '../types'

// =============================================================================
// EVENT TRACKING
// =============================================================================

/**
 * Track when user selects an objective in onboarding
 */
export function trackObjectiveSelected(objective: string): void {
  analytics.track('objective_selected', { objective })
}

/**
 * Track when user selects health priorities
 */
export function trackHealthPrioritiesSelected(priorities: HealthPriority[]): void {
  analytics.track('health_priorities_selected', {
    priorities: priorities.join(','),
    count: priorities.length,
  })
}

/**
 * Track when user enables Routine Equilibre
 */
export function trackRoutineEquilibreEnabled(): void {
  analytics.track('routine_equilibre_enabled', {})
}

/**
 * Track when user disables Routine Equilibre
 */
export function trackRoutineEquilibreDisabled(): void {
  analytics.track('routine_equilibre_disabled', {})
}

/**
 * Track when check-in prompt is shown
 */
export function trackCheckinPromptShown(): void {
  analytics.track('checkin_prompt_shown', {})
}

/**
 * Track when user submits a check-in
 */
export function trackCheckinSubmitted(data: {
  energyLevel: number
  hasStress: boolean
  hasSleep: boolean
  hasHydration: boolean
}): void {
  analytics.track('checkin_submitted', {
    energy_level: data.energyLevel,
    has_stress: data.hasStress,
    has_sleep: data.hasSleep,
    has_hydration: data.hasHydration,
  })
}

/**
 * Track when user skips check-in
 */
export function trackCheckinSkipped(): void {
  analytics.track('checkin_skipped', {})
}

/**
 * Track when advice is requested
 */
export function trackAdviceRequested(type: AdviceType): void {
  analytics.track('advice_requested', { type })
}

/**
 * Track when advice card is viewed
 */
export function trackAdviceViewed(adviceId: string, type: AdviceType): void {
  analytics.track('advice_viewed', { advice_id: adviceId, type })
}

/**
 * Track when health overview screen is opened
 */
export function trackHealthOverviewOpened(): void {
  analytics.track('health_overview_opened', {})
}

/**
 * Track when diversity card is viewed in detail
 */
export function trackDiversityCardViewed(level: string): void {
  analytics.track('diversity_card_viewed', { level })
}

// =============================================================================
// LYM INSIGHTS INTEGRATION
// =============================================================================

/**
 * Track first action in health module
 * Integrates with existing lymInsights service
 */
export async function trackHealthModuleFirstAction(
  actionType: 'checkin_submitted' | 'routine_logged' | 'advice_viewed'
): Promise<void> {
  // Use existing lymInsights tracking
  await lymInsights.trackFirstAction('insight_viewed')
}

// =============================================================================
// BATCH EVENT HELPER
// =============================================================================

/**
 * Track multiple events at once
 */
export function trackGoalsEvent(
  event: GoalsAnalyticsEvent,
  properties?: Record<string, string | number | boolean | undefined>
): void {
  analytics.track(event, properties || {})
}

export default {
  trackObjectiveSelected,
  trackHealthPrioritiesSelected,
  trackRoutineEquilibreEnabled,
  trackRoutineEquilibreDisabled,
  trackCheckinPromptShown,
  trackCheckinSubmitted,
  trackCheckinSkipped,
  trackAdviceRequested,
  trackAdviceViewed,
  trackHealthOverviewOpened,
  trackDiversityCardViewed,
  trackGoalsEvent,
}
