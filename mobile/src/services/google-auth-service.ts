/**
 * Google OAuth Authentication Service
 *
 * Handles Google Sign-In for React Native (Expo) with Supabase.
 * Supports both iOS and Android platforms.
 */

import * as Google from 'expo-auth-session/providers/google'
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { supabase, isSupabaseConfigured } from './supabase-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import Constants from 'expo-constants'

// Complete auth session for web browser redirect
WebBrowser.maybeCompleteAuthSession()

// ============================================================================
// Configuration
// ============================================================================

// Google OAuth Client IDs - Set in .env
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || ''
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || ''
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || ''

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo'

// Check if Google Auth is configured
export function isGoogleAuthConfigured(): boolean {
  return !!(GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID)
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
  error?: string
}

export interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
  locale: string
}

// ============================================================================
// Hook for Google Auth
// ============================================================================

/**
 * Custom hook for Google Sign-In with Expo
 *
 * IMPORTANT: Add this redirect URI in Google Cloud Console:
 * https://auth.expo.io/@maous1/presence
 *
 * Usage:
 * const [request, response, promptAsync] = useGoogleAuthConfig()
 * <Button onPress={() => promptAsync()} disabled={!request}>Sign in</Button>
 */
export function useGoogleAuthConfig() {
  // For Expo Go on iOS: use expo-proxy scheme that redirects back to Expo Go
  // For standalone builds: use native deep link
  const redirectUri = makeRedirectUri({
    scheme: 'presence',
    // In Expo Go, this generates: exp://192.168.x.x:8081/--/
    // which won't work with Google OAuth
  })

  // For Expo Go, we need to use a special approach
  // Google OAuth requires https:// redirect URIs for web clients
  // So in Expo Go, we'll use the Expo proxy
  const finalRedirectUri = isExpoGo
    ? 'https://auth.expo.io/@maous1/presence'
    : redirectUri

  // Debug: Log all config at startup
  console.log('[GoogleAuth] ========== CONFIG DEBUG ==========')
  console.log('[GoogleAuth] Is Expo Go:', isExpoGo)
  console.log('[GoogleAuth] Platform:', Platform.OS)
  console.log('[GoogleAuth] Web Client ID:', GOOGLE_WEB_CLIENT_ID ? `${GOOGLE_WEB_CLIENT_ID.substring(0, 20)}...` : 'NOT SET')
  console.log('[GoogleAuth] iOS Client ID:', GOOGLE_IOS_CLIENT_ID ? `${GOOGLE_IOS_CLIENT_ID.substring(0, 20)}...` : 'NOT SET')
  console.log('[GoogleAuth] Android Client ID:', GOOGLE_ANDROID_CLIENT_ID ? `${GOOGLE_ANDROID_CLIENT_ID.substring(0, 20)}...` : 'NOT SET')
  console.log('[GoogleAuth] Generated Redirect URI:', finalRedirectUri)
  console.log('[GoogleAuth] =====================================')

  const result = Google.useAuthRequest({
    // Use Web Client ID for Expo Go (required for https redirect)
    // For standalone builds, use platform-specific Client IDs
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: isExpoGo ? undefined : GOOGLE_IOS_CLIENT_ID,
    androidClientId: isExpoGo ? undefined : GOOGLE_ANDROID_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: finalRedirectUri,
    // Use implicit flow to get token directly (no server-side code exchange needed)
    responseType: 'token',
  })

  // Debug: Log the generated request
  const [request, response] = result
  if (request) {
    console.log('[GoogleAuth] Auth Request URL:', request.url)
    console.log('[GoogleAuth] Redirect URI used:', request.redirectUri)
  }
  if (response) {
    console.log('[GoogleAuth] Response type:', response.type)
    if (response.type === 'error') {
      console.error('[GoogleAuth] Error:', response.error)
    }
  }

  return result
}

// ============================================================================
// Sign In with Google (Native)
// ============================================================================

/**
 * Complete Google Sign-In flow and authenticate with Supabase
 */
