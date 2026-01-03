/**
 * LYM Insights Service - Bienveillant Analytics
 *
 * Tracks ONLY the 10 events that matter for LYM:
 * - Continuity (do people come back?)
 * - Reassurance (does our kindness work?)
 * - Return behavior (how do people restart?)
 *
 * Philosophy:
 * - NO toxic metrics (streaks, discipline scores)
 * - NO performance tracking
 * - NO guilt-inducing comparisons
 * - We track moments of life, not achievements
 *
 * Data stored in Supabase (invisible to users, admin-only)
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { getSupabaseClient, isSupabaseConfigured } from './supabase-client'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

// ============= TYPES =============

/**
 * The 10 events we track - nothing more, nothing less
 */
export type LymInsightEvent =
  // Category 1: Activation (3 events)
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'first_action_taken'
  | 'first_day_without_action'
  // Category 2: Continuity (4 events)
  | 'return_after_gap'
  | 'first_gap_detected'
  | 'post_gap_action'
  | 'week_with_partial_usage'
  // Category 3: Reassurance (3 events)
  | 'first_deviation_logged'
  | 'reassurance_message_shown'
  | 'user_continues_after_reassurance'

export type EventCategory = 'activation' | 'continuity' | 'reassurance'

/**
 * Event payloads with typed data
 */
export interface LymInsightPayload {
  // Activation
  onboarding_started: Record<string, never>
  onboarding_completed: { duration_seconds?: number; skipped_steps?: string[] }
  first_action_taken: { action_type: 'meal_logged' | 'feeling_logged' | 'insight_viewed' | 'chat_opened' }
  first_day_without_action: { days_since_install: number }

  // Continuity
  return_after_gap: { gap_days: number }
  first_gap_detected: { gap_days: number; last_action_type?: string }
  post_gap_action: { action_type: 'meal_logged' | 'feeling_logged' | 'read_only' | 'ignored_suggestions' }
  week_with_partial_usage: { active_days: number; total_actions: number }

  // Reassurance
  first_deviation_logged: { deviation_type?: 'rich_meal' | 'skipped_day' | 'over_budget' }
  reassurance_message_shown: { message_type: 'gap_return' | 'deviation' | 'gentle_reminder'; message_id?: string }
  user_continues_after_reassurance: { hours_after: number; action_type: string }
}

// ============= STORAGE KEYS =============

const STORAGE_KEYS = {
  USER_ID: 'lym_insights_user_id',
  FIRST_INSTALL_DATE: 'lym_insights_install_date',
  LAST_ACTIVITY_DATE: 'lym_insights_last_activity',
  FIRST_ACTION_TRACKED: 'lym_insights_first_action_done',
  FIRST_GAP_TRACKED: 'lym_insights_first_gap_done',
  FIRST_DEVIATION_TRACKED: 'lym_insights_first_deviation_done',
  LAST_REASSURANCE_DATE: 'lym_insights_last_reassurance',
  WEEKLY_ACTIVE_DAYS: 'lym_insights_weekly_days',
  ONBOARDING_COMPLETED: 'lym_insights_onboarding_done',
}

// ============= SERVICE CLASS =============

class LymInsightsService {
  private userId: string | null = null
  private initialized = false
  private queue: Array<{ event: LymInsightEvent; category: EventCategory; payload: Record<string, unknown> }> = []

