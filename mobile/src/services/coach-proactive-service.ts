/**
 * Coach Proactive Notification Service
 *
 * Envoie des notifications intelligentes basees sur le contexte:
 * - Rappels de repas si objectifs non atteints
 * - Alertes macros desequilibres
 * - Encouragements bases sur les progres
 * - Conseils personnalises selon le jeune intermittent
 *
 * Differents des daily-insights (1x/jour a 9h):
 * - Coach proactif analyse en temps reel
 * - Notifications contextuelles a des moments cles
 */

import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  buildFastingContext,
  isInEatingWindow,
  generatePersonalizedMessage,
  type ProactiveMessageType,
  type PersonalizedMessageContext,
} from './lymia-brain'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useWellnessStore } from '../stores/wellness-store'
import { useMessageCenter, type MessagePriority, type MessageType, type MessageCategory } from './message-center'
import { SuperAgent, type SuperAgentContext } from './super-agent'
import type { UserProfile, NutritionInfo, MealType, WellnessEntry } from '../types'

// Storage keys
const STORAGE_KEYS = {
  COACH_NOTIFS_ENABLED: '@lym_coach_notifs_enabled',
  LAST_MACRO_ALERT_DATE: '@lym_last_macro_alert_date',
  LAST_ENCOURAGEMENT_DATE: '@lym_last_encouragement_date',
  COACH_NOTIFICATION_IDS: '@lym_coach_notification_ids',
}

// Types de notifications Coach
export type CoachNotificationType =
  | 'macro_alert'      // Macros desequilibres
  | 'goal_reminder'    // Rappel objectif proche
  | 'encouragement'    // Encouragement progres
  | 'fasting_tip'      // Conseil jeune
  | 'evening_summary'  // Resume du soir

// Configuration des heures de notification
const NOTIFICATION_TIMES = {
  macro_check: 14,     // 14h - verification mi-journee
  evening_summary: 20, // 20h - resume du soir
  encouragement: 12,   // Midi - encouragement
}

// NOTE: Templates supprimés - TOUS les messages sont maintenant générés par l'IA
// via generatePersonalizedMessage() dans lymia-brain.ts
// Cela garantit des messages 100% personnalisés et uniques

/**
 * Analyse la nutrition du jour et determine si une alerte est necessaire
 * Retourne seulement le type d'alerte - le message est genere par l'IA
 */
function analyzeNutrition(
  consumed: NutritionInfo,
  target: NutritionInfo,
  currentHour: number
): { type: string } | null {
  // Ne pas alerter trop tot dans la journee
  if (currentHour < 12) return null

  const caloriePercent = (consumed.calories / target.calories) * 100
  const proteinPercent = (consumed.proteins / target.proteins) * 100

  // Si on est l'apres-midi et les proteines sont tres basses
  if (currentHour >= 14 && proteinPercent < 30) {
    return { type: 'low_protein' }
  }

  // Si on est l'apres-midi et les calories sont tres basses
  if (currentHour >= 14 && caloriePercent < 25) {
    return { type: 'low_calories' }
  }

  // Si les glucides sont trop eleves (> 60% des macros)
  const totalMacros = consumed.proteins + consumed.carbs + consumed.fats
  if (totalMacros > 0) {
    const carbRatio = consumed.carbs / totalMacros
    if (carbRatio > 0.65 && consumed.carbs > 100) {
      return { type: 'high_carbs' }
    }
  }

  return null
}

/**
 * Map coach notification type to MessageCenter priority and type
 */
function mapToMessageCenterConfig(notifType: CoachNotificationType): {
  priority: MessagePriority
  type: MessageType
  category: MessageCategory
} {
  switch (notifType) {
    case 'macro_alert':
      return { priority: 'P1', type: 'action', category: 'nutrition' }
    case 'goal_reminder':
      return { priority: 'P2', type: 'tip', category: 'nutrition' }
    case 'encouragement':
      return { priority: 'P2', type: 'celebration', category: 'progress' }
    case 'fasting_tip':
      return { priority: 'P3', type: 'tip', category: 'wellness' }
    case 'evening_summary':
      return { priority: 'P3', type: 'insight', category: 'nutrition' }
    default:
      return { priority: 'P3', type: 'tip', category: 'wellness' }
  }
}

