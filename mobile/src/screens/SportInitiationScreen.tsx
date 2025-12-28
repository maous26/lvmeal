import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft,
  Flame,
  Footprints,
  Dumbbell,
  Clock,
  ChevronRight,
  Trophy,
  Target,
  Sparkles,
  Check,
  Calendar,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Button, ProgressBar } from '../components/ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import {
  useSportInitiationStore,
  SPORT_PHASE_CONFIGS,
  type SportPhase,
} from '../stores/sport-initiation-store'

const phaseEmojis: Record<SportPhase, string> = {
  activation: '🌱',
  movement: '🚶',
  strengthening: '💪',
  autonomy: '🏆',
}

const phaseColors: Record<SportPhase, string> = {
  activation: colors.success,
  movement: colors.warning,
  strengthening: colors.accent.primary,
  autonomy: colors.secondary.primary,
}

export function SportInitiationScreen() {
  const navigation = useNavigation()
  const {
    isEnrolled,
    currentPhase,
    currentWeek,
    currentStreak,
    longestStreak,
    totalWorkouts,
    getCurrentPhaseConfig,
    getPhaseProgress,
    getWeeklyProgress,
    getTodayLog,
    logDaily,
  } = useSportInitiationStore()

  const phaseConfig = getCurrentPhaseConfig()
  const phaseProgress = getPhaseProgress()
  const weeklyProgress = getWeeklyProgress()
  const todayLog = getTodayLog()

  const allPhases: SportPhase[] = ['activation', 'movement', 'strengthening', 'autonomy']
  const currentPhaseIndex = allPhases.indexOf(currentPhase)

  const handleBack = () => {
    navigation.goBack()
  }

  const handleLogWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    logDaily({
      workoutCompleted: true,
      workoutType: 'session',
      activeMinutes: 20,
    })
  }

  const handleLogWalk = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    logDaily({
      steps: (todayLog?.steps || 0) + 2000,
      activeMinutes: (todayLog?.activeMinutes || 0) + 15,
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Initiation Sportive</Text>
          <Text style={styles.headerSubtitle}>Programme personnalise</Text>
        </View>
        <View style={styles.streakBadge}>
          <Flame size={16} color={colors.warning} />
          <Text style={styles.streakText}>{currentStreak}j</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Phase Card */}
        <Card style={styles.phaseCard}>
          <LinearGradient
            colors={[phaseColors[currentPhase], `${phaseColors[currentPhase]}CC`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.phaseGradient}
          >
            <View style={styles.phaseHeader}>
              <View style={styles.phaseInfo}>
                <Text style={styles.phaseEmoji}>{phaseEmojis[currentPhase]}</Text>
                <View>
                  <Text style={styles.phaseName}>{phaseConfig.name}</Text>
                  <Text style={styles.phaseDescription}>{phaseConfig.description}</Text>
                </View>
              </View>
              <View style={styles.weekBadge}>
                <Calendar size={14} color="#FFFFFF" />
                <Text style={styles.weekText}>Sem. {currentWeek}</Text>
              </View>
            </View>

            {phaseConfig.durationWeeks > 0 && (
              <View style={styles.phaseProgressContainer}>
                <ProgressBar
                  value={phaseProgress.current}
                  max={phaseProgress.total}
                  color="#FFFFFF"
                  backgroundColor="rgba(255,255,255,0.3)"
                  size="sm"
                />
                <Text style={styles.phaseProgressText}>
                  {phaseProgress.current}/{phaseProgress.total} semaines
                </Text>
              </View>
            )}
          </LinearGradient>
        </Card>

        {/* Phase Timeline */}
        <View style={styles.timeline}>
          {allPhases.map((phase, index) => {
            const isCompleted = index < currentPhaseIndex
            const isCurrent = index === currentPhaseIndex
            const isLocked = index > currentPhaseIndex

            return (
              <View key={phase} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    isCompleted && styles.timelineDotCompleted,
                    isCurrent && styles.timelineDotCurrent,
                    isLocked && styles.timelineDotLocked,
                  ]}
                >
                  {isCompleted ? (
                    <Check size={12} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.timelineEmoji}>{phaseEmojis[phase]}</Text>
                  )}
                </View>
                {index < allPhases.length - 1 && (
                  <View
                    style={[
                      styles.timelineLine,
                      isCompleted && styles.timelineLineCompleted,
                    ]}
                  />
                )}
              </View>
            )
          })}
        </View>

        {/* Weekly Progress */}
        <Text style={styles.sectionTitle}>Progression cette semaine</Text>
        <Card style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={styles.progressItem}>
              <View style={styles.progressIcon}>
                <Footprints size={20} color={colors.accent.primary} />
              </View>
              <Text style={styles.progressLabel}>Pas/jour</Text>
              <Text style={styles.progressValue}>
                {weeklyProgress.steps.current.toLocaleString()}
              </Text>
              <Text style={styles.progressTarget}>
                /{weeklyProgress.steps.target.toLocaleString()}
              </Text>
              <ProgressBar
                value={weeklyProgress.steps.current}
                max={weeklyProgress.steps.target}
                color={colors.accent.primary}
                size="sm"
              />
            </View>

            <View style={styles.progressDivider} />

            <View style={styles.progressItem}>
              <View style={styles.progressIcon}>
                <Dumbbell size={20} color={colors.success} />
              </View>
              <Text style={styles.progressLabel}>Seances</Text>
              <Text style={styles.progressValue}>{weeklyProgress.workouts.current}</Text>
              <Text style={styles.progressTarget}>/{weeklyProgress.workouts.target}</Text>
              <ProgressBar
                value={weeklyProgress.workouts.current}
                max={weeklyProgress.workouts.target}
                color={colors.success}
                size="sm"
              />
            </View>

            <View style={styles.progressDivider} />

            <View style={styles.progressItem}>
              <View style={styles.progressIcon}>
                <Clock size={20} color={colors.warning} />
              </View>
              <Text style={styles.progressLabel}>Minutes</Text>
              <Text style={styles.progressValue}>{weeklyProgress.activeMinutes.current}</Text>
              <Text style={styles.progressTarget}>/{weeklyProgress.activeMinutes.target}</Text>
              <ProgressBar
                value={weeklyProgress.activeMinutes.current}
                max={weeklyProgress.activeMinutes.target}
                color={colors.warning}
                size="sm"
              />
            </View>
          </View>
        </Card>

        {/* Quick Log Actions */}
        <Text style={styles.sectionTitle}>Enregistrer aujourd'hui</Text>
        <View style={styles.quickActions}>
          <Pressable
            style={[styles.quickAction, todayLog?.workoutCompleted && styles.quickActionDone]}
            onPress={handleLogWorkout}
          >
            <Dumbbell
              size={24}
              color={todayLog?.workoutCompleted ? '#FFFFFF' : colors.success}
            />
            <Text
              style={[
                styles.quickActionText,
                todayLog?.workoutCompleted && styles.quickActionTextDone,
              ]}
            >
              {todayLog?.workoutCompleted ? 'Seance faite!' : 'Seance faite'}
            </Text>
          </Pressable>

          <Pressable style={styles.quickAction} onPress={handleLogWalk}>
            <Footprints size={24} color={colors.accent.primary} />
            <Text style={styles.quickActionText}>+15 min marche</Text>
          </Pressable>
        </View>

        {/* Today's Objectives */}
        <Text style={styles.sectionTitle}>Objectifs du jour</Text>
        <Card>
          {phaseConfig.objectives.map((objective, index) => (
            <View key={index} style={styles.objectiveItem}>
              <View style={styles.objectiveCheck}>
                <Target size={16} color={colors.text.tertiary} />
              </View>
              <Text style={styles.objectiveText}>{objective}</Text>
            </View>
          ))}
        </Card>

        {/* Exercises Suggestion */}
        <Text style={styles.sectionTitle}>Exercices suggeres</Text>
        <Card>
          <View style={styles.exercisesList}>
            {phaseConfig.exercises.map((exercise, index) => (
              <View key={index} style={styles.exerciseItem}>
                <Sparkles size={16} color={colors.warning} />
                <Text style={styles.exerciseText}>{exercise}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Tes statistiques</Text>
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Trophy size={24} color={colors.warning} />
            <Text style={styles.statValue}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>seances</Text>
          </Card>
          <Card style={styles.statCard}>
            <Flame size={24} color={colors.error} />
            <Text style={styles.statValue}>{longestStreak}</Text>
            <Text style={styles.statLabel}>record</Text>
          </Card>
          <Card style={styles.statCard}>
            <Calendar size={24} color={colors.accent.primary} />
            <Text style={styles.statValue}>{currentWeek}</Text>
            <Text style={styles.statLabel}>semaines</Text>
          </Card>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  streakText: {
    ...typography.smallMedium,
    color: colors.warning,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.default,
  },
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  // Phase Card
  phaseCard: {
    padding: 0,
    overflow: 'hidden',
  },
  phaseGradient: {
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  phaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  phaseEmoji: {
    fontSize: 36,
  },
  phaseName: {
    ...typography.h3,
    color: '#FFFFFF',
  },
  phaseDescription: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  weekBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  weekText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  phaseProgressContainer: {
    marginTop: spacing.lg,
  },
  phaseProgressText: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  // Timeline
  timeline: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  timelineDotCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  timelineDotCurrent: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  timelineDotLocked: {
    opacity: 0.5,
  },
  timelineEmoji: {
    fontSize: 14,
  },
  timelineLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border.default,
  },
  timelineLineCompleted: {
    backgroundColor: colors.success,
  },
  // Progress Card
  progressCard: {},
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
  },
  progressDivider: {
    width: 1,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.sm,
  },
  progressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  progressValue: {
    ...typography.h4,
    color: colors.text.primary,
  },
  progressTarget: {
    ...typography.small,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  quickActionDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  quickActionText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  quickActionTextDone: {
    color: '#FFFFFF',
  },
  // Objectives
  objectiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  objectiveCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectiveText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  // Exercises
  exercisesList: {
    gap: spacing.sm,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseText: {
    ...typography.body,
    color: colors.text.primary,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
})

export default SportInitiationScreen
