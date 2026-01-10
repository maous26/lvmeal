/**
 * AuthScreen - Clean authentication screen
 *
 * Shown when:
 * - New users (instead of immediate onboarding)
 * - Returning users who need to re-authenticate
 *
 * Options:
 * - Continue with Google (native sign-in)
 * - Continue with Email (email/password auth)
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Mail } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows, fonts } from '../constants/theme'
import {
  signInWithGoogle,
  isGoogleAuthConfigured,
} from '../services/google-auth-service'
import { useAuthStore } from '../stores/auth-store'
import { useUserStore } from '../stores/user-store'
import EmailAuthScreen from './EmailAuthScreen'
import EmailVerificationScreen from './EmailVerificationScreen'
import PasswordResetScreen from './PasswordResetScreen'

type AuthView = 'main' | 'email' | 'verification' | 'reset'

interface AuthScreenProps {
  onAuthenticated: (isNewUser: boolean) => void
  isReturningUser?: boolean // True when user clicked "J'ai déjà un compte"
  onRestartOnboarding?: () => void
}

export default function AuthScreen({ onAuthenticated, isReturningUser = false, onRestartOnboarding }: AuthScreenProps) {
  const { colors } = useTheme()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMethod, setLoadingMethod] = useState<'google' | 'email' | null>(null)
  const [currentView, setCurrentView] = useState<AuthView>('main')
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('')

  const { signInWithGoogleToken, signOut } = useAuthStore()
  const { profile, resetAllData } = useUserStore()

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
        // Store auth info
        await signInWithGoogleToken(result.accessToken || '', result.idToken)

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

        // Check if user has existing profile (returning user)
        const isNewUser = !profile?.onboardingCompleted
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

  const handleEmailSignIn = () => {
    setCurrentView('email')
  }

  const handleNeedsVerification = (email: string) => {
    setPendingVerificationEmail(email)
    setCurrentView('verification')
  }

  const handleVerified = () => {
    onAuthenticated(true)
  }

  const handleForgotPassword = () => {
    setCurrentView('reset')
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
              setCurrentView('main')
              setPendingVerificationEmail('')
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

  // Render email auth screen
  if (currentView === 'email') {
    return (
      <EmailAuthScreen
        onBack={() => setCurrentView('main')}
        onAuthenticated={onAuthenticated}
        onNeedsVerification={handleNeedsVerification}
        onForgotPassword={handleForgotPassword}
        initialEmail={pendingVerificationEmail}
        // Default to sign-in (user can still switch to sign-up from the screen)
        forceSignIn
      />
    )
  }

  // Render verification screen
  if (currentView === 'verification') {
    return (
      <EmailVerificationScreen
        email={pendingVerificationEmail}
        onBack={() => setCurrentView('email')}
        onVerified={handleVerified}
      />
    )
  }

  // Render password reset screen
  if (currentView === 'reset') {
    return (
      <PasswordResetScreen
        onBack={() => setCurrentView('email')}
        initialEmail={pendingVerificationEmail}
      />
    )
  }

  // Render main auth screen
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

        {/* Email Sign-In Button */}
        <TouchableOpacity
          style={[styles.authButton, styles.emailButton, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default }]}
          onPress={handleEmailSignIn}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {loadingMethod === 'email' ? (
            <ActivityIndicator color={colors.text.primary} size="small" />
          ) : (
            <>
              <Mail size={20} color={colors.text.primary} />
              <Text style={[styles.emailButtonText, { color: colors.text.primary }]}>
                Continuer avec Email
              </Text>
            </>
          )}
        </TouchableOpacity>
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
  emailButton: {
    borderWidth: 1,
  },
  emailButtonText: {
    ...typography.bodyMedium,
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
