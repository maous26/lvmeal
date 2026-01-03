/**
 * Routine Equilibre Toggle Component
 *
 * Optional toggle for the "Routine Equilibre" (ex-Metabolic Boost).
 * Displayed at the end of health priorities selection.
 */

import React from 'react'
import { View, Text, StyleSheet, Switch, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../../constants/theme'

interface RoutineEquilibreToggleProps {
  enabled: boolean
  onToggle: (value: boolean) => void
}

export function RoutineEquilibreToggle({ enabled, onToggle }: RoutineEquilibreToggleProps) {
  const { colors } = useTheme()

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: enabled ? 'rgba(168, 85, 247, 0.1)' : colors.bg.elevated,
          borderColor: enabled ? 'rgba(168, 85, 247, 0.3)' : colors.border.light,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons
            name="sparkles-outline"
            size={20}
            color={enabled ? colors.accent.primary : colors.text.secondary}
          />
        </View>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Routine Equilibre
          </Text>
          <Text style={[styles.optional, { color: colors.text.tertiary }]}>
            Optionnel
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.border.default, true: colors.accent.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      <Text style={[styles.description, { color: colors.text.secondary }]}>
        Des reperes simples pour le quotidien. Sans pression.
      </Text>

      {enabled && (
        <View style={styles.pillars}>
          <PillarItem icon="restaurant-outline" text="Manger a ta faim" colors={colors} />
          <PillarItem icon="walk-outline" text="Marcher 20-30 min" colors={colors} />
          <PillarItem icon="moon-outline" text="Dormir 7-8h" colors={colors} />
          <PillarItem icon="water-outline" text="Boire ~2L d'eau" colors={colors} />
        </View>
      )}
    </View>
  )
}

function PillarItem({
  icon,
  text,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap
  text: string
  colors: ReturnType<typeof useTheme>['colors']
}) {
  return (
    <View style={styles.pillarItem}>
      <Ionicons name={icon} size={14} color={colors.accent.primary} />
      <Text style={[styles.pillarText, { color: colors.text.secondary }]}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.bodySemibold,
  },
  optional: {
    ...typography.caption,
    fontStyle: 'italic',
  },
  description: {
    ...typography.small,
    marginBottom: spacing.sm,
  },
  pillars: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168, 85, 247, 0.2)',
  },
  pillarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  pillarText: {
    ...typography.small,
  },
})

export default RoutineEquilibreToggle
