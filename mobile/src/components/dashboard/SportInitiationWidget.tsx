/**
 * SportInitiationWidget - Widget pour la homepage
 *
 * Affiche un resume du programme d'initiation sportive
 * pour les utilisateurs sedentaires inscrits au programme.
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Dumbbell,
  ChevronRight,
  Flame,
  Target,
  Sparkles,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, ProgressBar } from '../ui'
import { colors, spacing, typography, radius } from '../../constants/theme'
import {
  useSportInitiationStore,
  SPORT_PHASE_CONFIGS,
  type SportPhase,
} from '../../stores/sport-initiation-store'

const phaseEmojis: Record<SportPhase, string> = {
  activation: '🌱',
  movement: '🚶',
  strengthening: '💪',
  autonomy: '🏆',
}

interface SportInitiationWidgetProps {
  onPress?: () => void
}

export function SportInitiationWidget({ onPress }: SportInitiationWidgetProps) {
  const {
    isEnrolled,
    currentPhase,
    currentWeek,
    currentStreak,
    getCurrentPhaseConfig,
    getPhaseProgress,
    getWeeklyProgress,
    getTodayLog,
  } = useSportInitiationStore()

  // Don't show if not enrolled
  if (!isEnrolled) {
    return null
  }

  const phaseConfig = getCurrentPhaseConfig()
  const phaseProgress = getPhaseProgress()
  const weeklyProgress = getWeeklyProgress()
  const todayLog = getTodayLog()

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  // Check if today's workout is done
  const workoutDone = todayLog?.workoutCompleted

  return (
    <Pressable onPress={handlePress}>
      <Card style={styles.container}>
        <LinearGradient
          colors={[colors.success, `${colors.success}DD`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.emoji}>{phaseEmojis[currentPhase]}</Text>
              <View style={styles.titleContainer}>
                <Text style={styles.title}>Initiation Sportive</Text>
                <Text style={styles.subtitle}>
                  Phase {phaseConfig.name} - Sem. {currentWeek}
                </Text>
              </View>
            </View>
            <View style={styles.streakBadge}>
              <Flame size={14} color="#FFFFFF" />
              <Text style={styles.streakText}>{currentStreak}j</Text>
            </View>
          </View>

          {/* Progress */}
          {phaseProgress.total > 0 && (
            <View style={styles.progressSection}>
              <ProgressBar
                value={phaseProgress.current}
                max={phaseProgress.total}
                color="#FFFFFF"
                backgroundColor="rgba(255,255,255,0.3)"
                size="sm"
              />
              <Text style={styles.progressText}>
                {phaseProgress.current}/{phaseProgress.total} semaines
              </Text>
            </View>
          )}

          {/* Today's Status */}
          <View style={styles.todaySection}>
            {workoutDone ? (
              <View style={styles.todayDone}>
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.todayText}>Seance du jour terminee!</Text>
              </View>
            ) : (
              <View style={styles.todayPending}>
                <Target size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.todayTextPending}>
                  Objectif: {phaseConfig.dailyTargets.activeMinutes} min d'activite
                </Text>
              </View>
            )}
          </View>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{weeklyProgress.steps.current}</Text>
              <Text style={styles.statLabel}>pas/j</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{weeklyProgress.workouts.current}</Text>
              <Text style={styles.statLabel}>seances</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{weeklyProgress.activeMinutes.current}</Text>
              <Text style={styles.statLabel}>min</Text>
            </View>
          </View>

          {/* CTA */}
          <View style={styles.cta}>
            <Text style={styles.ctaText}>Voir mon programme</Text>
            <ChevronRight size={18} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  gradient: {
    padding: spacing.default,
    borderRadius: radius.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emoji: {
    fontSize: 28,
  },
  titleContainer: {},
  title: {
    ...typography.bodySemibold,
    color: '#FFFFFF',
  },
  subtitle: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  streakText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  progressSection: {
    marginTop: spacing.md,
  },
  progressText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    marginTop: 4,
  },
  todaySection: {
    marginTop: spacing.md,
  },
  todayDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  todayText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  todayPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  todayTextPending: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statValue: {
    ...typography.bodySemibold,
    color: '#FFFFFF',
  },
  statLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  ctaText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
})

export default SportInitiationWidget
