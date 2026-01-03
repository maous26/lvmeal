import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Heart, Check } from 'lucide-react-native'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, Goal } from '../../types'
import type { HealthPriority } from '../../features/goals/types'
import { useGoalsStore } from '../../features/goals/stores/goals-store'

// =============================================================================
// TYPES
// =============================================================================

export interface WellnessToolsContext {
  goal?: Goal
  healthPriorities: HealthPriority[]
}

interface WellnessToolsCopy {
  title: string
  subtitle: string
  features: { emoji: string; text: string }[]
  ctaActivate: string
  ctaLater: string
}

interface StepWellnessProgramProps {
  data: Partial<UserProfile>
  onChange: (data: Partial<UserProfile>) => void
}

// =============================================================================
// CONTEXTUAL COPY LOGIC
// =============================================================================

/**
 * Get wellness tools copy based on user context
 *
 * CAS A: goal = health + priorité stress
 * CAS B: goal = health + autres priorités
 * CAS C: goal ≠ health (perte de poids / muscle)
 */
function getWellnessToolsCopy(context: WellnessToolsContext): WellnessToolsCopy {
  const { goal, healthPriorities } = context
  const hasStressPriority = healthPriorities.includes('stress')
  const hasEnergyPriority = healthPriorities.includes('more_energy')
  const isHealthGoal = goal === 'health'

  // CAS A — goal = health + priorité = stress
  if (isHealthGoal && hasStressPriority) {
    return {
      title: 'Des outils pour relacher la pression',
      subtitle: 'Meditations, respirations et check-ins emotionnels, penses pour t\'aider a gerer le stress au quotidien.',
      features: [
        { emoji: '🧘', text: 'Meditations guidees' },
        { emoji: '🌬️', text: 'Exercices de respiration' },
        { emoji: '💭', text: 'Check-ins emotionnels' },
      ],
      ctaActivate: 'Activer les outils',
      ctaLater: 'Plus tard',
    }
  }

  // CAS B — goal = health + priorités ≠ stress (mais peut avoir energy)
  if (isHealthGoal) {
    const subtitle = hasEnergyPriority
      ? 'Respiration, meditation et check-ins peuvent t\'aider a mieux recuperer et garder une bonne energie.'
      : 'En complement de tes choix nutrition, ces outils peuvent soutenir ton equilibre au quotidien.'

    return {
      title: 'Envie d\'outils pour soutenir ton equilibre ?',
      subtitle,
      features: [
        { emoji: '🌬️', text: 'Respiration' },
        { emoji: '🧘', text: 'Meditation' },
        { emoji: '📝', text: 'Check-ins' },
      ],
      ctaActivate: 'Activer',
      ctaLater: 'Plus tard',
    }
  }

  // CAS C — goal ≠ health (perte de poids / muscle)
  return {
    title: 'En complement, des outils bien-etre ?',
    subtitle: 'Pour le stress, la recuperation et l\'equilibre mental. Si tu en as envie.',
    features: [
      { emoji: '🧘', text: 'Relaxation' },
      { emoji: '😴', text: 'Recuperation' },
      { emoji: '💆', text: 'Anti-stress' },
    ],
    ctaActivate: 'Activer',
    ctaLater: 'Plus tard',
  }
}

/**
 * Determine if wellness tools step should be shown
 * Always returns true - the tools are always proposed as optional
 * But the copy adapts to context
 */
export function shouldShowWellnessTools(_context: WellnessToolsContext): boolean {
  // Always show - it's an optional complement
  // The copy will adapt to make it feel natural
  return true
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StepWellnessProgram({ data, onChange }: StepWellnessProgramProps) {
  // Get health priorities from goals store
  const { healthPriorities } = useGoalsStore()

  // Build context for copy selection
  const context: WellnessToolsContext = useMemo(() => ({
    goal: data.goal,
    healthPriorities,
  }), [data.goal, healthPriorities])

  // Get contextual copy
  const copy = useMemo(() => getWellnessToolsCopy(context), [context])

  const handleChoice = (wantsWellnessProgram: boolean) => {
    onChange({ ...data, wantsWellnessProgram })
  }

  const isYesSelected = data.wantsWellnessProgram === true
  const isNoSelected = data.wantsWellnessProgram === false

  return (
    <View style={styles.container}>
      {/* Hero section - contextual */}
      <View style={styles.hero}>
        <View style={styles.iconContainer}>
          <Heart size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.heroTitle}>{copy.title}</Text>
        <Text style={styles.heroSubtitle}>{copy.subtitle}</Text>
      </View>

      {/* Features - contextual */}
      <View style={styles.features}>
        {copy.features.map((feature, index) => (
          <FeatureItem key={index} emoji={feature.emoji} text={feature.text} />
        ))}
      </View>

      {/* Choices - simplified */}
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
              {copy.ctaActivate}
            </Text>
            <Text style={styles.choiceSubtitle}>Disponible dans l'app</Text>
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
              {copy.ctaLater}
            </Text>
            <Text style={styles.choiceSubtitle}>Toujours accessible depuis le profil</Text>
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
