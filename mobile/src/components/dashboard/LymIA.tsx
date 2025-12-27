import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { X, Sparkles, Heart, TrendingUp, Moon, Droplets, Activity, ChevronRight, Scale, Utensils, Target, Flame, Award } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { colors, radius, spacing, typography } from '../../constants/theme'
import { useUserStore } from '../../stores/user-store'
import { useWellnessStore } from '../../stores/wellness-store'
import { useMealsStore } from '../../stores/meals-store'
import { useGamificationStore } from '../../stores/gamification-store'
import { useSportProgramStore } from '../../stores/sport-program-store'
import { useCaloricBankStore } from '../../stores/caloric-bank-store'

interface LymIAProps {
  className?: string
}

interface CoachMessage {
  id: string
  type: 'encouragement' | 'tip' | 'warning' | 'celebration' | 'adaptive' | 'nutrition' | 'sport'
  icon: React.ReactNode
  title: string
  message: string
  action?: {
    label: string
    onPress: () => void
  }
  priority: number
}

const ADAPTIVE_MESSAGES = {
  welcome: {
    title: 'Bienvenue dans ton espace bienveillant',
    message: "On va prendre soin de toi en douceur. Ton corps est intelligent, on va l'accompagner pas a pas.",
  },
  patience: {
    title: 'La patience est ta meilleure alliee',
    message: 'Les changements durables prennent du temps. Chaque petit pas compte, meme les plus petits.',
  },
  maintenance: {
    title: 'Phase de stabilisation',
    message: "On consolide tes acquis avant d'aller plus loin. C'est la cle pour des resultats durables.",
  },
  protein: {
    title: 'Priorite aux proteines',
    message: 'Les proteines t\'aident a maintenir ta masse musculaire et a relancer ton metabolisme.',
  },
  sleep: {
    title: 'Le sommeil, ton allie secret',
    message: 'Un bon sommeil aide a reguler tes hormones de faim. Prends soin de tes nuits !',
  },
  stress: {
    title: 'Gere ton stress',
    message: 'Le stress impacte ton metabolisme. Accorde-toi des moments de detente.',
  },
  movement: {
    title: 'Bouge au quotidien',
    message: 'Les mouvements quotidiens sont aussi importants que les seances sport. Chaque pas compte !',
  },
  celebration: {
    title: 'Tu es sur la bonne voie !',
    message: 'Chaque jour ou tu prends soin de toi est une victoire. Continue comme ca !',
  },
}

