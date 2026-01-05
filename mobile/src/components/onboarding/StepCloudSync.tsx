/**
 * Cloud Sync Step - Onboarding
 *
 * Optional step at the end of onboarding to connect with Google
 * for cloud backup and sync across devices.
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { Mail } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius } from '../../constants/theme'
import { useAuthStore } from '../../stores/auth-store'
import { signInWithGoogle, isGoogleAuthConfigured } from '../../services/google-auth-service'
import EmailAuthScreen from '../../screens/EmailAuthScreen'

interface StepCloudSyncProps {
  onComplete: (connected: boolean) => void
}

export function StepCloudSync({ onComplete }: StepCloudSyncProps) {
  const { colors } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [showEmailAuth, setShowEmailAuth] = useState(false)

  // Auth store
  const { signInWithGoogleToken } = useAuthStore()

  const handleGooglePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsLoading(true)

    try {
      console.log('[StepCloudSync] Starting Google Sign-In...')
      const result = await signInWithGoogle()
      console.log('[StepCloudSync] Result:', JSON.stringify(result))

      // STRICT CHECK: Must have success=true AND user with email AND (accessToken OR idToken)
      if (result.success && result.user?.email && (result.accessToken || result.idToken)) {
        console.log('[StepCloudSync] Auth successful, user:', result.user.email)
        
        // Store in auth store with both tokens
        const storeResult = await signInWithGoogleToken(result.accessToken || '', result.idToken)
        
        if (storeResult.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          onComplete(true)
        } else {
          console.log('[StepCloudSync] Store sync failed:', storeResult.error)
          Alert.alert('Erreur de synchronisation', storeResult.error || 'Impossible de synchroniser avec le cloud.')
          setIsLoading(false)
        }
      } else {
        console.log('[StepCloudSync] Auth failed or incomplete:', result.error)
        const errorMsg = result.error || 'Authentification incomplète. Veuillez réessayer.'
        Alert.alert('Erreur', errorMsg)
        setIsLoading(false)
      }
    } catch (error: any) {
      console.error('[StepCloudSync] Error:', error)
      setIsLoading(false)
      Alert.alert('Erreur', error?.message || 'Une erreur est survenue')
    }
  }

  const handleEmailPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowEmailAuth(true)
  }

  const handleEmailAuthenticated = (isNewUser: boolean) => {
    onComplete(true)
  }

  const googleConfigured = isGoogleAuthConfigured()

  // Show email auth screen
  if (showEmailAuth) {
    return (
      <EmailAuthScreen
        onBack={() => setShowEmailAuth(false)}
        onAuthenticated={handleEmailAuthenticated}
        onNeedsVerification={() => {}}
        onForgotPassword={() => {}}
      />
    )
  }

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../../logo1.png')}
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

      {/* Google Sign In Button */}
      {googleConfigured ? (
        <TouchableOpacity
          style={[styles.googleButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DADCE0' }]}
          onPress={handleGooglePress}
          disabled={isLoading}
        >
          {isLoading ? (
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

      {/* Email Sign In Button */}
      <TouchableOpacity
        style={[styles.emailButton, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}
        onPress={handleEmailPress}
        disabled={isLoading}
      >
        <Mail size={20} color={colors.text.primary} />
        <Text style={[styles.emailButtonText, { color: colors.text.primary }]}>
          Continuer avec Email
        </Text>
      </TouchableOpacity>

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
  googleButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
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
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    width: '100%',
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.md,
    borderWidth: 1,
  },
  emailButtonText: {
    ...typography.bodyMedium,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  skipText: {
    ...typography.body,
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
