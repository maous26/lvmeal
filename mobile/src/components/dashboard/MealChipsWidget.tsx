/**
 * MealChipsWidget - Single button to navigate to Meals screen
 *
 * Simplified: One button "Elabore tes repas" with summary of today's meals
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { ChevronRight, Utensils } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, typography, radius, shadows } from '../../constants/theme'
import type { MealType } from '../../types'

interface MealData {
  type: MealType
  calories: number
  mealsCount: number
}

interface MealChipsWidgetProps {
  meals: MealData[]
  onMealPress: (type: MealType) => void
  onNavigateToMeals?: () => void
}

const mealIcons: Record<MealType, string> = {
  breakfast: '☀️',
  lunch: '🍽️',
  snack: '🍎',
  dinner: '🌙',
}

export default function MealChipsWidget({ meals, onMealPress, onNavigateToMeals }: MealChipsWidgetProps) {
  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0)
  const filledMeals = meals.filter(m => m.calories > 0)
  const filledCount = filledMeals.length

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (onNavigateToMeals) {
      onNavigateToMeals()
    } else {
      // Fallback: navigate to first unfilled meal or lunch by default
      const unfilledMeal = meals.find(m => m.calories === 0)
      onMealPress(unfilledMeal?.type || 'lunch')
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.iconContainer}>
        <Utensils size={22} color={colors.accent.primary} />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Élabore tes repas</Text>
        <View style={styles.summaryRow}>
          {filledCount > 0 ? (
            <>
              <View style={styles.mealsIcons}>
                {filledMeals.slice(0, 4).map((meal) => (
                  <Text key={meal.type} style={styles.mealIcon}>
                    {mealIcons[meal.type]}
                  </Text>
                ))}
              </View>
              <Text style={styles.summaryText}>
                {filledCount}/4 repas · {totalCalories} kcal
              </Text>
            </>
          ) : (
            <Text style={styles.summaryTextEmpty}>
              Aucun repas enregistré
            </Text>
          )}
        </View>
      </View>

      <ChevronRight size={20} color={colors.text.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.md,
    marginTop: spacing.sm,
    ...shadows.xs,
  },
  containerPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mealsIcons: {
    flexDirection: 'row',
    gap: 2,
  },
  mealIcon: {
    fontSize: 14,
  },
  summaryText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  summaryTextEmpty: {
    ...typography.caption,
    color: colors.text.muted,
  },
})
