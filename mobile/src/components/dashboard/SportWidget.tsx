import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Dumbbell, ChevronRight, Play, TrendingUp, Sparkles, Clock, Trophy } from 'lucide-react-native'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useSportProgramStore } from '../../stores/sport-program-store'
import { useUserStore } from '../../stores/user-store'

interface SportWidgetProps {
  onPress?: () => void
}

const phaseLabels: Record<string, string> = {
  discovery: 'Decouverte',
  walking_program: 'Marche',
  resistance_intro: 'Musculation',
  full_program: 'Complet',
}

export function SportWidget({ onPress }: SportWidgetProps) {
  const { profile } = useUserStore()
  const {
    currentProgram,
    currentStreak,
    totalSessionsCompleted,
    getPhaseProgress,
  } = useSportProgramStore()

  // Check if sport is enabled
  const isSportEnabled = profile?.sportTrackingEnabled || profile?.metabolismProfile === 'adaptive'

  const phaseProgress = getPhaseProgress()

  // Get today's session if any
  const today = new Date().getDay()
  const todaySession = currentProgram?.sessions.find(
    (s) => s.dayOfWeek === today && !s.isCompleted
  )

  // Weekly stats
  const completedSessions = currentProgram?.sessions.filter((s) => s.isCompleted).length || 0
  const totalSessions = currentProgram?.sessions.length || 0
  const weeklyProgress = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0

  // If sport not enabled, show activation prompt
  if (!isSportEnabled) {
    return (
      <Pressable onPress={onPress}>
        <Card style={styles.card}>
          <View style={styles.inactiveContent}>
            <View style={styles.inactiveLeft}>
              <View style={styles.iconContainerViolet}>
                <Sparkles size={20} color="#8B5CF6" />
              </View>
              <View>
                <Text style={styles.title}>Programme Sport LymIA</Text>
                <Text style={styles.subtitle}>Activer pour un coaching personnalise</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.text.tertiary} />
          </View>
        </Card>
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        {/* Header with LymIA branding */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainerViolet}>
              <Sparkles size={16} color="#8B5CF6" />
            </View>
            <Text style={styles.title}>Sport LymIA</Text>
            <Badge variant="outline" size="sm" style={styles.phaseBadge}>
              <Text style={styles.phaseBadgeText}>{phaseLabels[phaseProgress.phase] || phaseProgress.phase}</Text>
            </Badge>
          </View>
          <ChevronRight size={16} color={colors.text.tertiary} />
        </View>

        {/* Today's session or weekly progress */}
        {todaySession ? (
          <View style={styles.todaySession}>
            <View style={styles.playIcon}>
              <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
            </View>
            <View style={styles.sessionContent}>
              <Text style={styles.sessionTitle}>{todaySession.title}</Text>
              <View style={styles.sessionMeta}>
                <View style={styles.sessionMetaItem}>
                  <Clock size={12} color={colors.text.tertiary} />
                  <Text style={styles.sessionMetaText}>{todaySession.duration} min</Text>
                </View>
                <View style={styles.sessionMetaItem}>
                  <Dumbbell size={12} color={colors.text.tertiary} />
                  <Text style={styles.sessionMetaText}>{todaySession.exercises.length} exo</Text>
                </View>
              </View>
            </View>
            <View style={styles.todoTag}>
              <Text style={styles.todoTagText}>A faire</Text>
            </View>
          </View>
        ) : currentProgram ? (
          <View style={styles.weeklyProgress}>
            <View style={styles.weeklyHeader}>
              <Text style={styles.weeklyLabel}>Semaine en cours</Text>
              <Text style={styles.weeklyValue}>
                {completedSessions}/{totalSessions} seances
              </Text>
            </View>
            <ProgressBar
              value={weeklyProgress}
              max={100}
              color={colors.accent.primary}
              size="sm"
            />
          </View>
        ) : (
          <View style={styles.noProgram}>
            <Text style={styles.noProgramText}>
              Clique pour générer ton programme
            </Text>
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          {/* Streak */}
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{currentStreak}j</Text>
            <Text style={styles.statLabel}>Serie</Text>
          </View>

          {/* Sessions */}
          <View style={styles.statItem}>
            <Trophy size={16} color="#D4A574" />
            <Text style={styles.statValue}>{totalSessionsCompleted}</Text>
            <Text style={styles.statLabel}>Seances</Text>
          </View>

          {/* Phase progress */}
          <View style={styles.statItem}>
            <TrendingUp size={16} color="#10B981" />
            <Text style={styles.statValue}>{Math.round(phaseProgress.progress)}%</Text>
            <Text style={styles.statLabel}>Phase</Text>
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
  inactiveContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inactiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
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
  iconContainerViolet: {
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  title: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  phaseBadge: {
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  phaseBadgeText: {
    fontSize: 10,
    color: '#8B5CF6',
  },
  todaySession: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    gap: spacing.sm,
  },
  playIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionContent: {
    flex: 1,
  },
  sessionTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  sessionMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  sessionMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sessionMetaText: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  todoTag: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  todoTagText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  weeklyProgress: {
    gap: spacing.sm,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weeklyLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  weeklyValue: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  noProgram: {
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  noProgramText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statEmoji: {
    fontSize: 16,
  },
  statValue: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
})

export default SportWidget
