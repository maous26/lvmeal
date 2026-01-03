/**
 * Energy Signals Card Component
 *
 * Displays energy-related signals when detected.
 * No alarms, just helpful observations.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../../constants/theme'
import type { EnergySignals } from '../types'
import { hasActiveEnergySignals, getEnergySignalMessage } from '../services/energy-signals'

interface EnergySignalsCardProps {
  signals: EnergySignals
}

export function EnergySignalsCard({ signals }: EnergySignalsCardProps) {
  const { colors } = useTheme()

  // Don't show if no signals active
  if (!hasActiveEnergySignals(signals)) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' },
        ]}
      >
        <View style={styles.header}>
          <Ionicons name="flash-outline" size={20} color="#10B981" />
          <Text style={[styles.title, { color: colors.text.primary }]}>Ton energie</Text>
        </View>
        <Text style={[styles.message, { color: colors.text.secondary }]}>
          Aucun signal particulier cette semaine. Continue comme ca !
        </Text>
      </View>
    )
  }

  const message = getEnergySignalMessage(signals)

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)' },
      ]}
    >
      <View style={styles.header}>
        <Ionicons name="flash-outline" size={20} color="#F59E0B" />
        <Text style={[styles.title, { color: colors.text.primary }]}>Ton energie</Text>
      </View>

      {message && (
        <Text style={[styles.message, { color: colors.text.secondary }]}>{message}</Text>
      )}

      {/* Signal indicators */}
      <View style={styles.signals}>
        {signals.lowProtein3Days && (
          <SignalItem
            icon="nutrition-outline"
            label="Proteines basses"
            detail={`${signals.details?.proteinDaysLow || 3} jours`}
            colors={colors}
          />
        )}
        {signals.lowFiber3Days && (
          <SignalItem
            icon="leaf-outline"
            label="Fibres basses"
            detail={`${signals.details?.fiberDaysLow || 3} jours`}
            colors={colors}
          />
        )}
        {signals.highUltraProcessed && (
          <SignalItem
            icon="fast-food-outline"
            label="Ultra-transforme frequent"
            detail={`${signals.details?.ultraProcessedPercentage || 40}%`}
            colors={colors}
          />
        )}
      </View>

      <Text style={[styles.disclaimer, { color: colors.text.tertiary }]}>
        Ce sont des reperes, pas des alarmes. Ecoute ton corps.
      </Text>
    </View>
  )
}

function SignalItem({
  icon,
  label,
  detail,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  detail: string
  colors: ReturnType<typeof useTheme>['colors']
}) {
  return (
    <View style={styles.signalItem}>
      <Ionicons name={icon} size={16} color="#F59E0B" />
      <Text style={[styles.signalLabel, { color: colors.text.primary }]}>{label}</Text>
      <Text style={[styles.signalDetail, { color: colors.text.tertiary }]}>{detail}</Text>
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
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.bodySemibold,
  },
  message: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  signals: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  signalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  signalLabel: {
    ...typography.body,
    flex: 1,
  },
  signalDetail: {
    ...typography.caption,
  },
  disclaimer: {
    ...typography.caption,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
})

export default EnergySignalsCard
