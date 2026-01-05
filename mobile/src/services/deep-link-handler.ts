/**
 * Deep Link Handler Service
 *
 * Handles incoming deep links for:
 * - Password reset (presence://auth/reset-password)
 * - Email verification callback (presence://auth/callback)
 */

import * as Linking from 'expo-linking'
import { supabase } from './supabase-client'

// ============================================================================
// Types
// ============================================================================

export interface DeepLinkParams {
  type: 'recovery' | 'signup' | 'magiclink' | 'invite' | 'email_change' | null
  accessToken: string | null
  refreshToken: string | null
  error: string | null
  errorDescription: string | null
}

export interface DeepLinkResult {
  success: boolean
  type: 'reset-password' | 'email-verified' | 'error' | 'unknown'
  error?: string
}

// ============================================================================
// URL Parsing
// ============================================================================

/**
 * Parse deep link URL and extract authentication parameters
 * Supabase sends tokens in either the hash (#) or query string (?)
 */
export function parseDeepLinkUrl(url: string): DeepLinkParams {
  console.log('[DeepLinkHandler] Parsing URL:', url)

  const result: DeepLinkParams = {
    type: null,
    accessToken: null,
    refreshToken: null,
    error: null,
    errorDescription: null,
  }

  try {
    // Parse the URL
    const parsed = Linking.parse(url)
    console.log('[DeepLinkHandler] Parsed:', JSON.stringify(parsed))

    // Check query parameters first
    if (parsed.queryParams) {
      result.accessToken = parsed.queryParams.access_token as string || null
      result.refreshToken = parsed.queryParams.refresh_token as string || null
      result.type = parsed.queryParams.type as DeepLinkParams['type'] || null
      result.error = parsed.queryParams.error as string || null
      result.errorDescription = parsed.queryParams.error_description as string || null
    }

    // Also check for hash parameters (Supabase sometimes uses hash)
    // The hash is often included in the path after parsing
    if (url.includes('#')) {
      const hashPart = url.split('#')[1]
      if (hashPart) {
        const hashParams = new URLSearchParams(hashPart)
        result.accessToken = result.accessToken || hashParams.get('access_token')
        result.refreshToken = result.refreshToken || hashParams.get('refresh_token')
        result.type = result.type || hashParams.get('type') as DeepLinkParams['type']
        result.error = result.error || hashParams.get('error')
        result.errorDescription = result.errorDescription || hashParams.get('error_description')
      }
    }

    console.log('[DeepLinkHandler] Extracted params:', {
      type: result.type,
      hasAccessToken: !!result.accessToken,
      hasRefreshToken: !!result.refreshToken,
      error: result.error,
    })

  } catch (error) {
    console.error('[DeepLinkHandler] Parse error:', error)
  }

  return result
}

// ============================================================================
// Token Verification
// ============================================================================

/**
 * Set the Supabase session using tokens from deep link
 * This is used for password reset flow
 */
export async function setSessionFromTokens(
  accessToken: string,
  refreshToken: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[DeepLinkHandler] Setting session from tokens')

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    if (error) {
      console.error('[DeepLinkHandler] setSession error:', error.message)
      return {
        success: false,
        error: error.message.includes('expired')
          ? 'Le lien a expiré. Demande un nouveau lien de réinitialisation.'
          : error.message,
      }
    }

    if (!data.session) {
      return {
        success: false,
        error: 'Session invalide. Demande un nouveau lien.',
      }
    }

    console.log('[DeepLinkHandler] Session set successfully')
    return { success: true }
  } catch (error: any) {
    console.error('[DeepLinkHandler] setSession exception:', error)
    return {
      success: false,
      error: error?.message || 'Erreur lors de la vérification du lien',
    }
  }
}

// ============================================================================
// Deep Link Handler
// ============================================================================

/**
 * Handle incoming deep link and determine action
 */
export async function handleDeepLink(url: string): Promise<DeepLinkResult> {
  console.log('[DeepLinkHandler] Handling deep link:', url)

  // Parse the URL
  const params = parseDeepLinkUrl(url)

  // Check for errors from Supabase
  if (params.error) {
    console.error('[DeepLinkHandler] Error in deep link:', params.error)
    return {
      success: false,
      type: 'error',
      error: params.errorDescription || params.error,
    }
  }

  // Must have access token
  if (!params.accessToken) {
    console.log('[DeepLinkHandler] No access token in URL')
    return {
      success: false,
      type: 'unknown',
      error: 'Lien invalide',
    }
  }

  // Handle based on type
  switch (params.type) {
    case 'recovery':
      // Password reset flow
      console.log('[DeepLinkHandler] Recovery flow detected')

      if (!params.refreshToken) {
        return {
          success: false,
          type: 'error',
          error: 'Lien de réinitialisation invalide',
        }
      }

      const sessionResult = await setSessionFromTokens(
        params.accessToken,
        params.refreshToken
      )

      if (!sessionResult.success) {
        return {
          success: false,
          type: 'error',
          error: sessionResult.error,
        }
      }

      return {
        success: true,
        type: 'reset-password',
      }

    case 'signup':
    case 'magiclink':
      // Email verification callback
      console.log('[DeepLinkHandler] Email verification flow detected')

      if (params.refreshToken) {
        const verifyResult = await setSessionFromTokens(
          params.accessToken,
          params.refreshToken
        )

        if (!verifyResult.success) {
          return {
            success: false,
            type: 'error',
            error: verifyResult.error,
          }
        }
      }

      return {
        success: true,
        type: 'email-verified',
      }

    default:
      console.log('[DeepLinkHandler] Unknown type:', params.type)
      return {
        success: false,
        type: 'unknown',
        error: 'Type de lien non reconnu',
      }
  }
}

// ============================================================================
// URL Scheme
// ============================================================================

/**
 * Get the app's URL scheme
 */
export function getAppScheme(): string {
  return Linking.createURL('/')
}

/**
 * Check if a URL is a deep link for this app
 */
export function isAppDeepLink(url: string): boolean {
  return url.startsWith('presence://') || url.includes('presence://')
}
