import React, { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Sparkles } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography, shadows, fonts, organicPalette } from '../../constants/theme'

const { width, height } = Dimensions.get('window')

// Small floating blob for onboarding background
const OnboardingBlob = ({
  color,
  size,
  top,
  left,
  delay = 0,
  opacity = 0.15,
}: {
  color: string
  size: number
  top: number
  left: number
  delay?: number
  opacity?: number
}) => {
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const translateX = useSharedValue(0)

  useEffect(() => {
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.12, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.92, { duration: 7000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))

    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-12, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
        withTiming(12, { duration: 8000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))

    translateX.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(8, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-8, { duration: 9000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    ))
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { translateX: translateX.value }
    ]
  }))

  return (
    <Animated.View
      style={[
        styles.blob,
        style,
        {
          backgroundColor: color,
          width: size,
          height: size,
          top,
          left,
          borderRadius: size / 2,
          opacity,
        }
      ]}
    />
  )
}

interface OnboardingLayoutProps {
  children: React.ReactNode
  step: number
  totalSteps: number
  title?: string
  subtitle?: string
  /** Explain WHY we're asking this - builds trust */
  valueProposition?: string
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
  valueProposition,
  onBack,
  onNext,
  onSkip,
  nextLabel = 'Continuer',
  skipLabel = 'Passer',
  nextDisabled = false,
  loading = false,
  showProgress = true,
}: OnboardingLayoutProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const progress = ((step) / (totalSteps - 1)) * 100

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.bg.primary, paddingTop: insets.top }]}
    >
      {/* Floating blobs background - subtle */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <OnboardingBlob
          color={organicPalette.sage}
          size={width * 0.4}
          top={height * 0.12}
          left={width * 0.6}
          delay={0}
          opacity={0.12}
        />
        <OnboardingBlob
          color={organicPalette.clay}
          size={width * 0.35}
          top={height * 0.45}
          left={-width * 0.15}
          delay={1200}
          opacity={0.1}
        />
        <OnboardingBlob
          color={organicPalette.lavender}
          size={width * 0.3}
          top={height * 0.7}
          left={width * 0.65}
          delay={600}
          opacity={0.1}
        />
      </View>

      {/* Header */}
      <View style={styles.header}>
        {/* Back button */}
        {onBack && step > 1 ? (
          <TouchableOpacity
            onPress={onBack}
            style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
          >
            <ChevronLeft size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}

        {/* Progress bar */}
        {showProgress && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: colors.border.light }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.accent.primary, width: `${progress}%` },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.text.muted }]}>
              {step}/{totalSteps - 1}
            </Text>
          </View>
        )}

        {/* Skip button */}
        {onSkip ? (
          <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: colors.text.tertiary }]}>{skipLabel}</Text>
          </TouchableOpacity>
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
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.accent.primary }]}>
                {subtitle}
              </Text>
            )}
            {title && (
              <Text style={[styles.title, { color: colors.text.primary }]}>
                {title}
              </Text>
            )}
          </View>
        )}

        {/* Value proposition - WHY we ask this */}
        {valueProposition && (
          <View style={[styles.valueCard, { backgroundColor: colors.accent.light }]}>
            <Sparkles size={16} color={colors.accent.primary} />
            <Text style={[styles.valueText, { color: colors.accent.secondary }]}>
              {valueProposition}
            </Text>
          </View>
        )}

        {/* Step content */}
        <View style={styles.content}>{children}</View>
      </ScrollView>

      {/* Footer with action */}
      {onNext && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.default }]}>
          <TouchableOpacity
            onPress={onNext}
            disabled={nextDisabled || loading}
            activeOpacity={0.8}
            style={[
              styles.nextButton,
              { backgroundColor: nextDisabled ? '#CCCCCC' : colors.accent.primary },
              !nextDisabled && shadows.glowPrimary,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.nextButtonText}>{nextLabel}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 40,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    gap: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    ...typography.caption,
    minWidth: 32,
    textAlign: 'right',
  },
  skipButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skipText: {
    ...typography.small,
  },
  skipPlaceholder: {
    width: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  titleSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  subtitle: {
    ...typography.captionMedium,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
  },
  valueCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  valueText: {
    ...typography.small,
    flex: 1,
    lineHeight: 20,
  },
  content: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  nextButton: {
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: fonts.sans.semibold,
    letterSpacing: 0.3,
  },
  blob: {
    position: 'absolute',
  },
})

export default OnboardingLayout
