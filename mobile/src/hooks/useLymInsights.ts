/**
 * Hook for LYM Insights tracking
 *
 * Provides convenient methods to track user actions in components.
 * Handles first-action detection and continuation-after-reassurance automatically.
 */

import { useCallback } from 'react'
import { lymInsights } from '../services/lym-insights-service'

type ActionType = 'meal_logged' | 'feeling_logged' | 'insight_viewed' | 'chat_opened'
type PostGapActionType = 'meal_logged' | 'feeling_logged' | 'read_only' | 'ignored_suggestions'
type DeviationType = 'rich_meal' | 'skipped_day' | 'over_budget'
type ReassuranceType = 'gap_return' | 'deviation' | 'gentle_reminder'

export function useLymInsights() {
  /**
   * Track a user action (handles first action detection automatically)
   */
  const trackAction = useCallback(async (actionType: ActionType) => {
    // Track as first action if applicable
    await lymInsights.trackFirstAction(actionType)

    // Also check if this is a continuation after reassurance
    await lymInsights.trackContinuedAfterReassurance(actionType)
  }, [])

  /**
   * Track meal logged (convenience wrapper)
   */
  const trackMealLogged = useCallback(async () => {
    await trackAction('meal_logged')
    // Also track as post-gap action if applicable
    await lymInsights.trackPostGapAction('meal_logged')
  }, [trackAction])

  /**
   * Track feeling/wellness logged
   */
  const trackFeelingLogged = useCallback(async () => {
    await trackAction('feeling_logged')
    await lymInsights.trackPostGapAction('feeling_logged')
  }, [trackAction])

  /**
   * Track insight/tip viewed
   */
  const trackInsightViewed = useCallback(async () => {
    await trackAction('insight_viewed')
    await lymInsights.trackPostGapAction('read_only')
  }, [trackAction])

  /**
   * Track chat with LymIA opened
   */
  const trackChatOpened = useCallback(async () => {
    await trackAction('chat_opened')
  }, [trackAction])

  /**
   * Track when user logs a "deviation" (rich meal, over budget, etc.)
   * This is an EMOTIONAL moment - we want to know if our reassurance works
   */
  const trackDeviation = useCallback(async (type?: DeviationType) => {
    await lymInsights.trackFirstDeviation(type)
  }, [])

  /**
   * Track when a reassurance message is shown to the user
   */
  const trackReassuranceShown = useCallback(async (type: ReassuranceType, messageId?: string) => {
    await lymInsights.trackReassuranceShown(type, messageId)
  }, [])

  /**
   * Get helper data for conditional UI
   */
  const getInsightData = useCallback(async () => {
    const [hasHadGap, daysSinceActivity, weeklyActiveDays] = await Promise.all([
      lymInsights.hasHadGap(),
      lymInsights.getDaysSinceLastActivity(),
      lymInsights.getWeeklyActiveDays(),
    ])

    return {
      hasHadGap,
      daysSinceActivity,
      weeklyActiveDays,
      isReturningAfterGap: daysSinceActivity !== null && daysSinceActivity >= 2,
    }
  }, [])

  return {
    trackMealLogged,
    trackFeelingLogged,
    trackInsightViewed,
    trackChatOpened,
    trackDeviation,
    trackReassuranceShown,
    getInsightData,
    // Raw access for edge cases
    lymInsights,
  }
}

export default useLymInsights
