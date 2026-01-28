import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { X, Sparkles, Heart, TrendingUp, Moon, Droplets, Activity, ChevronRight, Utensils, Target, Flame, Award, Scale } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Card } from '../ui/Card'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useUserStore } from '../../stores/user-store'
import { useWellnessStore } from '../../stores/wellness-store'
import { useMealsStore } from '../../stores/meals-store'
import { useGamificationStore } from '../../stores/gamification-store'
import { useSportProgramStore } from '../../stores/sport-program-store'
import { useCaloricBankStore } from '../../stores/caloric-bank-store'
import { lymInsights } from '../../services/lym-insights-service'
import {
  getTopMessages,
  filterDismissedMessages,
  getMessageStyle,
  type CoachContext,
  type CoachMessage,
  type CoachMessageIcon,
} from '../../services/coach-messages-service'


// Icon mapping from string to component
const ICON_MAP: Record<CoachMessageIcon, React.ReactNode> = {
  sparkles: <Sparkles size={20} color="#D4A574" />,
  heart: <Heart size={20} color="#F43F5E" />,
  moon: <Moon size={20} color="#6366F1" />,
  droplets: <Droplets size={20} color="#06B6D4" />,
  activity: <Activity size={20} color="#8B5CF6" />,
  'trending-up': <TrendingUp size={20} color="#10B981" />,
  utensils: <Utensils size={20} color="#3B82F6" />,
  target: <Target size={20} color="#F59E0B" />,
  flame: <Flame size={20} color="#EF4444" />,
  award: <Award size={20} color="#8B5CF6" />,
  scale: <Scale size={20} color="#6366F1" />,
}

// Special icon colors for certain message types
const getIconForMessage = (icon: CoachMessageIcon, type: CoachMessage['type']): React.ReactNode => {
  if (type === 'plaisir') {
    return <Sparkles size={20} color="#D946EF" />
  }
  return ICON_MAP[icon] || <Sparkles size={20} color="#D4A574" />
}

