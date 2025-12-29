/**
 * CoachInsights Component
 *
 * Displays connected insights from LymIA that link different features together.
 * This is KEY to making the app feel cohesive - the coach explains relationships
 * between nutrition, sport, sleep, stress, etc.
 *
 * Philosophy: "Tu ne fais rien. Le coach s'occupe de decider."
 */

import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Link2,
  AlertTriangle,
  Lightbulb,
  PartyPopper,
  ChevronRight,
  Moon,
  Utensils,
  Dumbbell,
  Droplets,
  Brain,
  Scale,
  Sparkles,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'

import { colors, spacing, typography, radius } from '../../constants/theme'
import { LymIABrain, type ConnectedInsight, type UserContext } from '../../services/lymia-brain'
import { useUserStore } from '../../stores/user-store'
import { useMealsStore } from '../../stores/meals-store'
import { useWellnessStore } from '../../stores/wellness-store'
import { useGamificationStore } from '../../stores/gamification-store'

// Feature icons mapping
const featureIcons: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  nutrition: Utensils,
  sport: Dumbbell,
  sleep: Moon,
  stress: Brain,
  hydration: Droplets,
  weight: Scale,
}

// Priority colors
const priorityColors: Record<string, { bg: string; border: string; text: string }> = {
  high: { bg: 'rgba(239, 68, 68, 0.1)', border: '#EF4444', text: '#EF4444' },
  medium: { bg: 'rgba(139, 92, 246, 0.1)', border: '#8B5CF6', text: '#8B5CF6' },
  low: { bg: 'rgba(16, 185, 129, 0.1)', border: '#10B981', text: '#10B981' },
}

// Icon components for insight types
const insightIcons: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  link: Link2,
  alert: AlertTriangle,
  tip: Lightbulb,
  celebration: PartyPopper,
}

interface CoachInsightsProps {
  compact?: boolean
}

export function CoachInsights({ compact = false }: CoachInsightsProps) {
  const navigation = useNavigation()
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData } = useMealsStore()
  const getTodayEntry = useWellnessStore((state) => state.getTodayEntry)
  const currentStreak = useGamificationStore((state) => state.currentStreak)

  const [insights, setInsights] = useState<ConnectedInsight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get today's wellness entry
  const todayEntry = getTodayEntry()

  // Build user context for LymIA
  const buildContext = (): UserContext => {
    const todayData = getTodayData()
    const goals = nutritionGoals || { calories: 2000, proteins: 100, carbs: 250, fats: 67 }

    return {
      profile: {
        ...profile,
        nutritionalNeeds: goals,
      } as UserContext['profile'],
      todayNutrition: todayData.totalNutrition,
      weeklyAverage: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
      currentStreak: currentStreak,
      lastMeals: [],
      wellnessData: {
        sleepHours: todayEntry?.sleepHours,
        stressLevel: todayEntry?.stressLevel,
        energyLevel: todayEntry?.energyLevel,
        hydrationLiters: todayEntry?.waterLiters,
      },
    }
  }

  // Load connected insights
  useEffect(() => {
    const loadInsights = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const context = buildContext()
        const newInsights = await LymIABrain.generateConnectedInsights(context)
        setInsights(newInsights)
      } catch (err) {
        console.error('Failed to load coach insights:', err)
        setError('Impossible de charger les conseils')
      } finally {
        setIsLoading(false)
      }
    }

    loadInsights()
  }, [todayEntry, profile, nutritionGoals, currentStreak])

  const handleInsightPress = (insight: ConnectedInsight) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (insight.actionRoute) {
      // @ts-ignore - Navigation typing
      navigation.navigate(insight.actionRoute)
    }
  }

  // Render feature badges (the connected features)
  const renderFeatureBadges = (features: ConnectedInsight['linkedFeatures']) => (
    <View style={styles.featureBadges}>
      {features.map((feature, index) => {
        const IconComponent = featureIcons[feature] || Link2
        return (
          <React.Fragment key={feature}>
            <View style={styles.featureBadge}>
              <IconComponent size={12} color={colors.text.secondary} />
            </View>
            {index < features.length - 1 && (
              <View style={styles.featureConnector}>
                <Link2 size={10} color={colors.text.muted} />
              </View>
            )}
          </React.Fragment>
        )
      })}
    </View>
  )

  // Render single insight card
  const renderInsight = (insight: ConnectedInsight, index: number) => {
    const IconComponent = insightIcons[insight.icon] || Link2
    const colorScheme = priorityColors[insight.priority] || priorityColors.medium

    return (
      <TouchableOpacity
        key={insight.id}
        style={[
          styles.insightCard,
          { backgroundColor: colorScheme.bg, borderColor: colorScheme.border },
        ]}
        onPress={() => handleInsightPress(insight)}
        activeOpacity={0.7}
        disabled={!insight.actionRoute && !insight.actionLabel}
      >
        <View style={styles.insightHeader}>
          <View style={[styles.insightIcon, { backgroundColor: colorScheme.border }]}>
            <IconComponent size={14} color="#FFFFFF" />
          </View>
          {renderFeatureBadges(insight.linkedFeatures)}
        </View>

        <Text style={styles.insightMessage}>{insight.message}</Text>

        {insight.actionLabel && (
          <View style={styles.insightAction}>
            <Text style={[styles.insightActionText, { color: colorScheme.text }]}>
              {insight.actionLabel}
            </Text>
            <ChevronRight size={14} color={colorScheme.text} />
          </View>
        )}
      </TouchableOpacity>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Sparkles size={16} color="#8B5CF6" />
          </View>
          <Text style={styles.headerTitle}>LymIA connecte tout pour toi</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Analyse en cours...</Text>
        </View>
      </View>
    )
  }

  // No insights or error
  if (insights.length === 0 || error) {
    return null // Don't show anything if no insights
  }

  // Compact mode - show only first insight inline
  if (compact) {
    const insight = insights[0]
    const IconComponent = insightIcons[insight.icon] || Link2
    const colorScheme = priorityColors[insight.priority] || priorityColors.medium

    return (
      <TouchableOpacity
        style={[styles.compactCard, { borderLeftColor: colorScheme.border }]}
        onPress={() => handleInsightPress(insight)}
        activeOpacity={0.7}
      >
        <View style={[styles.compactIcon, { backgroundColor: colorScheme.bg }]}>
          <IconComponent size={16} color={colorScheme.text} />
        </View>
        <Text style={styles.compactMessage} numberOfLines={2}>
          {insight.message}
        </Text>
        {insight.actionLabel && <ChevronRight size={16} color={colors.text.muted} />}
      </TouchableOpacity>
    )
  }

  // Full mode - show all insights
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.05)']}
          style={styles.headerGradient}
        >
          <View style={styles.headerIcon}>
            <Sparkles size={16} color="#8B5CF6" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>LymIA connecte tout</Text>
            <Text style={styles.headerSubtitle}>
              Je relie nutrition, sport et bien-etre pour toi
            </Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.insightsList}>
        {insights.map(renderInsight)}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  header: {
    marginBottom: spacing.sm,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.small,
    color: colors.text.muted,
  },
  insightsList: {
    gap: spacing.sm,
  },
  insightCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  insightIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureConnector: {
    opacity: 0.5,
  },
  insightMessage: {
    ...typography.body,
    color: colors.text.primary,
    lineHeight: 22,
  },
  insightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  insightActionText: {
    ...typography.smallMedium,
  },
  // Compact mode styles
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  compactIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactMessage: {
    ...typography.small,
    color: colors.text.primary,
    flex: 1,
  },
})

export default CoachInsights
