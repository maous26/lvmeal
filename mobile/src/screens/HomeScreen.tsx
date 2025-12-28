import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { Plus, Flame, Dumbbell, CalendarRange, Sparkles } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, CircularProgress, ProgressBar, Button } from '../components/ui'
import {
  GamificationPanel,
  WellnessWidget,
  SportWidget,
  LymIAWidget,
  CaloricBalance,
  HydrationWidget,
  MealSuggestions,
} from '../components/dashboard'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useGamificationStore } from '../stores/gamification-store'
import { useCaloricBankStore } from '../stores/caloric-bank-store'
import { getGreeting, formatNumber } from '../lib/utils'
import type { MealType } from '../types'

const mealConfig: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Petit-dejeuner', icon: '☀️', color: colors.warning },
  lunch: { label: 'Dejeuner', icon: '🍽️', color: colors.accent.primary },
  snack: { label: 'Collation', icon: '🍎', color: colors.success },
  dinner: { label: 'Diner', icon: '🌙', color: colors.secondary.primary },
}

// Mock data for Solde Plaisir (7 days) - will be replaced by caloric-bank-store data
const mockDailyBalances = [
  { day: 'Jeu', date: '25/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Ven', date: '26/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Sam', date: '27/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Dim', date: '28/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Lun', date: '29/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Mar', date: '30/12', consumed: 0, target: 2100, balance: 0 },
  { day: 'Mer', date: '31/12', consumed: 0, target: 2100, balance: 0 },
]

export default function HomeScreen() {
  const navigation = useNavigation()
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData, getMealsByType, currentDate } = useMealsStore()
  const { checkAndUpdateStreak } = useGamificationStore()
  const {
    weekStartDate,
    initializeWeek,
    getCurrentDayIndex,
    getDaysUntilNewWeek,
    isFirstTimeSetup: checkIsFirstTimeSetup,
    confirmStartDay,
  } = useCaloricBankStore()

  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
    initializeWeek()
    checkAndUpdateStreak()
  }, [initializeWeek, checkAndUpdateStreak])

  const todayData = getTodayData()
  const totals = todayData.totalNutrition
  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

  const greeting = getGreeting()
  const userName = profile?.firstName || profile?.name?.split(' ')[0] || 'Utilisateur'

  // Caloric bank data
  const currentDayIndex = isHydrated ? getCurrentDayIndex() : 0
  const daysUntilNewWeek = isHydrated ? getDaysUntilNewWeek() : 7
  const isFirstTimeSetup = isHydrated ? checkIsFirstTimeSetup() : false

  const handleMealPress = (type: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore - Navigation typing
    navigation.navigate('Meals', { screen: 'MealDetail', params: { type } })
  }

  const handleNavigateToAchievements = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('Profile', { screen: 'Achievements' })
  }

  const handleNavigateToWellness = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('Progress', { screen: 'Wellness' })
  }

  const handleNavigateToSport = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('Progress', { screen: 'Sport' })
  }

  const handleNavigateToPlan = () => {
    // @ts-ignore - Navigation typing
    navigation.navigate('WeeklyPlan')
  }

  const handleNavigateToAddMeal = (type: MealType = 'lunch', openDiscover: boolean = false) => {
    // @ts-ignore - Navigation typing
    navigation.navigate('AddMeal', { type, openDiscover })
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
        </View>

        {/* Gamification Panel (compact) */}
        <View style={styles.section}>
          <GamificationPanel compact onViewAll={handleNavigateToAchievements} />
        </View>

        {/* LymIA - Coach proactif */}
        <Card>
          <LymIAWidget />
        </Card>

        {/* Main Calories Card */}
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

            {/* Consumed / Burned */}
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

        {/* Quick Actions */}
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
          <Pressable
            style={styles.planButton}
            onPress={handleNavigateToPlan}
          >
            <View style={styles.planButtonContent}>
              <CalendarRange size={20} color="#10B981" />
              <Sparkles size={12} color="#F59E0B" style={styles.planSparkle} />
            </View>
            <Text style={styles.planButtonText}>Proposition 7j</Text>
          </Pressable>
        </View>

        {/* Hydration Widget */}
        <HydrationWidget
          onPress={() => {
            // @ts-ignore - Navigation typing
            navigation.navigate('Progress', { screen: 'Wellness' })
          }}
        />

        {/* Macros */}
        <Text style={styles.sectionTitle}>Macronutriments</Text>
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

        {/* Meals Overview */}
        <Text style={styles.sectionTitle}>Repas du jour</Text>
        <View style={styles.mealsGrid}>
          {(Object.keys(mealConfig) as MealType[]).map((type) => {
            const config = mealConfig[type]
            const meals = getMealsByType(currentDate, type)
            const totalCalories = meals.reduce(
              (sum, meal) => sum + meal.totalNutrition.calories,
              0
            )

            return (
              <Card
                key={type}
                style={styles.mealCard}
                onPress={() => handleMealPress(type)}
              >
                <Text style={styles.mealIcon}>{config.icon}</Text>
                <Text style={styles.mealLabel}>{config.label}</Text>
                <Text style={[styles.mealCalories, { color: config.color }]}>
                  {totalCalories > 0 ? `${totalCalories} kcal` : 'Non renseigne'}
                </Text>
              </Card>
            )
          })}
        </View>

        {/* Meal Suggestions - right after meals */}
        <View style={styles.section}>
          <MealSuggestions
            onSuggestionPress={(suggestion) => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              Alert.alert(
                suggestion.name,
                `${suggestion.calories} kcal · ${suggestion.prepTime} min\n\nPour ajouter cette recette, utilisez le bouton "Ajouter un repas".`,
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Ajouter un repas',
                    onPress: () => handleNavigateToAddMeal(),
                  },
                ]
              )
            }}
            onViewAll={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              handleNavigateToAddMeal('lunch', true)
            }}
          />
        </View>

        {/* Wellness & Sport Widgets */}
        <Text style={styles.sectionTitle}>Bien-etre & Sport</Text>
        <View style={styles.widgetsGrid}>
          <WellnessWidget onPress={handleNavigateToWellness} />
          <SportWidget onPress={handleNavigateToSport} />
        </View>

        {/* Caloric Balance (Banque calorique) */}
        <Text style={styles.sectionTitle}>Solde Plaisir</Text>
        <CaloricBalance
          dailyBalances={mockDailyBalances}
          currentDay={currentDayIndex}
          daysUntilNewWeek={daysUntilNewWeek}
          weekStartDate={weekStartDate ?? undefined}
          dailyTarget={goals.calories}
          isFirstTimeSetup={isFirstTimeSetup}
          onConfirmStart={confirmStartDay}
        />

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
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
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
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
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
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
    ...typography.bodyMedium,
    color: '#10B981',
    fontWeight: '600',
  },
  macrosCard: {
    marginBottom: spacing.default,
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
  mealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.default,
  },
  mealCard: {
    width: '48%',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  mealIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  mealLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  mealCalories: {
    ...typography.caption,
  },
  widgetsGrid: {
    gap: spacing.md,
    marginBottom: spacing.default,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
})
