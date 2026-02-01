/**
 * Onboarding Notifications Service
 *
 * Programme et envoie des notifications push pour les 7 jours d'onboarding.
 * Chaque jour, l'utilisateur recoit un message presentant la fonctionnalite du jour.
 *
 * Jour 1: Bienvenue + Journal simple
 * Jour 2: Suggestions personnalisees
 * Jour 3: Anticipation (mini planning)
 * Jour 4: Coach LYM
 * Jour 5: Contextes de vie (sport/bien-etre)
 * Jour 6: Equilibre & adaptation
 * Jour 7: Invitation premium
 */

import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { FEATURE_UNLOCK_DAYS, type FeatureKey } from '../stores/onboarding-store'

// Storage keys
const STORAGE_KEYS = {
  ONBOARDING_NOTIFICATIONS_SCHEDULED: '@lym_onboarding_notifications_scheduled',
  ONBOARDING_NOTIFICATION_IDS: '@lym_onboarding_notification_ids',
  LAST_ONBOARDING_DAY_NOTIFIED: '@lym_last_onboarding_day_notified',
}

// Notification content for each day
export const ONBOARDING_NOTIFICATIONS: Record<number, {
  title: string
  body: string
  emoji: string
  feature: FeatureKey
  deepLink?: string
}> = {
  1: {
    title: 'Bienvenue dans LYM',
    body: 'Commence simplement : note ce que tu manges, sans te prendre la tete. LYM s\'occupe du reste. 🌱',
    emoji: '👋',
    feature: 'journal_simple',
    deepLink: 'lym://home',
  },
  2: {
    title: 'LYM s\'adapte a toi',
    body: 'Nouvelle fonctionnalite ! LYM commence a te proposer des suggestions personnalisees. ✨',
    emoji: '✨',
    feature: 'suggestions',
    deepLink: 'lym://suggestions',
  },
  3: {
    title: 'Moins de charge mentale',
    body: 'Tu peux maintenant anticiper tes repas en douceur. Fini les "qu\'est-ce qu\'on mange ce soir ?" 🗓️',
    emoji: '🗓️',
    feature: 'anticipation',
    deepLink: 'lym://planning',
  },
  4: {
    title: 'Ton coach personnel',
    body: 'Le Coach LYM est maintenant disponible ! Pose-lui tes questions, il est la pour t\'accompagner. 💬',
    emoji: '💬',
    feature: 'coach_lym',
    deepLink: 'lym://coach',
  },
  5: {
    title: 'Ton energie compte',
    body: 'LYM prend maintenant en compte ton sport et ton bien-etre. Tout est lie ! ⚡',
    emoji: '⚡',
    feature: 'contextes_vie',
    deepLink: 'lym://wellness',
  },
  6: {
    title: 'Intelligence invisible',
    body: 'LYM s\'adapte a ton rythme reel. Tu as acces a toutes les fonctionnalites d\'equilibre. 🌿',
    emoji: '🌿',
    feature: 'equilibre',
    deepLink: 'lym://home',
  },
  7: {
    title: 'Continue avec LYM',
    body: 'Ta semaine d\'essai touche a sa fin. LYM te connait bien maintenant. Pret a continuer ensemble ? 💜',
    emoji: '💜',
    feature: 'premium',
    deepLink: 'lym://premium',
  },
}

/**
 * Schedule all 7 onboarding notifications
 * Called once when user completes onboarding
 */
