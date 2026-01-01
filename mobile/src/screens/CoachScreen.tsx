/**
 * CoachScreen - Flux intelligent de conseils LymIA
 *
 * Un seul flux priorisé qui affiche :
 * - Alertes (prioritaires)
 * - Célébrations (motivantes)
 * - Analyses (insights)
 * - Conseils (tips quotidiens)
 *
 * Plus d'onglets - juste l'intelligence de LymIA.
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
  Linking,
} from 'react-native'
import {
  Sparkles,
  Apple,
  Moon,
  Flame,
  Dumbbell,
  Heart,
  AlertTriangle,
  Droplets,
  Brain,
  Trophy,
  ChevronRight,
  X,
  Lightbulb,
  BarChart3,
  Bell,
  PartyPopper,
  ExternalLink,
  Bot,
  TrendingUp,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'

import { useTheme } from '../contexts/ThemeContext'
import { colors as staticColors, spacing, typography, radius, shadows } from '../constants/theme'
import { useCoachStore, type CoachItem, type CoachItemType, type CoachItemCategory } from '../stores/coach-store'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useWellnessStore } from '../stores/wellness-store'
import { useGamificationStore } from '../stores/gamification-store'

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
        <LinearGradient
          colors={[staticColors.accent.primary, staticColors.secondary.primary]}
          style={welcomeStyles.avatar}
        >
          <Sparkles size={24} color="#FFFFFF" />
        </LinearGradient>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={20} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Welcome message */}
      <Text style={[welcomeStyles.greeting, { color: colors.accent.primary }]}>
        Salut {firstName} ! 👋
      </Text>
      <Text style={[welcomeStyles.title, { color: colors.text.primary }]}>
        Je suis LymIA, ton coach nutrition
      </Text>

      <View style={[welcomeStyles.messageBox, { backgroundColor: colors.bg.secondary }]}>
        <Text style={[welcomeStyles.message, { color: colors.text.primary }]}>
          Bienvenue ! Ici tu trouveras mes conseils personnalisés, analyses et alertes pour t'accompagner dans ton parcours nutrition.
        </Text>
        <Text style={[welcomeStyles.message, { color: colors.text.secondary, marginTop: spacing.sm }]}>
          Mon rôle : t'aider à atteindre tes objectifs{' '}
          <Text style={{ fontWeight: '600', color: colors.text.primary }}>
            sans frustration ni culpabilité
          </Text>.
        </Text>
      </View>

      {/* Features summary */}
      <View style={welcomeStyles.features}>
        <View style={welcomeStyles.featureItem}>
          <View style={[welcomeStyles.featureIcon, { backgroundColor: `${staticColors.success}20` }]}>
            <TrendingUp size={16} color={staticColors.success} />
          </View>
          <Text style={[welcomeStyles.featureText, { color: colors.text.secondary }]}>
            Suivi intelligent de tes repas
          </Text>
        </View>
        <View style={welcomeStyles.featureItem}>
          <View style={[welcomeStyles.featureIcon, { backgroundColor: `${staticColors.secondary.primary}20` }]}>
            <Heart size={16} color={staticColors.secondary.primary} />
          </View>
          <Text style={[welcomeStyles.featureText, { color: colors.text.secondary }]}>
            Bienveillance avant tout
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
    ...typography.h3,
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

// Configuration des types
const typeConfig: Record<CoachItemType, { icon: typeof Lightbulb; label: string; color: string }> = {
  tip: { icon: Lightbulb, label: 'Conseil', color: staticColors.accent.primary },
  analysis: { icon: BarChart3, label: 'Analyse', color: staticColors.secondary.primary },
  alert: { icon: Bell, label: 'Alerte', color: staticColors.warning },
  celebration: { icon: PartyPopper, label: 'Bravo !', color: staticColors.success },
}

