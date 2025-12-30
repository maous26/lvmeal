import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Zap, Sparkles, ChevronRight, TrendingUp } from 'lucide-react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { UserProfile } from '../../types'

interface StepMetabolicProgramProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

export function StepMetabolicProgram({ data, onChange }: StepMetabolicProgramProps) {
  const handleChoice = (wantsMetabolicProgram: boolean) => {
    onChange({ ...data, wantsMetabolicProgram })
  }

  const isYesSelected = data.wantsMetabolicProgram === true
  const isNoSelected = data.wantsMetabolicProgram === false

  return (
    <View style={styles.container}>
      {/* Introduction */}
      <View style={styles.intro}>
        <View style={styles.iconContainer}>
          <Zap size={32} color={colors.warning} />
          <TrendingUp size={16} color={colors.success} style={styles.sparkle} />
        </View>
        <Text style={styles.title}>Programme Relance Metabolique</Text>
        <Text style={styles.description}>
          Ton profil indique un metabolisme adaptatif. Ce programme t'aidera a relancer
          ton metabolisme en douceur, sans frustration.
        </Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefits}>
        <Text style={styles.benefitsTitle}>Ce programme inclut :</Text>
        <View style={styles.benefitsList}>
          <BenefitItem emoji="🔥" text="Progression en 4 phases sur 9 semaines" />
          <BenefitItem emoji="🥗" text="Strategie nutritionnelle adaptee" />
          <BenefitItem emoji="🚶" text="Marche active et activite douce" />
          <BenefitItem emoji="🧠" text="Suivi IA personnalise" />
        </View>
      </View>

      {/* Alert about exclusion */}
      <View style={styles.alertBox}>
        <Text style={styles.alertIcon}>⚠️</Text>
        <Text style={styles.alertText}>
          Ce programme est exclusif : il ne peut pas etre suivi en meme temps que le programme Sport ou Bien-etre.
        </Text>
      </View>

      {/* Choice buttons */}
      <View style={styles.choices}>
        <Pressable
          style={[styles.choiceButton, styles.choiceYes, isYesSelected && styles.choiceSelected]}
          onPress={() => handleChoice(true)}
        >
          <View style={styles.choiceContent}>
            <Text style={styles.choiceEmoji}>⚡</Text>
            <View style={styles.choiceTextContainer}>
              <Text style={[styles.choiceTitle, isYesSelected && styles.choiceTitleSelected]}>
                Oui, je veux relancer mon metabolisme
              </Text>
              <Text style={styles.choiceSubtitle}>
                Programme complet avec accompagnement IA
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={isYesSelected ? colors.warning : colors.text.tertiary} />
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
                D'autres options te seront proposees
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
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
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
    borderColor: colors.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
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
    color: colors.warning,
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

export default StepMetabolicProgram
