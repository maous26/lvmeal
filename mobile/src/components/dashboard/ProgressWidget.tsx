import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Scale,
  Flame,
  Target,
  ChevronRight,
  Zap,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, shadows } from '../../constants/theme'
import { useUserStore } from '../../stores/user-store'
import { useMealsStore } from '../../stores/meals-store'
import { useGamificationStore } from '../../stores/gamification-store'
import { getDateKey } from '../../lib/utils'

const { width } = Dimensions.get('window')

interface ProgressWidgetProps {
  onPress: () => void
}

export function ProgressWidget({ onPress }: ProgressWidgetProps) {
  const { colors } = useTheme()
  const { profile, weightHistory, nutritionGoals } = useUserStore()
  const { dailyData } = useMealsStore()
  const { currentStreak, totalXP, weeklyXP } = useGamificationStore()

  // Weight calculations
  const sortedWeights = useMemo(() => {
    return [...weightHistory].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [weightHistory])

  const currentWeight = sortedWeights[0]?.weight || profile?.weight || null
  const targetWeight = profile?.targetWeight

  // Weekly weight trend
  const weeklyWeightChange = useMemo(() => {
    if (sortedWeights.length < 2) return null

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const recentWeight = sortedWeights[0]?.weight
    const weekAgoEntry = sortedWeights.find(w => new Date(w.date) <= weekAgo)

    if (!recentWeight || !weekAgoEntry) {
      // Compare with previous entry instead
      const previousWeight = sortedWeights[1]?.weight
      if (previousWeight) {
        return +(recentWeight - previousWeight).toFixed(1)
      }
      return null
    }

    return +(recentWeight - weekAgoEntry.weight).toFixed(1)
  }, [sortedWeights])

  // Progress towards goal
  const weightProgress = useMemo(() => {
    if (!currentWeight || !targetWeight || !profile?.weight) return null

    const startWeight = profile.weight
    const totalToLose = startWeight - targetWeight
    const alreadyLost = startWeight - currentWeight

    if (totalToLose === 0) return 100
    return Math.min(100, Math.max(0, (alreadyLost / totalToLose) * 100))
  }, [currentWeight, targetWeight, profile?.weight])

  // Weekly goal achievement
  const weeklyGoalStats = useMemo(() => {
    const now = new Date()
    let daysInTarget = 0
    let totalDays = 0

    for (let i = 0; i < 7; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateKey = getDateKey(date)
      const dayData = dailyData[dateKey]

      if (dayData && dayData.meals.length > 0) {
        totalDays++
        const consumed = dayData.totalNutrition.calories
        const target = nutritionGoals?.calories || 2000
        const deviation = Math.abs(consumed - target) / target

        // Within 10% of target = success
        if (deviation <= 0.10) {
          daysInTarget++
        }
      }
    }

    const percentage = totalDays > 0 ? Math.round((daysInTarget / totalDays) * 100) : 0
    return { daysInTarget, totalDays, percentage }
  }, [dailyData, nutritionGoals])

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  // Weight trend icon
  const TrendIcon = weeklyWeightChange === null
    ? Minus
    : weeklyWeightChange < 0
      ? TrendingDown
      : weeklyWeightChange > 0
        ? TrendingUp
        : Minus

  const trendColor = weeklyWeightChange === null
    ? colors.text.muted
    : weeklyWeightChange < 0
      ? colors.success
      : weeklyWeightChange > 0
        ? colors.warning
        : colors.text.muted

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.bg.elevated }, shadows.md]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[colors.accent.primary, colors.secondary.primary]}
            style={styles.iconContainer}
          >
            <TrendingUp size={18} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.title, { color: colors.text.primary }]}>Mes Progrès</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.seeAll, { color: colors.accent.primary }]}>Voir tout</Text>
          <ChevronRight size={16} color={colors.accent.primary} />
        </View>
      </View>

      {/* Weight Section */}
      <View style={styles.weightSection}>
        <View style={styles.weightMain}>
          <View style={[styles.weightIconBg, { backgroundColor: colors.accent.light }]}>
            <Scale size={20} color={colors.accent.primary} />
          </View>
          <View style={styles.weightInfo}>
            <Text style={[styles.weightValue, { color: colors.text.primary }]}>
              {currentWeight ? `${currentWeight} kg` : 'Non renseigné'}
            </Text>
            {weeklyWeightChange !== null && (
              <View style={styles.trendContainer}>
                <TrendIcon size={14} color={trendColor} />
                <Text style={[styles.trendText, { color: trendColor }]}>
                  {weeklyWeightChange > 0 ? '+' : ''}{weeklyWeightChange} kg
                </Text>
                <Text style={[styles.trendPeriod, { color: colors.text.muted }]}>
                  cette sem.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Progress bar towards goal */}
        {targetWeight && weightProgress !== null && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: colors.text.muted }]}>
                Objectif: {targetWeight} kg
              </Text>
              <Text style={[styles.progressPercent, { color: colors.accent.primary }]}>
                {Math.round(weightProgress)}%
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.bg.tertiary }]}>
              <LinearGradient
                colors={[colors.accent.primary, colors.secondary.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${weightProgress}%` }]}
              />
            </View>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={[styles.statsRow, { borderTopColor: colors.border.light }]}>
        {/* Streak */}
        <View style={styles.statItem}>
          <View style={[styles.statIconBg, { backgroundColor: `${colors.warning}15` }]}>
            <Flame size={16} color={colors.warning} />
          </View>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>{currentStreak}</Text>
          <Text style={[styles.statLabel, { color: colors.text.muted }]}>jours</Text>
        </View>

        {/* Separator */}
        <View style={[styles.separator, { backgroundColor: colors.border.light }]} />

        {/* Goals achieved */}
        <View style={styles.statItem}>
          <View style={[styles.statIconBg, { backgroundColor: `${colors.success}15` }]}>
            <Target size={16} color={colors.success} />
          </View>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>
            {weeklyGoalStats.percentage}%
          </Text>
          <Text style={[styles.statLabel, { color: colors.text.muted }]}>objectifs</Text>
        </View>

        {/* Separator */}
        <View style={[styles.separator, { backgroundColor: colors.border.light }]} />

        {/* Weekly XP */}
        <View style={styles.statItem}>
          <View style={[styles.statIconBg, { backgroundColor: `${colors.secondary.primary}15` }]}>
            <Zap size={16} color={colors.secondary.primary} />
          </View>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>+{weeklyXP}</Text>
          <Text style={[styles.statLabel, { color: colors.text.muted }]}>XP sem.</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h4,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAll: {
    ...typography.smallMedium,
  },
  // Weight Section
  weightSection: {
    marginBottom: spacing.md,
  },
  weightMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  weightIconBg: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightInfo: {
    flex: 1,
  },
  weightValue: {
    ...typography.h3,
    fontWeight: '700',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  trendText: {
    ...typography.smallMedium,
    fontWeight: '600',
  },
  trendPeriod: {
    ...typography.caption,
  },
  // Progress
  progressSection: {
    marginTop: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    ...typography.small,
  },
  progressPercent: {
    ...typography.smallMedium,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIconBg: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
  },
  separator: {
    width: 1,
    height: 40,
  },
})

export default ProgressWidget
