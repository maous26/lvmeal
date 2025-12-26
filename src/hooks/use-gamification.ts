'use client'

import { useEffect, useCallback } from 'react'
import { useGamificationStore, XP_REWARDS } from '@/stores/gamification-store'
import { useMealsStore } from '@/stores/meals-store'

/**
 * Hook to integrate gamification with user actions
 * Automatically tracks meals, hydration, and other activities
 */
export function useGamification() {
  const {
    addXP,
    checkAndUpdateStreak,
    incrementMetric,
    updateDailyProgress,
    getStreakInfo,
    currentStreak,
  } = useGamificationStore()

  const { getMealsForDate, getHydration } = useMealsStore()

  // Check and update streak on mount
  useEffect(() => {
    checkAndUpdateStreak()
  }, [checkAndUpdateStreak])

  // Log a meal and award XP
  const logMeal = useCallback((mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner') => {
    // Base XP for logging any meal
    addXP(XP_REWARDS.LOG_MEAL, `Repas enregistré: ${mealType}`)

    // Bonus for breakfast (encouraging healthy habit)
    if (mealType === 'breakfast') {
      addXP(XP_REWARDS.LOG_BREAKFAST - XP_REWARDS.LOG_MEAL, 'Bonus petit-déjeuner')

      // Check for early bird badge (before 8am)
      const hour = new Date().getHours()
      if (hour < 8) {
        incrementMetric('early_breakfast')
      }
    }

    // Increment meals logged metric
    incrementMetric('meals_logged')

    // Update daily progress
    const today = new Date().toISOString().split('T')[0]
    const todayMeals = getMealsForDate(today)
    const mealsLogged = todayMeals.length + 1 // +1 for the meal being logged now

    updateDailyProgress({ mealsLogged })

    // Check if all meals logged (bonus XP)
    const mealTypes = new Set(todayMeals.map(m => m.type))
    mealTypes.add(mealType)
    if (mealTypes.size >= 4) {
      addXP(XP_REWARDS.LOG_ALL_MEALS, 'Tous les repas enregistrés')
      updateDailyProgress({ allMealsLogged: true })
    }

    // Update streak
    checkAndUpdateStreak()
  }, [addXP, incrementMetric, updateDailyProgress, getMealsForDate, checkAndUpdateStreak])

  // Log hydration
  const logHydration = useCallback((amount: number) => {
    addXP(XP_REWARDS.LOG_HYDRATION, 'Hydratation enregistrée')

    const today = new Date().toISOString().split('T')[0]
    const currentHydration = getHydration(today) + amount

    // Check if reached target (2.5L = 2500ml)
    if (currentHydration >= 2500) {
      addXP(XP_REWARDS.REACH_HYDRATION_TARGET, 'Objectif hydratation atteint')
      updateDailyProgress({ hydrationReached: true })
      incrementMetric('hydration_streak')
    }
  }, [addXP, getHydration, updateDailyProgress, incrementMetric])

  // Check calorie target reached
  const checkCalorieTarget = useCallback((consumed: number, target: number) => {
    const tolerance = 0.10 // ±10%
    const minAcceptable = target * (1 - tolerance)
    const maxAcceptable = target * (1 + tolerance)

    if (consumed >= minAcceptable && consumed <= maxAcceptable) {
      addXP(XP_REWARDS.REACH_CALORIE_TARGET, 'Objectif calories atteint')
      updateDailyProgress({ caloriesReached: true })
      return true
    }
    return false
  }, [addXP, updateDailyProgress])

  // Check protein target reached
  const checkProteinTarget = useCallback((consumed: number, target: number) => {
    if (consumed >= target * 0.9) { // 90% of target
      addXP(XP_REWARDS.REACH_PROTEIN_TARGET, 'Objectif protéines atteint')
      updateDailyProgress({ proteinReached: true })
      incrementMetric('protein_streak')
      return true
    }
    return false
  }, [addXP, updateDailyProgress, incrementMetric])

  // Complete weekly plan
  const completeWeeklyPlan = useCallback(() => {
    addXP(XP_REWARDS.COMPLETE_WEEKLY_PLAN, 'Plan hebdomadaire créé')
    incrementMetric('plans_created')
  }, [addXP, incrementMetric])

  // Save shopping list
  const saveShoppingList = useCallback(() => {
    addXP(XP_REWARDS.SAVE_SHOPPING_LIST, 'Liste de courses sauvegardée')
    incrementMetric('shopping_lists_saved')
  }, [addXP, incrementMetric])

  // Follow daily plan
  const followDailyPlan = useCallback(() => {
    addXP(XP_REWARDS.FOLLOW_PLAN_DAY, 'Plan du jour suivi')
    incrementMetric('plan_follow_streak')
  }, [addXP, incrementMetric])

  // Rate a recipe
  const rateRecipe = useCallback(() => {
    addXP(XP_REWARDS.RATE_RECIPE, 'Recette notée')
  }, [addXP])

  // Add recipe to favorites
  const addRecipeToFavorites = useCallback(() => {
    addXP(XP_REWARDS.ADD_RECIPE_TO_FAVORITES, 'Recette ajoutée aux favoris')
    incrementMetric('favorite_recipes')
  }, [addXP, incrementMetric])

  // Earn repas plaisir
  const earnRepasPlaisir = useCallback(() => {
    addXP(XP_REWARDS.SHARE_PROGRESS, 'Repas plaisir débloqué')
    incrementMetric('repas_plaisir_earned')
  }, [addXP, incrementMetric])

  // Weight milestone
  const checkWeightMilestone = useCallback((startWeight: number, currentWeight: number, targetWeight: number) => {
    const isLosingWeight = targetWeight < startWeight
    const progressMade = isLosingWeight
      ? startWeight - currentWeight
      : currentWeight - startWeight

    const milestones = [1, 5, 10]
    milestones.forEach(milestone => {
      const metricKey = `weight_milestone_${milestone}`
      const currentMilestones = useGamificationStore.getState().metricsCount[metricKey] || 0

      if (progressMade >= milestone && currentMilestones === 0) {
        addXP(XP_REWARDS.WEIGHT_MILESTONE, `Jalon de poids: ${milestone}kg`)
        incrementMetric(metricKey)
        incrementMetric('weight_progress', milestone)
      }
    })

    // Check if goal reached
    if (isLosingWeight && currentWeight <= targetWeight) {
      incrementMetric('goal_reached')
    } else if (!isLosingWeight && currentWeight >= targetWeight) {
      incrementMetric('goal_reached')
    }
  }, [addXP, incrementMetric])

  // Track weekend activity
  const trackWeekendActivity = useCallback(() => {
    const day = new Date().getDay()
    if (day === 0 || day === 6) { // Sunday or Saturday
      incrementMetric('weekend_tracking')
    }
  }, [incrementMetric])

  return {
    // Core actions
    logMeal,
    logHydration,
    checkCalorieTarget,
    checkProteinTarget,

    // Planning actions
    completeWeeklyPlan,
    saveShoppingList,
    followDailyPlan,

    // Engagement actions
    rateRecipe,
    addRecipeToFavorites,
    earnRepasPlaisir,

    // Milestones
    checkWeightMilestone,
    trackWeekendActivity,

    // Streak info
    streakInfo: getStreakInfo(),
    currentStreak,
  }
}