/**
 * Add message to MessageCenter (sync with notifications)
 */
function addToMessageCenter(
  notifType: CoachNotificationType,
  title: string,
  body: string,
  dedupKey: string,
  emoji?: string,
  actionRoute?: string,
  actionLabel?: string
): void {
  const config = mapToMessageCenterConfig(notifType)
  const messageCenter = useMessageCenter.getState()

  messageCenter.addMessage({
    priority: config.priority,
    type: config.type,
    category: config.category,
    title,
    message: body,
    emoji,
    reason: `Coach proactif: ${notifType}`,
    confidence: 0.8,
    dedupKey,
    actionRoute: actionRoute || 'Coach',
    actionLabel,
  })
}

// ============= EVENING ANALYSIS GENERATION =============

interface EveningAnalysis {
  title: string
  body: string
  emoji: string
  highlights: string[]
  caloriesConsumed: number
  caloriesTarget: number
  percentAchieved: number
}

/**
 * Generate a real AI-powered evening summary analysis
 * Collects today's data and generates personalized insights
 */
async function generateEveningSummaryAnalysis(profile: UserProfile): Promise<EveningAnalysis> {
  try {
    // Collect today's data
    const mealsState = useMealsStore.getState()
    const wellnessState = useWellnessStore.getState()
    const gamificationState = useGamificationStore.getState()
    const userState = useUserStore.getState()

    const today = new Date().toISOString().split('T')[0]
    const todayData = mealsState.dailyData[today]

    // Calculate today's nutrition
    let todayNutrition: NutritionInfo = { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    const todayMeals = todayData?.meals || []

    if (todayMeals.length > 0) {
      todayNutrition = todayMeals.reduce(
        (acc, meal) => ({
          calories: acc.calories + (meal.totalNutrition?.calories || 0),
          proteins: acc.proteins + (meal.totalNutrition?.proteins || 0),
          carbs: acc.carbs + (meal.totalNutrition?.carbs || 0),
          fats: acc.fats + (meal.totalNutrition?.fats || 0),
        }),
        { calories: 0, proteins: 0, carbs: 0, fats: 0 }
      )
    }

    // Get goals
    const goals = userState.nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 70 }
    const percentCalories = Math.round((todayNutrition.calories / goals.calories) * 100)
    const percentProteins = Math.round((todayNutrition.proteins / goals.proteins) * 100)

    // Get wellness data
    const wellnessEntries = Object.values(wellnessState.entries || {}) as WellnessEntry[]
    const todayWellness = wellnessEntries.find(w => w.date === today)

    // Get streak
    const streak = gamificationState.currentStreak || 0

    // Build highlights based on data
    const highlights: string[] = []

    // Calorie highlight
    if (percentCalories >= 90 && percentCalories <= 110) {
      highlights.push(`✅ Objectif calorique atteint (${percentCalories}%)`)
    } else if (percentCalories < 70) {
      highlights.push(`⚠️ Apport calorique faible (${percentCalories}%)`)
    } else if (percentCalories > 120) {
      highlights.push(`📊 Apport calorique élevé (${percentCalories}%)`)
    } else {
      highlights.push(`📊 ${todayNutrition.calories} kcal sur ${goals.calories}`)
    }

    // Protein highlight
    if (percentProteins >= 90) {
      highlights.push(`💪 Protéines: ${todayNutrition.proteins}g (objectif atteint!)`)
    } else if (percentProteins < 50) {
      highlights.push(`⚠️ Protéines insuffisantes: ${todayNutrition.proteins}g/${goals.proteins}g`)
    }

    // Meals tracked
    if (todayMeals.length > 0) {
      highlights.push(`🍽️ ${todayMeals.length} repas tracké${todayMeals.length > 1 ? 's' : ''}`)
    } else {
      highlights.push(`📝 Aucun repas tracké aujourd'hui`)
    }

    // Streak highlight
    if (streak >= 3) {
      highlights.push(`🔥 Série de ${streak} jours!`)
    }

    // Wellness highlight
    if (todayWellness) {
      if (todayWellness.sleepHours && todayWellness.sleepHours >= 7) {
        highlights.push(`😴 Bon sommeil: ${todayWellness.sleepHours}h`)
      }
      if (todayWellness.stressLevel && todayWellness.stressLevel <= 3) {
        highlights.push(`😌 Stress bien géré`)
      }
    }

    // Try to get AI-powered analysis from SuperAgent
    let aiBody = ''
    try {
      // Build context for SuperAgent
      const dates: string[] = []
      for (let i = 0; i < 7; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        dates.push(date.toISOString().split('T')[0])
      }

      const weeklyNutrition: NutritionInfo[] = dates.map(date => {
        const dayData = mealsState.dailyData[date]
        if (!dayData?.meals || dayData.meals.length === 0) {
          return { calories: 0, proteins: 0, carbs: 0, fats: 0 }
        }
        return dayData.meals.reduce(
          (acc, meal) => ({
            calories: acc.calories + (meal.totalNutrition?.calories || 0),
            proteins: acc.proteins + (meal.totalNutrition?.proteins || 0),
            carbs: acc.carbs + (meal.totalNutrition?.carbs || 0),
            fats: acc.fats + (meal.totalNutrition?.fats || 0),
          }),
          { calories: 0, proteins: 0, carbs: 0, fats: 0 }
        )
      })

      const recentWellness = wellnessEntries.filter(w => dates.includes(w.date))

      const context: SuperAgentContext = {
        profile,
        meals: todayMeals,
        todayNutrition,
        weeklyNutrition,
        wellnessEntries: recentWellness,
        todayWellness,
        fastingContext: buildFastingContext(profile),
        streak,
        level: gamificationState.currentLevel || 1,
        xp: gamificationState.totalXP || 0,
        daysTracked: dates.filter(d => mealsState.dailyData[d]?.meals?.length > 0).length,
      }

      const insight = await SuperAgent.generateDailyInsight(context)
      if (insight?.body) {
        aiBody = insight.body
      }
    } catch (aiError) {
      console.log('[CoachProactive] AI analysis not available, using structured summary')
    }

    // Determine title and emoji based on performance
    let title: string
    let emoji: string

    if (todayMeals.length === 0) {
      title = 'Journée sans tracking'
      emoji = '📝'
    } else if (percentCalories >= 85 && percentCalories <= 115 && percentProteins >= 80) {
      title = 'Excellente journée!'
      emoji = '🎉'
    } else if (percentCalories >= 70 && percentCalories <= 130) {
      title = 'Bonne journée'
      emoji = '👍'
    } else {
      title = 'Bilan de ta journée'
      emoji = '📊'
    }

    // Build the body message
    let body: string
    if (aiBody) {
      body = aiBody
    } else {
      // Fallback to structured summary
      if (todayMeals.length === 0) {
        body = 'Tu n\'as pas tracké de repas aujourd\'hui. Demain est une nouvelle opportunité!'
      } else if (percentCalories >= 85 && percentCalories <= 115) {
        body = `Super! Tu as consommé ${todayNutrition.calories} kcal sur ${goals.calories} (${percentCalories}%). Continue comme ça!`
      } else if (percentCalories < 70) {
        body = `Tu as consommé ${todayNutrition.calories} kcal aujourd'hui, soit ${percentCalories}% de ton objectif. Pense à bien te nourrir.`
      } else {
        body = `Aujourd'hui: ${todayNutrition.calories} kcal, ${todayNutrition.proteins}g protéines. ${percentCalories}% de ton objectif atteint.`
      }
    }

    return {
      title,
      body,
      emoji,
      highlights,
      caloriesConsumed: Math.round(todayNutrition.calories),
      caloriesTarget: goals.calories,
      percentAchieved: percentCalories,
    }
  } catch (error) {
    console.error('[CoachProactive] Error generating evening analysis:', error)
    // Return fallback
    return {
      title: 'Bilan du jour',
      body: 'Consulte tes progrès dans l\'onglet Progrès.',
      emoji: '📊',
      highlights: [],
      caloriesConsumed: 0,
      caloriesTarget: 2000,
      percentAchieved: 0,
    }
  }
}

