/**
 * Mock Personalized Tracking Preview for Onboarding
 *
 * Shows a personalized dashboard preview with user-specific data.
 * Used in onboarding "Fait pour toi" screen.
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { Sparkles, Target, Flame, TrendingUp, Heart } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius } from '../../constants/theme'

const { width } = Dimensions.get('window')

export function MockHomePreview() {
  const { colors } = useTheme()
  const accent = colors.nutrients.fats

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Profile Header */}
      <View style={[styles.profileCard, { backgroundColor: `${accent}15` }]}>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: accent }]}>
            <Text style={styles.avatarText}>M</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text.primary }]}>Marie, 28 ans</Text>
            <Text style={[styles.profileGoal, { color: accent }]}>Objectif : Perdre 5kg</Text>
          </View>
          <View style={[styles.levelBadge, { backgroundColor: accent }]}>
            <Sparkles size={12} color="#FFFFFF" />
            <Text style={styles.levelText}>Pro</Text>
          </View>
        </View>
      </View>

      {/* Personalized Stats */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.accent.light }]}>
            <Target size={18} color={colors.accent.primary} />
          </View>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>1 850</Text>
          <Text style={[styles.statLabel, { color: colors.text.muted }]}>kcal/jour</Text>
          <Text style={[styles.statNote, { color: colors.accent.primary }]}>Adapté à toi</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.bg.elevated }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.success + '20' }]}>
            <TrendingUp size={18} color={colors.success} />
          </View>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>-2.3</Text>
          <Text style={[styles.statLabel, { color: colors.text.muted }]}>kg ce mois</Text>
          <Text style={[styles.statNote, { color: colors.success }]}>En bonne voie</Text>
        </View>
      </View>

      {/* Coach AI Card */}
      <View style={[styles.coachCard, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
        <View style={styles.coachHeader}>
          <View style={[styles.coachAvatar, { backgroundColor: accent }]}>
            <Text style={styles.coachEmoji}>🤖</Text>
          </View>
          <View style={styles.coachInfo}>
            <Text style={[styles.coachName, { color: accent }]}>Coach LymIA</Text>
            <Text style={[styles.coachStatus, { color: colors.text.muted }]}>Conseil personnalisé</Text>
          </View>
        </View>
        <Text style={[styles.coachMessage, { color: colors.text.primary }]}>
          "Marie, je vois que tu préfères les repas rapides en semaine. Voici 3 recettes de 15 min riches en protéines pour ce soir !"
        </Text>
      </View>

      {/* Preferences Tags */}
      <View style={styles.preferencesSection}>
        <Text style={[styles.preferencesTitle, { color: colors.text.secondary }]}>Tes préférences</Text>
        <View style={styles.tagsContainer}>
          <View style={[styles.tag, { backgroundColor: colors.accent.light }]}>
            <Text style={[styles.tagText, { color: colors.accent.primary }]}>Sans lactose</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: colors.success + '20' }]}>
            <Text style={[styles.tagText, { color: colors.success }]}>Batch cooking</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: `${accent}20` }]}>
            <Text style={[styles.tagText, { color: accent }]}>Végétarien</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: colors.warning + '20' }]}>
            <Text style={[styles.tagText, { color: colors.warning }]}>15 min max</Text>
          </View>
        </View>
      </View>

      {/* Weekly Progress Mini */}
      <View style={[styles.weeklyCard, { backgroundColor: colors.bg.elevated }]}>
        <View style={styles.weeklyHeader}>
          <Flame size={16} color={colors.warning} />
          <Text style={[styles.weeklyTitle, { color: colors.text.primary }]}>Cette semaine</Text>
        </View>
        <View style={styles.daysRow}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
            <View key={i} style={styles.dayItem}>
              <View style={[
                styles.dayDot,
                { backgroundColor: i < 5 ? colors.success : colors.border.light }
              ]}>
                {i < 5 && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.dayLabel, { color: colors.text.muted }]}>{day}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.streakText, { color: colors.warning }]}>
          🔥 5 jours consécutifs !
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  profileCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  profileName: {
    ...typography.bodyMedium,
  },
  profileGoal: {
    ...typography.caption,
    marginTop: 2,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 4,
  },
  levelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
  },
  statNote: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  coachCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachEmoji: {
    fontSize: 16,
  },
  coachInfo: {
    marginLeft: spacing.sm,
  },
  coachName: {
    ...typography.captionMedium,
  },
  coachStatus: {
    fontSize: 10,
  },
  coachMessage: {
    ...typography.small,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  preferencesSection: {
    marginBottom: spacing.sm,
  },
  preferencesTitle: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  weeklyCard: {
    borderRadius: radius.md,
    padding: spacing.md,
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  weeklyTitle: {
    ...typography.captionMedium,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dayItem: {
    alignItems: 'center',
    gap: 4,
  },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dayLabel: {
    fontSize: 10,
  },
  streakText: {
    ...typography.captionMedium,
    textAlign: 'center',
  },
})

export default MockHomePreview
