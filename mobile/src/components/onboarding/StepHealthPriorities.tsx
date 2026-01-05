/**
 * Step Health Priorities - Onboarding Component
 *
 * Shown when user selects "Ameliorer ma sante".
 * Allows selection of 1-2 priorities (max 3 with expansion).
 * Includes optional "Routine Equilibre" toggle.
 */

import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../constants/theme'
import { HealthPriorityCard, RoutineEquilibreToggle } from '../../features/goals/components'
import { useGoalsStore } from '../../features/goals/stores/goals-store'
import type { HealthPriority } from '../../features/goals/types'

interface StepHealthPrioritiesProps {
  onComplete?: () => void
}

const MAX_PRIORITIES = 2 // Can be increased to 3 later

const ALL_PRIORITIES: HealthPriority[] = ['better_eating', 'more_energy', 'stress']

export function StepHealthPriorities({ onComplete }: StepHealthPrioritiesProps) {
  const { colors } = useTheme()
  const {
    healthPriorities,
    setHealthPriorities,
    routineEquilibreEnabled,
    enableRoutineEquilibre,
    disableRoutineEquilibre,
  } = useGoalsStore()

  // Local state for UI
  const [selectedPriorities, setSelectedPriorities] = useState<HealthPriority[]>(healthPriorities)
  const [routineEnabled, setRoutineEnabled] = useState(routineEquilibreEnabled)

  // Sync to store when priorities change
  useEffect(() => {
    setHealthPriorities(selectedPriorities)
  }, [selectedPriorities, setHealthPriorities])

  // Sync routine toggle to store
  useEffect(() => {
    if (routineEnabled) {
      enableRoutineEquilibre()
    } else {
      disableRoutineEquilibre()
    }
  }, [routineEnabled, enableRoutineEquilibre, disableRoutineEquilibre])

  const handleTogglePriority = (priority: HealthPriority) => {
    if (selectedPriorities.includes(priority)) {
      // Remove priority
      setSelectedPriorities(prev => prev.filter(p => p !== priority))
    } else {
      // Add priority (if under max)
      if (selectedPriorities.length < MAX_PRIORITIES) {
        setSelectedPriorities(prev => [...prev, priority])
      }
    }
  }

  const isMaxReached = selectedPriorities.length >= MAX_PRIORITIES

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Intro section */}
      <View
        style={[
          styles.intro,
          {
            backgroundColor: colors.successLight,
            borderColor: `${colors.success}30`,
          },
        ]}
      >
        <Ionicons name="heart-outline" size={24} color={colors.success} />
        <View style={styles.introContent}>
          <Text style={[styles.introTitle, { color: colors.text.primary }]}>
            Tes priorités santé
          </Text>
          <Text style={[styles.introText, { color: colors.text.secondary }]}>
            Choisis 1 ou 2 priorités. Tu pourras changer quand tu veux.
          </Text>
        </View>
      </View>

      {/* Priority cards */}
      <View style={styles.priorities}>
        {ALL_PRIORITIES.map(priority => (
          <HealthPriorityCard
            key={priority}
            priority={priority}
            isSelected={selectedPriorities.includes(priority)}
            onToggle={() => handleTogglePriority(priority)}
            disabled={isMaxReached && !selectedPriorities.includes(priority)}
          />
        ))}
      </View>

      {/* Selection counter */}
      <View style={styles.counterContainer}>
        <Text style={[styles.counterText, { color: colors.text.tertiary }]}>
          {selectedPriorities.length} / {MAX_PRIORITIES} sélectionnées
        </Text>
      </View>

      {/* Routine Equilibre toggle */}
      <RoutineEquilibreToggle
        enabled={routineEnabled}
        onToggle={setRoutineEnabled}
      />

      {/* Helper text */}
      <Text style={[styles.helperText, { color: colors.text.tertiary }]}>
        Ces choix orientent les conseils, sans créer de contraintes.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  introContent: {
    flex: 1,
  },
  introTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  introText: {
    ...typography.body,
  },
  priorities: {
    marginBottom: spacing.sm,
  },
  counterContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  counterText: {
    ...typography.small,
  },
  helperText: {
    ...typography.small,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
})

export default StepHealthPriorities
