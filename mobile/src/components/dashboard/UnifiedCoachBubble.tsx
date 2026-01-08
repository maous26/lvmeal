/**
 * UnifiedCoachBubble - Single Coach Communication Point
 *
 * Replaces: LymIA widget, CoachInsights, scattered messages
 * Shows: 1 priority message at a time with clear visual hierarchy
 */

import React, { useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { ChevronRight, X, Sparkles } from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card } from '../ui'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, fonts } from '../../constants/theme'
import {
  useMessageCenter,
  generateDailyMessages,
  PRIORITY_CONFIG,
  CATEGORY_EMOJI,
  type LymiaMessage,
} from '../../services/message-center'
import { useUserStore } from '../../stores/user-store'
import { useMealsStore } from '../../stores/meals-store'
import { useGamificationStore } from '../../stores/gamification-store'
import { useCaloricBankStore } from '../../stores/caloric-bank-store'

interface UnifiedCoachBubbleProps {
  compact?: boolean // For smaller spaces
  onSeeAll?: () => void
}

export default function UnifiedCoachBubble({
  compact = false,
  onSeeAll,
}: UnifiedCoachBubbleProps) {
  const navigation = useNavigation()
  const { colors } = useTheme()

  // MessageCenter
  const priorityMessage = useMessageCenter((s) => s.getPriorityMessage())
  const unreadCount = useMessageCenter((s) => s.getUnreadCount())
  const preferences = useMessageCenter((s) => s.preferences)
  const addMessage = useMessageCenter((s) => s.addMessage)
  const markAsRead = useMessageCenter((s) => s.markAsRead)
  const dismiss = useMessageCenter((s) => s.dismiss)
  const clearExpired = useMessageCenter((s) => s.clearExpired)

  // User data for message generation
  const { nutritionGoals } = useUserStore()
  const { getTodayData } = useMealsStore()
  const { currentStreak } = useGamificationStore()
  const { getPlaisirSuggestion } = useCaloricBankStore()

  // Animation for attention
  const pulseAnim = React.useRef(new Animated.Value(1)).current

  // Generate messages on mount
  useEffect(() => {
    clearExpired()

    // Generate contextual messages
    const todayData = getTodayData()
    const plaisirInfo = getPlaisirSuggestion()

    const proteinsPercent = nutritionGoals?.proteins
      ? Math.round((todayData.totalNutrition.proteins / nutritionGoals.proteins) * 100)
      : 0
    const waterPercent = Math.round((todayData.hydration / 2000) * 100)

    const lastMeal = todayData.meals.length > 0
      ? todayData.meals.reduce((latest, meal) => {
          const mealTime = new Date(`${meal.date}T${meal.time}`)
          return mealTime > latest ? mealTime : latest
        }, new Date(0))
      : null

    const newMessages = generateDailyMessages({
      caloriesConsumed: todayData.totalNutrition.calories,
      caloriesTarget: nutritionGoals?.calories || 2000,
      proteinsPercent,
      waterPercent,
      sleepHours: null,
      streak: currentStreak,
      lastMealTime: lastMeal && lastMeal.getTime() > 0 ? lastMeal : null,
      // Repas plaisir: max 600 kcal/repas, max 2/semaine, à partir du jour 3
      plaisirAvailable: plaisirInfo.available,
      maxPlaisirPerMeal: plaisirInfo.maxPerMeal,
      remainingPlaisirMeals: plaisirInfo.remainingPlaisirMeals,
    }, preferences)

    // Add messages (cooldown system prevents duplicates)
    newMessages.forEach(msg => addMessage(msg))
  }, []) // Run once on mount

  // Breathing animation (4% scale) - runs for all messages, more pronounced for P0
  useEffect(() => {
    if (priorityMessage) {
      const breathingScale = priorityMessage.priority === 'P0' ? 1.04 : 1.02
      const breathingDuration = priorityMessage.priority === 'P0' ? 1000 : 1500

      const breathing = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: breathingScale,
            duration: breathingDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: breathingDuration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
      breathing.start()
      return () => breathing.stop()
    }
  }, [priorityMessage?.id, priorityMessage?.priority, pulseAnim])

  // Vibrate for P0 messages
  useEffect(() => {
    if (priorityMessage?.priority === 'P0' && PRIORITY_CONFIG.P0.vibrate) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    }
  }, [priorityMessage?.id])

  const handlePress = useCallback(() => {
    if (!priorityMessage) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    markAsRead(priorityMessage.id)

    if (priorityMessage.actionRoute) {
      navigation.navigate(priorityMessage.actionRoute as never)
    } else if (onSeeAll) {
      onSeeAll()
    }
  }, [priorityMessage, markAsRead, navigation, onSeeAll])

  const handleDismiss = useCallback(() => {
    if (!priorityMessage) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    dismiss(priorityMessage.id)
  }, [priorityMessage, dismiss])

  const handleSeeAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (onSeeAll) {
      onSeeAll()
    } else {
      navigation.navigate('Coach' as never)
    }
  }, [onSeeAll, navigation])

  // No message - show minimal state
  if (!priorityMessage) {
    if (compact) return null

    return (
      <Card style={[styles.container, { backgroundColor: colors.bg.elevated }]}>
        <View style={styles.emptyState}>
          <View style={[styles.coachAvatar, { backgroundColor: colors.accent.light }]}>
            <Sparkles size={20} color={colors.accent.primary} />
          </View>
          <View style={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>
              LYM
            </Text>
            <Text style={[styles.emptyText, { color: colors.text.tertiary }]}>
              Tout va bien ! Continue comme ca.
            </Text>
          </View>
        </View>
      </Card>
    )
  }

  const config = PRIORITY_CONFIG[priorityMessage.priority]
  const emoji = priorityMessage.emoji || CATEGORY_EMOJI[priorityMessage.category]
  const canDismiss = !config.persistent

  if (compact) {
    return (
      <TouchableOpacity
        style={[
          styles.compactContainer,
          { backgroundColor: config.color + '15', borderColor: config.color + '30' },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.compactEmoji}>{emoji}</Text>
        <Text
          style={[styles.compactText, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {priorityMessage.title}
        </Text>
        <ChevronRight size={16} color={colors.text.tertiary} />
      </TouchableOpacity>
    )
  }

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <Card
        style={[
          styles.container,
          {
            backgroundColor: colors.bg.elevated,
            borderWidth: 1,
            borderColor: `${config.color}40`,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.coachAvatar, { backgroundColor: config.color + '20' }]}>
              <Text style={styles.avatarEmoji}>{emoji}</Text>
            </View>
            <View>
              <Text style={[styles.coachName, { color: colors.text.secondary }]}>
                LYM
              </Text>
              {unreadCount > 1 && (
                <TouchableOpacity onPress={handleSeeAll}>
                  <Text style={[styles.unreadBadge, { color: config.color }]}>
                    +{unreadCount - 1} autre{unreadCount > 2 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {canDismiss && (
            <TouchableOpacity
              onPress={handleDismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        <TouchableOpacity
          style={styles.content}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {priorityMessage.title}
          </Text>
          <Text style={[styles.message, { color: colors.text.secondary }]}>
            {priorityMessage.message}
          </Text>

          {priorityMessage.actionLabel && (
            <View style={[styles.actionButton, { backgroundColor: config.color + '15' }]}>
              <Text style={[styles.actionText, { color: config.color }]}>
                {priorityMessage.actionLabel}
              </Text>
              <ChevronRight size={16} color={config.color} />
            </View>
          )}
        </TouchableOpacity>

        {/* Footer - See all */}
        {unreadCount > 1 && (
          <TouchableOpacity style={styles.footer} onPress={handleSeeAll}>
            <Text style={[styles.seeAllText, { color: colors.accent.primary }]}>
              Voir tous les messages
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coachAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  coachName: {
    fontSize: 14,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
  },
  unreadBadge: {
    ...typography.caption,
    fontWeight: '500',
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  message: {
    ...typography.body,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  actionText: {
    ...typography.smallMedium,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    padding: spacing.sm,
    alignItems: 'center',
  },
  seeAllText: {
    ...typography.small,
    fontWeight: '500',
  },
  // Empty state
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  emptyContent: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
  },
  emptyText: {
    ...typography.small,
  },
  // Compact mode
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
