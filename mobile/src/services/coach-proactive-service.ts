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
import { buildFastingContext, isInEatingWindow } from './lymia-brain'
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

// Messages Coach par type (tutoiement, bienveillant)
const COACH_MESSAGES: Record<CoachNotificationType, {
  titles: string[]
  bodies: Record<string, string[]>
}> = {
  macro_alert: {
    titles: [
      'Un petit ajustement ?',
      'Conseil nutrition',
      'LYM te conseille',
    ],
    bodies: {
      low_protein: [
        'Tes proteines sont un peu basses aujourd\'hui. Un yaourt grec ou des oeufs pourraient t\'aider a atteindre tes objectifs.',
        'Pense a ajouter une source de proteines a ton prochain repas pour rester en forme !',
      ],
      high_carbs: [
        'Tu as consomme pas mal de glucides. Pour le prochain repas, privilegie les proteines et les legumes.',
        'Les glucides sont importants, mais equilibrer avec des proteines t\'aidera a tenir plus longtemps.',
      ],
      low_calories: [
        'Tu n\'as pas encore mange beaucoup aujourd\'hui. N\'oublie pas de te nourrir correctement !',
        'Ton corps a besoin d\'energie. Prends le temps de bien manger.',
      ],
      high_fats: [
        'Ta consommation de lipides est elevee. Privilegie des options plus legeres pour le reste de la journee.',
      ],
    },
  },
  goal_reminder: {
    titles: [
      'Tu y es presque !',
      'Objectif en vue',
      'Continue comme ca',
    ],
    bodies: {
      calories: [
        'Plus que {remaining} kcal pour atteindre ton objectif du jour. Tu geres !',
        'Tu as deja atteint {percent}% de ton objectif calorique. Bravo !',
      ],
      protein: [
        'Plus que {remaining}g de proteines pour atteindre ton objectif. Une collation proteunee ?',
      ],
    },
  },
  encouragement: {
    titles: [
      'Bravo !',
      'Super progres',
      'Continue !',
    ],
    bodies: {
      serie: [
        'Wow, {days} jours d\'affilee ! Ta regularite est impressionnante.',
        '{days} jours consecutifs ! Ta constance paie, continue comme ca.',
        'Bravo, ca fait {days} jours que tu tiens le cap !',
      ],
      consistency: [
        'Tu as tracke tous tes repas cette semaine. Excellent travail !',
        'Ta regularite est exemplaire. Les resultats vont suivre.',
      ],
      milestone: [
        'Tu as atteint {xp} XP ! Chaque action compte.',
        'Niveau {level} atteint ! Tu progresses super bien.',
      ],
    },
  },
  fasting_tip: {
    titles: [
      'Conseil jeune',
      'Ton jeune',
      'Hydratation',
    ],
    bodies: {
      fasting_period: [
        'Tu es en periode de jeune. Reste bien hydrate avec de l\'eau ou du the sans sucre.',
        'Pendant ton jeune, n\'oublie pas de boire regulierement. Le cafe noir est aussi autorise !',
      ],
      eating_window_start: [
        'Ta fenetre alimentaire commence ! C\'est le moment de bien te nourrir.',
        'Debut de ta fenetre alimentaire. Privilegie un repas riche en proteines pour bien demarrer.',
      ],
      eating_window_end: [
        'Ta fenetre alimentaire se termine bientot. As-tu atteint tes objectifs nutritionnels ?',
      ],
    },
  },
  evening_summary: {
    titles: [
      'Resume du jour',
      'Ta journee',
      'Bilan nutrition',
    ],
    bodies: {
      good_day: [
        'Belle journee ! Tu as atteint {percent}% de tes objectifs. Repose-toi bien.',
        'Journee reussie avec {calories} kcal consommees. A demain !',
      ],
      room_for_improvement: [
        'Tu as consomme {calories} kcal sur {target}. Demain est un nouveau jour !',
        'Journee a {percent}% de tes objectifs. Chaque jour est une nouvelle opportunite.',
      ],
      missed_tracking: [
        'Tu n\'as pas beaucoup tracke aujourd\'hui. N\'oublie pas, chaque repas compte !',
      ],
    },
  },
}

/**
 * Analyse la nutrition du jour et determine si une alerte est necessaire
 */
