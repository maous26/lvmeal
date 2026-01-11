import React, { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  TextInput,
} from 'react-native'
import { useToast } from '../components/ui/Toast'
import { TrendingUp, TrendingDown, Minus, Award, Flame, Target, Trophy, Zap, Sparkles, Scale, Plus, Bluetooth } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop, Line, Text as SvgText } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Card, Badge, ProgressBar, CircularProgress } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { colors as staticColors, fonts, spacing, typography, radius, shadows } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore, TIERS } from '../stores/gamification-store'
import { formatNumber, getDateKey, generateId } from '../lib/utils'
import type { WeightEntry } from '../types'

const { width } = Dimensions.get('window')

type TabType = 'progress' | 'gamification'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function ProgressScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('progress')
  const [showAddWeight, setShowAddWeight] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const { profile, nutritionGoals, weightHistory, addWeightEntry } = useUserStore()
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

  // Weight calculations
  const sortedWeights = useMemo(() => {
    return [...weightHistory].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [weightHistory])

  const currentWeight = sortedWeights[0]?.weight || profile?.weight || null
  const targetWeight = profile?.targetWeight

  // Weight stats
  const weightStats = useMemo(() => {
    const current = sortedWeights[0]?.weight || profile?.weight || 0
    const target = profile?.targetWeight
    const start = profile?.weight || current

    // Weekly change
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weekAgoEntry = sortedWeights.find(w => new Date(w.date) <= weekAgo)
    const weeklyChange = weekAgoEntry ? +(current - weekAgoEntry.weight).toFixed(1) : null

    // Progress towards goal
    const totalToLose = start - (target || start)
    const lost = start - current
    const progress = totalToLose !== 0 ? Math.min(100, Math.max(0, (lost / totalToLose) * 100)) : 0

    return { current, target, start, weeklyChange, progress }
  }, [sortedWeights, profile])

  // Add weight handler
  const handleAddWeight = useCallback(() => {
    const weight = parseFloat(newWeight)
    if (isNaN(weight) || weight < 30 || weight > 300) {
      toast.error('Poids invalide (30-300 kg)')
      return
    }

    const entry: WeightEntry = {
      id: generateId(),
      date: new Date().toISOString(),
      weight,
    }

    addWeightEntry(entry)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setNewWeight('')
    setShowAddWeight(false)
  }, [newWeight, addWeightEntry, toast])

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
  const averageCarbs = Math.round(
    weeklyData.reduce((sum, d) => sum + d.carbs, 0) / 7
  )
  const averageFats = Math.round(
    weeklyData.reduce((sum, d) => sum + d.fats, 0) / 7
  )

  const calorieGoalMet = weeklyData.filter(
    (d) => d.calories >= goals.calories * 0.9 && d.calories <= goals.calories * 1.1
  ).length

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActiveTab(tab)
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length

  // Mini weight chart data (last 7 entries max)
  const miniChartData = useMemo(() => {
    const sortedAsc = [...weightHistory]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7)
    return sortedAsc
  }, [weightHistory])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Progrès</Text>
      </View>

      {/* Tab Selector - 2 tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }, activeTab === 'progress' && { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary }]}
          onPress={() => handleTabChange('progress')}
        >
          <Target size={18} color={activeTab === 'progress' ? '#FFFFFF' : colors.text.secondary} />
          <Text style={[styles.tabText, { color: colors.text.secondary }, activeTab === 'progress' && styles.tabTextActive]}>
            Progrès
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }, activeTab === 'gamification' && { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary }]}
          onPress={() => handleTabChange('gamification')}
        >
          <Trophy size={18} color={activeTab === 'gamification' ? '#FFFFFF' : colors.text.secondary} />
          <Text style={[styles.tabText, { color: colors.text.secondary }, activeTab === 'gamification' && styles.tabTextActive]}>
            XP
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PROGRESS TAB - Merged Weight + Nutrition */}
        {activeTab === 'progress' && (
          <>
            {/* Weight Section - Compact */}
            <View style={[styles.compactCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <LinearGradient
                    colors={[colors.accent.primary, colors.secondary.primary]}
                    style={styles.iconGradient}
                  >
                    <Scale size={16} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Poids</Text>
                </View>
                <View style={styles.cardHeaderButtons}>
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: colors.bg.secondary }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      navigation.navigate('ScaleSettings')
                    }}
                  >
                    <Bluetooth size={14} color={colors.accent.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: colors.accent.light }]}
                    onPress={() => setShowAddWeight(!showAddWeight)}
                  >
                    <Plus size={14} color={colors.accent.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Add weight input */}
              {showAddWeight && (
                <View style={[styles.addWeightRow, { borderColor: colors.border.light }]}>
                  <TextInput
                    style={[styles.weightInput, { color: colors.text.primary, borderColor: colors.border.medium, backgroundColor: colors.bg.secondary }]}
                    placeholder="kg"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="decimal-pad"
                    value={newWeight}
                    onChangeText={setNewWeight}
                    onSubmitEditing={handleAddWeight}
                  />
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: colors.accent.primary }]}
                    onPress={handleAddWeight}
                  >
                    <Text style={styles.saveButtonText}>OK</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Weight display row */}
              <View style={styles.weightRow}>
                <View style={styles.weightMain}>
                  <Text style={[styles.weightValue, { color: colors.text.primary }]}>
                    {weightStats.current} <Text style={styles.weightUnit}>kg</Text>
                  </Text>
                  {weightStats.weeklyChange !== null && (
                    <View style={styles.weightChange}>
                      {weightStats.weeklyChange < 0 ? (
                        <TrendingDown size={12} color={colors.success} />
                      ) : weightStats.weeklyChange > 0 ? (
                        <TrendingUp size={12} color={colors.warning} />
                      ) : (
                        <Minus size={12} color={colors.text.muted} />
                      )}
                      <Text style={[styles.weightChangeText, { color: weightStats.weeklyChange < 0 ? colors.success : weightStats.weeklyChange > 0 ? colors.warning : colors.text.muted }]}>
                        {weightStats.weeklyChange > 0 ? '+' : ''}{weightStats.weeklyChange}/sem
                      </Text>
                    </View>
                  )}
                </View>

                {/* Mini chart */}
                {miniChartData.length > 1 && (
                  <View style={styles.miniChartContainer}>
                    {(() => {
                      const chartWidth = 80
                      const chartHeight = 40
                      const weights = miniChartData.map(w => w.weight)
                      const minW = Math.min(...weights) - 0.2
                      const maxW = Math.max(...weights) + 0.2
                      const range = maxW - minW || 1

                      const points = miniChartData.map((entry, idx) => ({
                        x: (idx / (miniChartData.length - 1)) * chartWidth,
                        y: chartHeight - ((entry.weight - minW) / range) * chartHeight,
                      }))

                      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

                      return (
                        <Svg width={chartWidth} height={chartHeight}>
                          <Path
                            d={pathD}
                            stroke={colors.accent.primary}
                            strokeWidth={2}
                            fill="none"
                          />
                          <Circle
                            cx={points[points.length - 1].x}
                            cy={points[points.length - 1].y}
                            r={3}
                            fill={colors.accent.primary}
                          />
                        </Svg>
                      )
                    })()}
                  </View>
                )}

                {targetWeight && (
                  <View style={styles.targetBox}>
                    <Text style={[styles.targetLabel, { color: colors.text.muted }]}>Objectif</Text>
                    <Text style={[styles.targetValue, { color: colors.accent.primary }]}>{targetWeight}kg</Text>
                  </View>
                )}
              </View>

              {/* Progress bar */}
              {targetWeight && weightStats.progress > 0 && (
                <View style={styles.progressSection}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.bg.tertiary }]}>
                    <View style={[styles.progressFill, { width: `${weightStats.progress}%`, backgroundColor: colors.accent.primary }]} />
                  </View>
                  <Text style={[styles.progressText, { color: colors.text.muted }]}>{Math.round(weightStats.progress)}%</Text>
                </View>
              )}
            </View>

            {/* Nutrition Section - Compact */}
            <View style={[styles.compactCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.iconGradient, { backgroundColor: colors.nutrients.calories }]}>
                    <Flame size={16} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text.primary }]}>Cette semaine</Text>
                </View>
                <View style={[styles.streakBadge, { backgroundColor: colors.warning + '20' }]}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <Text style={[styles.streakText, { color: colors.warning }]}>{currentStreak}j</Text>
                </View>
              </View>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text.primary }]}>{formatNumber(averageCalories)}</Text>
                  <Text style={[styles.statLabel, { color: colors.text.muted }]}>kcal/j</Text>
                  <View style={styles.statTrend}>
                    {averageCalories > goals.calories ? (
                      <TrendingUp size={12} color={colors.warning} />
                    ) : averageCalories < goals.calories * 0.8 ? (
                      <TrendingDown size={12} color={colors.error} />
                    ) : (
                      <Minus size={12} color={colors.success} />
                    )}
                  </View>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text.primary }]}>{calorieGoalMet}/7</Text>
                  <Text style={[styles.statLabel, { color: colors.text.muted }]}>objectifs</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text.primary }]}>{averageProteins}g</Text>
                  <Text style={[styles.statLabel, { color: colors.text.muted }]}>prot/j</Text>
                </View>
              </View>

              {/* Weekly mini bars */}
              <View style={styles.weekBarsContainer}>
                {weeklyData.map((data, index) => {
                  const percentage = Math.min((data.calories / goals.calories) * 100, 100)
                  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
                  const isToday = index === 6
                  const dayIndex = (new Date().getDay() - 6 + index + 7) % 7

                  return (
                    <View key={index} style={styles.weekBar}>
                      <View style={[styles.weekBarTrack, { backgroundColor: colors.bg.tertiary }]}>
                        <View
                          style={[
                            styles.weekBarFill,
                            {
                              height: `${percentage}%`,
                              backgroundColor: isToday ? colors.accent.primary : data.calories > 0 ? colors.accent.muted : colors.bg.tertiary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.weekBarLabel, { color: isToday ? colors.accent.primary : colors.text.muted }]}>
                        {dayNames[dayIndex]}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>

            {/* Macros compact */}
            <View style={[styles.compactCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
              <Text style={[styles.cardTitle, { color: colors.text.primary, marginBottom: spacing.sm }]}>Macros moyens</Text>
              <View style={styles.macrosRow}>
                <View style={styles.macroItem}>
                  <CircularProgress
                    value={averageProteins}
                    max={goals.proteins}
                    size={60}
                    strokeWidth={5}
                    color={colors.nutrients.proteins}
                    label="P"
                    unit="g"
                  />
                </View>
                <View style={styles.macroItem}>
                  <CircularProgress
                    value={averageCarbs}
                    max={goals.carbs}
                    size={60}
                    strokeWidth={5}
                    color={colors.nutrients.carbs}
                    label="G"
                    unit="g"
                  />
                </View>
                <View style={styles.macroItem}>
                  <CircularProgress
                    value={averageFats}
                    max={goals.fats}
                    size={60}
                    strokeWidth={5}
                    color={colors.nutrients.fats}
                    label="L"
                    unit="g"
                  />
                </View>
              </View>
            </View>

            {/* Coach insight - compact */}
            {(() => {
              const caloriesRatio = averageCalories / goals.calories
              const proteinsRatio = averageProteins / goals.proteins

              const getInsight = () => {
                if (proteinsRatio < 0.8) {
                  return { icon: '💪', message: 'Augmente les protéines (+œuf, amandes)' }
                }
                if (caloriesRatio < 0.9 && proteinsRatio >= 0.9) {
                  return { icon: '✨', message: 'Parfait ! Déficit maîtrisé, protéines au top' }
                }
                if (caloriesRatio > 1.15) {
                  return { icon: '⚡', message: 'Réduis les portions du soir' }
                }
                if (calorieGoalMet >= 5) {
                  return { icon: '🏆', message: 'Semaine exemplaire, continue !' }
                }
                return { icon: '🎯', message: 'Tu progresses, garde le cap' }
              }

              const insight = getInsight()

              return (
                <View style={[styles.insightBar, { backgroundColor: colors.accent.light }]}>
                  <Text style={styles.insightIcon}>{insight.icon}</Text>
                  <Text style={[styles.insightText, { color: colors.text.secondary }]}>{insight.message}</Text>
                </View>
              )
            })()}
          </>
        )}

        {/* GAMIFICATION TAB */}
        {activeTab === 'gamification' && (
          <>
            {/* Tier Card */}
            <View style={[styles.tierCard, { backgroundColor: tier.color + '15', borderColor: tier.color + '40' }]}>
              <View style={styles.tierHeader}>
                <Text style={styles.tierIconLarge}>{tier.icon}</Text>
                <View style={styles.tierInfo}>
                  <Text style={[styles.tierName, { color: tier.color }]}>{tier.nameFr}</Text>
                  <Text style={[styles.totalXP, { color: colors.text.secondary }]}>{totalXP.toLocaleString('fr-FR')} XP</Text>
                </View>
                <View style={[styles.rankBadge, { backgroundColor: getRankColor(rank.percentile, colors.text.secondary) + '20' }]}>
                  <Trophy size={14} color={getRankColor(rank.percentile, colors.text.secondary)} />
                  <Text style={[styles.rankText, { color: getRankColor(rank.percentile, colors.text.secondary) }]}>
                    Top {rank.percentile}%
                  </Text>
                </View>
              </View>

              {nextTier && (
                <View style={styles.tierProgress}>
                  <View style={styles.tierProgressHeader}>
                    <Text style={[styles.tierProgressLabel, { color: colors.text.secondary }]}>
                      → {nextTier.icon} {nextTier.nameFr}
                    </Text>
                    <Text style={[styles.tierProgressValue, { color: colors.text.primary }]}>
                      {tierProgress.current}/{tierProgress.needed}
                    </Text>
                  </View>
                  <ProgressBar value={tierProgress.current} max={tierProgress.needed} color={nextTier.color} size="sm" />
                </View>
              )}
            </View>

            {/* Stats Grid - 2x2 */}
            <View style={styles.statsGrid}>
              <View style={[styles.gridCard, { backgroundColor: colors.bg.elevated }, streakInfo.isActive && styles.gridCardHighlight]}>
                <Text style={styles.gridEmoji}>🔥</Text>
                <Text style={[styles.gridValue, { color: colors.text.primary }]}>{streakInfo.current}</Text>
                <Text style={[styles.gridLabel, { color: colors.text.muted }]}>Série</Text>
              </View>
              <View style={[styles.gridCard, { backgroundColor: colors.bg.elevated }]}>
                <Zap size={24} color={colors.accent.primary} />
                <Text style={[styles.gridValue, { color: colors.text.primary }]}>{weeklyXP}</Text>
                <Text style={[styles.gridLabel, { color: colors.text.muted }]}>XP/sem</Text>
              </View>
              <View style={[styles.gridCard, { backgroundColor: colors.bg.elevated }]}>
                <Text style={styles.gridEmoji}>🤖</Text>
                <Text style={[styles.gridValue, { color: colors.text.primary }]}>{aiCredits === 999 ? '∞' : aiCredits}</Text>
                <Text style={[styles.gridLabel, { color: colors.text.muted }]}>Crédits IA</Text>
              </View>
              <View style={[styles.gridCard, { backgroundColor: colors.bg.elevated }]}>
                <Award size={24} color={colors.warning} />
                <Text style={[styles.gridValue, { color: colors.text.primary }]}>{unlockedCount}/{achievements.length}</Text>
                <Text style={[styles.gridLabel, { color: colors.text.muted }]}>Badges</Text>
              </View>
            </View>

            {/* Features Card */}
            <Card style={styles.featuresCard}>
              <Text style={[styles.featuresSectionTitle, { color: colors.text.secondary }]}>Fonctionnalités</Text>
              {tier.features.slice(0, 3).map((feature, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <Sparkles size={14} color={tier.color} />
                  <Text style={[styles.featureText, { color: colors.text.primary }]}>{feature}</Text>
                </View>
              ))}
            </Card>

            {/* Achievements - horizontal scroll */}
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Badges</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.achievementsScroll}>
              {achievements.slice(0, 6).map(({ achievement, unlocked }) => (
                <View
                  key={achievement.id}
                  style={[styles.achievementCard, { backgroundColor: colors.bg.elevated }, !unlocked && styles.achievementLocked]}
                >
                  <Text style={[styles.achievementIcon, !unlocked && styles.achievementIconLocked]}>
                    {achievement.icon}
                  </Text>
                  <Text style={[styles.achievementName, { color: unlocked ? colors.text.primary : colors.text.tertiary }]}>
                    {achievement.name}
                  </Text>
                  {unlocked && <Badge variant="success" size="sm">✓</Badge>}
                </View>
              ))}
            </ScrollView>

            {/* Tier Roadmap - compact */}
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Parcours</Text>
            <Card style={styles.roadmapCard}>
              <View style={styles.roadmapRow}>
                {Object.values(TIERS).map((t, idx) => {
                  const isUnlocked = totalXP >= t.minXP
                  const isCurrent = t.id === tier.id
                  return (
                    <View key={t.id} style={styles.roadmapItem}>
                      <View style={[
                        styles.roadmapIcon,
                        { backgroundColor: colors.bg.tertiary },
                        isUnlocked && { backgroundColor: t.color + '30' },
                        isCurrent && { borderColor: t.color, borderWidth: 2 },
                      ]}>
                        <Text style={[styles.roadmapEmoji, !isUnlocked && { opacity: 0.3 }]}>{t.icon}</Text>
                      </View>
                      <Text style={[styles.roadmapXP, { color: isCurrent ? t.color : colors.text.muted }]}>
                        {t.minXP}
                      </Text>
                      {idx < Object.values(TIERS).length - 1 && (
                        <View style={[styles.roadmapLine, { backgroundColor: isUnlocked ? colors.accent.primary : colors.border.light }]} />
                      )}
                    </View>
                  )
                })}
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function getRankColor(percentile: number, fallback: string): string {
  if (percentile <= 1) return '#B9F2FF'
  if (percentile <= 5) return '#FFD700'
  if (percentile <= 10) return '#C0C0C0'
  if (percentile <= 25) return '#CD7F32'
  return fallback
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.default,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    ...typography.h2,
    fontFamily: fonts.serif.bold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  tabText: {
    ...typography.smallMedium,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },

  // Compact card
  compactCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardHeaderButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconGradient: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  smallButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Weight input
  addWeightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  weightInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    ...typography.body,
  },
  saveButton: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    ...typography.smallMedium,
    fontWeight: '600',
  },

  // Weight display
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  weightMain: {
    flex: 1,
  },
  weightValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  weightUnit: {
    fontSize: 16,
    fontWeight: '400',
  },
  weightChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  weightChangeText: {
    ...typography.caption,
    fontWeight: '500',
  },
  miniChartContainer: {
    width: 80,
    height: 40,
  },
  targetBox: {
    alignItems: 'flex-end',
  },
  targetLabel: {
    ...typography.caption,
    fontSize: 10,
  },
  targetValue: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    ...typography.caption,
    width: 30,
    textAlign: 'right',
  },

  // Nutrition stats
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakText: {
    ...typography.caption,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    fontSize: 10,
  },
  statTrend: {
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
  },

  // Week bars
  weekBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 50,
  },
  weekBar: {
    flex: 1,
    alignItems: 'center',
  },
  weekBarTrack: {
    flex: 1,
    width: 14,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginBottom: 4,
  },
  weekBarFill: {
    width: '100%',
    borderRadius: 7,
  },
  weekBarLabel: {
    ...typography.caption,
    fontSize: 10,
  },

  // Macros
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },

  // Insight bar
  insightBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  insightIcon: {
    fontSize: 16,
  },
  insightText: {
    ...typography.small,
    flex: 1,
  },

  // Tier card
  tierCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tierIconLarge: {
    fontSize: 36,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    ...typography.h4,
    fontWeight: '700',
  },
  totalXP: {
    ...typography.small,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  rankText: {
    ...typography.caption,
    fontWeight: '600',
  },
  tierProgress: {
    marginTop: spacing.sm,
  },
  tierProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tierProgressLabel: {
    ...typography.caption,
  },
  tierProgressValue: {
    ...typography.caption,
    fontWeight: '600',
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.default,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gridCard: {
    width: (width - spacing.default * 2 - spacing.sm) / 2 - 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  gridCardHighlight: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  gridEmoji: {
    fontSize: 24,
  },
  gridValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  gridLabel: {
    ...typography.caption,
  },

  // Features
  featuresCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  featuresSectionTitle: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 3,
  },
  featureText: {
    ...typography.small,
  },

  // Section title
  sectionTitle: {
    ...typography.caption,
    paddingHorizontal: spacing.default,
    marginBottom: spacing.sm,
  },

  // Achievements
  achievementsScroll: {
    paddingLeft: spacing.default,
    marginBottom: spacing.md,
  },
  achievementCard: {
    width: 80,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    marginRight: spacing.sm,
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
    fontSize: 10,
    textAlign: 'center',
  },

  // Roadmap
  roadmapCard: {
    marginHorizontal: spacing.default,
    padding: spacing.md,
  },
  roadmapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roadmapItem: {
    alignItems: 'center',
    position: 'relative',
  },
  roadmapIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapEmoji: {
    fontSize: 18,
  },
  roadmapXP: {
    ...typography.caption,
    fontSize: 9,
    marginTop: 2,
  },
  roadmapLine: {
    position: 'absolute',
    top: 16,
    left: 36,
    width: (width - spacing.default * 2 - 40 - 36 * 6) / 5,
    height: 2,
  },
})
