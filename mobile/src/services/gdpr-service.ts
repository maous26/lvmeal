/**
 * GDPR Compliance Service
 *
 * Provides comprehensive GDPR compliance features:
 * - Complete data deletion (right to be forgotten)
 * - Data export (data portability)
 * - Consent management
 * - Data retention policies
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Paths, File, Directory } from 'expo-file-system'
import { getSupabaseClient, isSupabaseConfigured } from './supabase-client'
import { clearEncryptionKeys } from './encryption-service'
import { clearKBCache } from './supabase-client'

// ============================================================================
// TYPES
// ============================================================================

export interface GDPRConsent {
  /** Consent for data processing */
  dataProcessing: boolean
  /** Consent for analytics tracking */
  analytics: boolean
  /** Consent for personalized recommendations */
  personalizedContent: boolean
  /** Consent for cloud sync */
  cloudSync: boolean
  /** Consent for health data collection */
  healthData: boolean
  /** Timestamp of last consent update */
  updatedAt: string
  /** Version of consent form */
  version: string
}

export interface DataExport {
  /** User profile data */
  profile: Record<string, unknown>
  /** Nutrition history */
  nutritionHistory: Record<string, unknown>[]
  /** Weight history */
  weightHistory: Record<string, unknown>[]
  /** Meal history */
  mealHistory: Record<string, unknown>[]
  /** Wellness data */
  wellnessHistory: Record<string, unknown>[]
  /** Settings and preferences */
  settings: Record<string, unknown>
  /** Export metadata */
  metadata: {
    exportedAt: string
    exportVersion: string
    dataRange: { from: string; to: string }
  }
}

export interface DeletionResult {
  success: boolean
  deletedItems: {
    localStorage: string[]
    cloudData: string[]
    encryptionKeys: boolean
    analytics: boolean
  }
  errors: string[]
  completedAt: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CONSENT_KEY = 'gdpr_consent'
const CONSENT_VERSION = '1.0.0'

// All AsyncStorage keys used by the app
const ALL_STORAGE_KEYS = [
  // User data
  'user_profile',
  'user_onboarded',
  'user_settings',
  // Nutrition data
  'nutrition_history',
  'meal_history',
  'weight_entries',
  'daily_nutrition',
  // Wellness data
  'wellness_data',
  'sleep_history',
  'hydration_history',
  // Coach data
  'coach_messages',
  'coach_insights',
  'coach_history',
  // Recipes
  'favorite_recipes',
  'custom_recipes',
  'meal_plans',
  // Cloud sync
  'cloud_user_id',
  'cloud_sync_queue',
  'cloud_last_sync',
  // Cache
  'kb_query_cache',
  'embedding_cache',
  'ai_response_cache',
  // Auth
  'auth_token',
  'auth_user',
  'google_auth_cache',
  'email_auth_cache',
  // Programs
  'program_progress',
  'metabolic_boost_state',
  // Settings
  'notification_settings',
  'meal_source_settings',
  'scale_settings',
  // Consent
  'gdpr_consent',
  'encryption_config',
] as const

// Cloud tables to delete from
const CLOUD_TABLES = [
  'user_profiles',
  'nutrition_logs',
  'weight_entries',
  'meal_logs',
  'wellness_logs',
  'chat_history',
  'user_preferences',
  'user_programs',
] as const

// ============================================================================
// CONSENT MANAGEMENT
// ============================================================================

/**
 * Get current GDPR consent settings
 */
export async function getGDPRConsent(): Promise<GDPRConsent | null> {
  try {
    const stored = await AsyncStorage.getItem(CONSENT_KEY)
    if (!stored) return null
    return JSON.parse(stored) as GDPRConsent
  } catch (error) {
    console.error('[GDPR] Failed to get consent:', error)
    return null
  }
}

/**
 * Save GDPR consent settings
 */
export async function saveGDPRConsent(consent: Omit<GDPRConsent, 'updatedAt' | 'version'>): Promise<void> {
  const fullConsent: GDPRConsent = {
    ...consent,
    updatedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  }

  await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(fullConsent))
  console.log('[GDPR] Consent saved')
}