/**
 * Hook to display gamification rewards
 * Handles pending rewards and shows notifications
 */
export function useGamificationRewards() {
  const { pendingRewards, consumeReward, clearPendingRewards } = useGamificationStore()

  const hasRewards = pendingRewards.length > 0
  const nextReward = pendingRewards[0] || null

  const dismissReward = useCallback(() => {
    if (nextReward) {
      consumeReward(nextReward.id)
    }
  }, [nextReward, consumeReward])

  const dismissAllRewards = useCallback(() => {
    clearPendingRewards()
  }, [clearPendingRewards])

  return {
    hasRewards,
    nextReward,
    pendingRewards,
    dismissReward,
    dismissAllRewards,
  }
}

/**
 * Hook to get gamification stats for display
 */
export function useGamificationStats() {
  const {
    totalXP,
    currentLevel,
    currentStreak,
    longestStreak,
    getXPProgress,
    getLevelTitle,
    getUnlockedBadges,
    getNextBadges,
    getBadgesByCategory,
    earnedBadges,
  } = useGamificationStore()

  const xpProgress = getXPProgress()
  const levelTitle = getLevelTitle()
  const unlockedBadges = getUnlockedBadges()
  const nextBadges = getNextBadges()

  return {
    // Core stats
    totalXP,
    currentLevel,
    levelTitle,
    currentStreak,
    longestStreak,

    // XP Progress
    xpProgress,
    xpToNextLevel: xpProgress.needed - xpProgress.current,
    xpPercentage: xpProgress.percentage,

    // Badges
    unlockedBadges,
    unlockedCount: unlockedBadges.length,
    totalBadges: earnedBadges.length,
    nextBadges,
    getBadgesByCategory,
  }
}
