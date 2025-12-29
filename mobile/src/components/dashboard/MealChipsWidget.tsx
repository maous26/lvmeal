/**
 * MealChipsWidget - Professional meal type selector
 *
 * Features:
 * - Modern pill design
 * - Clear active/inactive states
 * - Calorie badges when data exists
 * - Smooth tap interactions
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { Plus, Check } from 'lucide-react-native'
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
}

const mealConfig: Record<MealType, { label: string; icon: string; time: string }> = {
  breakfast: { label: 'Petit-dej', icon: '☀️', time: '7h-10h' },
  lunch: { label: 'Dejeuner', icon: '🍽️', time: '12h-14h' },
  snack: { label: 'Collation', icon: '🍎', time: '16h-17h' },
  dinner: { label: 'Diner', icon: '🌙', time: '19h-21h' },
}

function MealChip({
  type,
  calories,
  mealsCount,
  onPress,
}: {
  type: MealType
  calories: number
  mealsCount: number
  onPress: () => void
}) {
  const config = mealConfig[type]
  const hasData = calories > 0

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        hasData && styles.chipFilled,
        pressed && styles.chipPressed,
      ]}
      onPress={handlePress}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, hasData && styles.iconContainerFilled]}>
        <Text style={styles.icon}>{config.icon}</Text>
      </View>

      {/* Content */}
      <View style={styles.chipContent}>
        <Text style={[styles.chipLabel, hasData && styles.chipLabelFilled]}>
          {config.label}
        </Text>
        {hasData ? (
          <Text style={styles.chipCalories}>{calories} kcal</Text>
        ) : (
          <Text style={styles.chipTime}>{config.time}</Text>
        )}
      </View>

      {/* Status indicator */}
      <View style={[styles.statusIndicator, hasData && styles.statusIndicatorFilled]}>
        {hasData ? (
          <Check size={12} color="#FFFFFF" strokeWidth={3} />
        ) : (
          <Plus size={12} color={colors.text.muted} strokeWidth={2} />
        )}
      </View>
    </Pressable>
  )
}

export default function MealChipsWidget({ meals, onMealPress }: MealChipsWidgetProps) {
  const getMealData = (type: MealType): MealData => {
    return meals.find(m => m.type === type) || { type, calories: 0, mealsCount: 0 }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tes repas du jour</Text>
      <View style={styles.chipsContainer}>
        <View style={styles.chipsRow}>
          <MealChip
            type="breakfast"
            calories={getMealData('breakfast').calories}
            mealsCount={getMealData('breakfast').mealsCount}
            onPress={() => onMealPress('breakfast')}
          />
          <MealChip
            type="lunch"
            calories={getMealData('lunch').calories}
            mealsCount={getMealData('lunch').mealsCount}
            onPress={() => onMealPress('lunch')}
          />
        </View>
        <View style={styles.chipsRow}>
          <MealChip
            type="snack"
            calories={getMealData('snack').calories}
            mealsCount={getMealData('snack').mealsCount}
            onPress={() => onMealPress('snack')}
          />
          <MealChip
            type="dinner"
            calories={getMealData('dinner').calories}
            mealsCount={getMealData('dinner').mealsCount}
            onPress={() => onMealPress('dinner')}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  },
  title: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  chipsContainer: {
    gap: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.sm,
    ...shadows.xs,
  },
  chipFilled: {
    backgroundColor: colors.accent.light,
    borderColor: colors.accent.primary + '40',
  },
  chipPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerFilled: {
    backgroundColor: colors.accent.primary + '20',
  },
  icon: {
    fontSize: 18,
  },
  chipContent: {
    flex: 1,
  },
  chipLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  chipLabelFilled: {
    color: colors.accent.primary,
  },
  chipTime: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  chipCalories: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  statusIndicator: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicatorFilled: {
    backgroundColor: colors.success,
  },
})
