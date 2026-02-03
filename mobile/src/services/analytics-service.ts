/**
 * Analytics Service - Amplitude Integration
 *
 * Centralized analytics tracking for LymIA app.
 * Tracks user actions, feature usage, and engagement metrics.
 *
 * Features:
 * - User cohort tracking
 * - Conversion funnels
 * - Retention metrics
 * - Automated alerts thresholds
 */

import * as Amplitude from '@amplitude/analytics-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserProfile } from '../types'

// ============= CONFIGURATION =============

const AMPLITUDE_API_KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY || ''
const LOCAL_ANALYTICS_KEY = 'local_analytics_data'

// ============= COHORT DEFINITIONS =============

export type UserCohort =
  | 'new_user_day_0'
  | 'new_user_week_1'
  | 'returning_user'
  | 'power_user'
  | 'at_risk'
  | 'churned'
  | 'reactivated'
  | 'premium' // Future
  | 'free'

export interface CohortDefinition {
  id: UserCohort
  name: string
  description: string
  criteria: {
    minDaysSinceSignup?: number
    maxDaysSinceSignup?: number
    minSessionCount?: number
    maxSessionCount?: number
    minMealsLogged?: number
    minStreakDays?: number
    daysSinceLastActive?: number
  }
}

const COHORT_DEFINITIONS: CohortDefinition[] = [
  {
    id: 'new_user_day_0',
    name: 'Nouveaux (J0)',
    description: 'Utilisateurs inscrits aujourd\'hui',
    criteria: { maxDaysSinceSignup: 0 },
  },
  {
    id: 'new_user_week_1',
    name: 'Nouveaux (Semaine 1)',
    description: 'Utilisateurs inscrits il y a moins de 7 jours',
    criteria: { minDaysSinceSignup: 1, maxDaysSinceSignup: 7 },
  },
  {
    id: 'returning_user',
    name: 'Utilisateurs réguliers',
    description: 'Utilisateurs actifs depuis plus de 7 jours',
    criteria: { minDaysSinceSignup: 8, minSessionCount: 5 },
  },
  {
    id: 'power_user',
    name: 'Power Users',
    description: 'Utilisateurs très engagés (10+ repas/semaine)',
    criteria: { minMealsLogged: 10, minStreakDays: 7 },
  },
  {
    id: 'at_risk',
    name: 'À risque',
    description: 'Utilisateurs inactifs depuis 3-7 jours',
    criteria: { daysSinceLastActive: 3, maxSessionCount: 2 },
  },
  {
    id: 'churned',
    name: 'Churned',
    description: 'Utilisateurs inactifs depuis plus de 14 jours',
    criteria: { daysSinceLastActive: 14 },
  },
  {
    id: 'reactivated',
    name: 'Réactivés',
    description: 'Utilisateurs revenus après inactivité',
    criteria: { daysSinceLastActive: 0 }, // Special handling needed
  },
]

// ============= FUNNEL DEFINITIONS =============

export type FunnelId =
  | 'onboarding_completion'
  | 'first_meal_logged'
  | 'first_week_retention'
  | 'feature_discovery'
  | 'streak_achievement'
  | 'subscription_conversion'
  | 'wellness_engagement'

export interface FunnelStep {
  id: string
  name: string
  event: AnalyticsEvent
  requiredProperties?: Record<string, unknown>
}

export interface FunnelDefinition {
  id: FunnelId
  name: string
  description: string
  steps: FunnelStep[]
  targetConversionRate: number // Expected % (e.g., 0.8 = 80%)
  alertThreshold: number // Alert if below this rate
}

