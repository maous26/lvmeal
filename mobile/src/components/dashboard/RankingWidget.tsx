import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { ChevronRight, Trophy, TrendingUp, Zap } from 'lucide-react-native'
import { Card } from '../ui/Card'
import { ProgressBar } from '../ui/ProgressBar'
import { useTheme } from '../../contexts/ThemeContext'
import { radius, spacing, typography } from '../../constants/theme'
import { useGamificationStore } from '../../stores/gamification-store'

interface RankingWidgetProps {
  onPress?: () => void
}

export function RankingWidget({ onPress }: RankingWidgetProps) {
  const { colors } = useTheme()
  const {
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

  // Determine rank color and message
  const getRankStyle = () => {
    if (rank.percentile <= 1) return { color: colors.gamification.diamond, bg: `${colors.gamification.diamond}20`, label: 'Élite' }
    if (rank.percentile <= 5) return { color: colors.gamification.gold, bg: `${colors.gamification.gold}20`, label: 'Top 5%' }
    if (rank.percentile <= 10) return { color: colors.gamification.silver, bg: `${colors.gamification.silver}20`, label: 'Top 10%' }
    if (rank.percentile <= 25) return { color: colors.gamification.bronze, bg: `${colors.gamification.bronze}20`, label: 'Top 25%' }
    return { color: colors.text.secondary, bg: colors.bg.tertiary, label: `Top ${rank.percentile}%` }
  }

  const rankStyle = getRankStyle()

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          {/* Tier + XP */}
          <View style={styles.tierSection}>
            <View style={[styles.tierBadge, { backgroundColor: tier.color + '20' }]}>
              <Text style={styles.tierIcon}>{tier.icon}</Text>
              <Text style={[styles.tierName, { color: tier.color }]}>{tier.nameFr}</Text>
            </View>
            <View style={styles.xpInfo}>
              <Zap size={14} color={colors.accent.primary} />
              <Text style={[styles.xpValue, { color: colors.accent.primary }]}>{weeklyXP} XP</Text>
              <Text style={[styles.xpLabel, { color: colors.text.muted }]}>cette semaine</Text>
            </View>
          </View>

          {/* Rank Badge */}
          <View style={[styles.rankBadge, { backgroundColor: rankStyle.bg }]}>
            <Trophy size={16} color={rankStyle.color} />
            <Text style={[styles.rankLabel, { color: rankStyle.color }]}>{rankStyle.label}</Text>
          </View>
        </View>

        {/* Progress Bar to Next Tier */}
        {nextTier && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: colors.text.secondary }]}>
                Vers {nextTier.icon} {nextTier.nameFr}
              </Text>
              <Text style={[styles.progressValue, { color: colors.text.primary }]}>
                {Math.round(tierProgress.percentage)}%
              </Text>
            </View>
            <ProgressBar
              value={tierProgress.current}
              max={tierProgress.needed}
              color={nextTier.color}
              size="sm"
            />
          </View>
        )}

        {/* Stats Row */}
        <View style={[styles.statsRow, { borderTopColor: colors.border.light }]}>
          {/* Streak */}
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{streakInfo.current}</Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>Série</Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border.light }]} />

          {/* AI Credits */}
          <View style={styles.statItem}>
            <Text style={styles.statEmoji}>🤖</Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>{aiCredits === 999 ? '∞' : aiCredits}</Text>
            <Text style={[styles.statLabel, { color: colors.text.muted }]}>Crédits IA</Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border.light }]} />

          {/* Bonus */}
          {streakInfo.bonus > 0 ? (
            <View style={styles.statItem}>
              <TrendingUp size={18} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.success }]}>+{streakInfo.bonus}%</Text>
              <Text style={[styles.statLabel, { color: colors.text.muted }]}>Bonus XP</Text>
            </View>
          ) : (
            <View style={styles.statItem}>
              <Text style={styles.statEmoji}>🎯</Text>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{tierProgress.needed - tierProgress.current}</Text>
              <Text style={[styles.statLabel, { color: colors.text.muted }]}>XP restants</Text>
            </View>
          )}

          {/* Arrow */}
          <ChevronRight size={20} color={colors.text.muted} style={styles.arrow} />
        </View>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.default,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  tierSection: {
    gap: spacing.xs,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  tierIcon: {
    fontSize: 18,
  },
  tierName: {
    ...typography.smallMedium,
    fontWeight: '700',
  },
  xpInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xs,
  },
  xpValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  xpLabel: {
    ...typography.caption,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  rankLabel: {
    ...typography.smallMedium,
    fontWeight: '600',
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    ...typography.caption,
  },
  progressValue: {
    ...typography.caption,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statEmoji: {
    fontSize: 18,
  },
  statValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  statLabel: {
    ...typography.caption,
    fontSize: 10,
  },
  divider: {
    width: 1,
    height: 30,
  },
  arrow: {
    marginLeft: spacing.sm,
  },
})

export default RankingWidget