  /**
   * Initialize the service (call on app start)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      // Get or create user ID
      let storedId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID)
      if (!storedId) {
        storedId = `lym_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
        await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, storedId)
      }
      this.userId = storedId

      // Set install date if first time
      const installDate = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_INSTALL_DATE)
      if (!installDate) {
        await AsyncStorage.setItem(STORAGE_KEYS.FIRST_INSTALL_DATE, new Date().toISOString())
      }

      this.initialized = true

      // Flush any queued events
      await this.flushQueue()

      // Check for gaps on startup
      await this.checkForGap()
    } catch (error) {
      console.warn('[LymInsights] Init error:', error)
    }
  }

  /**
   * Core tracking function - sends event to Supabase
   */
  private async trackEvent<T extends LymInsightEvent>(
    event: T,
    category: EventCategory,
    payload: T extends keyof LymInsightPayload ? LymInsightPayload[T] : Record<string, unknown>
  ): Promise<void> {
    if (!this.initialized) {
      // Queue for later
      this.queue.push({ event, category, payload })
      return
    }

    if (!isSupabaseConfigured()) {
      console.log('[LymInsights] Supabase not configured, skipping:', event)
      return
    }

    const client = getSupabaseClient()
    if (!client) return

    try {
      const { error } = await client.from('analytics_events').insert({
        user_id: this.userId,
        event_name: event,
        event_category: category,
        payload,
        app_version: Constants.expoConfig?.version || 'unknown',
        platform: Platform.OS,
      })

      if (error) {
        console.warn('[LymInsights] Track error:', error.message)
      } else {
        console.log('[LymInsights] Tracked:', event)
      }
    } catch (error) {
      console.warn('[LymInsights] Track exception:', error)
    }
  }

