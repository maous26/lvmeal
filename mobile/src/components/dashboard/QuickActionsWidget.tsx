/**
 * QuickActionsWidget - Professional quick action buttons for meal plans
 *
 * Features:
 * - 2 plan duration options (1j = daily suggestion, 3j = short-term plan)
 * - Optional -10% calorie reduction for savings (Solde Plaisir)
 * - Modern pill/chip design
 * - AI generation indicator
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { Sparkles, Percent, ChevronRight, Calendar, CalendarDays, ChefHat } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, typography, radius, shadows } from '../../constants/theme'

export type PlanDuration = 1 | 3
export type RecipeComplexity = 'basique' | 'elabore' | 'mix'

export interface PlanOptions {
  duration: PlanDuration
  calorieReduction: boolean // -10% for solde plaisir
  complexity: RecipeComplexity // Recipe complexity level
}

interface QuickActionsWidgetProps {
  onPlanPress: (options: PlanOptions) => void
  savedCaloriesThisWeek?: number // Calories already saved toward solde plaisir
}

const durationConfig = {
  1: { icon: Calendar, label: '1j', description: 'Suggestion du jour' },
  3: { icon: CalendarDays, label: '3j', description: 'Plan court terme' },
}

const complexityConfig: Record<RecipeComplexity, { label: string; description: string }> = {
  basique: { label: 'Basique', description: '≤4 ingrédients, rapide' },
  elabore: { label: 'Élaboré', description: '+5 ingrédients' },
  mix: { label: 'Mix', description: 'Varié' },
}

export default function QuickActionsWidget({
  onPlanPress,
  savedCaloriesThisWeek = 0
}: QuickActionsWidgetProps) {
  const [selectedDuration, setSelectedDuration] = useState<PlanDuration>(3)
  const [calorieReduction, setCalorieReduction] = useState(false)
  const [complexity, setComplexity] = useState<RecipeComplexity>('mix')

  const handleDurationSelect = (duration: PlanDuration) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedDuration(duration)
  }

  const handleComplexitySelect = (level: RecipeComplexity) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setComplexity(level)
  }

  const handleToggleReduction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setCalorieReduction(!calorieReduction)
  }

  const handleGenerate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPlanPress({
      duration: selectedDuration,
      calorieReduction,
      complexity,
    })
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Sparkles size={16} color={colors.warning} />
          <Text style={styles.headerTitle}>Plan repas IA</Text>
        </View>
        <Text style={styles.headerSubtitle}>Gustar · OFF · Ciqual</Text>
      </View>

      {/* Duration Pills */}
      <View style={styles.durationRow}>
        {([1, 3] as PlanDuration[]).map((duration) => {
          const config = durationConfig[duration]
          const Icon = config.icon
          const isSelected = selectedDuration === duration

          return (
            <Pressable
              key={duration}
              style={[
                styles.durationPill,
                isSelected && styles.durationPillSelected,
              ]}
              onPress={() => handleDurationSelect(duration)}
            >
              <Icon
                size={16}
                color={isSelected ? '#FFFFFF' : colors.text.secondary}
              />
              <Text style={[
                styles.durationLabel,
                isSelected && styles.durationLabelSelected,
              ]}>
                {config.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Complexity Selector */}
      <View style={styles.complexitySection}>
        <View style={styles.complexityHeader}>
          <ChefHat size={14} color={colors.text.secondary} />
          <Text style={styles.complexityTitle}>Complexite des recettes</Text>
        </View>
        <View style={styles.complexityRow}>
          {(['basique', 'elabore', 'mix'] as RecipeComplexity[]).map((level) => {
            const config = complexityConfig[level]
            const isSelected = complexity === level

            return (
              <Pressable
                key={level}
                style={[
                  styles.complexityPill,
                  isSelected && styles.complexityPillSelected,
                ]}
                onPress={() => handleComplexitySelect(level)}
              >
                <Text style={[
                  styles.complexityLabel,
                  isSelected && styles.complexityLabelSelected,
                ]}>
                  {config.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Calorie Reduction Toggle */}
      <Pressable
        style={[
          styles.reductionToggle,
          calorieReduction && styles.reductionToggleActive,
        ]}
        onPress={handleToggleReduction}
      >
        <View style={[
          styles.reductionIcon,
          calorieReduction && styles.reductionIconActive,
        ]}>
          <Percent size={14} color={calorieReduction ? '#FFFFFF' : colors.warning} />
        </View>
        <View style={styles.reductionContent}>
          <Text style={[
            styles.reductionTitle,
            calorieReduction && styles.reductionTitleActive,
          ]}>
            Mode economie -10%
          </Text>
          <Text style={styles.reductionSubtitle}>
            Alimente ton Solde Plaisir
          </Text>
        </View>
        <View style={[
          styles.reductionCheckbox,
          calorieReduction && styles.reductionCheckboxActive,
        ]}>
          {calorieReduction && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </View>
      </Pressable>

      {/* Generate Button */}
      <Pressable
        style={({ pressed }) => [
          styles.generateButton,
          pressed && styles.generateButtonPressed,
        ]}
        onPress={handleGenerate}
      >
        <View style={[styles.generateGradient, { backgroundColor: colors.accent.primary }]}>
          <Sparkles size={18} color="#FFFFFF" />
          <Text style={styles.generateText}>
            Générer mon plan {selectedDuration}j
            {calorieReduction ? ' (-10%)' : ''}
          </Text>
          <ChevronRight size={18} color="#FFFFFF" />
        </View>
      </Pressable>

      {/* Savings info */}
      {savedCaloriesThisWeek > 0 && (
        <View style={styles.savingsInfo}>
          <Text style={styles.savingsText}>
            🏦 {savedCaloriesThisWeek} kcal economies cette semaine
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
  },
  durationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  durationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  durationPillSelected: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  durationLabel: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  durationLabelSelected: {
    color: '#FFFFFF',
  },
  complexitySection: {
    marginBottom: spacing.md,
  },
  complexityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  complexityTitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  complexityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  complexityPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  complexityPillSelected: {
    backgroundColor: colors.secondary.light,
    borderColor: colors.secondary.primary,
  },
  complexityLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  complexityLabelSelected: {
    color: colors.secondary.primary,
    fontWeight: '600',
  },
  reductionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reductionToggleActive: {
    backgroundColor: `${colors.warning}15`,
    borderColor: `${colors.warning}40`,
  },
  reductionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: `${colors.warning}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reductionIconActive: {
    backgroundColor: colors.warning,
  },
  reductionContent: {
    flex: 1,
  },
  reductionTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  reductionTitleActive: {
    color: colors.warning,
  },
  reductionSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
  },
  reductionCheckbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reductionCheckboxActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  generateButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  generateButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  generateText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  savingsInfo: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    alignItems: 'center',
  },
  savingsText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
})
