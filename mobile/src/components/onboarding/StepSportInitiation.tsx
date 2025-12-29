import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Dumbbell, Sparkles, ChevronRight } from 'lucide-react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { UserProfile } from '../../types'

interface StepSportInitiationProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

export function StepSportInitiation({ data, onChange }: StepSportInitiationProps) {
  const handleChoice = (wantsSportProgram: boolean) => {
    onChange({ ...data, wantsSportInitiation: wantsSportProgram })
  }

  const isYesSelected = data.wantsSportInitiation === true
  const isNoSelected = data.wantsSportInitiation === false

  return (
    <View style={styles.container}>
      {/* Introduction */}
      <View style={styles.intro}>
        <View style={styles.iconContainer}>
          <Dumbbell size={32} color={colors.success} />
          <Sparkles size={16} color={colors.warning} style={styles.sparkle} />
        </View>
        <Text style={styles.title}>Programme d'initiation sportive</Text>
        <Text style={styles.description}>
          Vous avez indique un mode de vie sedentaire. Souhaitez-vous etre accompagne
          pour reprendre une activite physique en douceur ?
        </Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefits}>
        <Text style={styles.benefitsTitle}>Ce programme inclut :</Text>
        <View style={styles.benefitsList}>
          <BenefitItem emoji="🚶" text="Progression douce en 4 phases" />
          <BenefitItem emoji="📅" text="Exercices adaptes a votre niveau" />
          <BenefitItem emoji="💪" text="Conseils personnalises par IA" />
          <BenefitItem emoji="🏆" text="Suivi de vos progres" />
        </View>
      </View>

      {/* Choice buttons */}
      <View style={styles.choices}>
        <Pressable
          style={[styles.choiceButton, styles.choiceYes, isYesSelected && styles.choiceSelected]}
          onPress={() => handleChoice(true)}
        >
          <View style={styles.choiceContent}>
            <Text style={styles.choiceEmoji}>✨</Text>
            <View style={styles.choiceTextContainer}>
              <Text style={[styles.choiceTitle, isYesSelected && styles.choiceTitleSelected]}>
                Oui, je veux commencer
              </Text>
              <Text style={styles.choiceSubtitle}>
                Programme personnalise avec LymIA
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={isYesSelected ? colors.success : colors.text.tertiary} />
        </Pressable>

        <Pressable
          style={[styles.choiceButton, isNoSelected && styles.choiceNoSelected]}
          onPress={() => handleChoice(false)}
        >
          <View style={styles.choiceContent}>
            <Text style={styles.choiceEmoji}>⏭️</Text>
            <View style={styles.choiceTextContainer}>
              <Text style={[styles.choiceTitle, isNoSelected && styles.choiceTitleNoSelected]}>
                Pas pour le moment
              </Text>
              <Text style={styles.choiceSubtitle}>
                Activable a tout moment dans le profil
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={isNoSelected ? colors.text.primary : colors.text.tertiary} />
        </Pressable>
      </View>

      {/* Reassurance */}
      <Text style={styles.reassurance}>
        Ce programme est optionnel et peut etre active ou desactive a tout moment depuis votre profil.
      </Text>
    </View>
  )
}

function BenefitItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.benefitItem}>
      <Text style={styles.benefitEmoji}>{emoji}</Text>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  intro: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  iconContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  sparkle: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefits: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.default,
  },
  benefitsTitle: {
    ...typography.smallMedium,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  benefitsList: {
    gap: spacing.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitEmoji: {
    fontSize: 18,
  },
  benefitText: {
    ...typography.body,
    color: colors.text.primary,
  },
  choices: {
    gap: spacing.sm,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.default,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  choiceYes: {},
  choiceSelected: {
    borderColor: colors.success,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  choiceNoSelected: {
    borderColor: colors.text.tertiary,
    backgroundColor: colors.bg.secondary,
  },
  choiceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  choiceEmoji: {
    fontSize: 24,
    marginRight: spacing.default,
  },
  choiceTextContainer: {
    flex: 1,
  },
  choiceTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  choiceTitleSelected: {
    color: colors.success,
  },
  choiceTitleNoSelected: {
    color: colors.text.primary,
  },
  choiceSubtitle: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: 2,
  },
  reassurance: {
    ...typography.small,
    color: colors.text.muted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
})

export default StepSportInitiation
