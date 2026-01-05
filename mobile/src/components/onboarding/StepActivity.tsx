import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { radius, spacing, typography } from '../../constants/theme'
import type { ActivityLevel, UserProfile } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

interface StepActivityProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

const activityLevels: {
  value: ActivityLevel
  label: string
  description: string
  icon: string
  multiplier: string
}[] = [
  {
    value: 'sedentary',
    label: 'Sédentaire',
    description: 'Travail de bureau, peu de marche',
    icon: '🪑',
    multiplier: 'x1.2',
  },
  {
    value: 'light',
    label: 'Légèrement actif',
    description: 'Marche quotidienne, activité légère',
    icon: '🚶',
    multiplier: 'x1.4',
  },
  {
    value: 'moderate',
    label: 'Modérément actif',
    description: 'Exercice 3-5 fois par semaine',
    icon: '🚴',
    multiplier: 'x1.6',
  },
  {
    value: 'active',
    label: 'Très actif',
    description: 'Exercice intense 6-7 fois par semaine',
    icon: '🏋️',
    multiplier: 'x1.8',
  },
  {
    value: 'athlete',
    label: 'Athlète',
    description: 'Entraînement intensif quotidien',
    icon: '🏅',
    multiplier: 'x2.0',
  },
]

export function StepActivity({ data, onChange }: StepActivityProps) {
  const { colors, isDark } = useTheme()
  const overlayBg = isDark ? `${colors.info}20` : colors.infoLight
  const overlayBorder = `${colors.info}30`

  return (
    <View style={styles.container}>
      {/* Introduction accueillante */}
      <View style={[styles.intro, { backgroundColor: overlayBg, borderColor: overlayBorder }]}>
        <Text style={styles.introIcon}>🏃</Text>
        <View style={styles.introContent}>
          <Text style={[styles.introTitle, { color: colors.text.primary }]}>Ton rythme de vie</Text>
          <Text style={[styles.introText, { color: colors.text.secondary }]}>
            Pas besoin d'être un athlète ! On calcule tes besoins selon ton quotidien réel.
          </Text>
        </View>
      </View>

      {activityLevels.map((level) => {
        const isSelected = data.activityLevel === level.value

        return (
          <Pressable
            key={level.value}
            onPress={() => onChange({ ...data, activityLevel: level.value })}
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
              <Text style={styles.icon}>{level.icon}</Text>
            </View>

            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={[styles.label, { color: isSelected ? colors.accent.primary : colors.text.primary }]}>
                  {level.label}
                </Text>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: isSelected ? colors.accent.primary : colors.bg.tertiary },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: isSelected ? colors.text.inverse : colors.text.tertiary },
                    ]}
                  >
                    {level.multiplier}
                  </Text>
                </View>
              </View>
              <Text style={[styles.description, { color: colors.text.secondary }]}>{level.description}</Text>
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

export default StepActivity
