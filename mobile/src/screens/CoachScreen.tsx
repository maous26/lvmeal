/**
 * CoachScreen - Écran unifié Coach + Bien-être
 *
 * Fusionne:
 * - Conseils IA (tips, analyses, alertes, célébrations)
 * - Bien-être (sommeil, stress, humeur, énergie, hydratation)
 * - Méditations guidées
 *
 * Résout la confusion UX entre Coach et Wellness de l'audit produit.
 */

import React, { useEffect, useCallback, useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  RefreshControl,
  Linking,
  TouchableOpacity,
  Dimensions,
  Animated,
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
  Plus,
  Minus,
  Headphones,
  Wind,
  Smile,
  Battery,
  Zap,
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
import { useMeditationStore } from '../stores/meditation-store'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// ============= TYPES & CONFIG =============

type TabKey = 'conseils' | 'bienetre' | 'meditations'

const TABS: { key: TabKey; label: string; icon: typeof Sparkles }[] = [
  { key: 'conseils', label: 'Conseils', icon: Sparkles },
  { key: 'bienetre', label: 'Bien-être', icon: Heart },
  { key: 'meditations', label: 'Méditations', icon: Headphones },
]

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

// Emojis
const moodEmojis = ['😢', '😔', '😐', '🙂', '😊']
const stressEmojis = ['😌', '🙂', '😐', '😰', '😫']
const energyEmojis = ['🪫', '🔋', '⚡', '💪', '🚀']

// ============= HELPER FUNCTIONS =============

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

// ============= ITEM CARD COMPONENT =============

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

  const borderColor = item.type === 'alert' && item.priority === 'high'
    ? colors.error
    : item.type === 'celebration'
    ? colors.success
    : typeConf.color

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
      {/* Header */}
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

      {/* Linked Features */}
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

      {/* Message */}
      <View style={styles.messageRow}>
        <View style={[styles.catIconContainer, { backgroundColor: catConf.bgColor }]}>
          <CatIcon size={18} color={colors.text.secondary} />
        </View>
        <Text style={[styles.itemMessage, { color: colors.text.primary }]}>{item.message}</Text>
      </View>

      {/* Expanded content */}
      {expanded && hasExpandableContent && (
        <View style={[styles.expandedContent, { borderTopColor: colors.border.light }]}>
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

          {item.scientificBasis && (
            <View style={styles.scientificSection}>
              <Text style={[styles.scientificLabel, { color: colors.text.tertiary }]}>Base scientifique:</Text>
              <Text style={[styles.scientificText, { color: colors.text.secondary }]}>
                {item.scientificBasis}
              </Text>
            </View>
          )}

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

      {/* Footer */}
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

// ============= CONSEILS TAB =============

interface ConseilsTabProps {
  colors: ReturnType<typeof useTheme>['colors']
  items: CoachItem[]
  unreadCount: number
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string) => void
  onMarkAllRead: () => void
  onAction: (route: string) => void
  refreshing: boolean
  onRefresh: () => void
}

function ConseilsTab({ colors, items, unreadCount, onMarkAsRead, onDismiss, onMarkAllRead, onAction, refreshing, onRefresh }: ConseilsTabProps) {
  const alerts = items.filter((i) => i.type === 'alert')
  const analyses = items.filter((i) => i.type === 'analysis')
  const tips = items.filter((i) => i.type === 'tip')
  const celebrations = items.filter((i) => i.type === 'celebration')

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent.primary} />
      }
    >
      {/* Header action */}
      {unreadCount > 0 && (
        <Pressable onPress={onMarkAllRead} style={[styles.markAllButton, { backgroundColor: `${colors.accent.primary}10` }]}>
          <Check size={16} color={colors.accent.primary} />
          <Text style={[styles.markAllText, { color: colors.accent.primary }]}>Tout marquer comme lu</Text>
        </Pressable>
      )}

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Sparkles size={48} color={colors.text.tertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>Aucune notification</Text>
          <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
            Continue à tracker tes repas et ton bien-être pour recevoir des conseils personnalisés.
          </Text>
        </View>
      ) : (
        <>
          {/* Alertes */}
          {alerts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AlertTriangle size={16} color={colors.warning} />
                <Text style={[styles.sectionTitle, { color: colors.warning }]}>Alertes</Text>
              </View>
              {alerts.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onRead={() => onMarkAsRead(item.id)}
                  onDismiss={() => onDismiss(item.id)}
                  onAction={onAction}
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
                <Text style={[styles.sectionTitle, { color: colors.success }]}>Félicitations</Text>
              </View>
              {celebrations.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onRead={() => onMarkAsRead(item.id)}
                  onDismiss={() => onDismiss(item.id)}
                  onAction={onAction}
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
                <Text style={[styles.sectionTitle, { color: colors.secondary.primary }]}>Analyses</Text>
              </View>
              {analyses.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onRead={() => onMarkAsRead(item.id)}
                  onDismiss={() => onDismiss(item.id)}
                  onAction={onAction}
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
                <Text style={[styles.sectionTitle, { color: colors.accent.primary }]}>Conseils</Text>
              </View>
              {tips.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onRead={() => onMarkAsRead(item.id)}
                  onDismiss={() => onDismiss(item.id)}
                  onAction={onAction}
                  colors={colors}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

// ============= BIEN-ÊTRE TAB =============

interface BienetreTabProps {
  colors: ReturnType<typeof useTheme>['colors']
}

function BienetreTab({ colors }: BienetreTabProps) {
  const wellnessStore = useWellnessStore()
  const { updateWaterIntake } = useMealsStore()
  const todayEntry = wellnessStore.getTodayEntry?.() || {}
  const { getTodayData } = useMealsStore()
  const todayData = getTodayData()

  const handleWellnessUpdate = (field: string, value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    wellnessStore.updateEntry(new Date().toISOString().split('T')[0], { [field]: value })
  }

  const hydrationProgress = Math.min((todayData.hydration / 2500) * 100, 100)

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Hydratation */}
      <View style={[styles.wellnessCard, { backgroundColor: colors.bg.elevated }]}>
        <LinearGradient
          colors={['rgba(56, 189, 248, 0.08)', 'rgba(14, 165, 233, 0.04)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.wellnessCardGradient}
        >
          <View style={styles.wellnessCardHeader}>
            <View style={styles.wellnessCardHeaderLeft}>
              <LinearGradient
                colors={['#38BDF8', '#0EA5E9']}
                style={styles.wellnessIconGradient}
              >
                <Droplets size={20} color="#FFFFFF" />
              </LinearGradient>
              <View>
                <Text style={[styles.wellnessCardTitle, { color: colors.text.primary }]}>Hydratation</Text>
                <Text style={[styles.wellnessCardSubtitle, { color: colors.text.tertiary }]}>
                  {(todayData.hydration / 1000).toFixed(1)}L / 2,5L
                </Text>
              </View>
            </View>
            <Text style={[styles.wellnessPercent, { color: hydrationProgress >= 100 ? colors.success : colors.info }]}>
              {Math.round(hydrationProgress)}%
            </Text>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressBarBg, { backgroundColor: colors.border.light }]}>
            <LinearGradient
              colors={['#38BDF8', '#0EA5E9']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBarFill, { width: `${hydrationProgress}%` }]}
            />
          </View>

          {/* Quick add buttons */}
          <View style={styles.quickAddRow}>
            <TouchableOpacity
              style={[styles.quickAddButton, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                updateWaterIntake(250)
              }}
            >
              <Plus size={14} color="#0EA5E9" />
              <Text style={[styles.quickAddText, { color: '#0EA5E9' }]}>250ml</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAddButton, { backgroundColor: 'rgba(56, 189, 248, 0.25)' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                updateWaterIntake(500)
              }}
            >
              <Plus size={14} color="#0EA5E9" />
              <Text style={[styles.quickAddText, { color: '#0EA5E9', fontWeight: '700' }]}>500ml</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickAddButton, { backgroundColor: colors.bg.secondary }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                updateWaterIntake(-250)
              }}
            >
              <Minus size={14} color={colors.text.tertiary} />
              <Text style={[styles.quickAddText, { color: colors.text.tertiary }]}>250ml</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Sommeil */}
      <View style={[styles.wellnessCard, { backgroundColor: colors.bg.elevated }]}>
        <View style={styles.wellnessCardHeader}>
          <View style={styles.wellnessCardHeaderLeft}>
            <View style={[styles.wellnessIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
              <Moon size={20} color="#6366F1" />
            </View>
            <View>
              <Text style={[styles.wellnessCardTitle, { color: colors.text.primary }]}>Sommeil</Text>
              <Text style={[styles.wellnessCardSubtitle, { color: colors.text.tertiary }]}>
                Dernière nuit
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sleepInputRow}>
          <View style={styles.sleepHoursContainer}>
            <TouchableOpacity
              style={[styles.sleepButton, { backgroundColor: colors.bg.secondary }]}
              onPress={() => handleWellnessUpdate('sleepHours', Math.max(0, ((todayEntry as any).sleepHours || 7) - 0.5))}
            >
              <Minus size={16} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={[styles.sleepHoursText, { color: colors.text.primary }]}>
              {(todayEntry as any).sleepHours || 7}h
            </Text>
            <TouchableOpacity
              style={[styles.sleepButton, { backgroundColor: colors.bg.secondary }]}
              onPress={() => handleWellnessUpdate('sleepHours', ((todayEntry as any).sleepHours || 7) + 0.5)}
            >
              <Plus size={16} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.sleepQualityContainer}>
            <Text style={[styles.sleepQualityLabel, { color: colors.text.muted }]}>Qualité:</Text>
            {[1, 2, 3, 4, 5].map(q => (
              <TouchableOpacity
                key={q}
                style={[
                  styles.qualityButton,
                  { backgroundColor: colors.bg.secondary },
                  (todayEntry as any).sleepQuality === q && { backgroundColor: '#6366F1' }
                ]}
                onPress={() => handleWellnessUpdate('sleepQuality', q)}
              >
                <Text style={[
                  styles.qualityButtonText,
                  { color: colors.text.secondary },
                  (todayEntry as any).sleepQuality === q && { color: '#FFFFFF' }
                ]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Humeur, Stress, Énergie */}
      <View style={[styles.wellnessCard, { backgroundColor: colors.bg.elevated }]}>
        <View style={styles.wellnessCardHeader}>
          <View style={styles.wellnessCardHeaderLeft}>
            <View style={[styles.wellnessIcon, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
              <Smile size={20} color="#EC4899" />
            </View>
            <Text style={[styles.wellnessCardTitle, { color: colors.text.primary }]}>Comment te sens-tu ?</Text>
          </View>
        </View>

        {/* Humeur */}
        <View style={styles.checkinRow}>
          <Text style={[styles.checkinLabel, { color: colors.text.secondary }]}>Humeur</Text>
          <View style={styles.checkinOptions}>
            {[1, 2, 3, 4, 5].map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.checkinOption,
                  { backgroundColor: colors.bg.secondary },
                  (todayEntry as any).moodLevel === level && styles.checkinOptionActive
                ]}
                onPress={() => handleWellnessUpdate('moodLevel', level)}
              >
                <Text style={styles.checkinEmoji}>{moodEmojis[level - 1]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.checkinDivider, { backgroundColor: colors.border.light }]} />

        {/* Stress */}
        <View style={styles.checkinRow}>
          <Text style={[styles.checkinLabel, { color: colors.text.secondary }]}>Stress</Text>
          <View style={styles.checkinOptions}>
            {[1, 2, 3, 4, 5].map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.checkinOption,
                  { backgroundColor: colors.bg.secondary },
                  (todayEntry as any).stressLevel === level && styles.checkinOptionActive
                ]}
                onPress={() => handleWellnessUpdate('stressLevel', level)}
              >
                <Text style={styles.checkinEmoji}>{stressEmojis[level - 1]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.checkinDivider, { backgroundColor: colors.border.light }]} />

        {/* Énergie */}
        <View style={styles.checkinRow}>
          <Text style={[styles.checkinLabel, { color: colors.text.secondary }]}>Énergie</Text>
          <View style={styles.checkinOptions}>
            {[1, 2, 3, 4, 5].map(level => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.checkinOption,
                  { backgroundColor: colors.bg.secondary },
                  (todayEntry as any).energyLevel === level && styles.checkinOptionActive
                ]}
                onPress={() => handleWellnessUpdate('energyLevel', level)}
              >
                <Text style={styles.checkinEmoji}>{energyEmojis[level - 1]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Wellness Score */}
      <View style={[styles.wellnessScoreCard, { backgroundColor: colors.bg.elevated }]}>
        <LinearGradient
          colors={['rgba(16, 185, 129, 0.1)', 'rgba(5, 150, 105, 0.05)']}
          style={styles.wellnessScoreGradient}
        >
          <View style={styles.wellnessScoreContent}>
            <View>
              <Text style={[styles.wellnessScoreLabel, { color: colors.text.tertiary }]}>Score bien-être</Text>
              <Text style={[styles.wellnessScoreValue, { color: colors.success }]}>
                {wellnessStore.getWellnessScore?.() || 0}/100
              </Text>
            </View>
            <View style={[styles.wellnessScoreIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Heart size={24} color={colors.success} />
            </View>
          </View>
        </LinearGradient>
      </View>
    </ScrollView>
  )
}

// ============= MÉDITATIONS TAB =============

interface MeditationsTabProps {
  colors: ReturnType<typeof useTheme>['colors']
}

function MeditationsTab({ colors }: MeditationsTabProps) {
  const navigation = useNavigation()
  const { totalMeditationMinutes, sessionsCompleted } = useMeditationStore()

  const handleOpenMeditations = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore
    navigation.navigate('MeditationList')
  }

  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Programme méditation */}
      <TouchableOpacity
        style={styles.meditationMainCard}
        onPress={handleOpenMeditations}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.meditationGradient}
        >
          <View style={styles.meditationHeader}>
            <View style={styles.meditationIconContainer}>
              <Headphones size={32} color="#FFFFFF" />
            </View>
            <View style={styles.meditationHeaderInfo}>
              <Text style={styles.meditationTitle}>Méditations Guidées</Text>
              <Text style={styles.meditationSubtitle}>
                Programme de 8 semaines
              </Text>
            </View>
            <ChevronRight size={24} color="rgba(255,255,255,0.7)" />
          </View>

          {/* Progress dots */}
          <View style={styles.meditationProgress}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => {
              const isCompleted = sessionsCompleted >= week
              return (
                <View
                  key={week}
                  style={[
                    styles.meditationDot,
                    isCompleted && styles.meditationDotCompleted,
                  ]}
                >
                  {isCompleted && <Check size={12} color="#FFFFFF" />}
                </View>
              )
            })}
          </View>

          {/* Stats */}
          <View style={styles.meditationStats}>
            <View style={styles.meditationStat}>
              <Text style={styles.meditationStatValue}>{sessionsCompleted}/8</Text>
              <Text style={styles.meditationStatLabel}>sessions</Text>
            </View>
            <View style={styles.meditationStatDivider} />
            <View style={styles.meditationStat}>
              <Text style={styles.meditationStatValue}>{Math.round(totalMeditationMinutes)}</Text>
              <Text style={styles.meditationStatLabel}>minutes</Text>
            </View>
            <View style={styles.meditationStatDivider} />
            <View style={styles.meditationStat}>
              <Text style={styles.meditationStatValue}>{sessionsCompleted > 0 ? '🧘' : '▶️'}</Text>
              <Text style={styles.meditationStatLabel}>{sessionsCompleted > 0 ? 'en cours' : 'commencer'}</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Respiration rapide */}
      <View style={[styles.breathingCard, { backgroundColor: colors.bg.elevated }]}>
        <View style={styles.breathingHeader}>
          <View style={[styles.breathingIcon, { backgroundColor: 'rgba(0, 119, 182, 0.15)' }]}>
            <Wind size={24} color={staticColors.accent.primary} />
          </View>
          <View style={styles.breathingInfo}>
            <Text style={[styles.breathingTitle, { color: colors.text.primary }]}>Respiration</Text>
            <Text style={[styles.breathingSubtitle, { color: colors.text.tertiary }]}>
              Cohérence cardiaque 5-5
            </Text>
          </View>
        </View>
        <Text style={[styles.breathingDescription, { color: colors.text.secondary }]}>
          5 minutes pour équilibrer ton système nerveux et réduire le stress.
        </Text>
        <TouchableOpacity
          style={[styles.breathingButton, { backgroundColor: staticColors.accent.primary }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            // @ts-ignore
            navigation.navigate('WellnessProgram')
          }}
        >
          <Text style={styles.breathingButtonText}>Commencer</Text>
        </TouchableOpacity>
      </View>

      {/* Tips */}
      <View style={[styles.meditationTips, { backgroundColor: colors.bg.secondary }]}>
        <Text style={[styles.tipsTitle, { color: colors.text.primary }]}>💡 Conseils</Text>
        <Text style={[styles.tipsText, { color: colors.text.secondary }]}>
          • Médite de préférence le matin ou avant de dormir{'\n'}
          • Trouve un endroit calme sans distractions{'\n'}
          • Utilise des écouteurs pour une meilleure immersion{'\n'}
          • La régularité compte plus que la durée
        </Text>
      </View>
    </ScrollView>
  )
}

