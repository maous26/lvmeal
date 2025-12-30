/**
 * Notification Service - Gestion des notifications push
 *
 * Fonctionnalités:
 * - Demande de permissions
 * - Envoi de notifications locales
 * - Gestion du token push
 * - Anti-spam (1 notification/jour max)
 */

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

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
}

// Types
export interface NotificationData {
  title: string
  body: string
  category: 'nutrition' | 'wellness' | 'sport' | 'progress' | 'alert'
  severity: 'info' | 'warning' | 'celebration'
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
