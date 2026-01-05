import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { radius, spacing, typography } from '../../constants/theme'
import type { Goal, UserProfile } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

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
    description: 'Créer un déficit calorique progressif et sain',
    icon: '📉',
    calorieAdjust: '-300 à -500 kcal',
  },
  {
    value: 'muscle_gain',
    label: 'Prendre du muscle',
    description: 'Augmenter la masse musculaire avec un surplus contrôlé',
    icon: '💪',
    calorieAdjust: '+200 à +400 kcal',
  },
  {
    value: 'maintenance',
    label: 'Maintenir mon poids',
    description: 'Équilibrer apports et dépenses caloriques',
    icon: '⚖️',
    calorieAdjust: 'Équilibre',
  },
  {
    value: 'health',
    label: 'Améliorer ma santé',
    description: 'Optimiser la qualité nutritionnelle de mon alimentation',
    icon: '❤️',
    calorieAdjust: 'Personnalisé',
  },
  {
    value: 'energy',
    label: "Plus d'énergie",
    description: 'Améliorer vitalité et performance au quotidien',
    icon: '⚡',
    calorieAdjust: 'Personnalisé',
  },
]

export function StepGoal({ data, onChange }: StepGoalProps) {
  const { colors } = useTheme()
  const accent = colors.nutrients.fats

  return (
    <View style={styles.container}>
      {/* Introduction accueillante */}
      <View style={[styles.intro, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
        <Text style={styles.introIcon}>🎯</Text>
        <View style={styles.introContent}>
          <Text style={[styles.introTitle, { color: colors.text.primary }]}>Qu'est-ce qui t'amène ?</Text>
          <Text style={[styles.introText, { color: colors.text.secondary }]}>
            Chaque objectif mérite une approche différente. On adapte tout à ce qui compte pour toi.
          </Text>
        </View>
      </View>

      {goals.map((goal) => {
        const isSelected = data.goal === goal.value

        return (
          <Pressable
            key={goal.value}
            onPress={() => onChange({ ...data, goal: goal.value })}
            style={[
              styles.option,
              {
                backgroundColor: colors.bg.elevated,
                borderColor: isSelected ? colors.accent.primary : colors.border.light,
              },
              isSelected && { backgroundColor: colors.accent.light },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: isSelected ? colors.accent.primary : colors.bg.secondary },
              ]}
            >
              <Text style={styles.icon}>{goal.icon}</Text>
            </View>

            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={[styles.label, { color: isSelected ? colors.accent.primary : colors.text.primary }]}>
                  {goal.label}
                </Text>
                <View style={[styles.badge, { backgroundColor: isSelected ? colors.accent.primary : colors.bg.tertiary }]}>
                  <Text style={[styles.badgeText, { color: isSelected ? colors.text.inverse : colors.text.tertiary }]}>
                    {goal.calorieAdjust}
                  </Text>
                </View>
              </View>
              <Text style={[styles.description, { color: colors.text.secondary }]}>{goal.description}</Text>
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
              {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.text.inverse }]} />}
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
    borderRadius: radius.lg,
    borderWidth: 1,
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
  },
  introText: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.default,
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
  },
})

export default StepGoal
