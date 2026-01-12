/**
 * Meal Reminder Notification Service
 *
 * Envoie des rappels de repas intelligents qui respectent:
 * - Le jeune intermittent (pas de rappel hors fenetre alimentaire)
 * - Les preferences utilisateur (heures personnalisees)
 * - Le contexte nutritionnel (macros restantes)
 *
 * Integration avec lymia-brain.ts pour la logique de jeune
 */

import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { isInEatingWindow, buildFastingContext } from './lymia-brain'
import { useMessageCenter } from './message-center'
import type { UserProfile, MealType, FastingConfig } from '../types'

// Storage keys
const STORAGE_KEYS = {
  MEAL_REMINDERS_ENABLED: '@lym_meal_reminders_enabled',
  MEAL_REMINDER_IDS: '@lym_meal_reminder_ids',
  LAST_REMINDER_DATE: '@lym_last_reminder_date',
  CUSTOM_MEAL_TIMES: '@lym_custom_meal_times',
}

// Default meal times (can be customized by user)
export interface MealTimes {
  breakfast: number // Hour 0-23
  lunch: number
  snack: number
  dinner: number
}

export const DEFAULT_MEAL_TIMES: MealTimes = {
  breakfast: 8,
  lunch: 12,
  snack: 16,
  dinner: 19,
}

// Fasting-adjusted default times (for 16:8 fasting)
export const FASTING_MEAL_TIMES: MealTimes = {
  breakfast: 12, // First meal at noon for 16:8
  lunch: 15,
  snack: 17,
  dinner: 19,
}

// Reminder messages by meal type (tutoiement, LYM philosophy)
const REMINDER_MESSAGES: Record<MealType, { title: string; bodies: string[] }> = {
  breakfast: {
    title: 'Petit-dejeuner',
    bodies: [
      'C\'est l\'heure de bien commencer ta journee ! Qu\'est-ce qui te ferait plaisir ?',
      'Un bon petit-dej pour une journee pleine d\'energie ?',
      'Pense a te nourrir pour bien demarrer. LYM est la pour t\'accompagner.',
    ],
  },
  lunch: {
    title: 'Dejeuner',
    bodies: [
      'Pause dejeuner ! Prends le temps de bien manger.',
      'C\'est l\'heure de recharger les batteries. Qu\'est-ce que tu vas manger ?',
      'Midi ! N\'oublie pas ton dejeuner pour rester en forme.',
    ],
  },
  snack: {
    title: 'Collation',
    bodies: [
      'Une petite pause gouter ? C\'est parfait pour tenir jusqu\'au diner.',
      'Envie d\'une collation ? Choisis quelque chose qui te fait du bien.',
      'Un petit encas pour l\'aprem ? LYM te suggere des options.',
    ],
  },
  dinner: {
    title: 'Diner',
    bodies: [
      'C\'est l\'heure de preparer ton diner. Qu\'est-ce qui te tenterait ?',
      'Bientot le diner ! Pense a un repas equilibre pour bien finir la journee.',
      'Le diner approche ! Prends le temps de cuisiner quelque chose de bon.',
    ],
  },
}

// Fasting-aware messages when user is outside eating window
const FASTING_ENCOURAGEMENT_MESSAGES = [
  'Tu es en periode de jeune. Reste hydrate avec de l\'eau ou du the !',
  'Periode de jeune en cours. Tu geres super bien ! Bois de l\'eau.',
  'Continue ton jeune, tu es sur la bonne voie. N\'oublie pas de t\'hydrater.',
]

/**
 * Get meal times adjusted for fasting schedule
 */
