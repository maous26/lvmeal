import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native'
import { Activity, Heart, Zap, Watch } from 'lucide-react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, MetabolismFactors } from '../../types'

interface StepMetabolismProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

const metabolismQuestions: {
  id: keyof MetabolismFactors
  question: string
  explanation: string
  icon: string
}[] = [
  {
    id: 'restrictiveDietsHistory',
    question: 'Tu as deja fait plusieurs regimes restrictifs ?',
    explanation: "Ton corps a appris a s'adapter - c'est une force !",
    icon: '🛡️',
  },
  {
    id: 'eatsLessThanHunger',
    question: 'Tu manges souvent beaucoup moins que ta faim reelle ?',
    explanation: "Ecouter sa faim est la cle d'un equilibre durable",
    icon: '❤️',
  },
  {
    id: 'restrictionCrashCycle',
    question: 'Tu as des periodes ou tu manges tres peu puis craquage ?',
    explanation: 'Ce cycle est naturel quand on se restreint trop',
    icon: '🔥',
  },
  {
    id: 'metabolicSymptoms',
    question: 'Fatigue, froid, difficultes a perdre malgre peu de calories ?',
    explanation: "Ton corps te protege - on va l'accompagner en douceur",
    icon: '❄️',
  },
]

export function StepMetabolism({ data, onChange }: StepMetabolismProps) {
  const [factors, setFactors] = useState<Partial<MetabolismFactors>>(data.metabolismFactors || {})
  const [wantsMetabolicBoost, setWantsMetabolicBoost] = useState<boolean>(
    data.sportTrackingEnabled ?? false
  )

  const positiveCount = Object.values(factors).filter(Boolean).length
  const isAdaptive = positiveCount >= 2

  const handleFactorChange = (factorId: keyof MetabolismFactors, value: boolean) => {
    const updated = { ...factors, [factorId]: value }
    setFactors(updated)

    const count = Object.values(updated).filter(Boolean).length
    const profile = count >= 2 ? 'adaptive' : 'standard'

    onChange({
      ...data,
      metabolismFactors: updated as MetabolismFactors,
      metabolismProfile: profile,
    })
  }

  const handleMetabolicBoostToggle = (value: boolean) => {
    setWantsMetabolicBoost(value)
    onChange({
      ...data,
      sportTrackingEnabled: value,
      // Mark that user wants to join the metabolic boost program
      nutritionalStrategy: value
        ? {
            approach: 'metabolic_repair',
            currentPhase: 'discovery',
            weekInPhase: 1,
            deficitAmount: 0,
            proteinPriority: true,
            focusMetabolicHealth: true,
          }
        : undefined,
    })
  }

  return (
    <View style={styles.container}>
      {/* Introduction */}
      <View style={styles.intro}>
        <Text style={styles.introIcon}>✨</Text>
        <View style={styles.introContent}>
          <Text style={styles.introTitle}>Mieux te connaitre</Text>
          <Text style={styles.introText}>
            Ces questions nous aident a personnaliser ton accompagnement. Il n'y a pas de bonne ou mauvaise reponse !
          </Text>
        </View>
      </View>

      {/* Questions */}
      <View style={styles.questions}>
        {metabolismQuestions.map((q) => {
          const isChecked = factors[q.id] || false

          return (
            <Pressable
              key={q.id}
              onPress={() => handleFactorChange(q.id, !isChecked)}
              style={[styles.question, isChecked && styles.questionSelected]}
            >
              <View style={[styles.questionIcon, isChecked && styles.questionIconSelected]}>
                <Text style={styles.questionEmoji}>{q.icon}</Text>
              </View>

              <View style={styles.questionContent}>
                <Text style={styles.questionText}>{q.question}</Text>
                <Text style={styles.questionExplanation}>{q.explanation}</Text>
              </View>

              <View style={[styles.checkbox, isChecked && styles.checkboxSelected]}>
                {isChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* Adaptive message with Metabolic Boost program offer */}
      {isAdaptive && (
        <View style={styles.adaptiveSection}>
          <View style={styles.adaptiveMessage}>
            <View style={styles.adaptiveIcon}>
              <Text style={styles.adaptiveEmoji}>❤️</Text>
            </View>
            <View style={styles.adaptiveContent}>
              <Text style={styles.adaptiveTitle}>On va y aller en douceur</Text>
              <Text style={styles.adaptiveText}>
                On va relancer doucement ton metabolisme avec une approche progressive, sans frustration.
              </Text>
            </View>
          </View>

          {/* Metabolic Boost Program Offer */}
          <View style={styles.boostOffer}>
            <View style={styles.boostHeader}>
              <View style={styles.boostIconContainer}>
                <Zap size={24} color={colors.warning} />
              </View>
              <View style={styles.boostTitleContainer}>
                <Text style={styles.boostTitle}>Programme Relance Metabolique</Text>
                <Text style={styles.boostSubtitle}>9 semaines pour retrouver ton energie</Text>
              </View>
            </View>

            <View style={styles.boostFeatures}>
              <View style={styles.boostFeature}>
                <Activity size={16} color={colors.success} />
                <Text style={styles.boostFeatureText}>4 phases progressives adaptees</Text>
              </View>
              <View style={styles.boostFeature}>
                <Heart size={16} color={colors.error} />
                <Text style={styles.boostFeatureText}>Suivi bien-etre personnalise</Text>
              </View>
              <View style={styles.boostFeature}>
                <Watch size={16} color={colors.accent.primary} />
                <Text style={styles.boostFeatureText}>Compatible montres connectees</Text>
              </View>
            </View>

            <View style={styles.boostToggleRow}>
              <View style={styles.boostToggleText}>
                <Text style={styles.boostQuestion}>Je veux participer au programme</Text>
                <Text style={styles.boostHint}>Tu pourras connecter ta montre plus tard</Text>
              </View>
              <Switch
                value={wantsMetabolicBoost}
                onValueChange={handleMetabolicBoostToggle}
                trackColor={{ false: colors.border.default, true: colors.success }}
                thumbColor={wantsMetabolicBoost ? '#FFFFFF' : '#f4f3f4'}
              />
            </View>
          </View>
        </View>
      )}

      {/* Standard message */}
      {!isAdaptive && positiveCount > 0 && (
        <View style={styles.standardMessage}>
          <Text style={styles.standardText}>
            Merci pour ces infos ! On adapte ton programme en consequence.
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  intro: {
    flexDirection: 'row',
    padding: spacing.default,
    backgroundColor: colors.accent.light,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: `${colors.accent.primary}30`,
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
    color: colors.text.primary,
  },
  introText: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  questions: {
    gap: spacing.sm,
  },
  question: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.default,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  questionSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.light,
  },
  questionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  questionIconSelected: {
    backgroundColor: colors.accent.primary,
  },
  questionEmoji: {
    fontSize: 20,
  },
  questionContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  questionText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  questionExplanation: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  checkboxSelected: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  adaptiveSection: {
    gap: spacing.md,
  },
  adaptiveMessage: {
    flexDirection: 'row',
    padding: spacing.default,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  adaptiveIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  adaptiveEmoji: {
    fontSize: 20,
  },
  adaptiveContent: {
    flex: 1,
  },
  adaptiveTitle: {
    ...typography.bodySemibold,
    color: '#059669',
  },
  adaptiveText: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  // Metabolic Boost Program Offer
  boostOffer: {
    padding: spacing.default,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    gap: spacing.md,
  },
  boostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boostIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  boostTitleContainer: {
    flex: 1,
  },
  boostTitle: {
    ...typography.bodySemibold,
    color: colors.warning,
  },
  boostSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  boostFeatures: {
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  boostFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  boostFeatureText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  boostToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.15)',
  },
  boostToggleText: {
    flex: 1,
    marginRight: spacing.md,
  },
  boostQuestion: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  boostHint: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  standardMessage: {
    padding: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
  },
  standardText: {
    ...typography.small,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
})

export default StepMetabolism
