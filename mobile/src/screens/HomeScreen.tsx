
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  LayoutAnimation,
  UIManager,
  Platform,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import {
  Calendar,
  ChevronDown,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
  Trophy,
  Camera,
  ScanBarcode,
  TrendingUp,
  Copy,
} from 'lucide-react-native'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import * as Haptics from 'expo-haptics'

import { Card, AnimatedBackground } from '../components/ui'
import { GlassCard } from '../components/ui/GlassCard'
import { LiquidProgress } from '../components/dashboard/LiquidProgress'
import {
  CaloricBalance,
  ProgramsWidget,
  UnifiedCoachBubble,
  HydrationWidget,
  MealSuggestions,
  type SuggestedMeal,
} from '../components/dashboard'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows, fonts } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useCaloricBankStore } from '../stores/caloric-bank-store'
import { useOnboardingStore, FEATURE_DISCOVERY_MESSAGES } from '../stores/onboarding-store'
import FeatureDiscoveryModal from '../components/onboarding/FeatureDiscoveryModal'
import PhotoFoodScanner from '../components/PhotoFoodScanner'
import BarcodeScanner from '../components/BarcodeScanner'
import { getGreeting, formatNumber, getRelativeDate, getDateKey } from '../lib/utils'
import type { MealType, FoodItem } from '../types'

const { width } = Dimensions.get('window')

// Meal config function that uses iOS-style colors
const getMealConfig = (colors: typeof import('../constants/theme').lightColors): Record<MealType, { label: string; icon: string; color: string; gradient: readonly [string, string] }> => ({
  breakfast: { label: 'Petit-déjeuner', icon: '☀️', color: colors.warning, gradient: ['#FFB347', '#FF9500'] as const },      // Orange
  lunch: { label: 'Déjeuner', icon: '🍽️', color: colors.accent.primary, gradient: ['#4CD964', '#34C759'] as const },         // Green
  snack: { label: 'Collation', icon: '🍎', color: colors.success, gradient: ['#5AC8FA', '#007AFF'] as const },               // Blue
  dinner: { label: 'Dîner', icon: '🌙', color: colors.secondary.primary, gradient: ['#AF52DE', '#5856D6'] as const },        // Purple
})

const mealOrder: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

// Circular Progress Component
function CircularProgress({
  value,
  max,
  size = 160,
  strokeWidth = 14,
  colors,
}: {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  colors: typeof import('../constants/theme').lightColors
}) {
  const center = size / 2
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.min(value / max, 1)
  const strokeDashoffset = circumference * (1 - progress)
  const remaining = Math.max(0, max - value)

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="caloriesGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={colors.accent.primary} />
            <Stop offset="100%" stopColor={colors.secondary.primary} />
          </SvgGradient>
        </Defs>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={colors.border.light}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke="url(#caloriesGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      {/* Center content */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={[styles.caloriesRemaining, { color: colors.text.primary }]}>
          {formatNumber(remaining)}
        </Text>
        <Text style={[styles.caloriesRemainingLabel, { color: colors.text.muted }]}>
          kcal restantes
        </Text>
      </View>
    </View>
  )
}

// Macro Circle Progress Component
function MacroCircle({
  label,
  current,
  target,
  color,
  emoji,
  size = 90,
}: {
  label: string
  current: number
  target: number
  color: string
  emoji: string
  size?: number
}) {
  const { colors } = useTheme()
  const strokeWidth = 6
  const center = size / 2
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.min(current / target, 1)
  const strokeDashoffset = circumference * (1 - progress)

  return (
    <View style={styles.macroCircleContainer}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          {/* Background circle */}
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={colors.border.light}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
        {/* Center emoji */}
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={styles.macroCircleEmoji}>{emoji}</Text>
        </View>
      </View>
      {/* Values below circle */}
      <View style={[styles.macroCircleValues, { backgroundColor: `${color}15` }]}>
        <Text style={[styles.macroCircleCurrent, { color }]}>{Math.round(current)}</Text>
        <Text style={[styles.macroCircleTarget, { color: colors.text.muted }]}>/{target}g</Text>
      </View>
      <Text style={[styles.macroCircleLabel, { color: colors.text.secondary }]}>{label}</Text>
    </View>
  )
}

