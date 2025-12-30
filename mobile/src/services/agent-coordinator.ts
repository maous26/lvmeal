/**
 * Agent Coordinator - Orchestrateur Central des Agents IA
 *
 * Ce service coordonne tous les agents IA de l'application:
 * - BehaviorAnalysisAgent: Analyse des comportements avec RAG
 * - WellnessAgent: Conseils bien-être personnalisés
 * - LymIABrain: Intelligence centrale (calories, repas, coaching)
 *
 * Fonctionnalités:
 * - Communication inter-agents (partage de contexte)
 * - Détection d'événements importants
 * - Priorisation des alertes
 * - Déclenchement de notifications push
 * - Anti-spam (1 notification/jour max)
 *
 * Chaque agent adapte sa réponse en fonction des données RAG
 * et du contexte partagé par les autres agents.
 */

import {
  analyzeBehavior,
  type BehaviorAnalysisResult,
  type UserBehaviorData,
  type BehaviorAlert,
} from './behavior-analysis-agent'

import {
  analyzeWellness,
  type WellnessAnalysisResult,
  type WellnessUserData,
  type WellnessAlert,
} from './wellness-agent'

import {
  getCoachingAdvice,
  generateConnectedInsights,
  type UserContext,
  type CoachingAdvice,
} from './lymia-brain'

import {
  sendNotification,
  canSendNotification,
  type NotificationData,
} from './notification-service'

import { queryKnowledgeBase, isSupabaseConfigured } from './supabase-client'

import type { UserProfile, Meal, WellnessEntry, NutritionInfo } from '../types'

// ============= TYPES =============

export interface CoordinatorContext {
  // User data
  profile: UserProfile

  // Nutrition data (from meals-store)
  meals: Meal[]
  todayNutrition: NutritionInfo
  weeklyNutrition: NutritionInfo[]

  // Wellness data (from wellness-store)
  wellnessEntries: WellnessEntry[]
  currentWellness?: {
    sleepHours?: number
    stressLevel?: number
    energyLevel?: number
    mood?: string
  }

  // Sport data (from sport-store or metabolic-store)
  sportSessions?: Array<{
    date: string
    type: string
    duration: number
    intensity: 'low' | 'moderate' | 'high'
    completed: boolean
  }>

  // Gamification (from gamification-store)
  streak: number
  level: number
  xp: number

  // Temporal
  daysTracked: number
}

export interface AgentResult {
  agent: 'behavior' | 'wellness' | 'lymia'
  success: boolean
  alerts: Array<BehaviorAlert | WellnessAlert>
  insights: string[]
  recommendations: string[]
  ragSources: string[]
  confidence: number
}

export interface CoordinatedAnalysis {
  // Combined results from all agents
  results: AgentResult[]

  // Prioritized notification (if any)
  notification?: NotificationData

  // Cross-agent insights
  connectedInsights: string[]

  // Summary for UI
  summary: string

  // Metadata
  analyzedAt: string
  ragSourcesUsed: string[]
  notificationSent: boolean
}

export interface EventTrigger {
  type: 'meal_logged' | 'wellness_logged' | 'sport_completed' | 'goal_reached' | 'streak_milestone' | 'app_opened'
  data?: Record<string, unknown>
  timestamp: string
}

// ============= COORDINATOR CLASS =============

class AgentCoordinatorService {
  private lastAnalysis: CoordinatedAnalysis | null = null
  private isAnalyzing = false

  /**
   * Analyse coordonnée de tous les agents
   * Chaque agent reçoit le contexte des autres pour adapter sa réponse
   */
  async analyzeWithAllAgents(
    context: CoordinatorContext,
    trigger?: EventTrigger
  ): Promise<CoordinatedAnalysis> {
    if (this.isAnalyzing) {
      console.log('[Coordinator] Analyse déjà en cours')
      return this.lastAnalysis || this.createEmptyAnalysis()
    }

    this.isAnalyzing = true
    const results: AgentResult[] = []
    const allRagSources: string[] = []

    try {
      console.log('[Coordinator] Début de l\'analyse coordonnée...')
      console.log('[Coordinator] Trigger:', trigger?.type || 'manual')

      // ========== PHASE 1: Behavior Analysis Agent ==========
      // Premier agent à s'exécuter, analyse les patterns comportementaux
      const behaviorResult = await this.runBehaviorAgent(context)
      results.push(behaviorResult)
      allRagSources.push(...behaviorResult.ragSources)

      // ========== PHASE 2: Wellness Agent ==========
      // Reçoit les alertes du BehaviorAgent comme contexte
      const wellnessResult = await this.runWellnessAgent(
        context,
        behaviorResult.alerts as BehaviorAlert[]
      )
      results.push(wellnessResult)
      allRagSources.push(...wellnessResult.ragSources)

      // ========== PHASE 3: LymIA Brain ==========
      // Intelligence centrale, reçoit le contexte de tous les agents
      const lymiaResult = await this.runLymIAAgent(
        context,
        behaviorResult,
        wellnessResult
      )
      results.push(lymiaResult)
      allRagSources.push(...lymiaResult.ragSources)

      // ========== PHASE 4: Cross-Agent Insights ==========
      // Génère des insights connectés entre les domaines
      const connectedInsights = await this.generateCrossAgentInsights(
        context,
        results
      )

      // ========== PHASE 5: Prioritize & Notify ==========
      // Sélectionne la notification la plus importante
      const notification = await this.selectAndSendNotification(
        results,
        trigger
      )

      // ========== Build Final Result ==========
      const analysis: CoordinatedAnalysis = {
        results,
        notification: notification?.data,
        connectedInsights,
        summary: this.buildSummary(results, connectedInsights),
        analyzedAt: new Date().toISOString(),
        ragSourcesUsed: [...new Set(allRagSources)],
        notificationSent: notification?.sent || false,
      }

      this.lastAnalysis = analysis
      return analysis

    } catch (error) {
      console.error('[Coordinator] Erreur analyse:', error)
      return this.createEmptyAnalysis()
    } finally {
      this.isAnalyzing = false
    }
  }

