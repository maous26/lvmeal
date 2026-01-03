/**
 * Health Priority Card Component
 *
 * Selectable card for health priorities (max 2-3).
 * Used when user selects "Ameliorer ma sante".
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../../constants/theme'
import type { HealthPriority } from '../types'
import { HEALTH_PRIORITY_LABELS } from '../types'

interface HealthPriorityCardProps {
  priority: HealthPriority
  isSelected: boolean
  onToggle: () => void
  disabled?: boolean
}

const PRIORITY_ICONS: Record<HealthPriority, keyof typeof Ionicons.glyphMap> = {
  better_eating: 'nutrition-outline',
  more_energy: 'flash-outline',
  stress: 'leaf-outline',
}

export function HealthPriorityCard({
  priority,
  isSelected,
  onToggle,
  disabled = false,
}: HealthPriorityCardProps) {
  const { colors } = useTheme()
  const labels = HEALTH_PRIORITY_LABELS[priority]

  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled && !isSelected}
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? colors.accent.light : colors.bg.elevated,
          borderColor: isSelected ? colors.accent.primary : colors.border.light,
          opacity: disabled && !isSelected ? 0.5 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isSelected ? colors.accent.primary : colors.bg.secondary,
          },
        ]}
      >
        <Ionicons
          name={PRIORITY_ICONS[priority]}
          size={22}
          color={isSelected ? '#FFFFFF' : colors.text.secondary}
        />
      </View>

      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: isSelected ? colors.accent.primary : colors.text.primary },
          ]}
        >
          {labels.title}
        </Text>
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          {labels.description}
        </Text>
      </View>

      <View
        style={[
          styles.checkbox,
          {
            borderColor: isSelected ? colors.accent.primary : colors.border.default,
            backgroundColor: isSelected ? colors.accent.primary : 'transparent',
          },
        ]}
      >
        {isSelected && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 2,
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.default,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.bodySemibold,
    marginBottom: 2,
  },
  description: {
    ...typography.small,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default HealthPriorityCard
