/**
 * Cloud Sync Step - Onboarding
 *
 * Optional step at the end of onboarding to connect with Apple or Google
 * for cloud backup and sync across devices.
 *
 * IMPORTANT: If user already has cloud data (existing account), we restore
 * their data and skip re-onboarding to prevent data loss.
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius } from '../../constants/theme'
import { useAuthStore } from '../../stores/auth-store'
import { useUserStore } from '../../stores/user-store'
import { signInWithGoogle, isGoogleAuthConfigured } from '../../services/google-auth-service'
import { signInWithApple, isAppleAuthAvailable } from '../../services/apple-auth-service'

interface StepCloudSyncProps {
  onComplete: (connected: boolean) => void
  // Called when existing user with cloud data is detected - skip onboarding finalization
  onExistingUserRestored?: () => void
}

export function StepCloudSync({ onComplete, onExistingUserRestored }: StepCloudSyncProps) {
  const { colors } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMethod, setLoadingMethod] = useState<'google' | 'apple' | null>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)

  // Auth store
  const { signInWithGoogleToken, signInWithAppleToken } = useAuthStore()

  // Check Apple auth availability on mount
  useEffect(() => {
    const checkAppleAuth = async () => {
      const available = await isAppleAuthAvailable()
      setAppleAvailable(available)
    }
    checkAppleAuth()
  }, [])

  const handleApplePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsLoading(true)
    setLoadingMethod('apple')

    try {
      console.log('[StepCloudSync] Starting Apple Sign-In...')
      const result = await signInWithApple()

      if (result.success && result.identityToken) {
        console.log('[StepCloudSync] Apple auth successful')

        const storeResult = await signInWithAppleToken(result.identityToken)

        if (storeResult.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

          // Check if user had existing cloud data that was restored
          const userStore = useUserStore.getState()
          const hasExistingData = userStore.isOnboarded && userStore.profile?.onboardingCompleted

          if (hasExistingData && onExistingUserRestored) {
            console.log('[StepCloudSync] Existing Apple user - data restored from cloud')
            onExistingUserRestored()
          } else {
            console.log('[StepCloudSync] New Apple user - proceeding with onboarding')
            onComplete(true)
          }
        } else {
          console.log('[StepCloudSync] Store sync failed:', storeResult.error)
          Alert.alert('Erreur de synchronisation', storeResult.error || 'Impossible de synchroniser avec le cloud.')
          setIsLoading(false)
          setLoadingMethod(null)
        }
      } else if (result.error === 'Connexion annulée') {
        // User cancelled
        setIsLoading(false)
        setLoadingMethod(null)
      } else {
        console.log('[StepCloudSync] Apple auth failed:', result.error)
        Alert.alert('Erreur', result.error || 'Authentification échouée.')
        setIsLoading(false)
        setLoadingMethod(null)
      }
    } catch (error: any) {
      console.error('[StepCloudSync] Apple error:', error)
      setIsLoading(false)
      setLoadingMethod(null)
      Alert.alert('Erreur', error?.message || 'Une erreur est survenue')
    }
  }

  const handleGooglePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsLoading(true)
    setLoadingMethod('google')

    try {
      console.log('[StepCloudSync] Starting Google Sign-In...')
      const result = await signInWithGoogle()
      console.log('[StepCloudSync] Result:', JSON.stringify(result))

      // STRICT CHECK: Must have success=true AND user with email AND (accessToken OR idToken)
      if (result.success && result.user?.email && (result.accessToken || result.idToken)) {
        console.log('[StepCloudSync] Auth successful, user:', result.user.email)

        // Store in auth store with both tokens - this also triggers restoreData()
        const storeResult = await signInWithGoogleToken(result.accessToken || '', result.idToken)

        if (storeResult.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

          // Check if user had existing cloud data that was restored
          // The restoreData() in auth-store sets isOnboarded=true if cloud profile exists
          const userStore = useUserStore.getState()
          const hasExistingData = userStore.isOnboarded && userStore.profile?.onboardingCompleted

          if (hasExistingData && onExistingUserRestored) {
            console.log('[StepCloudSync] Existing Google user - data restored from cloud')
            onExistingUserRestored()
          } else {
            // New user or incomplete profile - proceed with normal onboarding completion
            console.log('[StepCloudSync] New user or incomplete profile - proceeding with onboarding')
            onComplete(true)
          }
        } else {
          console.log('[StepCloudSync] Store sync failed:', storeResult.error)
          Alert.alert('Erreur de synchronisation', storeResult.error || 'Impossible de synchroniser avec le cloud.')
          setIsLoading(false)
          setLoadingMethod(null)
        }
      } else {
        console.log('[StepCloudSync] Auth failed or incomplete:', result.error)
        const errorMsg = result.error || 'Authentification incomplète. Veuillez réessayer.'
        Alert.alert('Erreur', errorMsg)
        setIsLoading(false)
        setLoadingMethod(null)
      }
    } catch (error: any) {
      console.error('[StepCloudSync] Error:', error)
      setIsLoading(false)
      setLoadingMethod(null)
      Alert.alert('Erreur', error?.message || 'Une erreur est survenue')
    }
  }

  const googleConfigured = isGoogleAuthConfigured()

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.appName, { color: colors.text.primary }]}>LYM</Text>
        <Text style={[styles.tagline, { color: colors.text.secondary }]}>
          Ton coach nutrition intelligent
        </Text>
      </View>

      {/* Welcome */}
      <View style={styles.welcomeSection}>
        <Text style={[styles.welcomeTitle, { color: colors.text.primary }]}>
          Bienvenue
        </Text>
        <Text style={[styles.welcomeText, { color: colors.text.secondary }]}>
          Connecte-toi pour sauvegarder tes données et les retrouver sur tous tes appareils.
        </Text>
      </View>

      {/* Apple Sign In Button (iOS only) */}
      {Platform.OS === 'ios' && appleAvailable && (
        <TouchableOpacity
          style={[styles.appleButton]}
          onPress={handleApplePress}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {loadingMethod === 'apple' ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.lg}
              style={styles.appleNativeButton}
              onPress={handleApplePress}
            />
          )}
        </TouchableOpacity>
      )}

      {/* Google Sign In Button */}
      {googleConfigured ? (
        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DADCE0' }]}
          onPress={handleGooglePress}
          disabled={isLoading}
        >
          {loadingMethod === 'google' ? (
            <ActivityIndicator color="#4285F4" />
          ) : (
            <>
              <Image
                source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                style={styles.googleIcon}
              />
              <Text style={styles.googleButtonTextDark}>Continuer avec Google</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={[styles.notConfiguredBanner, { backgroundColor: colors.bg.secondary }]}>
          <Text style={[styles.notConfiguredText, { color: colors.text.tertiary }]}>
            Connexion Google non disponible
          </Text>
        </View>
      )}

      {/* Privacy Note */}
      <Text style={[styles.privacyNote, { color: colors.text.tertiary }]}>
        Tes données restent sur ton appareil même sans connexion.
        Tu pourras te connecter plus tard dans les paramètres.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: spacing.md,
  },
  appName: {
    ...typography.h1,
    fontWeight: '700',
    letterSpacing: 2,
  },
  tagline: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  welcomeSection: {
    alignItems: 'center',
    marginVertical: spacing['2xl'],
  },
  welcomeTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
  },
  welcomeText: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  appleButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  appleNativeButton: {
    width: '100%',
    height: 48,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    width: '100%',
    gap: spacing.sm,
    minHeight: 48,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonTextDark: {
    ...typography.bodyMedium,
    color: '#3C4043',
  },
  notConfiguredBanner: {
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  notConfiguredText: {
    ...typography.small,
  },
  privacyNote: {
    ...typography.small,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    bottom: spacing.xl,
  },
})

export default StepCloudSync
