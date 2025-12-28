/**
 * ProgramsSection - Section regroupant les programmes optionnels
 *
 * Affiche les 3 programmes (Sport, Métabolisme, Bien-être) de manière
 * compacte et horizontale pour une meilleure clarté sur la homepage.
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import {
  Dumbbell,
  Zap,
  Heart,
  Sparkles,
  TrendingUp,
  Flame,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, typography, radius } from '../../constants/theme'
import { useSportInitiationStore, type SportPhase } from '../../stores/sport-initiation-store'
import { useMetabolicBoostStore, type MetabolicPhase } from '../../stores/metabolic-boost-store'
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

  const isSedentary = profile?.activityLevel === 'sedentary'
  const isAdaptive = profile?.metabolismProfile === 'adaptive'

  // Check if at least one program is relevant
  const hasRelevantPrograms = isSedentary || isAdaptive

  // If no relevant programs, don't show the section
  if (!hasRelevantPrograms) {
    return null
  }

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
        {/* Sport Initiation - For sedentary users */}
        {isSedentary && (
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

        {/* Metabolic Boost - For adaptive metabolism users */}
        {isAdaptive && (
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

        {/* Wellness - Coming soon for all users */}
        <Pressable
          style={[styles.programCard, styles.programCardDisabled]}
          onPress={() => handlePress('wellness')}
          disabled
        >
          <View style={[styles.iconContainer, styles.iconWellness]}>
            <Heart size={20} color={colors.secondary.primary} />
          </View>

          <Text style={styles.programTitle} numberOfLines={1}>Bien-être</Text>
          <Text style={styles.programSubtitle} numberOfLines={1}>Sommeil</Text>

          <View style={styles.comingSoonBadge}>
            <Sparkles size={10} color={colors.text.muted} />
            <Text style={styles.comingSoonText}>Bientôt</Text>
          </View>
        </Pressable>
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
