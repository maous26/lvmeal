/**
 * Conversation Context Aggregator Service (Recommendation #1)
 *
 * Aggregates user state from all stores into:
 * 1. Full context (local, for decision making)
 * 2. Compact context (for LLM, minimal tokens)
 *
 * Also generates memory summaries for long conversations.
 */

import {
  ConversationContextFull,
  ConversationContextCompact,
  ConversationTurn,
  CompactTurn,
  MoodType,
  MealEntry,
  CorrelationInsight,
} from '../types/conversation'
import { useUserStore } from '../stores/user-store'
import { useCalorieStore } from '../stores/calorie-store'
import { useWellnessStore } from '../stores/wellness-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useSubscriptionStore } from '../stores/subscription-store'

// ============================================================================
// CONTEXT AGGREGATOR SERVICE
// ============================================================================

class ConversationContextService {
  /**
   * Build full context from all stores
   */
  buildFullContext(conversationHistory: ConversationTurn[]): ConversationContextFull {
    const userStore = useUserStore.getState()
    const calorieStore = useCalorieStore.getState()
    const gamificationStore = useGamificationStore.getState()
    const subscriptionStore = useSubscriptionStore.getState()

    // Get wellness data (may not have a store yet, use defaults)
    const wellnessData = this.getWellnessData()

    // Calculate temporal signals
    const temporal = this.calculateTemporalSignals(calorieStore)

    // Get correlations (simplified - would come from correlation service)
    const correlations = this.getCorrelations()

    // Get program data (simplified - would come from wellness program store)
    const program = this.getProgramData()

    const context: ConversationContextFull = {
      nutrition: {
        caloriesConsumed: calorieStore.totalCalories || 0,
        caloriesRemaining: Math.max(0, (calorieStore.calorieTarget || 2000) - (calorieStore.totalCalories || 0)),
        caloriesTarget: calorieStore.calorieTarget || 2000,
        macroBalance: {
          proteins: calorieStore.totalProtein || 0,
          carbs: calorieStore.totalCarbs || 0,
          fats: calorieStore.totalFat || 0,
        },
        macroTargets: {
          proteins: Math.round((calorieStore.calorieTarget || 2000) * 0.25 / 4), // 25% protein
          carbs: Math.round((calorieStore.calorieTarget || 2000) * 0.45 / 4),    // 45% carbs
          fats: Math.round((calorieStore.calorieTarget || 2000) * 0.30 / 9),     // 30% fat
        },
        lastMealTime: this.getLastMealTime(calorieStore.meals),
        todayMeals: this.formatMeals(calorieStore.meals || []),
        weeklyTrend: this.calculateWeeklyTrend(calorieStore),
        avgCaloriesLast7Days: this.calculateAvgCalories(calorieStore),
      },

      wellness: {
        currentMood: wellnessData.mood,
        sleepLastNight: wellnessData.sleep,
        stressLevel: wellnessData.stress,
        energyLevel: wellnessData.energy,
        hydration: wellnessData.hydration,
        weight: userStore.profile?.weight || null,
        weightTrend: this.calculateWeightTrend(userStore),
      },

      correlations,

      program,

      gamification: {
        currentStreak: gamificationStore.streak || 0,
        level: gamificationStore.level || 1,
        xp: gamificationStore.xp || 0,
        xpToNextLevel: this.calculateXpToNextLevel(gamificationStore.level || 1, gamificationStore.xp || 0),
        activeChallenge: this.getActiveChallenge(gamificationStore),
        recentAchievements: this.getRecentAchievements(gamificationStore),
      },

      conversationHistoryFull: conversationHistory,

      temporal,

      user: {
        firstName: userStore.profile?.firstName || null,
        isPremium: subscriptionStore.isPremium,
        daysInApp: this.calculateDaysInApp(userStore),
        preferredLanguage: 'fr',
      },
    }

    return context
  }

