/**
 * FeaturedInsight - Carte principale mise en avant
 *
 * Design premium pour l'insight le plus important du jour.
 * Plus grande, avec effet visuel et animation subtile.
 */

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { ChevronRight, Sparkles } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'

import { useTheme } from '../../contexts/ThemeContext'
import {
  spacing,
  typography,
  radius,
  shadows,
  fonts,
  colors as staticColors,
  componentSizes,
} from '../../constants/theme'
import {
  getPriorityConfig,
  CATEGORY_EMOJI,
  type LymiaMessage,
} from '../../services/message-center'
import { AIBadge, SourceBadge } from '../ai'

interface FeaturedInsightProps {
  message: LymiaMessage
  onRead: () => void
  onDismiss: () => void
  onAction?: (route: string) => void
}

export function FeaturedInsight({
  message,
  onRead,
  onDismiss,
  onAction,
}: FeaturedInsightProps) {
  const { colors, isDark } = useTheme()
  const priorityConfig = getPriorityConfig(isDark)
  const priorityConf = priorityConfig[message.priority]
  const emoji = message.emoji || CATEGORY_EMOJI[message.category]

  // Subtle pulse animation for unread
  const pulseAnim = useRef(new Animated.Value(1)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!message.read) {
      // Subtle glow effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start()
    }
  }, [message.read, glowAnim])

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (!message.read) onRead()
    if (message.actionRoute && onAction) {
      onAction(message.actionRoute)
    }
  }

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  })

  // Gradient colors based on message type/priority
  const getGradientColors = (): [string, string] => {
    if (message.type === 'celebration') {
      return [staticColors.secondary.primary, staticColors.accent.primary]
    }
    if (message.priority === 'P0') {
      return [staticColors.error, '#FF6B6B']
    }
    return [staticColors.accent.primary, staticColors.secondary.primary]
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
      style={styles.container}
    >
      {/* Background glow effect */}
      {!message.read && (
        <Animated.View
          style={[
            styles.glowEffect,
            {
              backgroundColor: priorityConf.color,
              opacity: glowOpacity,
            },
          ]}
        />
      )}

      <View style={[styles.card, { backgroundColor: colors.bg.elevated }]}>
        {/* Gradient accent bar */}
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentBar}
        />

        {/* Header with emoji and badges */}
        <View style={styles.header}>
          <View style={styles.emojiContainer}>
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
          <View style={styles.badges}>
            <AIBadge variant="inline" text="LYM" size="sm" />
            {!message.read && (
              <View style={[styles.newBadge, { backgroundColor: priorityConf.color }]}>
                <Text style={styles.newBadgeText}>Nouveau</Text>
              </View>
            )}
          </View>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {message.title}
          </Text>
          <Text style={[styles.message, { color: colors.text.secondary }]}>
            {message.message}
          </Text>
        </View>

        {/* Source scientifique */}
        {message.source && (
          <View style={styles.sourceRow}>
            <SourceBadge source={message.source} />
          </View>
        )}

        {/* Action footer */}
        {message.actionLabel && (
          <LinearGradient
            colors={getGradientColors()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>{message.actionLabel}</Text>
            <ChevronRight size={18} color="#FFFFFF" />
          </LinearGradient>
        )}

        {/* Sparkle decoration */}
        <View style={styles.sparkleDecoration}>
          <Sparkles size={16} color={`${priorityConf.color}40`} />
        </View>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  glowEffect: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: radius.xl + 8,
    zIndex: -1,
  },
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  accentBar: {
    height: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  emojiContainer: {
    width: componentSizes.avatar.xl,
    height: componentSizes.avatar.xl,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  newBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  newBadgeText: {
    ...typography.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontFamily: fonts.serif.bold,
    fontWeight: '700',
    marginBottom: spacing.sm,
    lineHeight: 26,
  },
  message: {
    ...typography.body,
    lineHeight: 24,
  },
  sourceRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
  },
  actionText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sparkleDecoration: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg + 80,
    opacity: 0.5,
  },
})

export default FeaturedInsight
