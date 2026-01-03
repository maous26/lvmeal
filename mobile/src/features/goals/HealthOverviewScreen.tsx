/**
 * Health Overview Screen
 *
 * Main dashboard for "Ameliorer ma sante" goal.
 * Shows:
 * - Diversity (7 days)
 * - Macro ranges (reperes, not targets)
 * - Energy signals (if any)
 * - Routine Equilibre (if enabled)
 * - Advice cards
 */

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../constants/theme'
import { useGoalsStore } from './stores/goals-store'
import { useMealsStore } from '../../stores/meals-store'
import { useUserStore } from '../../stores/user-store'
import { DiversityCard } from './components/DiversityCard'
import { MacroRangesCard } from './components/MacroRangesCard'
import { EnergySignalsCard } from './components/EnergySignalsCard'
import { WeeklyPresenceCard } from './components/WeeklyPresenceCard'
import { calculateDiversity } from './services/diversity-calculator'
import { detectEnergySignals } from './services/energy-signals'
import {
  calculateWeeklySummary,
  createNutritionRanges,
} from './services/nutrition-insights'
import { HEALTH_PRIORITY_LABELS } from './types'

export function HealthOverviewScreen() {
  const { colors } = useTheme()
  const [refreshing, setRefreshing] = React.useState(false)

  // Stores
  const { healthPriorities, routineEquilibreEnabled, getWeeklyPresence, getTodayRoutineEntry } =
    useGoalsStore()
  const { dailyData } = useMealsStore()
  const { nutritionGoals } = useUserStore()

  // Calculate metrics
  const diversity = useMemo(() => {
    return calculateDiversity([], dailyData)
  }, [dailyData])

  const energySignals = useMemo(() => {
    return detectEnergySignals([], dailyData)
  }, [dailyData])

  const weeklySummary = useMemo(() => {
    return calculateWeeklySummary([], dailyData)
  }, [dailyData])

  const nutritionRanges = useMemo(() => {
    // NutritionGoals is compatible with NutritionalNeeds (same base fields)
    return createNutritionRanges(nutritionGoals ? {
      calories: nutritionGoals.calories,
      proteins: nutritionGoals.proteins,
      carbs: nutritionGoals.carbs,
      fats: nutritionGoals.fats,
    } : undefined)
  }, [nutritionGoals])

  const weeklyPresence = getWeeklyPresence()
  const todayRoutineEntry = getTodayRoutineEntry()

  const onRefresh = React.useCallback(() => {
    setRefreshing(true)
    // In a real app, you might refetch data here
    setTimeout(() => setRefreshing(false), 500)
  }, [])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Reperes de la semaine
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Des indicateurs pour te guider, pas te juger.
          </Text>
        </View>

        {/* Active priorities */}
        {healthPriorities.length > 0 && (
          <View style={styles.prioritiesRow}>
            {healthPriorities.map(priority => (
              <View
                key={priority}
                style={[styles.priorityChip, { backgroundColor: colors.accent.light }]}
              >
                <Text style={[styles.priorityText, { color: colors.accent.primary }]}>
                  {HEALTH_PRIORITY_LABELS[priority].title}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Diversity Card */}
        <DiversityCard diversity={diversity} />

        {/* Energy Signals - show if "more_energy" priority or any signal active */}
        {(healthPriorities.includes('more_energy') || energySignals.lowProtein3Days || energySignals.lowFiber3Days || energySignals.highUltraProcessed) && (
          <EnergySignalsCard signals={energySignals} />
        )}

        {/* Macro Ranges */}
        <MacroRangesCard ranges={nutritionRanges} summary={weeklySummary} />

        {/* Routine Equilibre - if enabled */}
        {routineEquilibreEnabled && (
          <WeeklyPresenceCard
            presence={weeklyPresence}
            todayEntry={todayRoutineEntry}
          />
        )}

        {/* Advice section placeholder */}
        <View
          style={[
            styles.adviceSection,
            { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
          ]}
        >
          <View style={styles.adviceHeader}>
            <Ionicons name="bulb-outline" size={20} color={colors.accent.primary} />
            <Text style={[styles.adviceTitle, { color: colors.text.primary }]}>
              Conseils du moment
            </Text>
          </View>
          <Text style={[styles.adviceText, { color: colors.text.secondary }]}>
            Les conseils apparaitront ici selon tes priorites et tes donnees.
          </Text>
        </View>

        {/* Disclaimer */}
        <Text style={[styles.disclaimer, { color: colors.text.tertiary }]}>
          Ces reperes sont indicatifs. Ecoute ton corps et consulte un professionnel si besoin.
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.default,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
  },
  prioritiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  priorityChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  priorityText: {
    ...typography.caption,
    fontWeight: '600',
  },
  adviceSection: {
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  adviceTitle: {
    ...typography.bodySemibold,
  },
  adviceText: {
    ...typography.body,
  },
  disclaimer: {
    ...typography.caption,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
})

export default HealthOverviewScreen
