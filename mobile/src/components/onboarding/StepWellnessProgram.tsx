import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Heart, Check } from 'lucide-react-native'
import { radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, Goal } from '../../types'
import type { HealthPriority } from '../../features/goals/types'
import { useGoalsStore } from '../../features/goals/stores/goals-store'
import { useTheme } from '../../contexts/ThemeContext'

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
      title: 'Des outils pour relâcher la pression',
      subtitle: "Méditations, respirations et check-ins émotionnels, pensés pour t'aider à gérer le stress au quotidien.",
      features: [
        { emoji: '🧘', text: 'Méditations guidées' },
        { emoji: '🌬️', text: 'Exercices de respiration' },
        { emoji: '💭', text: 'Check-ins émotionnels' },
      ],
      ctaActivate: 'Activer les outils',
      ctaLater: 'Plus tard',
    }
  }

  // CAS B — goal = health + priorités ≠ stress (mais peut avoir energy)
  if (isHealthGoal) {
    const subtitle = hasEnergyPriority
      ? "Respiration, méditation et check-ins peuvent t'aider à mieux récupérer et garder une bonne énergie."
      : "En complément de tes choix nutrition, ces outils peuvent soutenir ton équilibre au quotidien."

    return {
      title: "Envie d'outils pour soutenir ton équilibre ?",
      subtitle,
      features: [
        { emoji: '🌬️', text: 'Respiration' },
        { emoji: '🧘', text: 'Méditation' },
        { emoji: '📝', text: 'Check-ins' },
      ],
      ctaActivate: 'Activer',
      ctaLater: 'Plus tard',
    }
  }

  // CAS C — goal ≠ health (perte de poids / muscle)
  return {
    title: 'En complément, des outils bien-être ?',
    subtitle: "Pour le stress, la récupération et l'équilibre mental. Si tu en as envie.",
    features: [
      { emoji: '🧘', text: 'Relaxation' },
      { emoji: '😴', text: 'Récupération' },
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
  const { colors } = useTheme()
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
        <View style={[styles.iconContainer, { backgroundColor: colors.secondary.primary }]}>
          <Heart size={40} color="#FFFFFF" />
        </View>
        <Text style={[styles.heroTitle, { color: colors.text.primary }]}>{copy.title}</Text>
        <Text style={[styles.heroSubtitle, { color: colors.text.secondary }]}>{copy.subtitle}</Text>
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
          style={[
            styles.choiceCard,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: isYesSelected ? colors.secondary.primary : colors.border.light,
            },
            isYesSelected && { backgroundColor: colors.secondary.light },
          ]}
          onPress={() => handleChoice(true)}
        >
          <View
            style={[
              styles.radio,
              {
                borderColor: isYesSelected ? colors.secondary.primary : colors.border.default,
                backgroundColor: isYesSelected ? colors.secondary.primary : 'transparent',
              },
            ]}
          >
            {isYesSelected && <Check size={14} color="#FFFFFF" />}
          </View>
          <View style={styles.choiceContent}>
            <Text
              style={[
                styles.choiceTitle,
                { color: isYesSelected ? colors.secondary.primary : colors.text.primary },
                isYesSelected && { fontWeight: '600' },
              ]}
            >
              {copy.ctaActivate}
            </Text>
            <Text style={[styles.choiceSubtitle, { color: colors.text.tertiary }]}>Disponible dans l'app</Text>
          </View>
        </Pressable>

        <Pressable
          style={[
            styles.choiceCard,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: isNoSelected ? colors.border.default : colors.border.light,
            },
            isNoSelected && { backgroundColor: colors.bg.secondary },
          ]}
          onPress={() => handleChoice(false)}
        >
          <View
            style={[
              styles.radio,
              {
                borderColor: isNoSelected ? colors.text.tertiary : colors.border.default,
                backgroundColor: isNoSelected ? colors.bg.tertiary : 'transparent',
              },
            ]}
          >
            {isNoSelected && <Check size={14} color={colors.text.secondary} />}
          </View>
          <View style={styles.choiceContent}>
            <Text style={[styles.choiceTitle, { color: isNoSelected ? colors.text.secondary : colors.text.primary }]}>
              {copy.ctaLater}
            </Text>
            <Text style={[styles.choiceSubtitle, { color: colors.text.tertiary }]}>
              Toujours accessible depuis le profil
            </Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    ...typography.body,
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
    borderRadius: radius.xl,
    borderWidth: 2,
    gap: spacing.md,
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceContent: {
    flex: 1,
  },
  choiceTitle: {
    ...typography.bodyMedium,
  },
  choiceSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
})

export default StepWellnessProgram
