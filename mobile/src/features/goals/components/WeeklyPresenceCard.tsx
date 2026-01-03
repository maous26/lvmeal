/**
 * Weekly Presence Card Component
 *
 * Shows "presences cette semaine" for Routine Equilibre.
 * Replaces toxic "streak" concept.
 * No record, no judgment, just presence.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../../constants/theme'
import type { WeeklyPresence, RoutineEquilibreEntry } from '../types'

interface WeeklyPresenceCardProps {
  presence: WeeklyPresence
  todayEntry: RoutineEquilibreEntry | null
  onLogToday?: () => void
}

const DAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export function WeeklyPresenceCard({ presence, todayEntry, onLogToday }: WeeklyPresenceCardProps) {
  const { colors } = useTheme()

  // Get current day index (0 = Monday in our system)
  const today = new Date()
  const dayOfWeek = today.getDay()
  const currentDayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // Convert Sunday (0) to 6

  // Generate week days with presence status
  const weekDays = DAYS_FR.map((label, index) => {
    const isToday = index === currentDayIndex
    const isPast = index < currentDayIndex
    const isFuture = index > currentDayIndex

    // For demo, assume presence.daysPresent are consecutive from start of week
    // In real implementation, you'd check actual dates
    const isPresent = index < presence.daysPresent

    return { label, isToday, isPast, isFuture, isPresent }
  })

  // Today's pillars status
  const pillarsCompleted = todayEntry
    ? [
        todayEntry.ateToHunger,
        todayEntry.walked,
        todayEntry.sleptWell,
        todayEntry.hydratedWell,
      ].filter(Boolean).length
    : 0

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg.elevated, borderColor: colors.border.light },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles-outline" size={20} color={colors.accent.primary} />
          <Text style={[styles.title, { color: colors.text.primary }]}>Routine Equilibre</Text>
        </View>
      </View>

      {/* Week presence dots */}
      <View style={styles.weekRow}>
        {weekDays.map((day, index) => (
          <View key={index} style={styles.dayColumn}>
            <Text style={[styles.dayLabel, { color: colors.text.tertiary }]}>{day.label}</Text>
            <View
              style={[
                styles.dayDot,
                {
                  backgroundColor: day.isPresent
                    ? colors.accent.primary
                    : day.isToday
                    ? 'rgba(168, 85, 247, 0.3)'
                    : colors.bg.secondary,
                  borderColor: day.isToday ? colors.accent.primary : 'transparent',
                  borderWidth: day.isToday ? 2 : 0,
                },
              ]}
            >
              {day.isPresent && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
            </View>
          </View>
        ))}
      </View>

      {/* Presence count */}
      <View style={styles.presenceRow}>
        <Text style={[styles.presenceText, { color: colors.text.secondary }]}>
          {presence.daysPresent} presence{presence.daysPresent > 1 ? 's' : ''} cette semaine
        </Text>
      </View>

      {/* Today's pillars */}
      {todayEntry && (
        <View style={[styles.pillarsRow, { borderTopColor: colors.border.light }]}>
          <Text style={[styles.pillarsLabel, { color: colors.text.secondary }]}>
            Aujourd'hui :
          </Text>
          <View style={styles.pillarsIcons}>
            <PillarIcon
              icon="restaurant-outline"
              active={todayEntry.ateToHunger}
              colors={colors}
            />
            <PillarIcon icon="walk-outline" active={todayEntry.walked} colors={colors} />
            <PillarIcon icon="moon-outline" active={todayEntry.sleptWell} colors={colors} />
            <PillarIcon icon="water-outline" active={todayEntry.hydratedWell} colors={colors} />
          </View>
          <Text style={[styles.pillarsCount, { color: colors.text.tertiary }]}>
            {pillarsCompleted}/4
          </Text>
        </View>
      )}

      {/* No entry today - gentle nudge */}
      {!todayEntry && (
        <View style={[styles.pillarsRow, { borderTopColor: colors.border.light }]}>
          <Text style={[styles.noEntryText, { color: colors.text.tertiary }]}>
            Pas encore de check-in aujourd'hui. Quand tu veux.
          </Text>
        </View>
      )}
    </View>
  )
}

function PillarIcon({
  icon,
  active,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap
  active?: boolean
  colors: ReturnType<typeof useTheme>['colors']
}) {
  return (
    <View
      style={[
        styles.pillarIcon,
        {
          backgroundColor: active ? 'rgba(16, 185, 129, 0.15)' : colors.bg.secondary,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? '#10B981' : colors.text.tertiary}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.default,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.bodySemibold,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dayColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dayLabel: {
    ...typography.caption,
    fontWeight: '500',
  },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceRow: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  presenceText: {
    ...typography.body,
  },
  pillarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  pillarsLabel: {
    ...typography.small,
  },
  pillarsIcons: {
    flexDirection: 'row',
    flex: 1,
    gap: spacing.xs,
  },
  pillarIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarsCount: {
    ...typography.small,
  },
  noEntryText: {
    ...typography.small,
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'center',
  },
})

export default WeeklyPresenceCard
