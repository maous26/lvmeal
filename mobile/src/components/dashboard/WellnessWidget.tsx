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

  // Score color - iOS palette
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#34C759' // Apple Green - excellent
    if (score >= 60) return '#5AC8FA' // Apple Teal - good
    if (score >= 40) return '#FF9500' // Apple Orange - warning
    return '#FF3B30' // Apple Red - needs attention
  }

  const stressLabels = ['Zen', 'Calme', 'Ok', 'Haut', 'Max']

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Sparkles size={16} color="#34C759" />
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

        {/* Stats Grid - Organic colors */}
        <View style={styles.statsGrid}>
          {/* Sleep */}
          <View style={styles.statItem}>
            <Moon size={16} color="#9B7BB8" />
            <Text style={styles.statValue}>
              {todayEntry?.sleepHours || '--'}h
            </Text>
          </View>

          {/* Water */}
          <View style={styles.statItem}>
            <Droplets size={16} color="#6BA3BE" />
            <Text style={styles.statValue}>
              {todayEntry?.waterLiters?.toFixed(1) || '--'}L
            </Text>
          </View>

          {/* Stress */}
          <View style={styles.statItem}>
            <Brain size={16} color="#FF9500" />
            <Text style={styles.statValue}>
              {todayEntry?.stressLevel ? stressLabels[todayEntry.stressLevel - 1] : '--'}
            </Text>
          </View>

          {/* Steps */}
          <View style={styles.statItem}>
            <Activity size={16} color="#7A9E7E" />
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
    backgroundColor: 'rgba(74, 103, 65, 0.1)', // Vert mousse
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