/**
 * Check if user has given required consents
 */
export async function hasRequiredConsents(): Promise<boolean> {
  const consent = await getGDPRConsent()
  if (!consent) return false
  return consent.dataProcessing
}

/**
 * Check if a specific consent is given
 */
export async function hasConsent(type: keyof Omit<GDPRConsent, 'updatedAt' | 'version'>): Promise<boolean> {
  const consent = await getGDPRConsent()
  if (!consent) return false
  return consent[type] === true
}

// ============================================================================
// DATA EXPORT (Article 20 - Data Portability)
// ============================================================================

/**
 * Export all user data in machine-readable format
 */
export async function exportAllUserData(): Promise<DataExport> {
  console.log('[GDPR] Starting data export...')

  const exportData: DataExport = {
    profile: {},
    nutritionHistory: [],
    weightHistory: [],
    mealHistory: [],
    wellnessHistory: [],
    settings: {},
    metadata: {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0',
      dataRange: { from: '', to: '' },
    },
  }

  try {
    // Export local storage data
    const profileStr = await AsyncStorage.getItem('user_profile')
    if (profileStr) exportData.profile = JSON.parse(profileStr)

    const nutritionStr = await AsyncStorage.getItem('nutrition_history')
    if (nutritionStr) exportData.nutritionHistory = JSON.parse(nutritionStr)

    const weightStr = await AsyncStorage.getItem('weight_entries')
    if (weightStr) exportData.weightHistory = JSON.parse(weightStr)

    const mealStr = await AsyncStorage.getItem('meal_history')
    if (mealStr) exportData.mealHistory = JSON.parse(mealStr)

    const wellnessStr = await AsyncStorage.getItem('wellness_data')
    if (wellnessStr) exportData.wellnessHistory = JSON.parse(wellnessStr)

    const settingsStr = await AsyncStorage.getItem('user_settings')
    if (settingsStr) exportData.settings = JSON.parse(settingsStr)

    // Calculate data range
    const allDates: string[] = []
    ;[...exportData.nutritionHistory, ...exportData.weightHistory, ...exportData.mealHistory].forEach((item) => {
      if (item && typeof item === 'object' && 'date' in item) {
        allDates.push(item.date as string)
      }
    })

    if (allDates.length > 0) {
      allDates.sort()
      exportData.metadata.dataRange.from = allDates[0]
      exportData.metadata.dataRange.to = allDates[allDates.length - 1]
    }

    // Export from cloud if configured
    if (isSupabaseConfigured()) {
      const cloudData = await exportCloudData()
      if (cloudData) {
        // Merge cloud data with local data
        exportData.nutritionHistory = mergeDataArrays(exportData.nutritionHistory, cloudData.nutritionHistory || [])
        exportData.weightHistory = mergeDataArrays(exportData.weightHistory, cloudData.weightHistory || [])
        exportData.mealHistory = mergeDataArrays(exportData.mealHistory, cloudData.mealHistory || [])
      }
    }

    console.log('[GDPR] Data export completed')
    return exportData
  } catch (error) {
    console.error('[GDPR] Export failed:', error)
    throw new Error('Failed to export user data')
  }
}

/**
 * Export cloud data
 */
async function exportCloudData(): Promise<Partial<DataExport> | null> {
  const client = getSupabaseClient()
  if (!client) return null

  try {
    const userId = await AsyncStorage.getItem('cloud_user_id')
    if (!userId) return null

    const result: Partial<DataExport> = {
      nutritionHistory: [],
      weightHistory: [],
      mealHistory: [],
    }

    // Export from each table
    const { data: nutritionData } = await client
      .from('nutrition_logs')
      .select('*')
      .eq('user_id', userId)

    if (nutritionData) result.nutritionHistory = nutritionData

    const { data: weightData } = await client
      .from('weight_entries')
      .select('*')
      .eq('user_id', userId)

    if (weightData) result.weightHistory = weightData

    const { data: mealData } = await client
      .from('meal_logs')
      .select('*')
      .eq('user_id', userId)

    if (mealData) result.mealHistory = mealData

    return result
  } catch (error) {
    console.error('[GDPR] Cloud export failed:', error)
    return null
  }
}

