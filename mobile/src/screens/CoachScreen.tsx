/**
 * CoachScreen - Conseils, Analyses et Alertes LymIA
 *
 * Affiche du contenu proactif personnalisé (pas de chat).
 * Types: tip, analysis, alert, celebration
 */

import React, { useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  RefreshControl,
} from 'react-native'
import {
  Sparkles,
  Apple,
  Moon,
  Flame,
  Dumbbell,
  Heart,
  AlertTriangle,
  TrendingUp,
  Droplets,
  Brain,
  Trophy,
  ChevronRight,
  Check,
  X,
  Lightbulb,
  BarChart3,
  Bell,
  PartyPopper,
  ChefHat,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { colors as staticColors, spacing, typography, radius } from '../constants/theme'
import { useCoachStore, type CoachItem, type CoachItemType, type CoachItemCategory } from '../stores/coach-store'
import { useUserStore } from '../stores/user-store'
import { useMealsStore } from '../stores/meals-store'
import { useWellnessStore } from '../stores/wellness-store'
import { useGamificationStore } from '../stores/gamification-store'

// Configuration des icônes et couleurs par type
const typeConfig: Record<CoachItemType, { icon: typeof Lightbulb; label: string; color: string }> = {
  tip: { icon: Lightbulb, label: 'Conseil', color: staticColors.accent.primary },
  analysis: { icon: BarChart3, label: 'Analyse', color: staticColors.secondary.primary },
  alert: { icon: Bell, label: 'Alerte', color: staticColors.warning },
  celebration: { icon: PartyPopper, label: 'Bravo !', color: staticColors.success },
}

// Configuration par catégorie
const categoryConfig: Record<CoachItemCategory, { icon: typeof Apple; bgColor: string }> = {
  nutrition: { icon: Apple, bgColor: `${staticColors.success}15` },
  metabolism: { icon: Flame, bgColor: `${staticColors.warning}15` },
  wellness: { icon: Heart, bgColor: `${staticColors.error}15` },
  sport: { icon: Dumbbell, bgColor: `${staticColors.accent.primary}15` },
  hydration: { icon: Droplets, bgColor: `${staticColors.info}15` },
  sleep: { icon: Moon, bgColor: `${staticColors.secondary.primary}15` },
  stress: { icon: Brain, bgColor: `${staticColors.warning}15` },
  progress: { icon: Trophy, bgColor: `${staticColors.success}15` },
  cooking: { icon: ChefHat, bgColor: `${staticColors.warning}15` },
}

// Libellés des sources
const sourceLabels: Record<string, string> = {
  anses: 'ANSES',
  inserm: 'INSERM',
  has: 'HAS',
  expert: 'Expert LymIA',
  pubmed: 'PubMed',
}

interface ItemCardProps {
  item: CoachItem
  onRead: () => void
  onDismiss: () => void
  colors: ReturnType<typeof useTheme>['colors']
}

function ItemCard({ item, onRead, onDismiss, colors }: ItemCardProps) {
  const typeConf = typeConfig[item.type]
  const catConf = categoryConfig[item.category]
  const TypeIcon = typeConf.icon
  const CatIcon = catConf.icon

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!item.isRead) {
      onRead()
    }
  }

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onDismiss()
  }

  // Couleur de bordure selon le type
  const borderColor = item.type === 'alert' && item.priority === 'high'
    ? colors.error
    : item.type === 'celebration'
    ? colors.success
    : typeConf.color

  return (
    <Pressable
      style={[
        styles.itemCard,
        { backgroundColor: colors.bg.secondary },
        !item.isRead && { backgroundColor: colors.bg.elevated },
        { borderLeftColor: borderColor },
      ]}
      onPress={handlePress}
    >
      {/* Header avec type et catégorie */}
      <View style={styles.itemHeader}>
        <View style={styles.itemHeaderLeft}>
          <View style={[styles.typeIconContainer, { backgroundColor: `${typeConf.color}15` }]}>
            <TypeIcon size={16} color={typeConf.color} />
          </View>
          <Text style={[styles.typeLabel, { color: typeConf.color }]}>
            {typeConf.label}
          </Text>
          {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.accent.primary }]} />}
        </View>
        <Pressable onPress={handleDismiss} style={styles.dismissButton} hitSlop={8}>
          <X size={16} color={colors.text.tertiary} />
        </Pressable>
      </View>

      {/* Message avec icône catégorie (titre retiré car redondant) */}
      <View style={styles.messageRow}>
        <View style={[styles.catIconContainer, { backgroundColor: catConf.bgColor }]}>
          <CatIcon size={18} color={colors.text.secondary} />
        </View>
        <Text style={[styles.itemMessage, { color: colors.text.primary }]}>{item.message}</Text>
      </View>

      {/* Footer: source + time + action */}
      <View style={styles.itemFooter}>
        <View style={styles.footerLeft}>
          {item.source && (
            <Text style={[styles.sourceText, { color: colors.text.tertiary, backgroundColor: colors.bg.tertiary }]}>
              {sourceLabels[item.source] || item.source}
            </Text>
          )}
          <Text style={[styles.timeText, { color: colors.text.tertiary }]}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>

        {item.actionLabel && (
          <Pressable style={styles.actionButton}>
            <Text style={[styles.actionText, { color: typeConf.color }]}>
              {item.actionLabel}
            </Text>
            <ChevronRight size={14} color={typeConf.color} />
          </Pressable>
        )}
      </View>
    </Pressable>
  )
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return 'À l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins} min`
  if (diffHours < 24) return `Il y a ${diffHours}h`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function CoachScreen() {
  const { colors } = useTheme()
  const { items, unreadCount, generateItemsWithAI, markAsRead, markAllAsRead, dismissItem, setContext } = useCoachStore()
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData } = useMealsStore()
  const wellnessStore = useWellnessStore()
  const { currentStreak, currentLevel, totalXP } = useGamificationStore()

  const [refreshing, setRefreshing] = React.useState(false)

  // Mettre à jour le contexte et générer des items avec AI (RAG)
  const updateContext = useCallback(async () => {
    const todayData = getTodayData()
    const todayNutrition = todayData.totalNutrition
    const todayWellness = wellnessStore.getTodayEntry?.() || {} as Record<string, unknown>

    setContext({
      firstName: profile?.firstName,
      goal: profile?.goal,
      dietType: profile?.dietType,
      allergies: profile?.allergies,
      weight: profile?.weight,
      // Cooking preferences
      cookingLevel: profile?.cookingPreferences?.level,
      weekdayTime: profile?.cookingPreferences?.weekdayTime,
      weekendTime: profile?.cookingPreferences?.weekendTime,
      batchCooking: profile?.cookingPreferences?.batchCooking,
      quickMealsOnly: profile?.cookingPreferences?.quickMealsOnly,
      // Nutrition
      caloriesConsumed: todayNutrition.calories,
      caloriesTarget: nutritionGoals?.calories,
      proteinConsumed: todayNutrition.proteins,
      proteinTarget: Math.round((profile?.weight || 70) * 1.6),
      carbsConsumed: todayNutrition.carbs,
      fatsConsumed: todayNutrition.fats,
      waterConsumed: (todayWellness as { hydration?: number }).hydration || 0,
      waterTarget: 2000,
      sleepHours: (todayWellness as { sleepHours?: number }).sleepHours,
      sleepQuality: (todayWellness as { sleepQuality?: number }).sleepQuality,
      stressLevel: (todayWellness as { stressLevel?: number }).stressLevel,
      energyLevel: (todayWellness as { energyLevel?: number }).energyLevel,
      streak: currentStreak,
      level: currentLevel,
      xp: totalXP,
    })

    // Use AI-powered generation with RAG (falls back to static if AI unavailable)
    await generateItemsWithAI()
  }, [profile, nutritionGoals, getTodayData, wellnessStore, currentStreak, currentLevel, totalXP, setContext, generateItemsWithAI])

  useEffect(() => {
    updateContext()
  }, [updateContext])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    // Force la régénération
    useCoachStore.setState({ lastGeneratedAt: null })
    await updateContext()
    setRefreshing(false)
  }, [updateContext])

  const handleMarkAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    markAllAsRead()
  }

  // Séparer par type pour l'affichage
  const alerts = items.filter((i) => i.type === 'alert')
  const analyses = items.filter((i) => i.type === 'analysis')
  const tips = items.filter((i) => i.type === 'tip')
  const celebrations = items.filter((i) => i.type === 'celebration')

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.light }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconContainer, { backgroundColor: `${colors.accent.primary}20` }]}>
            <Sparkles size={24} color={colors.accent.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text.primary }]}>LymIA Coach</Text>
            <Text style={[styles.headerSubtitle, { color: colors.text.secondary }]}>
              {unreadCount > 0
                ? `${unreadCount} nouvelle${unreadCount > 1 ? 's' : ''} notification${unreadCount > 1 ? 's' : ''}`
                : 'Tout est à jour'}
            </Text>
          </View>
        </View>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAllRead} style={[styles.markAllButton, { backgroundColor: `${colors.accent.primary}10` }]}>
            <Check size={16} color={colors.accent.primary} />
            <Text style={[styles.markAllText, { color: colors.accent.primary }]}>Tout lire</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
        }
      >
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Sparkles size={48} color={colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Aucune notification</Text>
            <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
              Continue à tracker tes repas et ton bien-être pour recevoir des conseils, analyses et alertes personnalisés.
            </Text>
          </View>
        ) : (
          <>
            {/* Alertes en premier */}
            {alerts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AlertTriangle size={16} color={colors.warning} />
                  <Text style={[styles.sectionTitle, { color: colors.warning }]}>
                    Alertes
                  </Text>
                </View>
                {alerts.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRead={() => markAsRead(item.id)}
                    onDismiss={() => dismissItem(item.id)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* Célébrations */}
            {celebrations.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Trophy size={16} color={colors.success} />
                  <Text style={[styles.sectionTitle, { color: colors.success }]}>
                    Félicitations
                  </Text>
                </View>
                {celebrations.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRead={() => markAsRead(item.id)}
                    onDismiss={() => dismissItem(item.id)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* Analyses */}
            {analyses.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <TrendingUp size={16} color={colors.secondary.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.secondary.primary }]}>
                    Analyses
                  </Text>
                </View>
                {analyses.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRead={() => markAsRead(item.id)}
                    onDismiss={() => dismissItem(item.id)}
                    colors={colors}
                  />
                ))}
              </View>
            )}

            {/* Conseils */}
            {tips.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Lightbulb size={16} color={colors.accent.primary} />
                  <Text style={[styles.sectionTitle, { color: colors.accent.primary }]}>
                    Conseils
                  </Text>
                </View>
                {tips.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onRead={() => markAsRead(item.id)}
                    onDismiss={() => dismissItem(item.id)}
                    colors={colors}
                  />
                ))}
              </View>
            )}
          </>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...typography.sm,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  markAllText: {
    ...typography.sm,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
  },
  itemCardUnread: {
    // Dynamic via inline style
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeLabel: {
    ...typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dismissButton: {
    padding: spacing.xs,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  catIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  itemMessage: {
    ...typography.sm,
    lineHeight: 20,
    flex: 1,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sourceText: {
    ...typography.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  timeText: {
    ...typography.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    ...typography.sm,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyTitle: {
    ...typography.lg,
    fontWeight: '600',
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    ...typography.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
})