// Configuration des catégories
const categoryConfig: Record<CoachItemCategory, { icon: typeof Apple; bgColor: string }> = {
  nutrition: { icon: Apple, bgColor: `${staticColors.success}15` },
  metabolism: { icon: Flame, bgColor: `${staticColors.warning}15` },
  wellness: { icon: Heart, bgColor: `${staticColors.error}15` },
  sport: { icon: Dumbbell, bgColor: `${staticColors.accent.primary}15` },
  hydration: { icon: Droplets, bgColor: `${staticColors.info}15` },
  sleep: { icon: Moon, bgColor: `${staticColors.secondary.primary}15` },
  stress: { icon: Brain, bgColor: `${staticColors.warning}15` },
  progress: { icon: Trophy, bgColor: `${staticColors.success}15` },
  cooking: { icon: Apple, bgColor: `${staticColors.accent.primary}15` },
}

// ============= ITEM CARD COMPONENT =============

interface ItemCardProps {
  item: CoachItem
  onRead: () => void
  onDismiss: () => void
  onAction?: (route: string) => void
  colors: ReturnType<typeof useTheme>['colors']
}

function ItemCard({ item, onRead, onDismiss, onAction, colors }: ItemCardProps) {
  const config = typeConfig[item.type]
  const catConfig = categoryConfig[item.category]
  const Icon = config.icon
  const CategoryIcon = catConfig.icon

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!item.isRead) onRead()

    if (item.actionRoute) {
      onAction?.(item.actionRoute)
    } else if (item.sourceUrl) {
      Linking.openURL(item.sourceUrl)
    }
  }

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onDismiss()
  }

  return (
    <TouchableOpacity
      style={[
        styles.itemCard,
        { backgroundColor: colors.bg.elevated },
        !item.isRead && styles.itemCardUnread,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.itemHeader}>
        <View style={[styles.itemIcon, { backgroundColor: catConfig.bgColor }]}>
          <CategoryIcon size={18} color={config.color} />
        </View>
        <View style={styles.itemHeaderText}>
          <Text style={[styles.itemType, { color: config.color }]}>{config.label}</Text>
          {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: config.color }]} />}
        </View>
        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={18} color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <Text style={[styles.itemTitle, { color: colors.text.primary }]}>{item.title}</Text>
      <Text style={[styles.itemMessage, { color: colors.text.secondary }]}>{item.message}</Text>

      {/* Source */}
      {item.source && (
        <View style={styles.sourceRow}>
          <Text style={[styles.sourceText, { color: colors.text.muted }]}>
            Source: {item.source}
          </Text>
          {item.sourceUrl && <ExternalLink size={12} color={colors.text.muted} />}
        </View>
      )}

      {/* Action */}
      {(item.actionLabel || item.actionRoute) && (
        <View style={[styles.actionButton, { backgroundColor: `${config.color}15` }]}>
          <Text style={[styles.actionText, { color: config.color }]}>
            {item.actionLabel || 'Voir plus'}
          </Text>
          <ChevronRight size={16} color={config.color} />
        </View>
      )}
    </TouchableOpacity>
  )
}

// ============= MAIN COMPONENT =============

