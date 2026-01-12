/**
 * Cloud Sync Service - Backup & Restore for LYM App
 *
 * Handles user data synchronization with Supabase:
 * - Profile data
 * - Meals & nutrition history
 * - Weight history
 * - Gamification progress (XP, achievements, streaks)
 * - Wellness data
 * - Meal plans
 *
 * Features:
 * - Automatic sync on data changes
 * - Conflict resolution (last-write-wins)
 * - Offline support with queue
 * - Restore on new device
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabase-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { UserProfile, WeightEntry, NutritionInfo } from '../types'

// ============================================================================
// TYPES
// ============================================================================

export interface CloudUserData {
  id: string
  user_id: string
  // Profile
  profile: Partial<UserProfile>
  // Nutrition goals
  nutrition_goals: {
    calories: number
    proteins: number
    carbs: number
    fats: number
    sportCaloriesBonus?: number
  } | null
  // Settings
  notification_preferences: {
    dailyInsightsEnabled: boolean
    alertsEnabled: boolean
    celebrationsEnabled: boolean
    lastNotificationDate: string | null
  }
  // Timestamps
  created_at: string
  updated_at: string
  last_sync_at: string
}

export interface CloudWeightEntry {
  id: string
  user_id: string
  date: string
  weight: number
  body_fat_percent?: number
  muscle_mass?: number
  bmi?: number
  source: 'manual' | 'scale' | 'healthkit'
  notes?: string
  created_at: string
}

export interface CloudMealEntry {
  id: string
  user_id: string
  date: string
  meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  items: Array<{
    name: string
    quantity: number
    unit: string
    calories: number
    proteins: number
    carbs: number
    fats: number
    source?: string
  }>
  total_calories: number
  total_proteins: number
  total_carbs: number
  total_fats: number
  photo_url?: string
  notes?: string
  created_at: string
}

export interface CloudGamificationData {
  id: string
  user_id: string
  // XP
  total_xp: number
  weekly_xp: number
  weekly_xp_reset_date: string
  // Streaks
  current_streak: number
  longest_streak: number
  last_activity_date: string
  // Trial tracking - CANNOT be reset by user
  trial_start_date: string | null  // When user first registered (immutable)
  trial_used: boolean              // True once trial has been started
  // Achievements
  unlocked_achievements: string[]
  // AI Credits
  ai_credits_remaining: number
  is_premium: boolean
  // Timestamps
  updated_at: string
}

export interface CloudWellnessData {
  id: string
  user_id: string
  date: string
  // Sleep
  sleep_hours?: number
  sleep_quality?: number
  // Energy & Stress
  energy_level?: number
  stress_level?: number
  // Mood
  mood?: string
  // Notes
  notes?: string
  created_at: string
}

export interface SyncStatus {
  lastSyncAt: string | null
  pendingChanges: number
  isOnline: boolean
  isSyncing: boolean
  lastError: string | null
}

export interface SyncQueueItem {
  id: string
  type: 'profile' | 'weight' | 'meal' | 'gamification' | 'wellness' | 'feedback'
  action: 'upsert' | 'delete'
  data: unknown
  timestamp: string
  retries: number
}

export interface CloudFeedbackEntry {
  id: string
  user_id: string
  feedback_type: 'paywall' | 'general'
  response?: string        // For paywall: 'would_pay', 'not_now', etc.
  reason?: string          // Optional custom reason
  days_since_signup?: number
  message?: string         // For general feedback
  screen?: string
  created_at: string
}

// Data returned when restoring from cloud
export interface CloudRestoreData {
  profile: CloudUserData | null
  weights: CloudWeightEntry[]
  meals: CloudMealEntry[]
  gamification: CloudGamificationData | null
  wellness: CloudWellnessData[]
}

// ============================================================================
// SYNC QUEUE MANAGEMENT
// ============================================================================

const SYNC_QUEUE_KEY = 'lym-sync-queue'
const LAST_SYNC_KEY = 'lym-last-sync'
const USER_ID_KEY = 'lym-cloud-user-id'

let syncQueue: SyncQueueItem[] = []
let isSyncing = false

/**
 * Load sync queue from storage
 */
async function loadSyncQueue(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY)
    if (stored) {
      syncQueue = JSON.parse(stored)
    }
  } catch (error) {
    console.error('[CloudSync] Failed to load sync queue:', error)
  }
}

/**
 * Save sync queue to storage
 */
