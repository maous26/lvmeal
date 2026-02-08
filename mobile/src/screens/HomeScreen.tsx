
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
import { useNavigation } from '@react-navigation/native'
import {
  Calendar,
  ChevronDown,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Flame,
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

import { Card } from '../components/ui'
import { LiquidProgress } from '../components/dashboard/LiquidProgress'
import {
  CaloricBalance,
  ProgramsWidget,
  HydrationWidget,
  MealSuggestions,
  type SuggestedMeal,
} from '../components/dashboard'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows, fonts, componentSizes } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useCaloricBankStore } from '../stores/caloric-bank-store'
import { useOnboardingStore, FEATURE_DISCOVERY_MESSAGES } from '../stores/onboarding-store'
import FeatureDiscoveryModal from '../components/onboarding/FeatureDiscoveryModal'
import PhotoFoodScanner from '../components/PhotoFoodScanner'
import BarcodeScanner from '../components/BarcodeScanner'
import { CreditsIndicator } from '../components/CreditsIndicator'
import { getGreeting, formatNumber, getRelativeDate, getDateKey } from '../lib/utils'
import type { MealType, FoodItem } from '../types'

const { width } = Dimensions.get('window')

// Meal config - clean, warm palette aligned with design system
const getMealConfig = (colors: typeof import('../constants/theme').lightColors): Record<MealType, { label: string; icon: string; color: string; bgColor: string }> => ({
  breakfast: { label: 'Petit-dej', icon: '☀️', color: colors.secondary.primary, bgColor: colors.secondary.light },
  lunch: { label: 'Dejeuner', icon: '🍽️', color: colors.accent.primary, bgColor: colors.accent.light },
  snack: { label: 'Collation', icon: '🍎', color: colors.info, bgColor: colors.infoLight },
  dinner: { label: 'Diner', icon: '🌙', color: '#9B8BB8', bgColor: 'rgba(155, 139, 184, 0.12)' },
})

const mealOrder: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

