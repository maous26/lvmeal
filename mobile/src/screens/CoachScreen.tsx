/**
 * CoachScreen - Cockpit de contrôle Coach
 *
 * UX Cockpit - Structure en 3 couches:
 * - Couche 1: Carte primaire (FeaturedInsight) - LA meilleure prochaine action
 * - Couche 2: Pile compressée (MessageStack) - "En attente (N)"
 * - Couche 3: Historique (bouton vers CoachHistoryScreen)
 *
 * Philosophie:
 * - "Que dois-je faire maintenant ?" → Carte primaire
 * - "Pourquoi ?" → becauseLine visible
 * - "Qu'est-ce qui attend derrière ?" → Pile compressée
 *
 * Le Coach est une BOUSSOLE, pas un perroquet.
 */

import React, { useEffect, useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native'
import {
  Sparkles,
  Bot,
  History,
  TrendingUp,
  Heart,
  X,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'

import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, shadows, fonts } from '../constants/theme'
import { useUserStore, useUserStoreHydration } from '../stores/user-store'
import { useAuthStore } from '../stores/auth-store'
import { useMealsStore, useMealsStoreHydration } from '../stores/meals-store'
import { useGamificationStore, useGamificationStoreHydration } from '../stores/gamification-store'
import { useCaloricBankStoreHydration } from '../stores/caloric-bank-store'
import {
  useMessageCenter,
  generateAIMessages,
  type LymiaMessage,
  type AIMessageContext,
} from '../services/message-center'
import { useCoachState, type CoachTopic } from '../services/coach-state'
import { FeaturedInsight, MessageStack, CoachMessageCard } from '../components/coach'

// Map message category to CoachTopic
const categoryToTopic: Record<string, CoachTopic> = {
  nutrition: 'nutrition',
  hydration: 'hydration',
  sleep: 'sleep',
  sport: 'activity',
  stress: 'wellness',
  progress: 'progress',
  wellness: 'wellness',
  system: 'motivation',
}

// ============= WELCOME CARD COMPONENT =============

interface WelcomeCardProps {
  firstName: string
  onDismiss: () => void
  colors: ReturnType<typeof useTheme>['colors']
}

function WelcomeCard({ firstName, onDismiss, colors }: WelcomeCardProps) {
  return (
    <View style={[welcomeStyles.card, { backgroundColor: colors.bg.elevated }]}>
      {/* Header with dismiss */}
      <View style={welcomeStyles.header}>
        <View style={[welcomeStyles.avatar, { backgroundColor: colors.accent.primary }]}>
          <Sparkles size={24} color="#FFFFFF" />
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={20} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Welcome message */}
      <Text style={[welcomeStyles.greeting, { color: colors.accent.primary }]}>
        Bonjour {firstName}
      </Text>
      <Text style={[welcomeStyles.title, { color: colors.text.primary }]}>
        Bienvenue sur LYM
      </Text>

      <View style={[welcomeStyles.messageBox, { backgroundColor: colors.bg.secondary }]}>
        <Text style={[welcomeStyles.message, { color: colors.text.primary }]}>
          LYM, c'est{' '}
          <Text style={{ fontWeight: '600', fontStyle: 'italic' }}>Love Your Meal</Text>
          {' '}— parce que bien manger, c'est le premier pas vers le bien-être.
        </Text>
        <Text style={[welcomeStyles.message, { color: colors.text.secondary, marginTop: spacing.sm }]}>
          Ici, pas de simple tracker. Un vrai{' '}
          <Text style={{ fontWeight: '600', color: colors.text.primary }}>
            accompagnement personnalisé
          </Text>
          {' '}pour t'aider à atteindre tes objectifs, sans frustration.
        </Text>
      </View>

      {/* Features summary */}
      <View style={welcomeStyles.features}>
        <View style={welcomeStyles.featureItem}>
          <View style={[welcomeStyles.featureIcon, { backgroundColor: `${colors.accent.primary}20` }]}>
            <TrendingUp size={16} color={colors.accent.primary} />
          </View>
          <Text style={[welcomeStyles.featureText, { color: colors.text.secondary }]}>
            Conseils adaptés à ton profil
          </Text>
        </View>
        <View style={welcomeStyles.featureItem}>
          <View style={[welcomeStyles.featureIcon, { backgroundColor: `${colors.accent.secondary}20` }]}>
            <Heart size={16} color={colors.accent.secondary} />
          </View>
          <Text style={[welcomeStyles.featureText, { color: colors.text.secondary }]}>
            Bienveillance, zéro culpabilité
          </Text>
        </View>
      </View>
    </View>
  )
}

const welcomeStyles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    ...typography.bodyMedium,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  messageBox: {
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    lineHeight: 22,
  },
  features: {
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    ...typography.small,
  },
})

// ============= MESSAGE DETAIL MODAL =============

