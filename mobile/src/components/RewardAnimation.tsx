/**
 * RewardAnimation - Animations celebratoires pour XP et badges
 *
 * Affiche des animations elegantes lors de l'acquisition de:
 * - XP (particules flottantes + compteur anime)
 * - Badges/Achievements (confetti + reveal dramatique)
 * - Tier upgrades (explosion de couleurs)
 */

import React, { useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, Dimensions, Modal } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
  interpolate,
  FadeIn,
  FadeOut,
  ZoomIn,
  SlideInUp,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { Achievement, TierInfo, TIERS } from '../stores/gamification-store'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// ============= TYPES =============

export type RewardType = 'xp' | 'achievement' | 'tier' | 'streak'

export interface XPReward {
  type: 'xp'
  amount: number
  reason?: string
  bonusXP?: number
}

export interface AchievementReward {
  type: 'achievement'
  achievement: Achievement
}

export interface TierReward {
  type: 'tier'
  newTier: TierInfo
  previousTier: TierInfo
}

export interface StreakReward {
  type: 'streak'
  days: number
  bonusXP: number
}

export type Reward = XPReward | AchievementReward | TierReward | StreakReward

interface RewardAnimationProps {
  reward: Reward | null
  onComplete: () => void
  visible: boolean
}

// ============= CONFETTI PARTICLE =============

interface ConfettiParticleProps {
  delay: number
  color: string
  startX: number
}

function ConfettiParticle({ delay, color, startX }: ConfettiParticleProps) {
  const translateY = useSharedValue(-50)
  const translateX = useSharedValue(startX)
  const rotate = useSharedValue(0)
  const opacity = useSharedValue(1)
  const scale = useSharedValue(1)

  useEffect(() => {
    const randomX = (Math.random() - 0.5) * 200
    const duration = 2000 + Math.random() * 1000

    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT + 100, { duration, easing: Easing.out(Easing.quad) })
    )
    translateX.value = withDelay(
      delay,
      withTiming(startX + randomX, { duration, easing: Easing.inOut(Easing.sin) })
    )
    rotate.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 1000 }), -1, false)
    )
    opacity.value = withDelay(
      delay + duration - 500,
      withTiming(0, { duration: 500 })
    )
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.2, { duration: 200 }),
        withTiming(0.8, { duration: duration - 200 })
      )
    )
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }))

  const size = 8 + Math.random() * 8
  const shapes = ['square', 'circle', 'rectangle'] as const
  const shape = shapes[Math.floor(Math.random() * shapes.length)]

  return (
    <Animated.View
      style={[
        styles.confettiParticle,
        animatedStyle,
        {
          backgroundColor: color,
          width: shape === 'rectangle' ? size * 2 : size,
          height: size,
          borderRadius: shape === 'circle' ? size / 2 : 2,
        },
      ]}
    />
  )
}

// ============= XP ANIMATION =============

