import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native'
import { Droplets, Plus, Minus, ChevronRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { useTheme } from '../../contexts/ThemeContext'
import { radius, spacing, typography, componentSizes, fonts } from '../../constants/theme'
import { useMealsStore } from '../../stores/meals-store'

interface HydrationWidgetProps {
  onPress?: () => void
}

const WATER_AMOUNTS = [150, 250, 330, 500]

export function HydrationWidget({ onPress }: HydrationWidgetProps) {
  const { colors } = useTheme()
  const { getTodayData, updateWaterIntake } = useMealsStore()
  const todayData = getTodayData()

  const waterColor = colors.nutrients.water
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
    return { text: 'Reste hydraté !', emoji: '🌊' }
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
            <View style={[styles.iconContainer, { backgroundColor: `${waterColor}20` }]}>
              <Droplets size={20} color={waterColor} />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.text.primary }]}>Hydratation</Text>
              <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>{message.emoji} {message.text}</Text>
            </View>
          </View>
          <ChevronRight size={20} color={colors.text.tertiary} />
        </View>

        {/* Main Display */}
        <View style={styles.mainDisplay}>
          <View style={styles.valueContainer}>
            <Text style={[styles.currentValue, { color: waterColor }]}>{currentL.toFixed(1)}</Text>
            <Text style={[styles.targetValue, { color: colors.text.tertiary }]}>/ {targetL}L</Text>
          </View>

          {/* Glasses visualization */}
          <View style={styles.glassesRow}>
            {Array.from({ length: Math.min(glassesTarget, 10) }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.glass,
                  i < glassesConsumed && { backgroundColor: `${waterColor}15` },
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
          color={waterColor}
          size="md"
          style={styles.progressBar}
        />
      </Pressable>

      {/* Quick Add Buttons */}
      <View style={[styles.actionsContainer, { borderTopColor: colors.border.light }]}>
        <TouchableOpacity
          style={[styles.removeButton, { backgroundColor: colors.bg.tertiary }]}
          onPress={handleRemoveWater}
          disabled={currentMl <= 0}
        >
          <Minus size={16} color={currentMl > 0 ? colors.text.secondary : colors.text.muted} />
        </TouchableOpacity>

        <View style={styles.addButtonsRow}>
          {WATER_AMOUNTS.map((amount) => (
            <TouchableOpacity
              key={amount}
              style={[
                styles.addButton,
                {
                  backgroundColor: `${waterColor}15`,
                  borderColor: `${waterColor}30`,
                },
              ]}
              onPress={() => handleAddWater(amount)}
              activeOpacity={0.7}
            >
              <Plus size={12} color={waterColor} />
              <Text style={[styles.addButtonText, { color: waterColor }]}>{amount}ml</Text>
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
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.bodyMedium,
  },
  subtitle: {
    ...typography.caption,
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
    fontSize: typography.display.fontSize,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
  },
  targetValue: {
    ...typography.body,
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
  glassEmoji: {
    fontSize: typography.small.fontSize,
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
  },
  removeButton: {
    width: componentSizes.avatar.sm,
    height: componentSizes.avatar.sm,
    borderRadius: radius.md,
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
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  addButtonText: {
    ...typography.caption,
    fontWeight: '600',
  },
})

export default HydrationWidget
