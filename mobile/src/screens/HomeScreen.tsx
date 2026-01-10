import React, { useEffect, useState, useRef } from 'react'
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
  Animated,
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
  Sparkles,
  Beef,
  Wheat,
  Droplets,
} from 'lucide-react-native'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import * as Haptics from 'expo-haptics'

import { Card } from '../components/ui'
import { GlassCard } from '../components/ui/GlassCard'
import { LiquidProgress } from '../components/dashboard/LiquidProgress'
import {
  CaloricBalance,
  ProgramsWidget,
  ProgressWidget,
  UnifiedCoachBubble,
  HydrationWidget,
} from '../components/dashboard'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows, fonts } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useCaloricBankStore } from '../stores/caloric-bank-store'
import { useOnboardingStore, FEATURE_DISCOVERY_MESSAGES } from '../stores/onboarding-store'
import FeatureDiscoveryModal from '../components/onboarding/FeatureDiscoveryModal'
import { getGreeting, formatNumber, getRelativeDate, getDateKey } from '../lib/utils'
import type { MealType } from '../types'

const { width } = Dimensions.get('window')

// Meal config function that uses dynamic organic colors
const getMealConfig = (colors: typeof import('../constants/theme').lightColors): Record<MealType, { label: string; icon: string; color: string; gradient: readonly [string, string] }> => ({
  breakfast: { label: 'Petit-déjeuner', icon: '☀️', color: colors.warning, gradient: ['#E3BE91', '#D4A574'] as const },      // Caramel
  lunch: { label: 'Déjeuner', icon: '🍽️', color: colors.accent.primary, gradient: ['#5C7A52', '#4A6741'] as const },         // Mousse
  snack: { label: 'Collation', icon: '🍎', color: colors.success, gradient: ['#7A9E7E', '#5C8A5E'] as const },               // Sauge
  dinner: { label: 'Dîner', icon: '🌙', color: colors.secondary.primary, gradient: ['#D09789', '#C87863'] as const },        // Terre Cuite
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

// Macro Progress Bar with Gradient and Staggered Animation
function MacroProgressBar({
  label,
  current,
  target,
  color,
  gradientColors,
  icon,
  delay = 0,
}: {
  label: string
  current: number
  target: number
  color: string
  gradientColors: readonly [string, string]
  icon: React.ReactNode
  delay?: number
}) {
  const { colors } = useTheme()
  const progress = Math.min((current / target) * 100, 100)

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current
  const progressAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Staggered entrance animation
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start()
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, progress])

  // Interpolate progress width
  const animatedWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  })

  return (
    <Animated.View
      style={[
        styles.macroItem,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.macroHeader}>
        <View style={[styles.macroIconContainer, { backgroundColor: `${color}20` }]}>
          {icon}
        </View>
        <View style={styles.macroInfo}>
          <Text style={[styles.macroLabel, { color: colors.text.secondary }]}>{label}</Text>
          <Text style={styles.macroValues}>
            <Text style={[styles.macroCurrentValue, { color }]}>{Math.round(current)}g</Text>
            <Text style={[styles.macroGoalValue, { color: colors.text.muted }]}> / {target}g</Text>
          </Text>
        </View>
      </View>
      <View style={[styles.macroProgressTrack, { backgroundColor: colors.bg.tertiary }]}>
        <Animated.View style={{ width: animatedWidth }}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.macroProgressFill, { width: '100%' }]}
          />
        </Animated.View>
      </View>
    </Animated.View>
  )
}