function XPAnimation({ amount, reason, bonusXP, onComplete }: XPReward & { onComplete: () => void }) {
  const { colors } = useTheme()
  const scale = useSharedValue(0)
  const counterValue = useSharedValue(0)
  const glowOpacity = useSharedValue(0)

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Entrance animation
    scale.value = withSpring(1, { damping: 12, stiffness: 150 })
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 500 }),
        withTiming(0.3, { duration: 500 })
      ),
      3,
      true
    )

    // Counter animation
    counterValue.value = withTiming(amount, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    })

    // Exit after delay
    const timer = setTimeout(() => {
      scale.value = withTiming(0, { duration: 300 }, () => {
        runOnJS(onComplete)()
      })
    }, 2500)

    return () => clearTimeout(timer)
  }, [])

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }))

  const displayValue = Math.round(counterValue.value)

  return (
    <View style={styles.xpContainer}>
      {/* Glow effect */}
      <Animated.View style={[styles.xpGlow, glowStyle]}>
        <LinearGradient
          colors={['transparent', colors.accent.primary + '40', 'transparent']}
          style={styles.xpGlowGradient}
        />
      </Animated.View>

      <Animated.View style={[styles.xpContent, containerStyle]}>
        <Text style={[styles.xpPrefix, { color: colors.accent.primary }]}>+</Text>
        <Animated.Text style={[styles.xpAmount, { color: colors.text.primary }]}>
          {displayValue}
        </Animated.Text>
        <Text style={[styles.xpLabel, { color: colors.accent.primary }]}>XP</Text>
      </Animated.View>

      {reason && (
        <Animated.Text
          entering={FadeIn.delay(300).duration(400)}
          style={[styles.xpReason, { color: colors.text.secondary }]}
        >
          {reason}
        </Animated.Text>
      )}

      {bonusXP && bonusXP > 0 && (
        <Animated.View
          entering={SlideInUp.delay(500).duration(400)}
          style={[styles.bonusBadge, { backgroundColor: colors.warning + '20' }]}
        >
          <Text style={[styles.bonusText, { color: colors.warning }]}>
            +{bonusXP} bonus streak
          </Text>
        </Animated.View>
      )}

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <FloatingParticle key={i} delay={i * 100} color={colors.accent.primary} />
      ))}
    </View>
  )
}

function FloatingParticle({ delay, color }: { delay: number; color: string }) {
  const translateY = useSharedValue(0)
  const translateX = useSharedValue((Math.random() - 0.5) * 100)
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.5)

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(-150 - Math.random() * 100, { duration: 2000, easing: Easing.out(Easing.cubic) })
    )
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(1300, withTiming(0, { duration: 500 }))
      )
    )
    scale.value = withDelay(
      delay,
      withSequence(
        withSpring(1, { damping: 8 }),
        withDelay(1000, withTiming(0.3, { duration: 500 }))
      )
    )
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        styles.floatingParticle,
        style,
        { backgroundColor: color },
      ]}
    />
  )
}

// ============= ACHIEVEMENT ANIMATION =============

