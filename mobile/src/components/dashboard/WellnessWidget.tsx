import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Moon, Droplets, Brain, Activity, ChevronRight, Sparkles } from 'lucide-react-native'
import { Card } from '../ui/Card'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useWellnessStore } from '../../stores/wellness-store'

interface WellnessWidgetProps {
  onPress?: () => void
}

export function WellnessWidget({ onPress }: WellnessWidgetProps) {
  const {
    todayScore,
    getEntryForDate,
  } = useWellnessStore()

  const today = new Date().toISOString().split('T')[0]
  const todayEntry = getEntryForDate(today)
  const score = todayScore()

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981' // emerald
    if (score >= 60) return '#3B82F6' // blue
    if (score >= 40) return '#F59E0B' // amber
    return '#EF4444' // red
  }

  const stressLabels = ['Zen', 'Calme', 'Ok', 'Haut', 'Max']

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Sparkles size={16} color="#6366F1" />
            </View>
            <Text style={styles.title}>Bien-etre</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.score, { color: getScoreColor(score) }]}>
              {score}
            </Text>
            <Text style={styles.scoreMax}>/100</Text>
            <ChevronRight size={16} color={colors.text.tertiary} />
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Sleep */}
          <View style={styles.statItem}>
            <Moon size={16} color="#6366F1" />
            <Text style={styles.statValue}>
              {todayEntry?.sleepHours || '--'}h
            </Text>
          </View>

          {/* Water */}
          <View style={styles.statItem}>
            <Droplets size={16} color="#06B6D4" />
            <Text style={styles.statValue}>
              {todayEntry?.waterLiters?.toFixed(1) || '--'}L
            </Text>
          </View>

          {/* Stress */}
          <View style={styles.statItem}>
            <Brain size={16} color="#F43F5E" />
            <Text style={styles.statValue}>
              {todayEntry?.stressLevel ? stressLabels[todayEntry.stressLevel - 1] : '--'}
            </Text>
          </View>

          {/* Steps */}
          <View style={styles.statItem}>
            <Activity size={16} color="#10B981" />
            <Text style={styles.statValue}>
              {todayEntry?.steps ? `${Math.round(todayEntry.steps / 1000)}k` : '--'}
            </Text>
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
  iconContainer: {
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  title: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  score: {
    ...typography.h4,
    fontWeight: '700',
  },
  scoreMax: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.primary,
  },
})

export default WellnessWidget
