import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, MetabolismFactors } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

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
    question: 'Tu as déjà fait plusieurs régimes restrictifs ?',
    explanation: "Ton corps a appris à s'adapter — c'est une force !",
    icon: '🛡️',
  },
  {
    id: 'eatsLessThanHunger',
    question: 'Tu manges souvent beaucoup moins que ta faim réelle ?',
    explanation: "Écouter sa faim est la clé d'un équilibre durable",
    icon: '❤️',
  },
  {
    id: 'restrictionCrashCycle',
    question: 'Tu as des périodes où tu manges très peu, puis craquage ?',
    explanation: 'Ce cycle est naturel quand on se restreint trop',
    icon: '🔥',
  },
  {
    id: 'metabolicSymptoms',
    question: 'Fatigue, froid, difficultés à perdre malgré peu de calories ?',
    explanation: "Ton corps te protège — on va l'accompagner en douceur",
    icon: '❄️',
  },
]

export function StepMetabolism({ data, onChange }: StepMetabolismProps) {
  const { colors } = useTheme()
  const [factors, setFactors] = useState<Partial<MetabolismFactors>>(data.metabolismFactors || {})

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

  return (
    <View style={styles.container}>
      {/* Introduction */}
      <View style={[styles.intro, { backgroundColor: colors.accent.light, borderColor: `${colors.accent.primary}30` }]}>
        <Text style={styles.introIcon}>✨</Text>
        <View style={styles.introContent}>
          <Text style={[styles.introTitle, { color: colors.text.primary }]}>Mieux te connaître</Text>
          <Text style={[styles.introText, { color: colors.text.secondary }]}>
            Ces questions nous aident à personnaliser ton accompagnement. Il n'y a pas de bonne ou mauvaise réponse !
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
              style={[
                styles.question,
                {
                  backgroundColor: colors.bg.elevated,
                  borderColor: isChecked ? colors.accent.primary : colors.border.light,
                },
                isChecked && { backgroundColor: colors.accent.light },
              ]}
            >
              <View
                style={[
                  styles.questionIcon,
                  { backgroundColor: isChecked ? colors.accent.primary : colors.bg.secondary },
                ]}
              >
                <Text style={styles.questionEmoji}>{q.icon}</Text>
              </View>

              <View style={styles.questionContent}>
                <Text style={[styles.questionText, { color: colors.text.primary }]}>{q.question}</Text>
                <Text style={[styles.questionExplanation, { color: colors.text.tertiary }]}>{q.explanation}</Text>
              </View>

              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: isChecked ? colors.accent.primary : colors.border.default,
                    backgroundColor: isChecked ? colors.accent.primary : 'transparent',
                  },
                ]}
              >
                {isChecked && <Text style={[styles.checkmark, { color: colors.text.inverse }]}>✓</Text>}
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* Adaptive message - Program will be proposed in next step */}
      {isAdaptive && (
        <View style={[styles.adaptiveMessage, { backgroundColor: colors.successLight, borderColor: `${colors.success}30` }]}>
          <View style={[styles.adaptiveIcon, { backgroundColor: `${colors.success}20` }]}>
            <Text style={styles.adaptiveEmoji}>❤️</Text>
          </View>
          <View style={styles.adaptiveContent}>
            <Text style={[styles.adaptiveTitle, { color: colors.success }]}>On va y aller en douceur</Text>
            <Text style={[styles.adaptiveText, { color: colors.text.secondary }]}>
              On va te proposer un programme adapté à ton profil à l'étape suivante.
            </Text>
          </View>
        </View>
      )}

      {/* Standard message */}
      {!isAdaptive && positiveCount > 0 && (
        <View style={[styles.standardMessage, { backgroundColor: colors.bg.tertiary }]}>
          <Text style={[styles.standardText, { color: colors.text.tertiary }]}>
            Merci pour ces infos ! On adapte ton programme en conséquence.
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
  questions: {
    gap: spacing.sm,
  },
  question: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  questionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
    fontWeight: '500',
  },
  questionExplanation: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '600',
  },
  adaptiveMessage: {
    flexDirection: 'row',
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  adaptiveIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  adaptiveText: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  standardMessage: {
    padding: spacing.md,
    borderRadius: radius.md,
  },
  standardText: {
    ...typography.small,
    textAlign: 'center',
  },
})

export default StepMetabolism
