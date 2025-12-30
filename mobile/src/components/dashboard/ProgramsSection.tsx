/**
 * ProgramsSection - Section regroupant les programmes optionnels
 *
 * Affiche les 3 programmes (Sport, Métabolisme, Bien-être) de manière
 * compacte et horizontale pour une meilleure clarté sur la homepage.
 *
 * LOGIQUE D'AFFICHAGE BIEN-ÊTRE:
 * - Caché si l'utilisateur est inscrit au programme Métabolisme (non terminé)
 * - Proposé une fois le programme Métabolisme terminé (phase full_program)
 * - Toujours visible si l'utilisateur n'est pas inscrit au Métabolisme
 */

import React, { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import {
  Dumbbell,
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
import { useSportInitiationStore, type SportPhase } from '../../stores/sport-initiation-store'
import { useMetabolicBoostStore, type MetabolicPhase } from '../../stores/metabolic-boost-store'
import { useWellnessProgramStore, type WellnessPhase } from '../../stores/wellness-program-store'
import { useUserStore } from '../../stores/user-store'

interface ProgramsSectionProps {
  onSportPress?: () => void
  onMetabolicPress?: () => void
  onWellnessPress?: () => void
}

const sportPhaseLabels: Record<SportPhase, string> = {
  activation: 'Activation',
  movement: 'Mouvement',
  strengthening: 'Renforcement',
  autonomy: 'Autonomie',
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
  onSportPress,
  onMetabolicPress,
  onWellnessPress,
}: ProgramsSectionProps) {
  const { profile } = useUserStore()

  const {
    isEnrolled: isSportEnrolled,
    currentPhase: sportPhase,
    currentWeek: sportWeek,
    currentStreak: sportStreak,
  } = useSportInitiationStore()

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

  const isSedentary = profile?.activityLevel === 'sedentary'
  const isAdaptive = profile?.metabolismProfile === 'adaptive'

  // Metabolic program is completed when in full_program phase
  const isMetabolicCompleted = isMetabolicEnrolled && metabolicPhase === 'full_program'

  // ============================================================================
  // PROGRAM EXCLUSION RULES:
  // - Sport: blocks Metabolic (not Wellness)
  // - Metabolic: blocks Sport AND Wellness
  // - Wellness: blocks Metabolic (not Sport)
  // ============================================================================

  // Show Sport if:
  // - User is sedentary AND
  // - User is NOT enrolled in Metabolic program (unless completed)
  const showSport = isSedentary && (!isMetabolicEnrolled || isMetabolicCompleted)

  // Show Metabolic if:
  // - User has adaptive metabolism AND
  // - User is NOT enrolled in Sport program AND
  // - User is NOT enrolled in Wellness program
  const showMetabolic = isAdaptive && !isSportEnrolled && !isWellnessEnrolled

  // Show Wellness if:
  // - User is NOT enrolled in Metabolic program (unless completed)
  // - OR already enrolled in Wellness
  const showWellness = shouldShowProgram(isMetabolicEnrolled, isMetabolicCompleted) || isWellnessEnrolled

  // Can user JOIN Sport? (blocked by active Metabolic)
  const canJoinSport = !isMetabolicEnrolled || isMetabolicCompleted

  // Can user JOIN Metabolic? (blocked by Sport OR Wellness)
  const canJoinMetabolic = !isSportEnrolled && !isWellnessEnrolled

  // Can user JOIN Wellness? (blocked by active Metabolic)
  const canJoinWellness = !isMetabolicEnrolled || isMetabolicCompleted

  // Propose wellness after metabolic completion
  useEffect(() => {
    if (isMetabolicCompleted && !isWellnessEnrolled) {
      proposeAfterMetabolic()
    }
  }, [isMetabolicCompleted, isWellnessEnrolled, proposeAfterMetabolic])

  // Check if at least one program should be displayed
  // Either user qualifies for it OR is already enrolled
  // Note: Metabolic only counts if user is adaptive
  const hasRelevantPrograms = showSport || isSportEnrolled || (isAdaptive && (showMetabolic || isMetabolicEnrolled)) || showWellness || isWellnessEnrolled

  // If no relevant programs, don't show the section
  if (!hasRelevantPrograms) {
    return null
  }

  const wellnessProgress = getWellnessProgress()

  const handlePress = (type: 'sport' | 'metabolic' | 'wellness') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    switch (type) {
      case 'sport':
        onSportPress?.()
        break
      case 'metabolic':
        onMetabolicPress?.()
        break
      case 'wellness':
        onWellnessPress?.()
        break
    }
  }

  const metabolicProgress = getProgressPercentage()

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Mes Programmes</Text>
      <View style={styles.cardsRow}>
        {/* Sport Initiation - For sedentary users (blocked by Metabolic) */}
        {(showSport || isSportEnrolled) && (
          <Pressable
            style={styles.programCard}
            onPress={() => handlePress('sport')}
          >
            <View style={[styles.iconContainer, styles.iconSport]}>
              <Dumbbell size={20} color={colors.success} />
            </View>

            <Text style={styles.programTitle} numberOfLines={1}>Sport</Text>

            {isSportEnrolled ? (
              <>
                <View style={styles.statusBadge}>
                  <Text style={[styles.statusText, { color: colors.success }]}>
                    {sportPhaseLabels[sportPhase]}
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>S{sportWeek}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Flame size={10} color={colors.warning} />
                    <Text style={styles.statValue}>{sportStreak}j</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.programSubtitle} numberOfLines={1}>9 semaines</Text>
                <View style={styles.joinButton}>
                  <Text style={styles.joinText}>Rejoindre</Text>
                </View>
              </>
            )}
          </Pressable>
        )}

        {/* Metabolic Boost - For adaptive metabolism ONLY (blocked by Sport AND Wellness) */}
        {isAdaptive && (showMetabolic || isMetabolicEnrolled) && (
          <Pressable
            style={styles.programCard}
            onPress={() => handlePress('metabolic')}
          >
            <View style={[styles.iconContainer, styles.iconMetabolic]}>
              <Zap size={20} color={colors.warning} />
            </View>

            <Text style={styles.programTitle} numberOfLines={1}>Métabo</Text>

            {isMetabolicEnrolled ? (
              <>
                <View style={styles.statusBadge}>
                  <Text style={[styles.statusText, { color: colors.warning }]}>
                    {metabolicPhaseLabels[metabolicPhase]}
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <TrendingUp size={10} color={colors.success} />
                    <Text style={styles.statValue}>{metabolicProgress}%</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Flame size={10} color={colors.warning} />
                    <Text style={styles.statValue}>{metabolicStreak}j</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.programSubtitle} numberOfLines={1}>9 semaines</Text>
                <View style={[styles.joinButton, styles.joinButtonMetabolic]}>
                  <Text style={[styles.joinText, styles.joinTextMetabolic]}>Rejoindre</Text>
                </View>
              </>
            )}
          </Pressable>
        )}

        {/* Wellness Program - Blocked by Metabolic only (can combine with Sport) */}
        {(showWellness || isWellnessEnrolled) && (
          <Pressable
            style={[
              styles.programCard,
              isMetabolicCompleted && !isWellnessEnrolled && styles.programCardHighlighted,
            ]}
            onPress={() => handlePress('wellness')}
          >
            <View style={[styles.iconContainer, styles.iconWellness]}>
              <Heart size={20} color={colors.secondary.primary} />
            </View>

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
                    <TrendingUp size={10} color={colors.success} />
                    <Text style={styles.statValue}>{wellnessProgress}%</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Moon size={10} color={colors.secondary.primary} />
                    <Text style={styles.statValue}>{wellnessStreak}j</Text>
                  </View>
                </View>
              </>
            ) : isMetabolicCompleted ? (
              // Special promotion after metabolic completion
              <>
                <Text style={styles.programSubtitle} numberOfLines={1}>8 semaines</Text>
                <View style={[styles.joinButton, styles.joinButtonWellness]}>
                  <Star size={10} color={colors.secondary.primary} />
                  <Text style={[styles.joinText, styles.joinTextWellness]}>Découvrir</Text>
                </View>
              </>
            ) : (
              // Normal state - available to join
              <>
                <Text style={styles.programSubtitle} numberOfLines={1}>8 semaines</Text>
                <View style={[styles.joinButton, styles.joinButtonWellness]}>
                  <Text style={[styles.joinText, styles.joinTextWellness]}>Rejoindre</Text>
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
    marginBottom: spacing.md,
    width: '100%',
  },
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  programCard: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  programCardDisabled: {
    opacity: 0.6,
  },
  programCardHighlighted: {
    borderColor: colors.secondary.primary,
    borderWidth: 2,
    shadowColor: colors.secondary.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  iconSport: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  iconMetabolic: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  iconWellness: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  programTitle: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  programSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  statusBadge: {
    marginTop: spacing.xs,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 10,
    backgroundColor: colors.border.light,
  },
  statValue: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  joinButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: radius.full,
  },
  joinButtonMetabolic: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  joinText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success,
  },
  joinTextMetabolic: {
    color: colors.warning,
  },
  joinButtonWellness: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  joinTextWellness: {
    color: colors.secondary.primary,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.full,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.text.muted,
  },
})

export default ProgramsSection