async function saveSyncQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue))
  } catch (error) {
    console.error('[CloudSync] Failed to save sync queue:', error)
  }
}

/**
 * Add item to sync queue
 */
export function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retries'>): void {
  const queueItem: SyncQueueItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    retries: 0,
  }
  syncQueue.push(queueItem)
  saveSyncQueue()

  // Try to sync immediately if online
  processSyncQueue()
}

// ============================================================================
// USER AUTHENTICATION
// ============================================================================

/**
 * Get or create anonymous user ID for cloud sync
 * In production, replace with proper Supabase Auth
 */
export async function getCloudUserId(): Promise<string | null> {
  try {
    let userId = await AsyncStorage.getItem(USER_ID_KEY)

    if (!userId) {
      // Generate anonymous user ID
      // In production, use Supabase Auth for proper authentication
      userId = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await AsyncStorage.setItem(USER_ID_KEY, userId)
      console.log('[CloudSync] Created new anonymous user:', userId)
    }

    return userId
  } catch (error) {
    console.error('[CloudSync] Failed to get user ID:', error)
    return null
  }
}

/**
 * Sign in with email (Supabase Auth)
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; user?: { id: string; email: string }; error?: string }> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, error: 'Service non disponible' }
  }

  // Clean email (remove whitespace, invisible characters, and normalize)
  const cleanEmail = email
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '') // Remove invisible Unicode chars
    .trim()
    .toLowerCase()

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (error) {
      // Translate common error messages to French
      if (error.message.includes('Invalid login credentials')) {
        return { success: false, error: 'Email ou mot de passe incorrect' }
      }
      if (error.message.includes('Email not confirmed')) {
        return { success: false, error: 'Vérifie ton email avant de te connecter' }
      }
      if (error.message.includes('invalid format') ||
          error.message.includes('Unable to validate')) {
        return { success: false, error: 'Format d\'email invalide' }
      }
      return { success: false, error: error.message }
    }

    if (data.user) {
      await AsyncStorage.setItem(USER_ID_KEY, data.user.id)
      return {
        success: true,
        user: { id: data.user.id, email: data.user.email || cleanEmail },
      }
    }

    return { success: false, error: 'Erreur inconnue' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Sign up with email (Supabase Auth)
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; user?: { id: string; email: string }; needsVerification?: boolean; error?: string }> {
  const client = getSupabaseClient()

  console.log('[CloudSync] signUpWithEmail - Supabase configured:', !!client)

  if (!client) {
    console.error('[CloudSync] signUpWithEmail - Supabase client is NULL')
    return { success: false, error: 'Service non disponible' }
  }

  // Clean email (remove whitespace, invisible characters, and normalize)
  // Remove RTL/LTR marks, zero-width characters, and other invisible Unicode
  const cleanEmail = email
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '') // Remove invisible Unicode chars
    .trim()
    .toLowerCase()

  // Log the email for debugging (masking part of it for privacy)
  const maskedEmail = cleanEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3')
  console.log('[CloudSync] signUpWithEmail - Email:', maskedEmail, 'Length:', cleanEmail.length)
  console.log('[CloudSync] signUpWithEmail - Email bytes:', JSON.stringify(cleanEmail))

  // Basic email validation before sending to Supabase
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(cleanEmail)) {
    console.error('[CloudSync] signUpWithEmail - Local email validation failed')
    return { success: false, error: 'Format d\'email invalide' }
  }

  // Backend URL for auth redirects
  const AUTH_REDIRECT_BASE = 'https://lym1-production.up.railway.app'

  try {
    console.log('[CloudSync] signUpWithEmail - Calling Supabase signUp...')
    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${AUTH_REDIRECT_BASE}/auth/callback`,
      },
    })

    console.log('[CloudSync] signUpWithEmail - Response:', { hasData: !!data, hasError: !!error, errorMsg: error?.message })

    if (error) {
      console.error('[CloudSync] signUpWithEmail - Supabase error:', error.message, error)

      // Handle API key/configuration errors
      if (error.message.includes('Invalid API key') ||
          error.message.includes('401') ||
          error.message.includes('Unauthorized')) {
        return {
          success: false,
          error: 'Service temporairement indisponible. Réessaie plus tard.',
        }
      }
      // Handle "already registered" error with a helpful message
      if (error.message.includes('already registered') ||
          error.message.includes('already been registered')) {
        return {
          success: false,
          error: 'Cette adresse email est déjà utilisée. Essaie de te connecter.',
        }
      }
      // Handle invalid email format
      if (error.message.includes('invalid format') ||
          error.message.includes('Unable to validate')) {
        return {
          success: false,
          error: 'Format d\'email invalide. Vérifie ton adresse.',
        }
      }
      return { success: false, error: error.message }
    }

    if (data.user) {
      await AsyncStorage.setItem(USER_ID_KEY, data.user.id)

      // Check if email confirmation is required
      const needsVerification = !data.user.email_confirmed_at

      return {
        success: true,
        user: { id: data.user.id, email: data.user.email || email },
        needsVerification,
      }
    }

    return { success: false, error: 'Erreur inconnue' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  const client = getSupabaseClient()
  if (client) {
    await client.auth.signOut()
  }
  // Keep anonymous ID for local data
}

/**
 * Get current auth session
 */
