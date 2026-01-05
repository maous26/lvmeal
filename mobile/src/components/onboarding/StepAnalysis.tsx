import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Card } from '../ui/Card'
import { radius, spacing, typography } from '../../constants/theme'
import type { UserProfile, NutritionalNeeds, NutritionInfo } from '../../types'
import { LymIABrain, type UserContext, type CalorieRecommendation } from '../../services/lymia-brain'
import { useTheme } from '../../contexts/ThemeContext'

interface StepAnalysisProps {
  profile: Partial<UserProfile>
  needs: NutritionalNeeds
  onNeedsCalculated?: (needs: NutritionalNeeds) => void
}

const formatNumber = (num: number): string => {
  return num.toLocaleString('fr-FR')
}

export function StepAnalysis({ profile, needs, onNeedsCalculated }: StepAnalysisProps) {
  const { colors } = useTheme()
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
        <Text style={[styles.loadingTitle, { color: colors.text.primary }]}>{loadingMessage}</Text>
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
          Calcul de tes besoins nutritionnels
        </Text>
      </View>
    )
  }

  // Use RAG-calculated needs if available, fallback to basic Harris-Benedict
  const finalNeeds = personalizedNeeds || needs
  const isRAGPowered = personalizedNeeds !== null
  const sources = personalizedNeeds?.sources || []

  const macros = [
    { label: 'Protéines', value: finalNeeds.proteins, unit: 'g', color: colors.nutrients.proteins },
    { label: 'Glucides', value: finalNeeds.carbs, unit: 'g', color: colors.nutrients.carbs },
    { label: 'Lipides', value: finalNeeds.fats, unit: 'g', color: colors.nutrients.fats },
  ]

  const goalLabels: Record<string, string> = {
    weight_loss: 'perte de poids',
    muscle_gain: 'prise de muscle',
    maintenance: 'maintien',
    health: 'santé',
    energy: 'énergie',
  }

  return (
    <View style={styles.container}>
      {/* Success message */}
      <View style={[styles.success, { backgroundColor: colors.accent.light }]}>
        <View style={styles.successIcon}>
          <Text style={styles.successEmoji}>✓</Text>
        </View>
        <View style={styles.successContent}>
          <Text style={[styles.successTitle, { color: colors.text.primary }]}>
            Profil analysé avec succès !
          </Text>
          <Text style={[styles.successText, { color: colors.text.secondary }]}>
            Voici tes objectifs personnalisés
          </Text>
        </View>
      </View>

      {/* Calories target */}
      <Card style={[styles.caloriesCard, { backgroundColor: colors.bg.elevated }]}>
        <View style={styles.caloriesHeader}>
          <Text style={styles.caloriesIcon}>🔥</Text>
          <Text style={[styles.caloriesLabel, { color: colors.text.secondary }]}>
            Objectif calorique quotidien
          </Text>
        </View>
        <View style={styles.caloriesValue}>
          <Text style={[styles.caloriesNumber, { color: colors.text.primary }]}>
            {formatNumber(finalNeeds.calories)}
          </Text>
          <Text style={[styles.caloriesUnit, { color: colors.text.tertiary }]}>kcal</Text>
        </View>
        <Text style={[styles.caloriesHint, { color: colors.text.tertiary }]}>
          Basé sur ton profil et ton objectif : {goalLabels[profile.goal || 'maintenance']}
        </Text>
        {isRAGPowered && personalizedNeeds?.reasoning && (
          <Text style={[styles.reasoningText, { color: colors.text.secondary }]}>
            {personalizedNeeds.reasoning}
          </Text>
        )}
        {sources.length > 0 && (
          <View style={[styles.sourcesContainer, { borderTopColor: colors.border.light }]}>
            <Text style={[styles.sourcesLabel, { color: colors.text.tertiary }]}>
              Sources scientifiques :
            </Text>
            <Text style={[styles.sourcesText, { color: colors.accent.primary }]}>
              {sources.map(s => s.source.toUpperCase()).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
            </Text>
          </View>
        )}
      </Card>

      {/* Macros breakdown */}
      <View style={styles.macrosSection}>
        <Text style={[styles.macrosTitle, { color: colors.text.secondary }]}>
          Répartition des macronutriments
        </Text>
        <View style={styles.macrosGrid}>
          {macros.map((macro) => (
            <Card key={macro.label} style={[styles.macroCard, { backgroundColor: colors.bg.elevated }]}>
              <View style={[styles.macroIcon, { backgroundColor: `${macro.color}20` }]}>
                <View style={[styles.macroDot, { backgroundColor: macro.color }]} />
              </View>
              <Text style={[styles.macroValue, { color: colors.text.primary }]}>
                {formatNumber(macro.value)}
              </Text>
              <Text style={[styles.macroLabel, { color: colors.text.tertiary }]}>
                {macro.unit} de {macro.label.toLowerCase()}
              </Text>
            </Card>
          ))}
        </View>
      </View>

      {/* Summary */}
      <View style={[styles.summary, { backgroundColor: colors.bg.secondary }]}>
        <Text style={[styles.summaryTitle, { color: colors.text.primary }]}>
          Récapitulatif de ton profil
        </Text>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Prénom</Text>
          <Text style={[styles.summaryValue, { color: colors.text.primary }]}>{profile.firstName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Taille</Text>
          <Text style={[styles.summaryValue, { color: colors.text.primary }]}>{profile.height} cm</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Poids actuel</Text>
          <Text style={[styles.summaryValue, { color: colors.text.primary }]}>{profile.weight} kg</Text>
        </View>
        {profile.targetWeight && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Objectif</Text>
            <Text style={[styles.summaryValue, { color: colors.text.primary }]}>{profile.targetWeight} kg</Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.text.tertiary }]}>Régime</Text>
          <Text style={[styles.summaryValue, { color: colors.text.primary, textTransform: 'capitalize' }]}>
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
    marginBottom: spacing.sm,
  },
  loadingText: {
    ...typography.small,
  },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    borderRadius: radius.lg,
  },
  successIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#009FEB',
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
  },
  successText: {
    ...typography.small,
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
  },
  caloriesValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  caloriesNumber: {
    fontSize: 48,
    fontWeight: '700',
  },
  caloriesUnit: {
    fontSize: 20,
    marginLeft: spacing.xs,
  },
  caloriesHint: {
    ...typography.small,
    marginTop: spacing.sm,
  },
  reasoningText: {
    ...typography.small,
    marginTop: spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sourcesContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  sourcesLabel: {
    ...typography.caption,
  },
  sourcesText: {
    ...typography.caption,
    fontWeight: '600',
  },
  macrosSection: {},
  macrosTitle: {
    ...typography.smallMedium,
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
  },
  macroLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
  summary: {
    padding: spacing.default,
    borderRadius: radius.lg,
  },
  summaryTitle: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    ...typography.small,
  },
  summaryValue: {
    ...typography.small,
  },
})

export default StepAnalysis
