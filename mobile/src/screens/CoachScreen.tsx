/**
 * CoachScreen - Flux intelligent de conseils LymIA
 *
 * Migré vers MessageCenter unifié.
 * Affiche tous les messages du système avec priorité visuelle.
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
  Modal,
  ActivityIndicator,
} from 'react-native'
import {
  Sparkles,
  AlertTriangle,
  Trophy,
  X,
  Lightbulb,
  Bell,
  Bot,
  TrendingUp,
  Heart,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'

import { useTheme } from '../contexts/ThemeContext'
import { colors as staticColors, spacing, typography, radius, shadows, fonts } from '../constants/theme'
import { useUserStore, useUserStoreHydration } from '../stores/user-store'
import { useAuthStore } from '../stores/auth-store'
import { useMealsStore, useMealsStoreHydration } from '../stores/meals-store'
import { useGamificationStore, useGamificationStoreHydration } from '../stores/gamification-store'
import { useCaloricBankStore, useCaloricBankStoreHydration } from '../stores/caloric-bank-store'
import {
  useMessageCenter,
  generateDailyMessages,
  getPriorityConfig,
  type LymiaMessage,
} from '../services/message-center'
import { CoachMessageCard } from '../components/coach'
import { AnimatedBackground } from '../components/ui'

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
        <View style={[welcomeStyles.avatar, { backgroundColor: staticColors.accent.primary }]}>
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
          <View style={[welcomeStyles.featureIcon, { backgroundColor: `${staticColors.success}20` }]}>
            <TrendingUp size={16} color={staticColors.success} />
          </View>
          <Text style={[welcomeStyles.featureText, { color: colors.text.secondary }]}>
            Conseils adaptés à ton profil
          </Text>
        </View>
        <View style={welcomeStyles.featureItem}>
          <View style={[welcomeStyles.featureIcon, { backgroundColor: `${staticColors.secondary.primary}20` }]}>
            <Heart size={16} color={staticColors.secondary.primary} />
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

// ============= MAIN COMPONENT =============

export default function CoachScreen() {
  const { colors, isDark } = useTheme()
  const navigation = useNavigation()
  const [refreshing, setRefreshing] = useState(false)
  const priorityConfig = getPriorityConfig(isDark)

  // Wait for ALL stores to be hydrated before rendering/generating messages
  // This prevents crashes when accessing store data before AsyncStorage rehydration
  const isUserStoreHydrated = useUserStoreHydration()
  const isMealsStoreHydrated = useMealsStoreHydration()
  const isGamificationStoreHydrated = useGamificationStoreHydration()
  const isCaloricBankStoreHydrated = useCaloricBankStoreHydration()

  const isStoreHydrated = isUserStoreHydrated && isMealsStoreHydrated && isGamificationStoreHydrated && isCaloricBankStoreHydrated

  // MessageCenter
  const messages = useMessageCenter((s) => s.messages)
  const preferences = useMessageCenter((s) => s.preferences)
  const addMessage = useMessageCenter((s) => s.addMessage)
  const markAsRead = useMessageCenter((s) => s.markAsRead)
  const dismiss = useMessageCenter((s) => s.dismiss)
  const clearExpired = useMessageCenter((s) => s.clearExpired)
  const getActiveMessages = useMessageCenter((s) => s.getActiveMessages)
  const getUnreadCount = useMessageCenter((s) => s.getUnreadCount)

  // User data
  const { profile, nutritionGoals, hasSeenCoachWelcome, setHasSeenCoachWelcome } = useUserStore()
  const { syncStatus, userId } = useAuthStore((s) => ({ syncStatus: s.syncStatus, userId: s.userId }))
  const { getTodayData } = useMealsStore()
  const { currentStreak } = useGamificationStore()
  const { getPlaisirSuggestion } = useCaloricBankStore()

  // Generate messages on mount/refresh
  const generateMessages = useCallback(() => {
    // Guard: ne pas générer de messages si les stores ne sont pas hydratés
    if (!isStoreHydrated) {
      console.log('[CoachScreen] Stores not hydrated yet, skipping message generation')
      return
    }

    const todayData = getTodayData()

    // Récupérer plaisirInfo avec valeurs par défaut sécurisées
    // (évite crash si le store n'est pas encore prêt)
    let plaisirInfo = { available: false, maxPerMeal: 0, remainingPlaisirMeals: 0, budget: 0, suggestion: '', requiresSplit: false }
    try {
      plaisirInfo = getPlaisirSuggestion() || plaisirInfo
    } catch (e) {
      console.warn('[CoachScreen] Error getting plaisir suggestion:', e)
    }

    // Calculer les pourcentages
    const proteinsPercent = nutritionGoals?.proteins
      ? Math.round((todayData.totalNutrition.proteins / nutritionGoals.proteins) * 100)
      : 0
    const waterPercent = Math.round((todayData.hydration / 2000) * 100)

    // Trouver le dernier repas
    const lastMeal = todayData.meals.length > 0
      ? todayData.meals.reduce((latest, meal) => {
          const mealTime = new Date(`${meal.date}T${meal.time}`)
          return mealTime > latest ? mealTime : latest
        }, new Date(0))
      : null

    const newMessages = generateDailyMessages({
      caloriesConsumed: todayData.totalNutrition.calories,
      caloriesTarget: nutritionGoals?.calories || 2000,
      // Macros détaillés pour les messages contextuels
      proteinsConsumed: todayData.totalNutrition.proteins,
      proteinsTarget: nutritionGoals?.proteins,
      proteinsPercent,
      carbsConsumed: todayData.totalNutrition.carbs,
      carbsTarget: nutritionGoals?.carbs,
      fatsConsumed: todayData.totalNutrition.fats,
      fatsTarget: nutritionGoals?.fats,
      waterPercent,
      sleepHours: null, // TODO: intégrer wellness store
      streak: currentStreak,
      lastMealTime: lastMeal && lastMeal.getTime() > 0 ? lastMeal : null,
      // Repas plaisir: max 600 kcal/repas, max 2/semaine, à partir du jour 3
      plaisirAvailable: plaisirInfo.available,
      maxPlaisirPerMeal: plaisirInfo.maxPerMeal,
      remainingPlaisirMeals: plaisirInfo.remainingPlaisirMeals,
    }, preferences)

    // Ajouter les messages (le cooldown empêche les doublons)
    newMessages.forEach(msg => addMessage(msg))
  }, [isStoreHydrated, getTodayData, nutritionGoals, currentStreak, getPlaisirSuggestion, preferences, addMessage])

  // Générer les messages seulement quand les stores sont hydratés
  useEffect(() => {
    if (isStoreHydrated) {
      clearExpired()
      generateMessages()
    }
  }, [isStoreHydrated, clearExpired, generateMessages])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    clearExpired()
    generateMessages()
    setRefreshing(false)
  }, [clearExpired, generateMessages])

  const handleAction = (route: string, message?: LymiaMessage) => {
    // Extract meal type from dedupKey if available (e.g., "meal-reminder-dinner-2026-01-12")
    const mealType = message?.dedupKey?.match(/meal-reminder-(breakfast|lunch|snack|dinner)/)?.[1]
    // @ts-ignore - navigation typing
    navigation.navigate(route, mealType ? { mealType } : undefined)
  }

  const handleDismissWelcome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setHasSeenCoachWelcome(true)
  }

  // Auto-mark welcome as seen for returning users (restored from cloud)
  // This prevents the welcome card from showing again after reinstall/reconnect
  useEffect(() => {
    if (isStoreHydrated && syncStatus === 'success' && userId && !hasSeenCoachWelcome && profile?.firstName) {
      // User was restored from cloud - they're not a new user
      console.log('[CoachScreen] Returning user detected, auto-marking welcome as seen')
      setHasSeenCoachWelcome(true)
    }
  }, [isStoreHydrated, syncStatus, userId, hasSeenCoachWelcome, profile?.firstName, setHasSeenCoachWelcome])

  // Get active messages organized by priority
  // GUARD: Only access MessageCenter data after stores are hydrated to prevent crashes
  const activeMessages = isStoreHydrated ? getActiveMessages() : []
  const unreadCount = isStoreHydrated ? getUnreadCount() : 0

  // Organize by type for sections
  const alerts = activeMessages.filter(m => m.type === 'alert' || m.priority === 'P0')
  const actions = activeMessages.filter(m => m.type === 'action' && m.priority !== 'P0')
  const celebrations = activeMessages.filter(m => m.type === 'celebration')
  const tips = activeMessages.filter(m => m.type === 'tip' || m.type === 'insight')

  const hasMessages = activeMessages.length > 0

  // Show loading state while stores are hydrating to prevent crashes
  if (!isStoreHydrated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
        {/* AnimatedBackground temporairement désactivé pour debug crash */}
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
      {/* AnimatedBackground temporairement désactivé pour debug crash */}
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
                {unreadCount > 0 ? `${unreadCount} nouveau${unreadCount > 1 ? 'x' : ''}` : 'Tes conseils personnalisés'}
              </Text>
            </View>
            <View style={[styles.avatarGradient, { backgroundColor: staticColors.accent.primary }]}>
              <Bot size={24} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Welcome Card - shown only once after onboarding (wait for store hydration and cloud sync) */}
        {isStoreHydrated && !hasSeenCoachWelcome && profile?.firstName && syncStatus !== 'syncing' && (
          <WelcomeCard
            firstName={profile.firstName}
            onDismiss={handleDismissWelcome}
            colors={colors}
          />
        )}

        {/* Content */}
        {!hasMessages ? (
          <View style={styles.emptyState}>
            <Sparkles size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Tout va bien !</Text>
            <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
              Continue à tracker tes repas pour recevoir des conseils personnalisés de LYM.
            </Text>
          </View>
        ) : (
          <>
            {/* Alerts - Priority P0/P1 */}
            {alerts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AlertTriangle size={16} color={priorityConfig.P0.color} />
                  <Text style={[styles.sectionTitle, { color: priorityConfig.P0.color }]}>
                    Alertes
                  </Text>
                </View>
                {alerts.map((msg) => (
                  <CoachMessageCard
                    key={msg.id}
                    message={msg}
                    onRead={() => markAsRead(msg.id)}
                    onDismiss={() => dismiss(msg.id)}
                    onAction={(route) => handleAction(route, msg)}
                  />
                ))}
              </View>
            )}

            {/* Actions - P1 */}
            {actions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Bell size={16} color={priorityConfig.P1.color} />
                  <Text style={[styles.sectionTitle, { color: priorityConfig.P1.color }]}>
                    Actions suggérées
                  </Text>
                </View>
                {actions.map((msg) => (
                  <CoachMessageCard
                    key={msg.id}
                    message={msg}
                    onRead={() => markAsRead(msg.id)}
                    onDismiss={() => dismiss(msg.id)}
                    onAction={(route) => handleAction(route, msg)}
                  />
                ))}
              </View>
            )}

            {/* Celebrations - P2 */}
            {celebrations.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Trophy size={16} color={priorityConfig.P2.color} />
                  <Text style={[styles.sectionTitle, { color: priorityConfig.P2.color }]}>
                    Félicitations
                  </Text>
                </View>
                {celebrations.map((msg) => (
                  <CoachMessageCard
                    key={msg.id}
                    message={msg}
                    onRead={() => markAsRead(msg.id)}
                    onDismiss={() => dismiss(msg.id)}
                    onAction={(route) => handleAction(route, msg)}
                  />
                ))}
              </View>
            )}

            {/* Tips - P3 */}
            {tips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Lightbulb size={16} color={priorityConfig.P3.color} />
                  <Text style={[styles.sectionTitle, { color: priorityConfig.P3.color }]}>
                    Conseils
                  </Text>
                </View>
                {tips.map((msg) => (
                  <CoachMessageCard
                    key={msg.id}
                    message={msg}
                    onRead={() => markAsRead(msg.id)}
                    onDismiss={() => dismiss(msg.id)}
                    onAction={(route) => handleAction(route, msg)}
                  />
                ))}
              </View>
            )}
          </>
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
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
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
