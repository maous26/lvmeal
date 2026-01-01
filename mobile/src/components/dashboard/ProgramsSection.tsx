/**
 * ProgramsSection - Section premium des programmes de bien-être
 *
 * Affiche les 2 programmes (Métabolisme, Bien-être) avec un design
 * professionnel et des métriques claires de progression.
 */

import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle } from 'react-native-svg'
import {
  Zap,
  Heart,
  Sparkles,
  Flame,
  Moon,
  Star,
  ChevronRight,
  Lock,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius } from '../../constants/theme'
import { useMetabolicBoostStore, type MetabolicPhase } from '../../stores/metabolic-boost-store'
import { useWellnessProgramStore, type WellnessPhase } from '../../stores/wellness-program-store'

interface ProgramsSectionProps {
  onMetabolicPress?: () => void
  onWellnessPress?: () => void
}

const metabolicPhaseLabels: Record<MetabolicPhase, string> = {
  discovery: 'Découverte',
  walking: 'Marche',
  resistance: 'Résistance',
  full_program: 'Complet',
}

const wellnessPhaseLabels: Record<WellnessPhase, string> = {
  foundations: 'Fondations',
  awareness: 'Conscience',
  balance: 'Équilibre',
  harmony: 'Harmonie',
}

// Mini circular progress component
function MiniCircularProgress({
  progress,
  size = 44,
  strokeWidth = 4,
  color,
  bgColor,
}: {
  progress: number
  size?: number
  strokeWidth?: number
  color: string
  bgColor: string
}) {
  const center = size / 2
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const strokeDashoffset = circumference * (1 - progress / 100)

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }], position: 'absolute' }}>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </Svg>
      <Text style={[styles.progressText, { color }]}>{Math.round(progress)}%</Text>
    </View>
  )
}

