/**
 * Super Agent IA - Orchestrateur Central Intelligent
 *
 * Ce Super Agent va AU-DELA du simple coordinator:
 * - Orchestration de tous les agents (Behavior, Wellness, LymIA Brain)
 * - Event Detection intelligent (patterns, anomalies, milestones)
 * - Prioritization des insights pour notifications
 * - Cross-agent correlation avancée
 * - Scheduled daily analysis
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                     SUPER AGENT IA                          │
 * │                                                              │
 * │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
 * │  │ Behavior    │  │ Wellness    │  │ LymIA Brain │         │
 * │  │ Agent       │◄─┼─► Agent     │◄─┼─► Agent     │         │
 * │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
 * │         │                │                │                 │
 * │         └────────────────┼────────────────┘                 │
 * │                          ▼                                  │
 * │              ┌───────────────────────┐                      │
 * │              │   Event Detection     │                      │
 * │              │   & Prioritization    │                      │
 * │              └───────────────────────┘                      │
 * │                          │                                  │
 * │                          ▼                                  │
 * │              ┌───────────────────────┐                      │
 * │              │   Notification        │                      │
 * │              │   Decision Engine     │                      │
 * │              └───────────────────────┘                      │
 * └──────────────────────────┬──────────────────────────────────┘
 *                            │
 *                            ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                  notification-service.ts                     │
 * │  - sendNotification() quand événement pertinent détecté     │
 * └─────────────────────────────────────────────────────────────┘
 */

import {
  analyzeBehavior,
  getQuickHealthCheck,
  type BehaviorAnalysisResult,
  type UserBehaviorData,
  type BehaviorAlert,
} from './behavior-analysis-agent'

import {
  analyzeWellness,
  getQuickWellnessCheck,
  type WellnessAnalysisResult,
  type WellnessUserData,
  type WellnessAlert,
} from './wellness-agent'

import {
  getCoachingAdvice,
  generateConnectedInsights,
  type UserContext,
  type CoachingAdvice,
  type ConnectedInsight,
} from './lymia-brain'

import {
  sendNotification,
  canSendNotification,
  type NotificationData,
} from './notification-service'

import { queryKnowledgeBase, isSupabaseConfigured } from './supabase-client'

import type { UserProfile, Meal, WellnessEntry, NutritionInfo } from '../types'

// ============= TYPES =============

/**
 * Full context for Super Agent analysis
 */
export interface SuperAgentContext {
  // User data
  profile: UserProfile

  // Nutrition data
  meals: Meal[]
  todayNutrition: NutritionInfo
  weeklyNutrition: NutritionInfo[]

  // Wellness data
  wellnessEntries: WellnessEntry[]
  todayWellness?: Partial<WellnessEntry>

  // Sport data
  sportSessions?: Array<{
    date: string
    type: string
    duration: number
    intensity: 'low' | 'moderate' | 'high'
    completed: boolean
  }>

  // Gamification
  streak: number
  level: number
  xp: number

  // Temporal
  daysTracked: number
}

/**
 * Event types that can trigger analysis
 */
export type EventType =
  | 'app_opened'
  | 'meal_logged'
  | 'wellness_logged'
  | 'sport_completed'
  | 'goal_reached'
  | 'streak_milestone'
  | 'weight_updated'
  | 'daily_check'
  | 'user_inactive'

/**
 * Detected event with priority
 */
export interface DetectedEvent {
  id: string
  type: EventType
  priority: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  category: 'nutrition' | 'wellness' | 'sport' | 'progress' | 'alert'
  source?: string
  data?: Record<string, unknown>
  detectedAt: string
}

/**
 * Daily insight for notification
 */
export interface DailyInsight {
  title: string        // Max 50 chars
  body: string         // Max 150 chars
  category: 'nutrition' | 'wellness' | 'sport' | 'progress'
  severity: 'info' | 'warning' | 'celebration'
  deepLink?: string
  source?: string
  confidence: number
}

/**
 * Complete Super Agent analysis result
 */
export interface SuperAgentAnalysis {
  // Agent results
  behaviorResult?: BehaviorAnalysisResult
  wellnessResult?: WellnessAnalysisResult
  coachingAdvices: CoachingAdvice[]
  connectedInsights: ConnectedInsight[]

  // Event detection
  detectedEvents: DetectedEvent[]

  // Selected daily insight (for notification)
  dailyInsight?: DailyInsight

