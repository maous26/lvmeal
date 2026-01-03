/**
 * Goal Card Component
 *
 * Displays a selectable goal option in onboarding.
 * Only 3 goals visible to users: weight_loss, muscle_gain, health
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../../constants/theme'
import type { VisibleGoal } from '../types'

interface GoalCardProps {
  goal: VisibleGoal
  isSelected: boolean
  onSelect: () => void
}

const GOAL_CONFIG: Record<VisibleGoal, {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  description: string
  badge?: string
}> = {
  weight_loss: {
    icon: 'trending-down-outline',
    title: 'Perdre du poids',
    description: 'Un deficit progressif et sain, a ton rythme',
    badge: '-300 a -500 kcal',
  },
  muscle_gain: {
    icon: 'barbell-outline',
    title: 'Prendre du muscle',
    description: 'Surplus controle pour construire du muscle',
    badge: '+200 a +400 kcal',
  },
  health: {
    icon: 'heart-outline',
    title: 'Ameliorer ma sante',
    description: 'Des reperes simples pour te sentir mieux',
  },
}

export function GoalCard({ goal, isSelected, onSelect }: GoalCardProps) {
  const { colors } = useTheme()
  const config = GOAL_CONFIG[goal]

  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? colors.accent.light : colors.bg.elevated,
          borderColor: isSelected ? colors.accent.primary : colors.border.light,
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
          name={config.icon}
          size={24}
          color={isSelected ? '#FFFFFF' : colors.text.secondary}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: isSelected ? colors.accent.primary : colors.text.primary },
            ]}
          >
            {config.title}
          </Text>
          {config.badge && (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isSelected ? colors.accent.primary : colors.bg.tertiary,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: isSelected ? '#FFFFFF' : colors.text.tertiary },
                ]}
              >
                {config.badge}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          {config.description}
        </Text>
      </View>

      <View
        style={[
          styles.radio,
          {
            borderColor: isSelected ? colors.accent.primary : colors.border.default,
            backgroundColor: isSelected ? colors.accent.primary : 'transparent',
          },
        ]}
      >
        {isSelected && <View style={styles.radioDot} />}
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
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.default,
  },
  content: {
    flex: 1,
    marginRight: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.bodySemibold,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '500',
  },
  description: {
    ...typography.small,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
})

export default GoalCard
