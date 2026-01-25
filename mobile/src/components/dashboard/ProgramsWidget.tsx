/**
 * ProgramsWidget - Widget compact récapitulatif des programmes actifs
 * Design: Organic Luxury - Vert Mousse & Terre Cuite
 * Affiche uniquement si l'utilisateur est inscrit à au moins un programme
 */

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronRight, Zap, Leaf, Check } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { GlassCard } from '../ui/GlassCard'
import { spacing, typography, radius } from '../../constants/theme'
import { useMetabolicBoostStore } from '../../stores/metabolic-boost-store'
import { useWellnessProgramStore } from '../../stores/wellness-program-store'

// iOS color palette matching ProgramsScreen
const PROGRAM_COLORS = {
  metabolic: {
    gradient: ['#FFE5CC', '#FF9500'] as const,
    accent: '#FF9500',
  },
  wellness: {
    gradient: ['#D4F5DC', '#34C759'] as const,
    accent: '#34C759',
  },
}

interface ProgramsWidgetProps {
  onPress?: () => void
}

export function ProgramsWidget({ onPress }: ProgramsWidgetProps) {
  const { colors } = useTheme()

  const {
    isEnrolled: isMetabolicEnrolled,
    currentWeek: metabolicWeek,
    getProgressPercentage: getMetabolicProgress,
  } = useMetabolicBoostStore()

  const {
    isEnrolled: isWellnessEnrolled,
    currentWeek: wellnessWeek,
    getProgressPercentage: getWellnessProgress,
  } = useWellnessProgramStore()

  const metabolicProgress = getMetabolicProgress()
  const wellnessProgress = getWellnessProgress()

  // Ne rien afficher si aucun programme actif
  if (!isMetabolicEnrolled && !isWellnessEnrolled) {
    return null
  }

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  const activeCount = (isMetabolicEnrolled ? 1 : 0) + (isWellnessEnrolled ? 1 : 0)

  return (
    <GlassCard style={styles.container} variant="subtle">
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.content}>
          <View style={styles.left}>
            <View style={styles.iconsRow}>
              {isMetabolicEnrolled && (
                <LinearGradient
                  colors={PROGRAM_COLORS.metabolic.gradient}
                  style={styles.iconBadge}
                >
                  <Zap size={14} color={PROGRAM_COLORS.metabolic.accent} />
                </LinearGradient>
              )}
              {isWellnessEnrolled && (
                <LinearGradient
                  colors={PROGRAM_COLORS.wellness.gradient}
                  style={[styles.iconBadge, isMetabolicEnrolled && styles.iconOverlap]}
                >
                  <Leaf size={14} color={PROGRAM_COLORS.wellness.accent} />
                </LinearGradient>
              )}
            </View>
            <View style={styles.textContent}>
              <Text style={[styles.title, { color: colors.text.primary }]}>
                {activeCount} programme{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}
              </Text>
              <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
                {isMetabolicEnrolled && `Boost métabolique Semaine ${metabolicWeek}`}
                {isMetabolicEnrolled && isWellnessEnrolled && ' · '}
                {isWellnessEnrolled && `Bien-être Semaine ${wellnessWeek}`}
              </Text>
            </View>
          </View>

          <View style={styles.right}>
            {/* Progress indicators with organic colors */}
            <View style={styles.progressBars}>
              {isMetabolicEnrolled && (
                <View style={[styles.miniProgress, { backgroundColor: 'rgba(200, 120, 99, 0.2)' }]}>
                  <View
                    style={[
                      styles.miniProgressFill,
                      { width: `${metabolicProgress}%`, backgroundColor: PROGRAM_COLORS.metabolic.accent }
                    ]}
                  />
                </View>
              )}
              {isWellnessEnrolled && (
                <View style={[styles.miniProgress, { backgroundColor: 'rgba(74, 103, 65, 0.2)' }]}>
                  <View
                    style={[
                      styles.miniProgressFill,
                      { width: `${wellnessProgress}%`, backgroundColor: PROGRAM_COLORS.wellness.accent }
                    ]}
                  />
                </View>
              )}
            </View>
            <ChevronRight size={18} color={colors.text.muted} />
          </View>
        </View>
      </TouchableOpacity>
    </GlassCard>
  )
}

const styles = StyleSheet.create({
  container: {
    // GlassCard handles borderRadius
  },
  touchable: {
    // Full touch area
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconsRow: {
    flexDirection: 'row',
    marginRight: spacing.md,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOverlap: {
    marginLeft: -8,
  },
  textContent: {
    flex: 1,
  },
  title: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressBars: {
    gap: 4,
  },
  miniProgress: {
    width: 40,
    height: 4,
    borderRadius: 2,
    // backgroundColor set dynamically with organic colors
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
})
