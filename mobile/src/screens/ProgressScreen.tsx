import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useToast } from '../components/ui/Toast'
import {
  TrendingUp,
  TrendingDown,
  Award,
  Trophy,
  Zap,
  Sparkles,
  Plus,
  Heart,
  ChevronRight,
} from 'lucide-react-native'
import Svg, { Path, Circle, Line, Rect, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Card, Badge, ProgressBar, AnimatedBackground } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { fonts, spacing, typography, radius, shadows } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore, TIERS } from '../stores/gamification-store'
import { formatNumber, getDateKey, generateId } from '../lib/utils'
import { getWeeklyHealthSummary, type WeeklyHealthSummary } from '../services/health-service'
import {
  calculateWeightTrend,
  getSmoothedWeightData,
} from '../services/progress-insights'
import type { WeightEntry } from '../types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const STEPS_GOAL = 8000

type TabType = 'progress' | 'gamification'
type PeriodType = '7' | '30' | '90'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// Period selector component
function PeriodSelector({
  selected,
  onSelect,
  colors,
}: {
  selected: PeriodType
  onSelect: (period: PeriodType) => void
  colors: any
}) {
  return (
    <View style={styles.periodSelector}>
      {(['7', '30', '90'] as PeriodType[]).map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            { backgroundColor: colors.bg.secondary },
            selected === period && { backgroundColor: colors.accent.primary },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onSelect(period)
          }}
        >
          <Text
            style={[
              styles.periodButtonText,
              { color: colors.text.secondary },
              selected === period && { color: '#FFFFFF' },
            ]}
          >
            {period}j
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default function ProgressScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('progress')
  const [showAddWeight, setShowAddWeight] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [healthData, setHealthData] = useState<WeeklyHealthSummary | null>(null)
  const [, setIsLoadingHealth] = useState(true)
  const [activityPeriod, setActivityPeriod] = useState<PeriodType>('7')
  const [weightPeriod, setWeightPeriod] = useState<PeriodType>('30')

  // Store hydration check
  const isUserStoreHydrated = useUserStore((s) => s._hasHydrated)
  const isGamificationStoreHydrated = useGamificationStore((s) => s._hasHydrated)
  const isMealsStoreHydrated = useMealsStore((s) => s._hasHydrated)
  const isStoreHydrated = isUserStoreHydrated && isGamificationStoreHydrated && isMealsStoreHydrated

  // Store data
  const profile = useUserStore((s) => s.profile)
  const nutritionGoals = useUserStore((s) => s.nutritionGoals)
  const weightHistory = useUserStore((s) => s.weightHistory) || []
  const addWeightEntry = useUserStore((s) => s.addWeightEntry)
  const rawDailyData = useMealsStore((s) => s.dailyData) || {}
  const totalXP = useGamificationStore((s) => s.totalXP)
  const weeklyXP = useGamificationStore((s) => s.weeklyXP)

  // Load health data on mount
  useEffect(() => {
    const loadHealthData = async () => {
      setIsLoadingHealth(true)
      try {
        const data = await getWeeklyHealthSummary()
        setHealthData(data)
      } catch (error) {
        console.log('[ProgressScreen] Failed to load health data:', error)
      } finally {
        setIsLoadingHealth(false)
      }
    }
    loadHealthData()
  }, [])

  // Clean daily data
  const dailyData = useMemo(() => {
    const cleaned: typeof rawDailyData = {}
    for (const [date, dayData] of Object.entries(rawDailyData)) {
      if (!dayData) continue
      cleaned[date] = {
        ...dayData,
        totalNutrition: dayData.totalNutrition && typeof dayData.totalNutrition === 'object'
          ? {
              calories: typeof dayData.totalNutrition.calories === 'number' ? dayData.totalNutrition.calories : 0,
              proteins: typeof dayData.totalNutrition.proteins === 'number' ? dayData.totalNutrition.proteins : 0,
              carbs: typeof dayData.totalNutrition.carbs === 'number' ? dayData.totalNutrition.carbs : 0,
              fats: typeof dayData.totalNutrition.fats === 'number' ? dayData.totalNutrition.fats : 0,
            }
          : { calories: 0, proteins: 0, carbs: 0, fats: 0 },
      }
    }
    return cleaned
  }, [rawDailyData])

  // Loading state
  if (!isStoreHydrated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Progrès</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
        </View>
      </SafeAreaView>
    )
  }

  // Gamification data
  let tier = TIERS.bronze
  let nextTier: typeof TIERS.bronze | null = TIERS.silver
  let tierProgress = { current: 0, needed: 100, percentage: 0 }
  let rank = { percentile: 50, rank: 1, xpThisWeek: 0 }
  let streakInfo = { current: 0, longest: 0, isActive: false, bonus: 0 }
  let achievements: Array<{ achievement: { id: string; name: string; icon: string }; unlocked: boolean }> = []
  let aiCredits = 0

  try {
    const gamificationStore = useGamificationStore.getState()
    tier = gamificationStore.getTier()
    nextTier = gamificationStore.getNextTier()
    tierProgress = gamificationStore.getTierProgress()
    rank = gamificationStore.getWeeklyRank()
    streakInfo = gamificationStore.getStreakInfo()
    achievements = gamificationStore.getAchievements()
    aiCredits = gamificationStore.getAICreditsRemaining()
  } catch (error) {
    console.error('[ProgressScreen] Error getting gamification data:', error)
  }

  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

  // Get nutrition data for N days
  const getNutritionData = (days: number) => {
    const result = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateKey = getDateKey(date)
      const dayData = dailyData[dateKey]
      const nutrition = dayData?.totalNutrition || { calories: 0, proteins: 0, carbs: 0, fats: 0 }
      result.push({
        date: dateKey,
        dayLabel: date.toLocaleDateString('fr-FR', { weekday: 'short' }).charAt(0).toUpperCase(),
        calories: nutrition.calories,
        proteins: nutrition.proteins,
        carbs: nutrition.carbs,
        fats: nutrition.fats,
      })
    }
    return result
  }

  // Filter out aberrant weight entries (likely data corruption or unit conversion errors)
  const validWeightHistory = weightHistory.filter(entry => {
    const w = entry.weight
    return w >= 30 && w <= 200 // Reasonable human weight range in kg
  })

  // Recalculate weight trend with valid data only
  const validWeightTrend = calculateWeightTrend(validWeightHistory)

  // Calculate progress metrics - prioritize profile weight over history
  const profileWeight = profile?.weight || 0
  const latestValidWeight = validWeightTrend.current

  // Use profile weight as primary source, fallback to valid history
  const startWeight = profileWeight > 0 ? profileWeight : latestValidWeight
  const targetWeight = profile?.targetWeight || startWeight

  // Current weight: use latest valid entry from history, or profile weight
  const currentWeight = latestValidWeight > 0 ? latestValidWeight : profileWeight

  // Fix: Round weight to 1 decimal
  const displayWeight = currentWeight > 0 ? Math.round(currentWeight * 10) / 10 : (profileWeight > 0 ? profileWeight : '--')

  const totalToLose = startWeight - targetWeight
  const alreadyLost = startWeight - currentWeight
  const progressPercent = totalToLose > 0 ? Math.round((alreadyLost / totalToLose) * 100) : 0
  const clampedProgress = Math.max(0, Math.min(100, progressPercent))

  // Estimate weeks to goal
  const weeklyRate = validWeightTrend.weeklyRate || -0.5
  const remainingToLose = currentWeight - targetWeight
  const weeksToGoal = weeklyRate < 0 ? Math.ceil(remainingToLose / Math.abs(weeklyRate)) : null

  // Status
  const isOnTrack = weeklyRate <= -0.3 && weeklyRate >= -1.0
  const statusText = isOnTrack ? 'En bonne voie' : weeklyRate > -0.3 ? 'À accélérer' : 'Attention'
  const statusColor = isOnTrack ? colors.success : colors.warning

  // Handlers
  const handleAddWeight = () => {
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
  }

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActiveTab(tab)
  }

  const unlockedCount = achievements.filter(a => a.unlocked).length

  // ============================================
  // 1. STEPS CHART (Bar chart only)
  // ============================================
  const renderStepsChart = () => {
    const days = parseInt(activityPeriod)
    const nutritionData = getNutritionData(days)

    // Simulate steps data (will be replaced with real HealthKit data)
    const stepsData = nutritionData.map((d) => ({
      ...d,
      steps: healthData?.avgSteps ? Math.round(healthData.avgSteps * (0.7 + Math.random() * 0.6)) : 0,
    }))

    const hasStepsData = stepsData.some(d => d.steps > 0)

    if (!hasStepsData) {
      return (
        <View style={[styles.chartPlaceholder, { backgroundColor: colors.bg.secondary }]}>
          <Text style={[styles.chartPlaceholderText, { color: colors.text.muted }]}>
            Connecte Apple Santé pour voir tes pas
          </Text>
          <TouchableOpacity
            style={[styles.connectButton, { backgroundColor: colors.accent.primary }]}
            onPress={() => navigation.navigate('ScaleSettings')}
          >
            <Text style={styles.connectButtonText}>Connecter</Text>
          </TouchableOpacity>
        </View>
      )
    }

    const chartWidth = SCREEN_WIDTH - spacing.default * 2 - spacing.md * 2
    const chartHeight = 160
    const paddingTop = 20
    const paddingBottom = 30
    const graphHeight = chartHeight - paddingTop - paddingBottom

    const barWidth = days <= 7 ? 24 : days <= 30 ? 8 : 4
    const barGap = days <= 7 ? 8 : days <= 30 ? 3 : 1
    const maxSteps = Math.max(...stepsData.map(d => d.steps), STEPS_GOAL)
    const totalBarsWidth = days * (barWidth + barGap) - barGap
    const startX = (chartWidth - totalBarsWidth) / 2
    const avgSteps = Math.round(stepsData.reduce((sum, d) => sum + d.steps, 0) / days)

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="stepsGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent.primary} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.accent.primary} stopOpacity="0.6" />
            </LinearGradient>
          </Defs>

          {/* Goal line */}
          <Line
            x1={0}
            y1={paddingTop + graphHeight - (STEPS_GOAL / maxSteps) * graphHeight}
            x2={chartWidth}
            y2={paddingTop + graphHeight - (STEPS_GOAL / maxSteps) * graphHeight}
            stroke={colors.success}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />

          {/* Bars */}
          {stepsData.map((d, i) => {
            const x = startX + i * (barWidth + barGap)
            const barHeight = (d.steps / maxSteps) * graphHeight
            const y = paddingTop + graphHeight - barHeight
            const isAboveGoal = d.steps >= STEPS_GOAL

            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 4}
                fill={isAboveGoal ? colors.success : 'url(#stepsGradient)'}
              />
            )
          })}

          {/* X-axis labels (only for 7 days) */}
          {days <= 7 && stepsData.map((d, i) => (
            <SvgText
              key={`label-${i}`}
              x={startX + i * (barWidth + barGap) + barWidth / 2}
              y={chartHeight - 8}
              fontSize={10}
              fill={colors.text.muted}
              textAnchor="middle"
            >
              {d.dayLabel}
            </SvgText>
          ))}
        </Svg>

        {/* Stats */}
        <View style={styles.chartStatsCompact}>
          <Text style={[styles.chartStatValue, { color: avgSteps >= STEPS_GOAL ? colors.success : colors.text.primary }]}>
            {formatNumber(avgSteps)} pas/j
          </Text>
          <Text style={[styles.chartStatLabel, { color: colors.text.muted }]}>
            Objectif: {formatNumber(STEPS_GOAL)}
          </Text>
        </View>
      </View>
    )
  }

  // ============================================
  // 2. CALORIES BURNED CHART (Bar chart)
  // ============================================
  const renderCaloriesBurnedChart = () => {
    const days = parseInt(activityPeriod)
    const nutritionData = getNutritionData(days)

    // Simulate calories burned from steps (avg 0.04 kcal per step)
    const caloriesData = nutritionData.map((d) => ({
      ...d,
      caloriesBurned: healthData?.avgSteps ? Math.round(healthData.avgSteps * 0.04 * (0.7 + Math.random() * 0.6)) : 0,
    }))

    const hasData = caloriesData.some(d => d.caloriesBurned > 0)

    if (!hasData) {
      return (
        <View style={[styles.chartPlaceholder, { backgroundColor: colors.bg.secondary, height: 120 }]}>
          <Text style={[styles.chartPlaceholderText, { color: colors.text.muted }]}>
            Données d'activité requises
          </Text>
        </View>
      )
    }

    const chartWidth = SCREEN_WIDTH - spacing.default * 2 - spacing.md * 2
    const chartHeight = 140
    const paddingTop = 15
    const paddingBottom = 30
    const graphHeight = chartHeight - paddingTop - paddingBottom

    const barWidth = days <= 7 ? 24 : days <= 30 ? 8 : 4
    const barGap = days <= 7 ? 8 : days <= 30 ? 3 : 1
    const maxCalories = Math.max(...caloriesData.map(d => d.caloriesBurned), 400)
    const totalBarsWidth = days * (barWidth + barGap) - barGap
    const startX = (chartWidth - totalBarsWidth) / 2
    const avgCalories = Math.round(caloriesData.reduce((sum, d) => sum + d.caloriesBurned, 0) / days)

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="burnedGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.warning} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.warning} stopOpacity="0.6" />
            </LinearGradient>
          </Defs>

          {/* Bars */}
          {caloriesData.map((d, i) => {
            const x = startX + i * (barWidth + barGap)
            const barHeight = (d.caloriesBurned / maxCalories) * graphHeight
            const y = paddingTop + graphHeight - barHeight

            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 4}
                fill="url(#burnedGradient)"
              />
            )
          })}

          {/* X-axis labels (only for 7 days) */}
          {days <= 7 && caloriesData.map((d, i) => (
            <SvgText
              key={`label-${i}`}
              x={startX + i * (barWidth + barGap) + barWidth / 2}
              y={chartHeight - 8}
              fontSize={10}
              fill={colors.text.muted}
              textAnchor="middle"
            >
              {d.dayLabel}
            </SvgText>
          ))}
        </Svg>

        {/* Stats */}
        <View style={styles.chartStatsCompact}>
          <Text style={[styles.chartStatValue, { color: colors.warning }]}>
            {avgCalories} kcal/j brûlées
          </Text>
        </View>
      </View>
    )
  }

  // ============================================
  // 3. WEIGHT CHART (Curve only, no calories)
  // ============================================
  const renderWeightChart = () => {
    const days = parseInt(weightPeriod)
    const chartData = getSmoothedWeightData(validWeightHistory, days)

    if (chartData.length < 2) {
      return (
        <View style={[styles.chartPlaceholder, { backgroundColor: colors.bg.secondary }]}>
          <Text style={[styles.chartPlaceholderText, { color: colors.text.muted }]}>
            Ajoute des pesées pour voir ton évolution
          </Text>
        </View>
      )
    }

    const chartWidth = SCREEN_WIDTH - spacing.default * 2 - spacing.md * 2
    const chartHeight = 180
    const paddingTop = 20
    const paddingBottom = 30
    const graphHeight = chartHeight - paddingTop - paddingBottom

    const weights = chartData.map(d => d.smoothedWeight)
    const minW = Math.min(...weights, targetWeight) - 1
    const maxW = Math.max(...weights, startWeight) + 1
    const weightRange = maxW - minW || 1

    const getWeightY = (weight: number) =>
      paddingTop + ((maxW - weight) / weightRange) * graphHeight

    const weightPoints = chartData.map((entry, idx) => ({
      x: (idx / (chartData.length - 1)) * chartWidth,
      y: getWeightY(entry.smoothedWeight),
      weight: entry.smoothedWeight,
    }))

    const goalY = getWeightY(targetWeight)
    const startY = getWeightY(startWeight)
    const weightPath = weightPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const weightAreaPath = `${weightPath} L ${weightPoints[weightPoints.length - 1].x} ${paddingTop + graphHeight} L 0 ${paddingTop + graphHeight} Z`

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="weightAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent.primary} stopOpacity="0.3" />
              <Stop offset="1" stopColor={colors.accent.primary} stopOpacity="0.05" />
            </LinearGradient>
            <LinearGradient id="goalZone" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.success} stopOpacity="0.15" />
              <Stop offset="1" stopColor={colors.success} stopOpacity="0.05" />
            </LinearGradient>
          </Defs>

          {/* Goal zone */}
          <Rect x={0} y={goalY - 10} width={chartWidth} height={20} fill="url(#goalZone)" />

          {/* Target line */}
          <Line x1={0} y1={goalY} x2={chartWidth} y2={goalY} stroke={colors.success} strokeWidth={1.5} strokeDasharray="6 4" />

          {/* Ideal trajectory */}
          <Line x1={0} y1={startY} x2={chartWidth} y2={goalY} stroke={colors.text.muted} strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />

          {/* Weight area */}
          <Path d={weightAreaPath} fill="url(#weightAreaGradient)" />

          {/* Weight line */}
          <Path d={weightPath} stroke={colors.accent.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />

          {/* Current point */}
          <Circle cx={weightPoints[weightPoints.length - 1].x} cy={weightPoints[weightPoints.length - 1].y} r={6} fill={colors.accent.primary} />
          <Circle cx={weightPoints[weightPoints.length - 1].x} cy={weightPoints[weightPoints.length - 1].y} r={3} fill="#FFFFFF" />
        </Svg>

        {/* Y-axis labels */}
        <View style={[styles.yAxisLabels, { height: graphHeight }]}>
          <Text style={[styles.yLabel, { color: colors.text.muted }]}>{Math.round(maxW)} kg</Text>
          <Text style={[styles.yLabel, { color: colors.success }]}>{targetWeight} kg</Text>
          <Text style={[styles.yLabel, { color: colors.text.muted }]}>{Math.round(minW)} kg</Text>
        </View>

        {/* Stats */}
        <View style={styles.chartStats}>
          <View style={styles.chartStat}>
            <Text style={[styles.chartStatValue, { color: validWeightTrend.trend7d !== null && validWeightTrend.trend7d <= 0 ? colors.success : colors.warning }]}>
              {validWeightTrend.trend7d !== null ? `${validWeightTrend.trend7d > 0 ? '+' : ''}${validWeightTrend.trend7d} kg` : '--'}
            </Text>
            <Text style={[styles.chartStatLabel, { color: colors.text.muted }]}>7 derniers jours</Text>
          </View>
          <View style={styles.chartStat}>
            <Text style={[styles.chartStatValue, { color: weeklyRate <= -0.3 ? colors.success : colors.warning }]}>
              {weeklyRate > 0 ? '+' : ''}{weeklyRate} kg/sem
            </Text>
            <Text style={[styles.chartStatLabel, { color: colors.text.muted }]}>rythme</Text>
          </View>
        </View>
      </View>
    )
  }

  // ============================================
  // 4. CALORIES CONSUMED CHART (Bar chart)
  // ============================================
  const renderCaloriesConsumedChart = () => {
    const days = parseInt(weightPeriod)
    const nutritionData = getNutritionData(days)
    const hasData = nutritionData.some(d => d.calories > 0)

    if (!hasData) {
      return (
        <View style={[styles.chartPlaceholder, { backgroundColor: colors.bg.secondary, height: 120 }]}>
          <Text style={[styles.chartPlaceholderText, { color: colors.text.muted }]}>
            Ajoute des repas pour voir tes calories
          </Text>
        </View>
      )
    }

    const chartWidth = SCREEN_WIDTH - spacing.default * 2 - spacing.md * 2
    const chartHeight = 140
    const paddingTop = 15
    const paddingBottom = 30
    const graphHeight = chartHeight - paddingTop - paddingBottom

    const barWidth = days <= 7 ? 24 : days <= 30 ? 8 : 4
    const barGap = days <= 7 ? 8 : days <= 30 ? 3 : 1
    const maxCalories = Math.max(...nutritionData.map(d => d.calories), goals.calories * 1.2)
    const totalBarsWidth = days * (barWidth + barGap) - barGap
    const startX = (chartWidth - totalBarsWidth) / 2
    const goalLineY = paddingTop + graphHeight - (goals.calories / maxCalories) * graphHeight
    const daysWithData = nutritionData.filter(d => d.calories > 0).length
    const avgCalories = daysWithData > 0 ? Math.round(nutritionData.reduce((sum, d) => sum + d.calories, 0) / daysWithData) : 0

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="consumedGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.warning} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.warning} stopOpacity="0.6" />
            </LinearGradient>
            <LinearGradient id="consumedOverGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.error} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.error} stopOpacity="0.6" />
            </LinearGradient>
          </Defs>

          {/* Goal line */}
          <Line
            x1={0}
            y1={goalLineY}
            x2={chartWidth}
            y2={goalLineY}
            stroke={colors.success}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.6}
          />

          {/* Bars */}
          {nutritionData.map((d, i) => {
            if (d.calories === 0) return null
            const x = startX + i * (barWidth + barGap)
            const barHeight = (d.calories / maxCalories) * graphHeight
            const y = paddingTop + graphHeight - barHeight
            const isOverGoal = d.calories > goals.calories

            return (
              <Rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 4}
                fill={isOverGoal ? 'url(#consumedOverGradient)' : 'url(#consumedGradient)'}
              />
            )
          })}

          {/* X-axis labels (only for 7 days) */}
          {days <= 7 && nutritionData.map((d, i) => (
            <SvgText
              key={`label-${i}`}
              x={startX + i * (barWidth + barGap) + barWidth / 2}
              y={chartHeight - 8}
              fontSize={10}
              fill={colors.text.muted}
              textAnchor="middle"
            >
              {d.dayLabel}
            </SvgText>
          ))}
        </Svg>

        {/* Stats */}
        <View style={styles.chartStatsCompact}>
          <Text style={[styles.chartStatValue, { color: avgCalories <= goals.calories ? colors.success : colors.warning }]}>
            {avgCalories} kcal/j
          </Text>
          <Text style={[styles.chartStatLabel, { color: colors.text.muted }]}>
            Objectif: {goals.calories} kcal
          </Text>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <AnimatedBackground circleCount={4} intensity={0.06} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Progrès</Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
            activeTab === 'progress' && { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
          ]}
          onPress={() => handleTabChange('progress')}
        >
          <Text style={[styles.tabText, { color: colors.text.secondary }, activeTab === 'progress' && styles.tabTextActive]}>
            Progrès
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
            activeTab === 'gamification' && { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
          ]}
          onPress={() => handleTabChange('gamification')}
        >
          <Trophy size={16} color={activeTab === 'gamification' ? '#FFFFFF' : colors.text.secondary} />
          <Text style={[styles.tabText, { color: colors.text.secondary }, activeTab === 'gamification' && styles.tabTextActive]}>
            XP
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* PROGRESS TAB */}
        {activeTab === 'progress' && (
          <>
            {/* 1️⃣ HEADER CARD - Weight Progress */}
            <View style={[styles.headerCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
              <View style={styles.headerCardTop}>
                <View style={styles.weightProgress}>
                  <Text style={[styles.weightLabel, { color: colors.text.muted }]}>Poids</Text>
                  <View style={styles.weightRange}>
                    <Text style={[styles.currentWeight, { color: colors.text.primary }]}>{displayWeight} kg</Text>
                    <Text style={[styles.weightArrow, { color: colors.text.muted }]}>→</Text>
                    <Text style={[styles.targetWeightText, { color: colors.accent.primary }]}>{targetWeight} kg</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.iconButton, { backgroundColor: colors.accent.light }]}
                  onPress={() => setShowAddWeight(!showAddWeight)}
                >
                  <Plus size={16} color={colors.accent.primary} />
                </TouchableOpacity>
              </View>

              {/* Add weight input */}
              {showAddWeight && (
                <View style={[styles.addWeightRow, { borderColor: colors.border.light }]}>
                  <TextInput
                    style={[styles.weightInput, { color: colors.text.primary, borderColor: colors.border.medium, backgroundColor: colors.bg.secondary }]}
                    placeholder="ex: 82.5"
                    placeholderTextColor={colors.text.muted}
                    keyboardType="decimal-pad"
                    value={newWeight}
                    onChangeText={setNewWeight}
                    onSubmitEditing={handleAddWeight}
                  />
                  <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.accent.primary }]} onPress={handleAddWeight}>
                    <Text style={styles.saveButtonText}>Ajouter</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Progress bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressLabel, { color: colors.text.secondary }]}>
                    Progression: {clampedProgress}%
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    {isOnTrack ? (
                      <TrendingDown size={12} color={statusColor} />
                    ) : (
                      <TrendingUp size={12} color={statusColor} />
                    )}
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                  </View>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: colors.bg.secondary }]}>
                  <View style={[styles.progressBarFill, { width: `${clampedProgress}%`, backgroundColor: colors.accent.primary }]} />
                </View>
                {weeksToGoal && weeksToGoal > 0 && (
                  <Text style={[styles.etaText, { color: colors.text.muted }]}>
                    Rythme: {weeklyRate > 0 ? '+' : ''}{weeklyRate} kg/sem → Atteinte ~{weeksToGoal} semaines
                  </Text>
                )}
              </View>
            </View>

            {/* 2️⃣ APPLE HEALTH CONNECTION */}
            <TouchableOpacity
              style={[styles.healthConnectCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}
              onPress={() => navigation.navigate('ScaleSettings')}
              activeOpacity={0.7}
            >
              <View style={[styles.healthIconContainer, { backgroundColor: '#FF375F15' }]}>
                <Heart size={24} color="#FF375F" fill="#FF375F" />
              </View>
              <View style={styles.healthConnectContent}>
                <Text style={[styles.healthConnectTitle, { color: colors.text.primary }]}>
                  Apple Santé
                </Text>
                <Text style={[styles.healthConnectSubtitle, { color: colors.text.muted }]}>
                  {healthData?.avgSteps ? 'Sync automatique activée' : 'Connecter pour importer tes données'}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.text.muted} />
            </TouchableOpacity>

            {/* 3️⃣ STEPS CHART */}
            <View style={[styles.chartCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Pas</Text>
                <PeriodSelector selected={activityPeriod} onSelect={setActivityPeriod} colors={colors} />
              </View>
              {renderStepsChart()}
            </View>

            {/* 4️⃣ CALORIES BURNED CHART */}
            <View style={[styles.chartCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Calories brûlées</Text>
                <PeriodSelector selected={activityPeriod} onSelect={setActivityPeriod} colors={colors} />
              </View>
              {renderCaloriesBurnedChart()}
            </View>

            {/* 5️⃣ WEIGHT CHART */}
            <View style={[styles.chartCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Poids</Text>
                <PeriodSelector selected={weightPeriod} onSelect={setWeightPeriod} colors={colors} />
              </View>
              {renderWeightChart()}
            </View>

            {/* 6️⃣ CALORIES CONSUMED CHART */}
            <View style={[styles.chartCard, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Calories consommées</Text>
                <PeriodSelector selected={weightPeriod} onSelect={setWeightPeriod} colors={colors} />
              </View>
              {renderCaloriesConsumedChart()}
            </View>
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

            {/* Stats Grid */}
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

            {/* Features */}
            <Card style={styles.featuresCard}>
              <Text style={[styles.featuresSectionTitle, { color: colors.text.secondary }]}>Fonctionnalités</Text>
              {tier.features.slice(0, 3).map((feature, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <Sparkles size={14} color={tier.color} />
                  <Text style={[styles.featureText, { color: colors.text.primary }]}>{feature}</Text>
                </View>
              ))}
            </Card>

            {/* Achievements */}
            <Text style={[styles.gamificationSectionTitle, { color: colors.text.secondary }]}>Badges</Text>
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

            {/* Roadmap */}
            <Text style={[styles.gamificationSectionTitle, { color: colors.text.secondary }]}>Parcours</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  periodButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  periodButtonText: {
    ...typography.caption,
    fontWeight: '600',
  },

  // Header Card
  headerCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  headerCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  weightProgress: {
    flex: 1,
  },
  weightLabel: {
    ...typography.caption,
    marginBottom: 2,
  },
  weightRange: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  currentWeight: {
    fontSize: 28,
    fontWeight: '700',
  },
  weightArrow: {
    fontSize: 18,
  },
  targetWeightText: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addWeightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  weightInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    ...typography.body,
  },
  saveButton: {
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    ...typography.smallMedium,
    fontWeight: '600',
  },
  progressSection: {
    marginTop: spacing.xs,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  etaText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },

  // Health Connect Card
  healthConnectCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  healthIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthConnectContent: {
    flex: 1,
  },
  healthConnectTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    marginBottom: 2,
  },
  healthConnectSubtitle: {
    ...typography.caption,
  },

  // Chart Card
  chartCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  chartContainer: {
    position: 'relative',
  },
  chartPlaceholder: {
    height: 180,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chartPlaceholderText: {
    ...typography.small,
    textAlign: 'center',
  },
  connectButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  connectButtonText: {
    color: '#FFFFFF',
    ...typography.smallMedium,
    fontWeight: '600',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendBar: {
    width: 12,
    height: 8,
    borderRadius: 2,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  legendLineDashed: {
    width: 16,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendText: {
    ...typography.caption,
    fontSize: 10,
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  chartStatsCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  chartStat: {
    alignItems: 'center',
  },
  chartStatValue: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  chartStatLabel: {
    ...typography.caption,
    fontSize: 10,
  },
  yAxisLabels: {
    position: 'absolute',
    right: -45,
    top: 20,
    justifyContent: 'space-between',
    width: 50,
  },
  yLabel: {
    ...typography.caption,
    fontSize: 9,
    textAlign: 'right',
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
    width: (SCREEN_WIDTH - spacing.default * 2 - spacing.sm) / 2 - 1,
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

  // Section title for gamification
  gamificationSectionTitle: {
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
    width: (SCREEN_WIDTH - spacing.default * 2 - 40 - 36 * 6) / 5,
    height: 2,
  },
})
