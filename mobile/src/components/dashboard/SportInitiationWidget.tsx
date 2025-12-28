/**
 * SportInitiationWidget - Widget compact pour le dashboard
 *
 * Affiche la progression du programme d'initiation sportive
 * pour les utilisateurs sedentaires inscrits ou invite ceux qui ne le sont pas
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import {
  Dumbbell,
  ChevronRight,
  Footprints,
  Clock,
  TrendingUp,
  Flame,
  Heart,
  Trophy,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'
import { colors, spacing, typography, radius } from '../../constants/theme'
import {
  useSportInitiationStore,
  SPORT_PHASE_CONFIGS,
  type SportPhase,
} from '../../stores/sport-initiation-store'
import { useUserStore } from '../../stores/user-store'

const phaseLabels: Record<SportPhase, string> = {
  activation: 'Activation',
  movement: 'Mouvement',
  strengthening: 'Renforcement',
  autonomy: 'Autonomie',
}

const phaseColors: Record<SportPhase, string> = {
  activation: colors.success,
  movement: colors.warning,
  strengthening: colors.accent.primary,
  autonomy: colors.secondary.primary,
}

const phaseIcons: Record<SportPhase, React.ReactNode> = {
  activation: <Heart size={16} color="#FFFFFF" />,
  movement: <Footprints size={16} color="#FFFFFF" />,
  strengthening: <Dumbbell size={16} color="#FFFFFF" />,
  autonomy: <Trophy size={16} color="#FFFFFF" />,
}

interface SportInitiationWidgetProps {
  onPress?: () => void
}

export function SportInitiationWidget({ onPress }: SportInitiationWidgetProps) {
  const { profile } = useUserStore()
  const {
    isEnrolled,
    currentPhase,
    currentWeek,
    currentStreak,
    getPhaseProgress,
    getWeeklyProgress,
    getTodayLog,
  } = useSportInitiationStore()

  // Only show for sedentary users
  const isSedentary = profile?.activityLevel === 'sedentary'

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  // Not enrolled yet - show invitation for sedentary users
  if (isSedentary && !isEnrolled) {
    return (
      <Pressable onPress={handlePress}>
        <Card style={styles.card}>
          <View style={styles.inviteContent}>
            <View style={styles.inviteLeft}>
              <View style={styles.iconContainerSuccess}>
                <Dumbbell size={20} color={colors.success} />
              </View>
              <View style={styles.inviteText}>
                <Text style={styles.inviteTitle}>Initiation Sportive</Text>
                <Text style={styles.inviteSubtitle}>
                  9 semaines pour devenir actif progressivement
                </Text>
              </View>
            </View>
            <View style={styles.joinBadge}>
              <Text style={styles.joinBadgeText}>Rejoindre</Text>
            </View>
          </View>
        </Card>
      </Pressable>
    )
  }

  // Not sedentary or not enrolled - don't show
  if (!isSedentary || !isEnrolled) {
    return null
  }

  // Enrolled - show progress
  const phaseConfig = SPORT_PHASE_CONFIGS[currentPhase]
  const phaseProgress = getPhaseProgress()
  const weeklyProgress = getWeeklyProgress()
  const todayLog = getTodayLog()

  const todaySteps = todayLog?.steps || 0
  const stepsGoal = phaseConfig.dailyTargets.steps
  const stepsPercent = Math.min((todaySteps / stepsGoal) * 100, 100)

  // Calculate global progress percentage
  const totalWeeks = 9 // 2 + 3 + 4 = 9 weeks for the program
  const weeksInPhase: Record<SportPhase, number> = {
    activation: 0,
    movement: 2,
    strengthening: 5,
    autonomy: 9,
  }
  const completedWeeks = weeksInPhase[currentPhase] + (currentWeek - 1)
  const progressPercent = currentPhase === 'autonomy'
    ? 100
    : Math.round((completedWeeks / totalWeeks) * 100)

  return (
    <Pressable onPress={handlePress}>
      <Card style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View
              style={[
                styles.phaseIcon,
                { backgroundColor: phaseColors[currentPhase] },
              ]}
            >
              {phaseIcons[currentPhase]}
            </View>
            <View>
              <Text style={styles.title}>Initiation Sportive</Text>
              <View style={styles.headerMeta}>
                <Badge
                  variant="outline"
                  size="sm"
                  style={{
                    ...styles.phaseBadge,
                    borderColor: `${phaseColors[currentPhase]}40`,
                  }}
                >
                  <Text
                    style={[
                      styles.phaseBadgeText,
                      { color: phaseColors[currentPhase] },
                    ]}
                  >
                    {phaseLabels[currentPhase]}
                  </Text>
                </Badge>
                <Text style={styles.weekText}>Sem. {currentWeek}</Text>
              </View>
            </View>
          </View>
          <ChevronRight size={16} color={colors.text.tertiary} />
        </View>

        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progression globale</Text>
            <Text style={styles.progressValue}>{progressPercent}%</Text>
          </View>
          <ProgressBar
            value={progressPercent}
            max={100}
            color={phaseColors[currentPhase]}
            size="sm"
          />
        </View>

        {/* Today's progress */}
        <View style={styles.todaySection}>
          <View style={styles.todayItem}>
            <Footprints size={14} color={colors.text.tertiary} />
            <Text style={styles.todayText}>
              {todaySteps.toLocaleString()} / {stepsGoal.toLocaleString()} pas
            </Text>
            <View style={styles.todayProgress}>
              <View
                style={[
                  styles.todayProgressFill,
                  {
                    width: `${stepsPercent}%`,
                    backgroundColor: stepsPercent >= 100 ? colors.success : colors.accent.primary,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Flame size={14} color={colors.warning} />
            <Text style={styles.statValue}>{currentStreak}j</Text>
            <Text style={styles.statLabel}>Serie</Text>
          </View>
          <View style={styles.statItem}>
            <TrendingUp size={14} color={colors.success} />
            <Text style={styles.statValue}>{progressPercent}%</Text>
            <Text style={styles.statLabel}>Avancement</Text>
          </View>
          <View style={styles.statItem}>
            <Clock size={14} color={colors.accent.primary} />
            <Text style={styles.statValue}>{weeklyProgress.activeMinutes.current}</Text>
            <Text style={styles.statLabel}>min actives</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.default,
    marginBottom: spacing.md,
  },
  // Invite state
  inviteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  iconContainerSuccess: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteText: {
    flex: 1,
  },
  inviteTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  inviteSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  joinBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  joinBadgeText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  // Enrolled state
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  phaseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  phaseBadge: {
    paddingHorizontal: spacing.xs,
  },
  phaseBadgeText: {
    fontSize: 10,
  },
  weekText: {
    fontSize: 10,
    color: colors.text.muted,
  },
  // Progress
  progressSection: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  progressValue: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  // Today
  todaySection: {
    marginBottom: spacing.md,
  },
  todayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  todayText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  todayProgress: {
    width: 60,
    height: 4,
    backgroundColor: colors.bg.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  todayProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 9,
    color: colors.text.muted,
  },
})

export default SportInitiationWidget
