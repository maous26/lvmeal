/**
 * CreditsIndicator - Affiche les credits IA restants avec CTA Premium
 *
 * Variantes:
 * - compact: Petit badge pour header/navbar
 * - full: Version complete avec barre de progression
 */

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ViewStyle, StyleProp } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Sparkles, Zap, Crown, ChevronRight } from 'lucide-react-native'
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { freemiumService } from '../services/freemium-service'
import { useGamificationStore } from '../stores/gamification-store'

interface CreditsIndicatorProps {
  variant?: 'compact' | 'full' | 'minimal'
  onPress?: () => void
  showUpgrade?: boolean
  style?: StyleProp<ViewStyle>
}

export function CreditsIndicator({
  variant = 'compact',
  onPress,
  showUpgrade = true,
  style,
}: CreditsIndicatorProps) {
  const navigation = useNavigation<any>()
  const { colors } = useTheme()
  const status = freemiumService.getUserStatus()

  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1)
    })

    if (onPress) {
      onPress()
    } else if (!status.isPremium && showUpgrade) {
      navigation.navigate('Paywall')
    }
  }

  // Premium = pas besoin d'afficher les credits
  if (status.isPremium && variant === 'minimal') {
    return null
  }

  // Version minimale (juste le chiffre)
  if (variant === 'minimal') {
    const isLow = status.creditsRemaining <= 1
    return (
      <Pressable onPress={handlePress}>
        <Animated.View
          style={[
            styles.minimalContainer,
            {
              backgroundColor: isLow ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
            },
            animatedStyle,
          ]}
        >
          <Zap
            size={14}
            color={isLow ? colors.error : colors.accent.primary}
            fill={isLow ? colors.error : colors.accent.primary}
          />
          <Text
            style={[
              styles.minimalText,
              { color: isLow ? colors.error : colors.accent.primary },
            ]}
          >
            {status.isPremium ? '∞' : status.creditsRemaining}
          </Text>
        </Animated.View>
      </Pressable>
    )
  }

  // Version compacte (badge)
  if (variant === 'compact') {
    const isLow = status.creditsRemaining <= 1 && !status.isPremium
    const percentage = status.isPremium ? 100 : (status.creditsRemaining / status.creditsTotal) * 100

    return (
      <Pressable onPress={handlePress} style={style}>
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[
            styles.compactContainer,
            {
              backgroundColor: status.isPremium
                ? 'rgba(139, 92, 246, 0.15)'
                : isLow
                ? 'rgba(239, 68, 68, 0.1)'
                : colors.bg.secondary,
              borderColor: status.isPremium
                ? 'rgba(139, 92, 246, 0.3)'
                : isLow
                ? 'rgba(239, 68, 68, 0.2)'
                : colors.border.light,
            },
            animatedStyle,
          ]}
        >
          {status.isPremium ? (
            <>
              <Crown size={14} color="#8B5CF6" />
              <Text style={[styles.compactText, { color: '#8B5CF6' }]}>Premium</Text>
            </>
          ) : (
            <>
              <Sparkles
                size={14}
                color={isLow ? colors.error : colors.accent.primary}
              />
              <Text
                style={[
                  styles.compactText,
                  { color: isLow ? colors.error : colors.text.primary },
                ]}
              >
                {status.creditsRemaining}/{status.creditsTotal}
              </Text>
              {isLow && showUpgrade && (
                <ChevronRight size={14} color={colors.error} />
              )}
            </>
          )}
        </Animated.View>
      </Pressable>
    )
  }

  // Version complete
  const percentage = status.isPremium ? 100 : (status.creditsRemaining / status.creditsTotal) * 100
  const isLow = status.creditsRemaining <= 1 && !status.isPremium
  const progressColor = status.isPremium
    ? '#8B5CF6'
    : isLow
    ? colors.error
    : colors.accent.primary

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={[styles.fullContainer, { backgroundColor: colors.bg.elevated }, style]}
    >
      <View style={styles.fullHeader}>
        <View style={styles.fullTitleRow}>
          {status.isPremium ? (
            <Crown size={20} color="#8B5CF6" />
          ) : (
            <Sparkles size={20} color={progressColor} />
          )}
          <Text style={[styles.fullTitle, { color: colors.text.primary }]}>
            {status.isPremium ? 'Premium' : 'Credits IA'}
          </Text>
        </View>

        {!status.isPremium && showUpgrade && (
          <TouchableOpacity
            onPress={() => navigation.navigate('Paywall')}
            style={[styles.upgradeButton, { backgroundColor: colors.accent.primary }]}
          >
            <Text style={styles.upgradeText}>Passer Premium</Text>
          </TouchableOpacity>
        )}
      </View>

      {!status.isPremium && (
        <>
          {/* Progress bar */}
          <View style={[styles.progressContainer, { backgroundColor: colors.bg.tertiary }]}>
            <View
              style={[
                styles.progressBar,
                {
                  backgroundColor: progressColor,
                  width: `${percentage}%`,
                },
              ]}
            />
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <Text style={[styles.statsText, { color: colors.text.secondary }]}>
              {status.creditsRemaining} credit{status.creditsRemaining !== 1 ? 's' : ''} restant
              {status.creditsRemaining !== 1 ? 's' : ''}
            </Text>
            {status.isTrialActive && (
              <Text style={[styles.trialBadge, { color: colors.accent.primary }]}>
                Essai: {status.trialDaysRemaining}j
              </Text>
            )}
          </View>

          {/* Message */}
          {isLow && (
            <Text style={[styles.warningText, { color: colors.error }]}>
              Credits presque epuises ! Passe a Premium pour un acces illimite.
            </Text>
          )}
        </>
      )}

      {status.isPremium && (
        <Text style={[styles.premiumText, { color: colors.text.secondary }]}>
          Acces illimite a toutes les fonctionnalites IA
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // Minimal
  minimalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 4,
  },
  minimalText: {
    ...typography.small,
    fontWeight: '600',
  },

  // Compact
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 6,
  },
  compactText: {
    ...typography.small,
    fontWeight: '600',
  },

  // Full
  fullContainer: {
    padding: spacing.default,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  fullHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fullTitle: {
    ...typography.bodySemibold,
  },
  upgradeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  upgradeText: {
    ...typography.small,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressContainer: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: radius.full,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    ...typography.small,
  },
  trialBadge: {
    ...typography.small,
    fontWeight: '600',
  },
  warningText: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  premiumText: {
    ...typography.small,
  },
})

export default CreditsIndicator