export default function HomeScreen() {
  const navigation = useNavigation()
  const { colors, isDark } = useTheme()
  const mealConfig = getMealConfig(colors)
  const { profile, nutritionGoals, recalculateNutritionGoals } = useUserStore()
  const { getTodayData, getMealsByType, currentDate, setCurrentDate, removeItemFromMeal, addMeal } = useMealsStore()
  const { checkAndUpdateStreak, currentStreak, currentLevel } = useGamificationStore()
  const {
    dailyBalances,
    getCurrentDayIndex,
    getDaysUntilNewWeek,
    isFirstTimeSetup,
    confirmStartDay,
    initializeWeek,
    canHavePlaisir,
    isPlaisirBonusActiveToday,
    getActivePlaisirBonus,
    getRemainingPlaisirMeals,
    activatePlaisirBonus,
    deactivatePlaisirBonus,
  } = useCaloricBankStore()

  const {
    getNewlyUnlockedFeature,
    markFeatureDiscovered,
    getDaysSinceSignup,
    isTrialExpired,
    hasSeenPaywall,
  } = useOnboardingStore()

  const [collapsedMeals, setCollapsedMeals] = useState<Set<MealType>>(new Set())
  const [showPhotoScanner, setShowPhotoScanner] = useState(false)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [discoveryModalVisible, setDiscoveryModalVisible] = useState(false)
  const [currentDiscoveryFeature, setCurrentDiscoveryFeature] = useState<{
    feature: string
    title: string
    message: string
    icon: string
    day: number
  } | null>(null)

  // Ensure currentDate is today when HomeScreen mounts
  useEffect(() => {
    const today = getDateKey()
    if (currentDate !== today) {
      setCurrentDate(today)
    }
  }, [])

  useEffect(() => {
    checkAndUpdateStreak()
    initializeWeek()
  }, [checkAndUpdateStreak, initializeWeek])

  // Ensure nutritionGoals are calculated if profile exists but goals don't
  useEffect(() => {
    if (profile && !nutritionGoals) {
      console.log('[HomeScreen] Profile exists but no nutritionGoals, triggering recalculation...')
      recalculateNutritionGoals()
    }
  }, [profile, nutritionGoals, recalculateNutritionGoals])

  // Check for newly unlocked features to show discovery modal
  useEffect(() => {
    const newFeature = getNewlyUnlockedFeature()
    if (newFeature) {
      const discovery = FEATURE_DISCOVERY_MESSAGES[newFeature]
      if (discovery) {
        setCurrentDiscoveryFeature({
          feature: newFeature,
          title: discovery.title,
          message: discovery.message,
          icon: discovery.icon,
          day: getDaysSinceSignup(),
        })
        setDiscoveryModalVisible(true)
      }
    }
  }, [getNewlyUnlockedFeature, getDaysSinceSignup])

  // Check if should show paywall (trial expired and not seen)
  useEffect(() => {
    if (isTrialExpired() && !hasSeenPaywall) {
      // Navigate to paywall after a short delay
      const timer = setTimeout(() => {
        // @ts-ignore
        navigation.navigate('Paywall')
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [isTrialExpired, hasSeenPaywall, navigation])

  const handleDiscoveryDismiss = () => {
    if (currentDiscoveryFeature) {
      markFeatureDiscovered(currentDiscoveryFeature.feature as any)
    }
    setDiscoveryModalVisible(false)
    setCurrentDiscoveryFeature(null)
  }

  const todayData = getTodayData()
  const totals = todayData.totalNutrition

  // Use nutritionGoals from store - should always be calculated after onboarding
  // Fallbacks match ProfileScreen for consistency
  const getBaseGoals = () => {
    if (nutritionGoals) return nutritionGoals

    // Fallback: same defaults as ProfileScreen for consistency
    // These should rarely be used as recalculateNutritionGoals runs on hydration
    return {
      calories: 2000,
      proteins: 100,
      carbs: 250,
      fats: 67
    }
  }

  const baseGoals = getBaseGoals()
  const plaisirBonus = getActivePlaisirBonus()
  const effectiveCalories = baseGoals.calories + (baseGoals.sportCaloriesBonus || 0) + plaisirBonus
  const goals = { ...baseGoals, calories: effectiveCalories }

  // Sync calories with CaloricBank whenever totals change
  useEffect(() => {
    if (nutritionGoals) {
      const { updateDailyBalance } = useCaloricBankStore.getState()
      updateDailyBalance(currentDate, goals.calories, totals.calories)
    }
  }, [currentDate, totals.calories, goals.calories, nutritionGoals])

  const userName = profile?.firstName || profile?.name?.split(' ')[0] || ''
  const greeting = getGreeting(userName || undefined)
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Date navigation
  const changeDate = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const current = new Date(currentDate)
    current.setDate(current.getDate() + delta)
    setCurrentDate(getDateKey(current))
  }

  // Meal handlers
  const handleAddMeal = (type: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // @ts-ignore
    navigation.navigate('AddMeal', { type })
  }

  const handleRemoveItem = (mealId: string, itemId: string, itemName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Supprimer l\'aliment',
      `Retirer "${itemName}" de ce repas ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            removeItemFromMeal(mealId, itemId)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          },
        },
      ]
    )
  }

  const toggleMealCollapsed = (mealType: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setCollapsedMeals(prev => {
      const next = new Set(prev)
      if (next.has(mealType)) {
        next.delete(mealType)
      } else {
        next.add(mealType)
      }
      return next
    })
  }

  // Helper to get date options for duplication
  const getDateOptions = () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(today)
    dayAfter.setDate(dayAfter.getDate() + 2)

    return [
      { text: "📅 Aujourd'hui", date: getDateKey(today) },
      { text: '📅 Demain', date: getDateKey(tomorrow) },
      { text: '📅 Après-demain', date: getDateKey(dayAfter) },
    ]
  }

  // Helper to add meal to a specific date
  const addMealToDate = (targetDate: string, mealType: MealType, items: { food: FoodItem; quantity: number }[]) => {
    const originalDate = currentDate
    setCurrentDate(targetDate)
    const newItems = items.map(item => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      food: item.food,
      quantity: item.quantity,
    }))
    addMeal(mealType, newItems)
    // Restore original date
    setCurrentDate(originalDate)
  }

  // Handler to duplicate a single food item - first choose day, then meal
  const handleDuplicateItem = (item: { food: FoodItem; quantity: number }, fromMealType: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const dateOptions = getDateOptions()

    // First: choose the day
    Alert.alert(
      'Dupliquer vers quel jour ?',
      `"${item.food.name}"`,
      [
        ...dateOptions.map(dateOpt => ({
          text: dateOpt.text,
          onPress: () => {
            // Then: choose the meal type
            const allMealOptions: { text: string; mealType: MealType }[] = [
              { text: '☀️ Petit-déjeuner', mealType: 'breakfast' as MealType },
              { text: '🍽️ Déjeuner', mealType: 'lunch' as MealType },
              { text: '🍎 Collation', mealType: 'snack' as MealType },
              { text: '🌙 Dîner', mealType: 'dinner' as MealType },
            ]
            const mealOptions = allMealOptions.filter(opt => !(dateOpt.date === currentDate && opt.mealType === fromMealType))

            Alert.alert(
              'Vers quel repas ?',
              dateOpt.text.replace('📅 ', ''),
              [
                ...mealOptions.map(opt => ({
                  text: opt.text,
                  onPress: () => {
                    addMealToDate(dateOpt.date, opt.mealType, [item])
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  },
                })),
                { text: 'Annuler', style: 'cancel' },
              ]
            )
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    )
  }

  // Handler to duplicate an entire meal - first choose day, then meal type
  const handleDuplicateMeal = (meals: { items: { food: FoodItem; quantity: number }[] }[], fromMealType: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const allItems = meals.flatMap(m => m.items)
    if (allItems.length === 0) return

    const dateOptions = getDateOptions()

    // First: choose the day
    Alert.alert(
      'Dupliquer vers quel jour ?',
      `${allItems.length} aliment${allItems.length > 1 ? 's' : ''}`,
      [
        ...dateOptions.map(dateOpt => ({
          text: dateOpt.text,
          onPress: () => {
            // Then: choose the meal type
            const allMealOpts: { text: string; mealType: MealType }[] = [
              { text: '☀️ Petit-déjeuner', mealType: 'breakfast' as MealType },
              { text: '🍽️ Déjeuner', mealType: 'lunch' as MealType },
              { text: '🍎 Collation', mealType: 'snack' as MealType },
              { text: '🌙 Dîner', mealType: 'dinner' as MealType },
            ]
            const mealOptions = allMealOpts.filter(opt => !(dateOpt.date === currentDate && opt.mealType === fromMealType))

            Alert.alert(
              'Vers quel repas ?',
              dateOpt.text.replace('📅 ', ''),
              [
                ...mealOptions.map(opt => ({
                  text: opt.text,
                  onPress: () => {
                    addMealToDate(dateOpt.date, opt.mealType, allItems)
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  },
                })),
                { text: 'Annuler', style: 'cancel' },
              ]
            )
          },
        })),
        { text: 'Annuler', style: 'cancel' },
      ]
    )
  }

  // Handler for foods detected by photo/barcode scanner
  const handleFoodsDetected = (foods: FoodItem[]) => {
    if (foods.length === 0) return

    // Determine meal type based on current time
    const hour = new Date().getHours()
    let mealType: MealType = 'snack'
    if (hour >= 5 && hour < 11) mealType = 'breakfast'
    else if (hour >= 11 && hour < 15) mealType = 'lunch'
    else if (hour >= 18 && hour < 22) mealType = 'dinner'

    // Convert FoodItem[] to MealItem[]
    const mealItems = foods.map(food => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      food,
      quantity: 1,
    }))

    addMeal(mealType, mealItems)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  // Handler for barcode product found
  const handleBarcodeProduct = (product: FoodItem) => {
    handleFoodsDetected([product])
  }

  // Navigation handlers
  const handleNavigateToAchievements = () => {
    // @ts-ignore
    navigation.navigate('Profile', { screen: 'Achievements' })
  }

  const handleNavigateToCalendar = () => {
    // @ts-ignore
    navigation.navigate('Calendar')
  }

  // Handle recipe suggestion press - navigate to recipe detail
  const handleSuggestionPress = (suggestion: SuggestedMeal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore - Pass the full suggestion object for RecipeDetailScreen to load
    navigation.navigate('RecipeDetail', {
      suggestion: {
        id: suggestion.id,
        name: suggestion.name,
        calories: suggestion.calories,
        proteins: suggestion.proteins,
        carbs: suggestion.carbs,
        fats: suggestion.fats,
        prepTime: suggestion.prepTime,
        mealType: suggestion.mealType,
        imageUrl: suggestion.imageUrl,
        isAI: suggestion.isAI,
        source: suggestion.source,
      }
    })
  }

  // Handle "View all" recipes - navigate to discover modal via AddMeal
  const handleViewAllRecipes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore - Navigate to AddMeal which has the Discover modal
    navigation.navigate('AddMeal', { openDiscover: true })
  }

  const currentDayIndex = getCurrentDayIndex()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <AnimatedBackground circleCount={4} intensity={0.06} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Header with Avatar */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarGradient, { backgroundColor: colors.accent.primary }]}>
              <Text style={styles.avatarText}>{userInitials || '👋'}</Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.greetingSmall, { color: colors.text.muted }]}>{getGreeting()}</Text>
              <Text style={[styles.userName, { color: colors.text.primary }]}>{userName || 'Bienvenue'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.headerIconButton, { backgroundColor: colors.bg.elevated }]}
              onPress={handleNavigateToCalendar}
            >
              <Calendar size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row - 3 cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}>
            <Flame size={20} color="#FF9500" />
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{currentStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>jours</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}>
            <Trophy size={20} color="#FFD60A" />
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{currentLevel}</Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>niveau</Text>
          </View>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              // @ts-ignore
              navigation.navigate('Progress')
            }}
          >
            <TrendingUp size={20} color="#34C759" />
            <Text style={[styles.statValue, { color: colors.text.primary }]}>Suivi</Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>progrès</Text>
          </TouchableOpacity>
        </View>

        {/* Unified Coach Bubble - Single communication point */}
        <View style={{ marginBottom: spacing.lg }}>
          <UnifiedCoachBubble />
        </View>

        {/* Meals Section - GlassCard (moved above Aujourd'hui) */}
        <GlassCard style={styles.mealsSection} delay={100}>
          <View style={styles.mealsSectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Journal des repas</Text>
            <View style={styles.dateSelector}>
              <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateButton}>
                <ChevronLeft size={18} color={colors.text.secondary} />
              </TouchableOpacity>
              <Text style={[styles.dateText, { color: colors.text.primary }]}>{getRelativeDate(currentDate)}</Text>
              <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateButton}>
                <ChevronRight size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {mealOrder.map((type) => {
            const config = mealConfig[type]
            const meals = getMealsByType(currentDate, type)
            const totalCalories = meals.reduce((sum, meal) => sum + meal.totalNutrition.calories, 0)
            const hasMeals = meals.length > 0
            const isCollapsed = collapsedMeals.has(type)
            const totalItems = meals.reduce((sum, m) => sum + m.items.length, 0)

            return (
              <View key={type} style={[styles.mealCard, { borderColor: colors.border.light }]}>
                <TouchableOpacity
                  style={styles.mealHeader}
                  onPress={() => hasMeals && toggleMealCollapsed(type)}
                  activeOpacity={hasMeals ? 0.7 : 1}
                >
                  <View style={styles.mealInfo}>
                    <LinearGradient
                      colors={config.gradient}
                      style={styles.mealIconContainer}
                    >
                      <Text style={styles.mealIcon}>{config.icon}</Text>
                    </LinearGradient>
                    <View>
                      <Text style={[styles.mealLabel, { color: colors.text.primary }]}>{config.label}</Text>
                      {hasMeals && (
                        <Text style={[styles.mealItems, { color: colors.text.tertiary }]}>
                          {totalItems} aliment{totalItems > 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.mealRight}>
                    {hasMeals ? (
                      <View style={styles.mealRightContent}>
                        <Text style={[styles.mealCalories, { color: config.color }]}>
                          {formatNumber(totalCalories)} kcal
                        </Text>
                        <View style={[styles.chevronContainer, !isCollapsed && styles.chevronRotated]}>
                          <ChevronDown size={16} color={colors.text.tertiary} />
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: `${config.color}15` }]}
                        onPress={() => handleAddMeal(type)}
                      >
                        <Plus size={18} color={config.color} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>

                {hasMeals && !isCollapsed && (
                  <View style={[styles.mealContent, { borderTopColor: colors.border.light }]}>
                    {meals.map((meal) => (
                      <View key={meal.id} style={styles.mealItemsList}>
                        {meal.items.map((item) => (
                          <View key={item.id} style={[styles.foodItem, { backgroundColor: colors.bg.secondary }]}>
                            <View style={styles.foodItemInfo}>
                              <Text style={[styles.foodName, { color: colors.text.secondary }]} numberOfLines={1}>
                                {item.food.name}
                              </Text>
                              <Text style={[styles.foodCalories, { color: colors.text.tertiary }]}>
                                {formatNumber(item.food.nutrition.calories * item.quantity)} kcal
                              </Text>
                            </View>
                            <View style={styles.foodItemActions}>
                              <TouchableOpacity
                                style={[styles.itemActionButton, { backgroundColor: `${colors.secondary.primary}15` }]}
                                onPress={() => handleDuplicateItem(item, type)}
                              >
                                <Copy size={14} color={colors.secondary.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.itemActionButton, { backgroundColor: `${colors.error}15` }]}
                                onPress={() => handleRemoveItem(meal.id, item.id, item.food.name)}
                              >
                                <X size={14} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                    <View style={styles.mealActionsRow}>
                      <TouchableOpacity
                        style={[styles.addMoreButton, { backgroundColor: colors.accent.light, flex: 1 }]}
                        onPress={() => handleAddMeal(type)}
                      >
                        <Plus size={14} color={colors.accent.primary} />
                        <Text style={[styles.addMoreText, { color: colors.accent.primary }]}>Ajouter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.duplicateMealButton, { backgroundColor: `${colors.secondary.primary}15` }]}
                        onPress={() => handleDuplicateMeal(meals, type)}
                      >
                        <Copy size={14} color={colors.secondary.primary} />
                        <Text style={[styles.addMoreText, { color: colors.secondary.primary }]}>Dupliquer repas</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )
          })}
        </GlassCard>

        {/* Main Calories Widget - Glassmorphism + LiquidProgress */}
        <GlassCard style={styles.caloriesSection} variant="elevated" delay={200}>
          <View style={styles.caloriesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Aujourd'hui</Text>
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={[styles.quickActionBtnSmall, { backgroundColor: colors.accent.light }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowPhotoScanner(true)
                }}
              >
                <Camera size={18} color={colors.accent.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionBtnSmall, { backgroundColor: colors.accent.light }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowBarcodeScanner(true)
                }}
              >
                <ScanBarcode size={18} color={colors.accent.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.caloriesContentCentered}>
            <LiquidProgress
              value={totals.calories}
              max={goals.calories}
              size={200}
              strokeWidth={16}
            />
          </View>

          {/* Condensed stats row */}
          <View style={styles.caloriesStatsRow}>
            <View style={styles.calorieStatChip}>
              <View style={[styles.calorieStatDot, { backgroundColor: colors.accent.primary }]} />
              <Text style={[styles.calorieStatChipText, { color: colors.text.secondary }]}>
                {formatNumber(totals.calories)} consommées
              </Text>
            </View>
            <View style={styles.calorieStatChip}>
              <View style={[styles.calorieStatDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.calorieStatChipText, { color: colors.text.secondary }]}>
                {formatNumber(goals.calories)} objectif
              </Text>
            </View>
            {baseGoals.sportCaloriesBonus && baseGoals.sportCaloriesBonus > 0 && (
              <View style={styles.calorieStatChip}>
                <View style={[styles.calorieStatDot, { backgroundColor: colors.warning }]} />
                <Text style={[styles.calorieStatChipText, { color: colors.warning }]}>
                  +{baseGoals.sportCaloriesBonus} sport
                </Text>
              </View>
            )}
            {plaisirBonus > 0 && (
              <View style={styles.calorieStatChip}>
                <View style={[styles.calorieStatDot, { backgroundColor: colors.accent.primary }]} />
                <Text style={[styles.calorieStatChipText, { color: colors.accent.primary }]}>
                  +{plaisirBonus} plaisir
                </Text>
              </View>
            )}
          </View>
        </GlassCard>

        {/* Macros Widget - Circles layout */}
        <GlassCard style={styles.macrosSection} delay={300}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary, marginBottom: spacing.md }]}>
            Macronutriments
          </Text>

          <View style={styles.macroCirclesRow}>
            <MacroCircle
              label="Protéines"
              current={totals.proteins}
              target={goals.proteins}
              color="#FF6B6B"
              emoji="🍖"
            />
            <MacroCircle
              label="Glucides"
              current={totals.carbs}
              target={goals.carbs}
              color="#FFB347"
              emoji="🌾"
            />
            <MacroCircle
              label="Lipides"
              current={totals.fats}
              target={goals.fats}
              color="#5DADE2"
              emoji="🥑"
            />
          </View>
        </GlassCard>

        {/* Hydration Widget */}
        <View style={styles.hydrationWidgetContainer}>
          <HydrationWidget />
        </View>

        {/* Meal Suggestions - Gustar recipes based on profile and time of day */}
        <MealSuggestions
          onSuggestionPress={handleSuggestionPress}
          onViewAll={handleViewAllRecipes}
        />

        {/* Programs Widget - Compact summary, navigates to Programs tab */}
        <View style={styles.programsWidgetContainer}>
          <ProgramsWidget onPress={() => {
            // @ts-ignore
            navigation.navigate('Programs')
          }} />
        </View>

        {/* Caloric Balance */}
        <View style={[styles.balanceSection, { backgroundColor: colors.bg.elevated }, shadows.sm]}>
          <CaloricBalance
            dailyBalances={dailyBalances.map(b => ({
              day: new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'short' }),
              date: new Date(b.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
              consumed: b.consumedCalories,
              target: b.targetCalories,
              balance: b.balance,
            }))}
            currentDay={currentDayIndex}
            daysUntilNewWeek={getDaysUntilNewWeek()}
            dailyTarget={goals.calories}
            isFirstTimeSetup={isFirstTimeSetup()}
            onConfirmStart={confirmStartDay}
            canActivatePlaisir={canHavePlaisir()}
            isPlaisirBonusActive={isPlaisirBonusActiveToday()}
            activePlaisirBonus={plaisirBonus}
            remainingPlaisirMeals={getRemainingPlaisirMeals()}
            onActivatePlaisir={activatePlaisirBonus}
            onDeactivatePlaisir={deactivatePlaisirBonus}
          />
        </View>

        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Feature Discovery Modal */}
      {currentDiscoveryFeature && (
        <FeatureDiscoveryModal
          visible={discoveryModalVisible}
          icon={currentDiscoveryFeature.icon}
          title={currentDiscoveryFeature.title}
          message={currentDiscoveryFeature.message}
          dayNumber={currentDiscoveryFeature.day}
          onClose={handleDiscoveryDismiss}
        />
      )}

      {/* Photo Food Scanner Modal */}
      <PhotoFoodScanner
        visible={showPhotoScanner}
        onClose={() => setShowPhotoScanner(false)}
        onFoodsDetected={handleFoodsDetected}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onFoodFound={handleBarcodeProduct}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  // Premium Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTextContainer: {
    gap: 2,
  },
  greetingSmall: {
    ...typography.caption,
    fontSize: 13,
  },
  greeting: {
    ...typography.small,
  },
  userName: {
    ...typography.h3,
    fontWeight: '700',
    fontFamily: fonts.sans.bold,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    gap: 2,
  },
  statValue: {
    ...typography.body,
    fontWeight: '700',
    fontFamily: fonts.sans.bold,
    marginTop: 2,
  },
  statLabel: {
    ...typography.caption,
    fontSize: 11,
  },
  // Calories Section - Updated for GlassCard + LiquidProgress
  caloriesSection: {
    marginBottom: spacing.lg,
  },
  caloriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    fontWeight: '600',
    fontFamily: fonts.serif.semibold,
  },
  calorieBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  calorieBadgeText: {
    ...typography.captionMedium,
  },
  // Quick actions row for camera/barcode shortcuts
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // New centered layout for LiquidProgress
  caloriesContentCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  // Old layout kept for reference
  caloriesContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caloriesRemaining: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    fontFamily: fonts.serif.bold,
  },
  caloriesRemainingLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  // New stats row layout
  caloriesStatsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  calorieStatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(74, 103, 65, 0.08)', // Légère teinte verte
  },
  calorieStatChipText: {
    ...typography.caption,
  },
  // Old individual stat items
  caloriesStats: {
    flex: 1,
    marginLeft: spacing.lg,
    gap: spacing.md,
  },
  calorieStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  calorieStatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  calorieStatLabel: {
    ...typography.small,
    flex: 1,
  },
  calorieStatValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  // Combined Widgets Card (Calories + Macros + Quick Actions)
  widgetsCard: {
    marginBottom: spacing.lg,
  },
  widgetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  widgetsSubtitle: {
    ...typography.caption,
  },
  widgetsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  caloriesCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  caloriesLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  macrosCompact: {
    flex: 1,
    gap: spacing.sm,
  },
  macroCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  macroCompactInfo: {
    flex: 1,
  },
  macroCompactValue: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  macroCompactLabel: {
    ...typography.caption,
    fontSize: 11,
  },
  quickActions: {
    gap: spacing.sm,
  },
  quickActionBtn: {
    width: 75,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  quickActionLabel: {
    ...typography.caption,
    fontSize: 10,
    textAlign: 'center',
  },
  // Macros Section - Circles layout
  macrosSection: {
    marginBottom: spacing.lg,
  },
  macroCirclesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  macroCircleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  macroCircleEmoji: {
    fontSize: 28,
  },
  macroCircleValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  macroCircleCurrent: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.sans.bold,
  },
  macroCircleTarget: {
    fontSize: 12,
  },
  macroCircleLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  // Meals Section - GlassCard handles padding & borderRadius
  mealsSection: {
    marginBottom: spacing.lg,
  },
  mealsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    padding: spacing.xs,
  },
  dateText: {
    ...typography.smallMedium,
    marginHorizontal: spacing.sm,
  },
  mealCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mealIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealIcon: {
    fontSize: 20,
  },
  mealLabel: {
    ...typography.bodyMedium,
  },
  mealItems: {
    ...typography.caption,
  },
  mealRight: {
    alignItems: 'flex-end',
  },
  mealCalories: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  mealRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chevronContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  mealItemsList: {
    marginBottom: spacing.xs,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginVertical: 2,
    borderRadius: radius.md,
  },
  foodItemInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  foodName: {
    ...typography.small,
    flex: 1,
    marginRight: spacing.sm,
  },
  foodCalories: {
    ...typography.smallMedium,
  },
  deleteItemButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemActionButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  duplicateMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  addMoreText: {
    ...typography.smallMedium,
  },
  // Hydration Widget Container
  hydrationWidgetContainer: {
    marginBottom: spacing.lg,
  },
  // Programs Widget Container
  programsWidgetContainer: {
    marginBottom: spacing.lg,
  },
  // Balance Section
  balanceSection: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  // Bottom
  bottomSpacer: {
    height: spacing.xl,
  },
})