// ============= MAIN COMPONENT =============

export default function CoachScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const [activeTab, setActiveTab] = useState<TabKey>('conseils')
  const [refreshing, setRefreshing] = useState(false)
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current

  const { items, unreadCount, generateItemsWithAI, markAsRead, markAllAsRead, dismissItem, setContext } = useCoachStore()
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData } = useMealsStore()
  const wellnessStore = useWellnessStore()
  const { currentStreak, currentLevel, totalXP } = useGamificationStore()

  // Animate tab indicator
  useEffect(() => {
    const tabIndex = TABS.findIndex(t => t.key === activeTab)
    Animated.spring(tabIndicatorAnim, {
      toValue: tabIndex,
      useNativeDriver: true,
      tension: 300,
      friction: 30,
    }).start()
  }, [activeTab])

  const handleAction = (route: string) => {
    // @ts-ignore
    navigation.navigate(route)
  }

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
      cookingLevel: profile?.cookingPreferences?.level,
      weekdayTime: profile?.cookingPreferences?.weekdayTime,
      weekendTime: profile?.cookingPreferences?.weekendTime,
      batchCooking: profile?.cookingPreferences?.batchCooking,
      quickMealsOnly: profile?.cookingPreferences?.quickMealsOnly,
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

    await generateItemsWithAI()
  }, [profile, nutritionGoals, getTodayData, wellnessStore, currentStreak, currentLevel, totalXP, setContext, generateItemsWithAI])

  useEffect(() => {
    updateContext()
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    useCoachStore.setState({ lastGeneratedAt: null })
    await updateContext()
    setRefreshing(false)
  }, [updateContext])

  const handleMarkAllRead = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    markAllAsRead()
  }

  const handleTabPress = (tab: TabKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActiveTab(tab)
  }

  const tabWidth = (SCREEN_WIDTH - spacing.lg * 2) / TABS.length

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
              Ton accompagnement personnalisé
            </Text>
          </View>
        </View>
        {unreadCount > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.bg.primary }]}>
        <View style={[styles.tabsBackground, { backgroundColor: colors.bg.secondary }]}>
          <Animated.View
            style={[
              styles.tabIndicator,
              { backgroundColor: colors.accent.primary },
              {
                width: tabWidth - 8,
                transform: [{
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [4, tabWidth + 4, tabWidth * 2 + 4],
                  }),
                }],
              },
            ]}
          />
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <Pressable
                key={tab.key}
                style={styles.tab}
                onPress={() => handleTabPress(tab.key)}
              >
                <Icon
                  size={18}
                  color={isActive ? '#FFFFFF' : colors.text.tertiary}
                />
                <Text style={[
                  styles.tabLabel,
                  { color: isActive ? '#FFFFFF' : colors.text.tertiary },
                ]}>
                  {tab.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Content */}
      {activeTab === 'conseils' && (
        <ConseilsTab
          colors={colors}
          items={items}
          unreadCount={unreadCount}
          onMarkAsRead={markAsRead}
          onDismiss={dismissItem}
          onMarkAllRead={handleMarkAllRead}
          onAction={handleAction}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
      {activeTab === 'bienetre' && <BienetreTab colors={colors} />}
      {activeTab === 'meditations' && <MeditationsTab colors={colors} />}
    </SafeAreaView>
  )
}

