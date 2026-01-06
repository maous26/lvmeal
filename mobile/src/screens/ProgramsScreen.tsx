/**
 * ProgramsScreen - Hub des programmes de transformation
 * Design: Organic Luxury - Vert Mousse & Terre Cuite
 *
 * Affiche les programmes disponibles selon le profil utilisateur :
 * - Boost Métabolique (12 semaines)
 * - Bien-être (8 semaines, inclut méditation)
 */

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import {
  Zap,
  Heart,
  ChevronRight,
  Clock,
  Target,
  Sparkles,
  CheckCircle2,
  Lock,
  Play,
  Leaf,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { useTheme } from '../contexts/ThemeContext'
import { GlassCard } from '../components/ui/GlassCard'
import { spacing, typography, radius, shadows, organicPalette, fonts } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import { useMetabolicBoostStore } from '../stores/metabolic-boost-store'
import { useWellnessProgramStore } from '../stores/wellness-program-store'

// Organic color palette for programs
const PROGRAM_COLORS = {
  metabolic: {
    gradient: ['#E2DCCA', '#D4A574', '#C87863'] as const, // Sable -> Caramel -> Terre Cuite
    accent: '#C87863',      // Terre Cuite
    accentLight: 'rgba(200, 120, 99, 0.15)',
    icon: '#B56A56',
  },
  wellness: {
    gradient: ['#EDF3EC', '#B8CBB4', '#7A9E7E'] as const, // Vert pâle -> Mousse désaturé -> Sauge
    accent: '#4A6741',      // Mousse
    accentLight: 'rgba(74, 103, 65, 0.15)',
    icon: '#4A6741',
  },
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function ProgramsScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const { profile } = useUserStore()

  const {
    isEnrolled: isMetabolicEnrolled,
    currentPhase: metabolicPhase,
    currentWeek: metabolicWeek,
    getProgressPercentage: getMetabolicProgress,
    enroll: enrollMetabolic,
  } = useMetabolicBoostStore()

  const {
    isEnrolled: isWellnessEnrolled,
    currentPhase: wellnessPhase,
    currentWeek: wellnessWeek,
    getProgressPercentage: getWellnessProgress,
    enroll: enrollWellness,
  } = useWellnessProgramStore()

  // Tous les programmes sont accessibles à tous (cohabitation possible)
  const isEligibleForMetabolic = true
  const isEligibleForWellness = true

  const metabolicProgress = getMetabolicProgress()
  const wellnessProgress = getWellnessProgress()

  const handleProgramPress = (program: 'metabolic' | 'wellness') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    if (program === 'metabolic') {
      // @ts-ignore
      navigation.navigate('MetabolicBoost')
    } else {
      // @ts-ignore
      navigation.navigate('WellnessProgram')
    }
  }

  const handleEnroll = (program: 'metabolic' | 'wellness') => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    if (program === 'metabolic') {
      enrollMetabolic()
    } else {
      enrollWellness()
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Programmes
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Transforme ton corps et ton esprit
          </Text>
        </View>

        {/* Metabolic Boost Program - Organic Luxury Design */}
        <GlassCard style={styles.programCard} variant="elevated" delay={100} noPadding>
          <LinearGradient
            colors={PROGRAM_COLORS.metabolic.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.programBanner}
          >
            <View style={[styles.programIcon, { backgroundColor: 'rgba(255, 255, 255, 0.85)' }]}>
              <Zap size={32} color={PROGRAM_COLORS.metabolic.icon} />
            </View>
            {isMetabolicEnrolled && (
              <View style={[styles.progressBadge, { backgroundColor: PROGRAM_COLORS.metabolic.accent }]}>
                <Text style={styles.progressBadgeText}>{Math.round(metabolicProgress)}%</Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.programContent}>
            <View style={styles.programHeader}>
              <Text style={[styles.programTitle, { color: colors.text.primary }]}>
                Boost Métabolique
              </Text>
              {isMetabolicEnrolled && (
                <View style={[styles.activeBadge, { backgroundColor: PROGRAM_COLORS.metabolic.accentLight }]}>
                  <Text style={[styles.activeBadgeText, { color: PROGRAM_COLORS.metabolic.accent }]}>Actif</Text>
                </View>
              )}
            </View>

            <Text style={[styles.programDescription, { color: colors.text.secondary }]}>
              Relance ton métabolisme en douceur avec un programme progressif de 12 semaines.
            </Text>

            <View style={styles.programMeta}>
              <View style={styles.metaItem}>
                <Clock size={14} color={colors.text.muted} />
                <Text style={[styles.metaText, { color: colors.text.muted }]}>12 semaines</Text>
              </View>
              <View style={styles.metaItem}>
                <Target size={14} color={colors.text.muted} />
                <Text style={[styles.metaText, { color: colors.text.muted }]}>4 phases</Text>
              </View>
            </View>

            {isMetabolicEnrolled ? (
              <TouchableOpacity
                style={[styles.programButton, { backgroundColor: PROGRAM_COLORS.metabolic.accent }]}
                onPress={() => handleProgramPress('metabolic')}
              >
                <Play size={16} color="#FFFFFF" />
                <Text style={styles.programButtonText}>
                  Continuer · Semaine {metabolicWeek}
                </Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : isEligibleForMetabolic ? (
              <TouchableOpacity
                style={[styles.programButton, { backgroundColor: PROGRAM_COLORS.metabolic.accent }]}
                onPress={() => handleEnroll('metabolic')}
              >
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.programButtonText}>Commencer le programme</Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <View style={[styles.programButton, { backgroundColor: colors.bg.tertiary }]}>
                <Lock size={16} color={colors.text.muted} />
                <Text style={[styles.programButtonText, { color: colors.text.muted }]}>
                  Recommandé si métabolisme adaptatif
                </Text>
              </View>
            )}
          </View>
        </GlassCard>

        {/* Wellness Program - Organic Luxury Design */}
        <GlassCard style={styles.programCard} variant="elevated" delay={200} noPadding>
          <LinearGradient
            colors={PROGRAM_COLORS.wellness.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.programBanner}
          >
            <View style={[styles.programIcon, { backgroundColor: 'rgba(255, 255, 255, 0.85)' }]}>
              <Leaf size={32} color={PROGRAM_COLORS.wellness.icon} />
            </View>
            {isWellnessEnrolled && (
              <View style={[styles.progressBadge, { backgroundColor: PROGRAM_COLORS.wellness.accent }]}>
                <Text style={styles.progressBadgeText}>{Math.round(wellnessProgress)}%</Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.programContent}>
            <View style={styles.programHeader}>
              <Text style={[styles.programTitle, { color: colors.text.primary }]}>
                Bien-être
              </Text>
              {isWellnessEnrolled && (
                <View style={[styles.activeBadge, { backgroundColor: PROGRAM_COLORS.wellness.accentLight }]}>
                  <Text style={[styles.activeBadgeText, { color: PROGRAM_COLORS.wellness.accent }]}>Actif</Text>
                </View>
              )}
            </View>

            <Text style={[styles.programDescription, { color: colors.text.secondary }]}>
              Équilibre corps et esprit avec méditations guidées, gestion du stress et suivi bien-être.
            </Text>

            <View style={styles.programMeta}>
              <View style={styles.metaItem}>
                <Clock size={14} color={colors.text.muted} />
                <Text style={[styles.metaText, { color: colors.text.muted }]}>8 semaines</Text>
              </View>
              <View style={styles.metaItem}>
                <Target size={14} color={colors.text.muted} />
                <Text style={[styles.metaText, { color: colors.text.muted }]}>Méditation incluse</Text>
              </View>
            </View>

            {isWellnessEnrolled ? (
              <TouchableOpacity
                style={[styles.programButton, { backgroundColor: PROGRAM_COLORS.wellness.accent }]}
                onPress={() => handleProgramPress('wellness')}
              >
                <Play size={16} color="#FFFFFF" />
                <Text style={styles.programButtonText}>
                  Continuer · Semaine {wellnessWeek}
                </Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.programButton, { backgroundColor: PROGRAM_COLORS.wellness.accent }]}
                onPress={() => handleEnroll('wellness')}
              >
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.programButtonText}>Commencer le programme</Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>

        {/* Info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.bg.secondary }]}>
          <CheckCircle2 size={20} color={colors.success} />
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            Tu peux suivre plusieurs programmes en parallèle
          </Text>
        </View>

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
  title: {
    ...typography.h1,
    fontFamily: fonts.serif.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
  },
  programCard: {
    marginBottom: spacing.lg,
    // GlassCard handles borderRadius and overflow
  },
  programBanner: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  programIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  progressBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  programContent: {
    padding: spacing.lg,
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  programTitle: {
    ...typography.h2,
    fontFamily: fonts.serif.semibold,
  },
  activeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  programDescription: {
    ...typography.body,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  programMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.caption,
  },
  programButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  programButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    flex: 1,
  },
  bottomSpacer: {
    height: 40,
  },
})