  /**
   * Build compact context for LLM (Recommendation #1)
   * Only last 3 turns + minimal data
   */
  buildCompactContext(
    fullContext: ConversationContextFull,
    memorySummary?: string
  ): ConversationContextCompact {
    // Take only last 3 turns
    const recentTurns = fullContext.conversationHistoryFull.slice(-3)
    const compactHistory: CompactTurn[] = recentTurns.map(turn => ({
      r: turn.role === 'user' ? 'U' : 'A',
      m: turn.content.substring(0, 150), // Truncate long messages
    }))

    // Map time of day
    const todMap: Record<string, 'M' | 'D' | 'A' | 'E' | 'N'> = {
      morning: 'M',
      midday: 'D',
      afternoon: 'A',
      evening: 'E',
      night: 'N',
    }

    // Map trend
    const trendMap: Record<string, 'D' | 'B' | 'S'> = {
      deficit: 'D',
      balanced: 'B',
      surplus: 'S',
    }

    const compact: ConversationContextCompact = {
      n: {
        cal: fullContext.nutrition.caloriesRemaining,
        lastMeal: `${fullContext.temporal.hoursSinceLastMeal}h`,
        trend: trendMap[fullContext.nutrition.weeklyTrend] || 'B',
      },

      w: {
        mood: fullContext.wellness.currentMood,
        energy: fullContext.wellness.energyLevel,
        sleep: fullContext.wellness.sleepLastNight?.hours || null,
      },

      c: {
        stressEat: fullContext.correlations.stressEating.length > 0,
        sleepImpact: fullContext.correlations.sleepNutrition.length > 0,
      },

      h: compactHistory,

      t: {
        tod: todMap[fullContext.temporal.timeOfDay] || 'D',
        we: fullContext.temporal.isWeekend,
      },
    }

    // Add memory summary if exists
    if (memorySummary) {
      compact.mem = memorySummary
    }

    return compact
  }

