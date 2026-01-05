import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { radius, spacing, typography } from '../../constants/theme'
import type { DietType, UserProfile } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

interface StepDietProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

const dietTypes: { value: DietType; label: string; emoji: string; description: string }[] = [
  { value: 'omnivore', label: 'Omnivore', emoji: '🍖', description: 'Je mange de tout' },
  { value: 'vegetarian', label: 'Végétarien', emoji: '🥗', description: 'Sans viande ni poisson' },
  { value: 'vegan', label: 'Vegan', emoji: '🌱', description: 'Sans produit animal' },
  { value: 'pescatarian', label: 'Pescétarien', emoji: '🐟', description: 'Poisson mais pas de viande' },
  { value: 'keto', label: 'Keto', emoji: '🥑', description: 'Très peu de glucides' },
  { value: 'paleo', label: 'Paleo', emoji: '🥩', description: 'Alimentation ancestrale' },
]

const dietaryRestrictions = ['Halal', 'Casher', 'Gluten', 'Lactose', 'Arachides', 'Fruits à coque', 'Œufs', 'Soja', 'Crustacés', 'Poisson']

export function StepDiet({ data, onChange }: StepDietProps) {
  const { colors } = useTheme()
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(data.allergies || [])

  const toggleRestriction = (restriction: string) => {
    const updated = selectedAllergies.includes(restriction)
      ? selectedAllergies.filter((a) => a !== restriction)
      : [...selectedAllergies, restriction]
    setSelectedAllergies(updated)
    onChange({ ...data, allergies: updated })
  }

  return (
    <View style={styles.container}>
      {/* Introduction accueillante */}
      <View style={[styles.intro, { backgroundColor: colors.successLight, borderColor: `${colors.success}30` }]}>
        <Text style={styles.introIcon}>🍽️</Text>
        <View style={styles.introContent}>
          <Text style={[styles.introTitle, { color: colors.text.primary }]}>Tes préférences alimentaires</Text>
          <Text style={[styles.introText, { color: colors.text.secondary }]}>
            On adapte toutes les recettes et conseils à ton mode d'alimentation. Aucun jugement, que du sur‑mesure !
          </Text>
        </View>
      </View>

      {/* Diet type selection */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>🥗</Text>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            Comment tu manges au quotidien ?
          </Text>
        </View>
        <View style={styles.dietGrid}>
          {dietTypes.map((diet) => {
            const isSelected = data.dietType === diet.value

            return (
              <Pressable
                key={diet.value}
                onPress={() => onChange({ ...data, dietType: diet.value })}
                style={[
                  styles.dietOption,
                  {
                    backgroundColor: colors.bg.elevated,
                    borderColor: isSelected ? colors.accent.primary : colors.border.light,
                  },
                  isSelected && { backgroundColor: colors.accent.light },
                ]}
              >
                <Text style={styles.dietEmoji}>{diet.emoji}</Text>
                <Text style={[styles.dietLabel, { color: isSelected ? colors.accent.primary : colors.text.primary }]}>
                  {diet.label}
                </Text>
                <Text style={[styles.dietDescription, { color: colors.text.tertiary }]}>{diet.description}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Dietary Restrictions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>⚠️</Text>
          <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>Restriction alimentaire</Text>
          <Text style={[styles.optionalBadge, { color: colors.text.tertiary, backgroundColor: colors.bg.tertiary }]}>
            Optionnel
          </Text>
        </View>
        <View style={styles.allergiesRow}>
          {dietaryRestrictions.map((restriction) => {
            const isSelected = selectedAllergies.includes(restriction)

            return (
              <Pressable
                key={restriction}
                onPress={() => toggleRestriction(restriction)}
                style={[
                  styles.allergyChip,
                  {
                    borderColor: isSelected ? colors.error : colors.border.default,
                    backgroundColor: isSelected ? `${colors.error}15` : colors.bg.elevated,
                  },
                ]}
              >
                <Text style={[styles.allergyText, { color: isSelected ? colors.error : colors.text.secondary }]}>
                  {restriction}
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
    paddingBottom: 60,
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
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    ...typography.smallMedium,
    flex: 1,
  },
  optionalBadge: {
    ...typography.caption,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
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
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  dietEmoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  dietLabel: {
    ...typography.smallMedium,
    textAlign: 'center',
  },
  dietDescription: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 2,
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
  },
  allergyText: {
    ...typography.small,
    fontWeight: '500',
  },
})

export default StepDiet