export function ProgramsSection({
  onMetabolicPress,
  onWellnessPress,
}: ProgramsSectionProps) {
  const { colors } = useTheme()

  const {
    isEnrolled: isMetabolicEnrolled,
    currentPhase: metabolicPhase,
    currentWeek: metabolicWeek,
    currentStreak: metabolicStreak,
    getProgressPercentage,
  } = useMetabolicBoostStore()

  const {
    isEnrolled: isWellnessEnrolled,
    currentPhase: wellnessPhase,
    currentWeek: wellnessWeek,
    currentStreak: wellnessStreak,
    getProgressPercentage: getWellnessProgress,
    shouldShowProgram,
    proposeAfterMetabolic,
  } = useWellnessProgramStore()

  // Metabolic program is completed when in full_program phase
  const isMetabolicCompleted = isMetabolicEnrolled && metabolicPhase === 'full_program'

  // Show logic
  const showMetabolic = !isWellnessEnrolled || isMetabolicEnrolled
  const showWellness = shouldShowProgram(isMetabolicEnrolled, isMetabolicCompleted) || isWellnessEnrolled

  // Can join logic
  const canJoinMetabolic = !isWellnessEnrolled
  const canJoinWellness = !isMetabolicEnrolled || isMetabolicCompleted

  // Propose wellness after metabolic completion
  useEffect(() => {
    if (isMetabolicCompleted && !isWellnessEnrolled) {
      proposeAfterMetabolic()
    }
  }, [isMetabolicCompleted, isWellnessEnrolled, proposeAfterMetabolic])

  const hasRelevantPrograms = showMetabolic || isMetabolicEnrolled || showWellness || isWellnessEnrolled

  if (!hasRelevantPrograms) {
    return null
  }

  const metabolicProgress = getProgressPercentage()
  const wellnessProgress = getWellnessProgress()

  const handlePress = (type: 'metabolic' | 'wellness') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    switch (type) {
      case 'metabolic':
        onMetabolicPress?.()
        break
      case 'wellness':
        onWellnessPress?.()
        break
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardsRow}>
        {/* Metabolic Boost Program */}
        {(showMetabolic || isMetabolicEnrolled) && (
          <Pressable
            style={({ pressed }) => [
              styles.programCard,
              { backgroundColor: colors.bg.elevated },
              pressed && styles.cardPressed,
            ]}
            onPress={() => handlePress('metabolic')}
          >
            {/* Header with gradient icon */}
            <View style={styles.cardHeader}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Zap size={18} color="#FFFFFF" />
              </LinearGradient>
              {isMetabolicEnrolled ? (
                <MiniCircularProgress
                  progress={metabolicProgress}
                  color="#F59E0B"
                  bgColor={colors.border.light}
                />
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: canJoinMetabolic ? 'rgba(245, 158, 11, 0.15)' : colors.bg.tertiary }]}>
                  {canJoinMetabolic ? (
                    <Sparkles size={12} color="#F59E0B" />
                  ) : (
                    <Lock size={12} color={colors.text.muted} />
                  )}
                </View>
              )}
            </View>

            {/* Title & Phase */}
            <Text style={[styles.programTitle, { color: colors.text.primary }]}>
              Métabolique
            </Text>

            {isMetabolicEnrolled ? (
              <>
                <View style={[styles.phaseBadge, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Text style={[styles.phaseText, { color: '#D97706' }]}>
                    {metabolicPhaseLabels[metabolicPhase]}
                  </Text>
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text.primary }]}>
                      S{metabolicWeek}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.text.muted }]}>
                      semaine
                    </Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
                  <View style={styles.statItem}>
                    <View style={styles.streakRow}>
                      <Flame size={12} color="#F59E0B" />
                      <Text style={[styles.statValue, { color: colors.text.primary }]}>
                        {metabolicStreak}
                      </Text>
                    </View>
                    <Text style={[styles.statLabel, { color: colors.text.muted }]}>
                      jours
                    </Text>
                  </View>
                </View>

                {/* Continue CTA */}
                <View style={[styles.ctaButton, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                  <Text style={[styles.ctaText, { color: '#D97706' }]}>Continuer</Text>
                  <ChevronRight size={14} color="#D97706" />
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.programDuration, { color: colors.text.tertiary }]}>
                  12 semaines • Relance ton métabolisme
                </Text>

                <View style={[
                  styles.ctaButton,
                  { backgroundColor: canJoinMetabolic ? 'rgba(245, 158, 11, 0.12)' : colors.bg.tertiary }
                ]}>
                  <Text style={[
                    styles.ctaText,
                    { color: canJoinMetabolic ? '#D97706' : colors.text.muted }
                  ]}>
                    {canJoinMetabolic ? 'Rejoindre' : 'Bloqué'}
                  </Text>
                  {canJoinMetabolic && <ChevronRight size={14} color="#D97706" />}
                </View>
              </>
            )}
          </Pressable>
        )}

        {/* Wellness Program */}
        {(showWellness || isWellnessEnrolled) && (
          <Pressable
            style={({ pressed }) => [
              styles.programCard,
              { backgroundColor: colors.bg.elevated },
              pressed && styles.cardPressed,
            ]}
            onPress={() => handlePress('wellness')}
          >
            {/* Header with gradient icon */}
            <View style={styles.cardHeader}>
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Heart size={18} color="#FFFFFF" />
              </LinearGradient>
              {isWellnessEnrolled ? (
                <MiniCircularProgress
                  progress={wellnessProgress}
                  color="#8B5CF6"
                  bgColor={colors.border.light}
                />
              ) : (
                <View style={[styles.statusBadge, { backgroundColor: canJoinWellness ? 'rgba(139, 92, 246, 0.15)' : colors.bg.tertiary }]}>
                  {canJoinWellness ? (
                    <Moon size={12} color="#8B5CF6" />
                  ) : (
                    <Lock size={12} color={colors.text.muted} />
                  )}
                </View>
              )}
            </View>

            {/* Title & Phase */}
            <Text style={[styles.programTitle, { color: colors.text.primary }]}>
              Bien-être
            </Text>

            {isWellnessEnrolled ? (
              <>
                <View style={[styles.phaseBadge, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                  <Text style={[styles.phaseText, { color: '#7C3AED' }]}>
                    {wellnessPhaseLabels[wellnessPhase]}
                  </Text>
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.text.primary }]}>
                      S{wellnessWeek}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.text.muted }]}>
                      semaine
                    </Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
                  <View style={styles.statItem}>
                    <View style={styles.streakRow}>
                      <Star size={12} color="#8B5CF6" />
                      <Text style={[styles.statValue, { color: colors.text.primary }]}>
                        {wellnessStreak}
                      </Text>
                    </View>
                    <Text style={[styles.statLabel, { color: colors.text.muted }]}>
                      jours
                    </Text>
                  </View>
                </View>

                {/* Continue CTA */}
                <View style={[styles.ctaButton, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                  <Text style={[styles.ctaText, { color: '#7C3AED' }]}>Continuer</Text>
                  <ChevronRight size={14} color="#7C3AED" />
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.programDuration, { color: colors.text.tertiary }]}>
                  8 semaines • Équilibre corps & esprit
                </Text>

                <View style={[
                  styles.ctaButton,
                  { backgroundColor: canJoinWellness ? 'rgba(139, 92, 246, 0.12)' : colors.bg.tertiary }
                ]}>
                  <Text style={[
                    styles.ctaText,
                    { color: canJoinWellness ? '#7C3AED' : colors.text.muted }
                  ]}>
                    {canJoinWellness ? 'Rejoindre' : 'Bloqué'}
                  </Text>
                  {canJoinWellness && <ChevronRight size={14} color="#7C3AED" />}
                </View>
              </>
            )}
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  programCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    minHeight: 180,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  iconGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programTitle: {
    ...typography.bodyMedium,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  phaseBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  phaseText: {
    ...typography.caption,
    fontWeight: '600',
  },
  programDuration: {
    ...typography.caption,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    marginHorizontal: spacing.xs,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    fontSize: 10,
    marginTop: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: 4,
    marginTop: 'auto',
  },
  ctaText: {
    ...typography.smallMedium,
    fontWeight: '600',
  },
  progressText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
})
