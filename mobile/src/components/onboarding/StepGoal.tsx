import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { Goal, UserProfile } from '../../types'

interface StepGoalProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

const goals: {
  value: Goal
  label: string
  description: string
  icon: string
  calorieAdjust: string
}[] = [
  {
    value: 'weight_loss',
    label: 'Perdre du poids',
    description: 'Creer un deficit calorique progressif et sain',
    icon: '📉',
    calorieAdjust: '-300 a -500 kcal',
  },
  {
    value: 'muscle_gain',
    label: 'Prendre du muscle',
    description: 'Augmenter la masse musculaire avec un surplus controle',
    icon: '💪',
    calorieAdjust: '+200 a +400 kcal',
  },
  {
    value: 'maintenance',
    label: 'Maintenir mon poids',
    description: 'Equilibrer apports et depenses caloriques',
    icon: '⚖️',
    calorieAdjust: 'Equilibre',
  },
  {
    value: 'health',
    label: 'Ameliorer ma sante',
    description: 'Optimiser la qualite nutritionnelle de mon alimentation',
    icon: '❤️',
    calorieAdjust: 'Personnalise',
  },
  {
    value: 'energy',
    label: "Plus d'energie",
    description: 'Ameliorer vitalite et performance au quotidien',
    icon: '⚡',
    calorieAdjust: 'Personnalise',
  },
]

export function StepGoal({ data, onChange }: StepGoalProps) {
  return (
    <View style={styles.container}>
      {/* Introduction accueillante */}
      <View style={styles.intro}>
        <Text style={styles.introIcon}>🎯</Text>
        <View style={styles.introContent}>
          <Text style={styles.introTitle}>Qu'est-ce qui t'amene ?</Text>
          <Text style={styles.introText}>
            Chaque objectif merite une approche differente. On adapte tout a ce qui compte pour toi.
          </Text>
        </View>
      </View>

      {goals.map((goal) => {
        const isSelected = data.goal === goal.value

        return (
          <Pressable
            key={goal.value}
            onPress={() => onChange({ ...data, goal: goal.value })}
            style={[styles.option, isSelected && styles.optionSelected]}
          >
            <View style={[styles.iconContainer, isSelected && styles.iconContainerSelected]}>
              <Text style={styles.icon}>{goal.icon}</Text>
            </View>

            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={[styles.label, isSelected && styles.labelSelected]}>
                  {goal.label}
                </Text>
                <View style={[styles.badge, isSelected && styles.badgeSelected]}>
                  <Text style={[styles.badgeText, isSelected && styles.badgeTextSelected]}>
                    {goal.calorieAdjust}
                  </Text>
                </View>
              </View>
              <Text style={styles.description}>{goal.description}</Text>
            </View>

            <View style={[styles.radio, isSelected && styles.radioSelected]}>
              {isSelected && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  intro: {
    flexDirection: 'row',
    padding: spacing.default,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    marginBottom: spacing.sm,
  },
  introIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  introContent: {
    flex: 1,
  },
  introTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  introText: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  optionSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.light,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.default,
  },
  iconContainerSelected: {
    backgroundColor: colors.accent.primary,
  },
  icon: {
    fontSize: 24,
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
  label: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  labelSelected: {
    color: colors.accent.primary,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.tertiary,
  },
  badgeSelected: {
    backgroundColor: colors.accent.primary,
  },
  badgeText: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  badgeTextSelected: {
    color: '#FFFFFF',
  },
  description: {
    ...typography.small,
    color: colors.text.secondary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
})

export default StepGoal
