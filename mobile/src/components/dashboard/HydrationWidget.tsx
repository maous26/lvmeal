import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native'
import { Droplets, Plus, Minus, ChevronRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useMealsStore } from '../../stores/meals-store'

interface HydrationWidgetProps {
  onPress?: () => void
}

const WATER_AMOUNTS = [150, 250, 330, 500]

export function HydrationWidget({ onPress }: HydrationWidgetProps) {
  const { getTodayData, updateWaterIntake } = useMealsStore()
  const todayData = getTodayData()

  const currentMl = todayData.hydration
  const targetMl = 2500
  const currentL = currentMl / 1000
  const targetL = targetMl / 1000
  const percentage = Math.min((currentMl / targetMl) * 100, 100)

  const handleAddWater = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    updateWaterIntake(amount)
  }

  const handleRemoveWater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    updateWaterIntake(-250)
  }

  // Get encouraging message based on progress
  const getMessage = () => {
    if (percentage >= 100) return { text: 'Objectif atteint !', emoji: '🎉' }
    if (percentage >= 75) return { text: 'Presque !', emoji: '💪' }
    if (percentage >= 50) return { text: 'Bien parti !', emoji: '👍' }
    if (percentage >= 25) return { text: 'Continue !', emoji: '💧' }
    return { text: 'Reste hydrate !', emoji: '🌊' }
  }

  const message = getMessage()

  // Calculate glasses (250ml each)
  const glassesConsumed = Math.floor(currentMl / 250)
  const glassesTarget = Math.ceil(targetMl / 250)

  return (
    <Card style={styles.card}>
      <Pressable onPress={onPress} style={styles.pressable}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Droplets size={20} color="#06B6D4" />
            </View>
            <View>
              <Text style={styles.title}>Hydratation</Text>
              <Text style={styles.subtitle}>{message.emoji} {message.text}</Text>
            </View>
          </View>
          <ChevronRight size={20} color={colors.text.tertiary} />
        </View>

        {/* Main Display */}
        <View style={styles.mainDisplay}>
          <View style={styles.valueContainer}>
            <Text style={styles.currentValue}>{currentL.toFixed(1)}</Text>
            <Text style={styles.targetValue}>/ {targetL}L</Text>
          </View>

          {/* Glasses visualization */}
          <View style={styles.glassesRow}>
            {Array.from({ length: Math.min(glassesTarget, 10) }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.glass,
                  i < glassesConsumed && styles.glassFilled,
                ]}
              >
                <Text style={styles.glassEmoji}>
                  {i < glassesConsumed ? '💧' : '○'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Progress Bar */}
        <ProgressBar
          value={currentMl}
          max={targetMl}
          color="#06B6D4"
          size="md"
          style={styles.progressBar}
        />
      </Pressable>

      {/* Quick Add Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemoveWater}
          disabled={currentMl <= 0}
        >
          <Minus size={16} color={currentMl > 0 ? colors.text.secondary : colors.text.muted} />
        </TouchableOpacity>

        <View style={styles.addButtonsRow}>
          {WATER_AMOUNTS.map((amount) => (
            <TouchableOpacity
              key={amount}
              style={styles.addButton}
              onPress={() => handleAddWater(amount)}
              activeOpacity={0.7}
            >
              <Plus size={12} color="#06B6D4" />
              <Text style={styles.addButtonText}>{amount}ml</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  pressable: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  mainDisplay: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  currentValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#06B6D4',
  },
  targetValue: {
    ...typography.body,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
  glassesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
  },
  glass: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassFilled: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  glassEmoji: {
    fontSize: 14,
  },
  progressBar: {
    marginTop: spacing.sm,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.2)',
  },
  addButtonText: {
    ...typography.caption,
    color: '#06B6D4',
    fontWeight: '600',
  },
})

export default HydrationWidget
