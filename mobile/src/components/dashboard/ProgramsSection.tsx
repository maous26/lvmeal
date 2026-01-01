/**
 * ProgramsSection - Section regroupant les programmes optionnels
 *
 * Affiche les 2 programmes (Métabolisme, Bien-être) de manière
 * compacte et horizontale pour une meilleure clarté sur la homepage.
 *
 * LOGIQUE D'AFFICHAGE BIEN-ÊTRE:
 * - Caché si l'utilisateur est inscrit au programme Métabolisme (non terminé)
 * - Proposé une fois le programme Métabolisme terminé (phase full_program)
 * - Toujours visible si l'utilisateur n'est pas inscrit au Métabolisme
 */

import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Zap,
  Heart,
  Sparkles,
  TrendingUp,
  Flame,
  Moon,
  Star,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, typography, radius } from '../../constants/theme'
import { useMetabolicBoostStore, type MetabolicPhase } from '../../stores/metabolic-boost-store'
import { useWellnessProgramStore, type WellnessPhase } from '../../stores/wellness-program-store'
import { useUserStore } from '../../stores/user-store'

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

export function ProgramsSection({
  onMetabolicPress,
  onWellnessPress,
}: ProgramsSectionProps) {
  const { profile } = useUserStore()

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

  const isAdaptive = profile?.metabolismProfile === 'adaptive'

  // Metabolic program is completed when in full_program phase
  const isMetabolicCompleted = isMetabolicEnrolled && metabolicPhase === 'full_program'

  // Show Metabolic if:
  // - User is NOT enrolled in Wellness program
  // - OR already enrolled in Metabolic
  const showMetabolic = !isWellnessEnrolled || isMetabolicEnrolled

  // Show Wellness if:
  // - User is NOT enrolled in Metabolic program (unless completed)
  // - OR already enrolled in Wellness
  const showWellness = shouldShowProgram(isMetabolicEnrolled, isMetabolicCompleted) || isWellnessEnrolled

  // Can user JOIN Metabolic? (blocked by Wellness)
  const canJoinMetabolic = !isWellnessEnrolled

  // Can user JOIN Wellness? (blocked by active Metabolic)
  const canJoinWellness = !isMetabolicEnrolled || isMetabolicCompleted

  // Propose wellness after metabolic completion
  useEffect(() => {
    if (isMetabolicCompleted && !isWellnessEnrolled) {
      proposeAfterMetabolic()
    }
  }, [isMetabolicCompleted, isWellnessEnrolled, proposeAfterMetabolic])

  // Check if at least one program should be displayed
  const hasRelevantPrograms = showMetabolic || isMetabolicEnrolled || showWellness || isWellnessEnrolled

  // If no relevant programs, don't show the section
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
      <Text style={styles.sectionTitle}>Mes Programmes</Text>
      <View style={styles.cardsRow}>
        {/* Metabolic Boost - blocked by Wellness */}
        {(showMetabolic || isMetabolicEnrolled) && (
          <Pressable
            style={styles.programCard}
            onPress={() => handlePress('metabolic')}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Zap size={20} color="#FFFFFF" />
            </LinearGradient>

            <Text style={styles.programTitle} numberOfLines={1}>Métabolique</Text>

            {isMetabolicEnrolled ? (
              <>
                <View style={styles.statusBadge}>
                  <Text style={[styles.statusText, { color: colors.warning }]}>
                    {metabolicPhaseLabels[metabolicPhase]}
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>S{metabolicWeek}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Flame size={10} color={colors.warning} />
                    <Text style={styles.statValue}>{metabolicStreak}j</Text>
                  </View>
                </View>
                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${metabolicProgress}%`, backgroundColor: colors.warning },
                      ]}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.programSubtitle} numberOfLines={1}>12 semaines</Text>
                <View style={styles.joinButton}>
                  <Sparkles size={12} color={colors.warning} />
                  <Text style={[styles.joinText, { color: colors.warning }]}>
                    {canJoinMetabolic ? 'Rejoindre' : 'Bloqué'}
                  </Text>
                </View>
              </>
            )}
          </Pressable>
        )}

        {/* Wellness Program - blocked by active Metabolic */}
        {(showWellness || isWellnessEnrolled) && (
          <Pressable
            style={styles.programCard}
            onPress={() => handlePress('wellness')}
          >
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Heart size={20} color="#FFFFFF" />
            </LinearGradient>

            <Text style={styles.programTitle} numberOfLines={1}>Bien-être</Text>

            {isWellnessEnrolled ? (
              <>
                <View style={styles.statusBadge}>
                  <Text style={[styles.statusText, { color: colors.secondary.primary }]}>
                    {wellnessPhaseLabels[wellnessPhase]}
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>S{wellnessWeek}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Star size={10} color={colors.secondary.primary} />
                    <Text style={styles.statValue}>{wellnessStreak}j</Text>
                  </View>
                </View>
                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${wellnessProgress}%`, backgroundColor: colors.secondary.primary },
                      ]}
                    />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.programSubtitle} numberOfLines={1}>8 semaines</Text>
                <View style={styles.joinButton}>
                  <Moon size={12} color={colors.secondary.primary} />
                  <Text style={[styles.joinText, { color: colors.secondary.primary }]}>
                    {canJoinWellness ? 'Rejoindre' : 'Bloqué'}
                  </Text>
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
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  programCard: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'center',
    minWidth: 100,
  },
  iconGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  programTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
    marginBottom: 2,
    textAlign: 'center',
  },
  programSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    marginBottom: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 10,
    backgroundColor: colors.border.light,
    marginHorizontal: 2,
  },
  progressContainer: {
    width: '100%',
    paddingHorizontal: spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border.light,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.full,
  },
  joinText: {
    ...typography.caption,
    fontWeight: '600',
  },
})
