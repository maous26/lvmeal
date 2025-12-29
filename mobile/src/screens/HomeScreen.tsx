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
import { Calendar } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card } from '../components/ui'
import {
  CaloriesWidget,
  MacrosWidget,
  MealChipsWidget,
  QuickActionsWidget,
  GamificationPanel,
  HydrationWidget,
  MealSuggestions,
  CaloricBalance,
  ProgramsSection,
} from '../components/dashboard'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useCaloricBankStore } from '../stores/caloric-bank-store'
import { getGreeting } from '../lib/utils'
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
  const baseGoals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }
  // Effective calories include sport bonus if enrolled in sport program
  const effectiveCalories = baseGoals.calories + (baseGoals.sportCaloriesBonus || 0)
  const goals = { ...baseGoals, calories: effectiveCalories }

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

  const handleNavigateToCalendar = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('Calendar')
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
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <Pressable style={styles.calendarIconButton} onPress={handleNavigateToCalendar}>
            <Calendar size={24} color={colors.accent.primary} />
          </Pressable>
        </View>

        {/* 2. Main Calories Card - Most important, first thing user sees */}
        <View style={{ marginBottom: spacing.md }}>
          <CaloriesWidget
            consumed={totals.calories}
            burned={0}
            target={baseGoals.calories}
            sportBonus={baseGoals.sportCaloriesBonus || 0}
          />
        </View>

        {/* 3. Quick Actions */}
        <View style={{ marginBottom: spacing.md }}>
          <QuickActionsWidget onPlanPress={handleNavigateToPlan} />
        </View>

        {/* 5. Macros - Complement to calories */}
        <MacrosWidget
          proteins={{ value: totals.proteins, max: goals.proteins }}
          carbs={{ value: totals.carbs, max: goals.carbs }}
          fats={{ value: totals.fats, max: goals.fats }}
        />

        {/* 5. Meals Overview - Professional meal chips */}
        <MealChipsWidget
          meals={(Object.keys(mealConfig) as MealType[]).map((type) => {
            const meals = getMealsByType(currentDate, type)
            const totalCalories = meals.reduce(
              (sum, meal) => sum + meal.totalNutrition.calories,
              0
            )
            return { type, calories: totalCalories, mealsCount: meals.length }
          })}
          onMealPress={handleMealPress}
        />

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
  // Sections
  section: {
    marginBottom: spacing.md,
  },
  // Bottom
  bottomSpacer: {
    height: spacing.xl,
  },
})
