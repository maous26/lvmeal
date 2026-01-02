/**
 * Coach Store - Conseils, Analyses et Alertes proactifs LymIA
 *
 * Génère du contenu personnalisé basé sur:
 * - Profil utilisateur
 * - Habitudes alimentaires
 * - Données wellness (sommeil, stress, hydratation)
 * - Objectifs et progression
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LymIABrain, type UserContext, type CoachingAdvice } from '../services/lymia-brain'
import { getPhaseContext, PhaseMessages, type PhaseContext } from '../services/phase-context'
import {
  BehaviorAnalysisAgent,
  type BehaviorAlert,
  type BehaviorInsight,
  type BehaviorPattern,
  type UserBehaviorData,
} from '../services/behavior-analysis-agent'
import {
  runCoordinatedAnalysis,
  type CoordinatorContext,
  type CoordinatedAnalysis,
  type EventTrigger,
} from '../services/agent-coordinator'
import type { UserProfile, Meal, WellnessEntry, NutritionInfo } from '../types'
import type { MetabolicPhase } from './metabolic-boost-store'

export type CoachItemType = 'tip' | 'analysis' | 'alert' | 'celebration'

export type CoachItemCategory =
  | 'nutrition'
  | 'metabolism'
  | 'wellness'
  | 'sport'
  | 'hydration'
  | 'sleep'
  | 'stress'
  | 'progress'
  | 'cooking'

export type CoachItemPriority = 'low' | 'medium' | 'high'

export interface CoachItem {
  id: string
  type: CoachItemType
  category: CoachItemCategory
  title: string
  message: string
  priority: CoachItemPriority
  source?: string // ANSES, INSERM, etc.
  sourceUrl?: string // URL vers la source scientifique
  data?: Record<string, unknown> // Données associées (graphiques, stats)
  actionLabel?: string
  actionRoute?: string // Navigation route
  isRead: boolean
  createdAt: string
  expiresAt?: string
  // NEW: Gap-filling fields for better UX
  reasoning?: string // WHY this recommendation (scientific basis)
  confidence?: number // 0-1 confidence score
  linkedFeatures?: string[] // Features linked (sleep, nutrition, sport...)
  dataPoints?: Array<{ label: string; value: string | number; trend?: 'up' | 'down' | 'stable' }>
  scientificBasis?: string // Short scientific explanation
}

export interface CoachContext {
  // From user profile
  firstName?: string
  goal?: string
  dietType?: string
  allergies?: string[]
  weight?: number
  // Cooking preferences
  cookingLevel?: 'beginner' | 'intermediate' | 'advanced'
  weekdayTime?: number // minutes available per meal on weekdays
  weekendTime?: number // minutes available per meal on weekends
  batchCooking?: boolean
  quickMealsOnly?: boolean
  // From today's data
  caloriesConsumed?: number
  caloriesTarget?: number
  proteinConsumed?: number
  proteinTarget?: number
  carbsConsumed?: number
  fatsConsumed?: number
  // Hydration
  waterConsumed?: number
  waterTarget?: number
  // From wellness
  sleepHours?: number
  sleepQuality?: number
  stressLevel?: number
  energyLevel?: number
  // From activity
  streak?: number
  level?: number
  xp?: number
  lastWorkout?: string
  // Historical
  weeklyCaloriesAvg?: number
  weeklyProteinAvg?: number
  weightTrend?: 'up' | 'down' | 'stable'
  // Time context
  currentHour?: number
  dayOfWeek?: number
  // MetabolicBoost program context
  metabolicBoostEnrolled?: boolean
  metabolicBoostPhase?: MetabolicPhase
  metabolicBoostWeek?: number
  // Behavior analysis data (for RAG)
  recentMeals?: Meal[]
  wellnessEntries?: WellnessEntry[]
  sportSessions?: Array<{
    date: string
    type: string
    duration: number
    intensity: 'low' | 'moderate' | 'high'
    completed: boolean
  }>
  daysTracked?: number
}

interface CoachState {
  items: CoachItem[]
  historyItems: CoachItem[] // Archive of dismissed items
  unreadCount: number
  lastGeneratedAt: string | null
  context: CoachContext
  isGeneratingAI: boolean
  lastCoordinatedAnalysis: CoordinatedAnalysis | null

  // Actions
  setContext: (context: Partial<CoachContext>) => void
  generateItems: () => void
  generateItemsWithAI: () => Promise<void> // NEW: LymIA Brain powered
  generateWithCoordinator: (trigger?: EventTrigger) => Promise<void> // NEW: Agent Coordinator powered
  forceRefreshAI: () => Promise<void> // Force regeneration bypassing cache
  markAsRead: (itemId: string) => void
  markAllAsRead: () => void
  dismissItem: (itemId: string) => void
  clearExpired: () => void
  getUnreadCount: () => number
  getCacheStatus: () => { isFresh: boolean; ageMinutes: number; itemCount: number }
  getHistoryItems: () => CoachItem[] // Get archived items
  clearHistory: () => void // Clear history
}

const generateId = () => `coach_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

/**
 * Génère les items (conseils, analyses, alertes) basés sur le contexte
 * Adapts messaging based on MetabolicBoost phase when enrolled
 */