export async function getAuthSession() {
  const client = getSupabaseClient()
  if (!client) return null

  const { data } = await client.auth.getSession()
  return data.session
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Sync profile data to cloud
 */
export async function syncProfile(profile: Partial<UserProfile>, nutritionGoals: CloudUserData['nutrition_goals'], notificationPrefs: CloudUserData['notification_preferences']): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) return false

  const userId = await getCloudUserId()
  if (!userId) return false

  try {
    const { error } = await client
      .from('user_data')
      .upsert({
        user_id: userId,
        profile,
        nutrition_goals: nutritionGoals,
        notification_preferences: notificationPrefs,
        updated_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (error) {
      console.error('[CloudSync] Profile sync error:', error)
      return false
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString())
    console.log('[CloudSync] Profile synced successfully')
    return true
  } catch (error) {
    console.error('[CloudSync] Profile sync failed:', error)
    return false
  }
}

/**
 * Sync weight entry to cloud
 */
export async function syncWeightEntry(entry: WeightEntry): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) return false

  const userId = await getCloudUserId()
  if (!userId) return false

  try {
    const { error } = await client
      .from('weight_entries')
      .upsert({
        id: entry.id,
        user_id: userId,
        date: entry.date,
        weight: entry.weight,
        body_fat_percent: entry.bodyFatPercent,
        bmi: entry.bmi,
        source: entry.source || 'manual',
        notes: entry.note,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      })

    if (error) {
      console.error('[CloudSync] Weight sync error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[CloudSync] Weight sync failed:', error)
    return false
  }
}

/**
 * Sync meal entry to cloud
 */
export async function syncMealEntry(date: string, mealType: string, items: CloudMealEntry['items'], totals: NutritionInfo): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) return false

  const userId = await getCloudUserId()
  if (!userId) return false

  try {
    const mealId = `${userId}_${date}_${mealType}`

    const { error } = await client
      .from('meal_entries')
      .upsert({
        id: mealId,
        user_id: userId,
        date,
        meal_type: mealType,
        items,
        total_calories: totals.calories,
        total_proteins: totals.proteins,
        total_carbs: totals.carbs,
        total_fats: totals.fats,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      })

    if (error) {
      console.error('[CloudSync] Meal sync error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[CloudSync] Meal sync failed:', error)
    return false
  }
}

/**
 * Sync gamification data to cloud
 */
export async function syncGamification(data: Omit<CloudGamificationData, 'id' | 'user_id' | 'updated_at'>): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) return false

  const userId = await getCloudUserId()
  if (!userId) return false

  try {
    const { error } = await client
      .from('gamification_data')
      .upsert({
        user_id: userId,
        ...data,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (error) {
      console.error('[CloudSync] Gamification sync error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[CloudSync] Gamification sync failed:', error)
    return false
  }
}

/**
 * Sync wellness data to cloud
 */
export async function syncWellness(date: string, data: Partial<CloudWellnessData>): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) return false

  const userId = await getCloudUserId()
  if (!userId) return false

  try {
    const wellnessId = `${userId}_${date}`

    const { error } = await client
      .from('wellness_entries')
      .upsert({
        id: wellnessId,
        user_id: userId,
        date,
        ...data,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'id',
      })

    if (error) {
      console.error('[CloudSync] Wellness sync error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[CloudSync] Wellness sync failed:', error)
    return false
  }
}

/**
 * Sync feedback to cloud (paywall or general feedback)
 */
export async function syncFeedback(data: Omit<CloudFeedbackEntry, 'user_id'>): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) return false

  const userId = await getCloudUserId()
  if (!userId) return false

  try {
    const { error } = await client
      .from('feedbacks')
      .upsert({
        ...data,
        user_id: userId,
      }, {
        onConflict: 'id',
      })

    if (error) {
      console.error('[CloudSync] Feedback sync error:', error)
      return false
    }

    console.log('[CloudSync] Feedback synced successfully:', data.feedback_type)
    return true
  } catch (error) {
    console.error('[CloudSync] Feedback sync failed:', error)
    return false
  }
}

