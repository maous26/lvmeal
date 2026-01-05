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
import { ArrowRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius } from '../../constants/theme'
import { useAuthStore } from '../../stores/auth-store'
import { signInWithGoogle, isGoogleAuthConfigured } from '../../services/google-auth-service'

interface StepCloudSyncProps {
  onComplete: (connected: boolean) => void
  onSkip: () => void
}

export function StepCloudSync({ onComplete, onSkip }: StepCloudSyncProps) {
  const { colors } = useTheme()
  const [isLoading, setIsLoading] = useState(false)

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

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSkip()
  }

  const googleConfigured = isGoogleAuthConfigured()

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
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.text.primary }]}>
        Sauvegarder mes données
      </Text>

      {/* Description */}
      <Text style={[styles.description, { color: colors.text.secondary }]}>
        Connecte-toi avec Google pour sauvegarder tes données et les retrouver sur tous tes appareils.
      </Text>

      {/* Benefits */}
      <View style={styles.benefits}>
        <View style={styles.benefitRow}>
          <Text style={styles.benefitIcon}>☁️</Text>
          <Text style={[styles.benefitText, { color: colors.text.secondary }]}>
            Sauvegarde automatique dans le cloud
          </Text>
        </View>
        <View style={styles.benefitRow}>
          <Text style={styles.benefitIcon}>📱</Text>
          <Text style={[styles.benefitText, { color: colors.text.secondary }]}>
            Synchronisation multi-appareils
          </Text>
        </View>
        <View style={styles.benefitRow}>
          <Text style={styles.benefitIcon}>🔒</Text>
          <Text style={[styles.benefitText, { color: colors.text.secondary }]}>
            Données sécurisées et privées
          </Text>
        </View>
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

      {/* Skip Button */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        disabled={isLoading}
      >
        <Text style={[styles.skipText, { color: colors.text.tertiary }]}>
          Peut-être plus tard
        </Text>
        <ArrowRight size={16} color={colors.text.tertiary} />
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
    paddingTop: spacing['2xl'],
  },
  logoContainer: {
    width: 60,
    height: 60,
    marginBottom: spacing.xl,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 32,
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
    marginBottom: spacing.xl,
  },
  benefits: {
    width: '100%',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitIcon: {
    fontSize: 20,
  },
  benefitText: {
    ...typography.body,
    flex: 1,
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