  private async flushQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const item = this.queue.shift()
      if (item) {
        await this.trackEvent(item.event as LymInsightEvent, item.category, item.payload)
      }
    }
  }

  // ============= ACTIVATION EVENTS =============

  /**
   * Track onboarding start
   */
  async trackOnboardingStarted(): Promise<void> {
    await this.trackEvent('onboarding_started', 'activation', {})
  }

  /**
   * Track onboarding completion
   */
  async trackOnboardingCompleted(durationSeconds?: number, skippedSteps?: string[]): Promise<void> {
    const alreadyDone = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETED)
    if (alreadyDone) return

    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true')
    await this.trackEvent('onboarding_completed', 'activation', {
      duration_seconds: durationSeconds,
      skipped_steps: skippedSteps,
    })
  }

  /**
   * Track first meaningful action (call this on any user action)
   */
  async trackFirstAction(actionType: LymInsightPayload['first_action_taken']['action_type']): Promise<void> {
    const alreadyTracked = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_ACTION_TRACKED)
    if (alreadyTracked) {
      // Still update last activity
      await this.updateLastActivity()
      return
    }

    await AsyncStorage.setItem(STORAGE_KEYS.FIRST_ACTION_TRACKED, 'true')
    await this.trackEvent('first_action_taken', 'activation', { action_type: actionType })
    await this.updateLastActivity()
  }

  /**
   * Track a day where app was opened but nothing was done
   * (This is HEALTHY behavior for LYM - we normalize inactivity)
   */
  async trackDayWithoutAction(): Promise<void> {
    const installDate = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_INSTALL_DATE)
    if (!installDate) return

    const daysSinceInstall = Math.floor(
      (Date.now() - new Date(installDate).getTime()) / (1000 * 60 * 60 * 24)
    )

    await this.trackEvent('first_day_without_action', 'activation', {
      days_since_install: daysSinceInstall,
    })
  }

  // ============= CONTINUITY EVENTS =============

  /**
   * Check for gap on app open and track return/gap events
   */
  private async checkForGap(): Promise<void> {
    const lastActivity = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY_DATE)
    if (!lastActivity) return

    const lastDate = new Date(lastActivity)
    const today = new Date()
    const gapDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    // Gap of 2+ days
    if (gapDays >= 2) {
      // Track return after gap
      await this.trackEvent('return_after_gap', 'continuity', { gap_days: gapDays })

      // Track first gap (only once per user)
      const firstGapTracked = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_GAP_TRACKED)
      if (!firstGapTracked) {
        await AsyncStorage.setItem(STORAGE_KEYS.FIRST_GAP_TRACKED, 'true')
        await this.trackEvent('first_gap_detected', 'continuity', { gap_days: gapDays })
      }
    }
  }

  /**
   * Track what action user takes after returning from a gap
   */
  async trackPostGapAction(actionType: LymInsightPayload['post_gap_action']['action_type']): Promise<void> {
    const lastActivity = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY_DATE)
    if (!lastActivity) return

    const gapDays = Math.floor(
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Only track if there was a gap
    if (gapDays >= 2) {
      await this.trackEvent('post_gap_action', 'continuity', { action_type: actionType })
    }

    await this.updateLastActivity()
  }

  /**
   * Track weekly usage pattern (call at end of week or on Sunday)
   */
  async trackWeeklyUsage(activeDays: number, totalActions: number): Promise<void> {
    // Only track partial weeks (not full 7 days)
    if (activeDays < 7 && activeDays > 0) {
      await this.trackEvent('week_with_partial_usage', 'continuity', {
        active_days: activeDays,
        total_actions: totalActions,
      })
    }
  }

  // ============= REASSURANCE EVENTS =============

  /**
   * Track first deviation (emotional moment - user admits "écart")
   */
  async trackFirstDeviation(
    deviationType?: LymInsightPayload['first_deviation_logged']['deviation_type']
  ): Promise<void> {
    const alreadyTracked = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_DEVIATION_TRACKED)
    if (alreadyTracked) return

    await AsyncStorage.setItem(STORAGE_KEYS.FIRST_DEVIATION_TRACKED, 'true')
    await this.trackEvent('first_deviation_logged', 'reassurance', {
      deviation_type: deviationType,
    })
  }

  /**
   * Track when a reassurance message is shown
   */
  async trackReassuranceShown(
    messageType: LymInsightPayload['reassurance_message_shown']['message_type'],
    messageId?: string
  ): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_REASSURANCE_DATE, new Date().toISOString())
    await this.trackEvent('reassurance_message_shown', 'reassurance', {
      message_type: messageType,
      message_id: messageId,
    })
  }

  /**
   * Track user activity after reassurance (THE KEY METRIC)
   * Call this when user takes action within 48h of reassurance
   */
  async trackContinuedAfterReassurance(actionType: string): Promise<void> {
    const lastReassurance = await AsyncStorage.getItem(STORAGE_KEYS.LAST_REASSURANCE_DATE)
    if (!lastReassurance) return

    const hoursAfter = Math.floor(
      (Date.now() - new Date(lastReassurance).getTime()) / (1000 * 60 * 60)
    )

    // Only count if within 48 hours
    if (hoursAfter <= 48) {
      await this.trackEvent('user_continues_after_reassurance', 'reassurance', {
        hours_after: hoursAfter,
        action_type: actionType,
      })
      // Clear so we don't track again
      await AsyncStorage.removeItem(STORAGE_KEYS.LAST_REASSURANCE_DATE)
    }
  }

  // ============= HELPERS =============

  private async updateLastActivity(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY_DATE, new Date().toISOString())

    // Update weekly active days
    const today = new Date().toISOString().split('T')[0]
    const weeklyDaysRaw = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_ACTIVE_DAYS)
    const weeklyDays: string[] = weeklyDaysRaw ? JSON.parse(weeklyDaysRaw) : []

    if (!weeklyDays.includes(today)) {
      weeklyDays.push(today)

      // Keep only last 7 days
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const filtered = weeklyDays.filter(d => new Date(d) >= sevenDaysAgo)

      await AsyncStorage.setItem(STORAGE_KEYS.WEEKLY_ACTIVE_DAYS, JSON.stringify(filtered))
    }
  }

  /**
   * Get current weekly active days count
   */
  async getWeeklyActiveDays(): Promise<number> {
    const weeklyDaysRaw = await AsyncStorage.getItem(STORAGE_KEYS.WEEKLY_ACTIVE_DAYS)
    if (!weeklyDaysRaw) return 0

    const weeklyDays: string[] = JSON.parse(weeklyDaysRaw)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    return weeklyDays.filter(d => new Date(d) >= sevenDaysAgo).length
  }

  /**
   * Check if user has had any gap (for UI decisions)
   */
  async hasHadGap(): Promise<boolean> {
    const firstGapTracked = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_GAP_TRACKED)
    return !!firstGapTracked
  }

  /**
   * Get days since last activity
   */
  async getDaysSinceLastActivity(): Promise<number | null> {
    const lastActivity = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY_DATE)
    if (!lastActivity) return null

    return Math.floor(
      (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    )
  }
}

// ============= SINGLETON EXPORT =============

export const lymInsights = new LymInsightsService()

export default lymInsights