// ============================================================================
// TRIAL MANAGEMENT - Anti-abuse protection
// ============================================================================

/**
 * Check if user has already used their trial period
 * This is stored in the cloud and CANNOT be reset by reinstalling the app
 */
export async function checkTrialStatus(): Promise<{
  hasUsedTrial: boolean
  trialStartDate: string | null
  isEligibleForTrial: boolean
}> {
  const client = getSupabaseClient()
  if (!client) {
    return { hasUsedTrial: false, trialStartDate: null, isEligibleForTrial: true }
  }

  const userId = await getCloudUserId()
  if (!userId) {
    return { hasUsedTrial: false, trialStartDate: null, isEligibleForTrial: true }
  }

  try {
    const { data, error } = await client
      .from('gamification_data')
      .select('trial_start_date, trial_used')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // No record = new user, eligible for trial
      return { hasUsedTrial: false, trialStartDate: null, isEligibleForTrial: true }
    }

    const hasUsedTrial = data.trial_used === true
    const trialStartDate = data.trial_start_date

    // User is eligible only if they haven't used trial before
    return {
      hasUsedTrial,
      trialStartDate,
      isEligibleForTrial: !hasUsedTrial,
    }
  } catch (error) {
    console.error('[CloudSync] Check trial status failed:', error)
    return { hasUsedTrial: false, trialStartDate: null, isEligibleForTrial: true }
  }
}

/**
 * Start the trial period for a user - can only be done ONCE per account
 * The trial_start_date is immutable once set
 */
export async function startTrialInCloud(): Promise<{
  success: boolean
  trialStartDate: string | null
  error?: string
}> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, trialStartDate: null, error: 'Service non disponible' }
  }

  const userId = await getCloudUserId()
  if (!userId) {
    return { success: false, trialStartDate: null, error: 'Non authentifié' }
  }

  try {
    // First check if trial already used
    const { data: existing } = await client
      .from('gamification_data')
      .select('trial_start_date, trial_used')
      .eq('user_id', userId)
      .single()

    if (existing?.trial_used) {
      // Trial already used - return existing start date
      console.log('[CloudSync] Trial already used for this account')
      return {
        success: false,
        trialStartDate: existing.trial_start_date,
        error: 'Tu as déjà bénéficié de la période d\'essai avec ce compte',
      }
    }

    // Start trial - set immutable trial_start_date
    const now = new Date().toISOString()
    const { error } = await client
      .from('gamification_data')
      .upsert({
        user_id: userId,
        trial_start_date: now,
        trial_used: true,
        updated_at: now,
      }, {
        onConflict: 'user_id',
        // Only update if trial_used is false (prevent race conditions)
      })

    if (error) {
      console.error('[CloudSync] Start trial error:', error)
      return { success: false, trialStartDate: null, error: 'Erreur lors du démarrage de l\'essai' }
    }

    console.log('[CloudSync] Trial started successfully at:', now)
    return { success: true, trialStartDate: now }
  } catch (error) {
    console.error('[CloudSync] Start trial failed:', error)
    return { success: false, trialStartDate: null, error: 'Erreur inattendue' }
  }
}

// ============================================================================
// RESTORE OPERATIONS
// ============================================================================

/**
 * Restore all user data from cloud
 */
