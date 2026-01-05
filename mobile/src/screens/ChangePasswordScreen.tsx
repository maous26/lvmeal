/**
 * ChangePasswordScreen - Update password for email accounts
 *
 * Allows users to:
 * - Change their password (when authenticated)
 * - Reset their password via deep link (when coming from reset email)
 * - Validates password strength
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows } from '../constants/theme'
import { updatePassword } from '../services/email-auth-service'
import type { RootStackParamList } from '../navigation/RootNavigator'

type ChangePasswordRouteProp = RouteProp<RootStackParamList, 'ChangePassword'>

export default function ChangePasswordScreen() {
  const navigation = useNavigation()
  const route = useRoute<ChangePasswordRouteProp>()
  const { colors } = useTheme()

  // Check if coming from deep link (password reset flow)
  const fromDeepLink = (route.params as any)?.fromDeepLink === true

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Title based on context
  const screenTitle = fromDeepLink ? 'Nouveau mot de passe' : 'Modifier le mot de passe'
  const successTitle = fromDeepLink ? 'Mot de passe réinitialisé' : 'Mot de passe modifié'
  const successDescription = fromDeepLink
    ? 'Ton mot de passe a été réinitialisé avec succès. Tu peux maintenant te connecter.'
    : 'Ton mot de passe a été modifié avec succès.'

  const handleSubmit = async () => {
    setError(null)

    // Validate new password
    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setIsLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const result = await updatePassword(newPassword)

      if (result.success) {
        setSuccess(true)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        // Clear form
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setError(result.error || 'Erreur lors de la modification')
      }
    } catch (err: any) {
      console.error('[ChangePasswordScreen] Update error:', err)
      setError(err?.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            Mot de passe
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.successContent}>
          <View style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}>
            <CheckCircle size={48} color={colors.success} />
          </View>

          <Text style={[styles.successTitle, { color: colors.text.primary }]}>
            {successTitle}
          </Text>

          <Text style={[styles.successDescription, { color: colors.text.secondary }]}>
            {successDescription}
          </Text>

          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.accent.primary }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Terminé</Text>
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
              {screenTitle}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* New Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text.secondary }]}>
                Nouveau mot de passe
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
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="password-new"
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showNewPassword ? (
                    <EyeOff size={20} color={colors.text.tertiary} />
                  ) : (
                    <Eye size={20} color={colors.text.tertiary} />
                  )}
                </TouchableOpacity>
              </View>
              <Text style={[styles.hint, { color: colors.text.muted }]}>
                Minimum 8 caractères
              </Text>
            </View>

            {/* Confirm New Password Input */}
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
                <Text style={styles.submitButtonText}>Modifier le mot de passe</Text>
              )}
            </TouchableOpacity>
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
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  hint: {
    ...typography.small,
    marginTop: spacing.xs,
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
    marginTop: spacing.md,
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
    marginBottom: spacing.xl,
  },
  doneButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
    ...shadows.sm,
  },
  doneButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
})
