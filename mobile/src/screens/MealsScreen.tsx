import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { ChevronLeft, ChevronRight, Plus, Clock, Trash2, X } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { Alert } from 'react-native'

import { Card, Button, ProgressBar } from '../components/ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { formatNumber, getRelativeDate, getDateKey } from '../lib/utils'
import type { MealType, Meal } from '../types'

const mealConfig: Record<MealType, { label: string; icon: string; color: string }> = {
  breakfast: { label: 'Petit-déjeuner', icon: '☀️', color: colors.warning },
  lunch: { label: 'Déjeuner', icon: '🍽️', color: colors.accent.primary },
  snack: { label: 'Collation', icon: '🍎', color: colors.success },
  dinner: { label: 'Dîner', icon: '🌙', color: colors.secondary.primary },
}

const mealOrder: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

export default function MealsScreen() {
  const navigation = useNavigation()
  const { nutritionGoals } = useUserStore()
  const { currentDate, setCurrentDate, getTodayData, getMealsByType, removeItemFromMeal } = useMealsStore()

  // Track expanded meal cards
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set())

  const todayData = getTodayData()
  const totals = todayData.totalNutrition
  const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

  const changeDate = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const current = new Date(currentDate)
    current.setDate(current.getDate() + delta)
    setCurrentDate(getDateKey(current))
  }

  const handleAddMeal = (type: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    // @ts-ignore - Navigation typing - Navigate to root AddMeal screen
    navigation.getParent()?.navigate('AddMeal', { type })
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

  const toggleMealExpanded = (mealType: MealType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setExpandedMeals(prev => {
      const next = new Set(prev)
      if (next.has(mealType)) {
        next.delete(mealType)
      } else {
        next.add(mealType)
      }
      return next
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Repas</Text>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateButton}>
          <ChevronLeft size={24} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={styles.dateText}>{getRelativeDate(currentDate)}</Text>
        <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateButton}>
          <ChevronRight size={24} color={colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {/* Daily Summary */}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Consommé</Text>
            <Text style={[styles.summaryValue, { color: colors.nutrients.calories }]}>
              {formatNumber(totals.calories)}
            </Text>
            <Text style={styles.summaryUnit}>kcal</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Restant</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatNumber(Math.max(0, goals.calories - totals.calories))}
            </Text>
            <Text style={styles.summaryUnit}>kcal</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Objectif</Text>
            <Text style={[styles.summaryValue, { color: colors.text.primary }]}>
              {formatNumber(goals.calories)}
            </Text>
            <Text style={styles.summaryUnit}>kcal</Text>
          </View>
        </View>
        <ProgressBar
          value={totals.calories}
          max={goals.calories}
          color={colors.accent.primary}
          style={styles.summaryProgress}
        />
      </Card>

      {/* Meals List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {mealOrder.map((type) => {
          const config = mealConfig[type]
          const meals = getMealsByType(currentDate, type)
          const totalCalories = meals.reduce(
            (sum, meal) => sum + meal.totalNutrition.calories,
            0
          )
          const hasMeals = meals.length > 0

          return (
            <Card key={type} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealIcon}>{config.icon}</Text>
                  <View>
                    <Text style={styles.mealLabel}>{config.label}</Text>
                    {hasMeals && (
                      <Text style={styles.mealItems}>
                        {meals.reduce((sum, m) => sum + m.items.length, 0)} aliments
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.mealRight}>
                  {hasMeals ? (
                    <Text style={[styles.mealCalories, { color: config.color }]}>
                      {formatNumber(totalCalories)} kcal
                    </Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addButton, { backgroundColor: `${config.color}15` }]}
                      onPress={() => handleAddMeal(type)}
                    >
                      <Plus size={20} color={config.color} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {hasMeals && (
                <View style={styles.mealContent}>
                  {meals.map((meal) => {
                    const isExpanded = expandedMeals.has(type)
                    const itemsToShow = isExpanded ? meal.items : meal.items.slice(0, 3)
                    const hasMoreItems = meal.items.length > 3

                    return (
                      <View key={meal.id} style={styles.mealItemsList}>
                        {itemsToShow.map((item) => (
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
                              <X size={16} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        ))}
                        {hasMoreItems && !isExpanded && (
                          <TouchableOpacity
                            style={styles.showMoreButton}
                            onPress={() => toggleMealExpanded(type)}
                          >
                            <Text style={styles.showMoreText}>
                              Voir {meal.items.length - 3} autres aliments
                            </Text>
                          </TouchableOpacity>
                        )}
                        {hasMoreItems && isExpanded && (
                          <TouchableOpacity
                            style={styles.showMoreButton}
                            onPress={() => toggleMealExpanded(type)}
                          >
                            <Text style={styles.showMoreText}>Voir moins</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )
                  })}
                  <TouchableOpacity
                    style={styles.addMoreButton}
                    onPress={() => handleAddMeal(type)}
                  >
                    <Plus size={16} color={colors.accent.primary} />
                    <Text style={styles.addMoreText}>Ajouter un aliment</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    padding: spacing.default,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.default,
    paddingBottom: spacing.default,
  },
  dateButton: {
    padding: spacing.sm,
  },
  dateText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginHorizontal: spacing.lg,
  },
  summaryCard: {
    marginHorizontal: spacing.default,
    marginBottom: spacing.default,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  summaryValue: {
    ...typography.h4,
    fontWeight: '700',
  },
  summaryUnit: {
    ...typography.caption,
    color: colors.text.muted,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  summaryProgress: {
    marginTop: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.default,
    paddingTop: 0,
    paddingBottom: spacing['3xl'],
  },
  mealCard: {
    marginBottom: spacing.md,
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
  mealIcon: {
    fontSize: 32,
  },
  mealLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  mealItems: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  mealRight: {
    alignItems: 'flex-end',
  },
  mealCalories: {
    ...typography.bodySemibold,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  mealItemsList: {
    marginBottom: spacing.sm,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginVertical: 2,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.sm,
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
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing.md,
  },
  foodCalories: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
  },
  deleteItemButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: `${colors.error}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showMoreButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  showMoreText: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '500',
  },
  moreItems: {
    ...typography.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.accent.light,
    borderRadius: radius.md,
  },
  addMoreText: {
    ...typography.smallMedium,
    color: colors.accent.primary,
  },
})
