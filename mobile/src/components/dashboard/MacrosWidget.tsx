/**
 * MacrosWidget - Professional-grade macronutrients tracking widget
 *
 * Features:
 * - Clean, minimal design
 * - Animated progress bars with gradient
 * - Clear percentage indicators
 * - Compact horizontal layout
 */

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'
import { colors, spacing, typography, radius, shadows } from '../../constants/theme'

interface MacroData {
  value: number
  max: number
}

interface MacrosWidgetProps {
  proteins: MacroData
  carbs: MacroData
  fats: MacroData
}

function AnimatedProgressBar({
  value,
  max,
  colors: gradientColors,
  height = 8,
}: {
  value: number
  max: number
  colors: [string, string]
  height?: number
}) {
  const percentage = Math.min((value / max) * 100, 100)
  const width = 100

  return (
    <View style={{ width: '100%', height, borderRadius: height / 2, overflow: 'hidden', backgroundColor: colors.bg.tertiary }}>
      <Svg width="100%" height={height}>
        <Defs>
          <SvgGradient id={`gradient-${gradientColors[0]}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity={1} />
            <Stop offset="100%" stopColor={gradientColors[1]} stopOpacity={1} />
          </SvgGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width={`${percentage}%`}
          height={height}
          fill={`url(#gradient-${gradientColors[0]})`}
          rx={height / 2}
        />
      </Svg>
    </View>
  )
}

function MacroRow({
  label,
  value,
  max,
  unit,
  gradientColors,
  icon,
  delay = 0,
}: {
  label: string
  value: number
  max: number
  unit: string
  gradientColors: [string, string]
  icon: string
  delay?: number
}) {
  const percentage = Math.round(Math.min((value / max) * 100, 100))
  const remaining = Math.max(0, max - value)

  // Staggered animation
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(20)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }, [])

  return (
    <Animated.View
      style={[
        styles.macroRow,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.macroHeader}>
        <View style={styles.macroLabelRow}>
          <Text style={styles.macroIcon}>{icon}</Text>
          <Text style={styles.macroLabel}>{label}</Text>
        </View>
        <Text style={styles.macroPercentage}>{percentage}%</Text>
      </View>

      <AnimatedProgressBar
        value={value}
        max={max}
        colors={gradientColors}
        height={6}
      />

      <View style={styles.macroValues}>
        <Text style={[styles.macroValue, { color: gradientColors[0] }]}>
          {value}{unit}
        </Text>
        <Text style={styles.macroRemaining}>
          {remaining}{unit} restant
        </Text>
      </View>
    </Animated.View>
  )
}

export default function MacrosWidget({ proteins, carbs, fats }: MacrosWidgetProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Macronutriments</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalText}>
            {proteins.value + carbs.value + fats.value}g / {proteins.max + carbs.max + fats.max}g
          </Text>
        </View>
      </View>

      {/* Macros - Organic Luxury gradients with staggered animation */}
      <View style={styles.macrosContainer}>
        <MacroRow
          label="Proteines"
          value={proteins.value}
          max={proteins.max}
          unit="g"
          gradientColors={['#7A9E7E', '#8BAF8F']}  // Sage green
          icon="🥩"
          delay={0}
        />

        <MacroRow
          label="Glucides"
          value={carbs.value}
          max={carbs.max}
          unit="g"
          gradientColors={['#D4A574', '#DEB88A']}  // Warm caramel
          icon="🌾"
          delay={100}
        />

        <MacroRow
          label="Lipides"
          value={fats.value}
          max={fats.max}
          unit="g"
          gradientColors={['#9B8BB8', '#AD9ECF']}  // Soft lavender
          icon="🥑"
          delay={200}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  totalBadge: {
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  totalText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  macrosContainer: {
    gap: spacing.lg,
  },
  macroRow: {
    gap: spacing.sm,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  macroIcon: {
    fontSize: 14,
  },
  macroLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  macroPercentage: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  macroValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroValue: {
    ...typography.caption,
    fontWeight: '600',
  },
  macroRemaining: {
    ...typography.caption,
    color: colors.text.muted,
  },
})
