/**
 * useSuperAgent Hook - Interface React pour le Super Agent IA
 *
 * Ce hook permet aux composants d'interagir facilement avec le Super Agent:
 * - Analyse automatique au montage
 * - Quick check pour le dashboard
 * - Accès aux insights et événements détectés
 * - Déclenchement manuel d'analyse
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  SuperAgent,
  runSuperAgentAnalysis,
  getSuperAgentQuickCheck,
  getLastSuperAgentAnalysis,
  shouldRunDailyAnalysis,
  type SuperAgentContext,
  type SuperAgentAnalysis,
  type DailyInsight,
  type DetectedEvent,
} from '../services/super-agent'
import {
  generateDailyInsight,
  getLastDailyInsight,
} from '../services/daily-insight-service'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useWellnessStore } from '../stores/wellness-store'
import { useGamificationStore } from '../stores/gamification-store'
import type { UserProfile, NutritionInfo } from '../types'

// ============= TYPES =============

export interface SuperAgentState {
  // Status
  isLoading: boolean
  isAnalyzing: boolean
  lastAnalyzedAt: string | null
  error: string | null

  // Results
  analysis: SuperAgentAnalysis | null
  dailyInsight: DailyInsight | null
  detectedEvents: DetectedEvent[]

  // Quick check result
  quickStatus: 'great' | 'good' | 'attention' | 'alert' | null
  quickMessage: string | null

  // Confidence
  confidence: number
}

export interface SuperAgentActions {
  // Run full analysis
  analyze: () => Promise<void>

  // Quick status check (lightweight)
  quickCheck: () => Promise<void>

  // Refresh daily insight
  refreshDailyInsight: () => Promise<void>

  // Clear error
  clearError: () => void
}

export type UseSuperAgentReturn = SuperAgentState & SuperAgentActions

// ============= CONTEXT BUILDER =============

/**
 * Build SuperAgentContext from stores
 */
