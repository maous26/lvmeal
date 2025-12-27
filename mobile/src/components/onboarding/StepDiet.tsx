import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { DietType, ReligiousDiet, UserProfile } from '../../types'

interface StepDietProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

const dietTypes: { value: DietType; label: string; emoji: string; description: string }[] = [
  { value: 'omnivore', label: 'Omnivore', emoji: '🍖', description: 'Je mange de tout' },
  { value: 'vegetarian', label: 'Vegetarien', emoji: '🥗', description: 'Sans viande ni poisson' },
  { value: 'vegan', label: 'Vegan', emoji: '🌱', description: 'Sans produit animal' },
  { value: 'pescatarian', label: 'Pescetarien', emoji: '🐟', description: 'Poisson mais pas de viande' },
  { value: 'keto', label: 'Keto', emoji: '🥑', description: 'Tres peu de glucides' },
  { value: 'paleo', label: 'Paleo', emoji: '🥩', description: 'Alimentation ancestrale' },
]

const religiousOptions: { value: 'halal' | 'casher'; label: string; emoji: string; description: string }[] = [
  { value: 'halal', label: 'Halal', emoji: '🌙', description: 'Selon les preceptes islamiques' },
  { value: 'casher', label: 'Casher', emoji: '✡️', description: 'Selon les lois juives' },
]

const commonAllergies = ['Gluten', 'Lactose', 'Arachides', 'Fruits a coque', 'Oeufs', 'Soja', 'Crustaces', 'Poisson']

export function StepDiet({ data, onChange }: StepDietProps) {
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(data.allergies || [])

  const toggleAllergy = (allergy: string) => {
    const updated = selectedAllergies.includes(allergy)
      ? selectedAllergies.filter((a) => a !== allergy)
      : [...selectedAllergies, allergy]
    setSelectedAllergies(updated)
    onChange({ ...data, allergies: updated })
  }

  const toggleReligiousDiet = (value: 'halal' | 'casher') => {
    if (data.religiousDiet === value) {
      onChange({ ...data, religiousDiet: null })
    } else {
      onChange({ ...data, religiousDiet: value })
    }
  }

  return (
    <View style={styles.container}>
      {/* Diet type selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Type d'alimentation</Text>
        <View style={styles.dietGrid}>
          {dietTypes.map((diet) => {
            const isSelected = data.dietType === diet.value

            return (
              <Pressable
                key={diet.value}
                onPress={() => onChange({ ...data, dietType: diet.value })}
                style={[styles.dietOption, isSelected && styles.dietOptionSelected]}
              >
                <Text style={styles.dietEmoji}>{diet.emoji}</Text>
                <Text style={[styles.dietLabel, isSelected && styles.dietLabelSelected]}>
                  {diet.label}
                </Text>
                <Text style={styles.dietDescription}>{diet.description}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Religious dietary options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Restriction religieuse</Text>
        <Text style={styles.sectionHint}>Optionnel - peut se combiner avec ton type d'alimentation</Text>
        <View style={styles.religiousRow}>
          {religiousOptions.map((option) => {
            const isSelected = data.religiousDiet === option.value

            return (
              <Pressable
                key={option.value}
                onPress={() => toggleReligiousDiet(option.value)}
                style={[styles.religiousOption, isSelected && styles.religiousOptionSelected]}
              >
                <Text style={styles.religiousEmoji}>{option.emoji}</Text>
                <View style={styles.religiousContent}>
                  <Text style={[styles.religiousLabel, isSelected && styles.religiousLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.religiousDescription}>{option.description}</Text>
                </View>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Allergies */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allergies ou intolerances</Text>
        <Text style={styles.sectionHint}>Selectionne toutes celles qui s'appliquent (optionnel)</Text>
        <View style={styles.allergiesRow}>
          {commonAllergies.map((allergy) => {
            const isSelected = selectedAllergies.includes(allergy)

            return (
              <Pressable
                key={allergy}
                onPress={() => toggleAllergy(allergy)}
                style={[styles.allergyChip, isSelected && styles.allergyChipSelected]}
              >
                <Text style={[styles.allergyText, isSelected && styles.allergyTextSelected]}>
                  {allergy}
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
  section: {},
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  dietGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dietOption: {
    width: '48%',
    alignItems: 'center',
    padding: spacing.default,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  dietOptionSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.light,
  },
  dietEmoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  dietLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
    textAlign: 'center',
  },
  dietLabelSelected: {
    color: colors.accent.primary,
  },
  dietDescription: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  religiousRow: {
    gap: spacing.sm,
  },
  religiousOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  religiousOptionSelected: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  religiousEmoji: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  religiousContent: {
    flex: 1,
  },
  religiousLabel: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  religiousLabelSelected: {
    color: '#D97706',
  },
  religiousDescription: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  allergiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  allergyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated,
  },
  allergyChipSelected: {
    borderColor: colors.error,
    backgroundColor: `${colors.error}15`,
  },
  allergyText: {
    ...typography.small,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  allergyTextSelected: {
    color: colors.error,
  },
})

export default StepDiet