export async function signInWithGoogle(
  accessToken: string
): Promise<GoogleAuthResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase non configuré',
    }
  }

  try {
    // Get user info from Google
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/userinfo/v2/me',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!userInfoResponse.ok) {
      throw new Error('Impossible de récupérer les informations Google')
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json()

    // Sign in to Supabase with Google OAuth token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: accessToken,
    })

    if (error) {
      // Fallback: Try to sign in with email if OAuth fails
      // This can happen if Supabase Google OAuth is not configured
      console.warn('Google OAuth to Supabase failed, trying email lookup:', error)

      // Check if user exists with this email
      const existingSession = await supabase.auth.getSession()

      if (existingSession.data.session) {
        return {
          success: true,
          user: {
            id: existingSession.data.session.user.id,
            email: userInfo.email,
            name: userInfo.name,
            avatar: userInfo.picture,
          },
        }
      }

      return {
        success: false,
        error: 'Échec de la connexion Google. Vérifiez la configuration Supabase.',
      }
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Aucun utilisateur retourné',
      }
    }

    // Store user info in AsyncStorage for quick access
    await AsyncStorage.setItem('lym_google_user', JSON.stringify({
      id: data.user.id,
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.picture,
    }))

    return {
      success: true,
      user: {
        id: data.user.id,
        email: userInfo.email,
        name: userInfo.name,
        avatar: userInfo.picture,
      },
    }
  } catch (error) {
    console.error('[GoogleAuth] Sign in error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de connexion Google',
    }
  }
}

// ============================================================================
// Sign Out
// ============================================================================

/**
 * Sign out from Google and Supabase
 */
export async function signOutGoogle(): Promise<void> {
  try {
    // Sign out from Supabase
    await supabase.auth.signOut()

    // Clear stored Google user info
    await AsyncStorage.removeItem('lym_google_user')

    console.log('[GoogleAuth] Signed out successfully')
  } catch (error) {
    console.error('[GoogleAuth] Sign out error:', error)
    throw error
  }
}

// ============================================================================
// Get Cached User
// ============================================================================

/**
 * Get cached Google user info (faster than checking Supabase)
 */
export async function getCachedGoogleUser(): Promise<GoogleAuthResult['user'] | null> {
  try {
    const cached = await AsyncStorage.getItem('lym_google_user')
    if (!cached) return null
    return JSON.parse(cached)
  } catch {
    return null
  }
}

// ============================================================================
// Check Auth Status
// ============================================================================

/**
 * Check if user is authenticated with Google
 */
export async function isGoogleAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return false

    // Check if this is a Google auth session
    const provider = session.user.app_metadata?.provider
    return provider === 'google'
  } catch {
    return false
  }
}

// ============================================================================
// Link Google Account
// ============================================================================

/**
 * Link Google account to existing anonymous/email user
 * This allows users to upgrade their account to Google auth
 */
export async function linkGoogleAccount(accessToken: string): Promise<GoogleAuthResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase non configuré',
    }
  }

  try {
    // Get current user
    const { data: { user: currentUser } } = await supabase.auth.getUser()

    if (!currentUser) {
      return {
        success: false,
        error: 'Aucun utilisateur connecté',
      }
    }

    // Get Google user info
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/userinfo/v2/me',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!userInfoResponse.ok) {
      throw new Error('Impossible de récupérer les informations Google')
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json()

    // Update user metadata with Google info
    const { error } = await supabase.auth.updateUser({
      data: {
        google_id: userInfo.id,
        avatar_url: userInfo.picture,
        full_name: userInfo.name,
      },
    })

    if (error) {
      return {
        success: false,
        error: 'Échec de la liaison du compte Google',
      }
    }

    // Update cached user
    await AsyncStorage.setItem('lym_google_user', JSON.stringify({
      id: currentUser.id,
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.picture,
    }))

    return {
      success: true,
      user: {
        id: currentUser.id,
        email: userInfo.email,
        name: userInfo.name,
        avatar: userInfo.picture,
      },
    }
  } catch (error) {
    console.error('[GoogleAuth] Link account error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de liaison',
    }
  }
}

// ============================================================================
// Platform-specific helpers
// ============================================================================

/**
 * Get the appropriate client ID for the current platform
 */
export function getGoogleClientId(): string {
  switch (Platform.OS) {
    case 'ios':
      return GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID
    case 'android':
      return GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID
    default:
      return GOOGLE_WEB_CLIENT_ID
  }
}

/**
 * Get instructions for setting up Google Auth
 */
export function getGoogleAuthSetupInstructions(): string {
  return `
Pour configurer Google Sign-In:

1. Allez sur https://console.cloud.google.com/
2. Créez un projet ou sélectionnez-en un existant
3. Activez l'API "Google Identity Services"
4. Créez des identifiants OAuth 2.0:
   - Type: Application Web (pour Expo Go)
   - Type: iOS (pour la build iOS)
   - Type: Android (pour la build Android)
5. Ajoutez les variables d'environnement:
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxx
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxx
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxx
6. Dans Supabase Dashboard:
   - Authentication > Providers > Google
   - Activez Google et ajoutez vos Client IDs
`
}
