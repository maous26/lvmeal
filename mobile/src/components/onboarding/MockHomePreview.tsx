/**
 * MockHomePreview - iOS-style personalized dashboard preview
 *
 * Shows a clean, minimal preview of personalized features.
 * Used in onboarding "Fait pour toi" slide.
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
} from 'react-native'
import { Sparkles, Target, TrendingUp, Flame, Check } from 'lucide-react-native'
import { useTheme } from '../../contexts/ThemeContext'
import { spacing, typography, radius, fonts } from '../../constants/theme'

export function MockHomePreview() {
  const { colors } = useTheme()
  const purple = '#AF52DE' // Apple Purple - matches the slide

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Profile Header */}
      <View style={[styles.profileCard, { backgroundColor: colors.bg.secondary }]}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: purple }]}>
            <Text style={styles.avatarText}>M</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text.primary }]}>Marie, 28 ans</Text>
            <Text style={[styles.profileGoal, { color: colors.text.tertiary }]}>Objectif : -5kg</Text>
          </View>
          <View style={[styles.proBadge, { backgroundColor: purple }]}>
            <Sparkles size={10} color="#FFFFFF" />
            <Text style={styles.proText}>Pro</Text>
          </View>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.bg.secondary }]}>
          <View style={[styles.statIcon, { backgroundColor: '#1D1D1F' + '20' }]}>
            <Target size={16} color="#1D1D1F" />
          </View>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>1 850</Text>
          <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>kcal/jour</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.bg.secondary }]}>
          <View style={[styles.statIcon, { backgroundColor: '#1D1D1F' + '20' }]}>
            <TrendingUp size={16} color="#1D1D1F" />
          </View>
          <Text style={[styles.statValue, { color: colors.text.primary }]}>-2.3</Text>
          <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>kg ce mois</Text>
        </View>
      </View>

      {/* AI Coach Message */}
      <View style={[styles.coachCard, { backgroundColor: purple + '12', borderColor: purple + '30' }]}>
        <View style={styles.coachHeader}>
          <View style={[styles.coachIcon, { backgroundColor: purple }]}>
            <Text style={styles.coachEmoji}>🤖</Text>
          </View>
          <View>
            <Text style={[styles.coachTitle, { color: purple }]}>Coach LymIA</Text>
            <Text style={[styles.coachSub, { color: colors.text.muted }]}>Conseil personnalisé</Text>
          </View>
        </View>
        <Text style={[styles.coachText, { color: colors.text.secondary }]}>
          "Marie, voici 3 recettes rapides riches en protéines pour ce soir !"
        </Text>
      </View>

      {/* Tags */}
      <View style={styles.tagsSection}>
        <Text style={[styles.tagsTitle, { color: colors.text.tertiary }]}>Tes préférences</Text>
        <View style={styles.tagsRow}>
          {[
            { label: 'Sans lactose', color: '#1D1D1F' },
            { label: 'Végétarien', color: purple },
            { label: '15 min', color: '#FF9500' },
          ].map((tag, i) => (
            <View key={i} style={[styles.tag, { backgroundColor: tag.color + '15' }]}>
              <Text style={[styles.tagText, { color: tag.color }]}>{tag.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Weekly Progress */}
      <View style={[styles.weekCard, { backgroundColor: colors.bg.secondary }]}>
        <View style={styles.weekHeader}>
          <Flame size={14} color="#FF9500" />
          <Text style={[styles.weekTitle, { color: colors.text.primary }]}>Cette semaine</Text>
        </View>
        <View style={styles.daysRow}>
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
            <View key={i} style={styles.dayCol}>
              <View style={[
                styles.dayCircle,
                { backgroundColor: i < 5 ? '#1D1D1F' : colors.border.light }
              ]}>
                {i < 5 && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={[styles.dayText, { color: colors.text.muted }]}>{day}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.streakText, { color: '#FF9500' }]}>🔥 5 jours</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.sm,
  },
  profileCard: {
    borderRadius: radius.default,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fonts.sans.bold,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.sans.semibold,
  },
  profileGoal: {
    fontSize: 11,
    fontFamily: fonts.sans.regular,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.full,
    gap: 3,
  },
  proText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: fonts.sans.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.default,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.sans.bold,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: fonts.sans.regular,
  },
  coachCard: {
    borderRadius: radius.default,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  coachIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  coachEmoji: {
    fontSize: 12,
  },
  coachTitle: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans.semibold,
  },
  coachSub: {
    fontSize: 9,
    fontFamily: fonts.sans.regular,
  },
  coachText: {
    fontSize: 11,
    fontFamily: fonts.sans.regular,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  tagsSection: {
    marginBottom: spacing.sm,
  },
  tagsTitle: {
    fontSize: 10,
    fontFamily: fonts.sans.medium,
    marginBottom: spacing.xs,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: fonts.sans.medium,
  },
  weekCard: {
    borderRadius: radius.default,
    padding: spacing.sm,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  weekTitle: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans.semibold,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dayCol: {
    alignItems: 'center',
    gap: 2,
  },
  dayCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 9,
    fontFamily: fonts.sans.regular,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.sans.semibold,
    textAlign: 'center',
  },
})

export default MockHomePreview
