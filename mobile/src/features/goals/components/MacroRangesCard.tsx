/**
 * Macro Ranges Card Component
 *
 * Displays macros as ranges ("zone de confort"), not targets.
 * No judgment, no scores, no good/bad.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../../constants/theme'
import type { NutritionRanges } from '../types'
import { checkRangePosition, type WeeklySummary } from '../services/nutrition-insights'

interface MacroRangesCardProps {
  ranges: NutritionRanges
  summary: WeeklySummary
}

interface MacroRowProps {
  label: string
  value: number
  min: number
  max: number
  unit: string
  colors: ReturnType<typeof useTheme>['colors']
}

function MacroRow({ label, value, min, max, unit, colors }: MacroRowProps) {
  const position = checkRangePosition(value, { min, max, unit: unit as 'g' | 'kcal' })

  // Calculate progress percentage for visual bar
  const range = max - min
  const midpoint = min + range / 2
  const normalizedValue = Math.max(min - range * 0.2, Math.min(max + range * 0.2, value))
  const progressPercent = ((normalizedValue - (min - range * 0.2)) / (range * 1.4)) * 100

  // Position color (subtle, no judgment)
  const positionColor =
    position === 'within' ? '#10B981' : position === 'below' ? '#F59E0B' : '#F59E0B'

  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeader}>
        <Text style={[styles.macroLabel, { color: colors.text.primary }]}>{label}</Text>
        <Text style={[styles.macroValue, { color: colors.text.primary }]}>
          {value}
          <Text style={[styles.macroUnit, { color: colors.text.tertiary }]}> {unit}</Text>
        </Text>
      </View>

      {/* Range bar */}
      <View style={[styles.rangeBar, { backgroundColor: colors.bg.secondary }]}>
        {/* Zone de confort indicator */}
        <View
          style={[
            styles.comfortZone,
            {
              left: `${20}%`,
              width: `${60}%`,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
            },
          ]}
        />
        {/* Value indicator */}
        <View
          style={[
            styles.valueIndicator,
            {
              left: `${progressPercent}%`,
              backgroundColor: positionColor,
            },
          ]}
        />
      </View>

      {/* Range labels */}
      <View style={styles.rangeLabels}>
        <Text style={[styles.rangeLabel, { color: colors.text.tertiary }]}>
          {min} {unit}
        </Text>
        <Text style={[styles.rangeLabel, { color: colors.text.tertiary }]}>
          {max} {unit}
        </Text>
      </View>
    </View>
  )
}

export function MacroRangesCard({ ranges, summary }: MacroRangesCardProps) {
  const { colors } = useTheme()

  if (summary.daysWithData < 2) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
        ]}
      >
        <View style={styles.header}>
          <Ionicons name="pie-chart-outline" size={20} color={colors.accent.primary} />
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Reperes de la semaine
          </Text>
        </View>
        <Text style={[styles.noDataText, { color: colors.text.secondary }]}>
          Pas encore assez de donnees cette semaine.
        </Text>
      </View>
    )
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="pie-chart-outline" size={20} color={colors.accent.primary} />
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Reperes de la semaine
        </Text>
      </View>

      {/* Explanation */}
      <Text style={[styles.explanation, { color: colors.text.secondary }]}>
        Moyennes sur {summary.daysWithData} jours. La zone verte est ta zone de confort.
      </Text>

      {/* Macros */}
      <View style={styles.macros}>
        <MacroRow
          label="Calories"
          value={summary.avgCalories}
          min={ranges.calories.min}
          max={ranges.calories.max}
          unit="kcal"
          colors={colors}
        />
        <MacroRow
          label="Proteines"
          value={summary.avgProteins}
          min={ranges.proteins.min}
          max={ranges.proteins.max}
          unit="g"
          colors={colors}
        />
        <MacroRow
          label="Glucides"
          value={summary.avgCarbs}
          min={ranges.carbs.min}
          max={ranges.carbs.max}
          unit="g"
          colors={colors}
        />
        <MacroRow
          label="Lipides"
          value={summary.avgFats}
          min={ranges.fats.min}
          max={ranges.fats.max}
          unit="g"
          colors={colors}
        />
        <MacroRow
          label="Fibres"
          value={summary.avgFiber}
          min={ranges.fiber.min}
          max={ranges.fiber.max}
          unit="g"
          colors={colors}
        />
      </View>

      {/* Disclaimer */}
      <Text style={[styles.disclaimer, { color: colors.text.tertiary }]}>
        Ces reperes sont indicatifs, pas des objectifs stricts.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.bodySemibold,
  },
  explanation: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  noDataText: {
    ...typography.body,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  macros: {
    gap: spacing.md,
  },
  macroRow: {
    marginBottom: spacing.sm,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  macroLabel: {
    ...typography.body,
  },
  macroValue: {
    ...typography.bodySemibold,
  },
  macroUnit: {
    ...typography.small,
  },
  rangeBar: {
    height: 8,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  comfortZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  valueIndicator: {
    position: 'absolute',
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rangeLabel: {
    ...typography.caption,
  },
  disclaimer: {
    ...typography.caption,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
  },
})

export default MacroRangesCard
