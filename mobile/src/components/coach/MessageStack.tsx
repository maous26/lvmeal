/**
 * MessageStack - Pile compressée des messages en attente
 *
 * UX Cockpit - Couche 2:
 * - Affiche "En attente (N)" de manière non intrusive
 * - Chaque item: icône + 1 ligne résumé, pas de bouton
 * - Cliquer = ouvrir en modal/expanded
 * - Ne pousse jamais, attend patiemment
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native'
import { ChevronDown, Clock } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, shadows

 } from '../../constants/theme'
import {
  getPriorityConfig,
  CATEGORY_EMOJI,
  type LymiaMessage,
} from '../../services/message-center'

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

interface MessageStackProps {
  messages: LymiaMessage[]
  onSelectMessage: (message: LymiaMessage) => void
}

export function MessageStack({ messages, onSelectMessage }: MessageStackProps) {
  const { colors, isDark } = useTheme()
  const priorityConfig = getPriorityConfig(isDark)
  const [isExpanded, setIsExpanded] = useState(false)

  const unreadCount = messages.filter(m => !m.read).length

  if (messages.length === 0) return null

  const toggleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setIsExpanded(!isExpanded)
  }

  const handleSelectMessage = (message: LymiaMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSelectMessage(message)
  }

  return (
    <View style={styles.container}>
      {/* Header - toujours visible */}
      <TouchableOpacity
        style={[
          styles.header,
          {
            backgroundColor: colors.bg.elevated,
            borderColor: unreadCount > 0 ? colors.accent.primary + '40' : colors.border.default,
          },
        ]}
        onPress={toggleExpand}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.stackIcon, { backgroundColor: colors.bg.tertiary }]}>
            <Clock size={16} color={colors.text.secondary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            En attente
          </Text>
          <View style={[
            styles.countBadge,
            { backgroundColor: unreadCount > 0 ? colors.accent.primary : colors.bg.tertiary }
          ]}>
            <Text style={[
              styles.countText,
              { color: unreadCount > 0 ? '#FFFFFF' : colors.text.secondary }
            ]}>
              {messages.length}
            </Text>
          </View>
        </View>

        <Animated.View style={{
          transform: [{ rotate: isExpanded ? '180deg' : '0deg' }]
        }}>
          <ChevronDown size={20} color={colors.text.tertiary} />
        </Animated.View>
      </TouchableOpacity>

      {/* Liste compressée - visible quand expandée */}
      {isExpanded && (
        <View style={[styles.stackList, { backgroundColor: colors.bg.elevated }]}>
          {messages.map((message, index) => {
            const priorityConf = priorityConfig[message.priority]
            const emoji = message.emoji || CATEGORY_EMOJI[message.category]

            return (
              <TouchableOpacity
                key={message.id}
                style={[
                  styles.stackItem,
                  index !== messages.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.default,
                  },
                ]}
                onPress={() => handleSelectMessage(message)}
                activeOpacity={0.7}
              >
                {/* Emoji */}
                <Text style={styles.itemEmoji}>{emoji}</Text>

                {/* Résumé 1 ligne */}
                <Text
                  style={[styles.itemText, { color: colors.text.primary }]}
                  numberOfLines={1}
                >
                  {message.title}
                </Text>

                {/* Indicateur non lu */}
                {!message.read && (
                  <View style={[styles.unreadDot, { backgroundColor: priorityConf.color }]} />
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stackIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  countText: {
    ...typography.caption,
    fontWeight: '700',
  },
  stackList: {
    marginTop: spacing.xs,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  stackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  itemEmoji: {
    fontSize: 18,
  },
  itemText: {
    ...typography.body,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})

export default MessageStack
