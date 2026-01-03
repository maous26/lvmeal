/**
 * Check-in Prompt Card Component
 *
 * Displays a gentle prompt for wellness check-in.
 * Always includes "Pas maintenant" option.
 * Never obligatory, never pushy.
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../constants/theme'

interface CheckinPromptCardProps {
  onAccept: () => void
  onSkip: () => void
}

export function CheckinPromptCard({ onAccept, onSkip }: CheckinPromptCardProps) {
  const { colors } = useTheme()

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.2)' },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.accent.primary }]}>
          <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Comment te sens-tu aujourd'hui ?
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Un petit check-in pour mieux te connaitre.
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onSkip}
          style={[styles.skipButton, { borderColor: colors.border.default }]}
        >
          <Text style={[styles.skipText, { color: colors.text.tertiary }]}>Pas maintenant</Text>
        </Pressable>

        <Pressable
          onPress={onAccept}
          style={[styles.acceptButton, { backgroundColor: colors.accent.primary }]}
        >
          <Text style={styles.acceptText}>Repondre</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
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
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...typography.bodySemibold,
    marginBottom: 4,
  },
  subtitle: {
    ...typography.small,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  skipButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.default,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...typography.body,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.default,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  acceptText: {
    ...typography.bodySemibold,
    color: '#FFFFFF',
  },
})

export default CheckinPromptCard