/**
 * Schedule evening summary notification with AI-powered analysis
 */
export async function scheduleEveningSummary(profile: UserProfile): Promise<void> {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.COACH_NOTIFS_ENABLED)
    if (enabled === 'false') return

    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return

    // Get fasting config to adjust timing
    const fastingConfig = profile.lifestyleHabits?.fasting
    let summaryHour = NOTIFICATION_TIMES.evening_summary

    // If user has fasting with eating window, schedule near end of window
    if (fastingConfig && fastingConfig.schedule !== 'none' && fastingConfig.eatingWindowEnd) {
      summaryHour = Math.min(fastingConfig.eatingWindowEnd, 21)
    }

    const now = new Date()
    if (now.getHours() >= summaryHour) return // Already past summary time

    const triggerDate = new Date(now)
    triggerDate.setHours(summaryHour, 0, 0, 0)

    // Generate AI-powered analysis
    const analysis = await generateEveningSummaryAnalysis(profile)

    const title = `${analysis.emoji} ${analysis.title}`
    const body = analysis.body

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'coach_proactive',
          subtype: 'evening_summary',
          deepLink: 'lym://coach',
          analysis: JSON.stringify({
            highlights: analysis.highlights,
            caloriesConsumed: analysis.caloriesConsumed,
            caloriesTarget: analysis.caloriesTarget,
            percentAchieved: analysis.percentAchieved,
          }),
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    })

    // Add detailed analysis to MessageCenter so it appears in Coach screen
    const today = new Date().toDateString()
    const highlightsText = analysis.highlights.length > 0
      ? `\n\n${analysis.highlights.join('\n')}`
      : ''
    const fullMessage = `${body}${highlightsText}`

    addToMessageCenter(
      'evening_summary',
      analysis.title,
      fullMessage,
      `evening-summary-${today}`,
      analysis.emoji,
      'Progress', // Route to Progress screen to see detailed analysis
      'Voir l\'analyse'
    )

    // Save notification ID
    const existingIds = await getScheduledNotificationIds()
    existingIds.push(id)
    await AsyncStorage.setItem(STORAGE_KEYS.COACH_NOTIFICATION_IDS, JSON.stringify(existingIds))

    console.log(`[CoachProactive] Evening summary scheduled for ${triggerDate.toLocaleTimeString()}`)
    console.log(`[CoachProactive] Analysis: ${analysis.title} - ${analysis.percentAchieved}% achieved`)
  } catch (error) {
    console.error('[CoachProactive] Error scheduling evening summary:', error)
  }
}

