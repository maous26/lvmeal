/**
 * CoachHistoryScreen - Historique des messages du Coach
 *
 * UX Cockpit - Couche 3: Traçabilité
 * - Liste chronologique de ce que le Coach a dit
 * - Ce que l'utilisateur a fait (action taken)
 * - Ce qui a été ignoré (dismissed)
 *
 * C'est là que la confiance se construit.
 * Sans historique, l'IA ressemble à un oracle capricieux.
 */

import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native'
import { ArrowLeft, CheckCircle, XCircle, Clock, Eye } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, fonts, shadows } from '../constants/theme'
import { useMessageCenter, getPriorityConfig, CATEGORY_EMOJI, type LymiaMessage } from '../services/message-center'

// Group messages by date
function groupByDate(messages: LymiaMessage[]): Record<string, LymiaMessage[]> {
  const groups: Record<string, LymiaMessage[]> = {}

  messages.forEach(msg => {
    const date = new Date(msg.createdAt)
    const key = date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    if (!groups[key]) groups[key] = []
    groups[key].push(msg)
  })

  return groups
}

// Get status icon and color for a message
function getMessageStatus(message: LymiaMessage, colors: any): { icon: React.ReactNode; label: string; color: string } {
  if (message.dismissed) {
    return {
      icon: <XCircle size={16} color={colors.text.muted} />,
      label: 'Ignoré',
      color: colors.text.muted,
    }
  }

  if (message.read) {
    return {
      icon: <Eye size={16} color={colors.success} />,
      label: 'Lu',
      color: colors.success,
    }
  }

  return {
    icon: <Clock size={16} color={colors.warning} />,
    label: 'Non lu',
    color: colors.warning,
  }
}

export default function CoachHistoryScreen() {
  const { colors, isDark } = useTheme()
  const navigation = useNavigation()
  const priorityConfig = getPriorityConfig(isDark)

  // Get ALL messages (including dismissed)
  const allMessages = useMessageCenter((s) => s.messages)

  // Sort by date descending
  const sortedMessages = useMemo(() => {
    return [...allMessages].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [allMessages])

  const groupedMessages = useMemo(() => groupByDate(sortedMessages), [sortedMessages])
  const dateKeys = Object.keys(groupedMessages)

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.goBack()
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.text.primary }]}>Historique</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {allMessages.length} message{allMessages.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {dateKeys.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
              Aucun historique
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
              Les conseils du Coach apparaîtront ici
            </Text>
          </View>
        ) : (
          dateKeys.map((dateKey) => (
            <View key={dateKey} style={styles.dateGroup}>
              {/* Date header */}
              <Text style={[styles.dateHeader, { color: colors.text.tertiary }]}>
                {dateKey}
              </Text>

              {/* Messages for this date */}
              {groupedMessages[dateKey].map((message) => {
                const status = getMessageStatus(message, colors)
                const priorityConf = priorityConfig[message.priority]
                const emoji = message.emoji || CATEGORY_EMOJI[message.category]

                return (
                  <View
                    key={message.id}
                    style={[
                      styles.historyItem,
                      {
                        backgroundColor: colors.bg.elevated,
                        borderLeftColor: priorityConf.color,
                        opacity: message.dismissed ? 0.6 : 1,
                      },
                    ]}
                  >
                    {/* Emoji + content */}
                    <View style={styles.itemContent}>
                      <Text style={styles.itemEmoji}>{emoji}</Text>
                      <View style={styles.itemText}>
                        <Text
                          style={[styles.itemTitle, { color: colors.text.primary }]}
                          numberOfLines={1}
                        >
                          {message.title}
                        </Text>
                        <Text
                          style={[styles.itemMessage, { color: colors.text.secondary }]}
                          numberOfLines={2}
                        >
                          {message.message}
                        </Text>
                      </View>
                    </View>

                    {/* Status + time */}
                    <View style={styles.itemMeta}>
                      <View style={styles.statusBadge}>
                        {status.icon}
                        <Text style={[styles.statusText, { color: status.color }]}>
                          {status.label}
                        </Text>
                      </View>
                      <Text style={[styles.timeText, { color: colors.text.muted }]}>
                        {new Date(message.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.serif.bold,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.small,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.default,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 3,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  dateGroup: {
    marginBottom: spacing.xl,
  },
  dateHeader: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  historyItem: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    ...shadows.sm,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  itemEmoji: {
    fontSize: 20,
    marginTop: 2,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemMessage: {
    ...typography.small,
    lineHeight: 20,
  },
  itemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: spacing.xl + spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    ...typography.xs,
    fontWeight: '500',
  },
  timeText: {
    ...typography.xs,
  },
  bottomSpacer: {
    height: 40,
  },
})