function generateItemsFromContext(context: CoachContext): CoachItem[] {
  const items: CoachItem[] = []
  const now = new Date()
  const hour = context.currentHour ?? now.getHours()
  const firstName = context.firstName || ''

  // Get phase context if user is in MetabolicBoost program
  const phaseContext: PhaseContext | null = context.metabolicBoostEnrolled && context.metabolicBoostPhase
    ? getPhaseContext(context.metabolicBoostPhase, context.metabolicBoostWeek || 1)
    : null

  // Helper to check if we should show calorie-related alerts
  const isNoRestrictionPhase = phaseContext?.isNoRestrictionPhase ?? false

  // ========== ALERTES (priorité haute) ==========

  // Déficit calorique dangereux - ADAPT TO PHASE
  if (context.caloriesConsumed && context.caloriesTarget) {
    const ratio = context.caloriesConsumed / context.caloriesTarget

    // Phase 1: Different messaging - no deficit alerts, encourage eating
    if (isNoRestrictionPhase) {
      if (ratio < 0.5 && hour >= 14) {
        items.push({
          id: generateId(),
          type: 'tip',
          category: 'nutrition',
          title: 'Alimentation',
          message: `En phase Découverte, mange à ta faim. Écoute ton corps, c'est important pour stabiliser ton métabolisme.`,
          priority: 'medium',
          source: 'expert',
          data: { consumed: context.caloriesConsumed, target: context.caloriesTarget, ratio },
          isRead: false,
          createdAt: now.toISOString(),
        })
      } else if (ratio > 1.3) {
        // No alert for surplus in Phase 1 - this is expected behavior
        items.push({
          id: generateId(),
          type: 'tip',
          category: 'nutrition',
          title: 'Alimentation',
          message: `Tu as bien mangé. En phase Découverte, c'est normal. Ton corps réapprend la satiété naturelle.`,
          priority: 'low',
          source: 'expert',
          isRead: false,
          createdAt: now.toISOString(),
        })
      }
    } else {
      // Standard messaging for other phases
      if (ratio < 0.25 && hour >= 16) {
        items.push({
          id: generateId(),
          type: 'alert',
          category: 'nutrition',
          title: 'Calories',
          message: `${context.caloriesConsumed} kcal aujourd'hui (${Math.round(ratio * 100)}%). Un déficit trop important peut ralentir ton métabolisme. Prends soin de toi ce soir.`,
          priority: 'high',
          source: 'expert',
          data: { consumed: context.caloriesConsumed, target: context.caloriesTarget, ratio },
          isRead: false,
          createdAt: now.toISOString(),
        })
      } else if (ratio > 1.3) {
        items.push({
          id: generateId(),
          type: 'alert',
          category: 'nutrition',
          title: 'Calories',
          message: `Journée plus généreuse (+${Math.round((ratio - 1) * 100)}%). C'est OK ! Sur 7 jours, un écart ne change rien. On continue ensemble.`,
          priority: 'medium',
          source: 'expert',
          isRead: false,
          createdAt: now.toISOString(),
        })
      }
    }
  }

  // Manque de sommeil
  if (context.sleepHours !== undefined && context.sleepHours < 6) {
    items.push({
      id: generateId(),
      type: 'alert',
      category: 'sleep',
      title: 'Sommeil',
      message: `${context.sleepHours}h cette nuit. Le manque de sommeil augmente la faim de 15%. Sois indulgent avec toi-même aujourd'hui.`,
      priority: 'high',
      source: 'inserm',
      data: { sleepHours: context.sleepHours },
      isRead: false,
      createdAt: now.toISOString(),
    })
  }

  // Stress élevé
  if (context.stressLevel !== undefined && context.stressLevel >= 8) {
    items.push({
      id: generateId(),
      type: 'alert',
      category: 'stress',
      title: 'Stress',
      message: `Stress à ${context.stressLevel}/10. Le cortisol peut favoriser le stockage et les envies de sucre. Accorde-toi 5 min de respiration.`,
      priority: 'high',
      source: 'has',
      actionLabel: 'Respiration',
      isRead: false,
      createdAt: now.toISOString(),
    })
  }

  // Déshydratation
  if (context.waterConsumed !== undefined && context.waterTarget) {
    const waterRatio = context.waterConsumed / context.waterTarget
    if (waterRatio < 0.3 && hour >= 14) {
      items.push({
        id: generateId(),
        type: 'alert',
        category: 'hydration',
        title: 'Hydratation',
        message: `${context.waterConsumed}ml d'eau seulement. La déshydratation peut être confondue avec la faim. Garde une bouteille près de toi !`,
        priority: 'medium',
        source: 'anses',
        actionLabel: 'Ajouter',
        isRead: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // ========== ANALYSES ==========

  // Analyse des protéines
  if (context.proteinConsumed && context.proteinTarget) {
    const proteinRatio = context.proteinConsumed / context.proteinTarget

    if (proteinRatio < 0.5 && hour >= 18) {
      items.push({
        id: generateId(),
        type: 'analysis',
        category: 'nutrition',
        title: 'Protéines',
        message: `${context.proteinConsumed}g sur ${context.proteinTarget}g visés. Pour ton dîner, pense aux œufs, poisson, poulet ou légumineuses.`,
        priority: 'medium',
        source: 'anses',
        data: { consumed: context.proteinConsumed, target: context.proteinTarget },
        isRead: false,
        createdAt: now.toISOString(),
      })
    } else if (proteinRatio >= 1) {
      items.push({
        id: generateId(),
        type: 'analysis',
        category: 'nutrition',
        title: 'Protéines',
        message: `${context.proteinConsumed}g de protéines atteints. Parfait pour maintenir ta masse musculaire !`,
        priority: 'low',
        isRead: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // Analyse du sommeil (positif)
  if (context.sleepHours !== undefined && context.sleepHours >= 7 && context.sleepHours <= 9) {
    items.push({
      id: generateId(),
      type: 'analysis',
      category: 'sleep',
      title: 'Sommeil',
      message: `${context.sleepHours}h de sommeil, dans la plage optimale. Tes hormones de satiété sont équilibrées.`,
      priority: 'low',
      source: 'inserm',
      isRead: false,
      createdAt: now.toISOString(),
    })
  }

  // Analyse énergie
  if (context.energyLevel !== undefined) {
    if (context.energyLevel <= 3) {
      items.push({
        id: generateId(),
        type: 'analysis',
        category: 'wellness',
        title: 'Énergie',
        message: `Niveau d'énergie bas. Un en-cas glucides + protéines peut aider : yaourt + fruits, toast + avocat.`,
        priority: 'medium',
        isRead: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // ========== CONSEILS ==========

  // Conseil matin - petit-déjeuner
  if (hour >= 6 && hour <= 9) {
    items.push({
      id: generateId(),
      type: 'tip',
      category: 'nutrition',
      title: 'Petit-déjeuner',
      message: 'Pense aux protéines ce matin : œufs, fromage blanc ou yaourt grec. Ça stabilise ta glycémie et réduit les fringales.',
      priority: 'low',
      source: 'anses',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    })
  }

  // Conseil soir - sommeil
  if (hour >= 20 && hour <= 23) {
    items.push({
      id: generateId(),
      type: 'tip',
      category: 'sleep',
      title: 'Sommeil',
      message: 'Évite les écrans 1h avant de dormir. La lumière bleue bloque la mélatonine.',
      priority: 'low',
      source: 'inserm',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    })
  }

  // Conseil métabolisme (si objectif perte de poids)
  if (context.goal === 'weight_loss') {
    items.push({
      id: generateId(),
      type: 'tip',
      category: 'metabolism',
      title: 'Métabolisme',
      message: 'Augmente tes activités quotidiennes : escaliers, marche en téléphonant, pauses actives. +200-400 kcal/jour sans effort !',
      priority: 'low',
      source: 'expert',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  // ========== CONSEILS CUISINE ==========

  // Conseil batch cooking le dimanche
  const dayOfWeek = context.dayOfWeek ?? now.getDay()
  if (context.batchCooking && dayOfWeek === 0 && hour >= 9 && hour <= 14) {
    items.push({
      id: generateId(),
      type: 'tip',
      category: 'cooking',
      title: 'Préparation repas',
      message: 'C\'est dimanche, idéal pour préparer tes bases de la semaine : protéines, légumes rôtis, sauce maison. 2h = repas sains toute la semaine.',
      priority: 'medium',
      source: 'expert',
      actionLabel: 'Voir les recettes',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    })
  }

  // Conseils adaptés au niveau de cuisine
  if (context.cookingLevel === 'beginner') {
    if (hour >= 11 && hour <= 13) {
      items.push({
        id: generateId(),
        type: 'tip',
        category: 'cooking',
        title: 'Cuisine facile',
        message: 'Recettes simples et saines : poisson au four + légumes vapeur, pâtes + sauce tomate maison, ou salade composée. Moins de 20 min !',
        priority: 'low',
        source: 'expert',
        isRead: false,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }
  } else if (context.cookingLevel === 'advanced') {
    if (dayOfWeek === 6 || dayOfWeek === 0) { // Weekend
      items.push({
        id: generateId(),
        type: 'tip',
        category: 'cooking',
        title: 'Week-end',
        message: `${context.weekendTime || 60} min disponibles - teste une nouvelle recette : curry maison, wraps healthy, ou dessert protéiné !`,
        priority: 'low',
        source: 'expert',
        actionLabel: 'Découvrir',
        isRead: false,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }
  }

  // Conseil temps limité en semaine
  if (context.quickMealsOnly || (context.weekdayTime && context.weekdayTime <= 20)) {
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour >= 17 && hour <= 19) {
      items.push({
        id: generateId(),
        type: 'tip',
        category: 'cooking',
        title: 'Repas rapide',
        message: 'Options express : omelette aux légumes (10 min), bowl quinoa + légumineuses (15 min), wrap au thon (5 min).',
        priority: 'medium',
        source: 'expert',
        actionLabel: 'Recettes 15 min',
        isRead: false,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      })
    }
  }

  // ========== CÉLÉBRATIONS ==========

  // Série de jours consécutifs
  if (context.streak) {
    if (context.streak === 7) {
      items.push({
        id: generateId(),
        type: 'celebration',
        category: 'progress',
        title: '7 jours consécutifs',
        message: `${firstName ? firstName + ', 7' : '7'} jours consécutifs ! C'est le début d'une habitude. Continue comme ça !`,
        priority: 'medium',
        isRead: false,
        createdAt: now.toISOString(),
      })
    } else if (context.streak === 21) {
      items.push({
        id: generateId(),
        type: 'celebration',
        category: 'progress',
        title: 'Habitude créée',
        message: `${firstName ? firstName + ', 21' : '21'} jours consécutifs ! Tu as créé une nouvelle habitude. Ton cerveau a formé de nouvelles connexions neuronales.`,
        priority: 'high',
        isRead: false,
        createdAt: now.toISOString(),
      })
    } else if (context.streak === 30) {
      items.push({
        id: generateId(),
        type: 'celebration',
        category: 'progress',
        title: '1 mois',
        message: `${firstName ? firstName + ', 30' : '30'} jours de suite ! Tu fais partie des 8% de personnes qui tiennent aussi longtemps. Ta constance est remarquable.`,
        priority: 'high',
        isRead: false,
        createdAt: now.toISOString(),
      })
    }
  }

  // Level up
  if (context.level && context.level > 1) {
    items.push({
      id: generateId(),
      type: 'celebration',
      category: 'progress',
      title: `Niveau ${context.level}`,
      message: `Tu progresses bien ! Chaque niveau représente ton engagement envers ta santé.`,
      priority: 'low',
      isRead: false,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  // ========== CONSEILS SPÉCIFIQUES PROGRAMME MÉTABOLIQUE ==========

  if (phaseContext && context.metabolicBoostEnrolled) {
    // Phase 1 specific tips
    if (phaseContext.phase === 'discovery') {
      // Morning tip: focus on habits
      if (hour >= 7 && hour <= 10) {
        items.push({
          id: generateId(),
          type: 'tip',
          category: 'metabolism',
          title: 'Découverte',
          message: `En Phase 1, pas de restriction ! Mange à ta faim. L'objectif est de stabiliser ton métabolisme.`,
          priority: 'medium',
          source: 'programme',
          isRead: false,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        })
      }

      // Hydration reminder
      if (hour >= 11 && hour <= 15 && (context.waterConsumed || 0) < 1000) {
        items.push({
          id: generateId(),
          type: 'tip',
          category: 'hydration',
          title: 'Hydratation',
          message: 'Vise 2L d\'eau par jour. Ça aide ton métabolisme et réduit les fausses faims.',
          priority: 'medium',
          source: 'programme',
          actionLabel: 'Ajouter',
          isRead: false,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        })
      }

      // Walk reminder
      if (hour >= 17 && hour <= 20) {
        items.push({
          id: generateId(),
          type: 'tip',
          category: 'sport',
          title: 'Marche',
          message: 'As-tu fait ta marche de 20-30 min ? Une promenade après le dîner suffit !',
          priority: 'low',
          source: 'programme',
          isRead: false,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        })
      }
    }

    // Phase 2 (walking) tips
    if (phaseContext.phase === 'walking') {
      if (hour >= 8 && hour <= 11) {
        items.push({
          id: generateId(),
          type: 'tip',
          category: 'metabolism',
          title: 'Marche active',
          message: 'Phase 2 : augmente la marche à 30-45 min/jour + mobilité. Ton métabolisme se réveille !',
          priority: 'medium',
          source: 'programme',
          isRead: false,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        })
      }
    }

    // Phase 3 (resistance) tips
    if (phaseContext.phase === 'resistance') {
      if (hour >= 8 && hour <= 11) {
        items.push({
          id: generateId(),
          type: 'tip',
          category: 'sport',
          title: 'Résistance',
          message: 'Phase de construction musculaire ! 2-3 séances/semaine. Le muscle augmente ton métabolisme de base.',
          priority: 'medium',
          source: 'programme',
          isRead: false,
          createdAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        })
      }
    }

    // Celebrate phase completion
    if (context.metabolicBoostWeek === 1 && hour >= 10 && hour <= 14) {
      items.push({
        id: generateId(),
        type: 'celebration',
        category: 'progress',
        title: `Semaine 1`,
        message: `Tu as commencé la ${phaseContext.phaseName}. Continue pour des résultats durables !`,
        priority: 'low',
        isRead: false,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      })
    }
  }

  return items
}

/**
 * Convert LymIA Brain coaching advice to CoachItem format
 */
function lymiaAdviceToCoachItem(advice: CoachingAdvice): CoachItem {
  const typeMap: Record<string, CoachItemType> = {
    alert: 'alert',
    nutrition: 'tip',
    wellness: 'tip',
    sport: 'tip',
    motivation: 'celebration',
  }

  const categoryMap: Record<string, CoachItemCategory> = {
    nutrition: 'nutrition',
    wellness: 'wellness',
    sport: 'sport',
    alert: 'nutrition',
    motivation: 'progress',
  }

  return {
    id: `lymia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: typeMap[advice.category] || 'tip',
    category: categoryMap[advice.category] || 'nutrition',
    title: advice.message.slice(0, 50) + (advice.message.length > 50 ? '...' : ''),
    message: advice.message,
    priority: advice.priority,
    source: advice.sources?.[0]?.source || 'lymia',
    data: { actionItems: advice.actionItems },
    isRead: false,
    createdAt: new Date().toISOString(),
    expiresAt: advice.priority === 'low'
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : undefined,
  }
}

/**
 * Convert BehaviorAnalysisAgent alert to CoachItem
 * Enhanced with reasoning, confidence, and scientific basis
 */
function behaviorAlertToCoachItem(alert: BehaviorAlert): CoachItem {
  const severityToPriority: Record<string, CoachItemPriority> = {
    alert: 'high',
    warning: 'medium',
    info: 'low',
  }

  const categoryMap: Record<string, CoachItemCategory> = {
    nutrition: 'nutrition',
    wellness: 'wellness',
    sport: 'sport',
    health: 'metabolism',
  }

  return {
    id: `rag_alert_${alert.id}`,
    type: 'alert',
    category: categoryMap[alert.category] || 'nutrition',
    title: alert.title,
    message: alert.message,
    priority: severityToPriority[alert.severity] || 'medium',
    source: alert.scientificSource,
    sourceUrl: alert.sourceUrl,
    actionLabel: alert.actionLabel,
    actionRoute: alert.actionRoute,
    isRead: false,
    createdAt: alert.createdAt,
    expiresAt: alert.expiresAt,
    // NEW: Enhanced fields
    reasoning: alert.recommendation,
    confidence: alert.severity === 'alert' ? 0.95 : alert.severity === 'warning' ? 0.85 : 0.7,
    linkedFeatures: [alert.category],
  }
}

/**
 * Convert BehaviorAnalysisAgent insight to CoachItem
 * Enhanced with dataPoints and confidence visible to user
 */
function behaviorInsightToCoachItem(insight: BehaviorInsight): CoachItem {
  const typeMap: Record<string, CoachItemType> = {
    correlation: 'analysis',
    trend: 'analysis',
    recommendation: 'tip',
    achievement: 'celebration',
  }

  // Extract linked features from dataPoints
  const linkedFeatures: string[] = []
  if (insight.type === 'correlation') {
    // Correlations link multiple features
    insight.dataPoints.forEach(dp => {
      if (dp.label.toLowerCase().includes('sommeil')) linkedFeatures.push('sleep')
      if (dp.label.toLowerCase().includes('stress')) linkedFeatures.push('stress')
      if (dp.label.toLowerCase().includes('énergie')) linkedFeatures.push('wellness')
      if (dp.label.toLowerCase().includes('calorie') || dp.label.toLowerCase().includes('protéine')) linkedFeatures.push('nutrition')
    })
  }

  return {
    id: `rag_insight_${insight.id}`,
    type: typeMap[insight.type] || 'analysis',
    category: 'wellness',
    title: insight.title,
    message: insight.message,
    priority: insight.confidence >= 0.8 ? 'medium' : 'low',
    source: insight.sources[0] || 'RAG',
    data: { dataPoints: insight.dataPoints },
    isRead: false,
    createdAt: new Date().toISOString(),
    // NEW: Enhanced fields
    confidence: insight.confidence,
    dataPoints: insight.dataPoints,
    linkedFeatures: linkedFeatures.length > 0 ? [...new Set(linkedFeatures)] : undefined,
  }
}

/**
 * Convert BehaviorAnalysisAgent pattern to CoachItem (positive patterns only)
 * Enhanced with scientific basis visible
 */
function behaviorPatternToCoachItem(pattern: BehaviorPattern): CoachItem | null {
  // Only convert positive patterns to celebrations
  if (pattern.impact !== 'positive') return null

  return {
    id: `rag_pattern_${pattern.id}`,
    type: 'celebration',
    category: pattern.type as CoachItemCategory,
    title: pattern.name,
    message: pattern.description,
    priority: 'low',
    source: pattern.source,
    isRead: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    // NEW: Enhanced fields
    scientificBasis: pattern.scientificBasis,
    confidence: pattern.confidence,
    linkedFeatures: [pattern.type],
  }
}

/**
 * Generate items using BehaviorAnalysisAgent (RAG-powered)
 */
async function generateItemsWithRAG(context: CoachContext): Promise<CoachItem[]> {
  // Build behavior data from context
  const behaviorData: UserBehaviorData = {
    meals: context.recentMeals || [],
    dailyNutrition: context.recentMeals
      ? aggregateDailyNutrition(context.recentMeals)
      : context.caloriesConsumed
        ? [{
            date: new Date().toISOString().split('T')[0],
            calories: context.caloriesConsumed,
            proteins: context.proteinConsumed || 0,
            carbs: context.carbsConsumed || 0,
            fats: context.fatsConsumed || 0,
          }]
        : [],
    wellnessEntries: context.wellnessEntries || (context.sleepHours !== undefined
      ? [{
          id: 'today',
          date: new Date().toISOString().split('T')[0],
          sleepHours: context.sleepHours,
          stressLevel: context.stressLevel as 1 | 2 | 3 | 4 | 5 | undefined,
          energyLevel: context.energyLevel as 1 | 2 | 3 | 4 | 5 | undefined,
          waterLiters: context.waterConsumed ? context.waterConsumed / 1000 : undefined,
          createdAt: new Date().toISOString(),
        }]
      : []),
    sportSessions: context.sportSessions || [],
    daysTracked: context.daysTracked || 1,
    streakDays: context.streak || 0,
  }

  // Build profile
  const profile: UserProfile = {
    firstName: context.firstName || '',
    gender: 'male', // Default
    age: 30, // Default
    height: 170, // Default
    weight: context.weight || 70,
    activityLevel: 'moderate',
    goal: (context.goal as UserProfile['goal']) || 'health',
    dietType: (context.dietType as UserProfile['dietType']) || 'omnivore',
    allergies: context.allergies,
    nutritionalNeeds: context.caloriesTarget
      ? {
          calories: context.caloriesTarget,
          proteins: context.proteinTarget || 80,
          carbs: 200,
          fats: 60,
          fiber: 25,
          water: 2,
        }
      : undefined,
  }

  try {
    // Run behavior analysis with RAG
    const analysis = await BehaviorAnalysisAgent.analyzeBehavior(behaviorData, profile)

    const items: CoachItem[] = []

    // Convert alerts to coach items (highest priority)
    for (const alert of analysis.alerts) {
      items.push(behaviorAlertToCoachItem(alert))
    }

    // Convert insights to coach items
    for (const insight of analysis.insights) {
      items.push(behaviorInsightToCoachItem(insight))
    }

    // Convert positive patterns to celebrations
    for (const pattern of analysis.patterns) {
      const item = behaviorPatternToCoachItem(pattern)
      if (item) items.push(item)
    }

    console.log(`RAG analysis: ${items.length} items, sources: ${analysis.ragSourcesUsed.join(', ')}`)
    return items
  } catch (error) {
    console.error('BehaviorAnalysisAgent failed:', error)
    return []
  }
}

/**
 * Helper: Aggregate meals into daily nutrition summaries
 */
function aggregateDailyNutrition(meals: Meal[]): Array<{
  date: string
  calories: number
  proteins: number
  carbs: number
  fats: number
  fiber?: number
}> {
  const byDate = new Map<string, { calories: number; proteins: number; carbs: number; fats: number; fiber: number }>()

  for (const meal of meals) {
    const date = meal.date
    const existing = byDate.get(date) || { calories: 0, proteins: 0, carbs: 0, fats: 0, fiber: 0 }
    byDate.set(date, {
      calories: existing.calories + meal.totalNutrition.calories,
      proteins: existing.proteins + meal.totalNutrition.proteins,
      carbs: existing.carbs + meal.totalNutrition.carbs,
      fats: existing.fats + meal.totalNutrition.fats,
      fiber: existing.fiber + (meal.totalNutrition.fiber || 0),
    })
  }

  return Array.from(byDate.entries()).map(([date, nutrition]) => ({
    date,
    ...nutrition,
    fiber: nutrition.fiber > 0 ? nutrition.fiber : undefined,
  }))
}

/**
 * Generate coaching items using LymIA Brain (AI-powered)
 */
async function generateItemsWithLymIA(context: CoachContext): Promise<CoachItem[]> {
  // Build LymIA context from coach context
  const userContext: UserContext = {
    profile: {
      firstName: context.firstName,
      goal: context.goal as UserProfile['goal'],
      dietType: context.dietType as UserProfile['dietType'],
      allergies: context.allergies,
      weight: context.weight || 70,
      height: 170, // Default
      age: 30, // Default
      gender: 'male', // Default
      activityLevel: 'moderate',
      cookingPreferences: {
        level: context.cookingLevel || 'intermediate',
        weekdayTime: context.weekdayTime || 30,
        weekendTime: context.weekendTime || 60,
        batchCooking: context.batchCooking || false,
        quickMealsOnly: context.quickMealsOnly || false,
      },
    } as UserProfile,
    todayNutrition: {
      calories: context.caloriesConsumed || 0,
      proteins: context.proteinConsumed || 0,
      carbs: context.carbsConsumed || 0,
      fats: context.fatsConsumed || 0,
    },
    weeklyAverage: {
      calories: context.weeklyCaloriesAvg || 0,
      proteins: context.weeklyProteinAvg || 0,
      carbs: 0,
      fats: 0,
    },
    currentStreak: context.streak || 0,
    lastMeals: [],
    wellnessData: {
      sleepHours: context.sleepHours,
      stressLevel: context.stressLevel,
      energyLevel: context.energyLevel,
      hydrationLiters: context.waterConsumed ? context.waterConsumed / 1000 : undefined,
    },
  }

  try {
    const advices = await LymIABrain.getCoachingAdvice(userContext)

    // Convert LymIA advices to CoachItems
    return advices.map(lymiaAdviceToCoachItem)
  } catch (error) {
    console.error('LymIA coaching generation failed:', error)
    // Fallback to static generation
    return generateItemsFromContext(context)
  }
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      items: [],
      historyItems: [],
      unreadCount: 0,
      lastGeneratedAt: null,
      context: {},
      isGeneratingAI: false,
      lastCoordinatedAnalysis: null,

      setContext: (newContext) => {
        set((state) => ({
          context: { ...state.context, ...newContext },
        }))
      },

      generateItems: () => {
        const { context, items: existingItems } = get()
        const now = new Date()

        // Ne pas régénérer trop souvent (min 4h pour éviter spam)
        const lastGen = get().lastGeneratedAt
        if (lastGen) {
          const diff = now.getTime() - new Date(lastGen).getTime()
          if (diff < 4 * 60 * 60 * 1000) return // 4 heures minimum
        }

        // Nettoyer les items expirés
        const validItems = existingItems.filter((item) => {
          if (!item.expiresAt) return true
          return new Date(item.expiresAt) > now
        })

        // Générer nouveaux items
        const newItems = generateItemsFromContext({
          ...context,
          currentHour: now.getHours(),
          dayOfWeek: now.getDay(),
        })

        // Éviter les doublons (même titre dans les dernières 24h - une journée complète)
        const recentTitles = new Set(
          validItems
            .filter((item) => {
              const age = now.getTime() - new Date(item.createdAt).getTime()
              return age < 24 * 60 * 60 * 1000 // 24h au lieu de 12h
            })
            .map((item) => item.title)
        )

        const uniqueNewItems = newItems.filter((item) => !recentTitles.has(item.title))

        // Trier par priorité et date
        const allItems = [...uniqueNewItems, ...validItems]
          .sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 }
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
            if (priorityDiff !== 0) return priorityDiff
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })
          .slice(0, 8) // Limiter à 8 items pour ne pas surcharger

        const unreadCount = allItems.filter((item) => !item.isRead).length

        set({
          items: allItems,
          unreadCount,
          lastGeneratedAt: now.toISOString(),
        })
      },

      // Generate items using RAG + LymIA Brain (AI-powered with knowledge base)
      generateItemsWithAI: async () => {
        const { context, items: existingItems, isGeneratingAI, lastGeneratedAt } = get()

        // Prevent concurrent generation
        if (isGeneratingAI) return

        // CACHE: Don't regenerate if we have fresh AI items (within 6 hours)
        const now = new Date()
        if (lastGeneratedAt) {
          const timeSinceLastGen = now.getTime() - new Date(lastGeneratedAt).getTime()
          const sixHours = 6 * 60 * 60 * 1000

          // If we have items and they're fresh, skip regeneration
          if (timeSinceLastGen < sixHours && existingItems.length > 0) {
            console.log('[CoachStore] Using cached AI insights (fresh within 6h)')
            return
          }
        }

        set({ isGeneratingAI: true })

        try {
          const now = new Date()

          // Clean expired items
          const validItems = existingItems.filter((item) => {
            if (!item.expiresAt) return true
            return new Date(item.expiresAt) > now
          })

          const contextWithTime = {
            ...context,
            currentHour: now.getHours(),
            dayOfWeek: now.getDay(),
          }

          // Run RAG behavior analysis and LymIA Brain in parallel
          const [ragItems, lymiaItems] = await Promise.all([
            generateItemsWithRAG(contextWithTime),
            generateItemsWithLymIA(contextWithTime),
          ])

          // Merge items: RAG alerts first (higher priority), then LymIA items
          const newItems = [...ragItems, ...lymiaItems]

          // Avoid duplicates (same title in last 24h - full day)
          const recentTitles = new Set(
            validItems
              .filter((item) => {
                const age = now.getTime() - new Date(item.createdAt).getTime()
                return age < 24 * 60 * 60 * 1000 // 24h au lieu de 12h
              })
              .map((item) => item.title)
          )

          const uniqueNewItems = newItems.filter((item) => !recentTitles.has(item.title))

          // Sort by priority and date
          const allItems = [...uniqueNewItems, ...validItems]
            .sort((a, b) => {
              const priorityOrder = { high: 0, medium: 1, low: 2 }
              const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
              if (priorityDiff !== 0) return priorityDiff
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            })
            .slice(0, 8) // Limiter à 8 items pour ne pas surcharger

          const unreadCount = allItems.filter((item) => !item.isRead).length

          set({
            items: allItems,
            unreadCount,
            lastGeneratedAt: now.toISOString(),
            isGeneratingAI: false,
          })
        } catch (error) {
          console.error('AI coaching generation error:', error)
          set({ isGeneratingAI: false })
          // Fallback to static generation
          get().generateItems()
        }
      },

      // NEW: Generate using Agent Coordinator (all agents communicate + notifications)
      generateWithCoordinator: async (trigger?: EventTrigger) => {
        const { context, items: existingItems, isGeneratingAI, lastGeneratedAt } = get()

        // Prevent concurrent generation
        if (isGeneratingAI) return

        // CACHE: Don't regenerate unless triggered or items are stale (8 hours)
        // Triggers bypass cache (they're important events)
        const now = new Date()
        if (!trigger && lastGeneratedAt) {
          const timeSinceLastGen = now.getTime() - new Date(lastGeneratedAt).getTime()
          const eightHours = 8 * 60 * 60 * 1000

          if (timeSinceLastGen < eightHours && existingItems.length > 0) {
            console.log('[CoachStore] Using cached coordinator insights (fresh within 8h)')
            return
          }
        }

        set({ isGeneratingAI: true })

        try {
          const now = new Date()

          // Build CoordinatorContext from CoachContext
          const coordinatorContext: CoordinatorContext = {
            profile: {
              firstName: context.firstName,
              goal: context.goal as UserProfile['goal'],
              dietType: context.dietType as UserProfile['dietType'],
              allergies: context.allergies,
              weight: context.weight || 70,
              height: 170,
              age: 30,
              gender: 'male',
              activityLevel: 'moderate',
            } as UserProfile,
            meals: context.recentMeals || [],
            todayNutrition: {
              calories: context.caloriesConsumed || 0,
              proteins: context.proteinConsumed || 0,
              carbs: context.carbsConsumed || 0,
              fats: context.fatsConsumed || 0,
            },
            weeklyNutrition: context.weeklyCaloriesAvg
              ? [{ calories: context.weeklyCaloriesAvg, proteins: context.weeklyProteinAvg || 0, carbs: 0, fats: 0 }]
              : [],
            wellnessEntries: context.wellnessEntries || [],
            currentWellness: {
              sleepHours: context.sleepHours,
              stressLevel: context.stressLevel,
              energyLevel: context.energyLevel,
            },
            sportSessions: context.sportSessions || [],
            streak: context.streak || 0,
            level: context.level || 1,
            xp: context.xp || 0,
            daysTracked: context.daysTracked || 0,
          }

          // Run coordinated analysis (all agents + notifications)
          const analysis = await runCoordinatedAnalysis(coordinatorContext, trigger)

          // Convert agent results to CoachItems
          const newItems: CoachItem[] = []

          for (const result of analysis.results) {
            // Convert alerts
            for (const alert of result.alerts) {
              if ('category' in alert) {
                // BehaviorAlert
                newItems.push(behaviorAlertToCoachItem(alert as BehaviorAlert))
              } else {
                // WellnessAlert - convert to CoachItem
                const wellnessAlert = alert as { id: string; severity: string; title: string; message: string; recommendation: string; scientificSource: string }
                newItems.push({
                  id: generateId(),
                  type: 'alert',
                  category: 'wellness',
                  title: wellnessAlert.title,
                  message: wellnessAlert.message,
                  priority: wellnessAlert.severity === 'warning' ? 'high' : 'medium',
                  source: wellnessAlert.scientificSource,
                  isRead: false,
                  createdAt: new Date().toISOString(),
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                })
              }
            }

            // Convert insights to tips
            for (const insight of result.insights) {
              newItems.push({
                id: generateId(),
                type: 'tip',
                category: result.agent === 'wellness' ? 'wellness' :
                         result.agent === 'behavior' ? 'nutrition' : 'progress',
                title: insight.length > 50 ? insight.substring(0, 47) + '...' : insight,
                message: insight,
                priority: 'medium',
                source: result.ragSources[0] || 'LymIA',
                isRead: false,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
              })
            }
          }

          // Add connected insights as special items
          for (const connectedInsight of analysis.connectedInsights) {
            newItems.push({
              id: generateId(),
              type: 'analysis',
              category: 'progress',
              title: 'Lien détecté',
              message: connectedInsight,
              priority: 'high',
              source: 'LymIA Coordinator',
              isRead: false,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            })
          }

          // Clean expired items
          const validItems = existingItems.filter((item) => {
            if (!item.expiresAt) return true
            return new Date(item.expiresAt) > now
          })

          // Avoid duplicates
          const recentTitles = new Set(
            validItems
              .filter((item) => {
                const age = now.getTime() - new Date(item.createdAt).getTime()
                return age < 24 * 60 * 60 * 1000
              })
              .map((item) => item.title)
          )

          const uniqueNewItems = newItems.filter((item) => !recentTitles.has(item.title))

          // Sort and limit
          const allItems = [...uniqueNewItems, ...validItems]
            .sort((a, b) => {
              const priorityOrder = { high: 0, medium: 1, low: 2 }
              const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
              if (priorityDiff !== 0) return priorityDiff
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            })
            .slice(0, 10)

          const unreadCount = allItems.filter((item) => !item.isRead).length

          set({
            items: allItems,
            unreadCount,
            lastGeneratedAt: now.toISOString(),
            lastCoordinatedAnalysis: analysis,
            isGeneratingAI: false,
          })

          console.log('[CoachStore] Coordinator analysis complete:', {
            itemsGenerated: uniqueNewItems.length,
            notificationSent: analysis.notificationSent,
            ragSources: analysis.ragSourcesUsed.length,
          })

        } catch (error) {
          console.error('[CoachStore] Coordinator generation error:', error)
          set({ isGeneratingAI: false })
          // Fallback to regular AI generation
          get().generateItemsWithAI()
        }
      },

      markAsRead: (itemId) => {
        set((state) => {
          const items = state.items.map((item) =>
            item.id === itemId ? { ...item, isRead: true } : item
          )
          return {
            items,
            unreadCount: items.filter((item) => !item.isRead).length,
          }
        })
      },

      markAllAsRead: () => {
        set((state) => ({
          items: state.items.map((item) => ({ ...item, isRead: true })),
          unreadCount: 0,
        }))
      },

      dismissItem: (itemId) => {
        set((state) => {
          const dismissedItem = state.items.find((item) => item.id === itemId)
          const items = state.items.filter((item) => item.id !== itemId)

          // Archive dismissed item to history (max 50 items)
          let historyItems = state.historyItems
          if (dismissedItem) {
            historyItems = [
              { ...dismissedItem, isRead: true },
              ...state.historyItems,
            ].slice(0, 50)
          }

          return {
            items,
            historyItems,
            unreadCount: items.filter((item) => !item.isRead).length,
          }
        })
      },

      clearExpired: () => {
        const now = new Date()
        set((state) => {
          const items = state.items.filter((item) => {
            if (!item.expiresAt) return true
            return new Date(item.expiresAt) > now
          })
          return {
            items,
            unreadCount: items.filter((item) => !item.isRead).length,
          }
        })
      },

      getUnreadCount: () => {
        return get().items.filter((item) => !item.isRead).length
      },

      // Force refresh AI insights (bypasses cache)
      forceRefreshAI: async () => {
        // Clear lastGeneratedAt to bypass cache
        set({ lastGeneratedAt: null })
        // Then regenerate
        await get().generateItemsWithAI()
      },

      // Get cache status for UI display
      getCacheStatus: () => {
        const { lastGeneratedAt, items } = get()
        const now = Date.now()

        if (!lastGeneratedAt) {
          return { isFresh: false, ageMinutes: 0, itemCount: items.length }
        }

        const ageMs = now - new Date(lastGeneratedAt).getTime()
        const ageMinutes = Math.floor(ageMs / (60 * 1000))
        const sixHours = 6 * 60 // 360 minutes

        return {
          isFresh: ageMinutes < sixHours && items.length > 0,
          ageMinutes,
          itemCount: items.length,
        }
      },

      // Get archived history items
      getHistoryItems: () => {
        return get().historyItems
      },

      // Clear all history
      clearHistory: () => {
        set({ historyItems: [] })
      },
    }),
    {
      name: 'coach-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