const FUNNEL_DEFINITIONS: FunnelDefinition[] = [
  {
    id: 'onboarding_completion',
    name: 'Complétion Onboarding',
    description: 'Du lancement à la fin de l\'onboarding',
    steps: [
      { id: 'start', name: 'App ouverte', event: 'app_opened' },
      { id: 'step1', name: 'Onboarding démarré', event: 'onboarding_started' },
      { id: 'step2', name: 'Profil créé', event: 'onboarding_step_completed', requiredProperties: { step: 'profile' } },
      { id: 'complete', name: 'Onboarding terminé', event: 'onboarding_completed' },
    ],
    targetConversionRate: 0.85,
    alertThreshold: 0.7,
  },
  {
    id: 'first_meal_logged',
    name: 'Premier repas loggé',
    description: 'De l\'onboarding au premier repas',
    steps: [
      { id: 'onboarded', name: 'Onboarding terminé', event: 'onboarding_completed' },
      { id: 'screen', name: 'Écran tracking vu', event: 'screen_viewed', requiredProperties: { screen: 'AddMeal' } },
      { id: 'logged', name: 'Repas enregistré', event: 'meal_logged' },
    ],
    targetConversionRate: 0.75,
    alertThreshold: 0.6,
  },
  {
    id: 'first_week_retention',
    name: 'Rétention Semaine 1',
    description: 'Activité pendant la première semaine',
    steps: [
      { id: 'day1', name: 'Jour 1', event: 'app_opened' },
      { id: 'day3', name: 'Jour 3', event: 'app_opened' },
      { id: 'day7', name: 'Jour 7', event: 'app_opened' },
    ],
    targetConversionRate: 0.5,
    alertThreshold: 0.35,
  },
  {
    id: 'feature_discovery',
    name: 'Découverte fonctionnalités',
    description: 'Utilisation des features IA',
    steps: [
      { id: 'photo', name: 'Photo scan utilisé', event: 'photo_scan_completed' },
      { id: 'voice', name: 'Voice input utilisé', event: 'voice_input_completed' },
      { id: 'coach', name: 'Coach insight vu', event: 'coach_insight_viewed' },
    ],
    targetConversionRate: 0.4,
    alertThreshold: 0.25,
  },
  {
    id: 'streak_achievement',
    name: 'Atteinte streak 7 jours',
    description: 'Utilisateurs atteignant 7 jours consécutifs',
    steps: [
      { id: 'day1', name: '1 jour', event: 'meal_logged' },
      { id: 'day3', name: '3 jours', event: 'meal_logged' },
      { id: 'day7', name: '7 jours', event: 'meal_logged' },
    ],
    targetConversionRate: 0.3,
    alertThreshold: 0.2,
  },
  {
    id: 'subscription_conversion',
    name: 'Conversion Abonnement',
    description: 'Du paywall à l\'abonnement actif',
    steps: [
      { id: 'paywall', name: 'Paywall vu', event: 'paywall_viewed' },
      { id: 'initiated', name: 'Paiement initié', event: 'payment_initiated' },
      { id: 'completed', name: 'Paiement terminé', event: 'payment_completed' },
      { id: 'active', name: 'Abonnement actif', event: 'subscription_activated' },
    ],
    targetConversionRate: 0.1,
    alertThreshold: 0.05,
  },
  {
    id: 'wellness_engagement',
    name: 'Engagement Bien-être',
    description: 'Utilisation des features bien-être',
    steps: [
      { id: 'mood', name: 'Humeur enregistrée', event: 'mood_logged' },
      { id: 'sleep', name: 'Sommeil tracké', event: 'sleep_tracked' },
      { id: 'meditation', name: 'Méditation complétée', event: 'meditation_completed' },
    ],
    targetConversionRate: 0.25,
    alertThreshold: 0.15,
  },
]

// ============= ALERT THRESHOLDS =============

export interface AlertThreshold {
  id: string
  name: string
  metric: string
  operator: 'below' | 'above'
  threshold: number
  severity: 'info' | 'warning' | 'critical'
  description: string
}

const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    id: 'daily_active_users_drop',
    name: 'Chute DAU',
    metric: 'daily_active_users',
    operator: 'below',
    threshold: 100, // Adjust based on user base
    severity: 'warning',
    description: 'Nombre d\'utilisateurs actifs quotidiens en dessous du seuil',
  },
  {
    id: 'onboarding_completion_low',
    name: 'Onboarding faible',
    metric: 'onboarding_completion_rate',
    operator: 'below',
    threshold: 0.7,
    severity: 'critical',
    description: 'Taux de complétion de l\'onboarding trop bas',
  },
  {
    id: 'meal_logging_drop',
    name: 'Baisse logs repas',
    metric: 'meals_logged_per_user',
    operator: 'below',
    threshold: 2,
    severity: 'warning',
    description: 'Moyenne de repas loggés par utilisateur trop basse',
  },
  {
    id: 'error_rate_high',
    name: 'Taux erreurs élevé',
    metric: 'error_rate',
    operator: 'above',
    threshold: 0.05,
    severity: 'critical',
    description: 'Plus de 5% des actions génèrent des erreurs',
  },
  {
    id: 'ai_feature_failure',
    name: 'Échec features IA',
    metric: 'ai_failure_rate',
    operator: 'above',
    threshold: 0.15,
    severity: 'warning',
    description: 'Plus de 15% des features IA échouent',
  },
]

