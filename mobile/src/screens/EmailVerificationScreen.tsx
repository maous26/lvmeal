/**
 * EmailVerificationScreen - Waiting for email verification
 *
 * Shown after sign-up when email verification is required.
 * Allows user to:
 * - Check their email
 * - Resend verification email
 * - Go back to change email
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { ArrowLeft, Mail, RefreshCw, CheckCircle } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows } from '../constants/theme'
import {
  resendVerificationEmail,
  isEmailSignedIn,
  getCurrentEmailUser,
} from '../services/email-auth-service'

interface EmailVerificationScreenProps {
  email: string
  onBack: () => void
  onVerified: () => void
}

export default function EmailVerificationScreen({
  email,
  onBack,
  onVerified,
}: EmailVerificationScreenProps) {
  const { colors } = useTheme()
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  // Check if user is verified periodically
  useEffect(() => {
    const checkVerification = async () => {
      try {
        const user = await getCurrentEmailUser()
        if (user?.emailVerified) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          onVerified()
        }
      } catch (err) {
        console.error('[EmailVerificationScreen] Check verification error:', err)
      }
    }

    // Check every 5 seconds
    const interval = setInterval(checkVerification, 5000)
    return () => clearInterval(interval)
  }, [onVerified])

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])

  const handleResend = async () => {
    if (cooldown > 0) return

    setIsResending(true)
    setError(null)
    setResendSuccess(false)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const result = await resendVerificationEmail(email)

      if (result.success) {
        setResendSuccess(true)
        setCooldown(60) // 60 second cooldown
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        setError(result.error || 'Erreur lors de l\'envoi')
      }
    } catch (err: any) {
      console.error('[EmailVerificationScreen] Resend error:', err)
      setError(err?.message || 'Une erreur est survenue')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.accent.primary + '20' }]}>
          <Mail size={48} color={colors.accent.primary} />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Vérifie ton email
        </Text>

        {/* Description */}
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          Nous avons envoyé un lien de vérification à{'\n'}
          <Text style={[styles.emailText, { color: colors.text.primary }]}>{email}</Text>
        </Text>

        <Text style={[styles.instructions, { color: colors.text.tertiary }]}>
          Clique sur le lien dans l'email pour activer ton compte.{'\n'}
          Vérifie aussi tes spams si tu ne le trouves pas.
        </Text>

        {/* Success Message */}
        {resendSuccess && (
          <View style={[styles.successContainer, { backgroundColor: colors.success + '20' }]}>
            <CheckCircle size={20} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success }]}>
              Email envoyé !
            </Text>
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.error + '20' }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* Resend Button */}
        <TouchableOpacity
          style={[
            styles.resendButton,
            { backgroundColor: colors.bg.elevated, borderColor: colors.border.default },
            (isResending || cooldown > 0) && styles.resendButtonDisabled,
          ]}
          onPress={handleResend}
          disabled={isResending || cooldown > 0}
          activeOpacity={0.8}
        >
          {isResending ? (
            <ActivityIndicator color={colors.text.primary} size="small" />
          ) : (
            <>
              <RefreshCw size={20} color={cooldown > 0 ? colors.text.muted : colors.text.primary} />
              <Text
                style={[
                  styles.resendButtonText,
                  { color: cooldown > 0 ? colors.text.muted : colors.text.primary },
                ]}
              >
                {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : 'Renvoyer l\'email'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Change Email Link */}
        <TouchableOpacity onPress={onBack} style={styles.changeEmailButton}>
          <Text style={[styles.changeEmailText, { color: colors.accent.primary }]}>
            Utiliser une autre adresse email
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  emailText: {
    fontWeight: '600',
  },
  instructions: {
    ...typography.small,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  successText: {
    ...typography.bodyMedium,
  },
  errorContainer: {
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.body,
    textAlign: 'center',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 52,
    width: '100%',
    ...shadows.sm,
  },
  resendButtonDisabled: {
    opacity: 0.7,
  },
  resendButtonText: {
    ...typography.bodyMedium,
  },
  changeEmailButton: {
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  changeEmailText: {
    ...typography.bodyMedium,
  },
})