export function getMealTimesForFasting(
  fastingConfig?: FastingConfig,
  customTimes?: Partial<MealTimes>
): MealTimes {
  // Start with default or custom times
  let baseTimes: MealTimes = { ...DEFAULT_MEAL_TIMES, ...customTimes }

  // If no fasting or fasting is 'none', use base times
  if (!fastingConfig || fastingConfig.schedule === 'none') {
    return baseTimes
  }

  // Get eating window
  const windowStart = fastingConfig.eatingWindowStart ?? 12
  const windowEnd = fastingConfig.eatingWindowEnd ?? 20

  // Adjust meal times to fit within eating window
  const windowDuration = windowEnd - windowStart

  if (fastingConfig.schedule === '16_8' || fastingConfig.schedule === '18_6') {
    // Skip breakfast, adjust other meals
    return {
      breakfast: windowStart, // First meal at window start (replaces breakfast)
      lunch: Math.min(windowStart + 2, windowEnd - 2),
      snack: Math.min(windowStart + Math.floor(windowDuration / 2), windowEnd - 1),
      dinner: windowEnd - 1,
    }
  }

  if (fastingConfig.schedule === '20_4') {
    // Very short window - 2 meals max
    return {
      breakfast: windowStart, // Main meal
      lunch: windowStart + 1,
      snack: windowStart + 2,
      dinner: windowEnd - 1,
    }
  }

  // 'interested' = user curious about fasting, treat as no fasting for now
  return baseTimes
}

/**
 * Check if a meal reminder should be sent based on fasting
 */
export function shouldSendMealReminder(
  mealType: MealType,
  fastingConfig?: FastingConfig
): { shouldSend: boolean; reason?: string } {
  // No fasting = always send
  if (!fastingConfig || fastingConfig.schedule === 'none') {
    return { shouldSend: true }
  }

  const windowStart = fastingConfig.eatingWindowStart ?? 12
  const windowEnd = fastingConfig.eatingWindowEnd ?? 20
  const currentHour = new Date().getHours()

  // Check if currently in eating window
  const inWindow = isInEatingWindow(windowStart, windowEnd)

  if (!inWindow) {
    return {
      shouldSend: false,
      reason: `En periode de jeune (fenetre: ${windowStart}h-${windowEnd}h)`,
    }
  }

  // Skip breakfast notification for active fasting schedules (16_8, 18_6, 20_4)
  const isFastingActive = fastingConfig.schedule === '16_8' ||
    fastingConfig.schedule === '18_6' ||
    fastingConfig.schedule === '20_4'
  if (mealType === 'breakfast' && isFastingActive) {
    // Only send "breakfast" notification at eating window start
    if (currentHour < windowStart || currentHour >= windowStart + 1) {
      return {
        shouldSend: false,
        reason: 'Petit-dejeuner saute (jeune intermittent)',
      }
    }
  }

  return { shouldSend: true }
}

/**
 * Get the meals to remind based on fasting schedule
 */
export function getMealsToRemind(fastingConfig?: FastingConfig): MealType[] {
  if (!fastingConfig || fastingConfig.schedule === 'none') {
    return ['breakfast', 'lunch', 'snack', 'dinner']
  }

  switch (fastingConfig.schedule) {
    case '16_8':
    case '18_6':
      // No breakfast, lunch is first meal
      return ['lunch', 'snack', 'dinner']

    case '20_4':
      // Only 2 meals in 4-hour window
      return ['lunch', 'dinner']

    case 'interested':
      // User curious about fasting but not practicing yet
      return ['breakfast', 'lunch', 'snack', 'dinner']

    default:
      return ['breakfast', 'lunch', 'snack', 'dinner']
  }
}

/**
 * Schedule meal reminders for the day
 * Called daily (e.g., at midnight or app start)
 */
