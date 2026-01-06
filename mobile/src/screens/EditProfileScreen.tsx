/**
 * EditProfileScreen - Modifier les informations du profil
 *
 * Permet de modifier toutes les informations fournies lors de l'onboarding:
 * - Informations de base (prénom, genre, âge, taille, poids)
 * - Objectif (perte de poids, prise de muscle, etc.)
 * - Niveau d'activité
 * - Régime alimentaire et allergies
 * - Préférences de cuisine
 */

import React, { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import {
  ChevronLeft,
  User,
  Target,
  Activity,
  Utensils,
  ChefHat,
  Check,
} from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'

import { colors, spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui'
import type {
  UserProfile,
  Gender,
  Goal,
  ActivityLevel,
  DietType,
  CookingLevel,
  NutritionalNeeds,
} from '../types'

// ============= OPTIONS =============

const genderOptions = [
  { value: 'male' as Gender, label: 'Homme', icon: '👨' },
  { value: 'female' as Gender, label: 'Femme', icon: '👩' },
  { value: 'other' as Gender, label: 'Autre', icon: '🧑' },
]

const goalOptions: { value: Goal; label: string; icon: string }[] = [
  { value: 'weight_loss', label: 'Perdre du poids', icon: '📉' },
  { value: 'muscle_gain', label: 'Prendre du muscle', icon: '💪' },
  { value: 'maintenance', label: 'Maintenir mon poids', icon: '⚖️' },
  { value: 'health', label: 'Améliorer ma santé', icon: '❤️' },
  { value: 'energy', label: "Plus d'énergie", icon: '⚡' },
]

const activityOptions: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sédentaire', description: 'Peu ou pas d\'exercice' },
  { value: 'light', label: 'Légèrement actif', description: '1-3 jours/semaine' },
  { value: 'moderate', label: 'Modérément actif', description: '3-5 jours/semaine' },
  { value: 'active', label: 'Actif', description: '6-7 jours/semaine' },
  { value: 'athlete', label: 'Très actif', description: 'Athlète ou travail physique' },
]

const dietOptions: { value: DietType; label: string; icon: string }[] = [
  { value: 'omnivore', label: 'Omnivore', icon: '🍖' },
  { value: 'vegetarian', label: 'Végétarien', icon: '🥗' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
  { value: 'pescatarian', label: 'Pescatarien', icon: '🐟' },
  { value: 'keto', label: 'Keto', icon: '🥑' },
  { value: 'paleo', label: 'Paléo', icon: '🥩' },
]

const cookingLevelOptions: { value: CookingLevel; label: string }[] = [
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced', label: 'Avancé' },
]

const commonAllergies = [
  'Gluten',
  'Lactose',
  'Arachides',
  'Fruits à coque',
  'Oeufs',
  'Soja',
  'Crustacés',
  'Poisson',
  'Sésame',
  'Moutarde',
]

// ============= NUTRITION CALCULATION =============

function calculateNeeds(profile: Partial<UserProfile>): NutritionalNeeds {
  const {
    weight = 70,
    height = 170,
    age = 30,
    gender = 'male',
    activityLevel = 'moderate',
    goal = 'maintenance',
    metabolismProfile = 'standard',
  } = profile

  // Harris-Benedict BMR calculation
  let bmr: number
  if (gender === 'female') {
    bmr = 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age
  } else {
    bmr = 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
  }

  // Activity multiplier
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    athlete: 1.9,
  }
  const tdee = bmr * activityMultipliers[activityLevel]

  // Goal adjustment
  let calories: number
  if (metabolismProfile === 'adaptive') {
    switch (goal) {
      case 'weight_loss':
        calories = tdee - 100
        break
      case 'muscle_gain':
        calories = tdee + 200
        break
      default:
        calories = tdee
    }
  } else {
    switch (goal) {
      case 'weight_loss':
        calories = tdee - 400
        break
      case 'muscle_gain':
        calories = tdee + 300
        break
      default:
        calories = tdee
    }
  }
  calories = Math.round(calories)

  // Macro distribution
  let proteinPerKg: number
  let fatPercentage: number

  if (metabolismProfile === 'adaptive') {
    proteinPerKg = 2.0
    fatPercentage = 0.3
  } else {
    proteinPerKg = goal === 'muscle_gain' ? 2.0 : goal === 'weight_loss' ? 1.8 : 1.6
    fatPercentage = 0.25
  }

  const proteins = Math.round(weight * proteinPerKg)
  const fats = Math.round((calories * fatPercentage) / 9)
  const carbs = Math.round((calories - proteins * 4 - fats * 9) / 4)

  return {
    calories,
    proteins,
    carbs,
    fats,
    fiber: 30,
    water: 2.5,
  }
}

