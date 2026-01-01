/**
 * Daily Insight Service - Génération d'insights quotidiens via Super Agent
 *
 * Ce service est responsable de:
 * - Collecter les données des 7 derniers jours
 * - Appeler le Super Agent pour analyse
 * - Générer l'insight le plus pertinent du jour
 * - Programmer la notification locale
 *
 * Modes de fonctionnement:
 * - Option A: Background Fetch (expo-background-fetch)
 * - Option B: Local Scheduled Notification (plus fiable) ← CHOIX
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import {
  SuperAgent,
  type SuperAgentContext,
  type DailyInsight,
} from './super-agent'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useWellnessStore } from '../stores/wellness-store'
import { useGamificationStore } from '../stores/gamification-store'
import type { UserProfile, NutritionInfo } from '../types'

// ============= CONSTANTS =============

const STORAGE_KEYS = {
  LAST_INSIGHT_DATE: '@lym_last_insight_date',
  LAST_INSIGHT_CONTENT: '@lym_last_insight_content',
  SCHEDULED_NOTIFICATION_ID: '@lym_scheduled_notification_id',
}

const DEFAULT_NOTIFICATION_HOUR = 9 // 9h du matin par défaut

// ============= TYPES =============

export interface InsightGenerationResult {
  success: boolean
  insight?: DailyInsight
  scheduled?: boolean
  error?: string
}

// ============= DATA COLLECTION =============

/**
 * Collecte les données des 7 derniers jours pour l'analyse
 */
async function collectUserData(): Promise<SuperAgentContext | null> {
  try {
    // Récupérer les stores
    const userState = useUserStore.getState()
    const mealsState = useMealsStore.getState()
    const wellnessState = useWellnessStore.getState()
    const gamificationState = useGamificationStore.getState()

    const profile = userState.profile as UserProfile | null
    if (!profile) {
      console.log('[DailyInsight] No profile found')
      return null
    }

    // Calculer les dates pour les 7 derniers jours
    const today = new Date().toISOString().split('T')[0]
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      dates.push(date.toISOString().split('T')[0])
    }

    // Collecter les repas depuis dailyData
    const allMeals: import('../types').Meal[] = []
    for (const date of dates) {
      const dayData = mealsState.dailyData[date]
      if (dayData?.meals) {
        allMeals.push(...dayData.meals)
      }
    }

    // Calculer la nutrition quotidienne
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

    // Nutrition d'aujourd'hui
    const todayNutrition = weeklyNutrition[0] || { calories: 0, proteins: 0, carbs: 0, fats: 0 }

    // Collecter les entrées wellness (convertir Record en array)
    const wellnessEntriesRecord = wellnessState.entries || {}
    const wellnessEntriesArray = Object.values(wellnessEntriesRecord) as import('../types').WellnessEntry[]
    const recentWellness = wellnessEntriesArray.filter((w: import('../types').WellnessEntry) => dates.includes(w.date))
    const todayWellness = recentWellness.find((w: import('../types').WellnessEntry) => w.date === today)

    // Gamification
    const streak = gamificationState.currentStreak || 0
    const level = gamificationState.currentLevel || 1
    const xp = gamificationState.totalXP || 0

    // Calculer jours trackés
    const daysWithMeals = dates.filter(date => {
      const dayData = mealsState.dailyData[date]
      return dayData?.meals && dayData.meals.length > 0
    })
    const daysWithWellness = recentWellness.map((w: import('../types').WellnessEntry) => w.date)
    const daysTracked = new Set([...daysWithMeals, ...daysWithWellness]).size

    const context: SuperAgentContext = {
      profile,
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

    return context
  } catch (error) {
    console.error('[DailyInsight] Error collecting user data:', error)
    return null
  }
}

// ============= INSIGHT GENERATION =============

/**
 * Génère l'insight quotidien via le Super Agent
 */