/**
 * Save export to file
 */
export async function saveExportToFile(data: DataExport): Promise<string> {
  const fileName = `lym_data_export_${new Date().toISOString().split('T')[0]}.json`
  const exportDir = new Directory(Paths.document, 'exports')

  // Create exports directory if it doesn't exist
  if (!exportDir.exists) {
    exportDir.create()
  }

  const file = new File(exportDir, fileName)
  const content = JSON.stringify(data, null, 2)
  const encoder = new TextEncoder()
  file.write(encoder.encode(content))

  console.log('[GDPR] Export saved to:', file.uri)
  return file.uri
}

// ============================================================================
// DATA DELETION (Article 17 - Right to be Forgotten)
// ============================================================================

/**
 * Delete ALL user data from the app and cloud
 * This is irreversible!
 */
export async function deleteAllUserData(): Promise<DeletionResult> {
  console.log('[GDPR] Starting complete data deletion...')

  const result: DeletionResult = {
    success: false,
    deletedItems: {
      localStorage: [],
      cloudData: [],
      encryptionKeys: false,
      analytics: false,
    },
    errors: [],
    completedAt: '',
  }

  // 1. Delete local storage
  try {
    for (const key of ALL_STORAGE_KEYS) {
      try {
        await AsyncStorage.removeItem(key)
        result.deletedItems.localStorage.push(key)
      } catch (error) {
        result.errors.push(`Failed to delete local key: ${key}`)
      }
    }
    console.log('[GDPR] Local storage cleared')
  } catch (error) {
    result.errors.push('Failed to clear local storage')
  }

  // 2. Delete cloud data
  if (isSupabaseConfigured()) {
    const cloudUserId = await getCloudUserIdBeforeDeletion()
    if (cloudUserId) {
      for (const table of CLOUD_TABLES) {
        try {
          await deleteFromCloudTable(table, cloudUserId)
          result.deletedItems.cloudData.push(table)
        } catch (error) {
          result.errors.push(`Failed to delete from cloud table: ${table}`)
        }
      }
      console.log('[GDPR] Cloud data deleted')
    }
  }

  // 3. Clear encryption keys
  try {
    await clearEncryptionKeys()
    result.deletedItems.encryptionKeys = true
    console.log('[GDPR] Encryption keys cleared')
  } catch (error) {
    result.errors.push('Failed to clear encryption keys')
  }

  // 4. Clear KB cache
  try {
    await clearKBCache()
    console.log('[GDPR] KB cache cleared')
  } catch (error) {
    result.errors.push('Failed to clear KB cache')
  }

  // 5. Clear cached files
  try {
    await clearCachedFiles()
    console.log('[GDPR] Cached files cleared')
  } catch (error) {
    result.errors.push('Failed to clear cached files')
  }

  // 6. Reset analytics (if applicable)
  try {
    await resetAnalytics()
    result.deletedItems.analytics = true
    console.log('[GDPR] Analytics reset')
  } catch (error) {
    result.errors.push('Failed to reset analytics')
  }

  result.success = result.errors.length === 0
  result.completedAt = new Date().toISOString()

  console.log('[GDPR] Deletion completed:', result.success ? 'SUCCESS' : 'PARTIAL', `(${result.errors.length} errors)`)
  return result
}

/**
 * Get cloud user ID before deletion (since it will be deleted)
 */
async function getCloudUserIdBeforeDeletion(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem('cloud_user_id')
  } catch {
    return null
  }
}

/**
 * Delete data from a specific cloud table
 */