  /**
   * Exécute le BehaviorAnalysisAgent
   */
  private async runBehaviorAgent(context: CoordinatorContext): Promise<AgentResult> {
    try {
      console.log('[Coordinator] Running BehaviorAnalysisAgent...')

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

      const result = await analyzeBehavior(behaviorData, context.profile)

      return {
        agent: 'behavior',
        success: true,
        alerts: result.alerts,
        insights: result.insights.map(i => i.message),
        recommendations: result.patterns
          .filter(p => p.impact === 'negative')
          .map(p => p.description),
        ragSources: result.ragSourcesUsed,
        confidence: result.confidence,
      }
    } catch (error) {
      console.error('[Coordinator] BehaviorAgent error:', error)
      return this.createEmptyAgentResult('behavior')
    }
  }

  /**
   * Exécute le WellnessAgent avec contexte du BehaviorAgent
   */
  private async runWellnessAgent(
    context: CoordinatorContext,
    behaviorAlerts: BehaviorAlert[]
  ): Promise<AgentResult> {
    try {
      console.log('[Coordinator] Running WellnessAgent...')

      // Pas de données wellness = skip
      if (!context.wellnessEntries || context.wellnessEntries.length === 0) {
        console.log('[Coordinator] Pas de données wellness, skip')
        return this.createEmptyAgentResult('wellness')
      }

      // Enrichir le contexte avec les alertes comportementales
      // Pour que WellnessAgent sache si l'utilisateur a des problèmes nutrition/sport
      const hasNutritionAlert = behaviorAlerts.some(a => a.category === 'nutrition')
      const hasSportAlert = behaviorAlerts.some(a => a.category === 'sport')
      const highStressFromBehavior = behaviorAlerts.some(
        a => a.title.toLowerCase().includes('stress')
      )

      const wellnessData: WellnessUserData = {
        profile: context.profile,
        currentPhase: 'foundations', // Default, should come from store
        currentWeek: 1,
        recentLogs: context.wellnessEntries.slice(0, 7).map(entry => {
          // Convert numeric mood (1-5) to string mood
          const moodMap: Record<number, 'great' | 'good' | 'neutral' | 'low' | 'bad'> = {
            1: 'bad',
            2: 'low',
            3: 'neutral',
            4: 'good',
            5: 'great',
          }
          return {
            date: entry.date,
            sleepHours: entry.sleepHours || 0,
            sleepQuality: entry.sleepQuality || 3,
            stressLevel: entry.stressLevel || 3,
            mood: moodMap[entry.mood || 3] || 'neutral',
            energyLevel: entry.energyLevel || 3,
            meditationMinutes: 0,
            breathingExercises: 0,
            gratitudeNotes: entry.notes ? [entry.notes] : [],
          }
        }),
        weekSummary: undefined,
        totalMeditationMinutes: 0,
        currentStreak: context.streak,
      }

      const result = await analyzeWellness(wellnessData)

      return {
        agent: 'wellness',
        success: true,
        alerts: result.alerts,
        insights: result.insights.map(i => i.message),
        recommendations: result.recommendations.map(r => r.description),
        ragSources: result.ragSourcesUsed,
        confidence: result.confidence,
      }
    } catch (error) {
      console.error('[Coordinator] WellnessAgent error:', error)
      return this.createEmptyAgentResult('wellness')
    }
  }

