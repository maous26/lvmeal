/**
 * Check-in Screen
 *
 * Simple wellness check-in with emoji scale.
 * All fields optional except energy level.
 * No judgment, no scores.
 */

import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../constants/theme'
import { useGoalsStore } from '../goals/stores/goals-store'

const ENERGY_EMOJIS = ['😴', '😔', '😐', '🙂', '😊']
const STRESS_EMOJIS = ['😌', '🙂', '😐', '😟', '😰']

type EmojiLevel = 1 | 2 | 3 | 4 | 5

export function CheckinScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const { submitCheckin } = useGoalsStore()

  // Form state
  const [energyLevel, setEnergyLevel] = useState<EmojiLevel | null>(null)
  const [stressLevel, setStressLevel] = useState<EmojiLevel | null>(null)
  const [sleepHours, setSleepHours] = useState<string>('')
  const [hydrationLiters, setHydrationLiters] = useState<string>('')

  const canSubmit = energyLevel !== null

  const handleSubmit = () => {
    if (!energyLevel) return

    submitCheckin({
      energyLevel,
      stressLevel: stressLevel ?? undefined,
      sleepHours: sleepHours ? parseFloat(sleepHours) : undefined,
      hydrationLiters: hydrationLiters ? parseFloat(hydrationLiters) : undefined,
    })

    // TODO: Track analytics event
    navigation.goBack()
  }

  const handleSkip = () => {
    navigation.goBack()
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleSkip} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </Pressable>
        </View>

        <Text style={[styles.title, { color: colors.text.primary }]}>
          Comment te sens-tu ?
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Prends quelques secondes pour faire le point.
        </Text>

        {/* Energy Level (required) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Ton niveau d'energie *
          </Text>
          <View style={styles.emojiRow}>
            {ENERGY_EMOJIS.map((emoji, index) => {
              const level = (index + 1) as EmojiLevel
              const isSelected = energyLevel === level
              return (
                <Pressable
                  key={level}
                  onPress={() => setEnergyLevel(level)}
                  style={[
                    styles.emojiButton,
                    {
                      backgroundColor: isSelected ? colors.accent.light : colors.bg.elevated,
                      borderColor: isSelected ? colors.accent.primary : colors.border.light,
                    },
                  ]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              )
            })}
          </View>
          <View style={styles.emojiLabels}>
            <Text style={[styles.emojiLabel, { color: colors.text.tertiary }]}>Fatigue</Text>
            <Text style={[styles.emojiLabel, { color: colors.text.tertiary }]}>En forme</Text>
          </View>
        </View>

        {/* Stress Level (optional) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Ton niveau de stress
          </Text>
          <Text style={[styles.optionalLabel, { color: colors.text.tertiary }]}>Optionnel</Text>
          <View style={styles.emojiRow}>
            {STRESS_EMOJIS.map((emoji, index) => {
              const level = (index + 1) as EmojiLevel
              const isSelected = stressLevel === level
              return (
                <Pressable
                  key={level}
                  onPress={() => setStressLevel(stressLevel === level ? null : level)}
                  style={[
                    styles.emojiButton,
                    {
                      backgroundColor: isSelected ? colors.accent.light : colors.bg.elevated,
                      borderColor: isSelected ? colors.accent.primary : colors.border.light,
                    },
                  ]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              )
            })}
          </View>
          <View style={styles.emojiLabels}>
            <Text style={[styles.emojiLabel, { color: colors.text.tertiary }]}>Zen</Text>
            <Text style={[styles.emojiLabel, { color: colors.text.tertiary }]}>Stresse</Text>
          </View>
        </View>

        {/* Sleep Hours (optional) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Heures de sommeil
          </Text>
          <Text style={[styles.optionalLabel, { color: colors.text.tertiary }]}>Optionnel</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.bg.elevated,
                  borderColor: colors.border.light,
                  color: colors.text.primary,
                },
              ]}
              value={sleepHours}
              onChangeText={setSleepHours}
              keyboardType="decimal-pad"
              placeholder="7.5"
              placeholderTextColor={colors.text.tertiary}
            />
            <Text style={[styles.inputUnit, { color: colors.text.secondary }]}>heures</Text>
          </View>
        </View>

        {/* Hydration (optional) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Hydratation
          </Text>
          <Text style={[styles.optionalLabel, { color: colors.text.tertiary }]}>Optionnel</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.bg.elevated,
                  borderColor: colors.border.light,
                  color: colors.text.primary,
                },
              ]}
              value={hydrationLiters}
              onChangeText={setHydrationLiters}
              keyboardType="decimal-pad"
              placeholder="2.0"
              placeholderTextColor={colors.text.tertiary}
            />
            <Text style={[styles.inputUnit, { color: colors.text.secondary }]}>litres</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: colors.bg.primary, borderTopColor: colors.border.light }]}>
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: colors.text.tertiary }]}>Pas maintenant</Text>
        </Pressable>

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[
            styles.submitButton,
            {
              backgroundColor: canSubmit ? colors.accent.primary : colors.bg.secondary,
            },
          ]}
        >
          <Text
            style={[
              styles.submitText,
              { color: canSubmit ? '#FFFFFF' : colors.text.tertiary },
            ]}
          >
            Enregistrer
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.default,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.md,
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodySemibold,
    marginBottom: spacing.xs,
  },
  optionalLabel: {
    ...typography.caption,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  emojiButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 60,
    borderRadius: radius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  emojiLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  emojiLabel: {
    ...typography.caption,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textInput: {
    width: 80,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
    ...typography.body,
  },
  inputUnit: {
    ...typography.body,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.default,
    gap: spacing.sm,
    borderTopWidth: 1,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.body,
  },
  submitButton: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    ...typography.bodySemibold,
  },
})

export default CheckinScreen