async function deleteFromCloudTable(tableName: string, userId: string): Promise<void> {
  const client = getSupabaseClient()
  if (!client) return

  const { error } = await client.from(tableName).delete().eq('user_id', userId)

  if (error) {
    console.error(`[GDPR] Failed to delete from ${tableName}:`, error)
    throw error
  }
}

/**
 * Clear all cached files from the cache directory
 */
async function clearCachedFiles(): Promise<void> {
  try {
    const cacheDir = new Directory(Paths.cache)
    if (!cacheDir.exists) return

    // List and delete all files in cache
    const items = cacheDir.list()
    for (const item of items) {
      try {
        item.delete()
      } catch {
        // Ignore individual file deletion errors
      }
    }
  } catch (error) {
    console.warn('[GDPR] Cache clear warning:', error)
  }
}

/**
 * Reset analytics tracking
 */
async function resetAnalytics(): Promise<void> {
  // Import dynamically to avoid circular dependencies
  try {
    const amplitude = await import('@amplitude/analytics-react-native')
    amplitude.reset()
    console.log('[GDPR] Amplitude reset')
  } catch (error) {
    console.warn('[GDPR] Amplitude reset not available')
  }
}

// ============================================================================
// DATA RETENTION
// ============================================================================

/**
 * Apply data retention policies
 * Automatically deletes data older than retention period
 */
export async function applyDataRetentionPolicy(retentionDays: number = 365 * 2): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)
  const cutoffISO = cutoffDate.toISOString()

  let deletedCount = 0

  // Clean up old nutrition history
  deletedCount += await cleanupOldData('nutrition_history', cutoffISO)

  // Clean up old meal history
  deletedCount += await cleanupOldData('meal_history', cutoffISO)

  // Clean up old wellness data
  deletedCount += await cleanupOldData('wellness_data', cutoffISO)

  console.log(`[GDPR] Data retention applied: ${deletedCount} old records removed`)
  return deletedCount
}

/**
 * Clean up old data from a specific storage key
 */
async function cleanupOldData(key: string, cutoffDate: string): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(key)
    if (!stored) return 0

    const data = JSON.parse(stored) as Record<string, unknown>[]
    const originalLength = data.length

    const filtered = data.filter((item) => {
      if (item && typeof item === 'object' && 'date' in item) {
        return (item.date as string) >= cutoffDate
      }
      return true // Keep items without dates
    })

    if (filtered.length !== originalLength) {
      await AsyncStorage.setItem(key, JSON.stringify(filtered))
      return originalLength - filtered.length
    }

    return 0
  } catch (error) {
    console.error(`[GDPR] Failed to cleanup ${key}:`, error)
    return 0
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Merge two data arrays, removing duplicates by ID
 */
function mergeDataArrays(
  local: Record<string, unknown>[],
  cloud: Record<string, unknown>[]
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>()

  for (const item of [...local, ...cloud]) {
    const id = (item.id as string) || (item.date as string) || JSON.stringify(item)
    if (!map.has(id)) {
      map.set(id, item)
    }
  }

  return Array.from(map.values())
}

/**
 * Anonymize user data (alternative to deletion for statistical purposes)
 */
export async function anonymizeUserData(): Promise<void> {
  // Get profile and remove identifiable information
  const profileStr = await AsyncStorage.getItem('user_profile')
  if (profileStr) {
    const profile = JSON.parse(profileStr)

    // Remove PII
    delete profile.name
    delete profile.email
    delete profile.birthDate
    delete profile.phone

    // Keep anonymous health data for statistics
    await AsyncStorage.setItem('user_profile', JSON.stringify(profile))
  }

  console.log('[GDPR] User data anonymized')
}

// ============================================================================
// EXPORTS
// ============================================================================

export const gdprService = {
  // Consent
  getGDPRConsent,
  saveGDPRConsent,
  hasRequiredConsents,
  hasConsent,

  // Export
  exportAllUserData,
  saveExportToFile,

  // Deletion
  deleteAllUserData,
  anonymizeUserData,

  // Retention
  applyDataRetentionPolicy,
}

export default gdprService