// Compact Macro Bar Component - clean, Notion-like
function MacroBar({
  label,
  current,
  target,
  color,
  colors,
}: {
  label: string
  current: number
  target: number
  color: string
  colors: typeof import('../constants/theme').lightColors
}) {
  const progress = Math.min(current / target, 1)

  return (
    <View style={styles.macroBarContainer}>
      <View style={styles.macroBarHeader}>
        <Text style={[styles.macroBarLabel, { color: colors.text.secondary }]}>{label}</Text>
        <Text style={[styles.macroBarValues, { color: colors.text.primary }]}>
          {Math.round(current)}<Text style={{ color: colors.text.muted }}>/{target}g</Text>
        </Text>
      </View>
      <View style={[styles.macroBarTrack, { backgroundColor: colors.bg.tertiary }]}>
        <View
          style={[
            styles.macroBarFill,
            { width: `${progress * 100}%`, backgroundColor: color },
          ]}
        />
      </View>
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
    isTrialActive,
    getTrialDaysRemaining,
    hasSeenPaywall,
    markPaywallSeen,
  } = useOnboardingStore()

  const trialExpired = isTrialExpired()
  const trialActive = isTrialActive()
  const trialDaysLeft = getTrialDaysRemaining()

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

  useEffect(() => {
    if (profile && !nutritionGoals) {
      recalculateNutritionGoals()
    }
  }, [profile, nutritionGoals, recalculateNutritionGoals])

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

  useEffect(() => {
    if (trialExpired && !hasSeenPaywall) {
      const timer = setTimeout(() => {
        // @ts-ignore
        navigation.navigate('Paywall')
        markPaywallSeen()
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [trialExpired, hasSeenPaywall, navigation, markPaywallSeen])

  const handleDiscoveryDismiss = () => {
    if (currentDiscoveryFeature) {
      markFeatureDiscovered(currentDiscoveryFeature.feature as any)
    }
    setDiscoveryModalVisible(false)
    setCurrentDiscoveryFeature(null)
  }

  const todayData = getTodayData()
  const totals = todayData.totalNutrition

  const getBaseGoals = () => {
    if (nutritionGoals) return nutritionGoals
    return { calories: 2000, proteins: 100, carbs: 250, fats: 67 }
  }

  const baseGoals = getBaseGoals()
  const plaisirBonus = getActivePlaisirBonus()
  const effectiveCalories = baseGoals.calories + (baseGoals.sportCaloriesBonus || 0) + plaisirBonus
  const goals = { ...baseGoals, calories: effectiveCalories }

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

  const getDateOptions = () => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(today)
    dayAfter.setDate(dayAfter.getDate() + 2)
    return [
      { text: "Aujourd'hui", date: getDateKey(today) },
      { text: 'Demain', date: getDateKey(tomorrow) },
      { text: 'Apres-demain', date: getDateKey(dayAfter) },
    ]
  }

  const addMealToDate = (targetDate: string, mealType: MealType, items: { food: FoodItem; quantity: number }[]) => {
    const originalDate = currentDate
    setCurrentDate(targetDate)
    const newItems = items.map(item => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      food: item.food,
      quantity: item.quantity,
    }))
    addMeal(mealType, newItems)
    setCurrentDate(originalDate)
  }

  const handleDuplicateItem = (item: { food: FoodItem; quantity: number }, fromMealType: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const dateOptions = getDateOptions()
    Alert.alert(
      'Dupliquer vers quel jour ?',
      `"${item.food.name}"`,
      [
        ...dateOptions.map(dateOpt => ({
          text: dateOpt.text,
          onPress: () => {
            const allMealOptions: { text: string; mealType: MealType }[] = [
              { text: 'Petit-dej', mealType: 'breakfast' as MealType },
              { text: 'Dejeuner', mealType: 'lunch' as MealType },
              { text: 'Collation', mealType: 'snack' as MealType },
              { text: 'Diner', mealType: 'dinner' as MealType },
            ]
            const mealOptions = allMealOptions.filter(opt => !(dateOpt.date === currentDate && opt.mealType === fromMealType))
            Alert.alert(
              'Vers quel repas ?',
              dateOpt.text,
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

  const handleDuplicateMeal = (meals: { items: { food: FoodItem; quantity: number }[] }[], fromMealType: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const allItems = meals.flatMap(m => m.items)
    if (allItems.length === 0) return
    const dateOptions = getDateOptions()
    Alert.alert(
      'Dupliquer vers quel jour ?',
      `${allItems.length} aliment${allItems.length > 1 ? 's' : ''}`,
      [
        ...dateOptions.map(dateOpt => ({
          text: dateOpt.text,
          onPress: () => {
            const allMealOpts: { text: string; mealType: MealType }[] = [
              { text: 'Petit-dej', mealType: 'breakfast' as MealType },
              { text: 'Dejeuner', mealType: 'lunch' as MealType },
              { text: 'Collation', mealType: 'snack' as MealType },
              { text: 'Diner', mealType: 'dinner' as MealType },
            ]
            const mealOptions = allMealOpts.filter(opt => !(dateOpt.date === currentDate && opt.mealType === fromMealType))
            Alert.alert(
              'Vers quel repas ?',
              dateOpt.text,
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

  const handleFoodsDetected = (foods: FoodItem[]) => {
    if (foods.length === 0) return
    const hour = new Date().getHours()
    let mealType: MealType = 'snack'
    if (hour >= 5 && hour < 11) mealType = 'breakfast'
    else if (hour >= 11 && hour < 15) mealType = 'lunch'
    else if (hour >= 18 && hour < 22) mealType = 'dinner'
    const mealItems = foods.map(food => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      food,
      quantity: 1,
    }))
    addMeal(mealType, mealItems)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const handleBarcodeProduct = (product: FoodItem) => {
    handleFoodsDetected([product])
  }

  const handleNavigateToCalendar = () => {
    // @ts-ignore
    navigation.navigate('Calendar')
  }

  const handleSuggestionPress = (suggestion: SuggestedMeal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore
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

  const handleViewAllRecipes = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore
    navigation.navigate('AddMeal', { openDiscover: true })
  }

  const currentDayIndex = getCurrentDayIndex()
  const caloriesRemaining = Math.max(0, goals.calories - totals.calories)
  const caloriesProgress = Math.min(totals.calories / goals.calories, 1)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Clean, minimal */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatar, { backgroundColor: colors.accent.light }]}>
              <Text style={[styles.avatarText, { color: colors.accent.primary }]}>{userInitials || '?'}</Text>
            </View>
            <View>
              <Text style={[styles.greetingText, { color: colors.text.muted }]}>{getGreeting()}</Text>
              <Text style={[styles.userName, { color: colors.text.primary }]}>{userName || 'Bienvenue'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <CreditsIndicator variant="compact" />
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}
              onPress={handleNavigateToCalendar}
            >
              <Calendar size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trial Banner */}
        {trialActive && trialDaysLeft > 0 && trialDaysLeft <= 3 && (
          <TouchableOpacity
            style={[styles.trialBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning + '30' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              // @ts-ignore
              navigation.navigate('Paywall')
            }}
          >
            <Text style={[styles.trialText, { color: colors.warning }]}>
              Essai : {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
            </Text>
            <Text style={[styles.trialCta, { color: colors.warning }]}>Passer Premium</Text>
          </TouchableOpacity>
        )}

        {trialExpired && !hasSeenPaywall && (
          <TouchableOpacity
            style={[styles.trialBanner, { backgroundColor: colors.errorLight, borderColor: colors.error + '30' }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              // @ts-ignore
              navigation.navigate('Paywall')
            }}
          >
            <Text style={[styles.trialText, { color: colors.error }]}>Essai termine</Text>
            <Text style={[styles.trialCta, { color: colors.error }]}>Continuer avec Premium</Text>
          </TouchableOpacity>
        )}

        {/* Today's Summary Card - The hero widget */}
        <Card style={styles.summaryCard} elevated>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryDateRow}>
              <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
                <ChevronLeft size={16} color={colors.text.muted} />
              </TouchableOpacity>
              <Text style={[styles.summaryDate, { color: colors.text.secondary }]}>{getRelativeDate(currentDate)}</Text>
              <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateArrow}>
                <ChevronRight size={16} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: colors.accent.light }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowPhotoScanner(true)
                }}
              >
                <Camera size={16} color={colors.accent.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickActionBtn, { backgroundColor: colors.accent.light }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  setShowBarcodeScanner(true)
                }}
              >
                <ScanBarcode size={16} color={colors.accent.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Calories Ring - Clean, centered */}
          <View style={styles.caloriesCenter}>
            <LiquidProgress
              value={totals.calories}
              max={goals.calories}
              size={180}
              strokeWidth={14}
            />
          </View>

          {/* Calories Summary Chips */}
          <View style={styles.caloriesChips}>
            <View style={[styles.chip, { backgroundColor: colors.accent.light }]}>
              <View style={[styles.chipDot, { backgroundColor: colors.accent.primary }]} />
              <Text style={[styles.chipText, { color: colors.text.secondary }]}>
                {formatNumber(totals.calories)} prises
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.bg.tertiary }]}>
              <View style={[styles.chipDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.chipText, { color: colors.text.secondary }]}>
                {formatNumber(goals.calories)} objectif
              </Text>
            </View>
            {baseGoals.sportCaloriesBonus && baseGoals.sportCaloriesBonus > 0 && (
              <View style={[styles.chip, { backgroundColor: colors.warningLight }]}>
                <View style={[styles.chipDot, { backgroundColor: colors.warning }]} />
                <Text style={[styles.chipText, { color: colors.warning }]}>
                  +{baseGoals.sportCaloriesBonus} sport
                </Text>
              </View>
            )}
          </View>

          {/* Macros - Clean horizontal bars */}
          <View style={styles.macrosContainer}>
            <MacroBar
              label="Proteines"
              current={totals.proteins}
              target={goals.proteins}
              color={colors.nutrients.proteins}
              colors={colors}
            />
            <MacroBar
              label="Glucides"
              current={totals.carbs}
              target={goals.carbs}
              color={colors.nutrients.carbs}
              colors={colors}
            />
            <MacroBar
              label="Lipides"
              current={totals.fats}
              target={goals.fats}
              color={colors.nutrients.fats}
              colors={colors}
            />
          </View>
        </Card>

        {/* Streak - Subtle, Duolingo-like */}
        {currentStreak > 0 && (
          <View style={[styles.streakRow, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}>
            <Flame size={16} color={colors.secondary.primary} />
            <Text style={[styles.streakText, { color: colors.text.secondary }]}>
              {currentStreak} jour{currentStreak > 1 ? 's' : ''} consecutif{currentStreak > 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                // @ts-ignore
                navigation.navigate('Progress')
              }}
            >
              <TrendingUp size={16} color={colors.accent.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Meals Section - Clean, functional */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Repas</Text>

          {mealOrder.map((type) => {
            const config = mealConfig[type]
            const meals = getMealsByType(currentDate, type)
            const totalCalories = meals.reduce((sum, meal) => sum + meal.totalNutrition.calories, 0)
            const hasMeals = meals.length > 0
            const isCollapsed = collapsedMeals.has(type)
            const totalItems = meals.reduce((sum, m) => sum + m.items.length, 0)

            return (
              <View
                key={type}
                style={[styles.mealCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}
              >
                <TouchableOpacity
                  style={styles.mealHeader}
                  onPress={() => hasMeals && toggleMealCollapsed(type)}
                  activeOpacity={hasMeals ? 0.7 : 1}
                >
                  <View style={styles.mealInfo}>
                    <View style={[styles.mealIconBox, { backgroundColor: config.bgColor }]}>
                      <Text style={styles.mealIcon}>{config.icon}</Text>
                    </View>
                    <View>
                      <Text style={[styles.mealLabel, { color: colors.text.primary }]}>{config.label}</Text>
                      {hasMeals && (
                        <Text style={[styles.mealItemCount, { color: colors.text.muted }]}>
                          {totalItems} aliment{totalItems > 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.mealRight}>
                    {hasMeals ? (
                      <View style={styles.mealRightInner}>
                        <Text style={[styles.mealCalories, { color: config.color }]}>
                          {formatNumber(totalCalories)} kcal
                        </Text>
                        <View style={[styles.chevron, !isCollapsed && styles.chevronFlipped]}>
                          <ChevronDown size={14} color={colors.text.muted} />
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.addMealBtn, { backgroundColor: config.bgColor }]}
                        onPress={() => handleAddMeal(type)}
                      >
                        <Plus size={16} color={config.color} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>

                {hasMeals && !isCollapsed && (
                  <View style={[styles.mealContent, { borderTopColor: colors.border.light }]}>
                    {meals.map((meal) => (
                      <View key={meal.id}>
                        {meal.items.map((item) => (
                          <View key={item.id} style={[styles.foodRow, { backgroundColor: colors.bg.secondary }]}>
                            <View style={styles.foodInfo}>
                              <Text style={[styles.foodName, { color: colors.text.secondary }]} numberOfLines={1}>
                                {item.food.name}
                              </Text>
                              <Text style={[styles.foodCal, { color: colors.text.muted }]}>
                                {formatNumber(item.food.nutrition.calories * item.quantity)} kcal
                              </Text>
                            </View>
                            <View style={styles.foodActions}>
                              <TouchableOpacity
                                style={[styles.foodActionBtn, { backgroundColor: colors.infoLight }]}
                                onPress={() => handleDuplicateItem(item, type)}
                              >
                                <Copy size={12} color={colors.info} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.foodActionBtn, { backgroundColor: colors.errorLight }]}
                                onPress={() => handleRemoveItem(meal.id, item.id, item.food.name)}
                              >
                                <X size={12} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                    <View style={styles.mealActions}>
                      <TouchableOpacity
                        style={[styles.mealActionBtn, { backgroundColor: colors.accent.light, flex: 1 }]}
                        onPress={() => handleAddMeal(type)}
                      >
                        <Plus size={13} color={colors.accent.primary} />
                        <Text style={[styles.mealActionText, { color: colors.accent.primary }]}>Ajouter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.mealActionBtn, { backgroundColor: colors.infoLight }]}
                        onPress={() => handleDuplicateMeal(meals, type)}
                      >
                        <Copy size={13} color={colors.info} />
                        <Text style={[styles.mealActionText, { color: colors.info }]}>Dupliquer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )
          })}
        </View>

        {/* Hydration Widget */}
        <View style={styles.widgetContainer}>
          <HydrationWidget />
        </View>

        {/* Meal Suggestions */}
        <MealSuggestions
          onSuggestionPress={handleSuggestionPress}
          onViewAll={handleViewAllRecipes}
        />

        {/* Programs Widget */}
        <View style={styles.widgetContainer}>
          <ProgramsWidget onPress={() => {
            // @ts-ignore
            navigation.navigate('Programs')
          }} />
        </View>

        {/* Caloric Balance */}
        <View style={[styles.balanceCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }, shadows.sm]}>
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
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
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
  avatar: {
    width: componentSizes.avatar.lg,
    height: componentSizes.avatar.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.h4,
    fontWeight: '600',
  },
  greetingText: {
    ...typography.caption,
    marginBottom: 2,
  },
  userName: {
    ...typography.h4,
    fontFamily: fonts.sans.semibold,
  },
  headerButton: {
    width: componentSizes.button.sm,
    height: componentSizes.button.sm,
    borderRadius: radius.default,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Trial Banner
  trialBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.sm,
    borderRadius: radius.default,
    borderWidth: 1,
    marginBottom: spacing.default,
  },
  trialText: {
    ...typography.small,
    fontWeight: '500',
  },
  trialCta: {
    ...typography.smallMedium,
    fontWeight: '600',
  },

  // Summary Card (Hero Widget)
  summaryCard: {
    marginBottom: spacing.default,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryDate: {
    ...typography.bodyMedium,
    marginHorizontal: spacing.sm,
  },
  dateArrow: {
    padding: spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caloriesCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.default,
  },
  caloriesChips: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
  chipText: {
    ...typography.caption,
  },

  // Macros
  macrosContainer: {
    gap: spacing.md,
  },
  macroBarContainer: {
    gap: spacing.xs,
  },
  macroBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroBarLabel: {
    ...typography.caption,
    fontWeight: '500',
  },
  macroBarValues: {
    ...typography.caption,
    fontWeight: '600',
  },
  macroBarTrack: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: radius.full,
  },

  // Streak
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
    borderRadius: radius.default,
    borderWidth: 1,
    marginBottom: spacing.default,
  },
  streakText: {
    ...typography.small,
    flex: 1,
  },

  // Section
  sectionContainer: {
    marginBottom: spacing.default,
  },
  sectionTitle: {
    ...typography.h4,
    fontFamily: fonts.sans.semibold,
    marginBottom: spacing.md,
  },

  // Meal Cards
  mealCard: {
    borderWidth: 1,
    borderRadius: radius.default,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  mealInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mealIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealIcon: {
    fontSize: 16,
  },
  mealLabel: {
    ...typography.bodyMedium,
  },
  mealItemCount: {
    ...typography.caption,
    marginTop: 1,
  },
  mealRight: {
    alignItems: 'flex-end',
  },
  mealRightInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mealCalories: {
    ...typography.smallMedium,
    fontWeight: '600',
  },
  chevron: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronFlipped: {
    transform: [{ rotate: '180deg' }],
  },
  addMealBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
  },
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.sm,
  },
  foodInfo: {
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
  foodCal: {
    ...typography.caption,
    fontWeight: '500',
  },
  foodActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  foodActionBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  mealActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  mealActionText: {
    ...typography.caption,
    fontWeight: '600',
  },

  // Widget containers
  widgetContainer: {
    marginBottom: spacing.default,
  },

  // Balance Card
  balanceCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.default,
    marginBottom: spacing.default,
  },

  // Bottom
  bottomSpacer: {
    height: spacing.xl,
  },
})