// ============= TYPES =============

export type AnalyticsEvent =
  // Onboarding
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  // Meal tracking (Nutrition)
  | 'meal_logged'
  | 'meal_deleted'
  | 'meal_edited'
  | 'food_search'
  | 'food_selected'
  | 'nutrition_goal_set'
  | 'calorie_tracked'
  | 'recipe_viewed'
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
  // Programs & Challenges
  | 'program_started'
  | 'program_completed'
  | 'program_day_completed'
  | 'challenge_joined'
  | 'challenge_completed'
  | 'workout_started'
  | 'workout_completed'
  // Wellness (Bien-être)
  | 'mood_logged'
  | 'sleep_tracked'
  | 'meditation_started'
  | 'meditation_completed'
  | 'wellness_score_viewed'
  | 'stress_level_logged'
  // Profile
  | 'profile_updated'
  | 'weight_logged'
  | 'goal_changed'
  // Goals & Health Module
  | 'objective_selected'
  | 'health_priorities_selected'
  | 'routine_equilibre_enabled'
  | 'routine_equilibre_disabled'
  | 'checkin_prompt_shown'
  | 'checkin_submitted'
  | 'checkin_skipped'
  | 'advice_requested'
  | 'advice_viewed'
  | 'health_overview_opened'
  | 'diversity_card_viewed'
  // Payment & Subscription
  | 'paywall_viewed'
  | 'subscription_started'
  | 'subscription_trial_started'
  | 'subscription_activated'
  | 'subscription_renewed'
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'payment_initiated'
  | 'payment_completed'
  | 'payment_failed'
  | 'upgrade_prompt_shown'
  | 'upgrade_prompt_clicked'
  // Revenue Events (RevenueCat)
  | 'trial_started'
  | 'trial_converted'
  | 'trial_expired'
  | 'subscription_refunded'
  | 'billing_issue_detected'
  | 'billing_issue_resolved'
  | 'revenue_generated'
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
  // Meal specific (Nutrition)
  meal_type?: string
  input_method?: 'search' | 'photo' | 'voice' | 'barcode' | 'ai' | 'manual'
  food_source?: 'off' | 'ciqual' | 'gustar' | 'ai'
  calories?: number
  recipe_id?: string
  recipe_name?: string
  // AI specific
  ai_model?: string
  confidence_score?: number
  // Program & Challenge specific
  program_id?: string
  program_name?: string
  day_number?: number
  challenge_id?: string
  challenge_name?: string
  workout_type?: string
  workout_duration_min?: number
  // Wellness specific
  mood_score?: number
  mood_type?: 'happy' | 'neutral' | 'sad' | 'stressed' | 'energized' | 'tired'
  sleep_hours?: number
  sleep_quality?: 'poor' | 'fair' | 'good' | 'excellent'
  stress_level?: number
  meditation_type?: string
  // Search
  query?: string
  results_count?: number
  // Plan
  plan_duration_days?: number
  meals_count?: number
  // Payment & Subscription specific
  subscription_plan?: 'monthly' | 'yearly' | 'lifetime'
  subscription_price?: number
  subscription_currency?: string
  payment_method?: 'apple_pay' | 'google_pay' | 'card' | 'paypal'
  trial_duration_days?: number
  cancellation_reason?: string
  upgrade_from?: string
  upgrade_to?: string
  paywall_variant?: string
  // Revenue KPIs (RevenueCat integration)
  revenue?: number
  mrr?: number // Monthly Recurring Revenue
  ltv?: number // Lifetime Value
  product_id?: string
  transaction_id?: string
  store?: 'app_store' | 'play_store'
  is_trial_conversion?: boolean
  trial_start_date?: string
  subscription_start_date?: string
  billing_issue?: boolean
  refund_reason?: string
  // Generic
  [key: string]: string | number | boolean | undefined
}

// ============= COHORT TRACKING =============

