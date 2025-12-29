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
import { TrendingUp, TrendingDown, Minus, Award, Flame, Target, Trophy, Zap, Sparkles } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Badge, ProgressBar, CircularProgress } from '../components/ui'
import { GamificationPanel } from '../components/dashboard'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore, TIERS, ACHIEVEMENTS } from '../stores/gamification-store'
import { formatNumber, getDateKey } from '../lib/utils'

const { width } = Dimensions.get('window')

type TimeRange = '7d' | '30d' | '90d'
type TabType = 'nutrition' | 'gamification'

export default function ProgressScreen() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [activeTab, setActiveTab] = useState<TabType>('gamification')
  const { profile, nutritionGoals } = useUserStore()
  const { dailyData } = useMealsStore()
  const {
    totalXP,
    currentStreak,
    weeklyXP,
    getTier,
    getNextTier,
    getTierProgress,
    getWeeklyRank,
    getStreakInfo,
    getAchievements,
    getAICreditsRemaining,
  } = useGamificationStore()

  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }
  const tier = getTier()
  const nextTier = getNextTier()
  const tierProgress = getTierProgress()
  const rank = getWeeklyRank()
  const streakInfo = getStreakInfo()
  const achievements = getAchievements()
  const aiCredits = getAICreditsRemaining()

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

  const handleTimeRangeChange = (range: TimeRange) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setTimeRange(range)
  }

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActiveTab(tab)
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Progres</Text>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'gamification' && styles.tabActive]}
            onPress={() => handleTabChange('gamification')}
          >
            <Trophy size={18} color={activeTab === 'gamification' ? '#FFFFFF' : colors.text.secondary} />
            <Text style={[styles.tabText, activeTab === 'gamification' && styles.tabTextActive]}>
              Classement
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'nutrition' && styles.tabActive]}
            onPress={() => handleTabChange('nutrition')}
          >
            <Target size={18} color={activeTab === 'nutrition' ? '#FFFFFF' : colors.text.secondary} />
            <Text style={[styles.tabText, activeTab === 'nutrition' && styles.tabTextActive]}>
              Nutrition
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'gamification' ? (
          <>
            {/* Tier Card */}
            <View style={[styles.tierCard, { backgroundColor: tier.color + '15', borderColor: tier.color + '40' }]}>
              <View style={styles.tierHeader}>
                <Text style={styles.tierIconLarge}>{tier.icon}</Text>
                <View style={styles.tierInfo}>
                  <Text style={[styles.tierName, { color: tier.color }]}>{tier.nameFr}</Text>
                  <Text style={styles.totalXP}>{totalXP.toLocaleString('fr-FR')} XP total</Text>
                </View>
                <View style={[styles.rankBadge, { backgroundColor: getRankColor(rank.percentile) + '20' }]}>
                  <Trophy size={16} color={getRankColor(rank.percentile)} />
                  <Text style={[styles.rankText, { color: getRankColor(rank.percentile) }]}>
                    Top {rank.percentile}%
                  </Text>
                </View>
              </View>

              {/* Progress to next tier */}
              {nextTier && (
                <View style={styles.tierProgress}>
                  <View style={styles.tierProgressHeader}>
                    <Text style={styles.tierProgressLabel}>
                      Vers {nextTier.icon} {nextTier.nameFr}
                    </Text>
                    <Text style={styles.tierProgressValue}>
                      {tierProgress.current}/{tierProgress.needed} XP
                    </Text>
                  </View>
                  <ProgressBar
                    value={tierProgress.current}
                    max={tierProgress.needed}
                    color={nextTier.color}
                    size="md"
                  />
                </View>
              )}
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, streakInfo.isActive && styles.statCardHighlight]}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={styles.statValue}>{streakInfo.current}</Text>
                <Text style={styles.statLabel}>Serie</Text>
                {streakInfo.bonus > 0 && (
                  <Text style={styles.statBonus}>+{streakInfo.bonus}% XP</Text>
                )}
              </View>

              <View style={styles.statCard}>
                <Zap size={28} color={colors.accent.primary} />
                <Text style={styles.statValue}>{weeklyXP}</Text>
                <Text style={styles.statLabel}>XP cette semaine</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statEmoji}>🤖</Text>
                <Text style={styles.statValue}>{aiCredits === 999 ? '∞' : aiCredits}</Text>
                <Text style={styles.statLabel}>Credits IA/mois</Text>
              </View>

              <View style={styles.statCard}>
                <Award size={28} color={colors.warning} />
                <Text style={styles.statValue}>{unlockedCount}/{achievements.length}</Text>
                <Text style={styles.statLabel}>Achievements</Text>
              </View>
            </View>

            {/* AI Features Unlocked */}
            <Text style={styles.sectionTitle}>Fonctionnalites debloquees</Text>
            <Card style={styles.featuresCard}>
              {tier.features.map((feature, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <Sparkles size={16} color={tier.color} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
              {nextTier && (
                <View style={styles.nextFeatures}>
                  <Text style={styles.nextFeaturesTitle}>
                    A {nextTier.minXP - totalXP} XP pour debloquer:
                  </Text>
                  {nextTier.features.slice(0, 2).map((feature, idx) => (
                    <View key={idx} style={styles.featureItemLocked}>
                      <Text style={styles.lockIcon}>🔒</Text>
                      <Text style={styles.featureTextLocked}>{feature}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Achievements */}
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.achievementsGrid}>
              {achievements.map(({ achievement, unlocked }) => (
                <View
                  key={achievement.id}
                  style={[styles.achievementCard, !unlocked && styles.achievementLocked]}
                >
                  <Text style={[styles.achievementIcon, !unlocked && styles.achievementIconLocked]}>
                    {achievement.icon}
                  </Text>
                  <Text style={[styles.achievementName, !unlocked && styles.achievementNameLocked]}>
                    {achievement.name}
                  </Text>
                  <Text style={styles.achievementDesc}>{achievement.description}</Text>
                  {!unlocked && achievement.xpReward > 0 && (
                    <Text style={styles.achievementXP}>+{achievement.xpReward} XP</Text>
                  )}
                  {unlocked && (
                    <Badge variant="success" size="sm">Obtenu</Badge>
                  )}
                </View>
              ))}
            </View>

            {/* Tier Roadmap */}
            <Text style={styles.sectionTitle}>Parcours des tiers</Text>
            <Card style={styles.roadmapCard}>
              {Object.values(TIERS).map((t, idx) => {
                const isUnlocked = totalXP >= t.minXP
                const isCurrent = t.id === tier.id
                return (
                  <View key={t.id} style={styles.roadmapItem}>
                    <View style={[
                      styles.roadmapIcon,
                      isUnlocked && { backgroundColor: t.color + '20' },
                      isCurrent && styles.roadmapIconCurrent,
                    ]}>
                      <Text style={[styles.roadmapEmoji, !isUnlocked && styles.roadmapEmojiLocked]}>
                        {t.icon}
                      </Text>
                    </View>
                    <View style={styles.roadmapInfo}>
                      <Text style={[styles.roadmapName, isCurrent && { color: t.color }]}>
                        {t.nameFr}
                      </Text>
                      <Text style={styles.roadmapXP}>{t.minXP} XP</Text>
                    </View>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: t.color }]}>
                        <Text style={styles.currentBadgeText}>Actuel</Text>
                      </View>
                    )}
                    {idx < Object.values(TIERS).length - 1 && (
                      <View style={[styles.roadmapLine, isUnlocked && styles.roadmapLineActive]} />
                    )}
                  </View>
                )
              })}
            </Card>
          </>
        ) : (
          <>
            {/* Nutrition Tab Content */}
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
              <Card style={styles.nutritionStatCard}>
                <View style={styles.nutritionStatIcon}>
                  <Flame size={20} color={colors.nutrients.calories} />
                </View>
                <Text style={styles.nutritionStatValue}>{formatNumber(averageCalories)}</Text>
                <Text style={styles.nutritionStatLabel}>Moy. kcal/jour</Text>
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

              <Card style={styles.nutritionStatCard}>
                <View style={[styles.nutritionStatIcon, { backgroundColor: `${colors.nutrients.proteins}15` }]}>
                  <Target size={20} color={colors.nutrients.proteins} />
                </View>
                <Text style={styles.nutritionStatValue}>{calorieGoalMet}/7</Text>
                <Text style={styles.nutritionStatLabel}>Objectifs atteints</Text>
              </Card>

              <Card style={styles.nutritionStatCard}>
                <View style={[styles.nutritionStatIcon, { backgroundColor: `${colors.warning}15` }]}>
                  <Award size={20} color={colors.warning} />
                </View>
                <Text style={styles.nutritionStatValue}>{currentStreak}</Text>
                <Text style={styles.nutritionStatLabel}>Jours serie</Text>
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
            <Text style={styles.sectionTitle}>Repartition moyenne</Text>
            <Card style={styles.macrosCard}>
              <View style={styles.macrosRow}>
                <View style={styles.macroItem}>
                  <CircularProgress
                    value={averageProteins}
                    max={goals.proteins}
                    size={80}
                    strokeWidth={6}
                    color={colors.nutrients.proteins}
                    label="Proteines"
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// Helper function to get rank color
function getRankColor(percentile: number): string {
  if (percentile <= 1) return '#B9F2FF'
  if (percentile <= 5) return '#FFD700'
  if (percentile <= 10) return '#C0C0C0'
  if (percentile <= 25) return '#CD7F32'
  return colors.text.secondary
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

  // Tab Selector
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  tabActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  tabText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  // Tier Card
  tierCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tierIconLarge: {
    fontSize: 48,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    ...typography.h3,
    fontWeight: '700',
  },
  totalXP: {
    ...typography.body,
    color: colors.text.secondary,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  rankText: {
    ...typography.smallMedium,
    fontWeight: '600',
  },
  tierProgress: {
    marginTop: spacing.sm,
  },
  tierProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tierProgressLabel: {
    ...typography.small,
    color: colors.text.secondary,
  },
  tierProgressValue: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: (width - spacing.default * 2 - spacing.sm) / 2 - 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statCardHighlight: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  statEmoji: {
    fontSize: 28,
  },
  statValue: {
    ...typography.h3,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
  statBonus: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },

  // Section Title
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    paddingHorizontal: spacing.default,
    marginBottom: spacing.md,
  },

  // Features Card
  featuresCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.lg,
    padding: spacing.default,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  featureText: {
    ...typography.body,
    color: colors.text.primary,
  },
  nextFeatures: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  nextFeaturesTitle: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.sm,
  },
  featureItemLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    opacity: 0.6,
  },
  lockIcon: {
    fontSize: 14,
  },
  featureTextLocked: {
    ...typography.body,
    color: colors.text.tertiary,
  },

  // Achievements Grid
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  achievementCard: {
    width: (width - spacing.default * 2 - spacing.sm * 2) / 3 - 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  achievementLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    fontSize: 24,
  },
  achievementIconLocked: {
    opacity: 0.4,
  },
  achievementName: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  achievementNameLocked: {
    color: colors.text.tertiary,
  },
  achievementDesc: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
    fontSize: 9,
  },
  achievementXP: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
    fontSize: 10,
  },

  // Roadmap
  roadmapCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.lg,
    padding: spacing.default,
  },
  roadmapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    position: 'relative',
  },
  roadmapIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapIconCurrent: {
    borderWidth: 2,
    borderColor: colors.accent.primary,
  },
  roadmapEmoji: {
    fontSize: 24,
  },
  roadmapEmojiLocked: {
    opacity: 0.3,
  },
  roadmapInfo: {
    flex: 1,
  },
  roadmapName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  roadmapXP: {
    ...typography.caption,
    color: colors.text.muted,
  },
  currentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  currentBadgeText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  roadmapLine: {
    position: 'absolute',
    left: 23,
    top: 56,
    width: 2,
    height: 20,
    backgroundColor: colors.border.light,
  },
  roadmapLineActive: {
    backgroundColor: colors.accent.primary,
  },

  // Nutrition Tab Styles
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
  nutritionStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  nutritionStatIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: `${colors.nutrients.calories}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nutritionStatValue: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  nutritionStatLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  statTrend: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
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
    top: '16.7%',
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
})