/**
 * Check and send macro alert if needed
 */
export async function checkAndSendMacroAlert(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.COACH_NOTIFS_ENABLED)
    if (enabled === 'false') return false

    // Check if already sent today
    const lastAlertDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_MACRO_ALERT_DATE)
    const today = new Date().toDateString()
    if (lastAlertDate === today) return false

    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return false

    const userState = useUserStore.getState()
    const mealsState = useMealsStore.getState()

    const profile = userState.profile as UserProfile | null
    if (!profile) return false

    // Check if user is in eating window (don't alert during fasting)
    const fastingConfig = profile.lifestyleHabits?.fasting
    if (fastingConfig && fastingConfig.schedule !== 'none') {
      const inWindow = isInEatingWindow(
        fastingConfig.eatingWindowStart,
        fastingConfig.eatingWindowEnd
      )
      if (!inWindow) {
        console.log('[CoachProactive] User is fasting, skipping macro alert')
        return false
      }
    }

    // Get today's nutrition
    const todayStr = new Date().toISOString().split('T')[0]
    const todayData = mealsState.dailyData[todayStr]

    // Ne pas alerter si l'utilisateur n'a pas encore enregistré de repas aujourd'hui
    // Envoyer des alertes à quelqu'un qui n'a pas utilisé l'app ne sert à rien
    const todayMealsCount = todayData?.meals?.length || 0
    if (todayMealsCount === 0) {
      console.log('[CoachProactive] No meals logged today, skipping macro alert')
      return false
    }

    const consumed: NutritionInfo = todayData?.meals?.reduce(
      (acc, meal) => ({
        calories: acc.calories + (meal.totalNutrition?.calories || 0),
        proteins: acc.proteins + (meal.totalNutrition?.proteins || 0),
        carbs: acc.carbs + (meal.totalNutrition?.carbs || 0),
        fats: acc.fats + (meal.totalNutrition?.fats || 0),
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    ) || { calories: 0, proteins: 0, carbs: 0, fats: 0 }

    const target = profile.nutritionalNeeds || {
      calories: 2000,
      proteins: 100,
      carbs: 250,
      fats: 70,
    }

    const currentHour = new Date().getHours()
    const alertType = analyzeNutrition(consumed, target, currentHour)

    if (!alertType) return false

    // Generate AI-personalized message (NO templates)
    const messageContext: PersonalizedMessageContext = {
      profile,
      todayNutrition: consumed,
      targetNutrition: target,
      streak: useGamificationStore.getState().currentStreak || 0,
      todayMealsCount: todayData?.meals?.length || 0,
      specificContext: { alertType: alertType.type },
    }

    const aiMessage = await generatePersonalizedMessage('macro_alert', messageContext)

    // Use AI message or minimal fallback (never templates)
    const title = aiMessage?.title || 'Conseil nutrition'
    const body = aiMessage?.body || `Pense à équilibrer ton prochain repas 🍽️`
    const emoji = aiMessage?.emoji || '🥗'

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${title}`,
        body,
        data: {
          type: 'coach_proactive',
          subtype: 'macro_alert',
          alertType: alertType.type,
          deepLink: 'lym://home',
          isAIGenerated: aiMessage?.isAIGenerated || false,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null, // Immediate
    })

    // Add to MessageCenter for Coach screen
    addToMessageCenter('macro_alert', title, body, `macro-alert-${alertType.type}-${today}`, emoji)

    await AsyncStorage.setItem(STORAGE_KEYS.LAST_MACRO_ALERT_DATE, today)
    console.log('[CoachProactive] Sent AI-personalized macro alert:', alertType.type, aiMessage?.isAIGenerated ? '(AI)' : '(fallback)')
    return true
  } catch (error) {
    console.error('[CoachProactive] Error checking macros:', error)
    return false
  }
}

/**
 * Send encouragement notification based on serie/progress
 */
export async function sendEncouragementIfDeserved(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.COACH_NOTIFS_ENABLED)
    if (enabled === 'false') return false

    // Check if already sent today
    const lastDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ENCOURAGEMENT_DATE)
    const today = new Date().toDateString()
    if (lastDate === today) return false

    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return false

    const gamificationState = useGamificationStore.getState()
    const userState = useUserStore.getState()
    const mealsState = useMealsStore.getState()

    const streak = gamificationState.currentStreak || 0
    const level = gamificationState.currentLevel || 1
    const xp = gamificationState.totalXP || 0
    const profile = userState.profile as UserProfile | null

    // Determine if encouragement is deserved
    let milestoneType: 'streak' | 'level' | null = null
    let days = streak

    // Milestones de jours consecutifs: 3, 7, 14, 21, 30, etc.
    const serieMilestones = [3, 7, 14, 21, 30, 60, 90]
    if (serieMilestones.includes(streak)) {
      milestoneType = 'streak'
    }

    // Level up celebration
    if (level > 1 && xp % 1000 < 100) {
      milestoneType = 'level'
    }

    if (!milestoneType || !profile) return false

    // Get today's nutrition for context
    const todayStr = new Date().toISOString().split('T')[0]
    const todayData = mealsState.dailyData[todayStr]
    const todayNutrition: NutritionInfo = todayData?.meals?.reduce(
      (acc, meal) => ({
        calories: acc.calories + (meal.totalNutrition?.calories || 0),
        proteins: acc.proteins + (meal.totalNutrition?.proteins || 0),
        carbs: acc.carbs + (meal.totalNutrition?.carbs || 0),
        fats: acc.fats + (meal.totalNutrition?.fats || 0),
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    ) || { calories: 0, proteins: 0, carbs: 0, fats: 0 }

    const targetNutrition = profile.nutritionalNeeds || { calories: 2000, proteins: 100, carbs: 250, fats: 70 }

    // Generate AI-personalized encouragement (NO templates)
    const messageContext: PersonalizedMessageContext = {
      profile,
      todayNutrition,
      targetNutrition,
      streak,
      todayMealsCount: todayData?.meals?.length || 0,
      specificContext: { milestoneType, days, level, xp },
    }

    const aiMessage = await generatePersonalizedMessage('encouragement', messageContext)

    // Use AI message or minimal fallback
    const title = aiMessage?.title || 'Bravo !'
    const body = aiMessage?.body || `${days} jours de suite, continue comme ça !`
    const emoji = aiMessage?.emoji || '🎉'

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${title}`,
        body,
        data: {
          type: 'coach_proactive',
          subtype: 'encouragement',
          deepLink: 'lym://home',
          isAIGenerated: aiMessage?.isAIGenerated || false,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    })

    // Add to MessageCenter for Coach screen
    addToMessageCenter('encouragement', title, body, `encouragement-${today}`, emoji)

    await AsyncStorage.setItem(STORAGE_KEYS.LAST_ENCOURAGEMENT_DATE, today)
    console.log('[CoachProactive] Sent AI-personalized encouragement:', milestoneType, aiMessage?.isAIGenerated ? '(AI)' : '(fallback)')
    return true
  } catch (error) {
    console.error('[CoachProactive] Error sending encouragement:', error)
    return false
  }
}

