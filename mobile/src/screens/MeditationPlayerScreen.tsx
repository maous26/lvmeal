/**
 * MeditationPlayerScreen - Lecteur de méditation guidée
 */

import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Cloud,
  CloudOff,
  Zap,
  Headphones,
  Check,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { useMeditationStore } from '../stores/meditation-store'
import { MEDITATION_SESSIONS, type MeditationSession } from '../services/meditation-tts-service'

type MeditationPlayerRouteParams = {
  MeditationPlayer: {
    sessionId: string
  }
}

export default function MeditationPlayerScreen() {
  const navigation = useNavigation()
  const route = useRoute<RouteProp<MeditationPlayerRouteParams, 'MeditationPlayer'>>()
  const { colors } = useTheme()

  const sessionId = route.params?.sessionId
  const session = MEDITATION_SESSIONS.find(s => s.id === sessionId)

  const {
    cachedSessions,
    currentStatus,
    currentPosition,
    duration,
    currentSessionId,
    generateAudio,
    playSession,
    pauseSession,
    resumeSession,
    stopSession,
    seekTo,
    checkCacheStatus,
    getSessionProgress,
  } = useMeditationStore()

  const [isGenerating, setIsGenerating] = useState(false)

  const cacheInfo = cachedSessions.find(c => c.sessionId === sessionId)
  const isCached = cacheInfo?.isCached || false
  const progress = getSessionProgress(sessionId || '')
  const isCurrentSession = currentSessionId === sessionId
  const isPlaying = isCurrentSession && currentStatus === 'playing'
  const isPaused = isCurrentSession && currentStatus === 'paused'

  useEffect(() => {
    if (sessionId) {
      checkCacheStatus(sessionId)
    }

    // Cleanup on unmount
    return () => {
      // Ne pas arrêter si on navigue vers un autre écran tout en jouant
    }
  }, [sessionId, checkCacheStatus])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleGenerate = useCallback(async () => {
    if (!session || isGenerating) return

    setIsGenerating(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      await generateAudio(session)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      Alert.alert(
        'Erreur',
        'Impossible de générer l\'audio. Vérifiez votre connexion internet.',
        [{ text: 'OK' }]
      )
    } finally {
      setIsGenerating(false)
    }
  }, [session, isGenerating, generateAudio])

  const handlePlayPause = useCallback(async () => {
    if (!sessionId) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    if (isPlaying) {
      await pauseSession()
    } else if (isPaused) {
      await resumeSession()
    } else {
      // Démarrer depuis le début ou la position sauvegardée
      if (!isCached) {
        await handleGenerate()
      }
      await playSession(sessionId)
    }
  }, [sessionId, isPlaying, isPaused, isCached, pauseSession, resumeSession, playSession, handleGenerate])

  const handleRestart = useCallback(async () => {
    if (!sessionId) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await seekTo(0)
  }, [sessionId, seekTo])

  const handleBack = useCallback(async () => {
    // Mettre en pause avant de quitter
    if (isPlaying) {
      await pauseSession()
    }
    navigation.goBack()
  }, [isPlaying, pauseSession, navigation])

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
        <Text style={[styles.errorText, { color: colors.text.primary }]}>
          Session non trouvée
        </Text>
      </SafeAreaView>
    )
  }

  const progressPercent = duration > 0 ? (currentPosition / duration) * 100 : 0

  return (
    <LinearGradient
      colors={['#312E81', '#1E1B4B', '#0F172A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <Headphones size={80} color="rgba(165, 180, 252, 0.3)" />
            </View>
            {isPlaying && (
              <View style={styles.pulseRing} />
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{session.title}</Text>
          <Text style={styles.weekLabel}>SEMAINE {session.week}</Text>

          {/* Duration info */}
          <Text style={styles.durationInfo}>
            {session.durationMinutes} minutes
          </Text>

          {/* Completed badge */}
          {progress?.completedAt && (
            <View style={styles.completedBadge}>
              <Check size={14} color="#10B981" />
              <Text style={styles.completedText}>
                Complété {progress.listenCount} fois
              </Text>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Cache Status */}
          {!isCached ? (
            <View style={styles.cacheAlert}>
              <Zap size={20} color="#FBBF24" />
              <View style={styles.cacheAlertContent}>
                <Text style={styles.cacheAlertTitle}>Première écoute</Text>
                <Text style={styles.cacheAlertText}>
                  Génération de l'audio IA requise...
                </Text>
              </View>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleGenerate}
                disabled={isGenerating || currentStatus === 'generating'}
              >
                {isGenerating || currentStatus === 'generating' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.generateButtonText}>GÉNÉRER</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cacheReady}>
              <Cloud size={20} color="#10B981" />
              <View style={styles.cacheReadyContent}>
                <Text style={styles.cacheReadyTitle}>Prêt pour l'écoute</Text>
                <Text style={styles.cacheReadyText}>Audio optimisé en cache</Text>
              </View>
            </View>
          )}

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progressPercent, 100)}%` },
                ]}
              />
            </View>
            <View style={styles.timeLabels}>
              <Text style={styles.timeLabel}>
                {formatTime(isCurrentSession ? currentPosition : 0)}
              </Text>
              <Text style={styles.timeLabel}>
                {formatTime(duration || session.durationMinutes * 60000)}
              </Text>
            </View>
          </View>

          {/* Play Controls */}
          <View style={styles.playControls}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRestart}
              disabled={!isCached || !isCurrentSession}
            >
              <RotateCcw size={24} color={!isCached ? '#6B7280' : '#FFFFFF'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.playButton,
                (!isCached && !isGenerating) && styles.playButtonDisabled,
              ]}
              onPress={handlePlayPause}
              disabled={!isCached && !isGenerating && currentStatus !== 'generating'}
            >
              {currentStatus === 'generating' ? (
                <ActivityIndicator size="large" color="#312E81" />
              ) : isPlaying ? (
                <Pause size={36} color="#312E81" fill="#312E81" />
              ) : (
                <Play size={36} color="#312E81" fill="#312E81" style={{ marginLeft: 4 }} />
              )}
            </TouchableOpacity>

            <View style={styles.secondaryButton}>
              {/* Placeholder pour symétrie */}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconBackground: {
    width: 180,
    height: 180,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: 'rgba(165, 180, 252, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A5B4FC',
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  durationInfo: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: spacing.md,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  completedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  cacheAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  cacheAlertContent: {
    flex: 1,
  },
  cacheAlertTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
  },
  cacheAlertText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  generateButton: {
    backgroundColor: '#FBBF24',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minWidth: 80,
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1F2937',
  },
  cacheReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  cacheReadyContent: {
    flex: 1,
  },
  cacheReadyTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
  },
  cacheReadyText: {
    fontSize: 12,
    color: '#10B981',
  },
  progressContainer: {
    gap: spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.full,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  playControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  secondaryButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 100,
  },
})

export { MeditationPlayerScreen }
