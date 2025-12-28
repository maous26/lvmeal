import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, CookingPreferences, CookingLevel } from '../../types'

interface StepCookingProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

const levelOptions: { value: CookingLevel; label: string; emoji: string; description: string }[] = [
  { value: 'beginner', label: 'Debutant', emoji: '🍳', description: 'Je debute en cuisine' },
  { value: 'intermediate', label: 'Intermediaire', emoji: '👨‍🍳', description: 'Je me debrouille bien' },
  { value: 'advanced', label: 'Experimente', emoji: '⭐', description: 'La cuisine est ma passion' },
]

const weekdayTimeOptions = [
  { value: 15, label: '15 min', emoji: '⚡' },
  { value: 30, label: '30 min', emoji: '🕐' },
  { value: 45, label: '45 min', emoji: '🕑' },
  { value: 60, label: '1h+', emoji: '🕒' },
]

const weekendTimeOptions = [
  { value: 30, label: '30 min', emoji: '⚡' },
  { value: 60, label: '1h', emoji: '🕐' },
  { value: 90, label: '1h30', emoji: '🕑' },
  { value: 120, label: '2h+', emoji: '🕒' },
]

export function StepCooking({ data, onChange }: StepCookingProps) {
  const [prefs, setPrefs] = useState<Partial<CookingPreferences>>(
    data.cookingPreferences || {
      level: 'intermediate',
      weekdayTime: 30,
      weekendTime: 60,
      batchCooking: false,
      quickMealsOnly: false,
    }
  )

  const updatePrefs = (updates: Partial<CookingPreferences>) => {
    const updated = { ...prefs, ...updates }
    setPrefs(updated)
    onChange({
      ...data,
      cookingPreferences: updated as CookingPreferences,
    })
  }

  return (
    <View style={styles.container}>
      {/* Introduction */}
      <View style={styles.intro}>
        <Text style={styles.introIcon}>👨‍🍳</Text>
        <View style={styles.introContent}>
          <Text style={styles.introTitle}>Tes preferences en cuisine</Text>
          <Text style={styles.introText}>
            Ces infos nous aident a te proposer des recettes adaptees a ton niveau et ton temps disponible.
          </Text>
        </View>
      </View>

      {/* Cooking Level */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🎯</Text>
          <Text style={styles.sectionTitle}>Quel est ton niveau en cuisine ?</Text>
        </View>
        <View style={styles.levelGrid}>
          {levelOptions.map((option) => {
            const isSelected = prefs.level === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updatePrefs({ level: option.value })}
                style={[styles.levelOption, isSelected && styles.levelOptionSelected]}
              >
                <Text style={styles.levelEmoji}>{option.emoji}</Text>
                <View style={styles.levelContent}>
                  <Text style={[styles.levelLabel, isSelected && styles.levelLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.levelDescription}>{option.description}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Weekday Time */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>📅</Text>
          <Text style={styles.sectionTitle}>Temps disponible en semaine (par repas)</Text>
        </View>
        <View style={styles.optionsRow}>
          {weekdayTimeOptions.map((option) => {
            const isSelected = prefs.weekdayTime === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updatePrefs({ weekdayTime: option.value })}
                style={[styles.chipOption, isSelected && styles.chipOptionSelected]}
              >
                <Text style={styles.chipEmoji}>{option.emoji}</Text>
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Weekend Time */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🌴</Text>
          <Text style={styles.sectionTitle}>Temps disponible le week-end (par repas)</Text>
        </View>
        <View style={styles.optionsRow}>
          {weekendTimeOptions.map((option) => {
            const isSelected = prefs.weekendTime === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updatePrefs({ weekendTime: option.value })}
                style={[styles.chipOption, isSelected && styles.chipOptionSelectedGreen]}
              >
                <Text style={styles.chipEmoji}>{option.emoji}</Text>
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelectedGreen]}>
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  intro: {
    flexDirection: 'row',
    padding: spacing.default,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.2)',
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
  section: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xl + spacing.sm,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: spacing.sm,
  },
  chipOptionSelected: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  chipOptionSelectedGreen: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  chipLabelSelected: {
    color: '#F97316',
  },
  chipLabelSelectedGreen: {
    color: '#22C55E',
  },
  levelGrid: {
    gap: spacing.sm,
  },
  levelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: spacing.md,
  },
  levelOptionSelected: {
    borderColor: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  levelEmoji: {
    fontSize: 32,
  },
  levelContent: {
    flex: 1,
  },
  levelLabel: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  levelLabelSelected: {
    color: '#F97316',
  },
  levelDescription: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  booleanRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  booleanOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: spacing.sm,
  },
  booleanOptionSelected: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  booleanOptionSelectedNo: {
    borderColor: '#94A3B8',
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  booleanEmoji: {
    fontSize: 18,
  },
  booleanLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  booleanLabelSelected: {
    color: '#22C55E',
  },
  booleanLabelSelectedNo: {
    color: '#64748B',
  },
})

export default StepCooking
