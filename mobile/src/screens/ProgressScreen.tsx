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
  Alert,
} from 'react-native'
import { TrendingUp, TrendingDown, Minus, Award, Flame, Target, Trophy, Zap, Sparkles, Scale, Plus, ChevronLeft, Settings, Bluetooth } from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop, Line, Text as SvgText } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Card, Badge, ProgressBar, CircularProgress } from '../components/ui'
import { GamificationPanel } from '../components/dashboard'
import { useTheme } from '../contexts/ThemeContext'
import { colors as staticColors, spacing, typography, radius, shadows } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore, TIERS, ACHIEVEMENTS } from '../stores/gamification-store'
import { formatNumber, getDateKey, generateId } from '../lib/utils'
import type { WeightEntry } from '../types'

const { width } = Dimensions.get('window')

type TimeRange = '7d' | '30d' | '90d'
type WeightRange = '1W' | '1M' | '3M' | 'ALL'
type TabType = 'weight' | 'nutrition' | 'gamification'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function ProgressScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [weightRange, setWeightRange] = useState<WeightRange>('1M')
  const [activeTab, setActiveTab] = useState<TabType>('weight')
  const [showAddWeight, setShowAddWeight] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const { profile, nutritionGoals, weightHistory, addWeightEntry } = useUserStore()
  const { dailyData } = useMealsStore()
  const {
    totalXP,
    currentStreak,
    longestStreak,
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

  // Weight chart data
  const weightChartData = useMemo(() => {
    const sortedAsc = [...weightHistory].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    if (sortedAsc.length === 0) return null

    const now = new Date()
    let filteredWeights = sortedAsc

    switch (weightRange) {
      case '1W':
        filteredWeights = sortedAsc.filter(w =>
          new Date(w.date) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        )
        break
      case '1M':
        filteredWeights = sortedAsc.filter(w =>
          new Date(w.date) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        )
        break
      case '3M':
        filteredWeights = sortedAsc.filter(w =>
          new Date(w.date) >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        )
        break
    }

    return filteredWeights
  }, [weightHistory, weightRange])

  // Weight stats
  const weightStats = useMemo(() => {
    const current = sortedWeights[0]?.weight || profile?.weight || 0
    const target = profile?.targetWeight
    const start = profile?.weight || current

    // Weekly change
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const weekAgoEntry = sortedWeights.find(w => new Date(w.date) <= weekAgo)
    const weeklyChange = weekAgoEntry ? +(current - weekAgoEntry.weight).toFixed(1) : null

    // Monthly change
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const monthAgoEntry = sortedWeights.find(w => new Date(w.date) <= monthAgo)
    const monthlyChange = monthAgoEntry ? +(current - monthAgoEntry.weight).toFixed(1) : null

    // Progress towards goal
    const totalToLose = start - (target || start)
    const lost = start - current
    const progress = totalToLose !== 0 ? Math.min(100, Math.max(0, (lost / totalToLose) * 100)) : 0

    // ETA calculation (weeks to goal)
    let etaWeeks: number | null = null
    let etaDate: Date | null = null
    const remainingToGoal = target ? current - target : null

    if (remainingToGoal !== null && weeklyChange !== null && weeklyChange !== 0) {
      // Check if we're moving in the right direction
      const needsLoss = remainingToGoal > 0
      const isLosing = weeklyChange < 0

      if ((needsLoss && isLosing) || (!needsLoss && !isLosing)) {
        // Calculate weeks based on weekly rate
        const absWeeklyRate = Math.abs(weeklyChange)
        const absRemaining = Math.abs(remainingToGoal)
        etaWeeks = Math.ceil(absRemaining / absWeeklyRate)

        // Calculate estimated date
        if (etaWeeks > 0 && etaWeeks < 200) { // Cap at ~4 years
          etaDate = new Date()
          etaDate.setDate(etaDate.getDate() + etaWeeks * 7)
        }
      }
    }

    return { current, target, start, weeklyChange, monthlyChange, progress, etaWeeks, etaDate }
  }, [sortedWeights, profile])

  // Add weight handler
  const handleAddWeight = useCallback(() => {
    const weight = parseFloat(newWeight)
    if (isNaN(weight) || weight < 30 || weight > 300) {
      Alert.alert('Erreur', 'Veuillez entrer un poids valide (30-300 kg)')
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
  }, [newWeight, addWeightEntry])

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Progres</Text>
        </View>

        {/* Tab Selector - 3 tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }, activeTab === 'weight' && { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary }]}
            onPress={() => handleTabChange('weight')}
          >
            <Scale size={18} color={activeTab === 'weight' ? '#FFFFFF' : colors.text.secondary} />
            <Text style={[styles.tabText, { color: colors.text.secondary }, activeTab === 'weight' && styles.tabTextActive]}>
              Poids
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }, activeTab === 'nutrition' && { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary }]}
            onPress={() => handleTabChange('nutrition')}
          >
            <Target size={18} color={activeTab === 'nutrition' ? '#FFFFFF' : colors.text.secondary} />
            <Text style={[styles.tabText, { color: colors.text.secondary }, activeTab === 'nutrition' && styles.tabTextActive]}>
              Nutrition
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

        {/* WEIGHT TAB */}
        {activeTab === 'weight' && (
          <>
            {/* Weight Stats Card */}
            <View style={[styles.weightCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
              <View style={styles.weightHeader}>
                <View style={styles.weightTitleRow}>
                  <LinearGradient
                    colors={[colors.accent.primary, colors.secondary.primary]}
                    style={styles.weightIconGradient}
                  >
                    <Scale size={20} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={[styles.weightTitle, { color: colors.text.primary }]}>
                    Évolution du poids
                  </Text>
                </View>
                <View style={styles.weightHeaderButtons}>
                  <TouchableOpacity
                    style={[styles.scaleSettingsButton, { backgroundColor: colors.bg.secondary }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                      navigation.navigate('ScaleSettings')
                    }}
                  >
                    <Bluetooth size={16} color={colors.accent.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addWeightButton, { backgroundColor: colors.accent.light }]}
                    onPress={() => setShowAddWeight(!showAddWeight)}
                  >
                    <Plus size={18} color={colors.accent.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Add weight input */}
              {showAddWeight && (
                <View style={[styles.addWeightRow, { borderColor: colors.border.light }]}>
                  <TextInput
                    style={[styles.weightInput, { color: colors.text.primary, borderColor: colors.border.medium, backgroundColor: colors.bg.secondary }]}
                    placeholder="Poids (kg)"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="decimal-pad"
                    value={newWeight}
                    onChangeText={setNewWeight}
                    onSubmitEditing={handleAddWeight}
                  />
                  <TouchableOpacity
                    style={[styles.saveWeightButton, { backgroundColor: colors.accent.primary }]}
                    onPress={handleAddWeight}
                  >
                    <Text style={styles.saveWeightButtonText}>Enregistrer</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Current weight display */}
              <View style={styles.currentWeightRow}>
                <View style={styles.currentWeightMain}>
                  <Text style={[styles.currentWeightValue, { color: colors.text.primary }]}>
                    {weightStats.current} kg
                  </Text>
                  {weightStats.weeklyChange !== null && (
                    <View style={styles.weightTrendBadge}>
                      {weightStats.weeklyChange < 0 ? (
                        <TrendingDown size={14} color={colors.success} />
                      ) : weightStats.weeklyChange > 0 ? (
                        <TrendingUp size={14} color={colors.warning} />
                      ) : (
                        <Minus size={14} color={colors.text.muted} />
                      )}
                      <Text style={[
                        styles.weightTrendText,
                        { color: weightStats.weeklyChange < 0 ? colors.success : weightStats.weeklyChange > 0 ? colors.warning : colors.text.muted }
                      ]}>
                        {weightStats.weeklyChange > 0 ? '+' : ''}{weightStats.weeklyChange} kg
                      </Text>
                      <Text style={[styles.weightTrendPeriod, { color: colors.text.muted }]}>
                        cette semaine
                      </Text>
                    </View>
                  )}
                </View>
                {targetWeight && (
                  <View style={styles.targetWeightBox}>
                    <Text style={[styles.targetWeightLabel, { color: colors.text.muted }]}>Objectif</Text>
                    <Text style={[styles.targetWeightValue, { color: colors.accent.primary }]}>{targetWeight} kg</Text>
                  </View>
                )}
              </View>

              {/* Progress bar towards goal */}
              {targetWeight && (
                <View style={styles.weightProgressSection}>
                  <View style={styles.weightProgressHeader}>
                    <Text style={[styles.weightProgressLabel, { color: colors.text.muted }]}>
                      Progression vers l'objectif
                    </Text>
                    <Text style={[styles.weightProgressPercent, { color: colors.accent.primary }]}>
                      {Math.round(weightStats.progress)}%
                    </Text>
                  </View>
                  <View style={[styles.weightProgressTrack, { backgroundColor: colors.bg.tertiary }]}>
                    <LinearGradient
                      colors={[colors.accent.primary, colors.secondary.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.weightProgressFill, { width: `${weightStats.progress}%` }]}
                    />
                  </View>

                  {/* ETA to goal */}
                  {weightStats.etaWeeks !== null && weightStats.etaDate && (
                    <View style={[styles.etaContainer, { backgroundColor: `${staticColors.success}10` }]}>
                      <Target size={16} color={staticColors.success} />
                      <Text style={[styles.etaText, { color: colors.text.secondary }]}>
                        <Text style={{ color: staticColors.success, fontWeight: '600' }}>
                          ~{weightStats.etaWeeks} semaine{weightStats.etaWeeks > 1 ? 's' : ''}
                        </Text>
                        {' '}pour atteindre ton objectif
                      </Text>
                      <Text style={[styles.etaDate, { color: colors.text.muted }]}>
                        ({weightStats.etaDate.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })})
                      </Text>
                    </View>
                  )}

                  {/* Show message if moving wrong direction */}
                  {weightStats.weeklyChange !== null && weightStats.etaWeeks === null && currentWeight && targetWeight && currentWeight !== targetWeight && (
                    <View style={[styles.etaContainer, { backgroundColor: `${staticColors.warning}10` }]}>
                      <TrendingUp size={16} color={staticColors.warning} />
                      <Text style={[styles.etaText, { color: colors.text.secondary }]}>
                        {currentWeight > targetWeight
                          ? 'Continue tes efforts pour voir l\'ETA'
                          : 'Tu es sur la bonne voie, continue !'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Weight Range Selector */}
            <View style={styles.weightRangeSelector}>
              {(['1W', '1M', '3M', 'ALL'] as WeightRange[]).map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.weightRangeButton,
                    { backgroundColor: colors.bg.elevated },
                    weightRange === range && { backgroundColor: colors.accent.primary }
                  ]}
                  onPress={() => setWeightRange(range)}
                >
                  <Text style={[
                    styles.weightRangeButtonText,
                    { color: weightRange === range ? '#FFFFFF' : colors.text.muted }
                  ]}>
                    {range === 'ALL' ? 'Tout' : range === '1W' ? '7j' : range === '1M' ? '30j' : '90j'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Weight Chart - SVG Line Chart */}
            <Card style={[styles.weightChartCard, { marginHorizontal: spacing.default }]}>
              {weightChartData && weightChartData.length > 0 ? (
                <View style={styles.lineChartContainer}>
                  {(() => {
                    const chartWidth = width - spacing.default * 2 - 32 // Card padding
                    const chartHeight = 160
                    const paddingTop = 20
                    const paddingBottom = 30
                    const paddingLeft = 35
                    const paddingRight = 15
                    const graphWidth = chartWidth - paddingLeft - paddingRight
                    const graphHeight = chartHeight - paddingTop - paddingBottom

                    const weights = weightChartData.map(w => w.weight)
                    const minW = Math.min(...weights) - 0.5
                    const maxW = Math.max(...weights) + 0.5
                    const range = maxW - minW || 1

                    // Limit to max 12 points for readability
                    const step = Math.max(1, Math.floor(weightChartData.length / 12))
                    const displayData = weightChartData.filter((_, i) =>
                      i % step === 0 || i === weightChartData.length - 1
                    )

                    // Calculate points
                    const points = displayData.map((entry, idx) => ({
                      x: paddingLeft + (idx / (displayData.length - 1 || 1)) * graphWidth,
                      y: paddingTop + graphHeight - ((entry.weight - minW) / range) * graphHeight,
                      weight: entry.weight,
                      date: entry.date,
                    }))

                    // Create smooth curve path
                    const createSmoothPath = () => {
                      if (points.length < 2) return ''

                      let path = `M ${points[0].x} ${points[0].y}`

                      for (let i = 0; i < points.length - 1; i++) {
                        const p0 = points[Math.max(0, i - 1)]
                        const p1 = points[i]
                        const p2 = points[i + 1]
                        const p3 = points[Math.min(points.length - 1, i + 2)]

                        const cp1x = p1.x + (p2.x - p0.x) / 6
                        const cp1y = p1.y + (p2.y - p0.y) / 6
                        const cp2x = p2.x - (p3.x - p1.x) / 6
                        const cp2y = p2.y - (p3.y - p1.y) / 6

                        path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
                      }

                      return path
                    }

                    // Create area path (for gradient fill)
                    const createAreaPath = () => {
                      if (points.length < 2) return ''
                      const linePath = createSmoothPath()
                      const lastPoint = points[points.length - 1]
                      const firstPoint = points[0]
                      const bottomY = paddingTop + graphHeight
                      return `${linePath} L ${lastPoint.x} ${bottomY} L ${firstPoint.x} ${bottomY} Z`
                    }

                    // Target weight line
                    const targetY = targetWeight
                      ? paddingTop + graphHeight - ((targetWeight - minW) / range) * graphHeight
                      : null

                    return (
                      <Svg width={chartWidth} height={chartHeight}>
                        <Defs>
                          <SvgGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                            <Stop offset="0" stopColor={colors.accent.primary} />
                            <Stop offset="1" stopColor={colors.secondary.primary} />
                          </SvgGradient>
                          <SvgGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={colors.accent.primary} stopOpacity="0.3" />
                            <Stop offset="1" stopColor={colors.accent.primary} stopOpacity="0" />
                          </SvgGradient>
                        </Defs>

                        {/* Y-axis labels */}
                        <SvgText
                          x={paddingLeft - 8}
                          y={paddingTop + 4}
                          fontSize={10}
                          fill={colors.text.muted}
                          textAnchor="end"
                        >
                          {maxW.toFixed(1)}
                        </SvgText>
                        <SvgText
                          x={paddingLeft - 8}
                          y={paddingTop + graphHeight / 2 + 4}
                          fontSize={10}
                          fill={colors.text.muted}
                          textAnchor="end"
                        >
                          {((maxW + minW) / 2).toFixed(1)}
                        </SvgText>
                        <SvgText
                          x={paddingLeft - 8}
                          y={paddingTop + graphHeight + 4}
                          fontSize={10}
                          fill={colors.text.muted}
                          textAnchor="end"
                        >
                          {minW.toFixed(1)}
                        </SvgText>

                        {/* Horizontal grid lines */}
                        <Line
                          x1={paddingLeft}
                          y1={paddingTop}
                          x2={paddingLeft + graphWidth}
                          y2={paddingTop}
                          stroke={colors.border.light}
                          strokeWidth={1}
                          strokeDasharray="4,4"
                        />
                        <Line
                          x1={paddingLeft}
                          y1={paddingTop + graphHeight / 2}
                          x2={paddingLeft + graphWidth}
                          y2={paddingTop + graphHeight / 2}
                          stroke={colors.border.light}
                          strokeWidth={1}
                          strokeDasharray="4,4"
                        />
                        <Line
                          x1={paddingLeft}
                          y1={paddingTop + graphHeight}
                          x2={paddingLeft + graphWidth}
                          y2={paddingTop + graphHeight}
                          stroke={colors.border.light}
                          strokeWidth={1}
                        />

                        {/* Target weight line */}
                        {targetY && targetY >= paddingTop && targetY <= paddingTop + graphHeight && (
                          <>
                            <Line
                              x1={paddingLeft}
                              y1={targetY}
                              x2={paddingLeft + graphWidth}
                              y2={targetY}
                              stroke={colors.success}
                              strokeWidth={1.5}
                              strokeDasharray="6,4"
                            />
                            <SvgText
                              x={paddingLeft + graphWidth + 2}
                              y={targetY + 3}
                              fontSize={9}
                              fill={colors.success}
                            >
                              🎯
                            </SvgText>
                          </>
                        )}

                        {/* Area fill */}
                        <Path
                          d={createAreaPath()}
                          fill="url(#areaGradient)"
                        />

                        {/* Line */}
                        <Path
                          d={createSmoothPath()}
                          stroke="url(#lineGradient)"
                          strokeWidth={2.5}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Data points */}
                        {points.map((point, idx) => (
                          <Circle
                            key={idx}
                            cx={point.x}
                            cy={point.y}
                            r={idx === points.length - 1 ? 6 : 4}
                            fill={idx === points.length - 1 ? colors.accent.primary : colors.bg.elevated}
                            stroke={idx === points.length - 1 ? colors.secondary.primary : colors.accent.primary}
                            strokeWidth={2}
                          />
                        ))}

                        {/* X-axis labels (first, middle, last) */}
                        {points.length > 0 && (
                          <>
                            <SvgText
                              x={points[0].x}
                              y={chartHeight - 8}
                              fontSize={9}
                              fill={colors.text.tertiary}
                              textAnchor="start"
                            >
                              {new Date(points[0].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </SvgText>
                            {points.length > 2 && (
                              <SvgText
                                x={points[Math.floor(points.length / 2)].x}
                                y={chartHeight - 8}
                                fontSize={9}
                                fill={colors.text.tertiary}
                                textAnchor="middle"
                              >
                                {new Date(points[Math.floor(points.length / 2)].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </SvgText>
                            )}
                            <SvgText
                              x={points[points.length - 1].x}
                              y={chartHeight - 8}
                              fontSize={9}
                              fill={colors.text.primary}
                              textAnchor="end"
                              fontWeight="600"
                            >
                              {new Date(points[points.length - 1].date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </SvgText>
                          </>
                        )}
                      </Svg>
                    )
                  })()}
                </View>
              ) : (
                <View style={styles.emptyWeightChart}>
                  <Scale size={40} color={colors.text.muted} />
                  <Text style={[styles.emptyChartTitle, { color: colors.text.muted }]}>
                    Pas encore de données
                  </Text>
                  <Text style={[styles.emptyChartSubtitle, { color: colors.text.tertiary }]}>
                    Ajoute ta première pesée pour voir ton évolution
                  </Text>
                </View>
              )}
            </Card>

            {/* Weight History */}
            {sortedWeights.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text.secondary, marginTop: spacing.lg }]}>
                  Historique récent
                </Text>
                <Card style={[styles.historyCard, { marginHorizontal: spacing.default }]}>
                  {sortedWeights.slice(0, 5).map((entry, idx) => (
                    <View
                      key={entry.id}
                      style={[
                        styles.historyItem,
                        idx < Math.min(4, sortedWeights.length - 1) && { borderBottomColor: colors.border.light, borderBottomWidth: 1 }
                      ]}
                    >
                      <View style={styles.historyLeft}>
                        <Text style={[styles.historyDate, { color: colors.text.secondary }]}>
                          {new Date(entry.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </Text>
                        {entry.source === 'scale' && (
                          <View style={[styles.historySourceBadge, { backgroundColor: colors.accent.light }]}>
                            <Bluetooth size={10} color={colors.accent.primary} />
                          </View>
                        )}
                      </View>
                      <View style={styles.historyMetrics}>
                        <Text style={[styles.historyWeight, { color: colors.text.primary }]}>
                          {entry.weight} kg
                        </Text>
                        {(entry.bodyFatPercent || entry.bmi) && (
                          <View style={styles.historyExtraMetrics}>
                            {entry.bodyFatPercent && (
                              <Text style={[styles.historyExtraMetric, { color: colors.text.tertiary }]}>
                                {entry.bodyFatPercent.toFixed(1)}% MG
                              </Text>
                            )}
                            {entry.bmi && (
                              <Text style={[styles.historyExtraMetric, { color: colors.text.tertiary }]}>
                                IMC {entry.bmi.toFixed(1)}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                      {idx > 0 && sortedWeights[idx - 1] && (
                        <View style={styles.historyChange}>
                          {entry.weight < sortedWeights[idx - 1].weight ? (
                            <TrendingDown size={12} color={colors.success} />
                          ) : entry.weight > sortedWeights[idx - 1].weight ? (
                            <TrendingUp size={12} color={colors.warning} />
                          ) : (
                            <Minus size={12} color={colors.text.muted} />
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}

        {activeTab === 'gamification' ? (
          <>
            {/* Tier Card */}
            <View style={[styles.tierCard, { backgroundColor: tier.color + '15', borderColor: tier.color + '40' }]}>
              <View style={styles.tierHeader}>
                <Text style={styles.tierIconLarge}>{tier.icon}</Text>
                <View style={styles.tierInfo}>
                  <Text style={[styles.tierName, { color: tier.color }]}>{tier.nameFr}</Text>
                  <Text style={[styles.totalXP, { color: colors.text.secondary }]}>{totalXP.toLocaleString('fr-FR')} XP total</Text>
                </View>
                <View style={[styles.rankBadge, { backgroundColor: getRankColor(rank.percentile, colors.text.secondary) + '20' }]}>
                  <Trophy size={16} color={getRankColor(rank.percentile, colors.text.secondary)} />
                  <Text style={[styles.rankText, { color: getRankColor(rank.percentile, colors.text.secondary) }]}>
                    Top {rank.percentile}%
                  </Text>
                </View>
              </View>

              {/* Progress to next tier */}
              {nextTier && (
                <View style={styles.tierProgress}>
                  <View style={styles.tierProgressHeader}>
                    <Text style={[styles.tierProgressLabel, { color: colors.text.secondary }]}>
                      Vers {nextTier.icon} {nextTier.nameFr}
                    </Text>
                    <Text style={[styles.tierProgressValue, { color: colors.text.primary }]}>
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
              <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }, streakInfo.isActive && styles.statCardHighlight]}>
                <Text style={styles.statEmoji}>🔥</Text>
                <Text style={[styles.statValue, { color: colors.text.primary }]}>{streakInfo.current}</Text>
                <Text style={[styles.statLabel, { color: colors.text.muted }]}>Serie</Text>
                {streakInfo.bonus > 0 && (
                  <Text style={[styles.statBonus, { color: colors.success }]}>+{streakInfo.bonus}% XP</Text>
                )}
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}>
                <Zap size={28} color={colors.accent.primary} />
                <Text style={[styles.statValue, { color: colors.text.primary }]}>{weeklyXP}</Text>
                <Text style={[styles.statLabel, { color: colors.text.muted }]}>XP cette semaine</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}>
                <Text style={styles.statEmoji}>🤖</Text>
                <Text style={[styles.statValue, { color: colors.text.primary }]}>{aiCredits === 999 ? '∞' : aiCredits}</Text>
                <Text style={[styles.statLabel, { color: colors.text.muted }]}>Credits IA/mois</Text>
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}>
                <Award size={28} color={colors.warning} />
                <Text style={[styles.statValue, { color: colors.text.primary }]}>{unlockedCount}/{achievements.length}</Text>
                <Text style={[styles.statLabel, { color: colors.text.muted }]}>Achievements</Text>
              </View>
            </View>

            {/* AI Features Unlocked */}
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Fonctionnalites debloquees</Text>
            <Card style={styles.featuresCard}>
              {tier.features.map((feature, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <Sparkles size={16} color={tier.color} />
                  <Text style={[styles.featureText, { color: colors.text.primary }]}>{feature}</Text>
                </View>
              ))}
              {nextTier && (
                <View style={[styles.nextFeatures, { borderTopColor: colors.border.light }]}>
                  <Text style={[styles.nextFeaturesTitle, { color: colors.text.muted }]}>
                    A {nextTier.minXP - totalXP} XP pour debloquer:
                  </Text>
                  {nextTier.features.slice(0, 2).map((feature, idx) => (
                    <View key={idx} style={styles.featureItemLocked}>
                      <Text style={styles.lockIcon}>🔒</Text>
                      <Text style={[styles.featureTextLocked, { color: colors.text.tertiary }]}>{feature}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Achievements */}
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Achievements</Text>
            <View style={styles.achievementsGrid}>
              {achievements.map(({ achievement, unlocked }) => (
                <View
                  key={achievement.id}
                  style={[styles.achievementCard, { backgroundColor: colors.bg.elevated }, !unlocked && styles.achievementLocked]}
                >
                  <Text style={[styles.achievementIcon, !unlocked && styles.achievementIconLocked]}>
                    {achievement.icon}
                  </Text>
                  <Text style={[styles.achievementName, { color: colors.text.primary }, !unlocked && { color: colors.text.tertiary }]}>
                    {achievement.name}
                  </Text>
                  <Text style={[styles.achievementDesc, { color: colors.text.muted }]}>{achievement.description}</Text>
                  {!unlocked && achievement.xpReward > 0 && (
                    <Text style={[styles.achievementXP, { color: colors.accent.primary }]}>+{achievement.xpReward} XP</Text>
                  )}
                  {unlocked && (
                    <Badge variant="success" size="sm">Obtenu</Badge>
                  )}
                </View>
              ))}
            </View>

            {/* Tier Roadmap */}
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Parcours des tiers</Text>
            <Card style={styles.roadmapCard}>
              {Object.values(TIERS).map((t, idx) => {
                const isUnlocked = totalXP >= t.minXP
                const isCurrent = t.id === tier.id
                return (
                  <View key={t.id} style={styles.roadmapItem}>
                    <View style={[
                      styles.roadmapIcon,
                      { backgroundColor: colors.bg.tertiary },
                      isUnlocked && { backgroundColor: t.color + '20' },
                      isCurrent && { borderColor: colors.accent.primary, borderWidth: 2 },
                    ]}>
                      <Text style={[styles.roadmapEmoji, !isUnlocked && styles.roadmapEmojiLocked]}>
                        {t.icon}
                      </Text>
                    </View>
                    <View style={styles.roadmapInfo}>
                      <Text style={[styles.roadmapName, { color: colors.text.primary }, isCurrent && { color: t.color }]}>
                        {t.nameFr}
                      </Text>
                      <Text style={[styles.roadmapXP, { color: colors.text.muted }]}>{t.minXP} XP</Text>
                    </View>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: t.color }]}>
                        <Text style={styles.currentBadgeText}>Actuel</Text>
                      </View>
                    )}
                    {idx < Object.values(TIERS).length - 1 && (
                      <View style={[styles.roadmapLine, { backgroundColor: colors.border.light }, isUnlocked && { backgroundColor: colors.accent.primary }]} />
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
                    { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
                    timeRange === range && { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
                  ]}
                  onPress={() => handleTimeRangeChange(range)}
                >
                  <Text
                    style={[
                      styles.timeRangeText,
                      { color: colors.text.secondary },
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
                <View style={[styles.nutritionStatIcon, { backgroundColor: `${colors.nutrients.calories}15` }]}>
                  <Flame size={20} color={colors.nutrients.calories} />
                </View>
                <Text style={[styles.nutritionStatValue, { color: colors.text.primary }]}>{formatNumber(averageCalories)}</Text>
                <Text style={[styles.nutritionStatLabel, { color: colors.text.tertiary }]}>Moy. kcal/jour</Text>
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
                <Text style={[styles.nutritionStatValue, { color: colors.text.primary }]}>{calorieGoalMet}/7</Text>
                <Text style={[styles.nutritionStatLabel, { color: colors.text.tertiary }]}>Objectifs atteints</Text>
              </Card>

              <Card style={styles.nutritionStatCard}>
                <View style={[styles.nutritionStatIcon, { backgroundColor: `${colors.warning}15` }]}>
                  <Award size={20} color={colors.warning} />
                </View>
                <Text style={[styles.nutritionStatValue, { color: colors.text.primary }]}>{currentStreak}</Text>
                <Text style={[styles.nutritionStatLabel, { color: colors.text.tertiary }]}>Jours serie</Text>
              </Card>
            </View>

            {/* Weekly Chart */}
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Calories cette semaine</Text>
            <Card style={styles.chartCard}>
              <View style={styles.chartContainer}>
                {weeklyData.map((data, index) => {
                  const percentage = Math.min((data.calories / goals.calories) * 100, 120)
                  const dayNames = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
                  const isToday = index === 6

                  return (
                    <View key={index} style={styles.chartBar}>
                      <View style={[styles.barContainer, { backgroundColor: colors.bg.secondary }]}>
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
                        <View style={[styles.goalLine, { backgroundColor: colors.border.default }]} />
                      </View>
                      <Text
                        style={[
                          styles.barLabel,
                          { color: colors.text.tertiary },
                          isToday && { color: colors.accent.primary, fontWeight: '600' },
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
                  <Text style={[styles.legendText, { color: colors.text.tertiary }]}>Aujourd'hui</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.border.default }]} />
                  <Text style={[styles.legendText, { color: colors.text.tertiary }]}>Objectif</Text>
                </View>
              </View>
            </Card>

            {/* Macros Average */}
            <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Repartition moyenne</Text>
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

            {/* Coach Insight - LYM Style */}
            {(() => {
              const caloriesRatio = averageCalories / goals.calories
              const proteinsRatio = averageProteins / goals.proteins

              // Generate personalized coach insight based on data
              const getCoachInsight = () => {
                // Priority: proteins deficit is most important for health
                if (proteinsRatio < 0.8) {
                  const deficit = Math.round(goals.proteins - averageProteins)
                  return {
                    icon: Target,
                    color: staticColors.accent.primary,
                    bgColor: `${staticColors.accent.primary}15`,
                    title: 'Mon conseil de la semaine',
                    message: `Tes proteines sont un peu basses cette semaine. Ajoute un oeuf au petit-dej ou une poignee d'amandes en collation pour gagner ${deficit}g facilement.`,
                  }
                }

                // Calorie deficit with good proteins = good for weight loss
                if (caloriesRatio < 0.9 && proteinsRatio >= 0.9) {
                  return {
                    icon: Sparkles,
                    color: staticColors.success,
                    bgColor: `${staticColors.success}15`,
                    title: 'Tu es sur la bonne voie',
                    message: 'Deficit calorique maitrise et proteines au top ! Continue comme ca, les resultats vont suivre.',
                  }
                }

                // Excess calories
                if (caloriesRatio > 1.15) {
                  const excess = Math.round(averageCalories - goals.calories)
                  return {
                    icon: Flame,
                    color: staticColors.warning,
                    bgColor: `${staticColors.warning}15`,
                    title: 'Petit ajustement suggere',
                    message: `Tu depasses de ${excess} kcal en moyenne. Essaie de reduire les portions du soir ou de troquer le dessert contre un fruit.`,
                  }
                }

                // Perfect week
                if (calorieGoalMet >= 5 && proteinsRatio >= 0.9) {
                  return {
                    icon: Trophy,
                    color: staticColors.warning,
                    bgColor: `${staticColors.warning}15`,
                    title: 'Semaine exemplaire !',
                    message: 'Tu geres parfaitement ton alimentation. Garde ce rythme, tu es en train de construire de bonnes habitudes durables.',
                  }
                }

                // Good week
                if (calorieGoalMet >= 3) {
                  return {
                    icon: TrendingUp,
                    color: staticColors.info,
                    bgColor: `${staticColors.info}15`,
                    title: 'Belle progression',
                    message: 'Tu progresses bien ! Pour passer au niveau superieur, essaie de maintenir tes objectifs aussi le week-end.',
                  }
                }

                // Default: needs improvement
                return {
                  icon: Zap,
                  color: staticColors.accent.primary,
                  bgColor: `${staticColors.accent.primary}15`,
                  title: 'On reprend ensemble',
                  message: 'Cette semaine etait difficile, mais chaque jour est une nouvelle opportunite. Commence par un petit-dejeuner equilibre demain.',
                }
              }

              const insight = getCoachInsight()
              const InsightIcon = insight.icon

              return (
                <Card style={[styles.coachInsightCard, { borderLeftColor: insight.color }]}>
                  <View style={styles.coachInsightHeader}>
                    <View style={[styles.coachInsightIcon, { backgroundColor: insight.bgColor }]}>
                      <InsightIcon size={18} color={insight.color} />
                    </View>
                    <Text style={[styles.coachInsightTitle, { color: colors.text.primary }]}>
                      {insight.title}
                    </Text>
                  </View>
                  <Text style={[styles.coachInsightMessage, { color: colors.text.secondary }]}>
                    {insight.message}
                  </Text>
                </Card>
              )
            })()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// Helper function to get rank color
function getRankColor(percentile: number, textSecondary: string): string {
  if (percentile <= 1) return '#B9F2FF'
  if (percentile <= 5) return '#FFD700'
  if (percentile <= 10) return '#C0C0C0'
  if (percentile <= 25) return '#CD7F32'
  return textSecondary
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: radius.md,
    borderWidth: 1,
  },
  tabActive: {
    // Dynamic via inline style
  },
  tabText: {
    ...typography.smallMedium,
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
  },
  tierProgressValue: {
    ...typography.smallMedium,
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
  },
  statLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
  statBonus: {
    ...typography.caption,
    fontWeight: '600',
  },

  // Section Title
  sectionTitle: {
    ...typography.bodyMedium,
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
  },
  nextFeatures: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  nextFeaturesTitle: {
    ...typography.caption,
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
    fontWeight: '600',
    textAlign: 'center',
  },
  achievementNameLocked: {
    // Dynamic via inline style
  },
  achievementDesc: {
    ...typography.caption,
    textAlign: 'center',
    fontSize: 9,
  },
  achievementXP: {
    ...typography.caption,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapIconCurrent: {
    // Dynamic via inline style
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
  },
  roadmapXP: {
    ...typography.caption,
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
  },
  roadmapLineActive: {
    // Dynamic via inline style
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
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  timeRangeButtonActive: {
    // Dynamic via inline style
  },
  timeRangeText: {
    ...typography.smallMedium,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nutritionStatValue: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  nutritionStatLabel: {
    ...typography.caption,
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
  },
  barLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  barLabelActive: {
    // Dynamic via inline style
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
  // Coach Insight styles (LYM-style)
  coachInsightCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.lg,
    borderLeftWidth: 3,
    padding: spacing.md,
  },
  coachInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  coachInsightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachInsightTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  coachInsightMessage: {
    ...typography.body,
    lineHeight: 22,
  },

  // Weight Tab Styles
  weightCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weightTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weightIconGradient: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightTitle: {
    ...typography.h4,
    fontWeight: '600',
  },
  weightHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scaleSettingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addWeightButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addWeightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  weightInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  saveWeightButton: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveWeightButtonText: {
    color: '#FFFFFF',
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  currentWeightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  currentWeightMain: {
    flex: 1,
  },
  currentWeightValue: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1,
  },
  weightTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  weightTrendText: {
    ...typography.smallMedium,
    fontWeight: '600',
  },
  weightTrendPeriod: {
    ...typography.caption,
  },
  targetWeightBox: {
    alignItems: 'flex-end',
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  targetWeightLabel: {
    ...typography.caption,
  },
  targetWeightValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  weightProgressSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  weightProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  weightProgressLabel: {
    ...typography.small,
  },
  weightProgressPercent: {
    ...typography.smallMedium,
    fontWeight: '600',
  },
  weightProgressTrack: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  weightProgressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  etaText: {
    ...typography.small,
    flex: 1,
  },
  etaDate: {
    ...typography.caption,
  },
  weightRangeSelector: {
    flexDirection: 'row',
    paddingHorizontal: spacing.default,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  weightRangeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  weightRangeButtonText: {
    ...typography.smallMedium,
  },
  weightChartCard: {
    marginBottom: spacing.lg,
  },
  lineChartContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simpleChart: {
    flexDirection: 'row',
    height: 160,
  },
  chartYAxis: {
    width: 30,
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  chartYLabel: {
    ...typography.caption,
    fontSize: 10,
  },
  chartBars: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingBottom: 20,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarContainer: {
    width: 16,
    height: 120,
    borderRadius: radius.sm,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: radius.sm,
  },
  chartBarLabel: {
    ...typography.caption,
    fontSize: 9,
    marginTop: 4,
  },
  emptyWeightChart: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyChartTitle: {
    ...typography.bodyMedium,
  },
  emptyChartSubtitle: {
    ...typography.small,
    textAlign: 'center',
  },
  historyCard: {
    marginBottom: spacing.lg,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  historyDate: {
    ...typography.body,
  },
  historySourceBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyMetrics: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  historyWeight: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  historyExtraMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  historyExtraMetric: {
    ...typography.caption,
    fontSize: 10,
  },
  historyChange: {
    width: 20,
    alignItems: 'center',
  },
})
