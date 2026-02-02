/**
 * FeaturedInsight - Carte Primaire du Cockpit Coach
 *
 * UX Cockpit - Couche 1:
 * - UNE seule grande carte, toujours visible en haut
 * - Titre actionnable + preuve courte (becauseLine)
 * - Bouton d'action unique
 * - Badge épistémique: ⚠️ (règle), 🤖 (IA), 🎉 (célébration)
 *
 * C'est LA meilleure prochaine action selon le système.
 */

import React, { useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native'
import { ChevronRight, X } from 'lucide-react-native'
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
import { SourceBadge } from '../ai'

interface FeaturedInsightProps {
  message: LymiaMessage
  onRead: () => void
  onDismiss: () => void
  onAction?: (route: string) => void
}

/**
 * Get epistemic badge based on message source
 * - ⚠️ = Règle dure (rule-based alert)
 * - 🤖 = Calcul personnalisé (AI-generated)
 * - 🎉 = Événement/célébration
 */
function getEpistemicBadge(message: LymiaMessage): { emoji: string; label: string } {
  // Celebration type
  if (message.type === 'celebration') {
    return { emoji: '🎉', label: 'Bravo' }
  }

  // AI-generated (reason starts with "IA:")
  if (message.reason?.startsWith('IA:')) {
    return { emoji: '🤖', label: 'IA' }
  }

  // Rule-based alerts (P0/P1 without AI marker)
  if (message.priority === 'P0' || message.priority === 'P1') {
    return { emoji: '⚠️', label: 'Alerte' }
  }

  // Tips/insights
  if (message.type === 'tip' || message.type === 'insight') {
    return { emoji: '💡', label: 'Conseil' }
  }

  // Default
  return { emoji: '📋', label: 'Info' }
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
  const categoryEmoji = message.emoji || CATEGORY_EMOJI[message.category]
  const epistemicBadge = getEpistemicBadge(message)

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDismiss()
  }

  // Subtle pulse animation for unread
  const glowAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!message.read) {
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
    outputRange: [0.2, 0.5],
  })

  // Extract becauseLine from reason field if it contains useful info
  // The becauseLine is stored in `reason` field for AI messages
  const becauseLine = message.reason && !message.reason.startsWith('IA:')
    ? message.reason
    : null

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
        {/* Header with epistemic badge and dismiss */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {/* Category emoji */}
            <View style={[styles.emojiContainer, { backgroundColor: `${priorityConf.color}15` }]}>
              <Text style={styles.emoji}>{categoryEmoji}</Text>
            </View>

            {/* Epistemic badge - tells user WHY this message exists */}
            <View style={[styles.epistemicBadge, { backgroundColor: `${priorityConf.color}20` }]}>
              <Text style={styles.epistemicEmoji}>{epistemicBadge.emoji}</Text>
              <Text style={[styles.epistemicLabel, { color: priorityConf.color }]}>
                {epistemicBadge.label}
              </Text>
            </View>

            {/* Unread indicator */}
            {!message.read && (
              <View style={[styles.newBadge, { backgroundColor: priorityConf.color }]}>
                <Text style={styles.newBadgeText}>Nouveau</Text>
              </View>
            )}
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

        {/* Because line - the proof/reason (visible to user) */}
        {becauseLine && (
          <View style={[styles.becauseContainer, { backgroundColor: colors.bg.secondary }]}>
            <Text style={[styles.becauseText, { color: colors.text.tertiary }]}>
              💡 Parce que : {becauseLine}
            </Text>
          </View>
        )}

        {/* Source scientifique */}
        {message.source && (
          <View style={styles.sourceRow}>
            <SourceBadge source={message.source} />
          </View>
        )}

        {/* Single action button - THE thing to do */}
        {message.actionLabel && (
          <View
            style={[
              styles.actionButton,
              { backgroundColor: colors.accent.primary },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.text.inverse }]}>
              {message.actionLabel}
            </Text>
            <ChevronRight size={18} color={colors.text.inverse} />
          </View>
        )}
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
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderRadius: radius.xl + 6,
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  emojiContainer: {
    width: componentSizes.avatar.md,
    height: componentSizes.avatar.md,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  epistemicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: 4,
  },
  epistemicEmoji: {
    fontSize: 12,
  },
  epistemicLabel: {
    ...typography.xs,
    fontWeight: '600',
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
  becauseContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  becauseText: {
    ...typography.small,
    fontStyle: 'italic',
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
})

export default FeaturedInsight