  // Metadata
  analyzedAt: string
  ragSourcesUsed: string[]
  notificationSent: boolean
  confidence: number
}

// ============= EVENT DETECTION =============

/**
 * Detect important events from user data
 */
function detectEvents(
  context: SuperAgentContext,
  behaviorResult?: BehaviorAnalysisResult,
  wellnessResult?: WellnessAnalysisResult
): DetectedEvent[] {
  const events: DetectedEvent[] = []
  const now = new Date().toISOString()

  // 1. CRITICAL: Excessive calorie deficit
  if (context.profile.nutritionalNeeds && context.todayNutrition.calories > 0) {
    const calorieRatio = context.todayNutrition.calories / context.profile.nutritionalNeeds.calories

    if (calorieRatio < 0.5 && new Date().getHours() >= 18) {
      events.push({
        id: `event_deficit_${Date.now()}`,
        type: 'goal_reached',
        priority: 'critical',
        title: 'Apport trop faible',
        message: `Tu n'as consommé que ${Math.round(calorieRatio * 100)}% de tes calories. C'est trop restrictif.`,
        category: 'alert',
        source: 'ANSES',
        detectedAt: now,
      })
    }
  }

  // 2. HIGH: Protein deficiency pattern
  const proteinDeficitDays = context.weeklyNutrition.filter(n => {
    const target = context.profile.nutritionalNeeds?.proteins || 100
    return n.proteins < target * 0.6
  }).length

  if (proteinDeficitDays >= 3) {
    events.push({
      id: `event_protein_pattern_${Date.now()}`,
      type: 'goal_reached',
      priority: 'high',
      title: 'Protéines insuffisantes',
      message: `${proteinDeficitDays} jours avec moins de 60% de protéines. Pense aux œufs, poisson, légumineuses.`,
      category: 'nutrition',
      source: 'ANSES',
      detectedAt: now,
    })
  }

  // 3. HIGH: Sleep deprivation pattern
  const poorSleepDays = context.wellnessEntries.filter(
    w => w.sleepHours !== undefined && w.sleepHours < 6
  ).length

  if (poorSleepDays >= 3 && context.wellnessEntries.length >= 5) {
    events.push({
      id: `event_sleep_pattern_${Date.now()}`,
      type: 'wellness_logged',
      priority: 'high',
      title: 'Sommeil insuffisant',
      message: `${poorSleepDays} nuits courtes cette semaine. Ça impacte ta faim et ton énergie.`,
      category: 'wellness',
      source: 'INSERM',
      detectedAt: now,
    })
  }

  // 4. HIGH: Chronic stress
  const highStressDays = context.wellnessEntries.filter(
    w => w.stressLevel !== undefined && w.stressLevel >= 4
  ).length

  if (highStressDays >= 4 && context.wellnessEntries.length >= 5) {
    events.push({
      id: `event_stress_pattern_${Date.now()}`,
      type: 'wellness_logged',
      priority: 'high',
      title: 'Stress chronique détecté',
      message: `Stress élevé ${highStressDays} jours sur 7. Essaie 5 min de cohérence cardiaque.`,
      category: 'wellness',
      source: 'HAS',
      detectedAt: now,
    })
  }

  // 5. MEDIUM: Streak milestones (7, 14, 21, 30 days)
  const milestones = [7, 14, 21, 30, 60, 90]
  if (milestones.includes(context.streak)) {
    events.push({
      id: `event_streak_${context.streak}_${Date.now()}`,
      type: 'streak_milestone',
      priority: 'medium',
      title: `${context.streak} jours de suite !`,
      message: `Incroyable régularité ! Chaque jour compte pour atteindre ton objectif.`,
      category: 'progress',
      detectedAt: now,
    })
  }

  // 6. MEDIUM: Correlation detected (from agents)
  if (behaviorResult?.insights && behaviorResult.insights.length > 0) {
    const correlationInsight = behaviorResult.insights.find(i => i.type === 'correlation')
    if (correlationInsight) {
      events.push({
        id: `event_correlation_${Date.now()}`,
        type: 'daily_check',
        priority: 'medium',
        title: 'Pattern détecté',
        message: correlationInsight.message.slice(0, 100),
        category: 'progress',
        source: correlationInsight.sources[0],
        detectedAt: now,
      })
    }
  }

  // 7. LOW: Good progress celebration
  if (context.streak >= 7) {
    const avgCalories = context.weeklyNutrition.reduce((sum, n) => sum + n.calories, 0) / context.weeklyNutrition.length
    const target = context.profile.nutritionalNeeds?.calories || 2000
    const ratio = avgCalories / target

    if (ratio >= 0.85 && ratio <= 1.15) {
      events.push({
        id: `event_good_progress_${Date.now()}`,
        type: 'goal_reached',
        priority: 'low',
        title: 'Excellent équilibre !',
        message: `Ta moyenne calorique est parfaite cette semaine. Continue comme ça !`,
        category: 'progress',
        detectedAt: now,
      })
    }
  }

  // 8. LOW: Hydration reminder
  if (context.todayWellness?.waterLiters !== undefined && context.todayWellness.waterLiters < 1) {
    const hour = new Date().getHours()
    if (hour >= 14) {
      events.push({
        id: `event_hydration_${Date.now()}`,
        type: 'daily_check',
        priority: 'low',
        title: 'Hydratation',
        message: `Moins d'1L d'eau à ${hour}h. L'hydratation impacte énergie et concentration.`,
        category: 'wellness',
        detectedAt: now,
      })
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  return events.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
}

// ============= INSIGHT SELECTION =============

/**
 * Select the most important insight for daily notification
 * Prioritization:
 * 1. Critical alerts (health concerns)
 * 2. Celebrations (streaks, goals)
 * 3. Behavioral insights (patterns)
 * 4. General tips
 */
function selectDailyInsight(
  events: DetectedEvent[],
  behaviorResult?: BehaviorAnalysisResult,
  connectedInsights?: ConnectedInsight[]
): DailyInsight | null {
  // Priority 1: Critical/High events
  const criticalEvent = events.find(e => e.priority === 'critical' || e.priority === 'high')
  if (criticalEvent) {
    // Map 'alert' category to 'nutrition' for DailyInsight
    const category = criticalEvent.category === 'alert' ? 'nutrition' : criticalEvent.category
    return {
      title: criticalEvent.title.slice(0, 50),
      body: criticalEvent.message.slice(0, 150),
      category: category as DailyInsight['category'],
      severity: criticalEvent.priority === 'critical' ? 'warning' : 'info',
      source: criticalEvent.source,
      confidence: 0.9,
    }
  }

  // Priority 2: Streak celebrations
  const streakEvent = events.find(e => e.type === 'streak_milestone')
  if (streakEvent) {
    return {
      title: streakEvent.title.slice(0, 50),
      body: streakEvent.message.slice(0, 150),
      category: 'progress',
      severity: 'celebration',
      confidence: 0.95,
    }
  }

  // Priority 3: Behavioral insights from agent
  if (behaviorResult?.insights && behaviorResult.insights.length > 0) {
    const insight = behaviorResult.insights[0]
    return {
      title: insight.title.slice(0, 50),
      body: insight.message.slice(0, 150),
      category: 'nutrition',
      severity: 'info',
      source: insight.sources[0],
      confidence: behaviorResult.confidence,
    }
  }

  // Priority 4: Connected insights
  if (connectedInsights && connectedInsights.length > 0) {
    const insight = connectedInsights[0]
    return {
      title: insight.message.split('→')[0].trim().slice(0, 50),
      body: insight.message.slice(0, 150),
      category: insight.linkedFeatures[0] as DailyInsight['category'],
      severity: insight.icon === 'celebration' ? 'celebration' : 'info',
      confidence: 0.8,
    }
  }

  // Priority 5: Medium events
  const mediumEvent = events.find(e => e.priority === 'medium')
  if (mediumEvent) {
    // Map 'alert' category to 'nutrition' for DailyInsight
    const category = mediumEvent.category === 'alert' ? 'nutrition' : mediumEvent.category
    return {
      title: mediumEvent.title.slice(0, 50),
      body: mediumEvent.message.slice(0, 150),
      category: category as DailyInsight['category'],
      severity: 'info',
      source: mediumEvent.source,
      confidence: 0.7,
    }
  }

  // Priority 6: Fallback - Always provide a daily motivation insight
  const fallbackInsights = [
    {
      title: 'Conseil du jour',
      body: 'Chaque repas est une opportunité de nourrir ton corps. Prends le temps de tracker pour mieux comprendre tes habitudes.',
      category: 'nutrition' as const,
    },
    {
      title: 'Hydratation',
      body: 'As-tu bu assez d\'eau aujourd\'hui ? Une bonne hydratation améliore l\'énergie et la concentration.',
      category: 'wellness' as const,
    },
    {
      title: 'Écoute ton corps',
      body: 'Prends un moment pour noter comment tu te sens. Le suivi wellness aide à identifier ce qui te fait du bien.',
      category: 'wellness' as const,
    },
    {
      title: 'Protéines essentielles',
      body: 'Les protéines sont essentielles pour la récupération et la satiété. Vise à en inclure à chaque repas.',
      category: 'nutrition' as const,
    },
    {
      title: 'Petit défi du jour',
      body: 'Ajoute une portion de légumes supplémentaire à ton prochain repas. Les petits changements font les grandes transformations.',
      category: 'nutrition' as const,
    },
    {
      title: 'Sommeil réparateur',
      body: 'Un bon sommeil favorise la récupération et aide à maintenir un poids stable. Comment as-tu dormi ?',
      category: 'wellness' as const,
    },
    {
      title: 'Moment de gratitude',
      body: 'Prends un instant pour apprécier tes progrès, même les plus petits. Chaque pas compte.',
      category: 'progress' as const,
    },
  ]

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
  const fallback = fallbackInsights[dayOfYear % fallbackInsights.length]

  return {
    title: fallback.title,
    body: fallback.body,
    category: fallback.category,
    severity: 'info',
    confidence: 0.5,
  }
}

// ============= SUPER AGENT CLASS =============

class SuperAgentService {
  private lastAnalysis: SuperAgentAnalysis | null = null
  private isAnalyzing = false
  private lastAnalysisDate: string | null = null

  /**
   * Main entry point: Run complete Super Agent analysis
   */
  async analyze(context: SuperAgentContext): Promise<SuperAgentAnalysis> {
    if (this.isAnalyzing) {
      console.log('[SuperAgent] Analysis already in progress')
      return this.lastAnalysis || this.createEmptyAnalysis()
    }

    this.isAnalyzing = true
    const startTime = Date.now()
    console.log('[SuperAgent] Starting comprehensive analysis...')

    try {
      // ========== PHASE 1: Run all agents in parallel ==========
      const [behaviorResult, wellnessResult, coachingAdvices, connectedInsights] = await Promise.all([
        this.runBehaviorAgent(context),
        this.runWellnessAgent(context),
        this.runCoachingAgent(context),
        this.runConnectedInsights(context),
      ])

      // ========== PHASE 2: Detect events ==========
      const detectedEvents = detectEvents(context, behaviorResult, wellnessResult)
      console.log(`[SuperAgent] Detected ${detectedEvents.length} events`)

      // ========== PHASE 3: Select daily insight ==========
      const dailyInsight = selectDailyInsight(detectedEvents, behaviorResult, connectedInsights)

      // ========== PHASE 4: Decide and send notification ==========
      let notificationSent = false
      if (dailyInsight) {
        notificationSent = await this.sendDailyNotification(dailyInsight)
      }

      // ========== Build result ==========
      const ragSources = new Set<string>()
      behaviorResult?.ragSourcesUsed.forEach(s => ragSources.add(s))
      wellnessResult?.ragSourcesUsed.forEach(s => ragSources.add(s))
      coachingAdvices.forEach(a => a.sources.forEach((s: { source: string }) => ragSources.add(s.source)))

      const analysis: SuperAgentAnalysis = {
        behaviorResult,
        wellnessResult,
        coachingAdvices,
        connectedInsights,
        detectedEvents,
        dailyInsight: dailyInsight || undefined,
        analyzedAt: new Date().toISOString(),
        ragSourcesUsed: Array.from(ragSources),
        notificationSent,
        confidence: this.calculateConfidence(behaviorResult, wellnessResult, connectedInsights),
      }

      this.lastAnalysis = analysis
      this.lastAnalysisDate = new Date().toDateString()

      const duration = Date.now() - startTime
      console.log(`[SuperAgent] Analysis complete in ${duration}ms`)

      return analysis

    } catch (error) {
      console.error('[SuperAgent] Analysis error:', error)
      return this.createEmptyAnalysis()
    } finally {
      this.isAnalyzing = false
    }
  }

  /**
   * Quick check for dashboard (lightweight)
   */
  async quickCheck(context: SuperAgentContext): Promise<{
    status: 'great' | 'good' | 'attention' | 'alert'
    message: string
    category?: string
  }> {
    try {
      // Quick health check from behavior agent
      const healthCheck = await getQuickHealthCheck(
        context.todayNutrition,
        context.todayWellness || {},
        context.profile
      )

      const statusMap: Record<string, 'great' | 'good' | 'attention' | 'alert'> = {
        good: 'great',
        attention: 'attention',
        warning: 'alert',
      }

      return {
        status: statusMap[healthCheck.status] || 'good',
        message: healthCheck.message,
        category: 'health',
      }
    } catch (error) {
      console.error('[SuperAgent] Quick check error:', error)
      return {
        status: 'good',
        message: 'Continue comme ça !',
      }
    }
  }

  /**
   * Generate daily insight for scheduled notification
   */
  async generateDailyInsight(context: SuperAgentContext): Promise<DailyInsight | null> {
    // If we already analyzed today, use cached insight
    if (this.lastAnalysisDate === new Date().toDateString() && this.lastAnalysis?.dailyInsight) {
      return this.lastAnalysis.dailyInsight
    }

    // Run full analysis
    const analysis = await this.analyze(context)
    return analysis.dailyInsight || null
  }

  /**
   * Get last analysis result
   */
  getLastAnalysis(): SuperAgentAnalysis | null {
    return this.lastAnalysis
  }

  /**
   * Check if should run daily analysis
   */
  shouldRunDailyAnalysis(): boolean {
    return this.lastAnalysisDate !== new Date().toDateString()
  }

  // ========== PRIVATE METHODS ==========

  private async runBehaviorAgent(context: SuperAgentContext): Promise<BehaviorAnalysisResult | undefined> {
    try {
      if (context.meals.length === 0 && context.wellnessEntries.length === 0) {
        return undefined
      }

      const behaviorData: UserBehaviorData = {
        meals: context.meals,
        dailyNutrition: context.weeklyNutrition.map((n, i) => ({
          date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          calories: n.calories,
          proteins: n.proteins,
          carbs: n.carbs,
          fats: n.fats,
        })),
        wellnessEntries: context.wellnessEntries,
        sportSessions: context.sportSessions || [],
        daysTracked: context.daysTracked,
        streakDays: context.streak,
      }

      return await analyzeBehavior(behaviorData, context.profile)
    } catch (error) {
      console.error('[SuperAgent] BehaviorAgent error:', error)
      return undefined
    }
  }

  private async runWellnessAgent(context: SuperAgentContext): Promise<WellnessAnalysisResult | undefined> {
    try {
      if (context.wellnessEntries.length === 0) {
        return undefined
      }

      const moodMap: Record<number, 'great' | 'good' | 'neutral' | 'low' | 'bad'> = {
        1: 'bad',
        2: 'low',
        3: 'neutral',
        4: 'good',
        5: 'great',
      }

      const wellnessData: WellnessUserData = {
        profile: context.profile,
        currentPhase: 'foundations',
        currentWeek: 1,
        recentLogs: context.wellnessEntries.slice(0, 7).map(entry => ({
          date: entry.date,
          sleepHours: entry.sleepHours || 0,
          sleepQuality: entry.sleepQuality || 3,
          stressLevel: entry.stressLevel || 3,
          mood: moodMap[entry.mood || 3] || 'neutral',
          energyLevel: entry.energyLevel || 3,
          moodLevel: entry.mood || 3,
          meditationMinutes: 0,
          breathingExercises: 0,
          gratitudeNotes: entry.notes ? [entry.notes] : [],
        })),
        weekSummary: undefined,
        totalMeditationMinutes: 0,
        currentStreak: context.streak,
      }

      return await analyzeWellness(wellnessData)
    } catch (error) {
      console.error('[SuperAgent] WellnessAgent error:', error)
      return undefined
    }
  }

  private async runCoachingAgent(context: SuperAgentContext): Promise<CoachingAdvice[]> {
    try {
      const userContext: UserContext = {
        profile: context.profile,
        todayNutrition: context.todayNutrition,
        weeklyAverage: this.calculateWeeklyAverage(context.weeklyNutrition),
        currentStreak: context.streak,
        lastMeals: context.meals.slice(0, 5).map(m =>
          m.items?.map(i => i.food?.name).join(', ') || 'Repas'
        ),
        wellnessData: {
          sleepHours: context.todayWellness?.sleepHours,
          stressLevel: context.todayWellness?.stressLevel,
          energyLevel: context.todayWellness?.energyLevel,
          hydrationLiters: context.todayWellness?.waterLiters,
        },
      }

      return await getCoachingAdvice(userContext)
    } catch (error) {
      console.error('[SuperAgent] CoachingAgent error:', error)
      return []
    }
  }

  private async runConnectedInsights(context: SuperAgentContext): Promise<ConnectedInsight[]> {
    try {
      const userContext: UserContext = {
        profile: context.profile,
        todayNutrition: context.todayNutrition,
        weeklyAverage: this.calculateWeeklyAverage(context.weeklyNutrition),
        currentStreak: context.streak,
        lastMeals: context.meals.slice(0, 5).map(m =>
          m.items?.map(i => i.food?.name).join(', ') || 'Repas'
        ),
        wellnessData: {
          sleepHours: context.todayWellness?.sleepHours,
          stressLevel: context.todayWellness?.stressLevel,
          energyLevel: context.todayWellness?.energyLevel,
          hydrationLiters: context.todayWellness?.waterLiters,
        },
      }

      return await generateConnectedInsights(userContext)
    } catch (error) {
      console.error('[SuperAgent] ConnectedInsights error:', error)
      return []
    }
  }

  private async sendDailyNotification(insight: DailyInsight): Promise<boolean> {
    try {
      const canSend = await canSendNotification(insight.title)
      if (!canSend) {
        console.log('[SuperAgent] Notification blocked by anti-spam')
        return false
      }

      const notificationData: NotificationData = {
        title: insight.title,
        body: insight.body,
        category: insight.category,
        severity: insight.severity,
        deepLink: insight.deepLink,
        source: insight.source,
      }

      return await sendNotification(notificationData)
    } catch (error) {
      console.error('[SuperAgent] Notification error:', error)
      return false
    }
  }

  private calculateWeeklyAverage(weeklyNutrition: NutritionInfo[]): NutritionInfo {
    if (weeklyNutrition.length === 0) {
      return { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    }

    const sum = weeklyNutrition.reduce(
      (acc, n) => ({
        calories: acc.calories + n.calories,
        proteins: acc.proteins + n.proteins,
        carbs: acc.carbs + n.carbs,
        fats: acc.fats + n.fats,
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    )

    const count = weeklyNutrition.length
    return {
      calories: Math.round(sum.calories / count),
      proteins: Math.round(sum.proteins / count),
      carbs: Math.round(sum.carbs / count),
      fats: Math.round(sum.fats / count),
    }
  }

  private calculateConfidence(
    behaviorResult?: BehaviorAnalysisResult,
    wellnessResult?: WellnessAnalysisResult,
    connectedInsights?: ConnectedInsight[]
  ): number {
    let total = 0
    let count = 0

    if (behaviorResult) {
      total += behaviorResult.confidence
      count++
    }
    if (wellnessResult) {
      total += wellnessResult.confidence
      count++
    }
    if (connectedInsights && connectedInsights.length > 0) {
      total += 0.8
      count++
    }

    return count > 0 ? total / count : 0.5
  }

  private createEmptyAnalysis(): SuperAgentAnalysis {
    return {
      coachingAdvices: [],
      connectedInsights: [],
      detectedEvents: [],
      analyzedAt: new Date().toISOString(),
      ragSourcesUsed: [],
      notificationSent: false,
      confidence: 0,
    }
  }
}

// ============= SINGLETON EXPORT =============

export const SuperAgent = new SuperAgentService()

// ============= CONVENIENCE FUNCTIONS =============

/**
 * Run Super Agent analysis
 */
export async function runSuperAgentAnalysis(
  context: SuperAgentContext
): Promise<SuperAgentAnalysis> {
  return SuperAgent.analyze(context)
}

/**
 * Quick status check for dashboard
 */
export async function getSuperAgentQuickCheck(
  context: SuperAgentContext
): Promise<{ status: 'great' | 'good' | 'attention' | 'alert'; message: string }> {
  return SuperAgent.quickCheck(context)
}

/**
 * Generate daily insight for notification
 */
export async function generateDailyInsight(
  context: SuperAgentContext
): Promise<DailyInsight | null> {
  return SuperAgent.generateDailyInsight(context)
}

/**
 * Check if should run daily analysis
 */
export function shouldRunDailyAnalysis(): boolean {
  return SuperAgent.shouldRunDailyAnalysis()
}

/**
 * Get last Super Agent analysis
 */
export function getLastSuperAgentAnalysis(): SuperAgentAnalysis | null {
  return SuperAgent.getLastAnalysis()
}

export default SuperAgent
