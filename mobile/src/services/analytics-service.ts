/**
 * Analytics Service - Amplitude Integration
 *
 * Centralized analytics tracking for LymIA app.
 * Tracks user actions, feature usage, and engagement metrics.
 */

import * as Amplitude from '@amplitude/analytics-react-native'
import type { UserProfile } from '../types'

// ============= CONFIGURATION =============

const AMPLITUDE_API_KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY || ''

// ============= TYPES =============

export type AnalyticsEvent =
  // Onboarding
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  // Meal tracking
  | 'meal_logged'
  | 'meal_deleted'
  | 'meal_edited'
  | 'food_search'
  | 'food_selected'
  // AI features
  | 'photo_scan_started'
  | 'photo_scan_completed'
  | 'voice_input_started'
  | 'voice_input_completed'
  | 'barcode_scan_started'
  | 'barcode_scan_completed'
  | 'ai_meal_generated'
  | 'meal_plan_generated'
  // Engagement
  | 'app_opened'
  | 'screen_viewed'
  | 'feature_used'
  | 'notification_received'
  | 'notification_tapped'
  // Coach & insights
  | 'coach_insight_viewed'
  | 'coach_celebration_shown'
  | 'coach_alert_shown'
  // Programs
  | 'program_started'
  | 'program_completed'
  | 'program_day_completed'
  // Profile
  | 'profile_updated'
  | 'weight_logged'
  | 'goal_changed'
  // Errors & issues
  | 'error_occurred'
  | 'feature_failed'

export interface AnalyticsProperties {
  // Common
  screen?: string
  source?: string
  duration_ms?: number
  success?: boolean
  error_message?: string
  // Meal specific
  meal_type?: string
  input_method?: 'search' | 'photo' | 'voice' | 'barcode' | 'ai' | 'manual'
  food_source?: 'off' | 'ciqual' | 'gustar' | 'ai'
  calories?: number
  // AI specific
  ai_model?: string
  confidence_score?: number
  // Program specific
  program_id?: string
  program_name?: string
  day_number?: number
  // Search
  query?: string
  results_count?: number
  // Plan
  plan_duration_days?: number
  meals_count?: number
  // Generic
  [key: string]: string | number | boolean | undefined
}

// ============= SERVICE CLASS =============

class AnalyticsService {
  private initialized = false
  private userId: string | null = null

  /**
   * Initialize Amplitude SDK
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    if (!AMPLITUDE_API_KEY) {
      console.warn('[Analytics] No API key configured, analytics disabled')
      return
    }

    try {
      await Amplitude.init(AMPLITUDE_API_KEY, undefined, {
        trackingOptions: {
          ipAddress: false, // GDPR compliance
        },
      })
      this.initialized = true
      console.log('[Analytics] Amplitude initialized')
    } catch (error) {
      console.error('[Analytics] Failed to initialize Amplitude:', error)
    }
  }

  /**
   * Identify user for analytics
   */
  identifyUser(userId: string, profile?: Partial<UserProfile>): void {
    if (!this.initialized) return

    this.userId = userId
    Amplitude.setUserId(userId)

    if (profile) {
      const identify = new Amplitude.Identify()

      if (profile.goal) {
        identify.set('goal', profile.goal)
      }
      if (profile.activityLevel) {
        identify.set('activity_level', profile.activityLevel)
      }
      if (profile.gender) {
        identify.set('gender', profile.gender)
      }
      if (profile.age) {
        identify.set('age_group', this.getAgeGroup(profile.age))
      }
      if (profile.allergies?.length) {
        identify.set('has_allergies', true)
        identify.set('allergies_count', profile.allergies.length)
      }

      Amplitude.identify(identify)
    }

    console.log('[Analytics] User identified:', userId)
  }

  /**
   * Track an analytics event
   */
  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    if (!this.initialized) {
      console.log('[Analytics] Not initialized, skipping:', event)
      return
    }

    Amplitude.track(event, properties)
    console.log('[Analytics] Event tracked:', event, properties)
  }

  /**
   * Track screen view
   */
  trackScreen(screenName: string, properties?: AnalyticsProperties): void {
    this.track('screen_viewed', {
      screen: screenName,
      ...properties,
    })
  }

  /**
   * Track meal logged with details
   */
  trackMealLogged(
    mealType: string,
    inputMethod: AnalyticsProperties['input_method'],
    foodSource: AnalyticsProperties['food_source'],
    calories?: number
  ): void {
    this.track('meal_logged', {
      meal_type: mealType,
      input_method: inputMethod,
      food_source: foodSource,
      calories,
    })
  }

  /**
   * Track AI feature usage
   */
  trackAIFeature(
    feature: 'photo_scan' | 'voice_input' | 'barcode_scan' | 'ai_meal' | 'meal_plan',
    success: boolean,
    durationMs?: number,
    additionalProps?: AnalyticsProperties
  ): void {
    const eventMap: Record<string, AnalyticsEvent> = {
      photo_scan: success ? 'photo_scan_completed' : 'photo_scan_started',
      voice_input: success ? 'voice_input_completed' : 'voice_input_started',
      barcode_scan: success ? 'barcode_scan_completed' : 'barcode_scan_started',
      ai_meal: 'ai_meal_generated',
      meal_plan: 'meal_plan_generated',
    }

    this.track(eventMap[feature], {
      success,
      duration_ms: durationMs,
      ...additionalProps,
    })
  }

  /**
   * Track error for debugging
   */
  trackError(
    feature: string,
    errorMessage: string,
    additionalProps?: AnalyticsProperties
  ): void {
    this.track('error_occurred', {
      feature,
      error_message: errorMessage.substring(0, 200), // Truncate long errors
      ...additionalProps,
    })
  }

  /**
   * Increment user property (for counters)
   */
  incrementUserProperty(property: string, value = 1): void {
    if (!this.initialized) return

    const identify = new Amplitude.Identify()
    identify.add(property, value)
    Amplitude.identify(identify)
  }

  /**
   * Reset analytics (on logout)
   */
  reset(): void {
    if (!this.initialized) return

    Amplitude.reset()
    this.userId = null
    console.log('[Analytics] Reset')
  }

  // ============= HELPERS =============

  private getAgeGroup(age: number): string {
    if (age < 25) return '18-24'
    if (age < 35) return '25-34'
    if (age < 45) return '35-44'
    if (age < 55) return '45-54'
    if (age < 65) return '55-64'
    return '65+'
  }
}

// ============= SINGLETON EXPORT =============

export const analytics = new AnalyticsService()

export default analytics