export async function scheduleDailyMealReminders(
  profile: UserProfile,
  customTimes?: Partial<MealTimes>
): Promise<void> {
  try {
    // Check if reminders are enabled
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.MEAL_REMINDERS_ENABLED)
    if (enabled === 'false') {
      console.log('[MealReminders] Reminders disabled by user')
      return
    }

    // Check permissions
    const { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      console.log('[MealReminders] Notifications not permitted')
      return
    }

    // Cancel existing reminders first
    await cancelMealReminders()

    // Get fasting config
    const fastingConfig = profile.lifestyleHabits?.fasting

    // Get adjusted meal times
    const mealTimes = getMealTimesForFasting(fastingConfig, customTimes)

    // Get meals to remind (based on fasting)
    const mealsToRemind = getMealsToRemind(fastingConfig)

    const notificationIds: string[] = []
    const now = new Date()
    const currentHour = now.getHours()

    for (const mealType of mealsToRemind) {
      const mealHour = mealTimes[mealType]

      // Skip if the meal time has already passed today
      if (mealHour <= currentHour) {
        continue
      }

      // Check if this reminder should be sent based on fasting
      const { shouldSend, reason } = shouldSendMealReminder(mealType, fastingConfig)
      if (!shouldSend) {
        console.log(`[MealReminders] Skipping ${mealType}: ${reason}`)
        continue
      }

      // Calculate trigger time
      const triggerDate = new Date(now)
      triggerDate.setHours(mealHour, 0, 0, 0)

      // Get random message for variety
      const messages = REMINDER_MESSAGES[mealType]
      const randomBody = messages.bodies[Math.floor(Math.random() * messages.bodies.length)]

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${messages.title}`,
          body: randomBody,
          data: {
            type: 'meal_reminder',
            mealType,
            deepLink: `lym://add-meal?type=${mealType}`,
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      })

      // Add to MessageCenter for Coach screen (with future expiry)
      const mealEmoji: Record<MealType, string> = {
        breakfast: '🌅',
        lunch: '🍽️',
        snack: '🍎',
        dinner: '🌙',
      }
      const messageCenter = useMessageCenter.getState()
      messageCenter.addMessage({
        priority: 'P3',
        type: 'tip',
        category: 'nutrition',
        title: messages.title,
        message: randomBody,
        emoji: mealEmoji[mealType],
        reason: `Rappel repas: ${mealType}`,
        confidence: 0.7,
        dedupKey: `meal-reminder-${mealType}-${now.toISOString().split('T')[0]}`,
        actionRoute: 'AddMeal',
        actionLabel: 'Ajouter ce repas',
      })

      notificationIds.push(id)
      console.log(`[MealReminders] Scheduled ${mealType} for ${triggerDate.toLocaleTimeString()}`)
    }

    // Save notification IDs for cancellation
    await AsyncStorage.setItem(
      STORAGE_KEYS.MEAL_REMINDER_IDS,
      JSON.stringify(notificationIds)
    )

    // Update last reminder date
    await AsyncStorage.setItem(
      STORAGE_KEYS.LAST_REMINDER_DATE,
      now.toISOString().split('T')[0]
    )

    console.log(`[MealReminders] Scheduled ${notificationIds.length} meal reminders`)
  } catch (error) {
    console.error('[MealReminders] Error scheduling reminders:', error)
  }
}

/**
 * Cancel all scheduled meal reminders
 */
export async function cancelMealReminders(): Promise<void> {
  try {
    const idsJson = await AsyncStorage.getItem(STORAGE_KEYS.MEAL_REMINDER_IDS)
    if (idsJson) {
      const ids: string[] = JSON.parse(idsJson)
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id)
      }
      console.log(`[MealReminders] Cancelled ${ids.length} reminders`)
    }
    await AsyncStorage.removeItem(STORAGE_KEYS.MEAL_REMINDER_IDS)
  } catch (error) {
    console.error('[MealReminders] Error cancelling reminders:', error)
  }
}

/**
 * Enable or disable meal reminders
 */
export async function setMealRemindersEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.MEAL_REMINDERS_ENABLED, enabled ? 'true' : 'false')
  if (!enabled) {
    await cancelMealReminders()
  }
  console.log(`[MealReminders] Reminders ${enabled ? 'enabled' : 'disabled'}`)
}

/**
 * Check if meal reminders are enabled
 */
export async function areMealRemindersEnabled(): Promise<boolean> {
  const enabled = await AsyncStorage.getItem(STORAGE_KEYS.MEAL_REMINDERS_ENABLED)
  return enabled !== 'false' // Default to true
}

/**
 * Save custom meal times
 */