interface MessageDetailModalProps {
  message: LymiaMessage | null
  visible: boolean
  onClose: () => void
  onRead: () => void
  onDismiss: () => void
  onAction: (route: string) => void
}

function MessageDetailModal({
  message,
  visible,
  onClose,
  onRead,
  onDismiss,
  onAction,
}: MessageDetailModalProps) {
  const { colors } = useTheme()

  if (!message) return null

  const handleDismiss = () => {
    onDismiss()
    onClose()
  }

  const handleAction = (route: string) => {
    onAction(route)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, { backgroundColor: colors.bg.primary }]}>
          <TouchableOpacity
            style={[modalStyles.closeButton, { backgroundColor: colors.bg.tertiary }]}
            onPress={onClose}
          >
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>

          <CoachMessageCard
            message={message}
            onRead={onRead}
            onDismiss={handleDismiss}
            onAction={handleAction}
          />
        </View>
      </View>
    </Modal>
  )
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    maxHeight: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
})

// ============= MAIN COMPONENT =============

export default function CoachScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const [refreshing, setRefreshing] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<LymiaMessage | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

  // Wait for ALL stores to be hydrated
  const isUserStoreHydrated = useUserStoreHydration()
  const isMealsStoreHydrated = useMealsStoreHydration()
  const isGamificationStoreHydrated = useGamificationStoreHydration()
  const isCaloricBankStoreHydrated = useCaloricBankStoreHydration()

  const isStoreHydrated = isUserStoreHydrated && isMealsStoreHydrated && isGamificationStoreHydrated && isCaloricBankStoreHydrated

  // MessageCenter
  const messages = useMessageCenter((s) => s.messages)
  const markAsRead = useMessageCenter((s) => s.markAsRead)
  const dismiss = useMessageCenter((s) => s.dismiss)

  // User data
  const profile = useUserStore((s) => s.profile)
  const nutritionGoals = useUserStore((s) => s.nutritionGoals)
  const hasSeenCoachWelcome = useUserStore((s) => s.hasSeenCoachWelcome)
  const setHasSeenCoachWelcome = useUserStore((s) => s.setHasSeenCoachWelcome)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const userId = useAuthStore((s) => s.userId)

  // Track if messages have been generated
  const hasGeneratedMessages = React.useRef(false)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

  // CoachState for engagement tracking
  const recordAppOpen = useCoachState((s) => s.recordAppOpen)
  const recordDismiss = useCoachState((s) => s.recordDismiss)

  // Record app open when screen mounts
  useEffect(() => {
    recordAppOpen()
  }, [recordAppOpen])

  // Generate messages
  const generateMessages = async () => {
    const mealsStore = useMealsStore.getState()
    const gamificationStore = useGamificationStore.getState()
    const messageCenter = useMessageCenter.getState()
    const userStore = useUserStore.getState()

    const todayData = mealsStore.getTodayData()
    const waterPercent = Math.round((todayData.hydration / 2000) * 100)

    const lastMeal = todayData.meals.length > 0
      ? todayData.meals.reduce((latest, meal) => {
          const mealTime = new Date(`${meal.date}T${meal.time}`)
          return mealTime > latest ? mealTime : latest
        }, new Date(0))
      : null

    const aiContext: AIMessageContext = {
      profile: {
        firstName: userStore.profile?.firstName,
        goal: userStore.profile?.goal,
      },
      nutrition: {
        caloriesConsumed: todayData.totalNutrition.calories,
        caloriesTarget: nutritionGoals?.calories || 2000,
        proteinsConsumed: todayData.totalNutrition.proteins,
        proteinsTarget: nutritionGoals?.proteins || 100,
        carbsConsumed: todayData.totalNutrition.carbs,
        fatsConsumed: todayData.totalNutrition.fats,
      },
      wellness: {
        sleepHours: null,
        stressLevel: null,
        energyLevel: null,
        hydrationPercent: waterPercent,
      },
      streak: gamificationStore.currentStreak,
      lastMealTime: lastMeal && lastMeal.getTime() > 0 ? lastMeal : null,
      todayMealsCount: todayData.meals.length,
    }

    setIsGeneratingAI(true)
    try {
      const newMessages = await generateAIMessages(aiContext)
      console.log('[CoachScreen] Generated', newMessages.length, 'messages')
      newMessages.forEach(msg => messageCenter.addMessage(msg))
    } catch (error) {
      console.error('[CoachScreen] Message generation failed:', error)
    } finally {
      setIsGeneratingAI(false)
    }
  }

  // Generate messages once when stores are hydrated
  useEffect(() => {
    if (isStoreHydrated && !hasGeneratedMessages.current) {
      hasGeneratedMessages.current = true
      useMessageCenter.getState().clearExpired()
      generateMessages()
    }
  }, [isStoreHydrated])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    useMessageCenter.getState().clearExpired()
    await generateMessages()
    setRefreshing(false)
  }, [])

  const handleAction = (route: string, message?: LymiaMessage) => {
    const mealType = message?.dedupKey?.match(/meal-reminder-(breakfast|lunch|snack|dinner)/)?.[1]

    // Handle tab navigation vs stack navigation
    const tabRoutes = ['Home', 'Coach', 'Recipes', 'Programs', 'Profile']

    if (tabRoutes.includes(route)) {
      // Navigate to a tab - use getParent to access the tab navigator
      // @ts-ignore
      navigation.getParent()?.navigate(route)
    } else {
      // Navigate to a stack screen
      // @ts-ignore
      navigation.navigate(route, mealType ? { mealType } : undefined)
    }
  }

  // Handle dismiss with CoachState tracking
  const handleDismissMessage = (message: LymiaMessage) => {
    dismiss(message.id)
    const topic = categoryToTopic[message.category] || 'motivation'
    recordDismiss(topic)
  }

  const handleDismissWelcome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setHasSeenCoachWelcome(true)
  }

  // Handle message selection from stack
  const handleSelectMessage = (message: LymiaMessage) => {
    setSelectedMessage(message)
    setModalVisible(true)
    if (!message.read) {
      markAsRead(message.id)
    }
  }

  // Navigate to history
  const handleOpenHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore
    navigation.navigate('CoachHistory')
  }

  // Auto-mark welcome as seen for returning users
  useEffect(() => {
    if (isStoreHydrated && syncStatus !== 'syncing' && userId && !hasSeenCoachWelcome && profile?.firstName) {
      console.log('[CoachScreen] Returning user detected, auto-marking welcome as seen')
      setHasSeenCoachWelcome(true)
    }
  }, [isStoreHydrated, syncStatus, userId, hasSeenCoachWelcome, profile?.firstName, setHasSeenCoachWelcome])

  // Compute active messages (not dismissed, not expired)
  const activeMessages = React.useMemo(() => {
    if (!isStoreHydrated) return []
    const now = new Date().toISOString()
    return messages.filter((m) => {
      if (m.dismissed) return false
      if (m.expiresAt && m.expiresAt < now) return false
      return true
    })
  }, [isStoreHydrated, messages])

  const unreadCount = React.useMemo(() => {
    return activeMessages.filter(m => !m.read).length
  }, [activeMessages])

  // Separate primary message from the stack
  const primaryMessage = activeMessages[0] || null
  const stackMessages = activeMessages.slice(1)

  // Show loading state
  if (!isStoreHydrated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
            Chargement...
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: colors.text.primary }]}>Mon Coach</Text>
              <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                {isGeneratingAI
                  ? 'Analyse en cours...'
                  : unreadCount > 0
                    ? `${unreadCount} nouveau${unreadCount > 1 ? 'x' : ''}`
                    : 'Ta prochaine action'}
              </Text>
            </View>
            <View style={styles.headerButtons}>
              {/* History button */}
              <TouchableOpacity
                style={[styles.historyButton, { backgroundColor: colors.bg.tertiary }]}
                onPress={handleOpenHistory}
              >
                <History size={20} color={colors.text.secondary} />
              </TouchableOpacity>
              {/* Bot avatar */}
              <View style={[styles.avatarGradient, { backgroundColor: colors.accent.primary }]}>
                {isGeneratingAI ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Bot size={24} color="#FFFFFF" />
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Welcome Card */}
        {isStoreHydrated && !hasSeenCoachWelcome && profile?.firstName && syncStatus !== 'syncing' && (
          <WelcomeCard
            firstName={profile.firstName}
            onDismiss={handleDismissWelcome}
            colors={colors}
          />
        )}

        {/* Content - Cockpit Layout */}
        {!primaryMessage ? (
          /* Empty state */
          <View style={styles.emptyState}>
            <Sparkles size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Tout va bien !</Text>
            <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
              Continue à tracker tes repas pour recevoir des conseils personnalisés.
            </Text>
          </View>
        ) : (
          <>
            {/* Couche 1: Carte primaire - LA meilleure prochaine action */}
            <FeaturedInsight
              message={primaryMessage}
              onRead={() => markAsRead(primaryMessage.id)}
              onDismiss={() => handleDismissMessage(primaryMessage)}
              onAction={(route) => handleAction(route, primaryMessage)}
            />

            {/* Couche 2: Pile compressée - "En attente" */}
            {stackMessages.length > 0 && (
              <MessageStack
                messages={stackMessages}
                onSelectMessage={handleSelectMessage}
              />
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Modal for stack message detail */}
      <MessageDetailModal
        message={selectedMessage}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onRead={() => selectedMessage && markAsRead(selectedMessage.id)}
        onDismiss={() => selectedMessage && handleDismissMessage(selectedMessage)}
        onAction={handleAction}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.default,
  },
  header: {
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: fonts.serif.bold,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: fonts.serif.semibold,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  bottomSpacer: {
    height: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
  },
})
