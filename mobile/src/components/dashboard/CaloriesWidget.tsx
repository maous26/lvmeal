/**
 * CaloriesWidget - Professional-grade calories tracking widget
 *
 * Features:
 * - Animated circular progress with gradient stroke
 * - Clear visual hierarchy
 * - Breakdown of consumed/burned/remaining
 * - Sport bonus indicator when active
 * - Full dark mode support
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'
import { Flame, Zap, Target, TrendingUp } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, shadows } from '../../constants/theme'
import { formatNumber } from '../../lib/utils'

interface CaloriesWidgetProps {
  consumed: number
  burned: number
  target: number
  sportBonus?: number
}

function AnimatedCircularProgress({
  value,
  max,
  size = 140,
  strokeWidth = 12,
}: {
  value: number
  max: number
  size?: number
  strokeWidth?: number
}) {
  const center = size / 2
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const progress = Math.min(value / max, 1)
  const strokeDashoffset = circumference * (1 - progress)

  // Calculate percentage for display
  const percentage = Math.round(progress * 100)

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="100%" stopColor="rgba(255,255,255,0.6)" stopOpacity={1} />
          </SvgGradient>
        </Defs>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      {/* Center content */}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.progressPercentage}>{percentage}%</Text>
        <Text style={styles.progressLabel}>atteint</Text>
      </View>
    </View>
  )
}

export default function CaloriesWidget({ consumed, burned, target, sportBonus = 0 }: CaloriesWidgetProps) {
  const { colors, isDark } = useTheme()
  const effectiveTarget = target + sportBonus
  const remaining = Math.max(0, effectiveTarget - consumed + burned)

  // Dynamic gradient colors based on theme
  const gradientColors = isDark
    ? ['#0080C9', '#005580'] as const
    : ['#009FEB', '#0080C9'] as const

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Main content row */}
        <View style={styles.mainRow}>
          {/* Left: Remaining calories */}
          <View style={styles.leftSection}>
            <View style={styles.labelRow}>
              <Target size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.labelText}>Restant</Text>
            </View>
            <Text style={styles.mainValue}>{formatNumber(remaining)}</Text>
            <Text style={styles.unitText}>kcal</Text>

            {sportBonus > 0 && (
              <View style={styles.bonusBadge}>
                <TrendingUp size={10} color={colors.success} />
                <Text style={[styles.bonusText, { color: colors.success }]}>+{sportBonus} sport</Text>
              </View>
            )}
          </View>

          {/* Right: Circular progress */}
          <AnimatedCircularProgress
            value={consumed}
            max={effectiveTarget}
            size={120}
            strokeWidth={10}
          />
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Flame size={14} color={colors.secondary.primary} />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{formatNumber(consumed)}</Text>
              <Text style={styles.statLabel}>Consommé</Text>
            </View>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Zap size={14} color={colors.success} />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{formatNumber(burned)}</Text>
              <Text style={styles.statLabel}>Brûlé</Text>
            </View>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <Target size={14} color={colors.warning} />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statValue}>{formatNumber(effectiveTarget)}</Text>
              <Text style={styles.statLabel}>Objectif</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  gradient: {
    padding: spacing.lg,
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  labelText: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mainValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -2,
    lineHeight: 52,
  },
  unitText: {
    ...typography.body,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -4,
  },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  bonusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  progressLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statIconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: spacing.sm,
  },
})
