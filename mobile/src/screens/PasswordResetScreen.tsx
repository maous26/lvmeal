/**
 * PasswordResetScreen - Request password reset via email
 *
 * Allows user to:
 * - Enter their email to receive a reset link
 * - Go back to sign-in
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows } from '../constants/theme'
import { sendPasswordResetEmail } from '../services/email-auth-service'

interface PasswordResetScreenProps {
  onBack: () => void
  initialEmail?: string
}

export default function PasswordResetScreen({
  onBack,
  initialEmail = '',
}: PasswordResetScreenProps) {
  const { colors } = useTheme()
  const [email, setEmail] = useState(initialEmail)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async () => {
    setError(null)

    if (!validateEmail(email)) {
      setError('Adresse email invalide')
      return
    }

    setIsLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const result = await sendPasswordResetEmail(email)

      if (result.success) {
        setEmailSent(true)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        setError(result.error || 'Erreur lors de l\'envoi')
      }
    } catch (err: any) {
      console.error('[PasswordResetScreen] Reset error:', err)
      setError(err?.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.successContent}>
          <View style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}>
            <CheckCircle size={48} color={colors.success} />
          </View>

          <Text style={[styles.successTitle, { color: colors.text.primary }]}>
            Email envoyé !
          </Text>

          <Text style={[styles.successDescription, { color: colors.text.secondary }]}>
            Si un compte existe avec l'adresse{'\n'}
            <Text style={[styles.emailText, { color: colors.text.primary }]}>{email}</Text>
            {'\n'}tu recevras un lien pour réinitialiser ton mot de passe.
          </Text>

          <Text style={[styles.hint, { color: colors.text.muted }]}>
            N'oublie pas de vérifier tes spams.
          </Text>

          <TouchableOpacity
            style={[styles.backToSignInButton, { backgroundColor: colors.accent.primary }]}
            onPress={onBack}
            activeOpacity={0.8}
          >
            <Text style={styles.backToSignInText}>Retour à la connexion</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onBack}
            style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            Mot de passe oublié
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.description, { color: colors.text.secondary }]}>
            Entre ton adresse email et nous t'enverrons un lien pour réinitialiser ton mot de passe.
          </Text>

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Email</Text>
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: colors.bg.elevated, borderColor: colors.border.default },
              ]}
            >
              <Mail size={20} color={colors.text.tertiary} />
              <TextInput
                style={[styles.input, { color: colors.text.primary }]}
                placeholder="votre@email.com"
                placeholderTextColor={colors.text.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoFocus
              />
            </View>
          </View>

          {/* Error Message */}
          {error && (
            <View style={[styles.errorContainer, { backgroundColor: colors.error + '20' }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.accent.primary },
              isLoading && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Envoyer le lien</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    height: 52,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    height: '100%',
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
  submitButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...shadows.sm,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Success state styles
  successContent: {
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
  successTitle: {
    ...typography.h2,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  successDescription: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  emailText: {
    fontWeight: '600',
  },
  hint: {
    ...typography.small,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  backToSignInButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
    ...shadows.sm,
  },
  backToSignInText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
})
