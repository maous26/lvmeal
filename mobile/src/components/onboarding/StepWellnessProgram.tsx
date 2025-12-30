import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Heart, Sparkles, ChevronRight, Moon, Brain } from 'lucide-react-native'
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
      {/* Introduction */}
      <View style={styles.intro}>
        <View style={styles.iconContainer}>
          <Heart size={32} color={colors.secondary.primary} />
          <Sparkles size={16} color={colors.warning} style={styles.sparkle} />
        </View>
        <Text style={styles.title}>Programme Bien-etre</Text>
        <Text style={styles.description}>
          Cultive ton equilibre mental et physique avec un programme complet de meditation,
          respiration et gestion du stress.
        </Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefits}>
        <Text style={styles.benefitsTitle}>Ce programme inclut :</Text>
        <View style={styles.benefitsList}>
          <BenefitItem emoji="🧘" text="Meditations guidees quotidiennes" />
          <BenefitItem emoji="🌬️" text="Exercices de coherence cardiaque" />
          <BenefitItem emoji="😴" text="Suivi du sommeil et recuperation" />
          <BenefitItem emoji="📝" text="Journal de gratitude et insights IA" />
        </View>
      </View>

      {/* Alert about exclusion */}
      <View style={styles.alertBox}>
        <Text style={styles.alertIcon}>💡</Text>
        <Text style={styles.alertText}>
          Ce programme ne peut pas etre suivi en meme temps que le programme Metabolisme.
          Tu peux cependant le combiner avec le programme Sport.
        </Text>
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
                Oui, je veux cultiver mon bien-etre
              </Text>
              <Text style={styles.choiceSubtitle}>
                8 semaines de pratiques guidees
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={isYesSelected ? colors.secondary.primary : colors.text.tertiary} />
        </Pressable>

        <Pressable
          style={[styles.choiceButton, isNoSelected && styles.choiceNoSelected]}
          onPress={() => handleChoice(false)}
        >
          <View style={styles.choiceContent}>
            <Text style={styles.choiceEmoji}>⏭️</Text>
            <View style={styles.choiceTextContainer}>
              <Text style={[styles.choiceTitle, isNoSelected && styles.choiceTitleNoSelected]}>
                Non merci, peut-etre plus tard
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
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
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
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  alertIcon: {
    fontSize: 16,
  },
  alertText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
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
    borderColor: colors.secondary.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
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
    color: colors.secondary.primary,
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

export default StepWellnessProgram
