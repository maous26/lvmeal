import React from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { ChevronRight, Zap } from 'lucide-react-native'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useGamificationStore } from '../../stores/gamification-store'

interface GamificationPanelProps {
  compact?: boolean
  onViewAll?: () => void
}

export function GamificationPanel({ compact = false, onViewAll }: GamificationPanelProps) {
  const {
    currentLevel,
    totalXP,
    currentStreak,
    getXPProgress,
    getLevelTitle,
    getStreakInfo,
    getUnlockedBadges,
    getNextBadges,
  } = useGamificationStore()

  const xpProgress = getXPProgress()
  const streakInfo = getStreakInfo()
  const unlockedBadges = getUnlockedBadges()
  const nextBadges = getNextBadges()

  if (compact) {
    return (
      <Card style={styles.compactCard}>
        <View style={styles.compactContent}>
          <View style={styles.compactLeft}>
            {/* Streak Badge */}
            <View style={[styles.streakBadge, streakInfo.isActive && styles.streakBadgeActive]}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakDays}>{streakInfo.current}</Text>
            </View>

            {/* Level Badge */}
            <View style={styles.levelBadge}>
              <Zap size={14} color="#FFFFFF" />
              <Text style={styles.levelText}>Nv.{currentLevel}</Text>
            </View>
          </View>

          <Pressable onPress={onViewAll} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>Voir tout</Text>
            <ChevronRight size={16} color={colors.accent.primary} />
          </Pressable>
        </View>
      </Card>
    )
  }

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Progression</Text>
        {onViewAll && (
          <Pressable onPress={onViewAll} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>Tout voir</Text>
            <ChevronRight size={16} color={colors.accent.primary} />
          </Pressable>
        )}
      </View>

      {/* Main Stats Row */}
      <View style={styles.statsRow}>
        {/* Streak Badge */}
        <View style={[styles.streakBadgeLarge, streakInfo.isActive && styles.streakBadgeActive]}>
          <Text style={styles.streakEmojiLarge}>🔥</Text>
          <Text style={styles.streakDaysLarge}>{streakInfo.current}</Text>
          <Text style={styles.streakLabel}>jours</Text>
        </View>

        {/* XP Progress */}
        <View style={styles.xpContainer}>
          <View style={styles.xpHeader}>
            <View style={styles.levelBadge}>
              <Zap size={14} color="#FFFFFF" />
              <Text style={styles.levelText}>Nv.{currentLevel}</Text>
            </View>
            <Text style={styles.xpTotal}>{totalXP.toLocaleString('fr-FR')} XP</Text>
          </View>
          <ProgressBar
            value={xpProgress.current}
            max={xpProgress.needed}
            color={colors.accent.primary}
            size="md"
          />
          <Text style={styles.xpRemaining}>
            {(xpProgress.needed - xpProgress.current).toLocaleString('fr-FR')} XP pour Nv.{currentLevel + 1}
          </Text>
        </View>
      </View>

      {/* Level Title */}
      <View style={styles.levelTitleContainer}>
        <Text style={styles.levelTitleIcon}>⭐</Text>
        <Text style={styles.levelTitleText}>{getLevelTitle()}</Text>
      </View>

      {/* Badges Section */}
      {unlockedBadges.length > 0 && (
        <View style={styles.badgesSection}>
          <Text style={styles.sectionTitle}>
            Badges debloques ({unlockedBadges.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgesScroll}>
            {unlockedBadges.slice(0, 5).map((badge) => (
              <View key={badge.id} style={styles.badgeChip}>
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
                <Text style={styles.badgeName}>{badge.name}</Text>
              </View>
            ))}
            {unlockedBadges.length > 5 && (
              <View style={styles.badgeMore}>
                <Text style={styles.badgeMoreText}>+{unlockedBadges.length - 5}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Next Badges */}
      {nextBadges.length > 0 && (
        <View style={styles.nextBadgesSection}>
          <Text style={styles.sectionTitle}>Prochains objectifs</Text>
          {nextBadges.map((badge) => (
            <View key={badge.id} style={styles.nextBadgeItem}>
              <View style={styles.nextBadgeIcon}>
                <Text style={styles.nextBadgeEmoji}>{badge.icon}</Text>
              </View>
              <View style={styles.nextBadgeContent}>
                <Text style={styles.nextBadgeName}>{badge.name}</Text>
                <Text style={styles.nextBadgeDesc}>{badge.description}</Text>
              </View>
              <Text style={styles.nextBadgeXP}>+{badge.xpReward} XP</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
  },
  compactCard: {
    padding: spacing.default,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.default,
  },
  title: {
    ...typography.h4,
    color: colors.text.primary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    ...typography.small,
    color: colors.accent.primary,
    marginRight: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.default,
    marginBottom: spacing.lg,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  streakBadgeLarge: {
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  streakBadgeActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakEmojiLarge: {
    fontSize: 28,
  },
  streakDays: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  streakDaysLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
  },
  streakLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  levelText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  xpContainer: {
    flex: 1,
  },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  xpTotal: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  xpRemaining: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  levelTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.accent.light,
    borderRadius: radius.lg,
    marginBottom: spacing.default,
    gap: spacing.sm,
  },
  levelTitleIcon: {
    fontSize: 18,
  },
  levelTitleText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  badgesSection: {
    marginBottom: spacing.default,
  },
  sectionTitle: {
    ...typography.smallMedium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  badgesScroll: {
    marginHorizontal: -spacing.sm,
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    marginHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  badgeIcon: {
    fontSize: 16,
  },
  badgeName: {
    ...typography.caption,
    color: colors.text.primary,
  },
  badgeMore: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.full,
    marginHorizontal: spacing.xs,
  },
  badgeMoreText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  nextBadgesSection: {
    gap: spacing.sm,
  },
  nextBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  nextBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBadgeEmoji: {
    fontSize: 18,
    opacity: 0.5,
  },
  nextBadgeContent: {
    flex: 1,
  },
  nextBadgeName: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  nextBadgeDesc: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  nextBadgeXP: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
  },
})

export default GamificationPanel
