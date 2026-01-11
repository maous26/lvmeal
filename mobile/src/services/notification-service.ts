/**
 * Notification Service - Gestion des notifications push
 *
 * Fonctionnalités:
 * - Demande de permissions
 * - Envoi de notifications locales
 * - Scheduling quotidien configurable
 * - Gestion du token push
 * - Anti-spam (1 notification/jour max)
 */

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useMessageCenter, type MessageCategory, type MessageType } from './message-center'
import type { DailyInsight, NotificationPreferences } from '../types'

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// Clés de stockage
const STORAGE_KEYS = {
  LAST_NOTIFICATION_DATE: '@lym_last_notification_date',
  NOTIFICATION_HISTORY: '@lym_notification_history',
  PUSH_TOKEN: '@lym_push_token',
  NOTIFICATION_PREFS: '@lym_notification_prefs',
}

// Default preferences
const DEFAULT_PREFERENCES: NotificationPreferences = {
  dailyInsightsEnabled: true,
  preferredHour: 9, // 9 AM
  lastNotificationDate: null,
  lastNotificationId: null,
  notificationHistory: [],
}

// Types
export interface NotificationData {
  title: string
  body: string
  category: 'nutrition' | 'wellness' | 'sport' | 'progress' | 'alert' | 'behavior'
  severity: 'info' | 'warning' | 'celebration' | 'alert'
  deepLink?: string
  source?: string // Source RAG si disponible
}

interface NotificationHistoryItem {
  id: string
  title: string
  category: string
  sentAt: string
}

/**
 * Demande les permissions de notification
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Notifications non disponibles sur simulateur')
    return false
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Permission de notification refusée')
    return false
  }

  // Configuration Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('coach', {
      name: 'Coach LYM',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0077B6',
    })
  }

  return true
}

/**
 * Récupère le token push pour les notifications distantes
 */
export async function getPushToken(): Promise<string | null> {
  try {
    // Vérifier le cache
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN)
    if (cached) return cached

    if (!Device.isDevice) return null

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    })

    await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token.data)
    return token.data
  } catch (error) {
    console.error('Erreur récupération push token:', error)
    return null
  }
}

/**
 * Vérifie si une notification peut être envoyée (anti-spam)
 * - Max 1 notification par jour
 * - Pas de doublon de titre dans les 3 derniers jours
 */
export async function canSendNotification(title: string): Promise<boolean> {
  try {
    // Vérifier la date de dernière notification
    const lastDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_NOTIFICATION_DATE)
    if (lastDate) {
      const today = new Date().toDateString()
      if (lastDate === today) {
        console.log('Notification déjà envoyée aujourd\'hui')
        return false
      }
    }

    // Vérifier l'historique pour éviter les doublons
    const historyJson = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_HISTORY)
    if (historyJson) {
      const history: NotificationHistoryItem[] = JSON.parse(historyJson)
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000

      const recentWithSameTitle = history.find(
        (item) =>
          item.title === title &&
          new Date(item.sentAt).getTime() > threeDaysAgo
      )

      if (recentWithSameTitle) {
        console.log('Notification similaire envoyée récemment')
        return false
      }
    }

    return true
  } catch (error) {
    console.error('Erreur vérification anti-spam:', error)
    return true // En cas d'erreur, on autorise
  }
}

/**
 * Envoie une notification locale
 */
export async function sendNotification(data: NotificationData): Promise<boolean> {
  try {
    // Vérifier les permissions
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      console.log('Permissions notifications non accordées')
      return false
    }

    // Vérifier anti-spam
    const canSend = await canSendNotification(data.title)
    if (!canSend) {
      return false
    }

    // Emoji selon la catégorie
    const categoryEmoji: Record<string, string> = {
      nutrition: '🥗',
      wellness: '😴',
      sport: '💪',
      progress: '📈',
      alert: '⚠️',
    }

    const emoji = categoryEmoji[data.category] || '💡'

    // Envoyer la notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${data.title}`,
        body: data.body,
        data: {
          category: data.category,
          severity: data.severity,
          deepLink: data.deepLink,
          source: data.source,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Immédiat
    })

    // Add to MessageCenter for Coach screen
    const severityToPriority: Record<string, 'P0' | 'P1' | 'P2' | 'P3'> = {
      alert: 'P0',
      warning: 'P1',
      celebration: 'P2',
      info: 'P3',
    }
    const severityToType: Record<string, MessageType> = {
      alert: 'alert',
      warning: 'action',
      celebration: 'celebration',
      info: 'tip',
    }
    const messageCenter = useMessageCenter.getState()
    messageCenter.addMessage({
      priority: severityToPriority[data.severity] || 'P3',
      type: severityToType[data.severity] || 'tip',
      category: (data.category as MessageCategory) || 'wellness',
      title: data.title,
      message: data.body,
      emoji,
      reason: data.source ? `Source: ${data.source}` : 'Notification système',
      confidence: 0.8,
      dedupKey: `notif-${data.category}-${new Date().toDateString()}`,
      actionRoute: 'Coach',
    })

    // Enregistrer dans l'historique
    await recordNotification(data.title, data.category)

    console.log('Notification envoyée:', data.title)
    return true
  } catch (error) {
    console.error('Erreur envoi notification:', error)
    return false
  }
}

/**
 * Enregistre une notification dans l'historique
 */
