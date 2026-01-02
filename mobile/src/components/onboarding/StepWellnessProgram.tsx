import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Heart, Sparkles, Check } from 'lucide-react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { UserProfile } from '../../types'

interface StepWellnessProgramProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

export function StepWellnessProgram({ data, onChange }: StepWellnessProgramProps) {
  const handleChoice = (wantsWellnessProgram: boolean) => {
    onChange({ ...data, wantsWellnessProgram })
  }

  const isYesSelected = data.wantsWellnessProgram === true
  const isNoSelected = data.wantsWellnessProgram === false

  return (
    <View style={styles.container}>
      {/* Hero section - simple et accueillant */}
      <View style={styles.hero}>
        <View style={styles.iconContainer}>
          <Heart size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.heroTitle}>Prends soin de toi</Text>
        <Text style={styles.heroSubtitle}>
          Sommeil, stress, energie... tout est lie a ton bien-etre.
        </Text>
      </View>

      {/* Ce que ca apporte - version epuree */}
      <View style={styles.features}>
        <FeatureItem emoji="🧘" text="Exercices de respiration" />
        <FeatureItem emoji="😴" text="Suivi du sommeil" />
        <FeatureItem emoji="💆" text="Gestion du stress" />
      </View>

      {/* Choix simple */}
      <View style={styles.choices}>
        <Pressable
          style={[styles.choiceCard, isYesSelected && styles.choiceCardSelected]}
          onPress={() => handleChoice(true)}
        >
          <View style={[styles.radio, isYesSelected && styles.radioSelected]}>
            {isYesSelected && <Check size={14} color="#FFFFFF" />}
          </View>
          <View style={styles.choiceContent}>
            <Text style={[styles.choiceTitle, isYesSelected && styles.choiceTitleSelected]}>
              Oui, je veux !
            </Text>
            <Text style={styles.choiceSubtitle}>Activer le suivi bien-etre</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.choiceCard, isNoSelected && styles.choiceCardNo]}
          onPress={() => handleChoice(false)}
        >
          <View style={[styles.radio, isNoSelected && styles.radioNo]}>
            {isNoSelected && <Check size={14} color={colors.text.secondary} />}
          </View>
          <View style={styles.choiceContent}>
            <Text style={[styles.choiceTitle, isNoSelected && styles.choiceTitleNo]}>
              Plus tard
            </Text>
            <Text style={styles.choiceSubtitle}>Activer depuis le profil</Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

function FeatureItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.secondary.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  featureItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureEmoji: {
    fontSize: 32,
  },
  featureText: {
    ...typography.small,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 90,
  },
  choices: {
    gap: spacing.md,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border.light,
    gap: spacing.md,
  },
  choiceCardSelected: {
    borderColor: colors.secondary.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  choiceCardNo: {
    borderColor: colors.border.default,
    backgroundColor: colors.bg.secondary,
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.secondary.primary,
    backgroundColor: colors.secondary.primary,
  },
  radioNo: {
    borderColor: colors.text.tertiary,
    backgroundColor: colors.bg.tertiary,
  },
  choiceContent: {
    flex: 1,
  },
  choiceTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  choiceTitleSelected: {
    color: colors.secondary.primary,
    fontWeight: '600',
  },
  choiceTitleNo: {
    color: colors.text.secondary,
  },
  choiceSubtitle: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: 2,
  },
})

export default StepWellnessProgram
