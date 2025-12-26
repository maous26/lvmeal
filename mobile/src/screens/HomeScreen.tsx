import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { Droplets, Plus, Flame, Dumbbell, Apple } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, CircularProgress, ProgressBar, Button } from '../components/ui'
import { colors, spacing, typography, radius, shadows } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { getGreeting, formatNumber } from '../lib/utils'
import type { MealType } from '../types'

const mealConfig: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Petit-déjeuner', icon: '☀️', color: colors.warning },
  lunch: { label: 'Déjeuner', icon: '🍽️', color: colors.accent.primary },
  snack: { label: 'Collation', icon: '🍎', color: colors.success },
  dinner: { label: 'Dîner', icon: '🌙', color: colors.secondary.primary },
}

export default function HomeScreen() {
  const navigation = useNavigation()
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData, updateWaterIntake, getMealsByType, currentDate } = useMealsStore()

  const todayData = getTodayData()
  const totals = todayData.totalNutrition
  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

  const greeting = getGreeting()
  const userName = profile?.name?.split(' ')[0] || 'Utilisateur'

  const handleAddWater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    updateWaterIntake(0.25)
  }

  const handleMealPress = (type: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore - Navigation typing
    navigation.navigate('Meals', { screen: 'MealDetail', params: { type } })
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
                  {formatNumber(totals.calories)} consommées
                </Text>
              </View>
              <View style={styles.calorieStat}>
                <Dumbbell size={16} color="#FFFFFF" />
                <Text style={styles.calorieStatText}>0 brûlées</Text>
              </View>
            </View>
          </LinearGradient>
        </Card>

        {/* Macros */}
        <Text style={styles.sectionTitle}>Macronutriments</Text>
        <Card style={styles.macrosCard}>
          <View style={styles.macrosRow}>
            <MacroItem
              label="Protéines"
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

        {/* Water Intake */}
        <Text style={styles.sectionTitle}>Hydratation</Text>
        <Card style={styles.waterCard}>
          <View style={styles.waterContent}>
            <View style={styles.waterInfo}>
              <View style={styles.waterIcon}>
                <Droplets size={24} color={colors.nutrients.water} />
              </View>
              <View>
                <Text style={styles.waterValue}>
                  {todayData.waterIntake.toFixed(1)}L
                </Text>
                <Text style={styles.waterGoal}>/ 2.5L</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.waterButton}
              onPress={handleAddWater}
              activeOpacity={0.8}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.waterButtonText}>250ml</Text>
            </TouchableOpacity>
          </View>
          <ProgressBar
            value={todayData.waterIntake}
            max={2.5}
            color={colors.nutrients.water}
            style={styles.waterProgress}
          />
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
                  {totalCalories > 0 ? `${totalCalories} kcal` : 'Non renseigné'}
                </Text>
              </Card>
            )
          })}
        </View>
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
  mainCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
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
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
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
  waterCard: {
    marginBottom: spacing.default,
  },
  waterContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  waterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  waterIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: `${colors.nutrients.water}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waterValue: {
    ...typography.h4,
    color: colors.text.primary,
  },
  waterGoal: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  waterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.nutrients.water,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  waterButtonText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  waterProgress: {
    marginTop: spacing.xs,
  },
  mealsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
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
})
