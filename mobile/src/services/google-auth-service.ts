/**
 * Google OAuth Authentication Service
 *
 * Uses @react-native-google-signin/google-signin for native Android/iOS authentication.
 */

import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { supabase, isSupabaseConfigured } from './supabase-client'

// Google OAuth Client IDs from environment
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || ''
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || ''
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || ''

// Debug: Log client IDs at module load
console.log('[GoogleAuth] ===== MODULE INIT =====')
console.log('[GoogleAuth] WEB_CLIENT_ID:', GOOGLE_WEB_CLIENT_ID ? 'SET' : 'NOT SET')
console.log('[GoogleAuth] ANDROID_CLIENT_ID:', GOOGLE_ANDROID_CLIENT_ID ? 'SET' : 'NOT SET')
console.log('[GoogleAuth] executionEnvironment:', Constants.executionEnvironment)
console.log('[GoogleAuth] appOwnership:', Constants.appOwnership)

// Determine if we're in Expo Go (development client)
// In EAS builds: executionEnvironment === 'standalone' or 'storeClient'
// In Expo Go: appOwnership === 'expo'
const isExpoGo = Constants.appOwnership === 'expo'

console.log('[GoogleAuth] isExpoGo:', isExpoGo)

// Import Google Sign-In
let GoogleSignin: any = null
let statusCodes: any = null
let googleSignInAvailable = false

// Always try to import in non-Expo Go environments
if (!isExpoGo) {
  try {
    const googleSignInModule = require('@react-native-google-signin/google-signin')
    GoogleSignin = googleSignInModule.GoogleSignin
    statusCodes = googleSignInModule.statusCodes
    googleSignInAvailable = true
    console.log('[GoogleAuth] Google Sign-In module loaded successfully')
  } catch (e) {
    console.error('[GoogleAuth] Failed to load Google Sign-In module:', e)
    googleSignInAvailable = false
  }
} else {
  console.log('[GoogleAuth] Skipping Google Sign-In import (Expo Go)')
}

// ============================================================================
// Types
// ============================================================================

export interface GoogleAuthResult {
  success: boolean
  user?: {
    id: string
    email: string
    name?: string
    avatar?: string
  }
  accessToken?: string
  idToken?: string
  error?: string
}

// ============================================================================
// Configuration
// ============================================================================

let isConfigured = false

/**
 * Configure Google Sign-In (call once at app startup)
 */
export function configureGoogleSignIn(): void {
  console.log('[GoogleAuth] configureGoogleSignIn called')
  console.log('[GoogleAuth] isExpoGo:', isExpoGo)
  console.log('[GoogleAuth] GoogleSignin available:', !!GoogleSignin)
  console.log('[GoogleAuth] GOOGLE_WEB_CLIENT_ID:', GOOGLE_WEB_CLIENT_ID ? GOOGLE_WEB_CLIENT_ID.substring(0, 30) + '...' : 'NOT SET')

  if (isExpoGo) {
    console.log('[GoogleAuth] Running in Expo Go - native Google Sign-In disabled')
    return
  }

  if (!GoogleSignin) {
    console.error('[GoogleAuth] GoogleSignin module not available!')
    return
  }

  if (isConfigured) {
    console.log('[GoogleAuth] Already configured')
    return
  }

  if (!GOOGLE_WEB_CLIENT_ID) {
    console.error('[GoogleAuth] GOOGLE_WEB_CLIENT_ID is not set!')
    return
  }

  try {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
      scopes: ['profile', 'email'],
    })
    isConfigured = true
    console.log('[GoogleAuth] ✓ Google Sign-In configured successfully')
  } catch (error) {
    console.error('[GoogleAuth] Configuration error:', error)
  }
}

/**
 * Check if Google Auth is configured and available
 */
