import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  Zap,
  User,
  Scale,
  ChevronRight,
  Info,
  ArrowLeft,
} from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography, shadows } from '../../constants/theme'
import type { UserProfile, Gender } from '../../types'

interface StepQuickSetupProps {
  onComplete: (profile: Partial<UserProfile>) => void
  onBack: () => void
  onSwitchToFull: () => void
}

export function StepQuickSetup({ onComplete, onBack, onSwitchToFull }: StepQuickSetupProps) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()

  const [firstName, setFirstName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')

  const isValid = firstName.trim() && gender && age && weight

  const handleComplete = () => {
    if (!isValid) return

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    // Create a minimal profile with smart defaults
    const quickProfile: Partial<UserProfile> = {
      firstName: firstName.trim(),
      gender,
      age: parseInt(age, 10),
      weight: parseFloat(weight),
      // Smart defaults
      height: gender === 'female' ? 165 : 175, // Moyenne française
      targetWeight: parseFloat(weight), // Maintenance par défaut
      activityLevel: 'moderate',
      goal: 'maintenance',
      dietType: 'omnivore',
      cookingPreferences: {
        level: 'intermediate',
        weekdayTime: 30,
        weekendTime: 60,
        batchCooking: false,
        quickMealsOnly: false,
      },
      metabolismProfile: 'standard',
      mealSourcePreference: 'balanced',
      // Mark as quick setup for later prompts
      quickSetupCompleted: true,
      onboardingCompleted: false, // Will prompt to complete later
    }

    onComplete(quickProfile)
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={[styles.quickBadge, { backgroundColor: colors.accent.light }]}>
          <Zap size={16} color={colors.accent.primary} />
          <Text style={[styles.quickBadgeText, { color: colors.accent.primary }]}>
            Mode Rapide
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              Configuration Express
            </Text>
            <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
              30 secondes pour commencer
            </Text>
          </View>

          {/* Fields */}
          <View style={styles.fieldsContainer}>
            {/* First Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
                Prénom
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}>
                <User size={20} color={colors.text.tertiary} />
                <TextInput
                  style={[styles.textInput, { color: colors.text.primary }]}
                  placeholder="Ton prénom"
                  placeholderTextColor={colors.text.muted}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Gender */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
                Sexe
              </Text>
              <View style={styles.genderRow}>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
                    gender === 'male' && { backgroundColor: colors.accent.light, borderColor: colors.accent.primary },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setGender('male')
                  }}
                >
                  <Text style={styles.genderEmoji}>👨</Text>
                  <Text style={[
                    styles.genderText,
                    { color: gender === 'male' ? colors.accent.primary : colors.text.secondary }
                  ]}>
                    Homme
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
                    gender === 'female' && { backgroundColor: colors.accent.light, borderColor: colors.accent.primary },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setGender('female')
                  }}
                >
                  <Text style={styles.genderEmoji}>👩</Text>
                  <Text style={[
                    styles.genderText,
                    { color: gender === 'female' ? colors.accent.primary : colors.text.secondary }
                  ]}>
                    Femme
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Age & Weight Row */}
            <View style={styles.rowFields}>
              {/* Age */}
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
                  Âge
                </Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}>
                  <TextInput
                    style={[styles.textInput, styles.centeredInput, { color: colors.text.primary }]}
                    placeholder="25"
                    placeholderTextColor={colors.text.muted}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={[styles.unitText, { color: colors.text.tertiary }]}>ans</Text>
                </View>
              </View>

              {/* Weight */}
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
                  Poids actuel
                </Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}>
                  <Scale size={20} color={colors.text.tertiary} />
                  <TextInput
                    style={[styles.textInput, { color: colors.text.primary }]}
                    placeholder="70"
                    placeholderTextColor={colors.text.muted}
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                  <Text style={[styles.unitText, { color: colors.text.tertiary }]}>kg</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Warning Card - Important */}
          <View style={[styles.warningCard, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}>
            <View style={styles.warningHeader}>
              <Text style={styles.warningEmoji}>⚠️</Text>
              <Text style={[styles.warningTitle, { color: colors.warning }]}>
                Recommandations moins précises
              </Text>
            </View>
            <Text style={[styles.warningText, { color: colors.text.primary }]}>
              Sans ton objectif, régime alimentaire et niveau d'activité, les calories calculées seront approximatives et les recommandations moins adaptées à tes besoins.
            </Text>
            <View style={styles.warningBullets}>
              <Text style={[styles.warningBullet, { color: colors.text.secondary }]}>
                • Calories basées sur des moyennes générales
              </Text>
              <Text style={[styles.warningBullet, { color: colors.text.secondary }]}>
                • Pas de prise en compte des allergies
              </Text>
              <Text style={[styles.warningBullet, { color: colors.text.secondary }]}>
                • Conseils IA moins personnalisés
              </Text>
            </View>
          </View>

          {/* CTA to complete full onboarding */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onSwitchToFull()
            }}
            style={[styles.fullOnboardingButton, { backgroundColor: colors.success + '15', borderColor: colors.success }]}
          >
            <Text style={styles.fullOnboardingEmoji}>✨</Text>
            <View style={styles.fullOnboardingContent}>
              <Text style={[styles.fullOnboardingTitle, { color: colors.success }]}>
                Je préfère un suivi optimal
              </Text>
              <Text style={[styles.fullOnboardingSubtitle, { color: colors.text.secondary }]}>
                2 min pour un accompagnement vraiment personnalisé
              </Text>
            </View>
            <ChevronRight size={20} color={colors.success} />
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
          <TouchableOpacity
            onPress={handleComplete}
            disabled={!isValid}
            activeOpacity={0.8}
            style={[
              styles.ctaButton,
              { backgroundColor: isValid ? colors.accent.primary : colors.bg.tertiary },
              isValid && shadows.glowPrimary,
            ]}
          >
            <Zap size={20} color={isValid ? '#FFFFFF' : colors.text.muted} />
            <Text style={[
              styles.ctaText,
              { color: isValid ? '#FFFFFF' : colors.text.muted }
            ]}>
              C'est parti !
            </Text>
            <ChevronRight size={20} color={isValid ? '#FFFFFF' : colors.text.muted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  quickBadgeText: {
    ...typography.captionMedium,
  },
  headerSpacer: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  titleContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
  },
  fieldsContainer: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.captionMedium,
    marginLeft: spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    ...typography.body,
    padding: 0,
  },
  centeredInput: {
    textAlign: 'center',
  },
  unitText: {
    ...typography.small,
  },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  genderEmoji: {
    fontSize: 24,
  },
  genderText: {
    ...typography.bodyMedium,
  },
  rowFields: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  warningCard: {
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningEmoji: {
    fontSize: 20,
  },
  warningTitle: {
    ...typography.bodySemibold,
  },
  warningText: {
    ...typography.small,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  warningBullets: {
    gap: spacing.xs,
  },
  warningBullet: {
    ...typography.small,
    lineHeight: 18,
  },
  fullOnboardingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    gap: spacing.md,
  },
  fullOnboardingEmoji: {
    fontSize: 24,
  },
  fullOnboardingContent: {
    flex: 1,
  },
  fullOnboardingTitle: {
    ...typography.bodySemibold,
  },
  fullOnboardingSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  ctaText: {
    ...typography.button,
  },
})

export default StepQuickSetup
