import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { Plus, Flame, Dumbbell, CalendarRange, Sparkles } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, CircularProgress, ProgressBar, Button } from '../components/ui'
import {
  GamificationPanel,
  LymIAWidget,
  HydrationWidget,
  MealSuggestions,
  CaloricBalance,
  ProgramsSection,
  CoachInsights,
} from '../components/dashboard'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useCaloricBankStore } from '../stores/caloric-bank-store'
import { getGreeting, formatNumber } from '../lib/utils'
import type { MealType } from '../types'

const mealConfig: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Petit-dej', icon: '☀️', color: colors.warning },
  lunch: { label: 'Dejeuner', icon: '🍽️', color: colors.accent.primary },
  snack: { label: 'Collation', icon: '🍎', color: colors.success },
  dinner: { label: 'Diner', icon: '🌙', color: colors.secondary.primary },
}

export default function HomeScreen() {
  const navigation = useNavigation()
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData, getMealsByType, currentDate } = useMealsStore()
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

  useEffect(() => {
    setIsHydrated(true)
    checkAndUpdateStreak()
    initializeWeek()
  }, [checkAndUpdateStreak, initializeWeek])

  const todayData = getTodayData()
  const totals = todayData.totalNutrition
  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

  const greeting = getGreeting()
  const userName = profile?.firstName || profile?.name?.split(' ')[0] || 'Utilisateur'

  const handleMealPress = (type: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore - Navigation typing
    navigation.navigate('Meals', { screen: 'MealDetail', params: { type } })
  }

  const handleNavigateToAchievements = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('Profile', { screen: 'Achievements' })
  }

  const handleNavigateToPlan = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('WeeklyPlan')
  }

  const handleNavigateToAddMeal = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('AddMeal', { type: 'lunch' })
  }

  const handleNavigateToMetabolicBoost = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('MetabolicBoost')
  }

  const handleNavigateToWellness = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('Progress', { screen: 'Wellness' })
  }

  const handleNavigateToRecipes = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('AddMeal', { type: 'lunch', openDiscover: true })
  }

  const handleNavigateToSportInitiation = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('SportInitiation')
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
        </View>

        {/* 2. Coach Insights - LymIA connects all features for the user */}
        <CoachInsights />

        {/* 3. Main Calories Card - Most important, first thing user sees */}
        <Card style={styles.mainCard}>
          <LinearGradient
            colors={[colors.accent.primary, colors.accent.hover]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.caloriesGradient}
          >
            <View style={styles.caloriesContent}>
              <View style={styles.caloriesLeft}>
                <Text style={styles.caloriesLabel}>Calories restantes</Text>
                <Text style={styles.caloriesValue}>
                  {formatNumber(Math.max(0, goals.calories - totals.calories))}
                </Text>
                <Text style={styles.caloriesSubtext}>
                  sur {formatNumber(goals.calories)} kcal
                </Text>
              </View>
              <CircularProgress
                value={totals.calories}
                max={goals.calories}
                size={100}
                strokeWidth={8}
                color="#FFFFFF"
                backgroundColor="rgba(255,255,255,0.3)"
                showValue={false}
              />
            </View>

            <View style={styles.caloriesStats}>
              <View style={styles.calorieStat}>
                <Flame size={16} color="#FFFFFF" />
                <Text style={styles.calorieStatText}>
                  {formatNumber(totals.calories)} consommees
                </Text>
              </View>
              <View style={styles.calorieStat}>
                <Dumbbell size={16} color="#FFFFFF" />
                <Text style={styles.calorieStatText}>0 brulees</Text>
              </View>
            </View>
          </LinearGradient>
        </Card>

        {/* 4. Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleNavigateToAddMeal}
            style={styles.actionButton}
          >
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Ajouter un repas</Text>
          </Button>
          <Pressable style={styles.planButton} onPress={handleNavigateToPlan}>
            <View style={styles.planButtonContent}>
              <CalendarRange size={20} color="#10B981" />
              <Sparkles size={12} color="#F59E0B" style={styles.planSparkle} />
            </View>
            <Text style={styles.planButtonText}>Plan 7j</Text>
          </Pressable>
        </View>

        {/* 5. Macros - Complement to calories */}
        <Card style={styles.macrosCard}>
          <View style={styles.macrosRow}>
            <MacroItem
              label="Proteines"
              value={totals.proteins}
              max={goals.proteins}
              unit="g"
              color={colors.nutrients.proteins}
            />
            <MacroItem
              label="Glucides"
              value={totals.carbs}
              max={goals.carbs}
              unit="g"
              color={colors.nutrients.carbs}
            />
            <MacroItem
              label="Lipides"
              value={totals.fats}
              max={goals.fats}
              unit="g"
              color={colors.nutrients.fats}
            />
          </View>
        </Card>

        {/* 6. Meals Overview - Compact horizontal layout */}
        <Text style={styles.sectionTitle}>Repas du jour</Text>
        <View style={styles.mealsRow}>
          {(Object.keys(mealConfig) as MealType[]).map((type) => {
            const config = mealConfig[type]
            const meals = getMealsByType(currentDate, type)
            const totalCalories = meals.reduce(
              (sum, meal) => sum + meal.totalNutrition.calories,
              0
            )
            const hasData = totalCalories > 0

            return (
              <Pressable
                key={type}
                style={[styles.mealChip, hasData && styles.mealChipFilled]}
                onPress={() => handleMealPress(type)}
              >
                <Text style={styles.mealIcon}>{config.icon}</Text>
                <Text style={[styles.mealLabel, hasData && styles.mealLabelFilled]}>
                  {config.label}
                </Text>
                {hasData && (
                  <Text style={styles.mealCalories}>{totalCalories}</Text>
                )}
              </Pressable>
            )
          })}
        </View>

        {/* 7. Meal Suggestions - AI-powered recommendations from enriched-recipes.json */}
        <MealSuggestions
          onSuggestionPress={(suggestion) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            // @ts-ignore - Navigation typing
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
                isGustar: suggestion.isGustar,
                source: suggestion.source,
              },
              mealType: suggestion.mealType,
            })
          }}
          onViewAll={handleNavigateToRecipes}
        />

        {/* 8. Hydration - Compact widget */}
        <HydrationWidget onPress={handleNavigateToWellness} />

        {/* 9. Programs Section - Sport, Metabolic, Wellness (grouped) */}
        <ProgramsSection
          onSportPress={handleNavigateToSportInitiation}
          onMetabolicPress={handleNavigateToMetabolicBoost}
          onWellnessPress={handleNavigateToWellness}
        />

        {/* 10. Caloric Balance - Solde Plaisir */}
        <CaloricBalance
          dailyBalances={dailyBalances.map(b => ({
            day: new Date(b.date).toLocaleDateString('fr-FR', { weekday: 'short' }),
            date: new Date(b.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
            consumed: b.consumedCalories,
            target: b.targetCalories,
            balance: b.balance,
          }))}
          currentDay={getCurrentDayIndex()}
          daysUntilNewWeek={getDaysUntilNewWeek()}
          weekStartDate={weekStartDate || undefined}
          dailyTarget={goals.calories}
          isFirstTimeSetup={isFirstTimeSetup()}
          onConfirmStart={confirmStartDay}
        />

        {/* 11. Gamification - Motivation at the bottom */}
        <View style={styles.section}>
          <GamificationPanel compact onViewAll={handleNavigateToAchievements} />
        </View>

        {/* Spacer for bottom nav */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

function MacroItem({
  label,
  value,
  max,
  unit,
  color,
}: {
  label: string
  value: number
  max: number
  unit: string
  color: string
}) {
  const percentage = Math.min((value / max) * 100, 100)

  return (
    <View style={styles.macroItem}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={[styles.macroValue, { color }]}>
        {value}
        <Text style={styles.macroUnit}>{unit}</Text>
      </Text>
      <ProgressBar value={value} max={max} color={color} size="sm" />
      <Text style={styles.macroGoal}>/ {max}{unit}</Text>
    </View>
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
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.body,
    color: colors.text.secondary,
  },
  userName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  // Sections
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  // Calories Card
  mainCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  caloriesGradient: {
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  caloriesContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caloriesLeft: {},
  caloriesLabel: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
  },
  caloriesValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: spacing.xs,
  },
  caloriesSubtext: {
    ...typography.small,
    color: 'rgba(255,255,255,0.8)',
  },
  caloriesStats: {
    flexDirection: 'row',
    marginTop: spacing.default,
    gap: spacing.lg,
  },
  calorieStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  calorieStatText: {
    ...typography.small,
    color: '#FFFFFF',
  },
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  planButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: radius.lg,
  },
  planButtonContent: {
    position: 'relative',
  },
  planSparkle: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  planButtonText: {
    ...typography.smallMedium,
    color: '#10B981',
  },
  // Macros
  macrosCard: {
    marginBottom: spacing.sm,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  macroValue: {
    ...typography.h4,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  macroUnit: {
    ...typography.small,
    fontWeight: '400',
  },
  macroGoal: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  // Meals - Horizontal compact chips
  mealsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  mealChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  mealChipFilled: {
    backgroundColor: colors.accent.light,
    borderColor: colors.accent.primary,
  },
  mealIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  mealLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  mealLabelFilled: {
    color: colors.accent.primary,
    fontWeight: '500',
  },
  mealCalories: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  // Bottom
  bottomSpacer: {
    height: spacing.xl,
  },
})
