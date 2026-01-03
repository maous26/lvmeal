/**
 * Step Goal (New) - Onboarding Component
 *
 * Displays only 3 visible goals to users:
 * - Perdre du poids (weight_loss)
 * - Prendre du muscle (muscle_gain)
 * - Ameliorer ma sante (health)
 *
 * Internal goals (maintenance, energy) are mapped:
 * - energy -> redirected to health with "more_energy" priority
 * - maintenance -> treated as health with implicit "better_eating"
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../constants/theme'
import { GoalCard } from '../../features/goals/components'
import type { Goal, UserProfile } from '../../types'
import type { VisibleGoal } from '../../features/goals/types'

interface StepGoalNewProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

/**
 * Map internal goal to visible goal
 */
function getVisibleGoal(goal?: Goal): VisibleGoal | undefined {
  if (!goal) return undefined

  switch (goal) {
    case 'weight_loss':
      return 'weight_loss'
    case 'muscle_gain':
      return 'muscle_gain'
    case 'health':
    case 'energy':
    case 'maintenance':
      return 'health'
    default:
      return undefined
  }
}

export function StepGoalNew({ data, onChange }: StepGoalNewProps) {
  const { colors } = useTheme()
  const selectedVisibleGoal = getVisibleGoal(data.goal)

  const handleSelectGoal = (visibleGoal: VisibleGoal) => {
    // Map visible goal back to internal goal
    // For 'health', we keep 'health' as the internal goal
    // The parent component will handle showing health priorities
    const internalGoal: Goal = visibleGoal === 'health' ? 'health' : visibleGoal
    onChange({ ...data, goal: internalGoal })
  }

  return (
    <View style={styles.container}>
      {/* Intro section */}
      <View
        style={[
          styles.intro,
          {
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            borderColor: 'rgba(168, 85, 247, 0.2)',
          },
        ]}
      >
        <Ionicons name="compass-outline" size={24} color={colors.accent.primary} />
        <View style={styles.introContent}>
          <Text style={[styles.introTitle, { color: colors.text.primary }]}>
            Ton objectif
          </Text>
          <Text style={[styles.introText, { color: colors.text.secondary }]}>
            Choisis ce qui compte le plus pour toi en ce moment.
          </Text>
        </View>
      </View>

      {/* Goal cards - only 3 visible */}
      <View style={styles.goals}>
        <GoalCard
          goal="weight_loss"
          isSelected={selectedVisibleGoal === 'weight_loss'}
          onSelect={() => handleSelectGoal('weight_loss')}
        />
        <GoalCard
          goal="muscle_gain"
          isSelected={selectedVisibleGoal === 'muscle_gain'}
          onSelect={() => handleSelectGoal('muscle_gain')}
        />
        <GoalCard
          goal="health"
          isSelected={selectedVisibleGoal === 'health'}
          onSelect={() => handleSelectGoal('health')}
        />
      </View>

      {/* Helper text */}
      <Text style={[styles.helperText, { color: colors.text.tertiary }]}>
        Tu pourras changer d'objectif a tout moment dans les reglages.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  introContent: {
    flex: 1,
  },
  introTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  introText: {
    ...typography.body,
  },
  goals: {
    marginBottom: spacing.md,
  },
  helperText: {
    ...typography.small,
    textAlign: 'center',
    fontStyle: 'italic',
  },
})

export default StepGoalNew
