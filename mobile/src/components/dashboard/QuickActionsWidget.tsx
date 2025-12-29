/**
 * QuickActionsWidget - Professional quick action buttons
 *
 * Features:
 * - Clean, modern design
 * - Gradient accents
 * - Animated interactions
 * - Consistent spacing
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CalendarRange, Sparkles, ChevronRight } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { colors, spacing, typography, radius, shadows } from '../../constants/theme'

interface QuickActionsWidgetProps {
  onPlanPress: () => void
}

export default function QuickActionsWidget({ onPlanPress }: QuickActionsWidgetProps) {
  const handlePlanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPlanPress()
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.containerPressed,
      ]}
      onPress={handlePlanPress}
    >
      <LinearGradient
        colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {/* Left: Icon with badge */}
        <View style={styles.iconContainer}>
          <CalendarRange size={22} color="#10B981" />
          <View style={styles.sparkleContainer}>
            <Sparkles size={10} color="#F59E0B" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Plan repas 7 jours</Text>
          <Text style={styles.subtitle}>Genere par IA selon tes objectifs</Text>
        </View>

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <ChevronRight size={20} color="#10B981" />
        </View>
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    ...shadows.xs,
  },
  containerPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.bodyMedium,
    color: '#10B981',
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
