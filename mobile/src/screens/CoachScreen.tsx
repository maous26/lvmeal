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
  TrendingUp,
  Droplets,
  Brain,
  Trophy,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Lightbulb,
  BarChart3,
  Bell,
  PartyPopper,
  ChefHat,
  ExternalLink,
  Link2,
  Info,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'

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
  lymia: 'LymIA',
  RAG: 'Base scientifique',
}

// URLs des sources scientifiques
const sourceUrls: Record<string, string> = {
  anses: 'https://www.anses.fr/fr/content/les-références-nutritionnelles-en-vitamines-et-minéraux',
  inserm: 'https://www.inserm.fr/dossier/nutrition-et-sante/',
  has: 'https://www.has-sante.fr/jcms/fc_2875171/fr/toutes-les-recommandations-de-bonne-pratique',
  pubmed: 'https://pubmed.ncbi.nlm.nih.gov/',
}

// Icônes pour les features liées
const featureIcons: Record<string, typeof Apple> = {
  nutrition: Apple,
  sleep: Moon,
  stress: Brain,
  sport: Dumbbell,
  wellness: Heart,
  hydration: Droplets,
  weight: TrendingUp,
}

interface ItemCardProps {
  item: CoachItem
  onRead: () => void
  onDismiss: () => void
  onAction?: (route: string) => void
  colors: ReturnType<typeof useTheme>['colors']
}