interface LocalAnalyticsData {
  signupDate: string
  lastActiveDate: string
  sessionCount: number
  totalMealsLogged: number
  currentStreak: number
  funnelProgress: Record<FunnelId, string[]> // Completed step IDs
  cohortHistory: { cohort: UserCohort; date: string }[]
}

class CohortTracker {
  private data: LocalAnalyticsData | null = null

  async initialize(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(LOCAL_ANALYTICS_KEY)
      if (stored) {
        this.data = JSON.parse(stored)
      } else {
        this.data = {
          signupDate: new Date().toISOString(),
          lastActiveDate: new Date().toISOString(),
          sessionCount: 0,
          totalMealsLogged: 0,
          currentStreak: 0,
          funnelProgress: {
            onboarding_completion: [],
            first_meal_logged: [],
            first_week_retention: [],
            feature_discovery: [],
            streak_achievement: [],
            subscription_conversion: [],
            wellness_engagement: [],
          },
          cohortHistory: [],
        }
        await this.save()
      }
    } catch (error) {
      console.error('[CohortTracker] Initialize error:', error)
    }
  }

  private async save(): Promise<void> {
    if (this.data) {
      await AsyncStorage.setItem(LOCAL_ANALYTICS_KEY, JSON.stringify(this.data))
    }
  }

  /**
   * Record a new session
   */
  async recordSession(): Promise<void> {
    if (!this.data) await this.initialize()
    if (!this.data) return

    this.data.sessionCount++
    this.data.lastActiveDate = new Date().toISOString()
    await this.save()
  }

  /**
   * Record a meal logged
   */
  async recordMealLogged(): Promise<void> {
    if (!this.data) return

    this.data.totalMealsLogged++
    await this.save()
  }

  /**
   * Update streak
   */
  async updateStreak(streak: number): Promise<void> {
    if (!this.data) return

    this.data.currentStreak = streak
    await this.save()
  }

  /**
   * Determine user's current cohort
   */
  async getCurrentCohort(): Promise<UserCohort> {
    if (!this.data) await this.initialize()
    if (!this.data) return 'free'

    const daysSinceSignup = this.daysBetween(new Date(this.data.signupDate), new Date())
    const daysSinceLastActive = this.daysBetween(new Date(this.data.lastActiveDate), new Date())

    // Check cohorts in priority order
    if (daysSinceLastActive >= 14) return 'churned'
    if (daysSinceLastActive >= 3 && this.data.sessionCount < 3) return 'at_risk'
    if (this.data.totalMealsLogged >= 10 && this.data.currentStreak >= 7) return 'power_user'
    if (daysSinceSignup <= 0) return 'new_user_day_0'
    if (daysSinceSignup <= 7) return 'new_user_week_1'
    if (this.data.sessionCount >= 5) return 'returning_user'

    return 'free'
  }

  /**
   * Record funnel step completion
   */
  async recordFunnelStep(funnelId: FunnelId, stepId: string): Promise<void> {
    if (!this.data) return

    if (!this.data.funnelProgress[funnelId]) {
      this.data.funnelProgress[funnelId] = []
    }

    if (!this.data.funnelProgress[funnelId].includes(stepId)) {
      this.data.funnelProgress[funnelId].push(stepId)
      await this.save()
    }
  }

  /**
   * Get funnel progress
   */
  getFunnelProgress(funnelId: FunnelId): string[] {
    return this.data?.funnelProgress[funnelId] || []
  }

  /**
   * Calculate funnel conversion rate
   */
  getFunnelConversionRate(funnelId: FunnelId): number {
    const funnel = FUNNEL_DEFINITIONS.find((f) => f.id === funnelId)
    if (!funnel) return 0

    const completedSteps = this.getFunnelProgress(funnelId)
    return completedSteps.length / funnel.steps.length
  }

  /**
   * Get cohort metrics for user
   */
  async getCohortMetrics(): Promise<Record<string, unknown>> {
    if (!this.data) await this.initialize()
    if (!this.data) return {}

    return {
      days_since_signup: this.daysBetween(new Date(this.data.signupDate), new Date()),
      days_since_last_active: this.daysBetween(new Date(this.data.lastActiveDate), new Date()),
      session_count: this.data.sessionCount,
      total_meals_logged: this.data.totalMealsLogged,
      current_streak: this.data.currentStreak,
      current_cohort: await this.getCurrentCohort(),
    }
  }

  private daysBetween(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000
    return Math.floor(Math.abs((date2.getTime() - date1.getTime()) / oneDay))
  }
}