function analyzeNutrition(
  consumed: NutritionInfo,
  target: NutritionInfo,
  currentHour: number
): { type: string; message: string } | null {
  // Ne pas alerter trop tot dans la journee
  if (currentHour < 12) return null

  const caloriePercent = (consumed.calories / target.calories) * 100
  const proteinPercent = (consumed.proteins / target.proteins) * 100

  // Si on est l'apres-midi et les proteines sont tres basses
  if (currentHour >= 14 && proteinPercent < 30) {
    return {
      type: 'low_protein',
      message: getRandomMessage(COACH_MESSAGES.macro_alert.bodies.low_protein),
    }
  }

  // Si on est l'apres-midi et les calories sont tres basses
  if (currentHour >= 14 && caloriePercent < 25) {
    return {
      type: 'low_calories',
      message: getRandomMessage(COACH_MESSAGES.macro_alert.bodies.low_calories),
    }
  }

  // Si les glucides sont trop eleves (> 60% des macros)
  const totalMacros = consumed.proteins + consumed.carbs + consumed.fats
  if (totalMacros > 0) {
    const carbRatio = consumed.carbs / totalMacros
    if (carbRatio > 0.65 && consumed.carbs > 100) {
      return {
        type: 'high_carbs',
        message: getRandomMessage(COACH_MESSAGES.macro_alert.bodies.high_carbs),
      }
    }
  }

  return null
}

/**
 * Get random message from array
 */
function getRandomMessage(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)]
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
      'Coach', // Route to Coach to see the full analysis
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
    const alert = analyzeNutrition(consumed, target, currentHour)

    if (!alert) return false

    // Send notification
    const title = getRandomMessage(COACH_MESSAGES.macro_alert.titles)
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: alert.message,
        data: {
          type: 'coach_proactive',
          subtype: 'macro_alert',
          alertType: alert.type,
          deepLink: 'lym://home',
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null, // Immediate
    })

    // Add to MessageCenter for Coach screen
    addToMessageCenter('macro_alert', title, alert.message, `macro-alert-${alert.type}-${today}`, '🥗')

    await AsyncStorage.setItem(STORAGE_KEYS.LAST_MACRO_ALERT_DATE, today)
    console.log('[CoachProactive] Sent macro alert:', alert.type)
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
    const streak = gamificationState.currentStreak || 0
    const level = gamificationState.currentLevel || 1
    const xp = gamificationState.totalXP || 0

    // Determine if encouragement is deserved
    let message: string | null = null
    let title: string = getRandomMessage(COACH_MESSAGES.encouragement.titles)

    // Milestones de jours consecutifs: 3, 7, 14, 21, 30, etc.
    const serieMilestones = [3, 7, 14, 21, 30, 60, 90]
    if (serieMilestones.includes(streak)) {
      const template = getRandomMessage(COACH_MESSAGES.encouragement.bodies.serie)
      message = template.replace('{days}', streak.toString())
    }

    // Level up celebration
    if (level > 1 && xp % 1000 < 100) { // Recently leveled up
      const template = getRandomMessage(COACH_MESSAGES.encouragement.bodies.milestone)
      message = template
        .replace('{level}', level.toString())
        .replace('{xp}', xp.toString())
    }

    if (!message) return false

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
        data: {
          type: 'coach_proactive',
          subtype: 'encouragement',
          deepLink: 'lym://home',
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    })

    // Add to MessageCenter for Coach screen
    addToMessageCenter('encouragement', title, message, `encouragement-${today}`, '🎉')

    await AsyncStorage.setItem(STORAGE_KEYS.LAST_ENCOURAGEMENT_DATE, today)
    console.log('[CoachProactive] Sent encouragement:', message)
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
    let messages: string[] = []

    // Near eating window start (within 30 minutes)
    if (currentHour === windowStart) {
      tipType = 'eating_window_start'
      messages = COACH_MESSAGES.fasting_tip.bodies.eating_window_start
    }
    // Near eating window end (1 hour before)
    else if (currentHour === windowEnd - 1) {
      tipType = 'eating_window_end'
      messages = COACH_MESSAGES.fasting_tip.bodies.eating_window_end
    }
    // During fasting period (mid-morning for 16:8)
    else if (currentHour === 10 && !isInEatingWindow(windowStart, windowEnd)) {
      tipType = 'fasting_period'
      messages = COACH_MESSAGES.fasting_tip.bodies.fasting_period
    }

    if (!tipType || messages.length === 0) return false

    const title = getRandomMessage(COACH_MESSAGES.fasting_tip.titles)
    const body = getRandomMessage(messages)

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          type: 'coach_proactive',
          subtype: 'fasting_tip',
          tipType,
          deepLink: 'lym://home',
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null,
    })

    // Add to MessageCenter for Coach screen
    const today = new Date().toDateString()
    addToMessageCenter('fasting_tip', title, body, `fasting-tip-${tipType}-${today}`, '🧘')

    console.log('[CoachProactive] Sent fasting tip:', tipType)
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