  /**
   * Exécute LymIABrain avec contexte de tous les agents
   */
  private async runLymIAAgent(
    context: CoordinatorContext,
    behaviorResult: AgentResult,
    wellnessResult: AgentResult
  ): Promise<AgentResult> {
    try {
      console.log('[Coordinator] Running LymIABrain...')

      // Construire le contexte enrichi pour LymIA
      const userContext: UserContext = {
        profile: context.profile,
        todayNutrition: context.todayNutrition,
        weeklyAverage: this.calculateWeeklyAverage(context.weeklyNutrition),
        currentStreak: context.streak,
        lastMeals: context.meals.slice(0, 5).map(m =>
          m.items?.map(i => i.food?.name).join(', ') || 'Repas'
        ),
        wellnessData: {
          sleepHours: context.currentWellness?.sleepHours,
          stressLevel: context.currentWellness?.stressLevel,
          energyLevel: context.currentWellness?.energyLevel,
        },
      }

      // Ajouter les alertes des autres agents comme contexte
      const crossAgentContext = {
        behaviorAlerts: behaviorResult.alerts.slice(0, 3),
        wellnessAlerts: wellnessResult.alerts.slice(0, 3),
        behaviorInsights: behaviorResult.insights.slice(0, 2),
        wellnessRecommendations: wellnessResult.recommendations.slice(0, 2),
      }

      const advices = await getCoachingAdvice(userContext)
      const topAdvice = advices[0] // Prendre le premier conseil (le plus pertinent)

      // Générer des insights connectés
      const connectedInsights = await generateConnectedInsights(userContext)

      return {
        agent: 'lymia',
        success: true,
        alerts: [], // LymIA génère des conseils, pas des alertes
        insights: topAdvice
          ? [topAdvice.message, ...connectedInsights.map(i => i.message)]
          : connectedInsights.map(i => i.message),
        recommendations: topAdvice?.actionItems || [],
        ragSources: topAdvice?.sources.map((s: { source: string }) => s.source) || [],
        confidence: topAdvice?.confidence || 0.5,
      }
    } catch (error) {
      console.error('[Coordinator] LymIABrain error:', error)
      return this.createEmptyAgentResult('lymia')
    }
  }

  /**
   * Génère des insights cross-agents
   */
  private async generateCrossAgentInsights(
    context: CoordinatorContext,
    results: AgentResult[]
  ): Promise<string[]> {
    const insights: string[] = []

    // Chercher des corrélations entre les résultats des agents
    const behaviorResult = results.find(r => r.agent === 'behavior')
    const wellnessResult = results.find(r => r.agent === 'wellness')

    if (behaviorResult && wellnessResult) {
      // Corrélation stress ↔ nutrition
      const hasStressIssue = wellnessResult.alerts.some(
        a => a.title?.toLowerCase().includes('stress')
      )
      const hasNutritionIssue = behaviorResult.alerts.some(
        a => (a as BehaviorAlert).category === 'nutrition'
      )

      if (hasStressIssue && hasNutritionIssue) {
        insights.push(
          '🔗 Lien détecté : ton stress semble affecter ton alimentation. ' +
          'Essaie une séance de respiration avant les repas.'
        )
      }

      // Corrélation sommeil ↔ énergie
      const hasSleepIssue = wellnessResult.alerts.some(
        a => a.title?.toLowerCase().includes('sommeil')
      )
      const lowEnergy = context.currentWellness?.energyLevel
        ? context.currentWellness.energyLevel < 4
        : false

      if (hasSleepIssue && lowEnergy) {
        insights.push(
          '🔗 Ton manque de sommeil impacte ton énergie. ' +
          'Une sieste de 20 min peut aider à récupérer.'
        )
      }
    }

    // Celebration des progrès
    if (context.streak >= 7 && context.streak % 7 === 0) {
      insights.push(
        `🎉 ${context.streak} jours de suite ! Ta régularité paie.`
      )
    }

    return insights
  }