export async function restoreFromCloud(): Promise<{
  profile: CloudUserData | null
  weights: CloudWeightEntry[]
  meals: CloudMealEntry[]
  gamification: CloudGamificationData | null
  wellness: CloudWellnessData[]
} | null> {
  const client = getSupabaseClient()
  if (!client) return null

  const userId = await getCloudUserId()
  if (!userId) return null

  try {
    // Fetch all data in parallel
    const [profileRes, weightsRes, mealsRes, gamificationRes, wellnessRes] = await Promise.all([
      client.from('user_data').select('*').eq('user_id', userId).single(),
      client.from('weight_entries').select('*').eq('user_id', userId).order('date', { ascending: false }),
      client.from('meal_entries').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(100),
      client.from('gamification_data').select('*').eq('user_id', userId).single(),
      client.from('wellness_entries').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(30),
    ])

    return {
      profile: profileRes.data as CloudUserData | null,
      weights: (weightsRes.data || []) as CloudWeightEntry[],
      meals: (mealsRes.data || []) as CloudMealEntry[],
      gamification: gamificationRes.data as CloudGamificationData | null,
      wellness: (wellnessRes.data || []) as CloudWellnessData[],
    }
  } catch (error) {
    console.error('[CloudSync] Restore failed:', error)
    return null
  }
}

/**
 * Get last sync timestamp
 */
export async function getLastSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY)
  } catch {
    return null
  }
}

// ============================================================================
// SYNC QUEUE PROCESSING
// ============================================================================

/**
 * Process pending sync queue
 */
export async function processSyncQueue(): Promise<void> {
  if (isSyncing || syncQueue.length === 0) return
  if (!isSupabaseConfigured()) return

  isSyncing = true
  console.log(`[CloudSync] Processing ${syncQueue.length} pending items`)

  const processedIds: string[] = []

  for (const item of syncQueue) {
    try {
      let success = false

      switch (item.type) {
        case 'profile':
          success = await syncProfile(
            (item.data as { profile: Partial<UserProfile> }).profile,
            (item.data as { nutritionGoals: CloudUserData['nutrition_goals'] }).nutritionGoals,
            (item.data as { notificationPrefs: CloudUserData['notification_preferences'] }).notificationPrefs
          )
          break
        case 'weight':
          success = await syncWeightEntry(item.data as WeightEntry)
          break
        case 'feedback':
          success = await syncFeedback(item.data as Omit<CloudFeedbackEntry, 'user_id'>)
          break
        // Add other cases as needed
      }

      if (success) {
        processedIds.push(item.id)
      } else {
        item.retries++
        if (item.retries >= 3) {
          console.warn(`[CloudSync] Item ${item.id} failed after 3 retries, removing`)
          processedIds.push(item.id)
        }
      }
    } catch (error) {
      console.error(`[CloudSync] Error processing item ${item.id}:`, error)
      item.retries++
    }
  }

  // Remove processed items
  syncQueue = syncQueue.filter(item => !processedIds.includes(item.id))
  await saveSyncQueue()

  isSyncing = false
  console.log(`[CloudSync] Queue processing complete. ${syncQueue.length} items remaining`)
}

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  await loadSyncQueue()

  return {
    lastSyncAt: await getLastSyncTime(),
    pendingChanges: syncQueue.length,
    isOnline: isSupabaseConfigured(),
    isSyncing,
    lastError: null,
  }
}

// ============================================================================
// FULL BACKUP & RESTORE
// ============================================================================

/**
 * Create a full local backup
 */
export async function createLocalBackup(): Promise<string> {
  const keys = [
    'presence-user',
    'presence-meals',
    'presence-gamification',
    'presence-wellness',
    'presence-meal-plan',
    'presence-meditation',
    'presence-coach',
  ]

  const backupData: Record<string, unknown> = {}

  for (const key of keys) {
    try {
      const value = await AsyncStorage.getItem(key)
      if (value) {
        backupData[key] = JSON.parse(value)
      }
    } catch (error) {
      console.warn(`[CloudSync] Could not backup ${key}:`, error)
    }
  }

  const backup = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    data: backupData,
  }

  return JSON.stringify(backup, null, 2)
}

/**
 * Restore from local backup
 */
export async function restoreLocalBackup(backupJson: string): Promise<boolean> {
  try {
    const backup = JSON.parse(backupJson)

    if (!backup.version || !backup.data) {
      throw new Error('Invalid backup format')
    }

    for (const [key, value] of Object.entries(backup.data)) {
      await AsyncStorage.setItem(key, JSON.stringify(value))
    }

    console.log('[CloudSync] Local backup restored successfully')
    return true
  } catch (error) {
    console.error('[CloudSync] Restore failed:', error)
    return false
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize cloud sync service
 */
export async function initCloudSync(): Promise<void> {
  await loadSyncQueue()

  // Process any pending items
  if (syncQueue.length > 0) {
    processSyncQueue()
  }

  console.log('[CloudSync] Service initialized')
}

// Auto-initialize when module loads
loadSyncQueue()
