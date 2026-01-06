/**
 * MeditationListScreen - Liste des méditations disponibles
 */

import React, { useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft,
  Headphones,
  CheckCircle2,
  Cloud,
  ChevronRight,
  Lock,
  Flame,
  Clock,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius, fonts } from '../constants/theme'
import { useMeditationStore } from '../stores/meditation-store'
import { useWellnessProgramStore } from '../stores/wellness-program-store'
import { MEDITATION_SESSIONS, type MeditationSession } from '../services/meditation-tts-service'

const PHASE_COLORS: Record<string, readonly [string, string]> = {
  foundations: ['#10B981', '#059669'],
  awareness: ['#8B5CF6', '#7C3AED'],
  balance: ['#F59E0B', '#D97706'],
  harmony: ['#EC4899', '#DB2777'],
}

const PHASE_LABELS = {
  foundations: 'Fondations',
  awareness: 'Conscience',
  balance: 'Équilibre',
  harmony: 'Harmonie',
}

export default function MeditationListScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()

  const {
    cachedSessions,
    sessionProgress,
    totalMeditationMinutes,
    sessionsCompleted,
    currentStreak,
    initializeCache,
    getUnlockedSessions,
  } = useMeditationStore()

  const { currentWeek, isEnrolled } = useWellnessProgramStore()

  useEffect(() => {
    initializeCache()
  }, [initializeCache])

  // Débloquer les sessions selon la semaine du programme wellness
  const effectiveWeek = isEnrolled ? currentWeek : 8 // Tout débloqué si pas inscrit au programme
  const unlockedSessions = getUnlockedSessions(effectiveWeek)

  const handleSessionPress = (session: MeditationSession) => {
    const isUnlocked = unlockedSessions.some(s => s.id === session.id)
    if (!isUnlocked) {
      return // Session verrouillée
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore
    navigation.navigate('MeditationPlayer', { sessionId: session.id })
  }

  const isSessionCompleted = (sessionId: string) => {
    const progress = sessionProgress.find(p => p.sessionId === sessionId)
    return progress?.completedAt !== null && progress?.completedAt !== undefined
  }

  const isSessionCached = (sessionId: string) => {
    const cache = cachedSessions.find(c => c.sessionId === sessionId)
    return cache?.isCached || false
  }

  // Grouper les sessions par phase
  const sessionsByPhase = MEDITATION_SESSIONS.reduce((acc, session) => {
    if (!acc[session.phase]) {
      acc[session.phase] = []
    }
    acc[session.phase].push(session)
    return acc
  }, {} as Record<string, MeditationSession[]>)

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.light }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            Méditations
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.text.tertiary }]}>
            Programme 8 semaines
          </Text>
        </View>
        <View style={styles.headerIcon}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.headerIconGradient}
          >
            <Headphones size={20} color="#FFFFFF" />
          </LinearGradient>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.bg.elevated }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.accent.primary }]}>
              {Math.round(totalMeditationMinutes)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>
              minutes
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {sessionsCompleted}
            </Text>
            <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>
              sessions
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border.light }]} />
          <View style={styles.statItem}>
            <View style={styles.streakValue}>
              <Flame size={16} color={colors.warning} />
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {currentStreak}
              </Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>
              série
            </Text>
          </View>
        </View>

        {/* Sessions by Phase */}
        {Object.entries(sessionsByPhase).map(([phase, sessions]) => (
          <View key={phase} style={styles.phaseSection}>
            {/* Phase Header */}
            <View style={styles.phaseHeader}>
              <LinearGradient
                colors={PHASE_COLORS[phase as keyof typeof PHASE_COLORS]}
                style={styles.phaseBadge}
              >
                <Text style={styles.phaseBadgeText}>
                  {PHASE_LABELS[phase as keyof typeof PHASE_LABELS]}
                </Text>
              </LinearGradient>
            </View>

            {/* Sessions */}
            {sessions.map((session) => {
              const isUnlocked = unlockedSessions.some(s => s.id === session.id)
              const isCompleted = isSessionCompleted(session.id)
              const isCached = isSessionCached(session.id)

              return (
                <TouchableOpacity
                  key={session.id}
                  style={[
                    styles.sessionCard,
                    { backgroundColor: colors.bg.elevated },
                    !isUnlocked && styles.sessionCardLocked,
                  ]}
                  onPress={() => handleSessionPress(session)}
                  disabled={!isUnlocked}
                  activeOpacity={0.7}
                >
                  {/* Icon */}
                  <View
                    style={[
                      styles.sessionIcon,
                      isCompleted && styles.sessionIconCompleted,
                      !isUnlocked && styles.sessionIconLocked,
                    ]}
                  >
                    {!isUnlocked ? (
                      <Lock size={20} color={colors.text.muted} />
                    ) : isCompleted ? (
                      <CheckCircle2 size={24} color="#10B981" />
                    ) : isCached ? (
                      <Cloud size={20} color="#8B5CF6" />
                    ) : (
                      <Headphones size={20} color={colors.text.secondary} />
                    )}
                  </View>

                  {/* Content */}
                  <View style={styles.sessionContent}>
                    <View style={styles.sessionHeader}>
                      <Text
                        style={[
                          styles.sessionWeek,
                          { color: colors.text.tertiary },
                          !isUnlocked && styles.textLocked,
                        ]}
                      >
                        Semaine {session.week}
                      </Text>
                      <View style={styles.sessionMeta}>
                        <Clock size={12} color={colors.text.muted} />
                        <Text style={[styles.sessionDuration, { color: colors.text.muted }]}>
                          {session.durationMinutes} min
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.sessionTitle,
                        { color: colors.text.primary },
                        !isUnlocked && styles.textLocked,
                      ]}
                    >
                      {session.title}
                    </Text>
                  </View>

                  {/* Arrow */}
                  {isUnlocked && (
                    <ChevronRight size={20} color={colors.text.muted} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        ))}

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.bg.tertiary }]}>
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            Les méditations sont générées par IA et cachées localement pour une écoute hors-ligne.
            Chaque session est débloquée selon ta progression dans le programme Bien-être.
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  headerContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: fonts.serif.bold,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerIcon: {
    marginLeft: spacing.md,
  },
  headerIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  statsCard: {
    flexDirection: 'row',
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  streakValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  phaseSection: {
    marginBottom: spacing.lg,
  },
  phaseHeader: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  phaseBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  phaseBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  sessionCardLocked: {
    opacity: 0.5,
  },
  sessionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionIconCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  sessionIconLocked: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
  },
  sessionContent: {
    flex: 1,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sessionWeek: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionDuration: {
    fontSize: 11,
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  textLocked: {
    opacity: 0.5,
  },
  infoCard: {
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: spacing.xl,
  },
})

export { MeditationListScreen }