function ItemCard({ item, onRead, onDismiss, onAction, colors }: ItemCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const typeConf = typeConfig[item.type]
  const catConf = categoryConfig[item.category]
  const TypeIcon = typeConf.icon
  const CatIcon = catConf.icon

  // Determine if card has expandable content
  const hasExpandableContent = !!(item.reasoning || item.scientificBasis || item.dataPoints?.length || item.linkedFeatures?.length)

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!item.isRead) {
      onRead()
    }
    if (hasExpandableContent) {
      setExpanded(!expanded)
    }
  }

  const handleDismiss = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onDismiss()
  }

  const handleSourcePress = () => {
    const url = item.sourceUrl || (item.source ? sourceUrls[item.source.toLowerCase()] : null)
    if (url) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      Linking.openURL(url)
    }
  }

  const handleAction = () => {
    if (item.actionRoute && onAction) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onAction(item.actionRoute)
    }
  }

  // Couleur de bordure selon le type
  const borderColor = item.type === 'alert' && item.priority === 'high'
    ? colors.error
    : item.type === 'celebration'
    ? colors.success
    : typeConf.color

  // Confidence indicator
  const confidencePercent = item.confidence ? Math.round(item.confidence * 100) : null

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
          {confidencePercent && (
            <View style={[styles.confidenceBadge, { backgroundColor: `${colors.success}15` }]}>
              <Text style={[styles.confidenceText, { color: colors.success }]}>
                {confidencePercent}%
              </Text>
            </View>
          )}
          {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.accent.primary }]} />}
        </View>
        <View style={styles.headerRight}>
          {hasExpandableContent && (
            expanded
              ? <ChevronUp size={16} color={colors.text.tertiary} />
              : <ChevronDown size={16} color={colors.text.tertiary} />
          )}
          <Pressable onPress={handleDismiss} style={styles.dismissButton} hitSlop={8}>
            <X size={16} color={colors.text.tertiary} />
          </Pressable>
        </View>
      </View>

      {/* Linked Features (if any) - Visual connection */}
      {item.linkedFeatures && item.linkedFeatures.length > 1 && (
        <View style={styles.linkedFeaturesRow}>
          {item.linkedFeatures.map((feature, index) => {
            const FeatureIcon = featureIcons[feature] || Link2
            return (
              <React.Fragment key={feature}>
                <View style={[styles.featureBadge, { backgroundColor: `${colors.accent.primary}10` }]}>
                  <FeatureIcon size={12} color={colors.accent.primary} />
                </View>
                {index < item.linkedFeatures!.length - 1 && (
                  <View style={styles.featureConnector}>
                    <Link2 size={10} color={colors.text.muted} />
                  </View>
                )}
              </React.Fragment>
            )
          })}
          <Text style={[styles.linkedLabel, { color: colors.text.muted }]}>liés</Text>
        </View>
      )}

      {/* Message avec icône catégorie */}
      <View style={styles.messageRow}>
        <View style={[styles.catIconContainer, { backgroundColor: catConf.bgColor }]}>
          <CatIcon size={18} color={colors.text.secondary} />
        </View>
        <Text style={[styles.itemMessage, { color: colors.text.primary }]}>{item.message}</Text>
      </View>

      {/* Expanded content: Reasoning, Scientific Basis, DataPoints */}
      {expanded && hasExpandableContent && (
        <View style={[styles.expandedContent, { borderTopColor: colors.border.light }]}>
          {/* Reasoning / WHY */}
          {item.reasoning && (
            <View style={styles.reasoningSection}>
              <View style={styles.reasoningHeader}>
                <Info size={14} color={colors.accent.primary} />
                <Text style={[styles.reasoningTitle, { color: colors.accent.primary }]}>Pourquoi ?</Text>
              </View>
              <Text style={[styles.reasoningText, { color: colors.text.secondary }]}>
                {item.reasoning}
              </Text>
            </View>
          )}

          {/* Scientific Basis */}
          {item.scientificBasis && (
            <View style={styles.scientificSection}>
              <Text style={[styles.scientificLabel, { color: colors.text.tertiary }]}>Base scientifique:</Text>
              <Text style={[styles.scientificText, { color: colors.text.secondary }]}>
                {item.scientificBasis}
              </Text>
            </View>
          )}

          {/* Data Points */}
          {item.dataPoints && item.dataPoints.length > 0 && (
            <View style={styles.dataPointsSection}>
              <Text style={[styles.dataPointsLabel, { color: colors.text.tertiary }]}>Données:</Text>
              <View style={styles.dataPointsGrid}>
                {item.dataPoints.map((dp, index) => (
                  <View key={index} style={[styles.dataPoint, { backgroundColor: colors.bg.tertiary }]}>
                    <Text style={[styles.dataPointValue, { color: colors.text.primary }]}>
                      {dp.value}
                      {dp.trend === 'up' && ' ↑'}
                      {dp.trend === 'down' && ' ↓'}
                    </Text>
                    <Text style={[styles.dataPointLabel, { color: colors.text.tertiary }]}>
                      {dp.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Footer: source + time + action */}
      <View style={styles.itemFooter}>
        <View style={styles.footerLeft}>
          {item.source && (
            <Pressable
              onPress={handleSourcePress}
              style={[styles.sourceButton, { backgroundColor: colors.bg.tertiary }]}
              disabled={!item.sourceUrl && !sourceUrls[item.source.toLowerCase()]}
            >
              <Text style={[styles.sourceText, { color: colors.accent.primary }]}>
                {sourceLabels[item.source.toLowerCase()] || item.source.toUpperCase()}
              </Text>
              {(item.sourceUrl || sourceUrls[item.source.toLowerCase()]) && (
                <ExternalLink size={10} color={colors.accent.primary} />
              )}
            </Pressable>
          )}
          <Text style={[styles.timeText, { color: colors.text.tertiary }]}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>

        {item.actionLabel && (
          <Pressable style={styles.actionButton} onPress={handleAction}>
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
  const navigation = useNavigation()
  const { items, unreadCount, generateItemsWithAI, markAsRead, markAllAsRead, dismissItem, setContext } = useCoachStore()
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData } = useMealsStore()
  const wellnessStore = useWellnessStore()
  const { currentStreak, currentLevel, totalXP } = useGamificationStore()

  const [refreshing, setRefreshing] = React.useState(false)

  // Handle action navigation
  const handleAction = (route: string) => {
    // @ts-ignore - Navigation typing
    navigation.navigate(route)
  }

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
                    onAction={handleAction}
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
                    onAction={handleAction}
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
                    onAction={handleAction}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confidenceBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  confidenceText: {
    ...typography.xs,
    fontWeight: '600',
  },
  linkedFeaturesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  featureBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureConnector: {
    opacity: 0.5,
  },
  linkedLabel: {
    ...typography.xs,
    marginLeft: spacing.xs,
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
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  sourceText: {
    ...typography.xs,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  reasoningSection: {
    marginBottom: spacing.md,
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  reasoningTitle: {
    ...typography.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  reasoningText: {
    ...typography.sm,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  scientificSection: {
    marginBottom: spacing.md,
  },
  scientificLabel: {
    ...typography.xs,
    marginBottom: spacing.xs,
  },
  scientificText: {
    ...typography.sm,
    lineHeight: 20,
  },
  dataPointsSection: {
    marginBottom: spacing.sm,
  },
  dataPointsLabel: {
    ...typography.xs,
    marginBottom: spacing.sm,
  },
  dataPointsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dataPoint: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    minWidth: 80,
  },
  dataPointValue: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  dataPointLabel: {
    ...typography.xs,
    marginTop: 2,
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