export async function saveCustomMealTimes(times: Partial<MealTimes>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_MEAL_TIMES, JSON.stringify(times))
}

/**
 * Get custom meal times
 */
export async function getCustomMealTimes(): Promise<Partial<MealTimes> | null> {
  const json = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_MEAL_TIMES)
  return json ? JSON.parse(json) : null
}

/**
 * Get info about meal reminder status
 */
export async function getMealReminderInfo(): Promise<{
  enabled: boolean
  lastReminderDate: string | null
  pendingReminders: number
  mealTimes: MealTimes
}> {
  const enabled = await areMealRemindersEnabled()
  const lastReminderDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_REMINDER_DATE)
  const customTimes = await getCustomMealTimes()
  const mealTimes = { ...DEFAULT_MEAL_TIMES, ...customTimes }

  // Count pending reminders
  let pendingReminders = 0
  try {
    const idsJson = await AsyncStorage.getItem(STORAGE_KEYS.MEAL_REMINDER_IDS)
    if (idsJson) {
      const ids: string[] = JSON.parse(idsJson)
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync()
      pendingReminders = allScheduled.filter((n) => ids.includes(n.identifier)).length
    }
  } catch (error) {
    console.error('[MealReminders] Error getting pending count:', error)
  }

  return {
    enabled,
    lastReminderDate,
    pendingReminders,
    mealTimes,
  }
}

/**
 * Check and reschedule reminders if needed
 * Call this on app start and when profile changes
 */
export async function checkAndScheduleReminders(profile: UserProfile): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const lastDate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_REMINDER_DATE)

  // Only reschedule if it's a new day or never scheduled
  if (lastDate !== today) {
    const customTimes = await getCustomMealTimes()
    await scheduleDailyMealReminders(profile, customTimes || undefined)
  }
}

/**
 * Get a fasting encouragement message for users in fasting period
 */
export function getFastingEncouragementMessage(): string {
  return FASTING_ENCOURAGEMENT_MESSAGES[
    Math.floor(Math.random() * FASTING_ENCOURAGEMENT_MESSAGES.length)
  ]
}

/**
 * Calculate next meal time info for display
 */
export function getNextMealInfo(
  profile: UserProfile,
  customTimes?: Partial<MealTimes>
): {
  nextMeal: MealType | null
  timeUntil: number // minutes
  inFastingPeriod: boolean
  fastingEndsIn?: number // hours
} {
  const fastingConfig = profile.lifestyleHabits?.fasting
  const mealTimes = getMealTimesForFasting(fastingConfig, customTimes)
  const mealsToRemind = getMealsToRemind(fastingConfig)

  const now = new Date()
  const currentHour = now.getHours()
  const currentMinutes = now.getMinutes()

  // Check if in fasting period
  const inFastingPeriod =
    fastingConfig &&
    fastingConfig.schedule !== 'none' &&
    !isInEatingWindow(fastingConfig.eatingWindowStart, fastingConfig.eatingWindowEnd)

  // Calculate fasting ends in
  let fastingEndsIn: number | undefined
  if (inFastingPeriod && fastingConfig?.eatingWindowStart !== undefined) {
    const windowStart = fastingConfig.eatingWindowStart
    if (currentHour < windowStart) {
      fastingEndsIn = windowStart - currentHour
    } else {
      // Window starts tomorrow
      fastingEndsIn = 24 - currentHour + windowStart
    }
  }

  // Find next meal
  for (const mealType of mealsToRemind) {
    const mealHour = mealTimes[mealType]
    if (mealHour > currentHour || (mealHour === currentHour && currentMinutes < 30)) {
      const timeUntil = (mealHour - currentHour) * 60 - currentMinutes
      return {
        nextMeal: mealType,
        timeUntil,
        inFastingPeriod: inFastingPeriod || false,
        fastingEndsIn,
      }
    }
  }

  // No more meals today
  return {
    nextMeal: null,
    timeUntil: 0,
    inFastingPeriod: inFastingPeriod || false,
    fastingEndsIn,
  }
}
