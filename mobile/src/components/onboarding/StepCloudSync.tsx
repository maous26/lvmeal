/**
 * Cloud Sync Step - Onboarding
 *
 * Optional step at the end of onboarding to connect with Google
 * for cloud backup and sync across devices.
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
} from 'react-native'
import { ArrowRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import Constants from 'expo-constants'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius } from '../../constants/theme'
import { useAuthStore } from '../../stores/auth-store'
import { useGoogleAuthConfig, isGoogleAuthConfigured } from '../../services/google-auth-service'

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo'

interface StepCloudSyncProps {
  onComplete: (connected: boolean) => void
  onSkip: () => void
}

export function StepCloudSync({ onComplete, onSkip }: StepCloudSyncProps) {
  const { colors } = useTheme()
  const [isLoading, setIsLoading] = useState(false)

  // Auth store
  const { signInWithGoogleToken } = useAuthStore()

  // Google Auth hook
  const [request, response, promptAsync] = useGoogleAuthConfig()

  // Handle Google auth response
  useEffect(() => {
    console.log('[StepCloudSync] Google Auth Response:', JSON.stringify(response, null, 2))
    console.log('[StepCloudSync] Request object:', request ? {
      url: request.url,
      redirectUri: request.redirectUri,
      clientId: request.clientId,
    } : 'No request')

    if (response?.type === 'success') {
      const { authentication } = response
      if (authentication?.accessToken) {
        handleGoogleSignIn(authentication.accessToken)
      }
    } else if (response?.type === 'error') {
      setIsLoading(false)
      console.error('[StepCloudSync] Google Auth Error:', response.error)
      // Log more details about the error
      console.error('[StepCloudSync] Error details:', JSON.stringify(response, null, 2))
      Alert.alert(
        'Erreur Google Auth',
        `${response.error?.message || 'Erreur inconnue'}\n\nRedirect URI attendue: https://auth.expo.io/@maous/presence`
      )
    }
  }, [response])

  const handleGoogleSignIn = async (accessToken: string) => {
    setIsLoading(true)
    try {
      const result = await signInWithGoogleToken(accessToken)
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onComplete(true)
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de se connecter')
        setIsLoading(false)
      }
    } catch {
      setIsLoading(false)
      Alert.alert('Erreur', 'Une erreur est survenue')
    }
  }

  const handleGooglePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsLoading(true)
    try {
      // Use proxy in Expo Go for OAuth redirect handling
      await promptAsync({ useProxy: isExpoGo })
    } catch {
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSkip()
  }

  const isGoogleConfigured = isGoogleAuthConfigured()

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../../../logo1.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Avatar Placeholder */}
      <View style={[styles.avatarContainer, { backgroundColor: colors.bg.secondary }]}>
        <View style={[styles.avatarPlaceholder, { borderColor: colors.border.light }]}>
          <Text style={[styles.avatarEmoji]}>👤</Text>
        </View>
        <View style={[styles.syncBadge, { backgroundColor: colors.accent.primary }]}>
          <Text style={styles.syncBadgeText}>☁️</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.text.primary }]}>
        Retrouve tes données partout
      </Text>

      {/* Description */}
      <Text style={[styles.description, { color: colors.text.secondary }]}>
        Connecte-toi pour ne jamais perdre ta progression et la retrouver sur tous tes appareils.
      </Text>

      {/* Google Button */}
      {isGoogleConfigured ? (
        <TouchableOpacity
          style={[styles.googleButton]}
          onPress={handleGooglePress}
          disabled={!request || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
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
        <View style={[styles.notConfiguredBanner, { backgroundColor: colors.bg.secondary }]}>
          <Text style={[styles.notConfiguredText, { color: colors.text.secondary }]}>
            Configuration Google non disponible
          </Text>
        </View>
      )}

      {/* Skip Button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        disabled={isLoading}
      >
        <Text style={[styles.skipButtonText, { color: colors.text.tertiary }]}>
          Plus tard
        </Text>
        <ArrowRight size={16} color={colors.text.tertiary} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logo: {
    width: 60,
    height: 60,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  syncBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBadgeText: {
    fontSize: 18,
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing['2xl'],
    paddingHorizontal: spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.md,
    width: '100%',
    marginBottom: spacing.lg,
    backgroundColor: '#4285F4',
  },
  googleIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  googleButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notConfiguredBanner: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  notConfiguredText: {
    ...typography.body,
    textAlign: 'center',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  skipButtonText: {
    ...typography.body,
  },
})

export default StepCloudSync