/**
 * Send fasting tip notification
 */
export async function sendFastingTip(profile: UserProfile): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.COACH_NOTIFS_ENABLED)
    if (enabled === 'false') return false

    const fastingConfig = profile.lifestyleHabits?.fasting
    if (!fastingConfig || fastingConfig.schedule === 'none') return false

    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') return false

    const currentHour = new Date().getHours()
    const windowStart = fastingConfig.eatingWindowStart ?? 12
    const windowEnd = fastingConfig.eatingWindowEnd ?? 20

    let tipType: string | null = null

    // Near eating window start (within 30 minutes)
    if (currentHour === windowStart) {
      tipType = 'eating_window_start'
    }
    // Near eating window end (1 hour before)
    else if (currentHour === windowEnd - 1) {
      tipType = 'eating_window_end'
    }
    // During fasting period (mid-morning for 16:8)
    else if (currentHour === 10 && !isInEatingWindow(windowStart, windowEnd)) {
      tipType = 'fasting_period'
    }

    if (!tipType) return false

    // Get today's nutrition for context
    const mealsState = useMealsStore.getState()
    const gamificationState = useGamificationStore.getState()
    const todayStr = new Date().toISOString().split('T')[0]
    const todayData = mealsState.dailyData[todayStr]

    const todayNutrition: NutritionInfo = todayData?.meals?.reduce(
      (acc, meal) => ({
        calories: acc.calories + (meal.totalNutrition?.calories || 0),
        proteins: acc.proteins + (meal.totalNutrition?.proteins || 0),
        carbs: acc.carbs + (meal.totalNutrition?.carbs || 0),
        fats: acc.fats + (meal.totalNutrition?.fats || 0),
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    ) || { calories: 0, proteins: 0, carbs: 0, fats: 0 }

    const targetNutrition = profile.nutritionalNeeds || { calories: 2000, proteins: 100, carbs: 250, fats: 70 }

    // Generate AI-personalized fasting tip (NO templates)
    const messageContext: PersonalizedMessageContext = {
      profile,
      todayNutrition,
      targetNutrition,
      streak: gamificationState.currentStreak || 0,
      todayMealsCount: todayData?.meals?.length || 0,
      fastingContext: {
        schedule: fastingConfig.schedule,
        isInEatingWindow: isInEatingWindow(windowStart, windowEnd),
        eatingWindowStart: windowStart,
        eatingWindowEnd: windowEnd,
      },
      specificContext: { tipType },
    }

    const aiMessage = await generatePersonalizedMessage('fasting_tip', messageContext)

    // Use AI message or minimal fallback
    const title = aiMessage?.title || 'Conseil jeûne'
    const body = aiMessage?.body || (tipType === 'eating_window_start'
      ? 'Ta fenêtre alimentaire commence !'
      : tipType === 'eating_window_end'
        ? 'Ta fenêtre se termine bientôt'
        : 'Reste bien hydraté pendant le jeûne')
    const emoji = aiMessage?.emoji || '🧘'

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${title}`,
        body,
        data: {
          type: 'coach_proactive',
          subtype: 'fasting_tip',
          tipType,
          deepLink: 'lym://home',
          isAIGenerated: aiMessage?.isAIGenerated || false,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,
    })

    // Add to MessageCenter for Coach screen
    const today = new Date().toDateString()
    addToMessageCenter('fasting_tip', title, body, `fasting-tip-${tipType}-${today}`, emoji)

    console.log('[CoachProactive] Sent AI-personalized fasting tip:', tipType, aiMessage?.isAIGenerated ? '(AI)' : '(fallback)')
    return true
  } catch (error) {
    console.error('[CoachProactive] Error sending fasting tip:', error)
    return false
  }
}

/**
 * Get scheduled notification IDs
 */
async function getScheduledNotificationIds(): Promise<string[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.COACH_NOTIFICATION_IDS)
    return json ? JSON.parse(json) : []
  } catch {
    return []
  }
}

/**
 * Cancel all Coach proactive notifications
 */
export async function cancelCoachNotifications(): Promise<void> {
  try {
    const ids = await getScheduledNotificationIds()
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id)
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.COACH_NOTIFICATION_IDS)
    console.log(`[CoachProactive] Cancelled ${ids.length} notifications`)
  } catch (error) {
    console.error('[CoachProactive] Error cancelling notifications:', error)
  }
}

/**
 * Enable or disable Coach proactive notifications
 */
export async function setCoachNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.COACH_NOTIFS_ENABLED, enabled ? 'true' : 'false')
  if (!enabled) {
    await cancelCoachNotifications()
  }
  console.log(`[CoachProactive] Notifications ${enabled ? 'enabled' : 'disabled'}`)
}

/**
 * Check if Coach notifications are enabled
 */
export async function areCoachNotificationsEnabled(): Promise<boolean> {
  const enabled = await AsyncStorage.getItem(STORAGE_KEYS.COACH_NOTIFS_ENABLED)
  return enabled !== 'false' // Default to true
}

/**
 * Initialize Coach proactive service
 * Call this on app start
 */
export async function initializeCoachProactiveService(profile: UserProfile): Promise<void> {
  try {
    const enabled = await areCoachNotificationsEnabled()
    if (!enabled) {
      console.log('[CoachProactive] Service disabled')
      return
    }

    // Schedule evening summary
    await scheduleEveningSummary(profile)

    // Check for macro alerts (afternoon check)
    const currentHour = new Date().getHours()
    if (currentHour >= NOTIFICATION_TIMES.macro_check && currentHour < 18) {
      await checkAndSendMacroAlert()
    }

    // Send encouragement if milestone reached
    await sendEncouragementIfDeserved()

    // Send fasting tips if applicable
    if (profile.lifestyleHabits?.fasting?.schedule !== 'none') {
      await sendFastingTip(profile)
    }

    console.log('[CoachProactive] Service initialized')
  } catch (error) {
    console.error('[CoachProactive] Error initializing service:', error)
  }
}

/**
 * Get Coach notification info
 */
export async function getCoachNotificationInfo(): Promise<{
  enabled: boolean
  pendingNotifications: number
}> {
  const enabled = await areCoachNotificationsEnabled()
  const ids = await getScheduledNotificationIds()

  let pendingNotifications = 0
  try {
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync()
    pendingNotifications = allScheduled.filter(n => ids.includes(n.identifier)).length
  } catch {
    // Ignore
  }

  return { enabled, pendingNotifications }
}
