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
  ConversationMemory,
} from '../types/conversation'
import { useUserStore } from '../stores/user-store'
import { useCalorieStore } from '../stores/calorie-store'
import { useWellnessStore } from '../stores/wellness-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useSubscriptionStore } from '../stores/subscription-store'
import { useCoachStore } from '../stores/coach-store'
import {
  BehaviorAnalysisAgent,
  type BehaviorPattern,
  type BehaviorInsight,
} from './behavior-analysis-agent'

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

  /**
   * Generate enhanced memory object for richer context
   * Extracts preferences, patterns, and learned information
   */
  generateEnhancedMemory(history: ConversationTurn[]): ConversationMemory {
    const memory: ConversationMemory = {
      userPreferences: {
        foodLikes: [],
        foodDislikes: [],
        mealPreferences: [],
        timingPreferences: [],
      },
      patterns: {
        frequentIntents: [],
        timePatterns: [],
        triggerPatterns: [],
      },
      conversationStats: {
        totalMessages: history.length,
        averageSessionLength: 0,
        mostActiveTimeOfDay: null,
      },
      learnedFacts: [],
      lastUpdated: new Date().toISOString(),
    }

    if (history.length < 5) return memory

    // Extract user messages
    const userMessages = history.filter(t => t.role === 'user')

    // Count intents
    const intentCounts: Record<string, number> = {}
    const timeOfDayCounts: Record<string, number> = { morning: 0, midday: 0, afternoon: 0, evening: 0, night: 0 }

    for (const turn of userMessages) {
      // Count intents
      if (turn.detectedIntent?.topIntents[0]) {
        const intent = turn.detectedIntent.topIntents[0].intent
        intentCounts[intent] = (intentCounts[intent] || 0) + 1
      }

      // Count time of day
      const hour = new Date(turn.timestamp).getHours()
      if (hour >= 5 && hour < 11) timeOfDayCounts.morning++
      else if (hour >= 11 && hour < 14) timeOfDayCounts.midday++
      else if (hour >= 14 && hour < 18) timeOfDayCounts.afternoon++
      else if (hour >= 18 && hour < 22) timeOfDayCounts.evening++
      else timeOfDayCounts.night++

      // Extract food mentions and preferences
      this.extractFoodPreferences(turn.content, memory)
    }

    // Set frequent intents (those occurring more than twice)
    memory.patterns.frequentIntents = Object.entries(intentCounts)
      .filter(([_, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([intent]) => intent)

    // Set most active time of day
    const maxTimeCount = Math.max(...Object.values(timeOfDayCounts))
    memory.conversationStats.mostActiveTimeOfDay = Object.entries(timeOfDayCounts)
      .find(([_, count]) => count === maxTimeCount)?.[0] as any || null

    // Detect trigger patterns (stress → craving, fatigue → hunger, etc.)
    memory.patterns.triggerPatterns = this.detectTriggerPatterns(history)

    // Extract learned facts from conversation
    memory.learnedFacts = this.extractLearnedFacts(history)

    return memory
  }

  /**
   * Build a compact summary string from enhanced memory
   */
  buildMemorySummaryFromEnhanced(memory: ConversationMemory): string {
    const parts: string[] = []

    // User preferences
    if (memory.userPreferences.foodLikes.length > 0) {
      parts.push(`Aime: ${memory.userPreferences.foodLikes.slice(0, 3).join(', ')}`)
    }
    if (memory.userPreferences.foodDislikes.length > 0) {
      parts.push(`Évite: ${memory.userPreferences.foodDislikes.slice(0, 2).join(', ')}`)
    }

    // Patterns
    if (memory.patterns.frequentIntents.length > 0) {
      const patternMap: Record<string, string> = {
        'HUNGER': 'souvent faim',
        'CRAVING': 'envies fréquentes',
        'STRESS': 'période stressante',
        'FATIGUE': 'fatigue récurrente',
        'DOUBT': 'phase de doute',
        'CELEBRATION': 'bons résultats',
      }
      const patternDescriptions = memory.patterns.frequentIntents
        .map(i => patternMap[i])
        .filter(Boolean)
        .slice(0, 2)
      if (patternDescriptions.length > 0) {
        parts.push(`Patterns: ${patternDescriptions.join(', ')}`)
      }
    }

    // Triggers
    if (memory.patterns.triggerPatterns.length > 0) {
      parts.push(`Triggers: ${memory.patterns.triggerPatterns.slice(0, 2).join(', ')}`)
    }

    // Time preference
    if (memory.conversationStats.mostActiveTimeOfDay) {
      const timeLabels: Record<string, string> = {
        morning: 'actif le matin',
        midday: 'actif le midi',
        afternoon: 'actif l\'aprèm',
        evening: 'actif le soir',
        night: 'actif la nuit',
      }
      parts.push(timeLabels[memory.conversationStats.mostActiveTimeOfDay] || '')
    }

    // Learned facts (keep it brief)
    if (memory.learnedFacts.length > 0) {
      parts.push(memory.learnedFacts[0])
    }

    return parts.filter(p => p.length > 0).join(' | ')
  }

  /**
   * Extract food preferences from user message
   */
  private extractFoodPreferences(message: string, memory: ConversationMemory): void {
    const lowerMessage = message.toLowerCase()

    // Positive food mentions
    const likePatterns = [
      /j'aime (?:bien )?(le |la |les |du |de la |l')?([a-zàâäéèêëîïôùûüç]+)/gi,
      /j'adore (?:le |la |les |du |de la |l')?([a-zàâäéèêëîïôùûüç]+)/gi,
      /je préfère (?:le |la |les |du |de la |l')?([a-zàâäéèêëîïôùûüç]+)/gi,
    ]

    // Negative food mentions
    const dislikePatterns = [
      /je n'aime pas (?:le |la |les |du |de la |l')?([a-zàâäéèêëîïôùûüç]+)/gi,
      /je déteste (?:le |la |les |du |de la |l')?([a-zàâäéèêëîïôùûüç]+)/gi,
      /pas de ([a-zàâäéèêëîïôùûüç]+)/gi,
      /sans ([a-zàâäéèêëîïôùûüç]+)/gi,
    ]

    // Extract likes
    for (const pattern of likePatterns) {
      const matches = lowerMessage.matchAll(pattern)
      for (const match of matches) {
        const food = (match[2] || match[1])?.trim()
        if (food && food.length > 2 && !memory.userPreferences.foodLikes.includes(food)) {
          memory.userPreferences.foodLikes.push(food)
        }
      }
    }

    // Extract dislikes
    for (const pattern of dislikePatterns) {
      const matches = lowerMessage.matchAll(pattern)
      for (const match of matches) {
        const food = match[1]?.trim()
        if (food && food.length > 2 && !memory.userPreferences.foodDislikes.includes(food)) {
          memory.userPreferences.foodDislikes.push(food)
        }
      }
    }

    // Timing preferences
    if (lowerMessage.includes('repas rapide') || lowerMessage.includes('pas le temps')) {
      if (!memory.userPreferences.timingPreferences.includes('quick_meals')) {
        memory.userPreferences.timingPreferences.push('quick_meals')
      }
    }
    if (lowerMessage.includes('le soir') || lowerMessage.includes('ce soir')) {
      if (!memory.userPreferences.timingPreferences.includes('evening_focus')) {
        memory.userPreferences.timingPreferences.push('evening_focus')
      }
    }
  }

  /**
   * Detect trigger patterns (A → B correlations)
   */
  private detectTriggerPatterns(history: ConversationTurn[]): string[] {
    const triggers: string[] = []
    const userTurns = history.filter(t => t.role === 'user' && t.detectedIntent)

    // Look for patterns in consecutive messages
    for (let i = 1; i < userTurns.length; i++) {
      const prevIntent = userTurns[i - 1].detectedIntent?.topIntents[0]?.intent
      const currIntent = userTurns[i].detectedIntent?.topIntents[0]?.intent

      if (!prevIntent || !currIntent) continue

      // Detect known trigger patterns
      if (prevIntent === 'STRESS' && currIntent === 'CRAVING') {
        if (!triggers.includes('stress → envies')) triggers.push('stress → envies')
      }
      if (prevIntent === 'FATIGUE' && currIntent === 'HUNGER') {
        if (!triggers.includes('fatigue → faim')) triggers.push('fatigue → faim')
      }
      if (prevIntent === 'ANXIETY' && currIntent === 'CRAVING') {
        if (!triggers.includes('anxiété → envies')) triggers.push('anxiété → envies')
      }
      if ((prevIntent === 'DOUBT' || prevIntent === 'PLATEAU') && currIntent === 'OVERWHELM') {
        if (!triggers.includes('doute → démotivation')) triggers.push('doute → démotivation')
      }
    }

    return triggers
  }

  /**
   * Extract learned facts from conversation
   */
  private extractLearnedFacts(history: ConversationTurn[]): string[] {
    const facts: string[] = []
    const userMessages = history.filter(t => t.role === 'user').map(t => t.content.toLowerCase())

    // Check for specific patterns that reveal user facts
    for (const message of userMessages) {
      // Work schedule mentions
      if (message.includes('je travaille') && (message.includes('nuit') || message.includes('tard'))) {
        if (!facts.includes('horaires décalés')) facts.push('horaires décalés')
      }

      // Family mentions
      if (message.includes('enfant') || message.includes('famille') || message.includes('bébé')) {
        if (!facts.includes('vie de famille')) facts.push('vie de famille')
      }

      // Exercise mentions
      if (message.includes('sport') || message.includes('salle') || message.includes('course') || message.includes('musculation')) {
        if (!facts.includes('fait du sport')) facts.push('fait du sport')
      }

      // Vegetarian/vegan
      if (message.includes('végéta') || message.includes('vegan')) {
        if (!facts.includes('régime végétarien')) facts.push('régime végétarien')
      }

      // Difficulty mentions
      if (message.includes('difficile le soir') || message.includes('le soir c\'est dur')) {
        if (!facts.includes('difficultés le soir')) facts.push('difficultés le soir')
      }

      // Sweet tooth
      if (message.includes('toujours envie de sucré') || message.includes('bec sucré')) {
        if (!facts.includes('attrait pour le sucré')) facts.push('attrait pour le sucré')
      }
    }

    return facts.slice(0, 5) // Keep max 5 facts
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
    const correlations: ConversationContextFull['correlations'] = {
      sleepNutrition: [],
      stressEating: [],
      energyPatterns: [],
    }

    try {
      // Get correlation data from coach store's last coordinated analysis
      const coachStore = useCoachStore.getState()
      const lastAnalysis = coachStore.lastCoordinatedAnalysis

      if (lastAnalysis) {
        // Extract correlations from connected insights
        for (const insight of lastAnalysis.connectedInsights) {
          const insightLower = insight.toLowerCase()

          // Detect sleep-nutrition correlations
          if (insightLower.includes('sommeil') && (insightLower.includes('calorie') || insightLower.includes('faim') || insightLower.includes('nutrition'))) {
            correlations.sleepNutrition.push({
              id: `sleep_nutrition_${Date.now()}`,
              type: 'correlation',
              description: insight,
              confidence: 0.8,
              detectedAt: new Date().toISOString(),
            })
          }

          // Detect stress-eating correlations
          if (insightLower.includes('stress') && (insightLower.includes('manger') || insightLower.includes('envie') || insightLower.includes('craving') || insightLower.includes('sucre'))) {
            correlations.stressEating.push({
              id: `stress_eating_${Date.now()}`,
              type: 'stress_eating',
              description: insight,
              confidence: 0.85,
              detectedAt: new Date().toISOString(),
            })
          }

          // Detect energy patterns
          if (insightLower.includes('énergie') || insightLower.includes('fatigue')) {
            correlations.energyPatterns.push({
              id: `energy_pattern_${Date.now()}`,
              type: 'energy_correlation',
              description: insight,
              confidence: 0.75,
              detectedAt: new Date().toISOString(),
            })
          }
        }
      }

      // Also check coach items for behavior patterns
      const coachItems = coachStore.items
      for (const item of coachItems) {
        if (!item.linkedFeatures) continue

        // Items with sleep + nutrition linked features
        if (item.linkedFeatures.includes('sleep') && item.linkedFeatures.includes('nutrition')) {
          if (!correlations.sleepNutrition.some(c => c.description === item.message)) {
            correlations.sleepNutrition.push({
              id: `coach_sleep_${item.id}`,
              type: 'correlation',
              description: item.message,
              confidence: item.confidence || 0.7,
              detectedAt: item.createdAt,
            })
          }
        }

        // Items with stress linked
        if (item.linkedFeatures.includes('stress') && item.category === 'nutrition') {
          if (!correlations.stressEating.some(c => c.description === item.message)) {
            correlations.stressEating.push({
              id: `coach_stress_${item.id}`,
              type: 'stress_eating',
              description: item.message,
              confidence: item.confidence || 0.7,
              detectedAt: item.createdAt,
            })
          }
        }
      }
    } catch (error) {
      console.warn('[ContextService] Could not fetch correlations from coach store:', error)
    }

    return correlations
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
