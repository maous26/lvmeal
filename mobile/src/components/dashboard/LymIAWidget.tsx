/**
 * LymIA Widget - Affiche les derniers conseils/alertes sur la HomePage
 *
 * Se connecte au coach-store pour afficher les notifications proactives.
 * Lien vers l'onglet Coach pour voir tous les détails.
 */

import React, { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import {
  Sparkles,
  Bot,
  ChevronRight,
  Lightbulb,
  BarChart3,
  Bell,
  PartyPopper,
  Apple,
  Moon,
  Flame,
  Droplets,
  Heart,
  Brain,
  Trophy,
  Dumbbell,
  ChefHat,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { colors, radius, spacing, typography } from '../../constants/theme'
import { useCoachStore, type CoachItem, type CoachItemType, type CoachItemCategory } from '../../stores/coach-store'
import { useUserStore } from '../../stores/user-store'
import { useMealsStore } from '../../stores/meals-store'
import { useWellnessStore } from '../../stores/wellness-store'
import { useGamificationStore } from '../../stores/gamification-store'

// Configuration des icônes par type
const typeIcons: Record<CoachItemType, typeof Lightbulb> = {
  tip: Lightbulb,
  analysis: BarChart3,
  alert: Bell,
  celebration: PartyPopper,
}

const typeColors: Record<CoachItemType, string> = {
  tip: colors.accent.primary,
  analysis: colors.secondary.primary,
  alert: colors.warning,
  celebration: colors.success,
}

// Configuration par catégorie
const categoryIcons: Record<CoachItemCategory, typeof Apple> = {
  nutrition: Apple,
  metabolism: Flame,
  wellness: Heart,
  sport: Dumbbell,
  hydration: Droplets,
  sleep: Moon,
  stress: Brain,
  progress: Trophy,
  cooking: ChefHat,
}

export function LymIAWidget() {
  const navigation = useNavigation()
  const { items, unreadCount, generateItems, setContext, markAsRead } = useCoachStore()
  const { profile, nutritionGoals } = useUserStore()
  const { getTodayData } = useMealsStore()
  const wellnessStore = useWellnessStore()
  const { currentStreak, currentLevel } = useGamificationStore()

  // Mettre à jour le contexte au montage
  useEffect(() => {
    if (!profile) return

    const todayData = getTodayData()
    const todayNutrition = todayData.totalNutrition
    const todayWellness = wellnessStore.getTodayEntry?.() || {}

    setContext({
      firstName: profile.firstName,
      goal: profile.goal,
      dietType: profile.dietType,
      allergies: profile.allergies,
      weight: profile.weight,
      // Cooking preferences
      cookingLevel: profile.cookingPreferences?.level,
      weekdayTime: profile.cookingPreferences?.weekdayTime,
      weekendTime: profile.cookingPreferences?.weekendTime,
      batchCooking: profile.cookingPreferences?.batchCooking,
      quickMealsOnly: profile.cookingPreferences?.quickMealsOnly,
      // Nutrition
      caloriesConsumed: todayNutrition.calories,
      caloriesTarget: nutritionGoals?.calories,
      proteinConsumed: todayNutrition.proteins,
      proteinTarget: Math.round((profile.weight || 70) * 1.6),
      waterConsumed: (todayWellness as { water?: number }).water || 0,
      waterTarget: 2000,
      sleepHours: (todayWellness as { sleepHours?: number }).sleepHours,
      stressLevel: (todayWellness as { stressLevel?: number }).stressLevel,
      energyLevel: (todayWellness as { energyLevel?: number }).energyLevel,
      streak: currentStreak,
      level: currentLevel,
    })

    generateItems()
  }, [profile, nutritionGoals, currentStreak, currentLevel])

  const handleOpenCoach = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore
    navigation.navigate('Coach')
  }

  const handleItemPress = (item: CoachItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!item.isRead) {
      markAsRead(item.id)
    }
    // @ts-ignore
    navigation.navigate('Coach')
  }

  // Prendre les 2 items les plus importants non lus, ou les plus récents
  const topItems = items
    .filter(i => !i.isRead || items.filter(x => !x.isRead).length < 2)
    .slice(0, 2)

  const getItemStyle = (type: CoachItemType) => {
    const color = typeColors[type]
    return {
      backgroundColor: `${color}10`,
      borderColor: `${color}30`,
    }
  }

  if (!profile) return null

  return (
    <View style={styles.container}>
      {/* Header */}
      <Pressable style={styles.header} onPress={handleOpenCoach}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: colors.accent.primary }]}>
            <Bot size={16} color={colors.bg.elevated} />
          </View>
          <Text style={styles.headerTitle}>LymIA Coach</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.seeAllLink}>Tout voir</Text>
          <ChevronRight size={16} color={colors.accent.primary} />
        </View>
      </Pressable>

      {/* Items */}
      {topItems.length > 0 ? (
        <View style={styles.items}>
          {topItems.map((item) => {
            const TypeIcon = typeIcons[item.type]
            const CatIcon = categoryIcons[item.category]
            const itemColor = typeColors[item.type]

            return (
              <Pressable
                key={item.id}
                style={[styles.itemCard, getItemStyle(item.type)]}
                onPress={() => handleItemPress(item)}
              >
                <View style={styles.itemHeader}>
                  <View style={[styles.typeIcon, { backgroundColor: `${itemColor}20` }]}>
                    <TypeIcon size={14} color={itemColor} />
                  </View>
                  <Text style={[styles.typeLabel, { color: itemColor }]}>
                    {item.type === 'tip' ? 'Conseil' :
                     item.type === 'analysis' ? 'Analyse' :
                     item.type === 'alert' ? 'Alerte' : 'Bravo'}
                  </Text>
                  {!item.isRead && <View style={styles.unreadDot} />}
                </View>

                <View style={styles.itemContent}>
                  <View style={styles.catIcon}>
                    <CatIcon size={16} color={colors.text.secondary} />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.itemMessage} numberOfLines={2}>{item.message}</Text>
                  </View>
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : (
        <Pressable style={styles.emptyState} onPress={handleOpenCoach}>
          <Sparkles size={20} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>
            Continue à tracker pour recevoir des conseils personnalisés
          </Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  seeAllLink: {
    ...typography.sm,
    color: colors.accent.primary,
  },
  items: {
    gap: spacing.sm,
  },
  itemCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.primary,
  },
  itemContent: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  catIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.bg.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    ...typography.sm,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  itemMessage: {
    ...typography.xs,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.secondary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  emptyText: {
    ...typography.sm,
    color: colors.text.tertiary,
    flex: 1,
  },
})

export default LymIAWidget
