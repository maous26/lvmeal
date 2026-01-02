import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Card } from '../ui/Card'
import { colors, radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, NutritionalNeeds, NutritionInfo } from '../../types'
import { LymIABrain, type UserContext, type CalorieRecommendation } from '../../services/lymia-brain'

interface StepAnalysisProps {
  profile: Partial<UserProfile>
  needs: NutritionalNeeds
  onNeedsCalculated?: (needs: NutritionalNeeds) => void
}

const formatNumber = (num: number): string => {
  return num.toLocaleString('fr-FR')
}

export function StepAnalysis({ profile, needs, onNeedsCalculated }: StepAnalysisProps) {
  const [showResults, setShowResults] = useState(false)
  const [personalizedNeeds, setPersonalizedNeeds] = useState<CalorieRecommendation | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('Analyse en cours...')

  useEffect(() => {
    async function calculateRAGNeeds() {
      try {
        setLoadingMessage('Recherche des recommandations ANSES...')

        // Build context for RAG-powered calculation
        const context: UserContext = {
          profile: profile as UserProfile,
          todayNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          weeklyAverage: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
          currentStreak: 0,
          lastMeals: [],
          wellnessData: {},
        }

        setLoadingMessage('Calcul personnalisé avec IA...')

        // Call RAG+DSPy powered calculation
        const ragNeeds = await LymIABrain.calculatePersonalizedNeeds(context)
        setPersonalizedNeeds(ragNeeds)

        // Notify parent of calculated needs so they can be saved
        if (onNeedsCalculated && ragNeeds) {
          const needsToSave: NutritionalNeeds = {
            ...needs,
            calories: ragNeeds.calories,
            proteins: ragNeeds.proteins,
            carbs: ragNeeds.carbs,
            fats: ragNeeds.fats,
          }
          onNeedsCalculated(needsToSave)
        }

      } catch (error) {
        console.error('RAG calculation failed:', error)
        // Will fallback to basic needs - notify parent with fallback
        if (onNeedsCalculated) {
          onNeedsCalculated(needs)
        }
      } finally {
        setShowResults(true)
      }
    }

    // Start calculation with slight delay for UX
    const timer = setTimeout(calculateRAGNeeds, 500)
    return () => clearTimeout(timer)
  }, [profile, needs, onNeedsCalculated])

  if (!showResults) {
    return (
      <View style={styles.loading}>
        <View style={styles.spinner}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
        </View>
        <Text style={styles.loadingTitle}>{loadingMessage}</Text>
        <Text style={styles.loadingText}>Calcul de vos besoins nutritionnels</Text>
      </View>
    )
  }

  // Use RAG-calculated needs if available, fallback to basic Harris-Benedict
  const finalNeeds = personalizedNeeds || needs
  const isRAGPowered = personalizedNeeds !== null
  const sources = personalizedNeeds?.sources || []

  const macros = [
    { label: 'Proteines', value: finalNeeds.proteins, unit: 'g', color: colors.nutrients.proteins },
    { label: 'Glucides', value: finalNeeds.carbs, unit: 'g', color: colors.nutrients.carbs },
    { label: 'Lipides', value: finalNeeds.fats, unit: 'g', color: colors.nutrients.fats },
  ]

  const goalLabels: Record<string, string> = {
    weight_loss: 'perte de poids',
    muscle_gain: 'prise de muscle',
    maintenance: 'maintien',
    health: 'sante',
    energy: 'energie',
  }

  return (
    <View style={styles.container}>
      {/* Success message */}
      <View style={styles.success}>
        <View style={styles.successIcon}>
          <Text style={styles.successEmoji}>✓</Text>
        </View>
        <View style={styles.successContent}>
          <Text style={styles.successTitle}>Profil analyse avec succes !</Text>
          <Text style={styles.successText}>Voici vos objectifs personnalises</Text>
        </View>
      </View>

      {/* Calories target */}
      <Card style={styles.caloriesCard}>
        <View style={styles.caloriesHeader}>
          <Text style={styles.caloriesIcon}>🔥</Text>
          <Text style={styles.caloriesLabel}>Objectif calorique quotidien</Text>
        </View>
        <View style={styles.caloriesValue}>
          <Text style={styles.caloriesNumber}>{formatNumber(finalNeeds.calories)}</Text>
          <Text style={styles.caloriesUnit}>kcal</Text>
        </View>
        <Text style={styles.caloriesHint}>
          Base sur votre profil et objectif : {goalLabels[profile.goal || 'maintenance']}
        </Text>
        {isRAGPowered && personalizedNeeds?.reasoning && (
          <Text style={styles.reasoningText}>{personalizedNeeds.reasoning}</Text>
        )}
        {sources.length > 0 && (
          <View style={styles.sourcesContainer}>
            <Text style={styles.sourcesLabel}>Sources scientifiques:</Text>
            <Text style={styles.sourcesText}>
              {sources.map(s => s.source.toUpperCase()).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
            </Text>
          </View>
        )}
      </Card>

      {/* Macros breakdown */}
      <View style={styles.macrosSection}>
        <Text style={styles.macrosTitle}>Repartition des macronutriments</Text>
        <View style={styles.macrosGrid}>
          {macros.map((macro) => (
            <Card key={macro.label} style={styles.macroCard}>
              <View style={[styles.macroIcon, { backgroundColor: `${macro.color}20` }]}>
                <View style={[styles.macroDot, { backgroundColor: macro.color }]} />
              </View>
              <Text style={styles.macroValue}>{formatNumber(macro.value)}</Text>
              <Text style={styles.macroLabel}>
                {macro.unit} de {macro.label.toLowerCase()}
              </Text>
            </Card>
          ))}
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Recapitulatif de votre profil</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Prenom</Text>
          <Text style={styles.summaryValue}>{profile.firstName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Taille</Text>
          <Text style={styles.summaryValue}>{profile.height} cm</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Poids actuel</Text>
          <Text style={styles.summaryValue}>{profile.weight} kg</Text>
        </View>
        {profile.targetWeight && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Objectif</Text>
            <Text style={styles.summaryValue}>{profile.targetWeight} kg</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Regime</Text>
          <Text style={[styles.summaryValue, { textTransform: 'capitalize' }]}>
            {profile.dietType}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
  },
  spinner: {
    marginBottom: spacing.lg,
  },
  loadingTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  loadingText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    backgroundColor: colors.accent.light,
    borderRadius: radius.lg,
  },
  successIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  successEmoji: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  successContent: {},
  successTitle: {
    ...typography.bodySemibold,
    color: colors.text.primary,
  },
  successText: {
    ...typography.small,
    color: colors.text.secondary,
  },
  caloriesCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  caloriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  caloriesIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  caloriesLabel: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  caloriesValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  caloriesNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.primary,
  },
  caloriesUnit: {
    fontSize: 20,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
  caloriesHint: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  reasoningText: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sourcesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    alignItems: 'center',
  },
  sourcesLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  sourcesText: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  macrosSection: {},
  macrosTitle: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  macrosGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  macroCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  macroIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  macroDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  macroValue: {
    ...typography.h4,
    color: colors.text.primary,
  },
  macroLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  summary: {
    padding: spacing.default,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
  },
  summaryTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  summaryValue: {
    ...typography.small,
    color: colors.text.primary,
  },
})

export default StepAnalysis