function AchievementAnimation({ achievement, onComplete }: AchievementReward & { onComplete: () => void }) {
  const { colors } = useTheme()
  const backdropOpacity = useSharedValue(0)
  const cardScale = useSharedValue(0)
  const iconScale = useSharedValue(0)
  const shimmerPosition = useSharedValue(-1)

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Sequence of animations
    backdropOpacity.value = withTiming(1, { duration: 300 })
    cardScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 100 }))
    iconScale.value = withDelay(400, withSpring(1, { damping: 8, stiffness: 150 }))
    shimmerPosition.value = withDelay(
      600,
      withRepeat(withTiming(1, { duration: 1500 }), 2, false)
    )

    // Exit after delay
    const timer = setTimeout(() => {
      backdropOpacity.value = withTiming(0, { duration: 300 })
      cardScale.value = withTiming(0.8, { duration: 300 }, () => {
        runOnJS(onComplete)()
      })
    }, 4000)

    return () => clearTimeout(timer)
  }, [])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }))

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }))

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmerPosition.value, [-1, 1], [-200, 200]) }],
  }))

  // Generate confetti colors
  const confettiColors = [
    colors.accent.primary,
    colors.warning,
    '#FFD700',
    '#FF6B6B',
    '#4ECDC4',
    '#A78BFA',
  ]

  return (
    <View style={styles.achievementContainer}>
      <Animated.View style={[styles.backdrop, backdropStyle]} />

      {/* Confetti */}
      {[...Array(30)].map((_, i) => (
        <ConfettiParticle
          key={i}
          delay={i * 50}
          color={confettiColors[i % confettiColors.length]}
          startX={Math.random() * SCREEN_WIDTH}
        />
      ))}

      <Animated.View style={[styles.achievementCard, cardStyle, { backgroundColor: colors.bg.elevated }]}>
        {/* Shimmer effect */}
        <Animated.View style={[styles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shimmerGradient}
          />
        </Animated.View>

        <Text style={[styles.achievementLabel, { color: colors.text.secondary }]}>
          Nouveau badge
        </Text>

        <Animated.View style={[styles.achievementIconContainer, iconStyle]}>
          <LinearGradient
            colors={[colors.accent.primary + '30', colors.accent.primary + '10']}
            style={styles.achievementIconBg}
          >
            <Text style={styles.achievementIcon}>{achievement.icon}</Text>
          </LinearGradient>
        </Animated.View>

        <Text style={[styles.achievementName, { color: colors.text.primary }]}>
          {achievement.name}
        </Text>
        <Text style={[styles.achievementDescription, { color: colors.text.secondary }]}>
          {achievement.description}
        </Text>

        {achievement.xpReward > 0 && (
          <View style={[styles.achievementXP, { backgroundColor: colors.accent.primary + '15' }]}>
            <Text style={[styles.achievementXPText, { color: colors.accent.primary }]}>
              +{achievement.xpReward} XP
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  )
}

// ============= TIER ANIMATION =============

function TierAnimation({ newTier, previousTier, onComplete }: TierReward & { onComplete: () => void }) {
  const { colors } = useTheme()
  const backdropOpacity = useSharedValue(0)
  const contentScale = useSharedValue(0)
  const ringScale = useSharedValue(0)
  const ringOpacity = useSharedValue(1)

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    backdropOpacity.value = withTiming(1, { duration: 300 })
    contentScale.value = withDelay(300, withSpring(1, { damping: 10, stiffness: 100 }))

    // Expanding ring effect
    ringScale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(3, { duration: 1000, easing: Easing.out(Easing.cubic) })
        ),
        3,
        false
      )
    )
    ringOpacity.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: 0 }),
          withTiming(0, { duration: 1000 })
        ),
        3,
        false
      )
    )

    const timer = setTimeout(() => {
      backdropOpacity.value = withTiming(0, { duration: 400 })
      contentScale.value = withTiming(0, { duration: 400 }, () => {
        runOnJS(onComplete)()
      })
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
  }))

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }))

  const confettiColors = [newTier.color, '#FFD700', '#FFFFFF', colors.accent.primary]

  return (
    <View style={styles.tierContainer}>
      <Animated.View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.85)' }, backdropStyle]} />

      {/* Confetti explosion */}
      {[...Array(50)].map((_, i) => (
        <ConfettiParticle
          key={i}
          delay={300 + i * 30}
          color={confettiColors[i % confettiColors.length]}
          startX={SCREEN_WIDTH / 2 + (Math.random() - 0.5) * 100}
        />
      ))}

      <Animated.View style={[styles.tierContent, contentStyle]}>
        {/* Expanding rings */}
        <Animated.View style={[styles.tierRing, ringStyle, { borderColor: newTier.color }]} />
        <Animated.View style={[styles.tierRing, ringStyle, { borderColor: newTier.color, transform: [{ scale: 0.8 }] }]} />

        <Text style={styles.tierLabel}>Level Up!</Text>

        <View style={[styles.tierIconContainer, { backgroundColor: newTier.color + '30' }]}>
          <Text style={styles.tierIcon}>{newTier.icon}</Text>
        </View>

        <Text style={[styles.tierName, { color: newTier.color }]}>
          {newTier.nameFr}
        </Text>

        <View style={styles.tierTransition}>
          <Text style={[styles.tierPrevious, { color: colors.text.muted }]}>
            {previousTier.icon} {previousTier.nameFr}
          </Text>
          <Text style={[styles.tierArrow, { color: colors.text.muted }]}> → </Text>
          <Text style={[styles.tierNew, { color: newTier.color }]}>
            {newTier.icon} {newTier.nameFr}
          </Text>
        </View>
      </Animated.View>
    </View>
  )
}

// ============= STREAK ANIMATION =============

