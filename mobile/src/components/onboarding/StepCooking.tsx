import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, CookingPreferences, CookingLevel } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

interface StepCookingProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

const levelOptions: { value: CookingLevel; label: string; emoji: string; description: string }[] = [
  { value: 'beginner', label: 'Débutant', emoji: '🍳', description: 'Je débute en cuisine' },
  { value: 'intermediate', label: 'Intermédiaire', emoji: '👨‍🍳', description: 'Je me débrouille bien' },
  { value: 'advanced', label: 'Expérimenté', emoji: '⭐', description: 'La cuisine est ma passion' },
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
  const { colors } = useTheme()
  const primary = colors.secondary.primary
  const primaryLight = colors.secondary.light
  const success = colors.success
  const successLight = colors.successLight

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
      <View style={[styles.intro, { backgroundColor: primaryLight, borderColor: `${primary}30` }]}>
        <Text style={styles.introIcon}>👨‍🍳</Text>
        <View style={styles.introContent}>
          <Text style={[styles.introTitle, { color: colors.text.primary }]}>Tes préférences en cuisine</Text>
          <Text style={[styles.introText, { color: colors.text.secondary }]}>
            Ces infos nous aident à te proposer des recettes adaptées à ton niveau et ton temps disponible.
          </Text>
        </View>
      </View>

      {/* Cooking Level */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🎯</Text>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Quel est ton niveau en cuisine ?
          </Text>
        </View>
        <View style={styles.levelGrid}>
          {levelOptions.map((option) => {
            const isSelected = prefs.level === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updatePrefs({ level: option.value })}
                style={[
                  styles.levelOption,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? primary : colors.border.light,
                  },
                  isSelected && { backgroundColor: primaryLight },
                ]}
              >
                <Text style={styles.levelEmoji}>{option.emoji}</Text>
                <View style={styles.levelContent}>
                  <Text style={[styles.levelLabel, { color: isSelected ? primary : colors.text.primary }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.levelDescription, { color: colors.text.tertiary }]}>
                    {option.description}
                  </Text>
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
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Temps disponible en semaine (par repas)
          </Text>
        </View>
        <View style={styles.optionsRow}>
          {weekdayTimeOptions.map((option) => {
            const isSelected = prefs.weekdayTime === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updatePrefs({ weekdayTime: option.value })}
                style={[
                  styles.chipOption,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? primary : colors.border.light,
                  },
                  isSelected && { backgroundColor: primaryLight },
                ]}
              >
                <Text style={styles.chipEmoji}>{option.emoji}</Text>
                <Text style={[styles.chipLabel, { color: isSelected ? primary : colors.text.primary }]}>
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
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Temps disponible le week-end (par repas)
          </Text>
        </View>
        <View style={styles.optionsRow}>
          {weekendTimeOptions.map((option) => {
            const isSelected = prefs.weekendTime === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updatePrefs({ weekendTime: option.value })}
                style={[
                  styles.chipOption,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? success : colors.border.light,
                  },
                  isSelected && { backgroundColor: successLight },
                ]}
              >
                <Text style={styles.chipEmoji}>{option.emoji}</Text>
                <Text style={[styles.chipLabel, { color: isSelected ? success : colors.text.primary }]}>
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
    borderRadius: radius.lg,
    borderWidth: 1,
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
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.sm,
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    ...typography.smallMedium,
  },
  levelGrid: {
    gap: spacing.sm,
  },
  levelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.md,
  },
  levelEmoji: {
    fontSize: 32,
  },
  levelContent: {
    flex: 1,
  },
  levelLabel: {
    ...typography.bodySemibold,
  },
  levelDescription: {
    ...typography.caption,
    marginTop: 2,
  },
})

export default StepCooking