export async function generateDailyInsight(): Promise<InsightGenerationResult> {
  try {
    console.log('[DailyInsight] Starting insight generation...')

    // Vérifier si on a déjà généré aujourd'hui
    const lastDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_INSIGHT_DATE)
    const today = new Date().toDateString()

    if (lastDate === today) {
      // Récupérer l'insight mis en cache
      const cachedInsight = await AsyncStorage.getItem(STORAGE_KEYS.LAST_INSIGHT_CONTENT)
      if (cachedInsight) {
        console.log('[DailyInsight] Using cached insight')
        return {
          success: true,
          insight: JSON.parse(cachedInsight),
          scheduled: false,
        }
      }
    }

    // Collecter les données
    const context = await collectUserData()
    if (!context) {
      return {
        success: false,
        error: 'No user data available',
      }
    }

    // Appeler le Super Agent
    const insight = await SuperAgent.generateDailyInsight(context)

    if (!insight) {
      console.log('[DailyInsight] No insight generated')
      return {
        success: false,
        error: 'No insight generated',
      }
    }

    // Mettre en cache
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_INSIGHT_DATE, today)
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_INSIGHT_CONTENT, JSON.stringify(insight))

    console.log('[DailyInsight] Insight generated:', insight.title)

    return {
      success: true,
      insight,
      scheduled: false,
    }
  } catch (error) {
    console.error('[DailyInsight] Error generating insight:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ============= SCHEDULED NOTIFICATIONS =============

/**
 * Génère l'insight ET envoie une notification avec le contenu réel
 * Appelé quand l'app démarre ou quand le trigger quotidien se déclenche
 */
export async function generateAndNotifyInsight(): Promise<boolean> {
  try {
    console.log('[DailyInsight] Generating insight for notification...')

    // Vérifier si on a déjà notifié aujourd'hui
    const lastNotifDate = await AsyncStorage.getItem('@lym_last_insight_notif_date')
    const today = new Date().toDateString()

    if (lastNotifDate === today) {
      console.log('[DailyInsight] Already notified today, skipping')
      return false
    }

    // Générer l'insight
    const result = await generateDailyInsight()
    if (!result.success || !result.insight) {
      console.log('[DailyInsight] No insight to notify')
      return false
    }

    const insight = result.insight

    // Emoji selon la catégorie et sévérité
    const categoryEmoji: Record<string, string> = {
      nutrition: '🥗',
      wellness: '😴',
      sport: '💪',
      progress: '📈',
    }
    const emoji = insight.severity === 'celebration' ? '🎉' :
                  insight.severity === 'warning' ? '⚠️' :
                  categoryEmoji[insight.category] || '💡'

    // Envoyer la notification avec le VRAI contenu
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${insight.title}`,
        body: insight.body,
        data: {
          type: 'daily_insight',
          deepLink: 'Coach',
          category: insight.category,
        },
        sound: true,
      },
      trigger: null, // Immédiat
    })

    // Marquer comme notifié aujourd'hui
    await AsyncStorage.setItem('@lym_last_insight_notif_date', today)

    console.log('[DailyInsight] Notification sent:', insight.title)
    return true
  } catch (error) {
    console.error('[DailyInsight] Error generating/notifying insight:', error)
    return false
  }
}

/**
 * Programme une notification quotidienne à l'heure préférée
 * Cette notification sert de "trigger" pour générer l'insight au bon moment
 */
export async function scheduleDailyInsightNotification(
  hour: number = DEFAULT_NOTIFICATION_HOUR
): Promise<boolean> {
  try {
    console.log('[DailyInsight] Scheduling daily trigger at', hour, 'h')

    // Annuler la notification précédente si elle existe
    const existingId = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_NOTIFICATION_ID)
    if (existingId) {
      await Notifications.cancelScheduledNotificationAsync(existingId)
    }

    // Programmer le trigger quotidien
    // Note: Sur iOS/Android, cette notification servira de rappel
    // Le contenu réel sera généré quand l'utilisateur ouvre l'app
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💡 LymIA a un conseil pour toi',
        body: 'Ouvre l\'app pour découvrir ton insight personnalisé',
        data: {
          type: 'daily_insight_trigger',
          deepLink: 'Coach',
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    })

    await AsyncStorage.setItem(STORAGE_KEYS.SCHEDULED_NOTIFICATION_ID, notificationId)

    console.log('[DailyInsight] Daily trigger scheduled:', notificationId)
    return true
  } catch (error) {
    console.error('[DailyInsight] Error scheduling notification:', error)
    return false
  }
}

/**
 * Annule la notification quotidienne programmée
 */
export async function cancelDailyInsightNotification(): Promise<void> {
  try {
    const existingId = await AsyncStorage.getItem(STORAGE_KEYS.SCHEDULED_NOTIFICATION_ID)
    if (existingId) {
      await Notifications.cancelScheduledNotificationAsync(existingId)
      await AsyncStorage.removeItem(STORAGE_KEYS.SCHEDULED_NOTIFICATION_ID)
      console.log('[DailyInsight] Notification cancelled')
    }
  } catch (error) {
    console.error('[DailyInsight] Error cancelling notification:', error)
  }
}

/**
 * Met à jour l'heure de la notification quotidienne
 */
export async function updateNotificationHour(hour: number): Promise<boolean> {
  return scheduleDailyInsightNotification(hour)
}

// ============= INITIALIZATION =============

/**
 * Initialise le service d'insight quotidien
 * À appeler au démarrage de l'app
 */
export async function initializeDailyInsightService(): Promise<void> {
  try {
    console.log('[DailyInsight] Initializing service...')

    // Vérifier les préférences utilisateur
    const userState = useUserStore.getState()
    const prefs = userState.notificationPreferences

    if (!prefs.dailyInsightsEnabled) {
      console.log('[DailyInsight] Daily insights disabled by user')
      return
    }

    // Programmer le trigger quotidien (rappel générique)
    await scheduleDailyInsightNotification(DEFAULT_NOTIFICATION_HOUR)

    // Vérifier si c'est le bon moment pour envoyer une notification avec contenu réel
    const now = new Date()
    const currentHour = now.getHours()

    // Si on est après l'heure de notification (9h par défaut) et avant 21h,
    // et qu'on n'a pas encore notifié aujourd'hui, envoyer l'insight
    if (currentHour >= DEFAULT_NOTIFICATION_HOUR && currentHour < 21) {
      // Générer et notifier avec le contenu réel (en arrière-plan)
      generateAndNotifyInsight().catch(error => {
        console.error('[DailyInsight] Background notification error:', error)
      })
    }

    console.log('[DailyInsight] Service initialized')
  } catch (error) {
    console.error('[DailyInsight] Initialization error:', error)
  }
}

/**
 * Récupère le dernier insight généré
 */
export async function getLastDailyInsight(): Promise<DailyInsight | null> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.LAST_INSIGHT_CONTENT)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    console.error('[DailyInsight] Error getting last insight:', error)
    return null
  }
}

/**
 * Force la régénération de l'insight (pour debug)
 */
export async function forceRegenerateInsight(): Promise<InsightGenerationResult> {
  // Effacer le cache
  await AsyncStorage.removeItem(STORAGE_KEYS.LAST_INSIGHT_DATE)
  await AsyncStorage.removeItem(STORAGE_KEYS.LAST_INSIGHT_CONTENT)

  // Régénérer
  return generateDailyInsight()
}

// ============= EXPORTS =============

export const DailyInsightService = {
  generateDailyInsight,
  generateAndNotifyInsight,
  scheduleDailyInsightNotification,
  cancelDailyInsightNotification,
  updateNotificationHour,
  initializeDailyInsightService,
  getLastDailyInsight,
  forceRegenerateInsight,
}

export default DailyInsightService
