import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  TouchableOpacity,
  Alert,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Calendar, ChevronDown, ChevronUp, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react-native'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}
import * as Haptics from 'expo-haptics'

import { Card } from '../components/ui'
import {
  CaloriesWidget,
  QuickActionsWidget,
  RankingWidget,
  HydrationWidget,
  CaloricBalance,
  ProgramsSection,
} from '../components/dashboard'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useCaloricBankStore } from '../stores/caloric-bank-store'
import { getGreeting, formatNumber, getRelativeDate, getDateKey } from '../lib/utils'
import type { MealType } from '../types'
import type { RecipeComplexity } from '../components/dashboard/QuickActionsWidget'

// Pastel backgrounds for sections
const PASTEL_COLORS = {
  calories: 'rgba(59, 130, 246, 0.06)',   // Blue pastel
  meals: 'rgba(249, 115, 22, 0.06)',       // Orange pastel
  macros: 'rgba(16, 185, 129, 0.06)',      // Green pastel
  plan: 'rgba(139, 92, 246, 0.06)',        // Purple pastel
  hydration: 'rgba(6, 182, 212, 0.06)',    // Cyan pastel
  programs: 'rgba(236, 72, 153, 0.06)',    // Pink pastel
  solde: 'rgba(245, 158, 11, 0.06)',       // Amber pastel
  ranking: 'rgba(99, 102, 241, 0.06)',     // Indigo pastel
}

const mealConfig: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Petit-déjeuner', icon: '☀️', color: colors.warning },
  lunch: { label: 'Déjeuner', icon: '🍽️', color: colors.accent.primary },
  snack: { label: 'Collation', icon: '🍎', color: colors.success },
  dinner: { label: 'Dîner', icon: '🌙', color: colors.secondary.primary },
}

const mealOrder: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