export default function HomeScreen() {
  const navigation = useNavigation()
  const { colors, isDark } = useTheme()
  const mealConfig = getMealConfig(colors)
  const { profile, nutritionGoals, recalculateNutritionGoals } = useUserStore()
  const { getTodayData, getMealsByType, currentDate, setCurrentDate, removeItemFromMeal } = useMealsStore()
  const { checkAndUpdateStreak, currentStreak, currentLevel } = useGamificationStore()
  const {
    dailyBalances,
    getCurrentDayIndex,
    getDaysUntilNewWeek,
    isFirstTimeSetup,
    confirmStartDay,
    initializeWeek,
  } = useCaloricBankStore()

  const {
    getNewlyUnlockedFeature,
    markFeatureDiscovered,
    getDaysSinceSignup,
    isTrialExpired,
    hasSeenPaywall,
  } = useOnboardingStore()

  const [collapsedMeals, setCollapsedMeals] = useState<Set<MealType>>(new Set())
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
  const effectiveCalories = baseGoals.calories + (baseGoals.sportCaloriesBonus || 0)
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
  const userInitials = userName.substring(0, 2).toUpperCase()

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

  // Navigation handlers
  const handleNavigateToAchievements = () => {
    // @ts-ignore
    navigation.navigate('Profile', { screen: 'Achievements' })
  }

  const handleNavigateToCalendar = () => {
    // @ts-ignore
    navigation.navigate('Calendar')
  }

  const handleNavigateToProgress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore
    navigation.navigate('Progress')
  }

  const currentDayIndex = getCurrentDayIndex()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={[colors.accent.primary, colors.accent.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarGradient}
            >
              <Text style={styles.avatarText}>{userInitials}</Text>
            </LinearGradient>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.greeting, { color: colors.text.tertiary }]}>{greeting}</Text>
              <Text style={[styles.userName, { color: colors.text.primary }]}>{userName}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.headerIconButton, { backgroundColor: colors.accent.light }]}
            onPress={handleNavigateToCalendar}
          >
            <Calendar size={20} color={colors.accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats Row - 2 cards only */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}>
            <Flame size={18} color={colors.secondary.primary} />
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{currentStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>Série</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}>
            <Trophy size={18} color={colors.warning} />
            <Text style={[styles.statValue, { color: colors.text.primary }]}>Niv. {currentLevel}</Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>Niveau</Text>
          </View>
        </View>

        {/* Unified Coach Bubble - Single communication point */}
        <View style={{ marginBottom: spacing.lg }}>
          <UnifiedCoachBubble />
        </View>

        {/* Main Calories Widget - Glassmorphism + LiquidProgress */}
        <GlassCard style={styles.caloriesSection} variant="elevated" delay={100}>
          <View style={styles.caloriesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Aujourd'hui</Text>
            <View style={[styles.calorieBadge, { backgroundColor: colors.accent.light }]}>
              <Sparkles size={12} color={colors.accent.primary} />
              <Text style={[styles.calorieBadgeText, { color: colors.accent.primary }]}>
                {Math.round((totals.calories / goals.calories) * 100)}% atteint
              </Text>
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
          </View>
        </GlassCard>

        {/* Macros Widget - Glassmorphism avec gradients organiques */}
        <GlassCard style={styles.macrosSection} delay={200}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary, marginBottom: spacing.md }]}>
            Macronutriments
          </Text>

          <MacroProgressBar
            label="Protéines"
            current={totals.proteins}
            target={goals.proteins}
            color={colors.nutrients.proteins}
            gradientColors={['#5C7A52', '#4A6741']}
            icon={<Beef size={16} color={colors.nutrients.proteins} strokeWidth={1.5} />}
            delay={100}
          />

          <MacroProgressBar
            label="Glucides"
            current={totals.carbs}
            target={goals.carbs}
            color={colors.nutrients.carbs}
            gradientColors={['#E3BE91', '#D4A574']}
            icon={<Wheat size={16} color={colors.nutrients.carbs} strokeWidth={1.5} />}
            delay={200}
          />

          <MacroProgressBar
            label="Lipides"
            current={totals.fats}
            target={goals.fats}
            color={colors.nutrients.fats}
            gradientColors={['#B8A0CC', '#9B7BB8']}
            icon={<Droplets size={16} color={colors.nutrients.fats} strokeWidth={1.5} />}
            delay={300}
          />
        </GlassCard>

        {/* Hydration Widget */}
        <View style={styles.hydrationWidgetContainer}>
          <HydrationWidget />
        </View>

        {/* Meals Section - GlassCard */}
        <GlassCard style={styles.mealsSection} delay={300}>
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
                            <TouchableOpacity
                              style={[styles.deleteItemButton, { backgroundColor: `${colors.error}15` }]}
                              onPress={() => handleRemoveItem(meal.id, item.id, item.food.name)}
                            >
                              <X size={14} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ))}
                    <TouchableOpacity
                      style={[styles.addMoreButton, { backgroundColor: colors.accent.light }]}
                      onPress={() => handleAddMeal(type)}
                    >
                      <Plus size={14} color={colors.accent.primary} />
                      <Text style={[styles.addMoreText, { color: colors.accent.primary }]}>Ajouter un aliment</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )
          })}
        </GlassCard>

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
          />
        </View>

        {/* Progress Widget - replaces Weight Widget */}
        <ProgressWidget onPress={handleNavigateToProgress} />

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
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerTextContainer: {
    gap: 2,
  },
  greeting: {
    ...typography.small,
  },
  userName: {
    ...typography.h4,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  statValue: {
    ...typography.bodyMedium,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
  },
  statLabel: {
    ...typography.caption,
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
  // Macros Section - GlassCard handles padding & borderRadius
  macrosSection: {
    marginBottom: spacing.lg,
  },
  macroItem: {
    marginBottom: spacing.md,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  macroIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  macroInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroLabel: {
    ...typography.bodyMedium,
  },
  macroValues: {
    flexDirection: 'row',
  },
  macroCurrentValue: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  macroGoalValue: {
    ...typography.body,
  },
  macroProgressTrack: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  macroProgressFill: {
    height: '100%',
    borderRadius: radius.full,
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
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
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
