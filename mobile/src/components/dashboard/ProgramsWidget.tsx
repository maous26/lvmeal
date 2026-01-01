/**
 * ProgramsWidget - Widget compact récapitulatif des programmes actifs
 * Affiche uniquement si l'utilisateur est inscrit à au moins un programme
 */

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronRight, Zap, Heart, Check } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius } from '../../constants/theme'
import { useMetabolicBoostStore } from '../../stores/metabolic-boost-store'
import { useWellnessProgramStore } from '../../stores/wellness-program-store'

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
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.bg.elevated }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <View style={styles.left}>
          <View style={styles.iconsRow}>
            {isMetabolicEnrolled && (
              <LinearGradient
                colors={['#FEF3C7', '#FDE68A']}
                style={styles.iconBadge}
              >
                <Zap size={14} color="#D97706" />
              </LinearGradient>
            )}
            {isWellnessEnrolled && (
              <LinearGradient
                colors={['#EDE9FE', '#DDD6FE']}
                style={[styles.iconBadge, isMetabolicEnrolled && styles.iconOverlap]}
              >
                <Heart size={14} color="#7C3AED" />
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
          {/* Progress indicators */}
          <View style={styles.progressBars}>
            {isMetabolicEnrolled && (
              <View style={styles.miniProgress}>
                <View
                  style={[
                    styles.miniProgressFill,
                    { width: `${metabolicProgress}%`, backgroundColor: '#F59E0B' }
                  ]}
                />
              </View>
            )}
            {isWellnessEnrolled && (
              <View style={styles.miniProgress}>
                <View
                  style={[
                    styles.miniProgressFill,
                    { width: `${wellnessProgress}%`, backgroundColor: '#8B5CF6' }
                  ]}
                />
              </View>
            )}
          </View>
          <ChevronRight size={18} color={colors.text.muted} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    padding: spacing.md,
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
    backgroundColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
})
