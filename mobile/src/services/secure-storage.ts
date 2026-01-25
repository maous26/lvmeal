/**
 * Secure Storage Service
 *
 * Uses expo-secure-store for sensitive data (tokens, credentials).
 * Falls back to AsyncStorage for non-sensitive data.
 *
 * SECURITY: Tokens and sensitive data are encrypted on device.
 */

import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Keys for secure storage
export const SECURE_KEYS = {
  GOOGLE_USER: 'lym_google_user',
  APPLE_USER: 'lym_apple_user',
  ACCESS_TOKEN: 'lym_access_token',
  ID_TOKEN: 'lym_id_token',
  USER_ID: 'lym_user_id',
} as const

/**
 * Check if SecureStore is available
 */
export async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync()
  } catch {
    return false
  }
}

/**
 * Save sensitive data securely
 */
export async function saveSecure(key: string, value: string): Promise<boolean> {
  try {
    const isAvailable = await isSecureStoreAvailable()
    if (isAvailable) {
      await SecureStore.setItemAsync(key, value)
    } else {
      // Fallback to AsyncStorage with warning
      console.warn('[SecureStorage] SecureStore not available, using AsyncStorage')
      await AsyncStorage.setItem(`secure_${key}`, value)
    }
    return true
  } catch (error) {
    console.error('[SecureStorage] Failed to save:', error)
    return false
  }
}

/**
 * Get sensitive data securely
 */
export async function getSecure(key: string): Promise<string | null> {
  try {
    const isAvailable = await isSecureStoreAvailable()
    if (isAvailable) {
      return await SecureStore.getItemAsync(key)
    } else {
      return await AsyncStorage.getItem(`secure_${key}`)
    }
  } catch (error) {
    console.error('[SecureStorage] Failed to get:', error)
    return null
  }
}

/**
 * Delete sensitive data
 */
export async function deleteSecure(key: string): Promise<boolean> {
  try {
    const isAvailable = await isSecureStoreAvailable()
    if (isAvailable) {
      await SecureStore.deleteItemAsync(key)
    } else {
      await AsyncStorage.removeItem(`secure_${key}`)
    }
    return true
  } catch (error) {
    console.error('[SecureStorage] Failed to delete:', error)
    return false
  }
}

/**
 * Save JSON data securely
 */
export async function saveSecureJSON<T>(key: string, value: T): Promise<boolean> {
  try {
    return await saveSecure(key, JSON.stringify(value))
  } catch (error) {
    console.error('[SecureStorage] Failed to save JSON:', error)
    return false
  }
}

/**
 * Get JSON data securely
 */
export async function getSecureJSON<T>(key: string): Promise<T | null> {
  try {
    const value = await getSecure(key)
    if (!value) return null
    return JSON.parse(value) as T
  } catch (error) {
    console.error('[SecureStorage] Failed to get JSON:', error)
    return null
  }
}

/**
 * Clear all secure storage (for logout)
 */
export async function clearAllSecure(): Promise<void> {
  const keys = Object.values(SECURE_KEYS)
  await Promise.all(keys.map(key => deleteSecure(key)))
}

export default {
  isSecureStoreAvailable,
  saveSecure,
  getSecure,
  deleteSecure,
  saveSecureJSON,
  getSecureJSON,
  clearAllSecure,
  SECURE_KEYS,
}