export default function HomeScreen() {
  const navigation = useNavigation()
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData, getMealsByType, currentDate, setCurrentDate, removeItemFromMeal } = useMealsStore()
  const { checkAndUpdateStreak } = useGamificationStore()
  const {
    dailyBalances,
    weekStartDate,
    getCurrentDayIndex,
    getDaysUntilNewWeek,
    isFirstTimeSetup,
    confirmStartDay,
    initializeWeek,
  } = useCaloricBankStore()

  const [isHydrated, setIsHydrated] = useState(false)
  const [isPlanExpanded, setIsPlanExpanded] = useState(false)
  const [collapsedMeals, setCollapsedMeals] = useState<Set<MealType>>(new Set()) // Tracks which meals are collapsed

  useEffect(() => {
    setIsHydrated(true)
    checkAndUpdateStreak()
    initializeWeek()
  }, [checkAndUpdateStreak, initializeWeek])

  const todayData = getTodayData()
  const totals = todayData.totalNutrition
  const baseGoals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }
  const effectiveCalories = baseGoals.calories + (baseGoals.sportCaloriesBonus || 0)
  const goals = { ...baseGoals, calories: effectiveCalories }

  const greeting = getGreeting()
  const userName = profile?.firstName || profile?.name?.split(' ')[0] || 'Utilisateur'

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
    // @ts-ignore - Navigation typing
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
    // @ts-ignore - Navigation typing
    navigation.navigate('Profile', { screen: 'Achievements' })
  }

  const handleNavigateToPlan = (options: { duration: 1 | 3 | 7; calorieReduction: boolean; complexity: RecipeComplexity }) => {
    // @ts-ignore - Navigation typing
    navigation.navigate('WeeklyPlan', options)
  }

  const handleNavigateToMetabolicBoost = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('MetabolicBoost')
  }

  const handleNavigateToWellness = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('WellnessProgram')
  }

  const handleNavigateToSportInitiation = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('SportInitiation')
  }

  const handleNavigateToCalendar = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('Calendar')
  }

  const togglePlanExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setIsPlanExpanded(!isPlanExpanded)
  }

  const currentDayIndex = getCurrentDayIndex()

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <Pressable style={styles.calendarIconButton} onPress={handleNavigateToCalendar}>
            <Calendar size={24} color={colors.accent.primary} />
          </Pressable>
        </View>

        {/* 2. Main Calories Card */}
        <View style={[styles.section, { backgroundColor: PASTEL_COLORS.calories }]}>
          <CaloriesWidget
            consumed={totals.calories}
            burned={0}
            target={baseGoals.calories}
            sportBonus={baseGoals.sportCaloriesBonus || 0}
          />
        </View>

        {/* 3. Professional Macros Widget with progress bars */}
        <View style={[styles.section, { backgroundColor: PASTEL_COLORS.macros }]}>
          <Card style={styles.macrosCard}>
            {/* Proteins */}
            <View style={styles.macroItem}>
              <View style={styles.macroHeader}>
                <View style={[styles.macroDot, { backgroundColor: colors.nutrients.proteins }]} />
                <Text style={styles.macroLabel}>Protéines</Text>
                <Text style={styles.macroValues}>
                  <Text style={[styles.macroCurrentValue, { color: colors.nutrients.proteins }]}>
                    {Math.round(totals.proteins)}g
                  </Text>
                  <Text style={styles.macroGoalValue}> / {goals.proteins}g</Text>
                </Text>
              </View>
              <View style={styles.macroProgressTrack}>
                <View
                  style={[
                    styles.macroProgressFill,
                    {
                      backgroundColor: colors.nutrients.proteins,
                      width: `${Math.min((totals.proteins / goals.proteins) * 100, 100)}%`
                    }
                  ]}
                />
              </View>
            </View>

            {/* Carbs */}
            <View style={styles.macroItem}>
              <View style={styles.macroHeader}>
                <View style={[styles.macroDot, { backgroundColor: colors.nutrients.carbs }]} />
                <Text style={styles.macroLabel}>Glucides</Text>
                <Text style={styles.macroValues}>
                  <Text style={[styles.macroCurrentValue, { color: colors.nutrients.carbs }]}>
                    {Math.round(totals.carbs)}g
                  </Text>
                  <Text style={styles.macroGoalValue}> / {goals.carbs}g</Text>
                </Text>
              </View>
              <View style={styles.macroProgressTrack}>
                <View
                  style={[
                    styles.macroProgressFill,
                    {
                      backgroundColor: colors.nutrients.carbs,
                      width: `${Math.min((totals.carbs / goals.carbs) * 100, 100)}%`
                    }
                  ]}
                />
              </View>
            </View>

            {/* Fats */}
            <View style={styles.macroItem}>
              <View style={styles.macroHeader}>
                <View style={[styles.macroDot, { backgroundColor: colors.nutrients.fats }]} />
                <Text style={styles.macroLabel}>Lipides</Text>
                <Text style={styles.macroValues}>
                  <Text style={[styles.macroCurrentValue, { color: colors.nutrients.fats }]}>
                    {Math.round(totals.fats)}g
                  </Text>
                  <Text style={styles.macroGoalValue}> / {goals.fats}g</Text>
                </Text>
              </View>
              <View style={styles.macroProgressTrack}>
                <View
                  style={[
                    styles.macroProgressFill,
                    {
                      backgroundColor: colors.nutrients.fats,
                      width: `${Math.min((totals.fats / goals.fats) * 100, 100)}%`
                    }
                  ]}
                />
              </View>
            </View>
          </Card>
        </View>

        {/* 4. Meals Section (integrated from MealsScreen) */}
        <View style={[styles.section, { backgroundColor: PASTEL_COLORS.meals }]}>
          {/* Section Title */}
          <Text style={styles.mealsSectionTitle}>Journal des repas</Text>

          {/* Date Selector */}
          <View style={styles.dateSelector}>
            <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateButton}>
              <ChevronLeft size={20} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.dateText}>{getRelativeDate(currentDate)}</Text>
            <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateButton}>
              <ChevronRight size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Meal Cards */}
          {mealOrder.map((type) => {
            const config = mealConfig[type]
            const meals = getMealsByType(currentDate, type)
            const totalCalories = meals.reduce(
              (sum, meal) => sum + meal.totalNutrition.calories,
              0
            )
            const hasMeals = meals.length > 0
            const isCollapsed = collapsedMeals.has(type)
            const totalItems = meals.reduce((sum, m) => sum + m.items.length, 0)

            return (
              <Card key={type} style={styles.mealCard}>
                {/* Clickable header to expand/collapse */}
                <TouchableOpacity
                  style={styles.mealHeader}
                  onPress={() => hasMeals && toggleMealCollapsed(type)}
                  activeOpacity={hasMeals ? 0.7 : 1}
                >
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealIcon}>{config.icon}</Text>
                    <View>
                      <Text style={styles.mealLabel}>{config.label}</Text>
                      {hasMeals && (
                        <Text style={styles.mealItems}>
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
                        <Plus size={20} color={config.color} />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Collapsible content */}
                {hasMeals && !isCollapsed && (
                  <View style={styles.mealContent}>
                    {meals.map((meal) => (
                      <View key={meal.id} style={styles.mealItemsList}>
                        {meal.items.map((item) => (
                          <View key={item.id} style={styles.foodItem}>
                            <View style={styles.foodItemInfo}>
                              <Text style={styles.foodName} numberOfLines={1}>
                                {item.food.name}
                              </Text>
                              <Text style={styles.foodCalories}>
                                {Math.round(item.food.nutrition.calories * item.quantity)} kcal
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.deleteItemButton}
                              onPress={() => handleRemoveItem(meal.id, item.id, item.food.name)}
                            >
                              <X size={14} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ))}
                    <TouchableOpacity
                      style={styles.addMoreButton}
                      onPress={() => handleAddMeal(type)}
                    >
                      <Plus size={14} color={colors.accent.primary} />
                      <Text style={styles.addMoreText}>Ajouter</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            )
          })}
        </View>

        {/* 5. Plan Repas IA - Collapsible */}
        <View style={[styles.section, { backgroundColor: PASTEL_COLORS.plan }]}>
          <Pressable style={styles.collapsibleHeader} onPress={togglePlanExpanded}>
            <Text style={styles.sectionTitle}>Plan Repas IA</Text>
            {isPlanExpanded ? (
              <ChevronUp size={20} color={colors.text.secondary} />
            ) : (
              <ChevronDown size={20} color={colors.text.secondary} />
            )}
          </Pressable>
          {isPlanExpanded && (
            <View style={styles.planContent}>
              <QuickActionsWidget onPlanPress={handleNavigateToPlan} />
            </View>
          )}
        </View>

        {/* 6. Hydration */}
        <View style={[styles.section, { backgroundColor: PASTEL_COLORS.hydration }]}>
          <HydrationWidget onPress={handleNavigateToWellness} />
        </View>

        {/* 7. Programs Section */}
        <View style={[styles.section, { backgroundColor: PASTEL_COLORS.programs }]}>
          <ProgramsSection
            onSportPress={handleNavigateToSportInitiation}
            onMetabolicPress={handleNavigateToMetabolicBoost}
            onWellnessPress={handleNavigateToWellness}
          />
        </View>

        {/* 8. Solde Plaisir - Full version with 7-day graph */}
        <View style={[styles.section, { backgroundColor: PASTEL_COLORS.solde }]}>
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
            weekStartDate={weekStartDate || undefined}
            dailyTarget={goals.calories}
            isFirstTimeSetup={isFirstTimeSetup()}
            onConfirmStart={confirmStartDay}
          />
        </View>

        {/* 9. Ranking & Gamification */}
        <View style={[styles.section, { backgroundColor: PASTEL_COLORS.ranking }]}>
          <RankingWidget onPress={handleNavigateToAchievements} />
        </View>

        {/* Spacer for bottom nav */}
        <View style={styles.bottomSpacer} />
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
    padding: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flex: 1,
  },
  calendarIconButton: {
    padding: spacing.sm,
    backgroundColor: colors.accent.light,
    borderRadius: radius.full,
    marginLeft: spacing.md,
  },
  greeting: {
    ...typography.body,
    color: colors.text.secondary,
  },
  userName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  // Sections with pastel backgrounds
  section: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  // Professional Macros Widget
  macrosCard: {
    padding: spacing.md,
  },
  macroItem: {
    marginBottom: spacing.md,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  macroLabel: {
    flex: 1,
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  macroValues: {
    flexDirection: 'row',
  },
  macroCurrentValue: {
    ...typography.smallMedium,
    fontWeight: '700',
  },
  macroGoalValue: {
    ...typography.small,
    color: colors.text.muted,
  },
  macroProgressTrack: {
    height: 6,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  macroProgressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  // Meals section title
  mealsSectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  // Date selector
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  dateButton: {
    padding: spacing.xs,
  },
  dateText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginHorizontal: spacing.md,
  },
  // Meal cards
  mealCard: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mealIcon: {
    fontSize: 24,
  },
  mealLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  mealItems: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 10,
  },
  mealRight: {
    alignItems: 'flex-end',
  },
  mealCalories: {
    ...typography.smallMedium,
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
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealContent: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  mealItemsList: {
    marginBottom: spacing.xs,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    marginVertical: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
  },
  foodItemInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  foodName: {
    fontSize: 11,
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  foodCalories: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  deleteItemButton: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    backgroundColor: `${colors.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    marginTop: spacing.xs,
    backgroundColor: colors.accent.light,
    borderRadius: radius.sm,
  },
  addMoreText: {
    fontSize: 11,
    color: colors.accent.primary,
    fontWeight: '500',
  },
  // Collapsible Plan
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  planContent: {
    paddingTop: spacing.xs,
  },
  // Bottom
  bottomSpacer: {
    height: spacing.xl,
  },
})
