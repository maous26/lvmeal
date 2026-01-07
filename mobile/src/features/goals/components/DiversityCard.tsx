/**
 * Diversity Card Component
 *
 * Displays food group diversity for the week.
 * Shows qualitative levels (faible/moyenne/bonne), never scores.
 */

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../contexts/ThemeContext'
import { spacing, radius, typography } from '../../../constants/theme'
import type { DiversityResult, FoodGroup } from '../types'
import { FOOD_GROUP_LABELS } from '../types'
import { getDiversityLevelLabel, getDiversityMessage } from '../services/diversity-calculator'

interface DiversityCardProps {
  diversity: DiversityResult
  onPress?: () => void
}

const FOOD_GROUP_ICONS: Record<FoodGroup, string> = {
  fruits: '🍎',
  vegetables: '🥦',
  proteins: '🍗',
  legumes: '🫘',
  whole_grains: '🌾',
  dairy: '🧀',
  nuts_seeds: '🥜',
  fish: '🐟',
}

export function DiversityCard({ diversity, onPress }: DiversityCardProps) {
  const { colors } = useTheme()
  const levelLabel = getDiversityLevelLabel(diversity.level)
  const message = getDiversityMessage(diversity)

  // Color based on level
  const levelColor =
    diversity.level === 'good'
      ? '#10B981'
      : diversity.level === 'medium'
      ? '#D4A574'
      : colors.text.tertiary

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
          <Ionicons name="grid-outline" size={20} color={colors.accent.primary} />
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Variete alimentaire
          </Text>
        </View>
        <View style={[styles.levelBadge, { backgroundColor: `${levelColor}20` }]}>
          <Text style={[styles.levelText, { color: levelColor }]}>{levelLabel}</Text>
        </View>
      </View>

      {/* Food groups grid */}
      <View style={styles.groupsGrid}>
        {Object.entries(FOOD_GROUP_ICONS).map(([group, icon]) => {
          const isPresent = diversity.presentGroups.includes(group as FoodGroup)
          return (
            <View
              key={group}
              style={[
                styles.groupItem,
                {
                  backgroundColor: isPresent
                    ? 'rgba(16, 185, 129, 0.1)'
                    : colors.bg.secondary,
                  borderColor: isPresent
                    ? 'rgba(16, 185, 129, 0.3)'
                    : colors.border.light,
                },
              ]}
            >
              <Text style={styles.groupIcon}>{icon}</Text>
              <Text
                style={[
                  styles.groupLabel,
                  { color: isPresent ? colors.text.primary : colors.text.tertiary },
                ]}
                numberOfLines={1}
              >
                {FOOD_GROUP_LABELS[group as FoodGroup]}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Message */}
      <Text style={[styles.message, { color: colors.text.secondary }]}>{message}</Text>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.text.tertiary }]}>
          Sur les 7 derniers jours
        </Text>
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
  levelBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  levelText: {
    ...typography.caption,
    fontWeight: '600',
  },
  groupsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  groupIcon: {
    fontSize: 14,
  },
  groupLabel: {
    ...typography.caption,
  },
  message: {
    ...typography.small,
    marginBottom: spacing.sm,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: spacing.sm,
  },
  footerText: {
    ...typography.caption,
    fontStyle: 'italic',
  },
})

export default DiversityCard