// ============= STYLES =============

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
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Tabs
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  tabsBackground: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: radius.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    zIndex: 1,
  },
  tabLabel: {
    ...typography.sm,
    fontWeight: '600',
  },

  // Tab content
  tabContent: {
    flex: 1,
  },
  tabContentContainer: {
    padding: spacing.lg,
    paddingBottom: 100,
  },

  // Mark all button
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  markAllText: {
    ...typography.sm,
    fontWeight: '600',
  },

  // Sections
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

  // Item card
  itemCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dismissButton: {
    padding: spacing.xs,
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

  // Empty state
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

  // Wellness cards
  wellnessCard: {
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  wellnessCardGradient: {
    padding: spacing.lg,
  },
  wellnessCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  wellnessCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  wellnessIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wellnessIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wellnessCardTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  wellnessCardSubtitle: {
    ...typography.sm,
  },
  wellnessPercent: {
    ...typography.h3,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  quickAddRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickAddButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  quickAddText: {
    ...typography.sm,
    fontWeight: '600',
  },

  // Sleep
  sleepInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  sleepHoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sleepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepHoursText: {
    ...typography.h3,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'center',
  },
  sleepQualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sleepQualityLabel: {
    ...typography.sm,
    marginRight: spacing.xs,
  },
  qualityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityButtonText: {
    ...typography.sm,
    fontWeight: '600',
  },

  // Checkin
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  checkinDivider: {
    height: 1,
    marginHorizontal: spacing.lg,
  },
  checkinLabel: {
    ...typography.bodyMedium,
  },
  checkinOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  checkinOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinOptionActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  checkinEmoji: {
    fontSize: 20,
  },

  // Wellness score
  wellnessScoreCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  wellnessScoreGradient: {
    padding: spacing.lg,
  },
  wellnessScoreContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wellnessScoreLabel: {
    ...typography.sm,
  },
  wellnessScoreValue: {
    ...typography.h2,
    fontWeight: '700',
  },
  wellnessScoreIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Meditation
  meditationMainCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  meditationGradient: {
    padding: spacing.lg,
  },
  meditationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  meditationIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  meditationHeaderInfo: {
    flex: 1,
  },
  meditationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  meditationSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  meditationProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  meditationDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meditationDotCompleted: {
    backgroundColor: '#10B981',
  },
  meditationStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  meditationStat: {
    alignItems: 'center',
    flex: 1,
  },
  meditationStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  meditationStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  meditationStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  // Breathing card
  breathingCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  breathingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  breathingIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  breathingInfo: {
    flex: 1,
  },
  breathingTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  breathingSubtitle: {
    ...typography.sm,
  },
  breathingDescription: {
    ...typography.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  breathingButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  breathingButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Tips
  meditationTips: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  tipsTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  tipsText: {
    ...typography.sm,
    lineHeight: 22,
  },
})
