import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, LifestyleHabits, FastingSchedule, FastingConfig } from '../../types'

interface StepLifestyleProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

const sleepOptions = [
  { value: 5, label: '< 5h', emoji: '😴' },
  { value: 6, label: '5-6h', emoji: '🥱' },
  { value: 7, label: '6-7h', emoji: '😊' },
  { value: 8, label: '7-8h', emoji: '😌' },
  { value: 9, label: '8h+', emoji: '💤' },
]

const sleepQualityOptions = [
  { value: 'poor' as const, label: 'Difficile', emoji: '😫' },
  { value: 'average' as const, label: 'Moyen', emoji: '😐' },
  { value: 'good' as const, label: 'Bon', emoji: '🙂' },
  { value: 'excellent' as const, label: 'Excellent', emoji: '😴' },
]

const stressOptions = [
  { value: 'low' as const, label: 'Zen', emoji: '🧘', description: 'Rarement stresse(e)' },
  { value: 'moderate' as const, label: 'Modere', emoji: '😊', description: 'Parfois stresse(e)' },
  { value: 'high' as const, label: 'Eleve', emoji: '😰', description: 'Souvent stresse(e)' },
  { value: 'very_high' as const, label: 'Intense', emoji: '🤯', description: 'Stress constant' },
]

const waterOptions = [
  { value: 0.5, label: '< 1L', emoji: '💧' },
  { value: 1, label: '1L', emoji: '💧💧' },
  { value: 1.5, label: '1.5L', emoji: '💧💧💧' },
  { value: 2, label: '2L', emoji: '🌊' },
  { value: 2.5, label: '2.5L+', emoji: '🌊🌊' },
]

const fastingOptions: { value: FastingSchedule; label: string; emoji: string; description: string; window?: { start: number; end: number } }[] = [
  { value: 'none', label: 'Non', emoji: '🍽️', description: 'Je mange quand j\'ai faim' },
  { value: '16_8', label: '16:8', emoji: '⏰', description: 'Je saute le petit-dej', window: { start: 12, end: 20 } },
  { value: '18_6', label: '18:6', emoji: '🕐', description: 'Fenetre de 6h', window: { start: 12, end: 18 } },
  { value: 'interested', label: 'Curieux', emoji: '🤔', description: 'J\'aimerais essayer' },
]

export function StepLifestyle({ data, onChange }: StepLifestyleProps) {
  const [habits, setHabits] = useState<Partial<LifestyleHabits>>(data.lifestyleHabits || {})

  const updateHabits = (updates: Partial<LifestyleHabits>) => {
    const updated = { ...habits, ...updates }
    setHabits(updated)
    onChange({
      ...data,
      lifestyleHabits: updated as LifestyleHabits,
    })
  }

  const updateFasting = (schedule: FastingSchedule) => {
    const option = fastingOptions.find(o => o.value === schedule)
    const fastingConfig: FastingConfig = {
      schedule,
      eatingWindowStart: option?.window?.start,
      eatingWindowEnd: option?.window?.end,
    }
    updateHabits({ fasting: fastingConfig })
  }

  return (
    <View style={styles.container}>
      {/* Introduction */}
      <View style={styles.intro}>
        <Text style={styles.introIcon}>☀️</Text>
        <View style={styles.introContent}>
          <Text style={styles.introTitle}>Tes habitudes quotidiennes</Text>
          <Text style={styles.introText}>
            Le sommeil, le stress et l'hydratation jouent un role cle dans ton bien-etre et ton metabolisme.
          </Text>
        </View>
      </View>

      {/* Sleep Duration */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🌙</Text>
          <Text style={styles.sectionTitle}>Tu dors combien d'heures en moyenne ?</Text>
        </View>
        <View style={styles.optionsRow}>
          {sleepOptions.map((option) => {
            const isSelected = habits.averageSleepHours === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateHabits({ averageSleepHours: option.value })}
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

      {/* Sleep Quality */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🔋</Text>
          <Text style={styles.sectionTitle}>Comment est ton sommeil en general ?</Text>
        </View>
        <View style={styles.qualityGrid}>
          {sleepQualityOptions.map((option) => {
            const isSelected = habits.sleepQualityPerception === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateHabits({ sleepQualityPerception: option.value })}
                style={[styles.qualityOption, isSelected && styles.qualityOptionSelected]}
              >
                <Text style={styles.qualityEmoji}>{option.emoji}</Text>
                <Text style={[styles.qualityLabel, isSelected && styles.qualityLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Stress Level */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🧠</Text>
          <Text style={styles.sectionTitle}>Ton niveau de stress au quotidien ?</Text>
        </View>
        <View style={styles.stressGrid}>
          {stressOptions.map((option) => {
            const isSelected = habits.stressLevelDaily === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateHabits({ stressLevelDaily: option.value })}
                style={[styles.stressOption, isSelected && styles.stressOptionSelected]}
              >
                <Text style={styles.stressEmoji}>{option.emoji}</Text>
                <View>
                  <Text style={[styles.stressLabel, isSelected && styles.stressLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.stressDescription}>{option.description}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Water Intake */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>💧</Text>
          <Text style={styles.sectionTitle}>Tu bois combien d'eau par jour ?</Text>
        </View>
        <View style={styles.optionsRow}>
          {waterOptions.map((option) => {
            const isSelected = habits.waterIntakeDaily === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateHabits({ waterIntakeDaily: option.value })}
                style={[styles.chipOption, isSelected && styles.chipOptionSelectedCyan]}
              >
                <Text style={styles.chipEmoji}>{option.emoji}</Text>
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelectedCyan]}>
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Intermittent Fasting */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>⏱️</Text>
          <Text style={styles.sectionTitle}>Tu pratiques le jeune intermittent ?</Text>
        </View>
        <View style={styles.fastingGrid}>
          {fastingOptions.map((option) => {
            const isSelected = habits.fasting?.schedule === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateFasting(option.value)}
                style={[styles.fastingOption, isSelected && styles.fastingOptionSelected]}
              >
                <Text style={styles.fastingEmoji}>{option.emoji}</Text>
                <View style={styles.fastingContent}>
                  <Text style={[styles.fastingLabel, isSelected && styles.fastingLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.fastingDescription}>{option.description}</Text>
                </View>
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
    paddingBottom: 100, // Extra space for scrolling to see fasting section
  },
  intro: {
    flexDirection: 'row',
    padding: spacing.default,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
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
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  chipOptionSelectedCyan: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  chipLabelSelected: {
    color: '#6366F1',
  },
  chipLabelSelectedCyan: {
    color: '#06B6D4',
  },
  qualityGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  qualityOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: spacing.xs,
  },
  qualityOptionSelected: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  qualityEmoji: {
    fontSize: 28,
  },
  qualityLabel: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '500',
  },
  qualityLabelSelected: {
    color: '#A855F7',
  },
  stressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stressOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: spacing.md,
  },
  stressOptionSelected: {
    borderColor: '#F43F5E',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  stressEmoji: {
    fontSize: 28,
  },
  stressLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  stressLabelSelected: {
    color: '#F43F5E',
  },
  stressDescription: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  fastingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fastingOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: spacing.md,
  },
  fastingOptionSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  fastingEmoji: {
    fontSize: 24,
  },
  fastingContent: {
    flex: 1,
  },
  fastingLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  fastingLabelSelected: {
    color: '#F59E0B',
  },
  fastingDescription: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
})

export default StepLifestyle
