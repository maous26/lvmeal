import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, LifestyleHabits, FastingSchedule, FastingConfig } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

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
  { value: 'low' as const, label: 'Zen', emoji: '🧘', description: 'Rarement stressé(e)' },
  { value: 'moderate' as const, label: 'Modéré', emoji: '😊', description: 'Parfois stressé(e)' },
  { value: 'high' as const, label: 'Élevé', emoji: '😰', description: 'Souvent stressé(e)' },
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
  { value: '16_8', label: '16:8', emoji: '⏰', description: 'Je saute le petit-déj', window: { start: 12, end: 20 } },
  { value: '18_6', label: '18:6', emoji: '🕐', description: 'Fenêtre de 6h', window: { start: 12, end: 18 } },
  { value: 'interested', label: 'Curieux', emoji: '🤔', description: "J'aimerais essayer" },
]

const wakeUpOptions = [
  { value: 5, label: '5h', emoji: '🌅' },
  { value: 6, label: '6h', emoji: '🌄' },
  { value: 7, label: '7h', emoji: '☀️' },
  { value: 8, label: '8h', emoji: '🌞' },
  { value: 9, label: '9h+', emoji: '😴' },
]

const bedTimeOptions = [
  { value: 21, label: '21h', emoji: '🌙' },
  { value: 22, label: '22h', emoji: '🌜' },
  { value: 23, label: '23h', emoji: '🌃' },
  { value: 0, label: 'Minuit', emoji: '🦉' },
  { value: 1, label: '1h+', emoji: '🌌' },
]

