/**
 * Apple Sign-In Authentication Service
 *
 * Uses expo-apple-authentication for native iOS authentication.
 * Apple Sign-In is only available on iOS 13+.
 */

import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import { supabase, isSupabaseConfigured } from './supabase-client'
import { saveSecureJSON, getSecureJSON, deleteSecure, SECURE_KEYS } from './secure-storage'

// ============================================================================
// Types
// ============================================================================

export interface AppleAuthResult {
  success: boolean
  user?: {
    id: string
    email: string | null
    name?: string
  }
  identityToken?: string
  authorizationCode?: string
  error?: string
}

// ============================================================================
// Availability Check
// ============================================================================

/**
 * Check if Apple Sign-In is available on this device
 * Only available on iOS 13+
 */
export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    console.log('[AppleAuth] Not iOS platform')
    return false
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync()
    console.log('[AppleAuth] isAvailableAsync:', available)
    return available
  } catch (error) {
    console.error('[AppleAuth] Error checking availability:', error)
    return false
  }
}

// ============================================================================
// Sign In
// ============================================================================

/**
 * Sign in with Apple using native flow
 */
export async function signInWithApple(): Promise<AppleAuthResult> {
  console.log('[AppleAuth] signInWithApple called')

  if (Platform.OS !== 'ios') {
    return {
      success: false,
      error: 'Apple Sign-In n\'est disponible que sur iOS',
    }
  }

  try {
    const available = await AppleAuthentication.isAvailableAsync()
    if (!available) {
      return {
        success: false,
        error: 'Apple Sign-In n\'est pas disponible sur cet appareil (iOS 13+ requis)',
      }
    }

    console.log('[AppleAuth] Requesting Apple credentials...')
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })

    console.log('[AppleAuth] Credential received:', {
      user: credential.user,
      email: credential.email,
      fullName: credential.fullName,
      hasIdentityToken: !!credential.identityToken,
      hasAuthorizationCode: !!credential.authorizationCode,
    })

    // Apple only provides name/email on first sign-in
    // We need to cache it for subsequent sign-ins
    let userName: string | undefined
    if (credential.fullName?.givenName || credential.fullName?.familyName) {
      userName = [credential.fullName.givenName, credential.fullName.familyName]
        .filter(Boolean)
        .join(' ')
    }

    // Try to get cached user data if this is a returning user
    const cachedUser = await getCachedAppleUser()
    if (!userName && cachedUser?.name) {
      userName = cachedUser.name
    }

    // Determine email (Apple may hide it after first sign-in)
    let userEmail = credential.email
    if (!userEmail && cachedUser?.email) {
      userEmail = cachedUser.email
    }

    const userData = {
      id: credential.user,
      email: userEmail,
      name: userName,
    }

    // Cache user data for future sign-ins
    await saveSecureJSON(SECURE_KEYS.APPLE_USER, userData)

    console.log('[AppleAuth] Sign in successful:', userData.email || userData.id)

    return {
      success: true,
      user: userData,
      identityToken: credential.identityToken || undefined,
      authorizationCode: credential.authorizationCode || undefined,
    }
  } catch (error: any) {
    console.error('[AppleAuth] Sign in error:', error)

    if (error.code === 'ERR_REQUEST_CANCELED' || error.code === 'ERR_CANCELED') {
      return { success: false, error: 'Connexion annulée' }
    }

    return {
      success: false,
      error: error.message || 'Erreur de connexion Apple',
    }
  }
}

/**
 * Authenticate with Supabase using Apple identity token
 */
export async function signInWithAppleToken(identityToken: string): Promise<AppleAuthResult> {
  console.log('[AppleAuth] signInWithAppleToken called')

  if (!identityToken) {
    const cached = await getCachedAppleUser()
    if (cached) {
      return { success: true, user: cached }
    }
    return { success: false, error: 'Pas de token fourni' }
  }

  if (!isSupabaseConfigured()) {
    console.log('[AppleAuth] Supabase not configured, using local storage only')
    const cached = await getCachedAppleUser()
    if (cached) {
      return { success: true, user: cached }
    }
    return { success: true }
  }

  try {
    console.log('[AppleAuth] Authenticating with Supabase...')
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    })

    if (error) {
      console.warn('[AppleAuth] Supabase auth failed:', error.message)
      // Still return success if we have cached user data
      const cached = await getCachedAppleUser()
      if (cached) {
        return { success: true, user: cached }
      }
      throw error
    }

    console.log('[AppleAuth] Supabase auth successful for:', data.user?.email)

    // Update cached user with Supabase data
    const cached = await getCachedAppleUser()
    const userData = {
      id: data.user?.id || cached?.id || '',
      email: data.user?.email || cached?.email || null,
      name: data.user?.user_metadata?.full_name || cached?.name,
    }

    await saveSecureJSON(SECURE_KEYS.APPLE_USER, userData)

    return {
      success: true,
      user: userData,
      identityToken,
    }
  } catch (error: any) {
    console.error('[AppleAuth] Token sign in error:', error)
    return {
      success: false,
      error: error.message || 'Erreur de connexion',
    }
  }
}

// ============================================================================
// Sign Out
// ============================================================================

export async function signOutApple(): Promise<void> {
  try {
    // Apple doesn't have a signOut API, we just clear local data
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }

    await deleteSecure(SECURE_KEYS.APPLE_USER)
    console.log('[AppleAuth] Signed out successfully')
  } catch (error) {
    console.error('[AppleAuth] Sign out error:', error)
    throw error
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export async function getCachedAppleUser(): Promise<AppleAuthResult['user'] | null> {
  try {
    return await getSecureJSON<AppleAuthResult['user']>(SECURE_KEYS.APPLE_USER)
  } catch {
    return null
  }
}

export async function isAppleSignedIn(): Promise<boolean> {
  const cached = await getCachedAppleUser()
  return !!cached
}

export async function getCurrentAppleUser(): Promise<AppleAuthResult['user'] | null> {
  return getCachedAppleUser()
}