function buildContext(
  profile: Partial<UserProfile> | null,
  mealsState: ReturnType<typeof useMealsStore.getState>,
  wellnessState: ReturnType<typeof useWellnessStore.getState>,
  gamificationState: ReturnType<typeof useGamificationStore.getState>
): SuperAgentContext | null {
  if (!profile || !profile.weight || !profile.age) {
    return null
  }

  // Calculate dates for last 7 days
  const today = new Date().toISOString().split('T')[0]
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    dates.push(date.toISOString().split('T')[0])
  }

  // Collect meals from dailyData
  const allMeals: import('../types').Meal[] = []
  for (const date of dates) {
    const dayData = mealsState.dailyData[date]
    if (dayData?.meals) {
      allMeals.push(...dayData.meals)
    }
  }

  // Calculate daily nutrition from dailyData
  const weeklyNutrition: NutritionInfo[] = dates.map(date => {
    const dayData = mealsState.dailyData[date]
    if (!dayData?.meals || dayData.meals.length === 0) {
      return { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    }
    return dayData.meals.reduce(
      (acc: NutritionInfo, meal: import('../types').Meal) => ({
        calories: acc.calories + (meal.totalNutrition?.calories || 0),
        proteins: acc.proteins + (meal.totalNutrition?.proteins || 0),
        carbs: acc.carbs + (meal.totalNutrition?.carbs || 0),
        fats: acc.fats + (meal.totalNutrition?.fats || 0),
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    )
  })

  // Today's nutrition
  const todayNutrition = weeklyNutrition[0] || { calories: 0, proteins: 0, carbs: 0, fats: 0 }

  // Wellness entries (convert Record to array)
  const wellnessEntriesRecord = wellnessState.entries || {}
  const wellnessEntriesArray = Object.values(wellnessEntriesRecord) as import('../types').WellnessEntry[]
  const recentWellness = wellnessEntriesArray.filter((w: import('../types').WellnessEntry) => dates.includes(w.date))
  const todayWellness = recentWellness.find((w: import('../types').WellnessEntry) => w.date === today)

  // Gamification
  const streak = gamificationState.currentStreak || 0
  const level = gamificationState.currentLevel || 1
  const xp = gamificationState.totalXP || 0

  // Days tracked
  const daysWithMeals = dates.filter(date => {
    const dayData = mealsState.dailyData[date]
    return dayData?.meals && dayData.meals.length > 0
  })
  const daysWithWellness = recentWellness.map((w: import('../types').WellnessEntry) => w.date)
  const daysTracked = new Set([...daysWithMeals, ...daysWithWellness]).size

  return {
    profile: profile as UserProfile,
    meals: allMeals,
    todayNutrition,
    weeklyNutrition,
    wellnessEntries: recentWellness,
    todayWellness,
    streak,
    level,
    xp,
    daysTracked,
  }
}

// ============= HOOK =============

/**
 * Hook principal pour utiliser le Super Agent
 *
 * @param options - Options de configuration
 * @param options.autoAnalyze - Lancer l'analyse automatiquement au montage (default: false)
 * @param options.autoQuickCheck - Lancer un quick check au montage (default: true)
 */
export function useSuperAgent(
  options: {
    autoAnalyze?: boolean
    autoQuickCheck?: boolean
  } = {}
): UseSuperAgentReturn {
  const { autoAnalyze = false, autoQuickCheck = true } = options

  // Stores
  const profile = useUserStore(state => state.profile)
  const mealsState = useMealsStore.getState()
  const wellnessState = useWellnessStore.getState()
  const gamificationState = useGamificationStore.getState()

  // State
  const [state, setState] = useState<SuperAgentState>({
    isLoading: false,
    isAnalyzing: false,
    lastAnalyzedAt: null,
    error: null,
    analysis: null,
    dailyInsight: null,
    detectedEvents: [],
    quickStatus: null,
    quickMessage: null,
    confidence: 0,
  })

  // Build context (memoized)
  const context = useMemo(() => {
    return buildContext(profile, mealsState, wellnessState, gamificationState)
  }, [profile, mealsState.dailyData, wellnessState.entries, gamificationState.currentStreak])

  // ========== ACTIONS ==========

  const analyze = useCallback(async () => {
    if (!context) {
      setState(prev => ({ ...prev, error: 'Profil incomplet' }))
      return
    }

    setState(prev => ({ ...prev, isAnalyzing: true, error: null }))

    try {
      const analysis = await runSuperAgentAnalysis(context)

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        analysis,
        dailyInsight: analysis.dailyInsight || prev.dailyInsight,
        detectedEvents: analysis.detectedEvents,
        lastAnalyzedAt: analysis.analyzedAt,
        confidence: analysis.confidence,
      }))
    } catch (error) {
      console.error('[useSuperAgent] Analysis error:', error)
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : 'Erreur d\'analyse',
      }))
    }
  }, [context])

  const quickCheck = useCallback(async () => {
    if (!context) {
      return
    }

    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const result = await getSuperAgentQuickCheck(context)

      setState(prev => ({
        ...prev,
        isLoading: false,
        quickStatus: result.status,
        quickMessage: result.message,
      }))
    } catch (error) {
      console.error('[useSuperAgent] Quick check error:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        quickStatus: 'good',
        quickMessage: 'Continue comme ça !',
      }))
    }
  }, [context])

  const refreshDailyInsight = useCallback(async () => {
    try {
      const result = await generateDailyInsight()
      if (result.success && result.insight) {
        setState(prev => ({ ...prev, dailyInsight: result.insight! }))
      }
    } catch (error) {
      console.error('[useSuperAgent] Daily insight error:', error)
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // ========== EFFECTS ==========

  // Load cached analysis on mount
  useEffect(() => {
    const loadCached = async () => {
      // Load last analysis
      const lastAnalysis = getLastSuperAgentAnalysis()
      if (lastAnalysis) {
        setState(prev => ({
          ...prev,
          analysis: lastAnalysis,
          detectedEvents: lastAnalysis.detectedEvents,
          lastAnalyzedAt: lastAnalysis.analyzedAt,
          confidence: lastAnalysis.confidence,
        }))
      }

      // Load last daily insight
      const lastInsight = await getLastDailyInsight()
      if (lastInsight) {
        setState(prev => ({ ...prev, dailyInsight: lastInsight }))
      }
    }

    loadCached()
  }, [])

  // Auto quick check on mount
  useEffect(() => {
    if (autoQuickCheck && context) {
      quickCheck()
    }
  }, [autoQuickCheck, context, quickCheck])

  // Auto analyze if needed
  useEffect(() => {
    if (autoAnalyze && context && shouldRunDailyAnalysis()) {
      analyze()
    }
  }, [autoAnalyze, context, analyze])

  // ========== RETURN ==========

  return {
    ...state,
    analyze,
    quickCheck,
    refreshDailyInsight,
    clearError,
  }
}

// ============= SPECIALIZED HOOKS =============

/**
 * Hook simplifié pour le dashboard (quick check seulement)
 */
export function useSuperAgentQuickCheck() {
  const { isLoading, quickStatus, quickMessage, quickCheck } = useSuperAgent({
    autoQuickCheck: true,
    autoAnalyze: false,
  })

  return {
    isLoading,
    status: quickStatus,
    message: quickMessage,
    refresh: quickCheck,
  }
}

/**
 * Hook pour les événements détectés
 */
export function useSuperAgentEvents() {
  const { detectedEvents, analyze, isAnalyzing } = useSuperAgent({
    autoQuickCheck: false,
    autoAnalyze: true,
  })

  // Filtrer par priorité
  const criticalEvents = detectedEvents.filter(e => e.priority === 'critical')
  const highEvents = detectedEvents.filter(e => e.priority === 'high')
  const otherEvents = detectedEvents.filter(
    e => e.priority === 'medium' || e.priority === 'low'
  )

  return {
    allEvents: detectedEvents,
    criticalEvents,
    highEvents,
    otherEvents,
    hasAlerts: criticalEvents.length > 0 || highEvents.length > 0,
    refresh: analyze,
    isLoading: isAnalyzing,
  }
}

/**
 * Hook pour l'insight quotidien
 */
export function useDailyInsight() {
  const { dailyInsight, refreshDailyInsight, isAnalyzing } = useSuperAgent({
    autoQuickCheck: false,
    autoAnalyze: false,
  })

  useEffect(() => {
    if (!dailyInsight) {
      refreshDailyInsight()
    }
  }, [dailyInsight, refreshDailyInsight])

  return {
    insight: dailyInsight,
    refresh: refreshDailyInsight,
    isLoading: isAnalyzing,
  }
}

export default useSuperAgent
