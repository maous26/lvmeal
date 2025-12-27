import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '../ui/Button'
import { colors, radius, spacing, typography } from '../../constants/theme'

interface OnboardingLayoutProps {
  children: React.ReactNode
  step: number
  totalSteps: number
  title?: string
  subtitle?: string
  onBack?: () => void
  onNext?: () => void
  onSkip?: () => void
  nextLabel?: string
  skipLabel?: string
  nextDisabled?: boolean
  loading?: boolean
  showProgress?: boolean
}

export function OnboardingLayout({
  children,
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  onNext,
  onSkip,
  nextLabel = 'Continuer',
  skipLabel = 'Passer',
  nextDisabled = false,
  loading = false,
  showProgress = true,
}: OnboardingLayoutProps) {
  const insets = useSafeAreaInsets()

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* Header */}
      <View style={styles.header}>
        {/* Back button */}
        {onBack && step > 1 ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        {/* Progress indicator */}
        {showProgress && (
          <View style={styles.progressContainer}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressDot,
                  i + 1 === step && styles.progressDotActive,
                  i + 1 < step && styles.progressDotComplete,
                ]}
              />
            ))}
          </View>
        )}

        {/* Skip button */}
        {onSkip ? (
          <Pressable onPress={onSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>{skipLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title section */}
        {(title || subtitle) && (
          <View style={styles.titleSection}>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            {title && <Text style={styles.title}>{title}</Text>}
          </View>
        )}

        {/* Step content */}
        <View style={styles.content}>{children}</View>
      </ScrollView>

      {/* Footer with action */}
      {onNext && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.default }]}>
          <Button
            onPress={onNext}
            disabled={nextDisabled}
            loading={loading}
            fullWidth
            size="lg"
          >
            {nextLabel}
          </Button>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.default,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: colors.text.secondary,
    marginTop: -2,
  },
  backPlaceholder: {
    width: 40,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border.default,
  },
  progressDotActive: {
    width: 24,
    backgroundColor: colors.accent.primary,
  },
  progressDotComplete: {
    backgroundColor: colors.accent.primary,
  },
  skipButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skipText: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  skipPlaceholder: {
    width: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  titleSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  subtitle: {
    ...typography.smallMedium,
    color: colors.accent.primary,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
})

export default OnboardingLayout