export async function scheduleOnboardingNotifications(preferredHour: number = 9, force: boolean = false): Promise<void> {
  try {
    // Check if already scheduled (unless forced)
    if (!force) {
      const alreadyScheduled = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_NOTIFICATIONS_SCHEDULED)
      if (alreadyScheduled === 'true') {
        // Verify that notifications actually exist
        const idsJson = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_NOTIFICATION_IDS)
        if (idsJson) {
          const ids: string[] = JSON.parse(idsJson)
          const allScheduled = await Notifications.getAllScheduledNotificationsAsync()
          const existingCount = allScheduled.filter(n => ids.includes(n.identifier)).length
          if (existingCount > 0) {
            console.log(`[OnboardingNotifications] Already scheduled (${existingCount} pending), skipping`)
            return
          }
        }
        // Notifications were marked as scheduled but none exist - reset and retry
        console.log('[OnboardingNotifications] Marked as scheduled but none found, resetting...')
        await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_NOTIFICATIONS_SCHEDULED)
      }
    }

    // Check permissions - request if not granted
    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync()
      status = newStatus
    }

    if (status !== 'granted') {
      console.log('[OnboardingNotifications] Permissions not granted after request')
      return
    }

    const notificationIds: string[] = []
    const now = new Date()

    // Schedule notifications for days 2-7 (day 1 is immediate)
    for (let day = 2; day <= 7; day++) {
      const notification = ONBOARDING_NOTIFICATIONS[day]
      if (!notification) continue

      // Calculate trigger date: day-1 days from now at preferred hour
      const triggerDate = new Date(now)
      triggerDate.setDate(triggerDate.getDate() + (day - 1))
      triggerDate.setHours(preferredHour, 0, 0, 0)

      // If trigger time is in the past for day 2, schedule for tomorrow
      if (triggerDate <= now) {
        triggerDate.setDate(triggerDate.getDate() + 1)
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${notification.emoji} ${notification.title}`,
          body: notification.body,
          data: {
            type: 'onboarding',
            day,
            feature: notification.feature,
            deepLink: notification.deepLink,
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      })

      notificationIds.push(id)
      console.log(`[OnboardingNotifications] Scheduled day ${day} for ${triggerDate.toISOString()}`)
    }

    // Save notification IDs for potential cancellation
    await AsyncStorage.setItem(
      STORAGE_KEYS.ONBOARDING_NOTIFICATION_IDS,
      JSON.stringify(notificationIds)
    )

    // Mark as scheduled
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_NOTIFICATIONS_SCHEDULED, 'true')

    // Send day 1 notification immediately (welcome message)
    await sendDay1WelcomeNotification()

    console.log('[OnboardingNotifications] Successfully scheduled all notifications')
  } catch (error) {
    console.error('[OnboardingNotifications] Error scheduling notifications:', error)
  }
}

/**
 * Send the day 1 welcome notification immediately
 */
async function sendDay1WelcomeNotification(): Promise<void> {
  const notification = ONBOARDING_NOTIFICATIONS[1]
  if (!notification) return

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${notification.emoji} ${notification.title}`,
        body: notification.body,
        data: {
          type: 'onboarding',
          day: 1,
          feature: notification.feature,
          deepLink: notification.deepLink,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Immediate
    })

    await AsyncStorage.setItem(STORAGE_KEYS.LAST_ONBOARDING_DAY_NOTIFIED, '1')
    console.log('[OnboardingNotifications] Sent day 1 welcome notification')
  } catch (error) {
    console.error('[OnboardingNotifications] Error sending day 1 notification:', error)
  }
}

/**
 * Cancel all scheduled onboarding notifications
 * Used when user subscribes (no longer needs onboarding reminders)
 */
export async function cancelOnboardingNotifications(): Promise<void> {
  try {
    const idsJson = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_NOTIFICATION_IDS)
    if (idsJson) {
      const ids: string[] = JSON.parse(idsJson)
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id)
      }
      console.log(`[OnboardingNotifications] Cancelled ${ids.length} notifications`)
    }

    // Clear storage
    await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_NOTIFICATION_IDS)
    await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_NOTIFICATIONS_SCHEDULED)
  } catch (error) {
    console.error('[OnboardingNotifications] Error cancelling notifications:', error)
  }
}

/**
 * Check if onboarding notifications have been scheduled
 */
export async function areOnboardingNotificationsScheduled(): Promise<boolean> {
  const scheduled = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_NOTIFICATIONS_SCHEDULED)
  return scheduled === 'true'
}

/**
 * Get the last onboarding day that was notified
 */
export async function getLastOnboardingDayNotified(): Promise<number> {
  const day = await AsyncStorage.getItem(STORAGE_KEYS.LAST_ONBOARDING_DAY_NOTIFIED)
  return day ? parseInt(day, 10) : 0
}

/**
 * Mark an onboarding day as notified (used when notification is received)
 */
export async function markOnboardingDayNotified(day: number): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.LAST_ONBOARDING_DAY_NOTIFIED, day.toString())
}

/**
 * Reschedule remaining onboarding notifications
 * Called when user changes preferred notification hour
 */