export function StepLifestyle({ data, onChange }: StepLifestyleProps) {
  const { colors } = useTheme()
  const sleepAccent = colors.accent.primary
  const waterAccent = colors.nutrients.water
  const qualityAccent = colors.nutrients.fats
  const stressAccent = colors.error
  const fastingAccent = colors.warning

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
      <View style={[styles.intro, { backgroundColor: colors.infoLight, borderColor: `${colors.info}30` }]}>
        <Text style={styles.introIcon}>☀️</Text>
        <View style={styles.introContent}>
          <Text style={[styles.introTitle, { color: colors.text.primary }]}>Tes habitudes quotidiennes</Text>
          <Text style={[styles.introText, { color: colors.text.secondary }]}>
            Le sommeil, le stress et l'hydratation jouent un rôle clé dans ton bien-être et ton métabolisme.
          </Text>
        </View>
      </View>

      {/* Sleep Duration */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🌙</Text>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Tu dors combien d'heures en moyenne ?
          </Text>
        </View>
        <View style={styles.optionsRow}>
          {sleepOptions.map((option) => {
            const isSelected = habits.averageSleepHours === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateHabits({ averageSleepHours: option.value })}
                style={[
                  styles.chipOption,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? sleepAccent : colors.border.light,
                  },
                  isSelected && { backgroundColor: `${sleepAccent}15` },
                ]}
              >
                <Text style={styles.chipEmoji}>{option.emoji}</Text>
                <Text style={[styles.chipLabel, { color: isSelected ? sleepAccent : colors.text.primary }]}>
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
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Comment est ton sommeil en général ?
          </Text>
        </View>
        <View style={styles.qualityGrid}>
          {sleepQualityOptions.map((option) => {
            const isSelected = habits.sleepQualityPerception === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateHabits({ sleepQualityPerception: option.value })}
                style={[
                  styles.qualityOption,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? qualityAccent : colors.border.light,
                  },
                  isSelected && { backgroundColor: `${qualityAccent}15` },
                ]}
              >
                <Text style={styles.qualityEmoji}>{option.emoji}</Text>
                <Text style={[styles.qualityLabel, { color: isSelected ? qualityAccent : colors.text.primary }]}>
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
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Ton niveau de stress au quotidien ?
          </Text>
        </View>
        <View style={styles.stressGrid}>
          {stressOptions.map((option) => {
            const isSelected = habits.stressLevelDaily === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateHabits({ stressLevelDaily: option.value })}
                style={[
                  styles.stressOption,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? stressAccent : colors.border.light,
                  },
                  isSelected && { backgroundColor: `${stressAccent}15` },
                ]}
              >
                <Text style={styles.stressEmoji}>{option.emoji}</Text>
                <View>
                  <Text style={[styles.stressLabel, { color: isSelected ? stressAccent : colors.text.primary }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.stressDescription, { color: colors.text.tertiary }]}>{option.description}</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Tu bois combien d'eau par jour ?
          </Text>
        </View>
        <View style={styles.optionsRow}>
          {waterOptions.map((option) => {
            const isSelected = habits.waterIntakeDaily === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateHabits({ waterIntakeDaily: option.value })}
                style={[
                  styles.chipOption,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? waterAccent : colors.border.light,
                  },
                  isSelected && { backgroundColor: `${waterAccent}15` },
                ]}
              >
                <Text style={styles.chipEmoji}>{option.emoji}</Text>
                <Text style={[styles.chipLabel, { color: isSelected ? waterAccent : colors.text.primary }]}>
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
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Tu pratiques le jeûne intermittent ?
          </Text>
        </View>
        <View style={styles.fastingGrid}>
          {fastingOptions.map((option) => {
            const isSelected = habits.fasting?.schedule === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => updateFasting(option.value)}
                style={[
                  styles.fastingOption,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? fastingAccent : colors.border.light,
                  },
                  isSelected && { backgroundColor: colors.warningLight },
                ]}
              >
                <Text style={styles.fastingEmoji}>{option.emoji}</Text>
                <View style={styles.fastingContent}>
                  <Text style={[styles.fastingLabel, { color: isSelected ? fastingAccent : colors.text.primary }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.fastingDescription, { color: colors.text.tertiary }]}>{option.description}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Sleep Schedule - Optional */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>⏰</Text>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Ton rythme de sommeil (optionnel)
          </Text>
        </View>
        <Text style={[styles.scheduleHint, { color: colors.text.tertiary }]}>
          Pour des rappels au bon moment
        </Text>

        {/* Wake up time */}
        <View style={styles.scheduleRow}>
          <Text style={[styles.scheduleLabel, { color: colors.text.secondary }]}>Réveil</Text>
          <View style={styles.optionsRow}>
            {wakeUpOptions.map((option) => {
              const isSelected = habits.wakeUpTime === option.value

              return (
                <Pressable
                  key={option.value}
                  onPress={() => updateHabits({ wakeUpTime: option.value })}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor: colors.bg.elevated,
                      borderColor: isSelected ? sleepAccent : colors.border.light,
                    },
                    isSelected && { backgroundColor: `${sleepAccent}15` },
                  ]}
                >
                  <Text style={styles.timeEmoji}>{option.emoji}</Text>
                  <Text style={[styles.timeLabel, { color: isSelected ? sleepAccent : colors.text.primary }]}>
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* Bed time */}
        <View style={styles.scheduleRow}>
          <Text style={[styles.scheduleLabel, { color: colors.text.secondary }]}>Coucher</Text>
          <View style={styles.optionsRow}>
            {bedTimeOptions.map((option) => {
              const isSelected = habits.bedTime === option.value

              return (
                <Pressable
                  key={option.value}
                  onPress={() => updateHabits({ bedTime: option.value })}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor: colors.bg.elevated,
                      borderColor: isSelected ? sleepAccent : colors.border.light,
                    },
                    isSelected && { backgroundColor: `${sleepAccent}15` },
                  ]}
                >
                  <Text style={styles.timeEmoji}>{option.emoji}</Text>
                  <Text style={[styles.timeLabel, { color: isSelected ? sleepAccent : colors.text.primary }]}>
                    {option.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
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
  qualityGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  qualityOption: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.xs,
  },
  qualityEmoji: {
    fontSize: 28,
  },
  qualityLabel: {
    ...typography.caption,
    fontWeight: '500',
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
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.md,
  },
  stressEmoji: {
    fontSize: 28,
  },
  stressLabel: {
    ...typography.smallMedium,
  },
  stressDescription: {
    ...typography.caption,
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
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.md,
  },
  fastingEmoji: {
    fontSize: 24,
  },
  fastingContent: {
    flex: 1,
  },
  fastingLabel: {
    ...typography.smallMedium,
  },
  fastingDescription: {
    ...typography.caption,
  },
  scheduleHint: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  scheduleRow: {
    marginBottom: spacing.md,
  },
  scheduleLabel: {
    ...typography.smallMedium,
    marginBottom: spacing.sm,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
    gap: spacing.xs,
  },
  timeEmoji: {
    fontSize: 14,
  },
  timeLabel: {
    ...typography.small,
    fontWeight: '500',
  },
})

export default StepLifestyle