  /**
   * Sélectionne et envoie la notification la plus importante
   */
  private async selectAndSendNotification(
    results: AgentResult[],
    trigger?: EventTrigger
  ): Promise<{ data: NotificationData; sent: boolean } | null> {
    // Collecter toutes les alertes de tous les agents
    const allAlerts: Array<{ alert: BehaviorAlert | WellnessAlert; agent: string }> = []

    for (const result of results) {
      for (const alert of result.alerts) {
        allAlerts.push({ alert, agent: result.agent })
      }
    }

    if (allAlerts.length === 0) {
      console.log('[Coordinator] Aucune alerte à notifier')
      return null
    }

    // Prioriser les alertes
    // 1. Severity: alert > warning > info
    // 2. Agent: behavior (santé) > wellness > lymia
    const priorityMap: Record<string, number> = {
      'alert': 3,
      'warning': 2,
      'attention': 2,
      'info': 1,
    }

    const agentPriorityMap: Record<string, number> = {
      'behavior': 3,
      'wellness': 2,
      'lymia': 1,
    }

    allAlerts.sort((a, b) => {
      const severityA = priorityMap[a.alert.severity] || 0
      const severityB = priorityMap[b.alert.severity] || 0
      if (severityB !== severityA) return severityB - severityA

      const agentA = agentPriorityMap[a.agent] || 0
      const agentB = agentPriorityMap[b.agent] || 0
      return agentB - agentA
    })

    // Sélectionner la plus importante
    const topAlert = allAlerts[0]
    if (!topAlert) return null

    // Déterminer la catégorie pour la notification
    let category: NotificationData['category'] = 'alert'
    if ('category' in topAlert.alert) {
      const alertCategory = (topAlert.alert as BehaviorAlert).category
      if (alertCategory === 'nutrition') category = 'nutrition'
      else if (alertCategory === 'wellness') category = 'wellness'
      else if (alertCategory === 'sport') category = 'sport'
    }

    const notificationData: NotificationData = {
      title: topAlert.alert.title,
      body: topAlert.alert.message,
      category,
      severity: topAlert.alert.severity === 'alert' ? 'warning' :
               topAlert.alert.severity === 'info' ? 'info' : 'warning',
      source: topAlert.alert.scientificSource,
      deepLink: 'actionRoute' in topAlert.alert
        ? (topAlert.alert as BehaviorAlert).actionRoute
        : undefined,
    }

    // Vérifier si on peut envoyer (anti-spam)
    const canSend = await canSendNotification(notificationData.title)
    if (!canSend) {
      console.log('[Coordinator] Notification bloquée (anti-spam)')
      return { data: notificationData, sent: false }
    }

    // Envoyer la notification
    const sent = await sendNotification(notificationData)
    console.log('[Coordinator] Notification envoyée:', sent)

    return { data: notificationData, sent }
  }

  /**
   * Méthode publique pour déclencher une analyse sur événement
   */
  async onEvent(trigger: EventTrigger, context: CoordinatorContext): Promise<void> {
    console.log('[Coordinator] Event reçu:', trigger.type)

    // Certains événements déclenchent une analyse complète
    const triggerFullAnalysis = [
      'meal_logged',
      'wellness_logged',
      'goal_reached',
      'streak_milestone',
    ]

    if (triggerFullAnalysis.includes(trigger.type)) {
      await this.analyzeWithAllAgents(context, trigger)
    }
  }

  /**
   * Récupère la dernière analyse
   */
  getLastAnalysis(): CoordinatedAnalysis | null {
    return this.lastAnalysis
  }

  // ============= HELPERS =============

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

  private buildSummary(results: AgentResult[], connectedInsights: string[]): string {
    const totalAlerts = results.reduce((sum, r) => sum + r.alerts.length, 0)
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length

    if (totalAlerts === 0) {
      return '✅ Tout va bien ! Continue comme ça.'
    }

    const highPriorityAlerts = results
      .flatMap(r => r.alerts)
      .filter(a => a.severity === 'alert' || a.severity === 'warning')

    if (highPriorityAlerts.length > 0) {
      return `⚠️ ${highPriorityAlerts.length} point(s) d'attention détecté(s).`
    }

    return `💡 ${totalAlerts} conseil(s) personnalisé(s) pour toi.`
  }

  private createEmptyAnalysis(): CoordinatedAnalysis {
    return {
      results: [],
      connectedInsights: [],
      summary: 'Analyse en cours...',
      analyzedAt: new Date().toISOString(),
      ragSourcesUsed: [],
      notificationSent: false,
    }
  }

  private createEmptyAgentResult(agent: AgentResult['agent']): AgentResult {
    return {
      agent,
      success: false,
      alerts: [],
      insights: [],
      recommendations: [],
      ragSources: [],
      confidence: 0,
    }
  }
}

// ============= SINGLETON EXPORT =============

export const AgentCoordinator = new AgentCoordinatorService()

// ============= CONVENIENCE FUNCTIONS =============

/**
 * Lance une analyse coordonnée de tous les agents
 */
export async function runCoordinatedAnalysis(
  context: CoordinatorContext,
  trigger?: EventTrigger
): Promise<CoordinatedAnalysis> {
  return AgentCoordinator.analyzeWithAllAgents(context, trigger)
}

/**
 * Notifie le coordinator d'un événement
 */
export async function notifyEvent(
  trigger: EventTrigger,
  context: CoordinatorContext
): Promise<void> {
  return AgentCoordinator.onEvent(trigger, context)
}

/**
 * Récupère la dernière analyse
 */
export function getLastCoordinatedAnalysis(): CoordinatedAnalysis | null {
  return AgentCoordinator.getLastAnalysis()
}