export function isGoogleAuthConfigured(): boolean {
  const result = !isExpoGo && googleSignInAvailable && !!GOOGLE_WEB_CLIENT_ID
  console.log('[GoogleAuth] isGoogleAuthConfigured:', result, {
    isExpoGo,
    googleSignInAvailable,
    hasWebClientId: !!GOOGLE_WEB_CLIENT_ID,
  })
  return result
}

// ============================================================================
// Sign In
// ============================================================================

/**
 * Sign in with Google using native flow
 */
export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  console.log('[GoogleAuth] signInWithGoogle called')

  if (isExpoGo) {
    return {
      success: false,
      error: 'Google Sign-In non disponible dans Expo Go. Utilisez un build natif.',
    }
  }

  if (!GoogleSignin) {
    return {
      success: false,
      error: 'Module Google Sign-In non disponible',
    }
  }

  try {
    // Ensure configured
    if (!isConfigured) {
      configureGoogleSignIn()
    }

    // Check Play Services (Android only)
    if (Platform.OS === 'android') {
      console.log('[GoogleAuth] Checking Play Services...')
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      console.log('[GoogleAuth] Play Services OK')
    }

    // Force sign out first to ensure account picker shows up
    // This addresses the issue where it bypasses authentication automatically
    try {
      await GoogleSignin.signOut()
    } catch (e) {
      // Ignore if not signed in
    }

    // Sign in
    console.log('[GoogleAuth] Calling GoogleSignin.signIn()...')
    const response = await GoogleSignin.signIn()
    console.log('[GoogleAuth] signIn response:', JSON.stringify(response, null, 2))

    // Handle different response formats
    const userInfo = response?.data || response
    const user = userInfo?.user || userInfo

    if (!user?.email) {
      console.error('[GoogleAuth] No user data in response')
      return {
        success: false,
        error: 'Aucune information utilisateur reçue',
      }
    }

    // Get tokens
    console.log('[GoogleAuth] Getting tokens...')
    let tokens: any = null
    try {
      tokens = await GoogleSignin.getTokens()
    } catch (tokenError) {
      console.warn('[GoogleAuth] Could not get tokens via getTokens(), using response tokens if any')
    }

    const accessToken = tokens?.accessToken || userInfo?.accessToken
    const idToken = tokens?.idToken || userInfo?.idToken

    // Store user info locally
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name || user.givenName,
      avatar: user.photo,
    }
    await AsyncStorage.setItem('lym_google_user', JSON.stringify(userData))

    console.log('[GoogleAuth] ✓ Sign in successful:', user.email)

    return {
      success: true,
      user: userData,
      accessToken,
      idToken,
    }
  } catch (error: any) {
    console.error('[GoogleAuth] Sign in error details:', {
      code: error?.code,
      message: error?.message,
      stack: error?.stack
    })

    // Handle specific errors
    if (statusCodes) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return { success: false, error: 'Connexion annulée' }
      }
      if (error.code === statusCodes.IN_PROGRESS) {
        return { success: false, error: 'Connexion déjà en cours' }
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { success: false, error: 'Google Play Services non disponible' }
      }
      if (error.code === '12500' || error.code === 'DEVELOPER_ERROR' || error.message?.includes('DEVELOPER_ERROR')) {
        return {
          success: false,
          error: 'Erreur de configuration (12500). Vérifie que le SHA-1 de ton build est bien enregistré dans la console Google Cloud.'
        }
      }
    }

    return {
      success: false,
      error: error.message || 'Erreur de connexion Google',
    }
  }
}

/**
 * Sign in with access token (for Supabase integration)
 */