export function LymIA({ className }: LymIAProps) {
  const { profile, weightHistory } = useUserStore()
  const { todayScore, getEntryForDate, targets, streaks: wellnessStreaks } = useWellnessStore()
  const { getDailyNutrition, getMealsForDate, getHydration } = useMealsStore()
  const { getStreakInfo } = useGamificationStore()
  const { currentProgram, currentStreak: sportStreak, getPhaseProgress, totalSessionsCompleted } = useSportProgramStore()
  const { getTotalBalance, getCurrentDayIndex, canHavePlaisir } = useCaloricBankStore()

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

  if (!mounted || !profile) {
    return null
  }

  const isAdaptive = profile.metabolismProfile === 'adaptive'
  const today = new Date().toISOString().split('T')[0]
  const todayEntry = getEntryForDate(today)
  const todayNutrition = getDailyNutrition(today)
  const todayMeals = getMealsForDate(today)
  const streakInfo = getStreakInfo()
  const currentHour = new Date().getHours()

  const caloricBalance = getTotalBalance()
  const currentDayIndex = getCurrentDayIndex()
  const canHavePlaisirToday = canHavePlaisir()

  const sportPhase = getPhaseProgress()
  const isSportEnabled = profile?.sportTrackingEnabled || isAdaptive

  const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1] : null
  const previousWeight = weightHistory.length > 1 ? weightHistory[weightHistory.length - 2] : null
  const weightTrend = latestWeight && previousWeight ? latestWeight.weight - previousWeight.weight : 0

  const caloriesTarget = profile.nutritionalNeeds?.calories || 2100
  const proteinTarget = profile.nutritionalNeeds?.proteins || 120

  const generateMessages = (): CoachMessage[] => {
    const messages: CoachMessage[] = []

    // ADAPTIVE METABOLISM SPECIFIC MESSAGES
    if (isAdaptive) {
      if (profile.nutritionalStrategy?.currentPhase === 'maintenance') {
        messages.push({
          id: 'adaptive-maintenance',
          type: 'adaptive',
          icon: <TrendingUp size={20} color="#10B981" />,
          title: ADAPTIVE_MESSAGES.maintenance.title,
          message: `Semaine ${profile.nutritionalStrategy.weekInPhase} de stabilisation. ${ADAPTIVE_MESSAGES.maintenance.message}`,
          priority: 80,
        })
      }

      const proteinPercent = (todayNutrition.proteins / proteinTarget) * 100
      if (proteinPercent < 50 && currentHour >= 14) {
        messages.push({
          id: 'adaptive-protein',
          type: 'tip',
          icon: <Sparkles size={20} color="#F59E0B" />,
          title: ADAPTIVE_MESSAGES.protein.title,
          message: `Tu es a ${Math.round(proteinPercent)}% de ton objectif proteines. Pense a en ajouter a ton prochain repas.`,
          priority: 70,
        })
      }
    }

    // Sleep check
    if (todayEntry?.sleepHours) {
      if (todayEntry.sleepHours < 6) {
        messages.push({
          id: 'sleep-warning',
          type: 'warning',
          icon: <Moon size={20} color="#6366F1" />,
          title: 'Sommeil insuffisant',
          message: isAdaptive
            ? `${todayEntry.sleepHours}h de sommeil seulement. Pour ton metabolisme, vise 7-8h.`
            : `Tu n'as dormi que ${todayEntry.sleepHours}h. Le manque de sommeil peut affecter tes objectifs.`,
          priority: 75,
        })
      } else if (todayEntry.sleepHours >= 7) {
        messages.push({
          id: 'sleep-good',
          type: 'celebration',
          icon: <Moon size={20} color="#6366F1" />,
          title: 'Belle nuit de sommeil !',
          message: `${todayEntry.sleepHours}h de repos. Ton corps te remercie !`,
          priority: 30,
        })
      }
    }

    // Stress check
    if (todayEntry?.stressLevel && todayEntry.stressLevel >= 4) {
      messages.push({
        id: 'stress-high',
        type: 'tip',
        icon: <Heart size={20} color="#F43F5E" />,
        title: isAdaptive ? ADAPTIVE_MESSAGES.stress.title : 'Niveau de stress eleve',
        message: isAdaptive
          ? ADAPTIVE_MESSAGES.stress.message
          : 'Le stress peut impacter ta faim et ta digestion. Prends un moment pour toi.',
        priority: 65,
      })
    }

    // Hydration reminder
    const waterPercent = todayEntry?.waterLiters
      ? (todayEntry.waterLiters / targets.waterLiters) * 100
      : 0
    if (waterPercent < 40 && currentHour >= 12) {
      messages.push({
        id: 'hydration-reminder',
        type: 'tip',
        icon: <Droplets size={20} color="#06B6D4" />,
        title: "Pense a t'hydrater",
        message: `Tu es a ${Math.round(waterPercent)}% de ton objectif d'eau. L'hydratation aide ton metabolisme !`,
        priority: 50,
      })
    }

    // Streak celebration
    if (streakInfo.current >= 7 && streakInfo.current % 7 === 0) {
      messages.push({
        id: `streak-${streakInfo.current}`,
        type: 'celebration',
        icon: <Sparkles size={20} color="#F59E0B" />,
        title: `${streakInfo.current} jours de suite !`,
        message: isAdaptive
          ? ADAPTIVE_MESSAGES.celebration.message
          : 'Ta regularite paie ! Continue sur cette lancee.',
        priority: 85,
      })
    }

    // Nutrition messages
    const caloriePercent = (todayNutrition.calories / caloriesTarget) * 100
    if (todayMeals.length === 0 && currentHour >= 10) {
      messages.push({
        id: 'no-meals-logged',
        type: 'tip',
        icon: <Utensils size={20} color="#3B82F6" />,
        title: "N'oublie pas ton suivi",
        message: "Tu n'as pas encore enregistre de repas aujourd'hui. Le suivi t'aide a atteindre tes objectifs !",
        priority: 45,
      })
    }

    // Plaisir message when available
    if (canHavePlaisirToday && caloricBalance > 200) {
      messages.push({
        id: 'plaisir-available',
        type: 'celebration',
        icon: <Sparkles size={20} color="#D946EF" />,
        title: 'Solde Plaisir disponible !',
        message: `Tu as ${caloricBalance} kcal en banque. Accorde-toi un petit extra si tu le souhaites !`,
        priority: 75,
      })
    }

    // Sport messages
    if (isSportEnabled && totalSessionsCompleted > 0 && totalSessionsCompleted % 5 === 0) {
      messages.push({
        id: `sessions-${totalSessionsCompleted}`,
        type: 'celebration',
        icon: <Activity size={20} color="#8B5CF6" />,
        title: `${totalSessionsCompleted} seances completees !`,
        message: 'Ta regularite paie ! Continue a progresser avec LymIA Sport.',
        priority: 55,
      })
    }

    return messages
  }

  const allMessages = generateMessages()
  const visibleMessages = allMessages
    .filter(m => !dismissedMessages.includes(m.id))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)

  if (visibleMessages.length === 0) {
    return null
  }

  const getMessageStyle = (type: CoachMessage['type']) => {
    switch (type) {
      case 'adaptive':
        return { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }
      case 'celebration':
        return { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.3)' }
      case 'warning':
        return { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }
      case 'tip':
        return { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }
      default:
        return { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' }
    }
  }

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
        {visibleMessages.map((msg) => (
          <Card
            key={msg.id}
            style={[styles.messageCard, getMessageStyle(msg.type)]}
          >
            <Pressable
              style={styles.dismissButton}
              onPress={() => dismissMessage(msg.id)}
            >
              <X size={16} color={colors.text.tertiary} />
            </Pressable>

            <View style={styles.messageContent}>
              <View style={styles.messageIcon}>
                {msg.icon}
              </View>
              <View style={styles.messageText}>
                <Text style={styles.messageTitle}>{msg.title}</Text>
                <Text style={styles.messageBody}>{msg.message}</Text>
                {msg.action && (
                  <Pressable onPress={msg.action.onPress} style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>{msg.action.label}</Text>
                    <ChevronRight size={12} color={colors.accent.primary} />
                  </Pressable>
                )}
              </View>
            </View>
          </Card>
        ))}
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