export function LymIA() {
  const navigation = useNavigation()
  const { profile } = useUserStore()
  const { getEntryForDate, targets } = useWellnessStore()
  const { getDailyNutrition, getMealsForDate } = useMealsStore()
  const { getStreakInfo } = useGamificationStore()
  const { totalSessionsCompleted } = useSportProgramStore()
  const { getTotalBalance, canHavePlaisir, getMaxPlaisirPerMeal, requiresSplitConsumption, getRemainingPlaisirMeals } = useCaloricBankStore()

  const [dismissedMessages, setDismissedMessages] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    loadDismissedMessages()
  }, [])

  const loadDismissedMessages = async () => {
    try {
      const saved = await AsyncStorage.getItem('coach-dismissed')
      if (saved) {
        const parsed = JSON.parse(saved)
        const today = new Date().toISOString().split('T')[0]
        if (parsed.date !== today) {
          await AsyncStorage.setItem('coach-dismissed', JSON.stringify({ date: today, ids: [] }))
        } else {
          setDismissedMessages(parsed.ids || [])
        }
      }
    } catch (error) {
      console.error('Error loading dismissed messages:', error)
    }
  }

  const dismissMessage = async (id: string) => {
    const newDismissed = [...dismissedMessages, id]
    setDismissedMessages(newDismissed)
    const today = new Date().toISOString().split('T')[0]
    await AsyncStorage.setItem('coach-dismissed', JSON.stringify({ date: today, ids: newDismissed }))
  }

  // Build context for coach messages service
  const coachContext = useMemo((): CoachContext | null => {
    if (!profile) return null

    const today = new Date().toISOString().split('T')[0]
    const todayEntry = getEntryForDate(today)
    const todayNutrition = getDailyNutrition(today)
    const todayMeals = getMealsForDate(today)
    const streakInfo = getStreakInfo()

    return {
      profile,
      isAdaptive: profile.metabolismProfile === 'adaptive',
      todayNutrition: {
        calories: todayNutrition.calories,
        proteins: todayNutrition.proteins,
        carbs: todayNutrition.carbs,
        fats: todayNutrition.fats,
      },
      todayMealsCount: todayMeals.length,
      wellness: todayEntry ? {
        sleepHours: todayEntry.sleepHours,
        stressLevel: todayEntry.stressLevel,
        energyLevel: todayEntry.energyLevel,
        waterLiters: todayEntry.waterLiters,
      } : undefined,
      targets: {
        calories: profile.nutritionalNeeds?.calories || 2100,
        proteins: profile.nutritionalNeeds?.proteins || 120,
        waterLiters: targets.waterLiters,
      },
      streak: streakInfo.current,
      sportSessionsCompleted: totalSessionsCompleted,
      caloricBank: {
        balance: getTotalBalance(),
        canHavePlaisir: canHavePlaisir(),
        maxPerMeal: getMaxPlaisirPerMeal(),
        needsSplit: requiresSplitConsumption(),
        remainingPlaisirMeals: getRemainingPlaisirMeals(),
      },
      currentHour: new Date().getHours(),
    }
  }, [profile, getEntryForDate, getDailyNutrition, getMealsForDate, getStreakInfo, targets, totalSessionsCompleted, getTotalBalance, canHavePlaisir, getMaxPlaisirPerMeal, requiresSplitConsumption, getRemainingPlaisirMeals])

  // Generate messages using the service
  const visibleMessages = useMemo(() => {
    if (!coachContext) return []

    const allMessages = getTopMessages(coachContext, 4) // Get more, then filter
    const filtered = filterDismissedMessages(allMessages, dismissedMessages)
    return filtered.slice(0, 2) // Show max 2
  }, [coachContext, dismissedMessages])

  // Track reassurance messages shown
  const trackedMessagesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const reassuranceMessages = visibleMessages.filter(m =>
      m.type === 'adaptive' || m.type === 'encouragement' ||
      m.id.includes('adaptive-') || m.id === 'plaisir-used'
    )

    reassuranceMessages.forEach(msg => {
      if (!trackedMessagesRef.current.has(msg.id)) {
        trackedMessagesRef.current.add(msg.id)
        lymInsights.trackReassuranceShown('gentle_reminder', msg.id)
      }
    })
  }, [visibleMessages])

  // Handle CTA press
  const handleActionPress = (action: CoachMessage['action']) => {
    if (!action) return
    navigation.navigate(action.route as never)
  }

  if (!mounted || !profile || visibleMessages.length === 0) {
    return null
  }

  const isAdaptive = profile.metabolismProfile === 'adaptive'

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Sparkles size={16} color="#8B5CF6" />
        </View>
        <Text style={styles.headerTitle}>LymIA</Text>
        {isAdaptive && (
          <View style={styles.adaptiveBadge}>
            <Text style={styles.adaptiveBadgeText}>Bienveillant</Text>
          </View>
        )}
      </View>

      {/* Messages */}
      <View style={styles.messages}>
        {visibleMessages.map((msg) => {
          const style = getMessageStyle(msg.type)
          return (
            <Card
              key={msg.id}
              style={[styles.messageCard, style]}
            >
              <Pressable
                style={styles.dismissButton}
                onPress={() => dismissMessage(msg.id)}
              >
                <X size={16} color={colors.text.tertiary} />
              </Pressable>

              <View style={styles.messageContent}>
                <View style={styles.messageIcon}>
                  {getIconForMessage(msg.icon, msg.type)}
                </View>
                <View style={styles.messageText}>
                  <Text style={styles.messageTitle}>{msg.title}</Text>
                  <Text style={styles.messageBody}>{msg.message}</Text>
                  {msg.action && (
                    <Pressable
                      onPress={() => handleActionPress(msg.action)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionButtonText}>{msg.action.label}</Text>
                      <ChevronRight size={12} color={colors.accent.primary} />
                    </Pressable>
                  )}
                </View>
              </View>
            </Card>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIcon: {
    padding: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  headerTitle: {
    ...typography.smallMedium,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  adaptiveBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  adaptiveBadgeText: {
    fontSize: 10,
    color: '#059669',
  },
  messages: {
    gap: spacing.sm,
  },
  messageCard: {
    padding: spacing.default,
    borderWidth: 1,
  },
  dismissButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.full,
  },
  messageContent: {
    flexDirection: 'row',
    paddingRight: spacing.lg,
    gap: spacing.md,
  },
  messageIcon: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg.secondary,
  },
  messageText: {
    flex: 1,
  },
  messageTitle: {
    ...typography.smallMedium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  messageBody: {
    ...typography.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  actionButtonText: {
    ...typography.caption,
    color: colors.accent.primary,
  },
})

export default LymIA