export async function signInWithGoogleToken(accessToken: string, idToken?: string): Promise<GoogleAuthResult> {
  console.log('[GoogleAuth] signInWithGoogleToken called', {
    hasAccessToken: !!accessToken,
    hasIdToken: !!idToken
  })

  if (!accessToken && !idToken) {
    const cached = await getCachedGoogleUser()
    if (cached) {
      return { success: true, user: cached }
    }
    return { success: false, error: 'Pas de token fourni' }
  }

  if (!isSupabaseConfigured()) {
    console.log('[GoogleAuth] Supabase not configured, using local storage only')
    // Without Supabase, just use local storage
    const cached = await getCachedGoogleUser()
    if (cached) {
      return { success: true, user: cached }
    }
    return { success: true }
  }

  try {
    // We need user info. If we don't have it, fetch from Google
    let userInfo: any = null

    if (accessToken) {
      console.log('[GoogleAuth] Fetching user info with access token...')
      const userInfoResponse = await fetch(
        'https://www.googleapis.com/userinfo/v2/me',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (userInfoResponse.ok) {
        userInfo = await userInfoResponse.json()
      }
    }

    // Try to authenticate with Supabase
    try {
      // Use ID Token if available (preferred by Supabase), otherwise Access Token
      const tokenToUse = idToken || accessToken
      console.log(`[GoogleAuth] Authenticating with Supabase using ${idToken ? 'ID Token' : 'Access Token'}...`)

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: tokenToUse,
      })

      if (error) {
        console.warn('[GoogleAuth] Supabase auth failed:', error.message)
      } else {
        console.log('[GoogleAuth] ✓ Supabase auth successful for:', data.user?.email)
      }
    } catch (supabaseError) {
      console.warn('[GoogleAuth] Supabase auth exception (non-blocking):', supabaseError)
    }

    // If we couldn't get user info from API, maybe we can get it from Supabase session
    if (!userInfo) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        userInfo = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name,
          picture: session.user.user_metadata?.avatar_url,
        }
      }
    }

    if (!userInfo?.email) {
      throw new Error('Impossible de récupérer les informations utilisateur Google')
    }

    // Store user info
    const userData = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name || userInfo.given_name,
      avatar: userInfo.picture,
    }
    await AsyncStorage.setItem('lym_google_user', JSON.stringify(userData))

    return { success: true, user: userData, accessToken, idToken }
  } catch (error) {
    console.error('[GoogleAuth] Token sign in error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de connexion',
    }
  }
}

// ============================================================================
// Sign Out
// ============================================================================

export async function signOutGoogle(): Promise<void> {
  try {
    if (!isExpoGo && GoogleSignin) {
      const isSignedIn = await GoogleSignin.isSignedIn()
      if (isSignedIn) {
        await GoogleSignin.signOut()
      }
    }

    if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }

    await AsyncStorage.removeItem('lym_google_user')
    console.log('[GoogleAuth] Signed out successfully')
  } catch (error) {
    console.error('[GoogleAuth] Sign out error:', error)
    throw error
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

export async function getCachedGoogleUser(): Promise<GoogleAuthResult['user'] | null> {
  try {
    const cached = await AsyncStorage.getItem('lym_google_user')
    if (!cached) return null
    return JSON.parse(cached)
  } catch {
    return null
  }
}

export async function isGoogleSignedIn(): Promise<boolean> {
  if (isExpoGo || !GoogleSignin) {
    const cached = await getCachedGoogleUser()
    return !!cached
  }

  try {
    return await GoogleSignin.isSignedIn()
  } catch {
    return false
  }
}

export async function getCurrentGoogleUser(): Promise<GoogleAuthResult['user'] | null> {
  if (isExpoGo || !GoogleSignin) {
    return getCachedGoogleUser()
  }

  try {
    const response = await GoogleSignin.getCurrentUser()
    const user = response?.data?.user || response?.user || response
    if (!user?.email) return null

    return {
      id: user.id,
      email: user.email,
      name: user.name || user.givenName,
      avatar: user.photo,
    }
  } catch {
    return null
  }
}

// Legacy hook for backward compatibility
export function useGoogleAuthConfig(): [null, null, () => Promise<void>] {
  return [null, null, async () => {
    console.warn('[GoogleAuth] useGoogleAuthConfig is deprecated. Use signInWithGoogle() instead.')
  }]
}