// ============= SECTION COMPONENT =============

type SectionKey = 'basic' | 'goal' | 'activity' | 'diet' | 'cooking'

interface SectionHeaderProps {
  icon: React.ReactNode
  title: string
  isExpanded: boolean
  onToggle: () => void
}

function SectionHeader({ icon, title, isExpanded, onToggle }: SectionHeaderProps) {
  return (
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionIcon}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={[styles.expandIcon, isExpanded && styles.expandIconRotated]}>
        <ChevronLeft size={20} color={colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  )
}

// ============= ALLERGY PICKER =============

interface AllergyPickerProps {
  selected: string[]
  onChange: (allergies: string[]) => void
}

function AllergyPicker({ selected, onChange }: AllergyPickerProps) {
  const toggleAllergy = (allergy: string) => {
    if (selected.includes(allergy)) {
      onChange(selected.filter((a) => a !== allergy))
    } else {
      onChange([...selected, allergy])
    }
  }

  return (
    <View style={styles.allergyContainer}>
      <Text style={styles.inputLabel}>Allergies & intolérances</Text>
      <View style={styles.allergyGrid}>
        {commonAllergies.map((allergy) => {
          const isSelected = selected.includes(allergy)
          return (
            <TouchableOpacity
              key={allergy}
              style={[styles.allergyChip, isSelected && styles.allergyChipSelected]}
              onPress={() => toggleAllergy(allergy)}
              activeOpacity={0.7}
            >
              <Text style={[styles.allergyText, isSelected && styles.allergyTextSelected]}>
                {allergy}
              </Text>
              {isSelected && <Check size={14} color="#FFFFFF" />}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ============= MAIN SCREEN =============

export default function EditProfileScreen() {
  const navigation = useNavigation()
  const { profile, updateProfile: storeUpdateProfile, nutritionGoals } = useUserStore()

  // Local state for editing
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>(profile || {})
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>('basic')
  const [isSaving, setIsSaving] = useState(false)

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(profile) !== JSON.stringify(editedProfile)
  }, [profile, editedProfile])

  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        'Modifications non enregistrées',
        'Veux-tu enregistrer tes modifications avant de quitter ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Ne pas enregistrer',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
          {
            text: 'Enregistrer',
            onPress: handleSave,
          },
        ]
      )
    } else {
      navigation.goBack()
    }
  }, [hasChanges, navigation])

  const handleSave = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsSaving(true)

    // Recalculate nutritional needs based on new profile
    const newNeeds = calculateNeeds(editedProfile)

    const updates: Partial<UserProfile> = {
      ...editedProfile,
      nutritionalNeeds: newNeeds,
      updatedAt: new Date().toISOString(),
    }

    // Save to store using updateProfile (keeps isOnboarded intact)
    storeUpdateProfile(updates)

    // Brief delay for UX
    await new Promise((resolve) => setTimeout(resolve, 300))

    setIsSaving(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Go back immediately after success
    navigation.goBack()
  }, [editedProfile, storeUpdateProfile, navigation])

  const toggleSection = (section: SectionKey) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const updateProfile = (updates: Partial<UserProfile>) => {
    setEditedProfile((prev) => ({ ...prev, ...updates }))
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier le profil</Text>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          disabled={!hasChanges || isSaving}
        >
          <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Basic Info Section */}
          <View style={styles.section}>
            <SectionHeader
              icon={<User size={20} color={colors.accent.primary} />}
              title="Informations personnelles"
              isExpanded={expandedSection === 'basic'}
              onToggle={() => toggleSection('basic')}
            />
            {expandedSection === 'basic' && (
              <View style={styles.sectionContent}>
                <Input
                  label="Prénom"
                  placeholder="Ton prénom"
                  value={editedProfile.firstName || ''}
                  onChangeText={(text) => updateProfile({ firstName: text })}
                  autoCapitalize="words"
                />

                <Select
                  label="Genre"
                  placeholder="Sélectionnez"
                  value={editedProfile.gender}
                  options={genderOptions}
                  onChange={(value) => updateProfile({ gender: value })}
                />

                <Input
                  label="Âge"
                  placeholder="Ex: 35"
                  value={editedProfile.age?.toString() || ''}
                  onChangeText={(text) => updateProfile({ age: parseInt(text) || undefined })}
                  keyboardType="number-pad"
                />

                <Input
                  label="Taille (cm)"
                  placeholder="Ex: 175"
                  value={editedProfile.height?.toString() || ''}
                  onChangeText={(text) => updateProfile({ height: parseInt(text) || undefined })}
                  keyboardType="number-pad"
                />

                <Input
                  label="Poids actuel (kg)"
                  placeholder="Ex: 70"
                  value={editedProfile.weight?.toString() || ''}
                  onChangeText={(text) => updateProfile({ weight: parseFloat(text) || undefined })}
                  keyboardType="decimal-pad"
                />

                <Input
                  label="Poids objectif (kg)"
                  placeholder="Ex: 65 (optionnel)"
                  value={editedProfile.targetWeight?.toString() || ''}
                  onChangeText={(text) =>
                    updateProfile({ targetWeight: parseFloat(text) || undefined })
                  }
                  keyboardType="decimal-pad"
                  hint="Laisse vide pour maintenir ton poids"
                />
              </View>
            )}
          </View>

          {/* Goal Section */}
          <View style={styles.section}>
            <SectionHeader
              icon={<Target size={20} color={colors.secondary.primary} />}
              title="Objectif"
              isExpanded={expandedSection === 'goal'}
              onToggle={() => toggleSection('goal')}
            />
            {expandedSection === 'goal' && (
              <View style={styles.sectionContent}>
                {goalOptions.map((option) => {
                  const isSelected = editedProfile.goal === option.value
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => updateProfile({ goal: option.value })}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.optionIcon}>{option.icon}</Text>
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {option.label}
                      </Text>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>

          {/* Activity Section */}
          <View style={styles.section}>
            <SectionHeader
              icon={<Activity size={20} color={colors.success} />}
              title="Niveau d'activité"
              isExpanded={expandedSection === 'activity'}
              onToggle={() => toggleSection('activity')}
            />
            {expandedSection === 'activity' && (
              <View style={styles.sectionContent}>
                {activityOptions.map((option) => {
                  const isSelected = editedProfile.activityLevel === option.value
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => updateProfile({ activityLevel: option.value })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.optionContent}>
                        <Text
                          style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}
                        >
                          {option.label}
                        </Text>
                        <Text style={styles.optionDescription}>{option.description}</Text>
                      </View>
                      <View style={[styles.radio, isSelected && styles.radioSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>

          {/* Diet Section */}
          <View style={styles.section}>
            <SectionHeader
              icon={<Utensils size={20} color={colors.nutrients.carbs} />}
              title="Alimentation"
              isExpanded={expandedSection === 'diet'}
              onToggle={() => toggleSection('diet')}
            />
            {expandedSection === 'diet' && (
              <View style={styles.sectionContent}>
                <Text style={styles.inputLabel}>Type de régime</Text>
                <View style={styles.dietGrid}>
                  {dietOptions.map((option) => {
                    const isSelected = editedProfile.dietType === option.value
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[styles.dietCard, isSelected && styles.dietCardSelected]}
                        onPress={() => updateProfile({ dietType: option.value })}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dietIcon}>{option.icon}</Text>
                        <Text
                          style={[styles.dietLabel, isSelected && styles.dietLabelSelected]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <AllergyPicker
                  selected={editedProfile.allergies || []}
                  onChange={(allergies) => updateProfile({ allergies })}
                />
              </View>
            )}
          </View>

          {/* Cooking Section */}
          <View style={styles.section}>
            <SectionHeader
              icon={<ChefHat size={20} color={colors.warning} />}
              title="Préférences cuisine"
              isExpanded={expandedSection === 'cooking'}
              onToggle={() => toggleSection('cooking')}
            />
            {expandedSection === 'cooking' && (
              <View style={styles.sectionContent}>
                <Select
                  label="Niveau en cuisine"
                  placeholder="Sélectionnez"
                  value={editedProfile.cookingPreferences?.level}
                  options={cookingLevelOptions}
                  onChange={(value) =>
                    updateProfile({
                      cookingPreferences: {
                        ...editedProfile.cookingPreferences,
                        level: value,
                        weekdayTime: editedProfile.cookingPreferences?.weekdayTime || 30,
                        weekendTime: editedProfile.cookingPreferences?.weekendTime || 60,
                        batchCooking: editedProfile.cookingPreferences?.batchCooking || false,
                        quickMealsOnly: editedProfile.cookingPreferences?.quickMealsOnly || false,
                      },
                    })
                  }
                />

                <Input
                  label="Temps disponible en semaine (min)"
                  placeholder="Ex: 30"
                  value={editedProfile.cookingPreferences?.weekdayTime?.toString() || '30'}
                  onChangeText={(text) =>
                    updateProfile({
                      cookingPreferences: {
                        ...editedProfile.cookingPreferences,
                        level: editedProfile.cookingPreferences?.level || 'intermediate',
                        weekdayTime: parseInt(text) || 30,
                        weekendTime: editedProfile.cookingPreferences?.weekendTime || 60,
                        batchCooking: editedProfile.cookingPreferences?.batchCooking || false,
                        quickMealsOnly: editedProfile.cookingPreferences?.quickMealsOnly || false,
                      },
                    })
                  }
                  keyboardType="number-pad"
                />

                <Input
                  label="Temps disponible le week-end (min)"
                  placeholder="Ex: 60"
                  value={editedProfile.cookingPreferences?.weekendTime?.toString() || '60'}
                  onChangeText={(text) =>
                    updateProfile({
                      cookingPreferences: {
                        ...editedProfile.cookingPreferences,
                        level: editedProfile.cookingPreferences?.level || 'intermediate',
                        weekdayTime: editedProfile.cookingPreferences?.weekdayTime || 30,
                        weekendTime: parseInt(text) || 60,
                        batchCooking: editedProfile.cookingPreferences?.batchCooking || false,
                        quickMealsOnly: editedProfile.cookingPreferences?.quickMealsOnly || false,
                      },
                    })
                  }
                  keyboardType="number-pad"
                />

                {/* Batch Cooking Toggle */}
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() =>
                    updateProfile({
                      cookingPreferences: {
                        ...editedProfile.cookingPreferences,
                        level: editedProfile.cookingPreferences?.level || 'intermediate',
                        weekdayTime: editedProfile.cookingPreferences?.weekdayTime || 30,
                        weekendTime: editedProfile.cookingPreferences?.weekendTime || 60,
                        batchCooking: !editedProfile.cookingPreferences?.batchCooking,
                        quickMealsOnly: editedProfile.cookingPreferences?.quickMealsOnly || false,
                      },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Batch cooking</Text>
                    <Text style={styles.toggleHint}>Préparer plusieurs repas à l'avance</Text>
                  </View>
                  <View
                    style={[
                      styles.toggle,
                      editedProfile.cookingPreferences?.batchCooking && styles.toggleActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleDot,
                        editedProfile.cookingPreferences?.batchCooking && styles.toggleDotActive,
                      ]}
                    />
                  </View>
                </TouchableOpacity>

                {/* Quick Meals Toggle */}
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() =>
                    updateProfile({
                      cookingPreferences: {
                        ...editedProfile.cookingPreferences,
                        level: editedProfile.cookingPreferences?.level || 'intermediate',
                        weekdayTime: editedProfile.cookingPreferences?.weekdayTime || 30,
                        weekendTime: editedProfile.cookingPreferences?.weekendTime || 60,
                        batchCooking: editedProfile.cookingPreferences?.batchCooking || false,
                        quickMealsOnly: !editedProfile.cookingPreferences?.quickMealsOnly,
                      },
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleLabel}>Repas rapides uniquement</Text>
                    <Text style={styles.toggleHint}>Recettes de moins de 20 minutes</Text>
                  </View>
                  <View
                    style={[
                      styles.toggle,
                      editedProfile.cookingPreferences?.quickMealsOnly && styles.toggleActive,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleDot,
                        editedProfile.cookingPreferences?.quickMealsOnly && styles.toggleDotActive,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Bottom padding */}
          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed Save Button at bottom */}
      {hasChanges && (
        <View style={styles.bottomBar}>
          <Button onPress={handleSave} loading={isSaving} fullWidth>
            Enregistrer les modifications
          </Button>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.bodyMedium,
    color: colors.accent.primary,
  },
  saveButtonTextDisabled: {
    color: colors.text.tertiary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.default,
  },
  section: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.default,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  expandIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  expandIconRotated: {
    transform: [{ rotate: '90deg' }],
  },
  sectionContent: {
    padding: spacing.default,
    paddingTop: 0,
    gap: spacing.md,
  },
  inputLabel: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.light,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  optionLabelSelected: {
    color: colors.accent.primary,
  },
  optionDescription: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: 2,
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
  dietGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dietCard: {
    width: '31%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dietCardSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.light,
  },
  dietIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  dietLabel: {
    ...typography.small,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  dietLabelSelected: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
  allergyContainer: {
    marginTop: spacing.md,
  },
  allergyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  allergyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  allergyChipSelected: {
    backgroundColor: colors.accent.primary,
  },
  allergyText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  allergyTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  toggleHint: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg.tertiary,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.accent.primary,
  },
  toggleDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.default,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg.elevated,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
})