// ============= EXTENDED ANALYTICS SERVICE =============

class AnalyticsService {
  private initialized = false
  private userId: string | null = null
  private cohortTracker = new CohortTracker()

  /**
   * Initialize Amplitude SDK
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Initialize local tracking first
    await this.cohortTracker.initialize()

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

      // Set cohort on init
      const cohort = await this.cohortTracker.getCurrentCohort()
      this.setUserCohort(cohort)
    } catch (error) {
      console.error('[Analytics] Failed to initialize Amplitude:', error)
    }
  }

  /**
   * Identify user for analytics
   */
  async identifyUser(userId: string, profile?: Partial<UserProfile>): Promise<void> {
    if (!this.initialized) return

    this.userId = userId
    Amplitude.setUserId(userId)

    // Get cohort metrics
    const cohortMetrics = await this.cohortTracker.getCohortMetrics()

    const identify = new Amplitude.Identify()

    if (profile) {
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
    }

    // Set cohort properties
    identify.set('cohort', cohortMetrics.current_cohort as string)
    identify.set('days_since_signup', cohortMetrics.days_since_signup as number)
    identify.set('total_sessions', cohortMetrics.session_count as number)
    identify.set('total_meals_logged', cohortMetrics.total_meals_logged as number)
    identify.set('current_streak', cohortMetrics.current_streak as number)

    Amplitude.identify(identify)
    console.log('[Analytics] User identified:', userId, 'Cohort:', cohortMetrics.current_cohort)
  }

  /**
   * Set user cohort
   */
  private setUserCohort(cohort: UserCohort): void {
    if (!this.initialized) return

    const identify = new Amplitude.Identify()
    identify.set('cohort', cohort)
    identify.set('cohort_updated_at', new Date().toISOString())
    Amplitude.identify(identify)
  }

  /**
   * Track an analytics event
   */
  track(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    if (!this.initialized) {
      console.log('[Analytics] Not initialized, skipping:', event)
      return
    }

    // Add cohort context to all events
    this.cohortTracker.getCurrentCohort().then((cohort) => {
      const enrichedProps = {
        ...properties,
        user_cohort: cohort,
        timestamp: new Date().toISOString(),
      }
      Amplitude.track(event, enrichedProps)
    })

    // Check and record funnel progress
    this.checkFunnelProgress(event, properties)

    // Update local metrics
    if (event === 'app_opened') {
      this.cohortTracker.recordSession()
    }
    if (event === 'meal_logged') {
      this.cohortTracker.recordMealLogged()
    }

    console.log('[Analytics] Event tracked:', event, properties)
  }