function StreakAnimation({ days, bonusXP, onComplete }: StreakReward & { onComplete: () => void }) {
  const { colors } = useTheme()
  const scale = useSharedValue(0)
  const flameScale = useSharedValue(1)

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    scale.value = withSpring(1, { damping: 12 })
    flameScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 300 }),
        withTiming(0.95, { duration: 300 })
      ),
      -1,
      true
    )

    const timer = setTimeout(() => {
      scale.value = withTiming(0, { duration: 300 }, () => {
        runOnJS(onComplete)()
      })
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }))

  return (
    <View style={styles.streakContainer}>
      <Animated.View style={[styles.streakContent, containerStyle, { backgroundColor: colors.bg.elevated }]}>
        <Animated.Text style={[styles.streakFlame, flameStyle]}>🔥</Animated.Text>
        <Text style={[styles.streakDays, { color: colors.text.primary }]}>
          {days} jours
        </Text>
        <Text style={[styles.streakLabel, { color: colors.text.secondary }]}>
          de suite!
        </Text>
        {bonusXP > 0 && (
          <View style={[styles.streakBonus, { backgroundColor: colors.warning + '20' }]}>
            <Text style={[styles.streakBonusText, { color: colors.warning }]}>
              +{bonusXP}% bonus XP
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  )
}

// ============= MAIN COMPONENT =============

export function RewardAnimation({ reward, onComplete, visible }: RewardAnimationProps) {
  if (!visible || !reward) return null

  const renderContent = () => {
    switch (reward.type) {
      case 'xp':
        return <XPAnimation {...reward} onComplete={onComplete} />
      case 'achievement':
        return <AchievementAnimation {...reward} onComplete={onComplete} />
      case 'tier':
        return <TierAnimation {...reward} onComplete={onComplete} />
      case 'streak':
        return <StreakAnimation {...reward} onComplete={onComplete} />
      default:
        return null
    }
  }

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.modalContainer}>
        {renderContent()}
      </View>
    </Modal>
  )
}

// ============= STYLES =============

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  // XP
  xpContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  xpGlowGradient: {
    flex: 1,
    borderRadius: 150,
  },
  xpContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  xpPrefix: {
    fontSize: 48,
    fontWeight: '300',
  },
  xpAmount: {
    fontSize: 80,
    fontWeight: '800',
  },
  xpLabel: {
    fontSize: 32,
    fontWeight: '600',
    marginLeft: 8,
  },
  xpReason: {
    marginTop: spacing.md,
    ...typography.body,
    textAlign: 'center',
  },
  bonusBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  bonusText: {
    ...typography.small,
    fontWeight: '600',
  },
  floatingParticle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Confetti
  confettiParticle: {
    position: 'absolute',
    top: -50,
  },

  // Achievement
  achievementContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementCard: {
    width: SCREEN_WIDTH - 60,
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shimmerGradient: {
    width: 200,
    height: '100%',
  },
  achievementLabel: {
    ...typography.small,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },
  achievementIconContainer: {
    marginBottom: spacing.lg,
  },
  achievementIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementIcon: {
    fontSize: 48,
  },
  achievementName: {
    ...typography.h2,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  achievementDescription: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  achievementXP: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  achievementXPText: {
    ...typography.bodySemibold,
  },

  // Tier
  tierContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierContent: {
    alignItems: 'center',
  },
  tierRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 3,
  },
  tierLabel: {
    fontSize: 24,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: spacing.xl,
  },
  tierIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  tierIcon: {
    fontSize: 60,
  },
  tierName: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  tierTransition: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierPrevious: {
    ...typography.body,
  },
  tierArrow: {
    ...typography.body,
  },
  tierNew: {
    ...typography.bodySemibold,
  },

  // Streak
  streakContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakContent: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  streakFlame: {
    fontSize: 64,
    marginBottom: spacing.sm,
  },
  streakDays: {
    fontSize: 48,
    fontWeight: '800',
  },
  streakLabel: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  streakBonus: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  streakBonusText: {
    ...typography.bodySemibold,
  },
})

export default RewardAnimation
