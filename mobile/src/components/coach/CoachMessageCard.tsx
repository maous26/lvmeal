/**
 * CoachMessageCard - Unified message display component
 *
 * Single component for all coach messages with:
 * - Visual variants by type (insight/alert/celebration/action/tip)
 * - Priority-based styling (P0-P3)
 * - Read/unread states
 * - Dismissible behavior (configurable)
 * - Action button support
 */

import React, { useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { ChevronRight, X } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, shadows, fonts } from '../../constants/theme'
import {
  getPriorityConfig,
  CATEGORY_EMOJI,
  type LymiaMessage,
  type MessageType,
} from '../../services/message-center'

// Type configuration for visual display
const TYPE_CONFIG: Record<MessageType, { label: string }> = {
  tip: { label: 'Conseil' },
  insight: { label: 'Analyse' },
  alert: { label: 'Alerte' },
  celebration: { label: 'Bravo !' },
  action: { label: 'Action' },
}

export interface CoachMessageCardProps {
  message: LymiaMessage
  onRead: () => void
  onDismiss: () => void
  onAction?: (route: string) => void
  /** Compact mode for inline display */
  compact?: boolean
  /** Show transparency reason (hidden by default - technical info) */
  showReason?: boolean
  /** Custom style */
  style?: object
}

export function CoachMessageCard({
  message,
  onRead,
  onDismiss,
  onAction,
  compact = false,
  showReason = false, // Hidden by default - technical info not useful to user
  style,
}: CoachMessageCardProps) {
  const { colors, isDark } = useTheme()

  // Get theme-aware priority colors
  const priorityConfig = getPriorityConfig(isDark)
  const typeConf = TYPE_CONFIG[message.type]
  const priorityConf = priorityConfig[message.priority]
  const emoji = message.emoji || CATEGORY_EMOJI[message.category]
  // Permettre à l'utilisateur de supprimer tous les messages
  const canDismiss = true

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!message.read) onRead()

    if (message.actionRoute && onAction) {
      onAction(message.actionRoute)
    }
  }, [message.read, message.actionRoute, onRead, onAction])

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDismiss()
  }, [onDismiss])

  // Compact variant
  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compactContainer,
          {
            backgroundColor: `${priorityConf.color}10`,
            borderColor: `${priorityConf.color}30`,
          },
          !message.read && { borderColor: `${priorityConf.color}60` },
          style,
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.compactEmoji}>{emoji}</Text>
        <Text
          style={[styles.compactText, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {message.title}
        </Text>
        {!message.read && (
          <View style={[styles.unreadDot, { backgroundColor: priorityConf.color }]} />
        )}
        <ChevronRight size={16} color={colors.text.tertiary} />
      </TouchableOpacity>
    )
  }

  // Full card variant
  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.bg.elevated,
          borderWidth: 1,
          borderColor: `${priorityConf.color}30`,
        },
        !message.read && {
          borderColor: `${priorityConf.color}60`,
          borderLeftWidth: 3,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${priorityConf.color}15` }]}>
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
        <View style={styles.headerText}>
          <View style={styles.typeRow}>
            <Text style={[styles.typeLabel, { color: priorityConf.color }]}>
              {typeConf.label}
            </Text>
            {!message.read && (
              <View style={[styles.unreadDot, { backgroundColor: priorityConf.color }]} />
            )}
          </View>
        </View>
        {canDismiss && (
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.dismissButton}
          >
            <X size={18} color={colors.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <Text style={[styles.title, { color: colors.text.primary }]}>
        {message.title}
      </Text>
      <Text style={[styles.messageText, { color: colors.text.secondary }]}>
        {message.message}
      </Text>

      {/* Transparency: Why this message (hidden by default) */}
      {showReason && message.reason && (
        <View style={[styles.reasonContainer, { backgroundColor: colors.bg.secondary }]}>
          <Text style={[styles.reasonText, { color: colors.text.muted }]}>
            💡 {message.reason}
          </Text>
        </View>
      )}

      {/* Action Button */}
      {message.actionLabel && (
        <View style={[styles.actionButton, { backgroundColor: `${priorityConf.color}15` }]}>
          <Text style={[styles.actionText, { color: priorityConf.color }]}>
            {message.actionLabel}
          </Text>
          <ChevronRight size={16} color={priorityConf.color} />
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  // Full card styles
  card: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  emoji: {
    fontSize: 18,
  },
  headerText: {
    flex: 1,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  typeLabel: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dismissButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  messageText: {
    ...typography.body,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  reasonContainer: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  reasonText: {
    ...typography.caption,
    fontStyle: 'italic',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionText: {
    ...typography.smallMedium,
    fontWeight: '600',
  },

  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  compactEmoji: {
    fontSize: 16,
  },
  compactText: {
    ...typography.small,
    flex: 1,
  },
})

export default CoachMessageCard
