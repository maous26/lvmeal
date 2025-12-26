import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { TrendingUp, TrendingDown, Minus, Award, Flame, Target } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Badge, ProgressBar, CircularProgress } from '../components/ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { formatNumber, getDateKey } from '../lib/utils'

const { width } = Dimensions.get('window')

type TimeRange = '7d' | '30d' | '90d'

export default function ProgressScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const { profile, nutritionGoals } = useUserStore()
  const { dailyData } = useMealsStore()

  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

  // Calculate weekly averages
  const getLast7Days = () => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      days.push(getDateKey(date))
    }
    return days
  }

  const last7Days = getLast7Days()
  const weeklyData = last7Days.map((date) => dailyData[date]?.totalNutrition || {
    calories: 0,
    proteins: 0,
    carbs: 0,
    fats: 0,
  })

  const averageCalories = Math.round(
    weeklyData.reduce((sum, d) => sum + d.calories, 0) / 7
  )
  const averageProteins = Math.round(
    weeklyData.reduce((sum, d) => sum + d.proteins, 0) / 7
  )

  const calorieGoalMet = weeklyData.filter(
    (d) => d.calories >= goals.calories * 0.9 && d.calories <= goals.calories * 1.1
  ).length

  const streak = 3 // Mock streak

  const handleTimeRangeChange = (range: TimeRange) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setTimeRange(range)
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Progrès</Text>
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                timeRange === range && styles.timeRangeButtonActive,
              ]}
              onPress={() => handleTimeRangeChange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  timeRange === range && styles.timeRangeTextActive,
                ]}
              >
                {range === '7d' ? '7 jours' : range === '30d' ? '30 jours' : '90 jours'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Overview */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <View style={styles.statIcon}>
              <Flame size={20} color={colors.nutrients.calories} />
            </View>
            <Text style={styles.statValue}>{formatNumber(averageCalories)}</Text>
            <Text style={styles.statLabel}>Moy. kcal/jour</Text>
            <View style={styles.statTrend}>
              {averageCalories > goals.calories ? (
                <TrendingUp size={14} color={colors.warning} />
              ) : averageCalories < goals.calories * 0.8 ? (
                <TrendingDown size={14} color={colors.error} />
              ) : (
                <Minus size={14} color={colors.success} />
              )}
            </View>
          </Card>

          <Card style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: `${colors.nutrients.proteins}15` }]}>
              <Target size={20} color={colors.nutrients.proteins} />
            </View>
            <Text style={styles.statValue}>{calorieGoalMet}/7</Text>
            <Text style={styles.statLabel}>Objectifs atteints</Text>
          </Card>

          <Card style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: `${colors.warning}15` }]}>
              <Award size={20} color={colors.warning} />
            </View>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Jours série</Text>
          </Card>
        </View>

        {/* Weekly Chart */}
        <Text style={styles.sectionTitle}>Calories cette semaine</Text>
        <Card style={styles.chartCard}>
          <View style={styles.chartContainer}>
            {weeklyData.map((data, index) => {
              const percentage = Math.min((data.calories / goals.calories) * 100, 120)
              const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
              const isToday = index === 6

              return (
                <View key={index} style={styles.chartBar}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${percentage}%`,
                          backgroundColor: isToday
                            ? colors.accent.primary
                            : data.calories > 0
                            ? colors.accent.muted
                            : colors.bg.tertiary,
                        },
                      ]}
                    />
                    {/* Goal line */}
                    <View style={styles.goalLine} />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      isToday && styles.barLabelActive,
                    ]}
                  >
                    {dayNames[(new Date().getDay() - 6 + index + 7) % 7]}
                  </Text>
                </View>
              )
            })}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent.primary }]} />
              <Text style={styles.legendText}>Aujourd'hui</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.border.default }]} />
              <Text style={styles.legendText}>Objectif</Text>
            </View>
          </View>
        </Card>

        {/* Macros Average */}
        <Text style={styles.sectionTitle}>Répartition moyenne</Text>
        <Card style={styles.macrosCard}>
          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <CircularProgress
                value={averageProteins}
                max={goals.proteins}
                size={80}
                strokeWidth={6}
                color={colors.nutrients.proteins}
                label="Protéines"
                unit="g"
              />
            </View>
            <View style={styles.macroItem}>
              <CircularProgress
                value={Math.round(weeklyData.reduce((s, d) => s + d.carbs, 0) / 7)}
                max={goals.carbs}
                size={80}
                strokeWidth={6}
                color={colors.nutrients.carbs}
                label="Glucides"
                unit="g"
              />
            </View>
            <View style={styles.macroItem}>
              <CircularProgress
                value={Math.round(weeklyData.reduce((s, d) => s + d.fats, 0) / 7)}
                max={goals.fats}
                size={80}
                strokeWidth={6}
                color={colors.nutrients.fats}
                label="Lipides"
                unit="g"
              />
            </View>
          </View>
        </Card>

        {/* Achievements */}
        <Text style={styles.sectionTitle}>Badges récents</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.badgesScroll}
          contentContainerStyle={styles.badgesContent}
        >
          <Card style={styles.badgeCard}>
            <Text style={styles.badgeEmoji}>🔥</Text>
            <Text style={styles.badgeName}>Première flamme</Text>
            <Badge variant="success" size="sm">Débloqué</Badge>
          </Card>
          <Card style={styles.badgeCard}>
            <Text style={styles.badgeEmoji}>📊</Text>
            <Text style={styles.badgeName}>Tracker pro</Text>
            <ProgressBar
              value={3}
              max={7}
              size="sm"
              color={colors.accent.primary}
              style={styles.badgeProgress}
            />
            <Text style={styles.badgeProgressText}>3/7 jours</Text>
          </Card>
          <Card style={styles.badgeCard}>
            <Text style={styles.badgeEmoji}>💪</Text>
            <Text style={styles.badgeName}>Protéiné</Text>
            <ProgressBar
              value={5}
              max={10}
              size="sm"
              color={colors.nutrients.proteins}
              style={styles.badgeProgress}
            />
            <Text style={styles.badgeProgressText}>5/10 jours</Text>
          </Card>
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },
  header: {
    padding: spacing.default,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  timeRangeText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: `${colors.nutrients.calories}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  statTrend: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    paddingHorizontal: spacing.default,
    marginBottom: spacing.md,
  },
  chartCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.lg,
  },
  chartContainer: {
    flexDirection: 'row',
    height: 150,
    justifyContent: 'space-between',
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
  },
  barContainer: {
    flex: 1,
    width: 20,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderRadius: radius.sm,
  },
  goalLine: {
    position: 'absolute',
    left: -4,
    right: -4,
    top: '16.7%', // 100% goal line
    height: 2,
    backgroundColor: colors.border.default,
  },
  barLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  barLabelActive: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  legendText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  macrosCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.lg,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  badgesScroll: {
    marginBottom: spacing.lg,
  },
  badgesContent: {
    paddingHorizontal: spacing.default,
    gap: spacing.md,
  },
  badgeCard: {
    width: 120,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  badgeEmoji: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  badgeName: {
    ...typography.smallMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  badgeProgress: {
    width: 80,
    marginTop: spacing.xs,
  },
  badgeProgressText: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
})