export default function CoachScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const [refreshing, setRefreshing] = useState(false)

  const { items, unreadCount, generateItemsWithAI, markAsRead, dismissItem, setContext } = useCoachStore()
  const { profile, nutritionGoals, hasSeenCoachWelcome, setHasSeenCoachWelcome } = useUserStore()
  const { getTodayData } = useMealsStore()
  const wellnessStore = useWellnessStore()
  const { currentStreak, currentLevel, totalXP } = useGamificationStore()

  // Generate context and items on mount
  useEffect(() => {
    const todayData = getTodayData()
    const todayEntry = wellnessStore.getTodayEntry?.() || {}

    if (profile && nutritionGoals) {
      setContext({
        // Profile data
        firstName: profile.firstName,
        goal: profile.goal,
        dietType: profile.dietType,
        allergies: profile.allergies,
        weight: profile.weight,
        // Nutrition goals and consumption
        caloriesTarget: nutritionGoals.calories,
        proteinTarget: nutritionGoals.proteins,
        caloriesConsumed: todayData.totalNutrition.calories,
        proteinConsumed: todayData.totalNutrition.proteins,
        carbsConsumed: todayData.totalNutrition.carbs,
        fatsConsumed: todayData.totalNutrition.fats,
        // Hydration
        waterConsumed: todayData.hydration,
        waterTarget: 2000,
        // Wellness
        sleepHours: (todayEntry as any).sleepHours,
        stressLevel: (todayEntry as any).stressLevel,
        energyLevel: (todayEntry as any).energyLevel,
        // Gamification
        streak: currentStreak,
        level: currentLevel,
        xp: totalXP,
        // Meals for RAG
        recentMeals: todayData.meals,
      })

      if (items.length === 0) {
        generateItemsWithAI()
      }
    }
  }, [profile, nutritionGoals])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    await generateItemsWithAI()
    setRefreshing(false)
  }, [generateItemsWithAI])

  const handleAction = (route: string) => {
    // @ts-ignore
    navigation.navigate(route)
  }

  const handleDismissWelcome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setHasSeenCoachWelcome(true)
  }

  // Organize items by priority (dismissItem removes from array, no dismissed property)
  const alerts = items.filter(i => i.type === 'alert')
  const celebrations = items.filter(i => i.type === 'celebration')
  const analyses = items.filter(i => i.type === 'analysis')
  const tips = items.filter(i => i.type === 'tip')

  const hasItems = alerts.length + celebrations.length + analyses.length + tips.length > 0

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
                {unreadCount > 0 ? `${unreadCount} nouveau${unreadCount > 1 ? 'x' : ''}` : 'Tes conseils personnalisés'}
              </Text>
            </View>
            <LinearGradient
              colors={[staticColors.accent.primary, staticColors.secondary.primary]}
              style={styles.avatarGradient}
            >
              <Bot size={24} color="#FFFFFF" />
            </LinearGradient>
          </View>
        </View>

        {/* Welcome Card - shown only once after onboarding */}
        {!hasSeenCoachWelcome && (
          <WelcomeCard
            firstName={profile?.firstName || 'toi'}
            onDismiss={handleDismissWelcome}
            colors={colors}
          />
        )}

        {/* Content */}
        {!hasItems ? (
          <View style={styles.emptyState}>
            <Sparkles size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Aucune notification</Text>
            <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
              Continue à tracker tes repas pour recevoir des conseils personnalisés de LymIA.
            </Text>
          </View>
        ) : (
          <>
            {/* Alerts - Priority */}
            {alerts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AlertTriangle size={16} color={staticColors.warning} />
                  <Text style={[styles.sectionTitle, { color: staticColors.warning }]}>Alertes</Text>
                </View>
                {alerts.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRead={() => markAsRead(item.id)}
                    onDismiss={() => dismissItem(item.id)}
                    onAction={handleAction}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* Celebrations */}
            {celebrations.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Trophy size={16} color={staticColors.success} />
                  <Text style={[styles.sectionTitle, { color: staticColors.success }]}>Félicitations</Text>
                </View>
                {celebrations.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRead={() => markAsRead(item.id)}
                    onDismiss={() => dismissItem(item.id)}
                    onAction={handleAction}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* Analyses */}
            {analyses.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <BarChart3 size={16} color={staticColors.secondary.primary} />
                  <Text style={[styles.sectionTitle, { color: staticColors.secondary.primary }]}>Analyses</Text>
                </View>
                {analyses.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRead={() => markAsRead(item.id)}
                    onDismiss={() => dismissItem(item.id)}
                    onAction={handleAction}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* Tips */}
            {tips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Lightbulb size={16} color={staticColors.accent.primary} />
                  <Text style={[styles.sectionTitle, { color: staticColors.accent.primary }]}>Conseils</Text>
                </View>
                {tips.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRead={() => markAsRead(item.id)}
                    onDismiss={() => dismissItem(item.id)}
                    onAction={handleAction}
                    colors={colors}
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
    ...typography.h1,
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
    ...typography.h2,
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
  itemCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  itemCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: staticColors.accent.primary,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  itemHeaderText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemType: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  itemTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  itemMessage: {
    ...typography.body,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sourceText: {
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
  },
  actionText: {
    ...typography.smallMedium,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
})
