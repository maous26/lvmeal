/**
 * Brain Types - Shared types for all LymIA brain modules
 */

import type { UserProfile, NutritionInfo, MealType } from '../types'

export interface UserContext {
  profile: UserProfile
  todayNutrition: NutritionInfo
  weeklyAverage: NutritionInfo
  currentStreak: number
  lastMeals: string[]
  wellnessData: {
    sleepHours?: number
    stressLevel?: number
    energyLevel?: number
    hydrationLiters?: number
  }
  programProgress?: {
    type: 'metabolic_boost' | 'sport_initiation'
    phase: number
    weekInPhase: number
    completionRate: number
  }
  fastingContext?: {
    schedule: string
    isInEatingWindow: boolean
    eatingWindowStart?: number
    eatingWindowEnd?: number
    hoursUntilEatingWindow?: number
  }
}

export interface RAGDecision {
  decision: string
  reasoning: string
  confidence: number
  sources: Array<{
    content: string
    source: string
    relevance: number
  }>
  metadata?: Record<string, unknown>
}

export interface CalorieRecommendation extends RAGDecision {
  calories: number
  proteins: number
  carbs: number
  fats: number
  adjustmentReason?: string
}

export interface MealRecommendation extends RAGDecision {
  suggestions: Array<{
    name: string
    calories: number
    proteins: number
    carbs: number
    fats: number
    prepTime: number
    reason: string
  }>
  mealType: MealType
}

export interface CoachingAdvice extends RAGDecision {
  message: string
  priority: 'high' | 'medium' | 'low'
  category: 'nutrition' | 'wellness' | 'sport' | 'motivation' | 'alert'
  actionItems?: string[]
}

export interface ProgramAdaptation extends RAGDecision {
  shouldProgress: boolean
  adjustments: Array<{
    target: string
    oldValue: number
    newValue: number
    reason: string
  }>
  nextPhaseReady: boolean
}

export interface HistoryData {
  meals: Array<{ date: string; type: string; items: string[]; calories: number; proteins: number }>
  dailyTotals: Array<{ date: string; calories: number; proteins: number; carbs: number; fats: number }>
  wellness: Array<{ date: string; sleep?: number; stress?: number; energy?: number; hydration?: number }>
}

export interface HistoryAnalysis extends RAGDecision {
  patterns: string[]
  recommendations: string[]
  alerts: string[]
  summary: string
}

export interface ResultsAnalysis extends RAGDecision {
  progressSummary: string
  achievements: string[]
  areasToImprove: string[]
  nextSteps: string[]
  motivationalMessage: string
}

export interface ConnectedInsight {
  id: string
  message: string
  linkedFeatures: string[]
  actionLabel: string
  actionRoute?: string
  priority: 'high' | 'medium' | 'low'
  icon: string
}

export type ProactiveMessageType = 'macro_alert' | 'encouragement' | 'evening_summary' | 'fasting_tip' | 'goal_reminder'

export interface PersonalizedMessageContext {
  profile: UserProfile
  todayNutrition: NutritionInfo
  targetNutrition: NutritionInfo
  streak: number
  todayMealsCount: number
  wellnessData: {
    sleepHours?: number
    stressLevel?: number
    energyLevel?: number
  }
  fastingContext?: UserContext['fastingContext']
  specificContext?: Record<string, unknown>
}

export interface PersonalizedMessage {
  title: string
  body: string
  emoji: string
  isAIGenerated: boolean
  confidence?: number
}
