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
import { ChevronRight, Sparkles, X, Clock } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import {
  spacing,
  typography,
  radius,
  shadows,
  fonts,
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

  // Format relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays === 1) return 'Hier'
    if (diffDays < 7) return `Il y a ${diffDays} jours`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDismiss()
  }

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

        {/* Header with emoji, badges and dismiss */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.emojiContainer}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.badges}>
                <AIBadge variant="inline" text="LYM" size="sm" />
                {!message.read && (
                  <View style={[styles.newBadge, { backgroundColor: priorityConf.color }]}>
                    <Text style={styles.newBadgeText}>Nouveau</Text>
                  </View>
                )}
              </View>
              {/* Timestamp */}
              <View style={styles.timeRow}>
                <Clock size={12} color={colors.text.muted} />
                <Text style={[styles.timeText, { color: colors.text.muted }]}>
                  {getRelativeTime(message.createdAt)}
                </Text>
              </View>
            </View>
          </View>
          {/* Dismiss button */}
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.dismissButton, { backgroundColor: colors.bg.tertiary }]}
          >
            <X size={18} color={colors.text.muted} />
          </TouchableOpacity>
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
          <View
            style={[
              styles.actionButton,
              { backgroundColor: colors.accent.primary },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.text.inverse }]}>{message.actionLabel}</Text>
            <ChevronRight size={18} color={colors.text.inverse} />
          </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  headerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  emojiContainer: {
    width: componentSizes.avatar.lg,
    height: componentSizes.avatar.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timeText: {
    ...typography.xs,
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
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
