/**
 * useAgentTriggers - Hook pour déclencher les agents IA sur événements
 *
 * Ce hook écoute les changements dans les stores et déclenche
 * automatiquement l'Agent Coordinator quand nécessaire.
 *
 * Événements déclencheurs:
 * - Repas loggé (meal_logged)
 * - Données wellness ajoutées (wellness_logged)
 * - Session sport complétée (sport_completed)
 * - Objectif atteint (goal_reached)
 * - Milestone de streak (streak_milestone)
 */

import { useEffect, useRef, useCallback } from 'react'
import { useMealsStore } from '../stores/meals-store'
import { useUserStore } from '../stores/user-store'
import { useCoachStore } from '../stores/coach-store'
import { useGamificationStore } from '../stores/gamification-store'
import type { EventTrigger } from '../services/agent-coordinator'

interface TriggerState {
  lastMealCount: number
  lastStreak: number
  lastLevel: number
}

/**
 * Hook principal pour les triggers automatiques
 * À utiliser dans un composant haut niveau (ex: App.tsx ou HomeScreen)
 */
export function useAgentTriggers() {
  const { dailyData, currentDate } = useMealsStore()
  const { profile } = useUserStore()
  const { generateWithCoordinator, setContext } = useCoachStore()
  const { currentStreak, currentLevel, totalXP } = useGamificationStore()

  // Alias for cleaner code
  const streak = currentStreak
  const level = currentLevel
  const xp = totalXP

  // Track previous state to detect changes
  const prevState = useRef<TriggerState>({
    lastMealCount: 0,
    lastStreak: 0,
    lastLevel: 0,
  })

  // Debounce pour éviter trop de triggers
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  const triggerAnalysis = useCallback(
    async (trigger: EventTrigger) => {
      // Clear any pending trigger
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }

      // Debounce: attendre 2 secondes avant de déclencher
      debounceTimeout.current = setTimeout(async () => {
        console.log('[AgentTriggers] Triggering analysis:', trigger.type)

        // Mettre à jour le contexte avec les dernières données
        const todayData = dailyData[currentDate]
        setContext({
          firstName: profile?.firstName,
          goal: profile?.goal,
          dietType: profile?.dietType,
          allergies: profile?.allergies,
          weight: profile?.weight,
          caloriesConsumed: todayData?.totalNutrition?.calories || 0,
          proteinConsumed: todayData?.totalNutrition?.proteins || 0,
          carbsConsumed: todayData?.totalNutrition?.carbs || 0,
          fatsConsumed: todayData?.totalNutrition?.fats || 0,
          recentMeals: todayData?.meals || [],
          streak,
          level,
          xp,
          daysTracked: Object.keys(dailyData).length,
          // Lifestyle habits from onboarding
          sleepQualityPerception: profile?.lifestyleHabits?.sleepQualityPerception,
        })

        // Lancer l'analyse coordonnée
        await generateWithCoordinator(trigger)
      }, 2000)
    },
    [dailyData, currentDate, profile, streak, level, xp, setContext, generateWithCoordinator]
  )

  // Écouter les changements de repas
  useEffect(() => {
    const todayData = dailyData[currentDate]
    const currentMealCount = todayData?.meals?.length || 0

    if (currentMealCount > prevState.current.lastMealCount) {
      // Nouveau repas détecté
      triggerAnalysis({
        type: 'meal_logged',
        data: { mealCount: currentMealCount },
        timestamp: new Date().toISOString(),
      })
    }

    prevState.current.lastMealCount = currentMealCount
  }, [dailyData, currentDate, triggerAnalysis])

  // Écouter les milestones de streak
  useEffect(() => {
    const streakMilestones = [7, 14, 21, 30, 60, 90, 100]

    if (
      streak > prevState.current.lastStreak &&
      streakMilestones.includes(streak)
    ) {
      triggerAnalysis({
        type: 'streak_milestone',
        data: { streak },
        timestamp: new Date().toISOString(),
      })
    }

    prevState.current.lastStreak = streak
  }, [streak, triggerAnalysis])

  // Écouter les changements de niveau
  useEffect(() => {
    if (level > prevState.current.lastLevel && prevState.current.lastLevel > 0) {
      triggerAnalysis({
        type: 'goal_reached',
        data: { newLevel: level },
        timestamp: new Date().toISOString(),
      })
    }

    prevState.current.lastLevel = level
  }, [level, triggerAnalysis])

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [])
}

/**
 * Fonction utilitaire pour déclencher manuellement une analyse
 * (ex: après avoir loggé des données wellness)
 */
export function useTriggerAnalysis() {
  const { generateWithCoordinator } = useCoachStore()

  return useCallback(
    async (triggerType: EventTrigger['type'], data?: Record<string, unknown>) => {
      const trigger: EventTrigger = {
        type: triggerType,
        data,
        timestamp: new Date().toISOString(),
      }

      await generateWithCoordinator(trigger)
    },
    [generateWithCoordinator]
  )
}
