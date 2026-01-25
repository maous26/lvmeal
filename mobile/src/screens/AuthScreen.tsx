/**
 * AuthScreen - Clean authentication screen
 *
 * Shown when:
 * - New users (instead of immediate onboarding)
 * - Returning users who need to re-authenticate
 *
 * Options:
 * - Continue with Apple (iOS only)
 * - Continue with Google (native sign-in)
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows, fonts } from '../constants/theme'
import {
  signInWithGoogle,
  isGoogleAuthConfigured,
} from '../services/google-auth-service'
import {
  signInWithApple,
  isAppleAuthAvailable,
} from '../services/apple-auth-service'
import { useAuthStore } from '../stores/auth-store'
import { useUserStore } from '../stores/user-store'

interface AuthScreenProps {
  onAuthenticated: (isNewUser: boolean) => void
  isReturningUser?: boolean
  onRestartOnboarding?: () => void
}

export default function AuthScreen({ onAuthenticated, isReturningUser = false, onRestartOnboarding }: AuthScreenProps) {
  const { colors } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMethod, setLoadingMethod] = useState<'google' | 'apple' | null>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)

  const { signInWithGoogleToken, signInWithAppleToken, signOut } = useAuthStore()
  const { resetAllData } = useUserStore()

  // Check Apple auth availability on mount
  useEffect(() => {
    const checkAppleAuth = async () => {
      const available = await isAppleAuthAvailable()
      setAppleAvailable(available)
    }
    checkAppleAuth()
  }, [])

  const handleAppleSignIn = async () => {
    setIsLoading(true)
    setLoadingMethod('apple')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const result = await signInWithApple()

      if (result.success && result.identityToken) {
        // Store auth info - this also restores cloud data if available
        await signInWithAppleToken(result.identityToken)

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Check if user has existing profile (returning user)
        const currentProfile = useUserStore.getState().profile
        const isNewUser = !currentProfile?.onboardingCompleted
        console.log('[AuthScreen] After Apple restore - isNewUser:', isNewUser)
        onAuthenticated(isNewUser)
      } else if (result.error === 'Connexion annulée') {
        // User cancelled, do nothing
      } else {
        Alert.alert('Erreur', result.error || 'Connexion impossible')
      }
    } catch (error: any) {
      console.error('[AuthScreen] Apple sign-in error:', error)
      Alert.alert('Erreur', error?.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
      setLoadingMethod(null)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!isGoogleAuthConfigured()) {
      Alert.alert('Non disponible', 'La connexion Google n\'est pas disponible.')
      return
    }

    setIsLoading(true)
    setLoadingMethod('google')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const result = await signInWithGoogle()

      if (result.success && result.user?.email && (result.accessToken || result.idToken)) {
        // Store auth info - this also restores cloud data if available
        await signInWithGoogleToken(result.accessToken || '', result.idToken)

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Check if user has existing profile (returning user)
        const currentProfile = useUserStore.getState().profile
        const isNewUser = !currentProfile?.onboardingCompleted
        console.log('[AuthScreen] After Google restore - isNewUser:', isNewUser)
        onAuthenticated(isNewUser)
      } else {
        Alert.alert('Erreur', result.error || 'Connexion impossible')
      }
    } catch (error: any) {
      console.error('[AuthScreen] Google sign-in error:', error)
      Alert.alert('Erreur', error?.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
      setLoadingMethod(null)
    }
  }

  const handleUseAnotherAccount = () => {
    Alert.alert(
      'Utiliser un autre compte',
      'Toutes tes données locales (repas, progrès, série) seront effacées. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true)
            setLoadingMethod(null)
            try {
              await signOut()
              // Reset ALL local data (all stores) so the flow restarts cleanly
              await resetAllData()
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              // Ask RootNavigator to show onboarding again
              onRestartOnboarding?.()
            } catch (e: any) {
              Alert.alert('Erreur', e?.message || 'Impossible de se déconnecter')
            } finally {
              setIsLoading(false)
            }
          },
        },
      ]
    )
  }

  const googleConfigured = isGoogleAuthConfigured()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Logo */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.tagline, { color: colors.text.secondary }]}>
          Ton coach nutrition intelligent
        </Text>
      </View>

      {/* Welcome Message */}
      <View style={styles.welcomeSection}>
        <Text style={[styles.welcomeTitle, { color: colors.text.primary }]}>
          Bienvenue
        </Text>
        <Text style={[styles.welcomeText, { color: colors.text.secondary }]}>
          Connecte-toi pour sauvegarder tes données et les retrouver sur tous tes appareils.
        </Text>
      </View>

      {/* Auth Options */}
      <View style={styles.authOptions}>
        {/* Apple Sign-In Button (iOS only) */}
        {Platform.OS === 'ios' && appleAvailable && (
          <TouchableOpacity
            style={[styles.authButton, styles.appleButton]}
            onPress={handleAppleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {loadingMethod === 'apple' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.appleIconText}></Text>
                <Text style={styles.appleButtonText}>Continuer avec Apple</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Google Sign-In Button */}
        {googleConfigured ? (
          <TouchableOpacity
            style={[styles.authButton, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {loadingMethod === 'google' ? (
              <ActivityIndicator color="#4285F4" size="small" />
            ) : (
              <>
                <Image
                  source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                  style={styles.googleIcon}
                />
                <Text style={styles.googleButtonText}>Continuer avec Google</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.unavailableBanner, { backgroundColor: colors.bg.secondary }]}>
            <Text style={[styles.unavailableText, { color: colors.text.tertiary }]}>
              Connexion Google non disponible
            </Text>
          </View>
        )}
      </View>

      {/* Switch account */}
      <View style={styles.helpers}>
        <TouchableOpacity
          onPress={handleUseAnotherAccount}
          disabled={isLoading}
          style={styles.helperButton}
        >
          <Text style={[styles.helperText, { color: colors.text.secondary, opacity: isLoading ? 0.6 : 1 }]}>
            Utiliser un autre compte
          </Text>
        </TouchableOpacity>
      </View>

      {/* Privacy Note */}
      <Text style={[styles.privacyNote, { color: colors.text.muted }]}>
        Tes données sont stockées localement sur ton appareil.{'\n'}
        Un compte permet de les synchroniser entre appareils.
      </Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.lg,
  },
  tagline: {
    ...typography.body,
    marginTop: spacing.sm,
  },
  welcomeSection: {
    alignItems: 'center',
    marginVertical: spacing['2xl'],
  },
  welcomeTitle: {
    ...typography.h2,
    fontFamily: fonts.serif.bold,
    marginBottom: spacing.md,
  },
  welcomeText: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  authOptions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  helpers: {
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  helperButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  helperText: {
    ...typography.bodyMedium,
    textAlign: 'center',
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    minHeight: 52,
    ...shadows.sm,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleIconText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  appleButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    ...typography.bodyMedium,
    color: '#3C4043',
  },
  unavailableBanner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  unavailableText: {
    ...typography.small,
  },
  privacyNote: {
    ...typography.small,
    textAlign: 'center',
    lineHeight: 18,
    position: 'absolute',
    bottom: spacing['2xl'],
    left: spacing.xl,
    right: spacing.xl,
  },
})