  /**
   * Check if event completes any funnel step
   */
  private checkFunnelProgress(event: AnalyticsEvent, properties?: AnalyticsProperties): void {
    for (const funnel of FUNNEL_DEFINITIONS) {
      for (const step of funnel.steps) {
        if (step.event === event) {
          // Check if required properties match
          let matches = true
          if (step.requiredProperties) {
            for (const [key, value] of Object.entries(step.requiredProperties)) {
              if (properties?.[key] !== value) {
                matches = false
                break
              }
            }
          }

          if (matches) {
            this.cohortTracker.recordFunnelStep(funnel.id, step.id)
          }
        }
      }
    }
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

  // ============= PAYMENT & SUBSCRIPTION TRACKING =============

  /**
   * Track paywall view
   */
  trackPaywallViewed(source: string, variant?: string): void {
    this.track('paywall_viewed', {
      source,
      paywall_variant: variant,
    })
  }

  /**
   * Track subscription events
   */
  trackSubscription(
    event: 'started' | 'trial_started' | 'activated' | 'renewed' | 'cancelled' | 'expired',
    plan: AnalyticsProperties['subscription_plan'],
    price?: number,
    additionalProps?: AnalyticsProperties
  ): void {
    const eventMap: Record<string, AnalyticsEvent> = {
      started: 'subscription_started',
      trial_started: 'subscription_trial_started',
      activated: 'subscription_activated',
      renewed: 'subscription_renewed',
      cancelled: 'subscription_cancelled',
      expired: 'subscription_expired',
    }

    this.track(eventMap[event], {
      subscription_plan: plan,
      subscription_price: price,
      ...additionalProps,
    })

    // Update user property for subscription status
    if (this.initialized) {
      const identify = new Amplitude.Identify()
      if (event === 'activated' || event === 'renewed') {
        identify.set('is_premium', true)
        identify.set('subscription_plan', plan || 'unknown')
      } else if (event === 'cancelled' || event === 'expired') {
        identify.set('is_premium', false)
      }
      Amplitude.identify(identify)
    }
  }

  /**
   * Track payment events
   */
  trackPayment(
    event: 'initiated' | 'completed' | 'failed',
    method: AnalyticsProperties['payment_method'],
    amount?: number,
    additionalProps?: AnalyticsProperties
  ): void {
    const eventMap: Record<string, AnalyticsEvent> = {
      initiated: 'payment_initiated',
      completed: 'payment_completed',
      failed: 'payment_failed',
    }

    this.track(eventMap[event], {
      payment_method: method,
      subscription_price: amount,
      success: event === 'completed',
      ...additionalProps,
    })
  }

  // ============= WELLNESS TRACKING =============

  /**
   * Track mood logged
   */
  trackMoodLogged(
    moodType: AnalyticsProperties['mood_type'],
    score?: number
  ): void {
    this.track('mood_logged', {
      mood_type: moodType,
      mood_score: score,
    })
  }

  /**
   * Track sleep
   */
  trackSleep(hours: number, quality: AnalyticsProperties['sleep_quality']): void {
    this.track('sleep_tracked', {
      sleep_hours: hours,
      sleep_quality: quality,
    })
  }

  /**
   * Track meditation
   */
  trackMeditation(
    event: 'started' | 'completed',
    type: string,
    durationMs?: number
  ): void {
    this.track(event === 'started' ? 'meditation_started' : 'meditation_completed', {
      meditation_type: type,
      duration_ms: durationMs,
      success: event === 'completed',
    })
  }

  /**
   * Track workout
   */
  trackWorkout(
    event: 'started' | 'completed',
    type: string,
    durationMin?: number
  ): void {
    this.track(event === 'started' ? 'workout_started' : 'workout_completed', {
      workout_type: type,
      workout_duration_min: durationMin,
      success: event === 'completed',
    })
  }

  /**
   * Track challenge
   */
  trackChallenge(
    event: 'joined' | 'completed',
    challengeId: string,
    challengeName: string
  ): void {
    this.track(event === 'joined' ? 'challenge_joined' : 'challenge_completed', {
      challenge_id: challengeId,
      challenge_name: challengeName,
      success: event === 'completed',
    })
  }

  // ============= REVENUE TRACKING (RevenueCat Integration) =============

  /**
   * Track trial events
   */
  trackTrial(
    event: 'started' | 'converted' | 'expired',
    plan: AnalyticsProperties['subscription_plan'],
    additionalProps?: AnalyticsProperties
  ): void {
    const eventMap: Record<string, AnalyticsEvent> = {
      started: 'trial_started',
      converted: 'trial_converted',
      expired: 'trial_expired',
    }

    this.track(eventMap[event], {
      subscription_plan: plan,
      is_trial_conversion: event === 'converted',
      ...additionalProps,
    })

    // Update user property
    if (this.initialized) {
      const identify = new Amplitude.Identify()
      if (event === 'started') {
        identify.set('is_in_trial', true)
        identify.set('trial_start_date', new Date().toISOString())
      } else if (event === 'converted') {
        identify.set('is_in_trial', false)
        identify.set('is_premium', true)
        identify.set('converted_from_trial', true)
      } else if (event === 'expired') {
        identify.set('is_in_trial', false)
        identify.set('trial_expired', true)
      }
      Amplitude.identify(identify)
    }
  }

  /**
   * Track revenue event (for MRR/LTV calculations)
   */
  trackRevenue(
    amount: number,
    productId: string,
    plan: AnalyticsProperties['subscription_plan'],
    currency: string = 'EUR',
    additionalProps?: AnalyticsProperties
  ): void {
    // Use Amplitude's revenue tracking
    if (this.initialized) {
      const revenue = new Amplitude.Revenue()
        .setProductId(productId)
        .setPrice(amount)
        .setQuantity(1)

      Amplitude.revenue(revenue)
    }

    // Also track as custom event for dashboards
    this.track('revenue_generated', {
      revenue: amount,
      product_id: productId,
      subscription_plan: plan,
      subscription_currency: currency,
      ...additionalProps,
    })
  }

  /**
   * Track billing issues
   */
  trackBillingIssue(
    event: 'detected' | 'resolved',
    plan: AnalyticsProperties['subscription_plan'],
    additionalProps?: AnalyticsProperties
  ): void {
    this.track(event === 'detected' ? 'billing_issue_detected' : 'billing_issue_resolved', {
      subscription_plan: plan,
      billing_issue: event === 'detected',
      ...additionalProps,
    })
  }

  /**
   * Track refund
   */
  trackRefund(
    amount: number,
    productId: string,
    reason?: string
  ): void {
    this.track('subscription_refunded', {
      revenue: -amount, // Negative for refund
      product_id: productId,
      refund_reason: reason,
    })

    // Update user property
    if (this.initialized) {
      const identify = new Amplitude.Identify()
      identify.set('is_premium', false)
      identify.set('has_refunded', true)
      Amplitude.identify(identify)
    }
  }

  /**
   * Set revenue user properties (from RevenueCat customer info)
   */
  setRevenueUserProperties(props: {
    isPremium: boolean
    plan?: string
    isInTrial?: boolean
    willRenew?: boolean
    expirationDate?: string
    totalRevenue?: number
  }): void {
    if (!this.initialized) return

    const identify = new Amplitude.Identify()
    identify.set('is_premium', props.isPremium)

    if (props.plan) {
      identify.set('subscription_plan', props.plan)
    }
    if (props.isInTrial !== undefined) {
      identify.set('is_in_trial', props.isInTrial)
    }
    if (props.willRenew !== undefined) {
      identify.set('will_renew', props.willRenew)
    }
    if (props.expirationDate) {
      identify.set('subscription_expiration', props.expirationDate)
    }
    if (props.totalRevenue !== undefined) {
      identify.set('total_revenue', props.totalRevenue)
    }

    Amplitude.identify(identify)
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

  // ============= COHORT & FUNNEL METHODS =============

  /**
   * Update user streak
   */
  async updateStreak(streak: number): Promise<void> {
    await this.cohortTracker.updateStreak(streak)

    if (this.initialized) {
      const identify = new Amplitude.Identify()
      identify.set('current_streak', streak)
      Amplitude.identify(identify)
    }
  }

  /**
   * Get current user cohort
   */
  async getCurrentCohort(): Promise<UserCohort> {
    return this.cohortTracker.getCurrentCohort()
  }

  /**
   * Get funnel conversion rates
   */
  getFunnelMetrics(): Record<FunnelId, { completedSteps: number; totalSteps: number; conversionRate: number }> {
    const metrics: Record<string, { completedSteps: number; totalSteps: number; conversionRate: number }> = {}

    for (const funnel of FUNNEL_DEFINITIONS) {
      const progress = this.cohortTracker.getFunnelProgress(funnel.id)
      metrics[funnel.id] = {
        completedSteps: progress.length,
        totalSteps: funnel.steps.length,
        conversionRate: progress.length / funnel.steps.length,
      }
    }

    return metrics as Record<FunnelId, { completedSteps: number; totalSteps: number; conversionRate: number }>
  }

  /**
   * Get cohort metrics
   */
  async getCohortMetrics(): Promise<Record<string, unknown>> {
    return this.cohortTracker.getCohortMetrics()
  }

  /**
   * Check alerts and return any triggered
   */
  checkAlerts(metrics: Record<string, number>): AlertThreshold[] {
    const triggered: AlertThreshold[] = []

    for (const alert of ALERT_THRESHOLDS) {
      const value = metrics[alert.metric]
      if (value === undefined) continue

      if (alert.operator === 'below' && value < alert.threshold) {
        triggered.push(alert)
      } else if (alert.operator === 'above' && value > alert.threshold) {
        triggered.push(alert)
      }
    }

    return triggered
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

// Export cohort and funnel definitions for use in dashboards
export { COHORT_DEFINITIONS, FUNNEL_DEFINITIONS, ALERT_THRESHOLDS }

export default analytics
