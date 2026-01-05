/**
 * EmailAuthScreen - Email authentication with sign-up/sign-in
 *
 * Features:
 * - Toggle between sign-up and sign-in modes
 * - Email validation
 * - Password strength validation (8+ chars)
 * - Password visibility toggle
 * - Forgot password link
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
  ScrollView,
} from 'react-native'
import { ArrowLeft, Eye, EyeOff, Mail, Lock } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows } from '../constants/theme'
import { useAuthStore } from '../stores/auth-store'
import { useUserStore } from '../stores/user-store'

interface EmailAuthScreenProps {
  onBack: () => void
  onAuthenticated: (isNewUser: boolean) => void
  onNeedsVerification: (email: string) => void
  onForgotPassword: () => void
}

export default function EmailAuthScreen({
  onBack,
  onAuthenticated,
  onNeedsVerification,
  onForgotPassword,
}: EmailAuthScreenProps) {
  const { colors } = useTheme()
  const [isSignUp, setIsSignUp] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { profile } = useUserStore()
  const { signIn, signUp } = useAuthStore()

  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(emailValue)
  }

  const handleSubmit = async () => {
    setError(null)

    // Validate email
    if (!validateEmail(email)) {
      setError('Adresse email invalide')
      return
    }

    // Validate password
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    // For sign-up, validate password confirmation
    if (isSignUp && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setIsLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      if (isSignUp) {
        const result = await signUp(email, password)

        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          // For now, assume verification needed (Supabase sends email automatically)
          onNeedsVerification(email)
        } else {
          setError(result.error || 'Erreur lors de l\'inscription')
        }
      } else {
        const result = await signIn(email, password)

        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          const isNewUser = !profile?.onboardingCompleted
          onAuthenticated(isNewUser)
        } else if (result.error?.includes('vérifier') || result.error?.includes('confirm')) {
          onNeedsVerification(email)
        } else {
          setError(result.error || 'Erreur de connexion')
        }
      }
    } catch (err: any) {
      console.error('[EmailAuthScreen] Auth error:', err)
      setError(err?.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleMode = () => {
    setIsSignUp(!isSignUp)
    setError(null)
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
              {isSignUp ? 'Créer un compte' : 'Se connecter'}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Form */}
          <View style={styles.form}>
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
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.secondary }]}>Mot de passe</Text>
              <View
                style={[
                  styles.inputContainer,
                  { backgroundColor: colors.bg.elevated, borderColor: colors.border.default },
                ]}
              >
                <Lock size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.input, { color: colors.text.primary }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.text.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  autoComplete={isSignUp ? 'password-new' : 'password'}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={colors.text.tertiary} />
                  ) : (
                    <Eye size={20} color={colors.text.tertiary} />
                  )}
                </TouchableOpacity>
              </View>
              {isSignUp && (
                <Text style={[styles.hint, { color: colors.text.muted }]}>
                  Minimum 8 caractères
                </Text>
              )}
            </View>

            {/* Confirm Password (Sign-up only) */}
            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text.secondary }]}>
                  Confirmer le mot de passe
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    { backgroundColor: colors.bg.elevated, borderColor: colors.border.default },
                  ]}
                >
                  <Lock size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={[styles.input, { color: colors.text.primary }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.text.muted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    autoComplete="password-new"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} color={colors.text.tertiary} />
                    ) : (
                      <Eye size={20} color={colors.text.tertiary} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Forgot Password (Sign-in only) */}
            {!isSignUp && (
              <TouchableOpacity onPress={onForgotPassword} style={styles.forgotPassword}>
                <Text style={[styles.forgotPasswordText, { color: colors.accent.primary }]}>
                  Mot de passe oublié ?
                </Text>
              </TouchableOpacity>
            )}

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
                <Text style={styles.submitButtonText}>
                  {isSignUp ? 'Créer mon compte' : 'Se connecter'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle Mode */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.toggleText, { color: colors.text.secondary }]}>
                {isSignUp ? 'Déjà un compte ?' : 'Pas encore de compte ?'}
              </Text>
              <TouchableOpacity onPress={toggleMode}>
                <Text style={[styles.toggleLink, { color: colors.accent.primary }]}>
                  {isSignUp ? 'Se connecter' : 'Créer un compte'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  form: {
    flex: 1,
    paddingTop: spacing.lg,
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
  hint: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
  forgotPasswordText: {
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
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  toggleText: {
    ...typography.body,
  },
  toggleLink: {
    ...typography.bodyMedium,
  },
})
