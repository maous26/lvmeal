import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { ChevronRight, Zap, Trophy, Sparkles } from 'lucide-react-native'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useGamificationStore, TIERS } from '../../stores/gamification-store'

interface GamificationPanelProps {
  compact?: boolean
  onViewAll?: () => void
}

export function GamificationPanel({ compact = false, onViewAll }: GamificationPanelProps) {
  const {
    totalXP,
    currentStreak,
    weeklyXP,
    getTier,
    getNextTier,
    getTierProgress,
    getWeeklyRank,
    getStreakInfo,
    getAICreditsRemaining,
  } = useGamificationStore()

  const tier = getTier()
  const nextTier = getNextTier()
  const tierProgress = getTierProgress()
  const rank = getWeeklyRank()
  const streakInfo = getStreakInfo()
  const aiCredits = getAICreditsRemaining()

  // Compact version for homepage
  if (compact) {
    return (
      <Card style={styles.compactCard}>
        <View style={styles.compactContent}>
          {/* Tier Badge */}
          <View style={[styles.tierBadge, { backgroundColor: tier.color + '20' }]}>
            <Text style={styles.tierIcon}>{tier.icon}</Text>
            <Text style={[styles.tierName, { color: tier.color }]}>{tier.nameFr}</Text>
          </View>

          {/* Streak */}
          <View style={[styles.streakBadge, streakInfo.isActive && styles.streakBadgeActive]}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakDays}>{streakInfo.current}</Text>
          </View>

          {/* Weekly XP */}
          <View style={styles.weeklyXP}>
            <Text style={styles.weeklyXPValue}>{weeklyXP}</Text>
            <Text style={styles.weeklyXPLabel}>XP/sem</Text>
          </View>

          {/* View All Button */}
          <Pressable onPress={onViewAll} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>Voir</Text>
            <ChevronRight size={16} color={colors.accent.primary} />
          </Pressable>
        </View>

        {/* Progress to next tier */}
        {nextTier && (
          <View style={styles.compactProgress}>
            <ProgressBar
              value={tierProgress.current}
              max={tierProgress.needed}
              color={nextTier.color}
              size="sm"
            />
            <Text style={styles.compactProgressText}>
              {tierProgress.needed - tierProgress.current} XP pour {nextTier.icon}
            </Text>
          </View>
        )}
      </Card>
    )
  }

  // Full version for progress screen
  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Ta progression</Text>
        {onViewAll && (
          <Pressable onPress={onViewAll} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>Achievements</Text>
            <ChevronRight size={16} color={colors.accent.primary} />
          </Pressable>
        )}
      </View>

      {/* Main Tier Card */}
      <View style={[styles.tierCard, { backgroundColor: tier.color + '15', borderColor: tier.color + '30' }]}>
        <View style={styles.tierHeader}>
          <Text style={styles.tierIconLarge}>{tier.icon}</Text>
          <View style={styles.tierInfo}>
            <Text style={[styles.tierNameLarge, { color: tier.color }]}>{tier.nameFr}</Text>
            <Text style={styles.totalXP}>{totalXP.toLocaleString('fr-FR')} XP total</Text>
          </View>
        </View>

        {/* Progress to next tier */}
        {nextTier && (
          <View style={styles.tierProgressSection}>
            <View style={styles.tierProgressHeader}>
              <Text style={styles.tierProgressLabel}>Prochain tier: {nextTier.icon} {nextTier.nameFr}</Text>
              <Text style={styles.tierProgressValue}>
                {tierProgress.current}/{tierProgress.needed} XP
              </Text>
            </View>
            <ProgressBar
              value={tierProgress.current}
              max={tierProgress.needed}
              color={nextTier.color}
              size="md"
            />
          </View>
        )}

        {/* Tier Features */}
        <View style={styles.tierFeatures}>
          {tier.features.map((feature, idx) => (
            <View key={idx} style={styles.featureItem}>
              <Sparkles size={14} color={tier.color} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Streak */}
        <View style={[styles.statCard, streakInfo.isActive && styles.statCardActive]}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>{streakInfo.current}</Text>
          <Text style={styles.statLabel}>Serie</Text>
          {streakInfo.bonus > 0 && (
            <Text style={styles.statBonus}>+{streakInfo.bonus}% XP</Text>
          )}
        </View>

        {/* Weekly XP */}
        <View style={styles.statCard}>
          <Zap size={24} color={colors.accent.primary} />
          <Text style={styles.statValue}>{weeklyXP}</Text>
          <Text style={styles.statLabel}>XP cette sem.</Text>
        </View>

        {/* Rank */}
        <View style={styles.statCard}>
          <Trophy size={24} color={colors.warning} />
          <Text style={styles.statValue}>Top {rank.percentile}%</Text>
          <Text style={styles.statLabel}>Classement</Text>
        </View>

        {/* AI Credits */}
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🤖</Text>
          <Text style={styles.statValue}>{aiCredits === 999 ? '∞' : aiCredits}</Text>
          <Text style={styles.statLabel}>Credits IA</Text>
        </View>
      </View>

      {/* Next Tier Preview */}
      {nextTier && (
        <View style={styles.nextTierPreview}>
          <Text style={styles.nextTierTitle}>Debloquez {nextTier.icon} {nextTier.nameFr}</Text>
          <View style={styles.nextTierFeatures}>
            {nextTier.features.slice(0, 2).map((feature, idx) => (
              <View key={idx} style={styles.nextTierFeature}>
                <Text style={styles.nextTierFeatureIcon}>✨</Text>
                <Text style={styles.nextTierFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
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
    gap: spacing.md,
  },
  compactProgress: {
    marginTop: spacing.sm,
  },
  compactProgressText: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
    textAlign: 'center',
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

  // Tier Badge (compact)
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  tierIcon: {
    fontSize: 18,
  },
  tierName: {
    ...typography.smallMedium,
    fontWeight: '600',
  },

  // Streak Badge
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  streakBadgeActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakDays: {
    ...typography.smallMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },

  // Weekly XP (compact)
  weeklyXP: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyXPValue: {
    ...typography.bodyMedium,
    color: colors.accent.primary,
    fontWeight: '700',
  },
  weeklyXPLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },

  // Tier Card (full)
  tierCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.default,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tierIconLarge: {
    fontSize: 48,
  },
  tierInfo: {
    flex: 1,
  },
  tierNameLarge: {
    ...typography.h3,
    fontWeight: '700',
  },
  totalXP: {
    ...typography.body,
    color: colors.text.secondary,
  },
  tierProgressSection: {
    marginBottom: spacing.md,
  },
  tierProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tierProgressLabel: {
    ...typography.small,
    color: colors.text.secondary,
  },
  tierProgressValue: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  tierFeatures: {
    gap: spacing.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.small,
    color: colors.text.secondary,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.default,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statCardActive: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  statEmoji: {
    fontSize: 24,
  },
  statValue: {
    ...typography.h4,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  statBonus: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },

  // Next Tier Preview
  nextTierPreview: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  nextTierTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  nextTierFeatures: {
    gap: spacing.xs,
  },
  nextTierFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  nextTierFeatureIcon: {
    fontSize: 14,
  },
  nextTierFeatureText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
})

export default GamificationPanel
