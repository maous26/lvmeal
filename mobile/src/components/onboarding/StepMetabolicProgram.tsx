import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Zap, Sparkles, ChevronRight, TrendingUp } from 'lucide-react-native'
import { radius, spacing, typography } from '../../constants/theme'
import type { UserProfile } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

interface StepMetabolicProgramProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

export function StepMetabolicProgram({ data, onChange }: StepMetabolicProgramProps) {
  const { colors } = useTheme()

  const handleChoice = (wantsMetabolicProgram: boolean) => {
    onChange({ ...data, wantsMetabolicProgram })
  }

  const isYesSelected = data.wantsMetabolicProgram === true
  const isNoSelected = data.wantsMetabolicProgram === false

  return (
    <View style={styles.container}>
      {/* Introduction */}
      <View style={styles.intro}>
        <View style={[styles.iconContainer, { backgroundColor: colors.warningLight }]}>
          <Zap size={32} color={colors.warning} />
          <TrendingUp size={16} color={colors.success} style={styles.sparkle} />
        </View>
        <Text style={[styles.title, { color: colors.text.primary }]}>Programme Relance Métabolique</Text>
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          Ton profil indique un métabolisme adaptatif. Ce programme t'aidera à relancer
          ton métabolisme en douceur, sans frustration.
        </Text>
      </View>

      {/* Benefits */}
      <View style={[styles.benefits, { backgroundColor: colors.bg.elevated }]}>
        <Text style={[styles.benefitsTitle, { color: colors.text.tertiary }]}>Ce programme inclut :</Text>
        <View style={styles.benefitsList}>
          <BenefitItem emoji="🔥" text="Progression en 4 phases sur 9 semaines" />
          <BenefitItem emoji="🥗" text="Stratégie nutritionnelle adaptée" />
          <BenefitItem emoji="🚶" text="Marche active et activité douce" />
          <BenefitItem emoji="🧠" text="Suivi IA personnalisé" />
        </View>
      </View>

      {/* Alert about exclusion */}
      <View style={[styles.alertBox, { backgroundColor: colors.warningLight }]}>
        <Text style={styles.alertIcon}>⚠️</Text>
        <Text style={[styles.alertText, { color: colors.text.secondary }]}>
          Ce programme est exclusif : il ne peut pas être suivi en même temps que le programme Sport ou Bien-être.
        </Text>
      </View>

      {/* Choice buttons */}
      <View style={styles.choices}>
        <Pressable
          style={[
            styles.choiceButton,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: isYesSelected ? colors.warning : colors.border.light,
            },
            isYesSelected && { backgroundColor: colors.warningLight },
          ]}
          onPress={() => handleChoice(true)}
        >
          <View style={styles.choiceContent}>
            <Text style={styles.choiceEmoji}>⚡</Text>
            <View style={styles.choiceTextContainer}>
              <Text style={[styles.choiceTitle, { color: isYesSelected ? colors.warning : colors.text.primary }]}>
                Oui, je veux relancer mon métabolisme
              </Text>
              <Text style={[styles.choiceSubtitle, { color: colors.text.secondary }]}>
                Programme complet avec accompagnement IA
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={isYesSelected ? colors.warning : colors.text.tertiary} />
        </Pressable>

        <Pressable
          style={[
            styles.choiceButton,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: isNoSelected ? colors.text.tertiary : colors.border.light,
            },
            isNoSelected && { backgroundColor: colors.bg.secondary },
          ]}
          onPress={() => handleChoice(false)}
        >
          <View style={styles.choiceContent}>
            <Text style={styles.choiceEmoji}>⏭️</Text>
            <View style={styles.choiceTextContainer}>
              <Text style={[styles.choiceTitle, { color: colors.text.primary }]}>
                Non merci, peut-être plus tard
              </Text>
              <Text style={[styles.choiceSubtitle, { color: colors.text.secondary }]}>
                D'autres options te seront proposées
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color={isNoSelected ? colors.text.primary : colors.text.tertiary} />
        </Pressable>
      </View>

      {/* Reassurance */}
      <Text style={[styles.reassurance, { color: colors.text.muted }]}>
        Ce programme est optionnel et peut être activé ou désactivé à tout moment depuis ton profil.
      </Text>
    </View>
  )
}

function BenefitItem({ emoji, text }: { emoji: string; text: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.benefitItem}>
      <Text style={styles.benefitEmoji}>{emoji}</Text>
      <Text style={[styles.benefitText, { color: colors.text.primary }]}>{text}</Text>
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
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefits: {
    borderRadius: radius.lg,
    padding: spacing.default,
  },
  benefitsTitle: {
    ...typography.smallMedium,
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
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  alertIcon: {
    fontSize: 16,
  },
  alertText: {
    ...typography.small,
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
    borderRadius: radius.lg,
    borderWidth: 2,
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
  },
  choiceSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  reassurance: {
    ...typography.small,
    textAlign: 'center',
    fontStyle: 'italic',
  },
})

export default StepMetabolicProgram