  /**
   * Generate memory summary from conversation history
   * Called periodically to summarize long conversations
   */
  generateMemorySummary(history: ConversationTurn[]): string | undefined {
    if (history.length < 10) return undefined

    // Extract key themes from conversation
    const themes: string[] = []
    const intents = history
      .filter(t => t.role === 'user' && t.detectedIntent)
      .map(t => t.detectedIntent!.topIntents[0].intent)

    // Count intent occurrences
    const intentCounts: Record<string, number> = {}
    for (const intent of intents) {
      intentCounts[intent] = (intentCounts[intent] || 0) + 1
    }

    // Build summary based on patterns
    if (intentCounts.STRESS > 2 || intentCounts.ANXIETY > 1) {
      themes.push('période stressante')
    }
    if (intentCounts.HUNGER > 3) {
      themes.push('faim fréquente')
    }
    if (intentCounts.FATIGUE > 2) {
      themes.push('fatigue récurrente')
    }
    if (intentCounts.CRAVING > 2) {
      themes.push('envies régulières')
    }
    if (intentCounts.DOUBT > 1 || intentCounts.PLATEAU > 1) {
      themes.push('phase de doute')
    }
    if (intentCounts.CELEBRATION > 1) {
      themes.push('bons résultats récents')
    }

    if (themes.length === 0) return undefined

    return `Conversation récente: ${themes.join(', ')}`
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private getWellnessData(): {
    mood: MoodType | null
    sleep: { hours: number; quality: 'poor' | 'fair' | 'good' | 'excellent' } | null
    stress: number | null
    energy: number | null
    hydration: number
  } {
    // Try to get from wellness store if it exists
    try {
      const wellnessStore = useWellnessStore.getState()
      return {
        mood: (wellnessStore as any).currentMood || null,
        sleep: (wellnessStore as any).lastSleep || null,
        stress: (wellnessStore as any).stressLevel || null,
        energy: (wellnessStore as any).energyLevel || null,
        hydration: (wellnessStore as any).hydration || 0,
      }
    } catch {
      // Wellness store might not exist yet
      return {
        mood: null,
        sleep: null,
        stress: null,
        energy: null,
        hydration: 0,
      }
    }
  }

  private calculateTemporalSignals(calorieStore: any): ConversationContextFull['temporal'] {
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()

    let timeOfDay: 'morning' | 'midday' | 'afternoon' | 'evening' | 'night'
    if (hour >= 5 && hour < 11) timeOfDay = 'morning'
    else if (hour >= 11 && hour < 14) timeOfDay = 'midday'
    else if (hour >= 14 && hour < 18) timeOfDay = 'afternoon'
    else if (hour >= 18 && hour < 22) timeOfDay = 'evening'
    else timeOfDay = 'night'

    // Calculate hours since last meal
    const meals = calorieStore.meals || []
    let hoursSinceLastMeal = 4 // Default
    if (meals.length > 0) {
      const lastMeal = meals[meals.length - 1]
      if (lastMeal.timestamp) {
        const lastMealTime = new Date(lastMeal.timestamp)
        hoursSinceLastMeal = Math.round((now.getTime() - lastMealTime.getTime()) / (1000 * 60 * 60))
      }
    }

    return {
      timeOfDay,
      dayOfWeek,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      hoursSinceLastMeal: Math.max(0, Math.min(24, hoursSinceLastMeal)),
      hoursSinceWakeup: null, // Would need sleep tracking
      currentHour: hour,
    }
  }

  private getLastMealTime(meals: any[]): string | null {
    if (!meals || meals.length === 0) return null
    const lastMeal = meals[meals.length - 1]
    return lastMeal.timestamp || lastMeal.loggedAt || null
  }

  private formatMeals(meals: any[]): MealEntry[] {
    return meals.map(meal => ({
      id: meal.id || String(Math.random()),
      name: meal.name || meal.foodName || 'Repas',
      calories: meal.calories || 0,
      mealType: meal.mealType || 'snack',
      loggedAt: meal.timestamp || meal.loggedAt || new Date().toISOString(),
    }))
  }

  private calculateWeeklyTrend(calorieStore: any): 'deficit' | 'balanced' | 'surplus' {
    // Simplified - would need historical data
    const consumed = calorieStore.totalCalories || 0
    const target = calorieStore.calorieTarget || 2000
    const ratio = consumed / target

    if (ratio < 0.9) return 'deficit'
    if (ratio > 1.1) return 'surplus'
    return 'balanced'
  }

  private calculateAvgCalories(calorieStore: any): number {
    // Simplified - would need historical data
    return calorieStore.totalCalories || 0
  }

  private calculateWeightTrend(userStore: any): 'losing' | 'stable' | 'gaining' | null {
    // Would need historical weight data
    return null
  }

  private getCorrelations(): ConversationContextFull['correlations'] {
    // Simplified - would come from correlation service
    // In production, this would analyze actual user data
    return {
      sleepNutrition: [],
      stressEating: [],
      energyPatterns: [],
    }
  }

  private getProgramData(): ConversationContextFull['program'] {
    // Simplified - would come from wellness program store
    try {
      const wellnessStore = useWellnessStore.getState()
      return {
        currentPhase: (wellnessStore as any).currentPhase || null,
        dayInPhase: (wellnessStore as any).dayInPhase || 0,
        phaseProgress: (wellnessStore as any).progress || 0,
        upcomingMilestone: null,
        totalDaysInProgram: (wellnessStore as any).totalDays || 0,
      }
    } catch {
      return {
        currentPhase: null,
        dayInPhase: 0,
        phaseProgress: 0,
        upcomingMilestone: null,
        totalDaysInProgram: 0,
      }
    }
  }

  private calculateXpToNextLevel(level: number, xp: number): number {
    const xpForLevel = (lvl: number) => Math.floor(100 * Math.pow(1.5, lvl - 1))
    return xpForLevel(level + 1) - xp
  }

  private getActiveChallenge(gamificationStore: any): any {
    // Would get active challenge from gamification store
    return gamificationStore.activeChallenge || null
  }

  private getRecentAchievements(gamificationStore: any): any[] {
    // Would get recent achievements
    return gamificationStore.recentAchievements || []
  }

  private calculateDaysInApp(userStore: any): number {
    const createdAt = userStore.profile?.createdAt
    if (!createdAt) return 1
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(1, days)
  }
}

// Export singleton
export const conversationContextService = new ConversationContextService()