export async function rescheduleOnboardingNotifications(
  newHour: number,
  currentDay: number
): Promise<void> {
  try {
    // Cancel existing notifications
    await cancelOnboardingNotifications()

    // Clear scheduled flag to allow rescheduling
    await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_NOTIFICATIONS_SCHEDULED)

    // Only schedule remaining days
    const notificationIds: string[] = []
    const now = new Date()

    for (let day = currentDay + 1; day <= 7; day++) {
      const notification = ONBOARDING_NOTIFICATIONS[day]
      if (!notification) continue

      // Calculate days until this notification
      const daysUntil = day - currentDay

      const triggerDate = new Date(now)
      triggerDate.setDate(triggerDate.getDate() + daysUntil)
      triggerDate.setHours(newHour, 0, 0, 0)

      // If trigger is in the past, schedule for tomorrow
      if (triggerDate <= now) {
        triggerDate.setDate(triggerDate.getDate() + 1)
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${notification.emoji} ${notification.title}`,
          body: notification.body,
          data: {
            type: 'onboarding',
            day,
            feature: notification.feature,
            deepLink: notification.deepLink,
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      })

      notificationIds.push(id)
      console.log(`[OnboardingNotifications] Rescheduled day ${day} for ${triggerDate.toISOString()}`)
    }

    // Save new notification IDs
    await AsyncStorage.setItem(
      STORAGE_KEYS.ONBOARDING_NOTIFICATION_IDS,
      JSON.stringify(notificationIds)
    )

    // Mark as scheduled again
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_NOTIFICATIONS_SCHEDULED, 'true')

    console.log('[OnboardingNotifications] Rescheduled remaining notifications')
  } catch (error) {
    console.error('[OnboardingNotifications] Error rescheduling:', error)
  }
}

/**
 * Reset onboarding notifications (for testing/debug)
 */
export async function resetOnboardingNotifications(): Promise<void> {
  await cancelOnboardingNotifications()
  await AsyncStorage.removeItem(STORAGE_KEYS.LAST_ONBOARDING_DAY_NOTIFIED)
  console.log('[OnboardingNotifications] Reset complete')
}

/**
 * Get info about scheduled onboarding notifications
 */
export async function getOnboardingNotificationsInfo(): Promise<{
  scheduled: boolean
  lastDayNotified: number
  pendingNotifications: number
}> {
  const scheduled = await areOnboardingNotificationsScheduled()
  const lastDayNotified = await getLastOnboardingDayNotified()

  // Count pending notifications
  let pendingNotifications = 0
  try {
    const idsJson = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_NOTIFICATION_IDS)
    if (idsJson) {
      const ids: string[] = JSON.parse(idsJson)
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync()
      pendingNotifications = allScheduled.filter(n => ids.includes(n.identifier)).length
    }
  } catch (error) {
    console.error('[OnboardingNotifications] Error getting pending count:', error)
  }

  return {
    scheduled,
    lastDayNotified,
    pendingNotifications,
  }
}

/**
 * Check and ensure onboarding notifications are properly scheduled
 * Call this on app startup to recover from any scheduling failures
 */
export async function ensureOnboardingNotificationsScheduled(
  signupDate: string | null,
  isSubscribed: boolean
): Promise<void> {
  // Don't schedule for subscribers
  if (isSubscribed) {
    console.log('[OnboardingNotifications] User is subscribed, skipping')
    return
  }

  // Don't schedule if no signup date
  if (!signupDate) {
    console.log('[OnboardingNotifications] No signup date, skipping')
    return
  }

  // Calculate current day
  const signup = new Date(signupDate)
  const now = new Date()
  const diffTime = now.getTime() - signup.getTime()
  const currentDay = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1)

  // If past day 7, no need to schedule
  if (currentDay > 7) {
    console.log('[OnboardingNotifications] Past day 7, no more notifications needed')
    return
  }

  // Check if notifications are actually scheduled
  const info = await getOnboardingNotificationsInfo()

  if (info.pendingNotifications === 0 && currentDay < 7) {
    console.log(`[OnboardingNotifications] No pending notifications on day ${currentDay}, rescheduling...`)
    // Force reschedule remaining notifications
    await rescheduleOnboardingNotifications(9, currentDay)
  } else {
    console.log(`[OnboardingNotifications] ${info.pendingNotifications} notifications pending, day ${currentDay}`)
  }
}
