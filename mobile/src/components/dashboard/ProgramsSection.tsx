/**
 * ProgramsSection - Cartes programmes élégantes et minimalistes
 */

import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius } from '../../constants/theme'
import { useMetabolicBoostStore } from '../../stores/metabolic-boost-store'
import { useWellnessProgramStore } from '../../stores/wellness-program-store'

interface ProgramsSectionProps {
  onMetabolicPress?: () => void
  onWellnessPress?: () => void
}

export function ProgramsSection({
  onMetabolicPress,
  onWellnessPress,
}: ProgramsSectionProps) {
  const { colors } = useTheme()

  const {
    isEnrolled: isMetabolicEnrolled,
    currentWeek: metabolicWeek,
    getProgressPercentage,
  } = useMetabolicBoostStore()

  const {
    isEnrolled: isWellnessEnrolled,
    currentWeek: wellnessWeek,
    getProgressPercentage: getWellnessProgress,
  } = useWellnessProgramStore()

  // Les deux programmes peuvent cohabiter - toujours afficher les deux
  const showMetabolic = true
  const showWellness = true

  const metabolicProgress = getProgressPercentage()
  const wellnessProgress = getWellnessProgress()

  const handlePress = (type: 'metabolic' | 'wellness') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (type === 'metabolic') onMetabolicPress?.()
    else onWellnessPress?.()
  }

  return (
    <View style={styles.container}>
      {/* Metabolic Card */}
      {showMetabolic && (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.bg.elevated },
            pressed && styles.cardPressed,
          ]}
          onPress={() => handlePress('metabolic')}
        >
          <LinearGradient
            colors={['#FEF3C7', '#FDE68A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.illustration}
          >
            <Text style={styles.illustrationEmoji}>⚡</Text>
          </LinearGradient>

          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
              Boost Métabolique
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.text.tertiary }]}>
              {isMetabolicEnrolled
                ? `Semaine ${metabolicWeek} · ${Math.round(metabolicProgress)}%`
                : '12 semaines'}
            </Text>
          </View>

          <ChevronRight size={20} color={colors.text.muted} />
        </Pressable>
      )}

      {/* Wellness Card */}
      {showWellness && (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.bg.elevated },
            pressed && styles.cardPressed,
          ]}
          onPress={() => handlePress('wellness')}
        >
          <LinearGradient
            colors={['#EDE9FE', '#DDD6FE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.illustration}
          >
            <Text style={styles.illustrationEmoji}>🧘</Text>
          </LinearGradient>

          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
              Bien-être
            </Text>
            <Text style={[styles.cardSubtitle, { color: colors.text.tertiary }]}>
              {isWellnessEnrolled
                ? `Semaine ${wellnessWeek} · ${Math.round(wellnessProgress)}%`
                : '8 semaines'}
            </Text>
          </View>

          <ChevronRight size={20} color={colors.text.muted} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    gap: spacing.md,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  illustration: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationEmoji: {
    fontSize: 24,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    marginBottom: 2,
  },
  cardSubtitle: {
    ...typography.caption,
  },
})
