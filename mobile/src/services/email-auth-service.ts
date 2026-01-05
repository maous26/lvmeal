/**
 * Email Authentication Service
 *
 * Handles email/password authentication via Supabase:
 * - Sign up with email verification
 * - Sign in with email/password
 * - Password reset
 * - Email verification resend
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase, isSupabaseConfigured } from './supabase-client'

// ============================================================================
// Types
// ============================================================================

export interface EmailAuthResult {
  success: boolean
  user?: {
    id: string
    email: string
    emailVerified: boolean
  }
  needsVerification?: boolean
  error?: string
}

export interface PasswordResetResult {
  success: boolean
  error?: string
}

// Storage key for cached email user
const EMAIL_USER_STORAGE_KEY = 'lym_email_user'

// Backend URL for auth redirects
const AUTH_REDIRECT_BASE = 'https://lym1-production.up.railway.app'

// ============================================================================
// Email Authentication Functions
// ============================================================================

/**
 * Sign up with email and password
 * Sends verification email automatically
 */
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<EmailAuthResult> {
  console.log('[EmailAuth] signUpWithEmail called for:', email)

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Service non disponible. Veuillez réessayer plus tard.',
    }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: 'Adresse email invalide',
    }
  }

  // Validate password strength
  if (password.length < 8) {
    return {
      success: false,
      error: 'Le mot de passe doit contenir au moins 8 caractères',
    }
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${AUTH_REDIRECT_BASE}/auth/callback`,
      },
    })

    if (error) {
      console.error('[EmailAuth] Sign up error:', error.message)

      // Handle specific errors
      if (error.message.includes('already registered')) {
        return {
          success: false,
          error: 'Cette adresse email est déjà utilisée',
        }
      }

      return {
        success: false,
        error: error.message || 'Erreur lors de l\'inscription',
      }
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Erreur lors de la création du compte',
      }
    }

    // Check if email confirmation is required
    const needsVerification = !data.user.email_confirmed_at

    // Store user info locally
    const userData = {
      id: data.user.id,
      email: data.user.email!,
      emailVerified: !needsVerification,
    }
    await AsyncStorage.setItem(EMAIL_USER_STORAGE_KEY, JSON.stringify(userData))

    console.log('[EmailAuth] Sign up successful, needs verification:', needsVerification)

    return {
      success: true,
      user: userData,
      needsVerification,
    }
  } catch (error) {
    console.error('[EmailAuth] Sign up exception:', error)
    return {
      success: false,
      error: 'Une erreur inattendue est survenue',
    }
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<EmailAuthResult> {
  console.log('[EmailAuth] signInWithEmail called for:', email)

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Service non disponible. Veuillez réessayer plus tard.',
    }
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[EmailAuth] Sign in error:', error.message)

      // Handle specific errors
      if (error.message.includes('Invalid login credentials')) {
        return {
          success: false,
          error: 'Email ou mot de passe incorrect',
        }
      }

      if (error.message.includes('Email not confirmed')) {
        return {
          success: false,
          needsVerification: true,
          error: 'Veuillez vérifier votre email avant de vous connecter',
        }
      }

      return {
        success: false,
        error: error.message || 'Erreur de connexion',
      }
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Erreur de connexion',
      }
    }

    // Store user info locally
    const userData = {
      id: data.user.id,
      email: data.user.email!,
      emailVerified: !!data.user.email_confirmed_at,
    }
    await AsyncStorage.setItem(EMAIL_USER_STORAGE_KEY, JSON.stringify(userData))

    console.log('[EmailAuth] Sign in successful:', data.user.email)

    return {
      success: true,
      user: userData,
    }
  } catch (error) {
    console.error('[EmailAuth] Sign in exception:', error)
    return {
      success: false,
      error: 'Une erreur inattendue est survenue',
    }
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<PasswordResetResult> {
  console.log('[EmailAuth] sendPasswordResetEmail called for:', email)

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Service non disponible',
    }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: 'Adresse email invalide',
    }
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${AUTH_REDIRECT_BASE}/auth/reset-password`,
    })

    if (error) {
      console.error('[EmailAuth] Password reset error:', error.message)
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'envoi de l\'email',
      }
    }

    console.log('[EmailAuth] Password reset email sent')
    return { success: true }
  } catch (error) {
    console.error('[EmailAuth] Password reset exception:', error)
    return {
      success: false,
      error: 'Une erreur inattendue est survenue',
    }
  }
}

/**
 * Update password (when user is already authenticated)
 */
export async function updatePassword(newPassword: string): Promise<PasswordResetResult> {
  console.log('[EmailAuth] updatePassword called')

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Service non disponible',
    }
  }

  // Validate password strength
  if (newPassword.length < 8) {
    return {
      success: false,
      error: 'Le mot de passe doit contenir au moins 8 caractères',
    }
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) {
      console.error('[EmailAuth] Update password error:', error.message)
      return {
        success: false,
        error: error.message || 'Erreur lors de la modification du mot de passe',
      }
    }

    console.log('[EmailAuth] Password updated successfully')
    return { success: true }
  } catch (error) {
    console.error('[EmailAuth] Update password exception:', error)
    return {
      success: false,
      error: 'Une erreur inattendue est survenue',
    }
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<PasswordResetResult> {
  console.log('[EmailAuth] resendVerificationEmail called for:', email)

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Service non disponible',
    }
  }

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${AUTH_REDIRECT_BASE}/auth/callback`,
      },
    })

    if (error) {
      console.error('[EmailAuth] Resend verification error:', error.message)
      return {
        success: false,
        error: error.message || 'Erreur lors de l\'envoi de l\'email',
      }
    }

    console.log('[EmailAuth] Verification email resent')
    return { success: true }
  } catch (error) {
    console.error('[EmailAuth] Resend verification exception:', error)
    return {
      success: false,
      error: 'Une erreur inattendue est survenue',
    }
  }
}

/**
 * Sign out email user
 */
export async function signOutEmail(): Promise<void> {
  console.log('[EmailAuth] signOutEmail called')

  try {
    await supabase.auth.signOut()
    await AsyncStorage.removeItem(EMAIL_USER_STORAGE_KEY)
    console.log('[EmailAuth] Sign out successful')
  } catch (error) {
    console.error('[EmailAuth] Sign out error:', error)
  }
}

/**
 * Get cached email user from local storage
 */
export async function getCachedEmailUser(): Promise<EmailAuthResult['user'] | null> {
  try {
    const cached = await AsyncStorage.getItem(EMAIL_USER_STORAGE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
    return null
  } catch (error) {
    console.error('[EmailAuth] Failed to get cached user:', error)
    return null
  }
}

/**
 * Check if user is signed in with email
 */
export async function isEmailSignedIn(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession()
    return !!data.session?.user && !!data.session.user.email
  } catch (error) {
    console.error('[EmailAuth] isEmailSignedIn error:', error)
    return false
  }
}

/**
 * Get current session user
 */
export async function getCurrentEmailUser(): Promise<EmailAuthResult['user'] | null> {
  try {
    const { data } = await supabase.auth.getUser()
    if (data.user?.email) {
      return {
        id: data.user.id,
        email: data.user.email,
        emailVerified: !!data.user.email_confirmed_at,
      }
    }
    return null
  } catch (error) {
    console.error('[EmailAuth] getCurrentEmailUser error:', error)
    return null
  }
}

/**
 * Check if email auth is available (Supabase configured)
 */
export function isEmailAuthConfigured(): boolean {
  return isSupabaseConfigured()
}
