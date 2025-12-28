/**
 * MetabolicBoostWidget - Widget compact pour le dashboard
 *
 * Affiche la progression du programme de relance métabolique
 * pour les utilisateurs inscrits
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import {
  Zap,
  ChevronRight,
  Heart,
  Footprints,
  Dumbbell,
  TrendingUp,
  Flame,
} from 'lucide-react-native'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useMetabolicBoostStore, PHASE_CONFIGS, type MetabolicPhase } from '../../stores/metabolic-boost-store'
import { useUserStore } from '../../stores/user-store'

interface MetabolicBoostWidgetProps {
  onPress?: () => void
}

const phaseLabels: Record<MetabolicPhase, string> = {
  discovery: 'Decouverte',
  walking: 'Marche Active',
  resistance: 'Resistance',
  full_program: 'Complet',
}

const phaseColors: Record<MetabolicPhase, string> = {
  discovery: colors.accent.primary,
  walking: colors.success,
  resistance: colors.warning,
  full_program: colors.secondary.primary,
}

const phaseIcons: Record<MetabolicPhase, React.ReactNode> = {
  discovery: <Heart size={16} color="#FFFFFF" />,
  walking: <Footprints size={16} color="#FFFFFF" />,
  resistance: <Dumbbell size={16} color="#FFFFFF" />,
  full_program: <Zap size={16} color="#FFFFFF" />,
}

export function MetabolicBoostWidget({ onPress }: MetabolicBoostWidgetProps) {
  const { profile } = useUserStore()
  const {
    isEnrolled,
    currentPhase,
    currentWeek,
    currentStreak,
    getProgressPercentage,
    getCurrentPhaseConfig,
    getTodayLog,
  } = useMetabolicBoostStore()

  // Only show for adaptive metabolism profiles who are enrolled
  const isAdaptive = profile?.metabolismProfile === 'adaptive'

  // Not enrolled yet - show invitation
  if (isAdaptive && !isEnrolled) {
    return (
      <Pressable onPress={onPress}>
        <Card style={styles.card}>
          <View style={styles.inviteContent}>
            <View style={styles.inviteLeft}>
              <View style={styles.iconContainerWarning}>
                <Zap size={20} color={colors.warning} />
              </View>
              <View style={styles.inviteText}>
                <Text style={styles.inviteTitle}>Relance Metabolique</Text>
                <Text style={styles.inviteSubtitle}>
                  9 semaines pour retrouver ton energie
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

  // Not adaptive or not enrolled - don't show
  if (!isAdaptive || !isEnrolled) {
    return null
  }

  // Enrolled - show progress
  const phaseConfig = getCurrentPhaseConfig()
  const progressPercent = getProgressPercentage()
  const todayLog = getTodayLog()

  const todaySteps = todayLog?.steps || 0
  const stepsGoal = phaseConfig.dailyTargets.steps
  const stepsPercent = Math.min((todaySteps / stepsGoal) * 100, 100)

  return (
    <Pressable onPress={onPress}>
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
              <Text style={styles.title}>Relance Metabolique</Text>
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
            <Text style={styles.statEmoji}>
              {todayLog?.energyLevel
                ? ['😴', '😐', '🙂', '😊', '⚡'][todayLog.energyLevel - 1]
                : '❓'}
            </Text>
            <Text style={styles.statValue}>
              {todayLog?.energyLevel ? `${todayLog.energyLevel}/5` : '--'}
            </Text>
            <Text style={styles.statLabel}>Energie</Text>
          </View>
        </View>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.default,
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
  iconContainerWarning: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
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
    backgroundColor: colors.warning,
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
  statEmoji: {
    fontSize: 14,
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

export default MetabolicBoostWidget
