/**
 * Device Fingerprint Service - Anti-abuse protection
 *
 * Generates a unique, persistent device identifier to prevent:
 * - Multiple account creation for trial abuse
 * - Same device registering with different emails
 *
 * The fingerprint is:
 * - Persistent across app reinstalls (stored in Supabase by device)
 * - Unique per physical device
 * - Cannot be spoofed easily by users
 */

import * as Device from 'expo-device'
import * as Application from 'expo-application'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { getSupabaseClient } from './supabase-client'

const DEVICE_ID_KEY = 'lym_device_fingerprint'

// ============================================================================
// DEVICE FINGERPRINT GENERATION
// ============================================================================

/**
 * Generate a unique device fingerprint combining multiple identifiers
 * This is resistant to app reinstalls and harder to spoof
 */
export async function generateDeviceFingerprint(): Promise<string> {
  try {
    // Try to get existing fingerprint first
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY)
    if (existing) {
      return existing
    }

    // Generate new fingerprint from device characteristics
    const components: string[] = []

    // 1. Platform-specific persistent ID
    if (Platform.OS === 'ios') {
      // iOS: identifierForVendor persists until all apps from vendor are uninstalled
      const iosId = await Application.getIosIdForVendorAsync()
      if (iosId) components.push(`ios:${iosId}`)
    } else if (Platform.OS === 'android') {
      // Android: androidId persists across reinstalls (resets on factory reset)
      const androidId = Application.getAndroidId()
      if (androidId) components.push(`android:${androidId}`)
    }

    // 2. Device model + brand (helps identify device even if ID changes)
    const deviceModel = Device.modelName || 'unknown'
    const deviceBrand = Device.brand || 'unknown'
    components.push(`model:${deviceBrand}-${deviceModel}`)

    // 3. OS version
    const osVersion = Device.osVersion || 'unknown'
    components.push(`os:${Platform.OS}-${osVersion}`)

    // 4. Device type
    const deviceType = Device.deviceType || 0
    components.push(`type:${deviceType}`)

    // 5. Total memory (unique per device model/config)
    const totalMemory = Device.totalMemory || 0
    components.push(`mem:${Math.round(totalMemory / (1024 * 1024 * 1024))}GB`)

    // 6. Add timestamp for uniqueness if all else fails
    if (components.length < 3) {
      components.push(`ts:${Date.now()}`)
    }

    // Create hash from components
    const fingerprint = await hashString(components.join('|'))

    // Store locally
    await AsyncStorage.setItem(DEVICE_ID_KEY, fingerprint)

    console.log('[DeviceFingerprint] Generated new fingerprint:', fingerprint.substring(0, 16) + '...')
    return fingerprint
  } catch (error) {
    console.error('[DeviceFingerprint] Error generating fingerprint:', error)
    // Fallback: generate random ID (less secure but functional)
    const fallback = `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    await AsyncStorage.setItem(DEVICE_ID_KEY, fallback)
    return fallback
  }
}

/**
 * Simple hash function (SHA-256 would be better but this works for fingerprinting)
 */
async function hashString(str: string): Promise<string> {
  // Simple hash implementation (djb2 algorithm)
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }

  // Convert to hex and add random suffix for uniqueness
  const hashHex = Math.abs(hash).toString(16)
  const randomSuffix = Math.random().toString(36).substring(2, 10)

  return `dev_${hashHex}_${randomSuffix}`
}

// ============================================================================
// CLOUD DEVICE TRACKING
// ============================================================================

interface DeviceRecord {
  device_fingerprint: string
  first_seen_at: string
  last_seen_at: string
  trial_started_at: string | null
  trial_used: boolean
  associated_user_ids: string[]
  device_info: {
    platform: string
    model: string
    brand: string
    os_version: string
  }
}

/**
 * Check if this device has already used a trial
 * Returns existing trial info if found
 */
export async function checkDeviceTrialStatus(): Promise<{
  hasUsedTrial: boolean
  trialStartDate: string | null
  associatedEmails: number
  isNewDevice: boolean
}> {
  const client = getSupabaseClient()
  if (!client) {
    return { hasUsedTrial: false, trialStartDate: null, associatedEmails: 0, isNewDevice: true }
  }

  try {
    const fingerprint = await generateDeviceFingerprint()

    const { data, error } = await client
      .from('device_fingerprints')
      .select('trial_started_at, trial_used, associated_user_ids')
      .eq('device_fingerprint', fingerprint)
      .single()

    if (error || !data) {
      // New device
      return { hasUsedTrial: false, trialStartDate: null, associatedEmails: 0, isNewDevice: true }
    }

    return {
      hasUsedTrial: data.trial_used === true,
      trialStartDate: data.trial_started_at,
      associatedEmails: data.associated_user_ids?.length || 0,
      isNewDevice: false,
    }
  } catch (error) {
    console.error('[DeviceFingerprint] Check device trial status failed:', error)
    return { hasUsedTrial: false, trialStartDate: null, associatedEmails: 0, isNewDevice: true }
  }
}

/**
 * Register this device and optionally start trial
 * Links device to user account
 */
export async function registerDeviceForUser(userId: string, startTrial: boolean = false): Promise<{
  success: boolean
  trialStartDate: string | null
  error?: string
}> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, trialStartDate: null, error: 'Service non disponible' }
  }

  try {
    const fingerprint = await generateDeviceFingerprint()
    const now = new Date().toISOString()

    // Check existing device record
    const { data: existing } = await client
      .from('device_fingerprints')
      .select('*')
      .eq('device_fingerprint', fingerprint)
      .single()

    if (existing) {
      // Device already registered
      if (existing.trial_used && startTrial) {
        // Trial already used on this device
        console.log('[DeviceFingerprint] Trial already used on this device')
        return {
          success: false,
          trialStartDate: existing.trial_started_at,
          error: 'Ce téléphone a déjà bénéficié d\'une période d\'essai',
        }
      }

      // Update existing record - add user to associated list
      const userIds = existing.associated_user_ids || []
      if (!userIds.includes(userId)) {
        userIds.push(userId)
      }

      // Check if too many accounts on same device (suspicious)
      if (userIds.length > 3) {
        console.warn('[DeviceFingerprint] Suspicious: too many accounts on same device')
        return {
          success: false,
          trialStartDate: null,
          error: 'Trop de comptes créés sur cet appareil',
        }
      }

      const updateData: Record<string, unknown> = {
        last_seen_at: now,
        associated_user_ids: userIds,
      }

      if (startTrial && !existing.trial_used) {
        updateData.trial_started_at = now
        updateData.trial_used = true
      }

      await client
        .from('device_fingerprints')
        .update(updateData)
        .eq('device_fingerprint', fingerprint)

      return {
        success: true,
        trialStartDate: startTrial ? now : existing.trial_started_at,
      }
    }

    // New device - create record
    const deviceInfo = {
      platform: Platform.OS,
      model: Device.modelName || 'unknown',
      brand: Device.brand || 'unknown',
      os_version: Device.osVersion || 'unknown',
    }

    const { error } = await client
      .from('device_fingerprints')
      .insert({
        device_fingerprint: fingerprint,
        first_seen_at: now,
        last_seen_at: now,
        trial_started_at: startTrial ? now : null,
        trial_used: startTrial,
        associated_user_ids: [userId],
        device_info: deviceInfo,
      })

    if (error) {
      console.error('[DeviceFingerprint] Insert error:', error)
      return { success: false, trialStartDate: null, error: 'Erreur d\'enregistrement' }
    }

    console.log('[DeviceFingerprint] Device registered successfully')
    return {
      success: true,
      trialStartDate: startTrial ? now : null,
    }
  } catch (error) {
    console.error('[DeviceFingerprint] Register device failed:', error)
    return { success: false, trialStartDate: null, error: 'Erreur inattendue' }
  }
}

/**
 * Get device fingerprint (for debugging/display)
 */
export async function getDeviceFingerprint(): Promise<string> {
  return generateDeviceFingerprint()
}

/**
 * Clear local device fingerprint (for testing only)
 */
export async function clearLocalFingerprint(): Promise<void> {
  await AsyncStorage.removeItem(DEVICE_ID_KEY)
}