async function recordNotification(title: string, category: string): Promise<void> {
  try {
    // Mettre à jour la date de dernière notification
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_NOTIFICATION_DATE,
      new Date().toDateString()
    )

    // Ajouter à l'historique
    const historyJson = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_HISTORY)
    const history: NotificationHistoryItem[] = historyJson
      ? JSON.parse(historyJson)
      : []

    history.unshift({
      id: Date.now().toString(),
      title,
      category,
      sentAt: new Date().toISOString(),
    })

    // Garder seulement les 30 dernières
    const trimmed = history.slice(0, 30)
    await AsyncStorage.setItem(
      STORAGE_KEYS.NOTIFICATION_HISTORY,
      JSON.stringify(trimmed)
    )
  } catch (error) {
    console.error('Erreur enregistrement historique:', error)
  }
}

/**
 * Ajoute un listener pour les notifications reçues
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback)
}

/**
 * Ajoute un listener pour les réponses aux notifications (tap)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback)
}

/**
 * Annule toutes les notifications programmées
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Récupère le nombre de notifications non lues (badge)
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync()
}

/**
 * Met à jour le badge de l'app
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count)
}

/**
 * Réinitialise l'historique des notifications (pour debug)
 */
export async function resetNotificationHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.LAST_NOTIFICATION_DATE)
  await AsyncStorage.removeItem(STORAGE_KEYS.NOTIFICATION_HISTORY)
}

// ============= PREFERENCES MANAGEMENT =============

/**
 * Get notification preferences from storage
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFS)
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('[Notifications] Failed to load preferences:', error)
  }
  return DEFAULT_PREFERENCES
}

/**
 * Save notification preferences
 */
export async function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  try {
    const current = await getNotificationPreferences()
    const updated = { ...current, ...prefs }
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFS, JSON.stringify(updated))

    // Reschedule if hour changed or enabled/disabled
    if (prefs.dailyInsightsEnabled !== undefined || prefs.preferredHour !== undefined) {
      if (updated.dailyInsightsEnabled) {
        await scheduleDailyInsightNotification(updated.preferredHour)
      } else {
        await cancelAllNotifications()
      }
    }
  } catch (error) {
    console.error('[Notifications] Failed to save preferences:', error)
  }
}

/**
 * Toggle daily insights on/off
 */
export async function toggleDailyInsights(enabled: boolean): Promise<void> {
  await saveNotificationPreferences({ dailyInsightsEnabled: enabled })
}

/**
 * Update preferred notification hour
 */
export async function setPreferredHour(hour: number): Promise<void> {
  // Clamp to reasonable hours (8 AM - 9 PM)
  const clampedHour = Math.max(8, Math.min(21, hour))
  await saveNotificationPreferences({ preferredHour: clampedHour })
}

// ============= SCHEDULING =============

/**
 * Schedule daily insight notification at preferred hour
 */
export async function scheduleDailyInsightNotification(hour: number): Promise<string | null> {
  // Cancel existing scheduled notifications first
  await cancelAllNotifications()

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '💡 LymIA a un conseil pour toi',
        body: "Ouvre l'app pour découvrir ton insight personnalisé du jour",
        data: { type: 'daily_insight_trigger' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    })

    console.log('[Notifications] Scheduled daily notification:', { id, hour })
    return id
  } catch (error) {
    console.error('[Notifications] Failed to schedule notification:', error)
    return null
  }
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync()
}

// ============= INSIGHT NOTIFICATIONS =============

/**
 * Send daily insight notification
 */
export async function sendInsightNotification(insight: DailyInsight): Promise<boolean> {
  // Check if we already sent a notification today
  const prefs = await getNotificationPreferences()
  const today = new Date().toISOString().split('T')[0]

  if (prefs.lastNotificationDate === today) {
    console.log('[Notifications] Already sent notification today, skipping')
    return false
  }

  // Determine emoji based on category/severity
  const emoji = getInsightEmoji(insight.category, insight.severity)

  const result = await sendNotification({
    title: insight.title,
    body: insight.body,
    category: insight.category,
    severity: insight.severity,
    deepLink: insight.deepLink,
    source: insight.source,
  })

  if (result) {
    // Update preferences with last notification info
    await saveNotificationPreferences({
      lastNotificationDate: today,
      lastNotificationId: insight.id,
      notificationHistory: [
        { id: insight.id, title: insight.title, sentAt: new Date().toISOString() },
        ...prefs.notificationHistory.slice(0, 29), // Keep last 30
      ],
    })
  }

  return result
}

/**
 * Get appropriate emoji for insight
 */
function getInsightEmoji(
  category: DailyInsight['category'],
  severity: DailyInsight['severity']
): string {
  if (severity === 'celebration') return '🎉'
  if (severity === 'alert') return '⚠️'

  switch (category) {
    case 'nutrition':
      return '🥗'
    case 'wellness':
      return '😴'
    case 'sport':
      return '💪'
    case 'progress':
      return '📈'
    case 'behavior':
      return '🧠'
    default:
      return '💡'
  }
}

// ============= INITIALIZATION =============

/**
 * Initialize notifications on app start
 */
export async function initializeNotifications(): Promise<boolean> {
  const granted = await requestNotificationPermissions()

  if (granted) {
    // Load preferences and schedule if enabled
    const prefs = await getNotificationPreferences()
    if (prefs.dailyInsightsEnabled) {
      await scheduleDailyInsightNotification(prefs.preferredHour)
    }
  }

  return granted
}

/**
 * Check if notifications are enabled for this device
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync()
  return status === 'granted'
}

/**
 * Clear notification badge
 */
export async function clearBadge(): Promise<void> {
  await setBadgeCount(0)
}

/**
 * Dismiss all displayed notifications
 */
export async function dismissAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync()
}
