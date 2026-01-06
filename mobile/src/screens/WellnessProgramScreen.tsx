/**
 * WellnessProgramScreen - Programme Bien-etre holistique
 *
 * Affiche:
 * - Phase actuelle et progression
 * - Plan quotidien (matin, apres-midi, soir)
 * - Suivi meditation, respiration, sommeil
 * - Insights et recommandations RAG
 * - Journal de gratitude
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native'
import {
  Heart,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Brain,
  Wind,
  Sparkles,
  TrendingUp,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Smile,
  Frown,
  Meh,
  BookOpen,
  Play,
  Pause,
  RotateCcw,
  Headphones,
} from 'lucide-react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'

import { Card, Badge, ProgressBar, Button } from '../components/ui'
import { colors, spacing, typography, radius, fonts } from '../constants/theme'
import {
  useWellnessProgramStore,
  WELLNESS_PHASE_CONFIGS,
  type WellnessPhase,
} from '../stores/wellness-program-store'
import { useUserStore } from '../stores/user-store'
import { useMeditationStore } from '../stores/meditation-store'
import { WellnessAgent, type WellnessAnalysisResult } from '../services/wellness-agent'

const phaseColors: Record<WellnessPhase, string> = {
  foundations: colors.accent.primary,
  awareness: colors.secondary.primary,
  balance: colors.success,
  harmony: colors.warning,
}

const phaseIcons: Record<WellnessPhase, React.ReactNode> = {
  foundations: <Moon size={20} color="#FFFFFF" />,
  awareness: <Brain size={20} color="#FFFFFF" />,
  balance: <Wind size={20} color="#FFFFFF" />,
  harmony: <Sparkles size={20} color="#FFFFFF" />,
}

const moodEmojis = ['😢', '😔', '😐', '🙂', '😊']
const stressEmojis = ['😌', '🙂', '😐', '😰', '😫']

export default function WellnessProgramScreen() {
  const navigation = useNavigation()
  const [refreshing, setRefreshing] = useState(false)
  const [gratitudeText, setGratitudeText] = useState('')
  const [showGratitudeInput, setShowGratitudeInput] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<WellnessAnalysisResult | null>(null)
  const [breathingActive, setBreathingActive] = useState(false)
  const [breathingPhase, setBreathingPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale')
  const [breathingCount, setBreathingCount] = useState(0)

  const {
    isEnrolled,
    currentPhase,
    currentWeek,
    currentStreak,
    longestStreak,
    dailyLogs,
    enroll,
    unenroll,
    logDaily,
    getTodayLog,
    getProgressPercentage,
    getCurrentPhaseConfig,
    checkPhaseProgression,
    progressToNextPhase,
  } = useWellnessProgramStore()

  const { profile } = useUserStore()
  const { totalMeditationMinutes, sessionsCompleted } = useMeditationStore()

  const phaseConfig = getCurrentPhaseConfig()
  const todayLog = getTodayLog()
  const progressPercent = getProgressPercentage()
  const { canProgress, reason } = checkPhaseProgression()

  // Load analysis on mount
  useEffect(() => {
    if (isEnrolled && profile) {
      loadAnalysis()
    }
  }, [isEnrolled, profile])

  const loadAnalysis = async () => {
    if (!profile) return
    try {
      const recentLogs = dailyLogs.slice(-7)
      const result = await WellnessAgent.analyzeWellness({
        profile,
        currentPhase,
        currentWeek,
        recentLogs,
        totalMeditationMinutes,
        currentStreak,
      })
      setAnalysisResult(result)
    } catch (error) {
      console.error('Failed to load wellness analysis:', error)
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadAnalysis()
    setRefreshing(false)
  }, [profile, currentPhase, currentWeek])

  const handleEnroll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    enroll()
  }

  const handleGoBack = () => {
    navigation.goBack()
  }

  const handleUnenroll = () => {
    Alert.alert(
      'Se desinscrire du programme ?',
      'Tu perdras ta progression actuelle. Tu pourras rejoindre a nouveau plus tard mais tu recommenceras a zero.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Me desinscrire',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            unenroll()
          },
        },
      ]
    )
  }

  const handleQuickLog = (field: string, value: number | boolean | string[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    logDaily({ [field]: value })
  }

  const handleAddGratitude = () => {
    if (!gratitudeText.trim()) return

    const currentEntries = todayLog?.gratitudeEntries || []
    const newEntries = [...currentEntries, gratitudeText.trim()]
    handleQuickLog('gratitudeEntries', newEntries)
    setGratitudeText('')
    setShowGratitudeInput(false)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const handleOpenMeditations = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // @ts-ignore
    navigation.navigate('MeditationList')
  }

  const handleProgressPhase = () => {
    if (canProgress) {
      Alert.alert(
        'Passer a la phase suivante ?',
        `Tu as complete la phase "${phaseConfig.name}" avec succes ! Pret(e) pour la suite ?`,
        [
          { text: 'Pas encore', style: 'cancel' },
          {
            text: 'Continuer',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
              progressToNextPhase()
            },
          },
        ]
      )
    }
  }

  // Simple breathing exercise timer
  const startBreathing = () => {
    setBreathingActive(true)
    setBreathingCount(0)
    runBreathingCycle()
  }

  const stopBreathing = () => {
    setBreathingActive(false)
    // Log completed breathing exercises
    const currentExercises = todayLog?.breathingExercises || 0
    handleQuickLog('breathingExercises', currentExercises + 1)
  }

  const runBreathingCycle = () => {
    // Simplified 4-4-4 breathing (would be better with proper timer in production)
    setBreathingPhase('inhale')
    setTimeout(() => {
      setBreathingPhase('hold')
      setTimeout(() => {
        setBreathingPhase('exhale')
        setTimeout(() => {
          setBreathingCount(c => c + 1)
          if (breathingActive) {
            runBreathingCycle()
          }
        }, 4000)
      }, 4000)
    }, 4000)
  }

  // Not enrolled view
  if (!isEnrolled) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.notEnrolledContent}
        >
          <View style={styles.heroSection}>
            <View style={styles.heroIcon}>
              <Heart size={48} color={colors.secondary.primary} />
            </View>
            <Text style={styles.heroTitle}>Programme Bien-etre</Text>
            <Text style={styles.heroSubtitle}>
              8 semaines pour cultiver ton equilibre mental et physique
            </Text>
          </View>

          <View style={styles.phaseOverview}>
            <Text style={styles.sectionTitle}>Les 4 phases</Text>
            {(['foundations', 'awareness', 'balance', 'harmony'] as WellnessPhase[]).map(
              (phase) => {
                const config = WELLNESS_PHASE_CONFIGS[phase]
                return (
                  <Card key={phase} style={styles.phaseCard}>
                    <View
                      style={[
                        styles.phaseIconContainer,
                        { backgroundColor: phaseColors[phase] },
                      ]}
                    >
                      {phaseIcons[phase]}
                    </View>
                    <View style={styles.phaseInfo}>
                      <View style={styles.phaseHeader}>
                        <Text style={styles.phaseName}>{config.name}</Text>
                        <Badge variant="outline" size="sm">
                          {config.durationWeeks > 0
                            ? `${config.durationWeeks} sem`
                            : 'Continu'}
                        </Badge>
                      </View>
                      <Text style={styles.phaseDescription}>{config.description}</Text>
                      <Text style={styles.phaseFocus}>{config.focus}</Text>
                    </View>
                  </Card>
                )
              }
            )}
          </View>

          <View style={styles.features}>
            <Text style={styles.sectionTitle}>Ce que tu obtiens</Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Headphones size={20} color={colors.secondary.primary} />
                <Text style={styles.featureText}>8 meditations audio guidees (1 par semaine)</Text>
              </View>
              <View style={styles.featureItem}>
                <Wind size={20} color={colors.accent.primary} />
                <Text style={styles.featureText}>Exercices de respiration (coherence cardiaque)</Text>
              </View>
              <View style={styles.featureItem}>
                <Moon size={20} color={colors.info} />
                <Text style={styles.featureText}>Suivi sommeil et qualite de repos</Text>
              </View>
              <View style={styles.featureItem}>
                <Sparkles size={20} color={colors.warning} />
                <Text style={styles.featureText}>Journal de gratitude et insights IA</Text>
              </View>
            </View>
          </View>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleEnroll}
            style={styles.enrollButton}
          >
            <Heart size={20} color="#FFFFFF" />
            <Text style={styles.enrollButtonText}>Commencer le programme</Text>
          </Button>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // Enrolled view - Dashboard
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
          >
            <ChevronLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Programme Bien-etre</Text>
            <Text style={styles.subtitle}>Phase {phaseConfig.name} - Semaine {currentWeek}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Inspirational Quote */}
        {analysisResult?.dailyPlan && (
          <Card style={styles.quoteCard}>
            <Sparkles size={16} color={colors.warning} />
            <Text style={styles.quoteText}>"{analysisResult.dailyPlan.inspirationalQuote}"</Text>
            <Text style={styles.quoteSource}>- {analysisResult.dailyPlan.quoteSource}</Text>
          </Card>
        )}

        {/* Phase Progress Card */}
        <Card style={styles.phaseProgressCard}>
          <View style={styles.phaseProgressHeader}>
            <View
              style={[
                styles.currentPhaseIcon,
                { backgroundColor: phaseColors[currentPhase] },
              ]}
            >
              {phaseIcons[currentPhase]}
            </View>
            <View style={styles.phaseProgressInfo}>
              <Text style={styles.currentPhaseName}>{phaseConfig.name}</Text>
              <Text style={styles.currentPhaseDesc}>{phaseConfig.focus}</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progression globale</Text>
              <Text style={styles.progressValue}>{progressPercent}%</Text>
            </View>
            <ProgressBar
              value={progressPercent}
              max={100}
              color={phaseColors[currentPhase]}
              size="md"
            />
          </View>

          {canProgress && (
            <TouchableOpacity
              style={styles.progressButton}
              onPress={handleProgressPhase}
            >
              <Text style={styles.progressButtonText}>
                Passer a la phase suivante
              </Text>
              <ChevronRight size={20} color={colors.success} />
            </TouchableOpacity>
          )}

          {!canProgress && reason && currentPhase !== 'harmony' && (
            <View style={styles.progressHint}>
              <Clock size={16} color={colors.text.muted} />
              <Text style={styles.progressHintText}>{reason}</Text>
            </View>
          )}
        </Card>

        {/* Streaks & Stats */}
        <View style={styles.streaksRow}>
          <Card style={styles.streakCard}>
            <Text style={styles.streakValue}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>Jours d'affilee</Text>
          </Card>
          <Card style={styles.streakCard}>
            <Text style={styles.streakValue}>{Math.round(totalMeditationMinutes / 60)}h</Text>
            <Text style={styles.streakLabel}>Meditation</Text>
          </Card>
          <Card style={styles.streakCard}>
            <Text style={styles.streakValue}>{longestStreak}</Text>
            <Text style={styles.streakLabel}>Record</Text>
          </Card>
        </View>

        {/* Daily Practices */}
        <Text style={styles.sectionTitle}>Pratiques du jour</Text>

        {/* Méditations Guidées TTS */}
        <TouchableOpacity
          style={styles.oralMeditationCard}
          onPress={handleOpenMeditations}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.oralMeditationGradient}
          >
            <View style={styles.oralMeditationContent}>
              <View style={styles.oralMeditationIcon}>
                <Headphones size={28} color="#FFFFFF" />
              </View>
              <View style={styles.oralMeditationInfo}>
                <Text style={styles.oralMeditationTitle}>Meditations Guidees</Text>
                <Text style={styles.oralMeditationSubtitle}>
                  1 session par semaine • {sessionsCompleted > 0 ? `${sessionsCompleted} completee${sessionsCompleted > 1 ? 's' : ''}` : 'Commencer'}
                </Text>
              </View>
              <ChevronRight size={24} color="rgba(255,255,255,0.7)" />
            </View>

            {/* Progress indicator */}
            <View style={styles.oralMeditationProgress}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((week) => {
                const isCompleted = sessionsCompleted >= week
                const isCurrent = currentWeek === week && sessionsCompleted < week
                return (
                  <View
                    key={week}
                    style={[
                      styles.oralMeditationDot,
                      isCompleted && styles.oralMeditationDotCompleted,
                      isCurrent && styles.oralMeditationDotCurrent,
                    ]}
                  >
                    {isCompleted && <Check size={10} color="#FFFFFF" />}
                  </View>
                )
              })}
            </View>

            <View style={styles.oralMeditationStats}>
              <View style={styles.oralMeditationStat}>
                <Text style={styles.oralMeditationStatValue}>{sessionsCompleted}/8</Text>
                <Text style={styles.oralMeditationStatLabel}>sessions</Text>
              </View>
              <View style={styles.oralMeditationStatDivider} />
              <View style={styles.oralMeditationStat}>
                <Text style={styles.oralMeditationStatValue}>{Math.round(totalMeditationMinutes)}</Text>
                <Text style={styles.oralMeditationStatLabel}>minutes</Text>
              </View>
              <View style={styles.oralMeditationStatDivider} />
              <View style={styles.oralMeditationStat}>
                <Text style={styles.oralMeditationStatValue}>Sem {currentWeek}</Text>
                <Text style={styles.oralMeditationStatLabel}>actuelle</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Breathing Exercise */}
        <Card style={styles.practiceCard}>
          <View style={styles.practiceHeader}>
            <View style={[styles.practiceIconBg, { backgroundColor: 'rgba(0, 119, 182, 0.1)' }]}>
              <Wind size={20} color={colors.accent.primary} />
            </View>
            <View style={styles.practiceInfo}>
              <Text style={styles.practiceTitle}>Respiration</Text>
              <Text style={styles.practiceGoal}>
                Objectif: {phaseConfig.dailyPractices.breathingExercises} sessions/jour
              </Text>
            </View>
            <View style={styles.practiceValue}>
              <Text style={[
                styles.practiceValueText,
                (todayLog?.breathingExercises || 0) >= phaseConfig.dailyPractices.breathingExercises && styles.practiceValueComplete
              ]}>
                {todayLog?.breathingExercises || 0}/{phaseConfig.dailyPractices.breathingExercises}
              </Text>
            </View>
          </View>

          {breathingActive ? (
            <View style={styles.breathingContainer}>
              <View style={[
                styles.breathingCircle,
                breathingPhase === 'inhale' && styles.breathingInhale,
                breathingPhase === 'hold' && styles.breathingHold,
                breathingPhase === 'exhale' && styles.breathingExhale,
              ]}>
                <Text style={styles.breathingPhaseText}>
                  {breathingPhase === 'inhale' ? 'Inspire' : breathingPhase === 'hold' ? 'Retiens' : 'Expire'}
                </Text>
                <Text style={styles.breathingCountText}>{breathingCount} cycles</Text>
              </View>
              <TouchableOpacity style={styles.stopBreathingButton} onPress={stopBreathing}>
                <Pause size={20} color="#FFFFFF" />
                <Text style={styles.stopBreathingText}>Terminer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.breathingOptions}>
              <TouchableOpacity style={styles.breathingStartButton} onPress={startBreathing}>
                <Play size={18} color="#FFFFFF" />
                <Text style={styles.breathingStartText}>Coherence cardiaque (5-5)</Text>
              </TouchableOpacity>
              <Text style={styles.breathingHint}>5 min pour equilibrer ton systeme nerveux</Text>
            </View>
          )}
        </Card>

        {/* Sleep Quality */}
        <Card style={styles.practiceCard}>
          <View style={styles.practiceHeader}>
            <View style={[styles.practiceIconBg, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
              <Moon size={20} color={colors.info} />
            </View>
            <View style={styles.practiceInfo}>
              <Text style={styles.practiceTitle}>Sommeil</Text>
              <Text style={styles.practiceGoal}>Qualite de ta derniere nuit</Text>
            </View>
          </View>

          <View style={styles.sleepInputRow}>
            <View style={styles.sleepHoursContainer}>
              <TouchableOpacity
                style={styles.sleepButton}
                onPress={() => handleQuickLog('sleepHours', Math.max(0, (todayLog?.sleepHours || 7) - 0.5))}
              >
                <Minus size={16} color={colors.text.secondary} />
              </TouchableOpacity>
              <Text style={styles.sleepHoursText}>{todayLog?.sleepHours || 7}h</Text>
              <TouchableOpacity
                style={styles.sleepButton}
                onPress={() => handleQuickLog('sleepHours', (todayLog?.sleepHours || 7) + 0.5)}
              >
                <Plus size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.sleepQualityContainer}>
              <Text style={styles.sleepQualityLabel}>Qualite:</Text>
              {[1, 2, 3, 4, 5].map(q => (
                <TouchableOpacity
                  key={q}
                  style={[
                    styles.qualityButton,
                    todayLog?.sleepQuality === q && styles.qualityButtonActive
                  ]}
                  onPress={() => handleQuickLog('sleepQuality', q)}
                >
                  <Text style={styles.qualityButtonText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* Mood & Stress Check-in */}
        <Text style={styles.sectionTitle}>Comment te sens-tu ?</Text>
        <Card style={styles.checkinCard}>
          <View style={styles.checkinRow}>
            <Text style={styles.checkinLabel}>Humeur</Text>
            <View style={styles.checkinOptions}>
              {[1, 2, 3, 4, 5].map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.checkinOption,
                    todayLog?.moodLevel === level && styles.checkinOptionActive
                  ]}
                  onPress={() => handleQuickLog('moodLevel', level)}
                >
                  <Text style={styles.checkinEmoji}>{moodEmojis[level - 1]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.checkinDivider} />

          <View style={styles.checkinRow}>
            <Text style={styles.checkinLabel}>Stress</Text>
            <View style={styles.checkinOptions}>
              {[1, 2, 3, 4, 5].map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.checkinOption,
                    todayLog?.stressLevel === level && styles.checkinOptionActive
                  ]}
                  onPress={() => handleQuickLog('stressLevel', level)}
                >
                  <Text style={styles.checkinEmoji}>{stressEmojis[level - 1]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.checkinDivider} />

          <View style={styles.checkinRow}>
            <Text style={styles.checkinLabel}>Energie</Text>
            <View style={styles.checkinOptions}>
              {[1, 2, 3, 4, 5].map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.checkinOption,
                    todayLog?.energyLevel === level && styles.checkinOptionActive
                  ]}
                  onPress={() => handleQuickLog('energyLevel', level)}
                >
                  <Text style={styles.checkinEmoji}>
                    {level === 1 ? '🔋' : level === 2 ? '🪫' : level === 3 ? '⚡' : level === 4 ? '💪' : '🚀'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* Gratitude Journal */}
        <Text style={styles.sectionTitle}>Journal de gratitude</Text>
        <Card style={styles.gratitudeCard}>
          <View style={styles.gratitudeHeader}>
            <BookOpen size={18} color={colors.warning} />
            <Text style={styles.gratitudeTitle}>
              {(todayLog?.gratitudeEntries?.length || 0)}/{phaseConfig.dailyPractices.gratitudeEntries} gratitudes aujourd'hui
            </Text>
          </View>

          {todayLog?.gratitudeEntries?.map((entry, index) => (
            <View key={index} style={styles.gratitudeEntry}>
              <Sparkles size={14} color={colors.warning} />
              <Text style={styles.gratitudeEntryText}>{entry}</Text>
            </View>
          ))}

          {showGratitudeInput ? (
            <View style={styles.gratitudeInputContainer}>
              <TextInput
                style={styles.gratitudeInput}
                placeholder="Pour quoi es-tu reconnaissant(e) aujourd'hui ?"
                placeholderTextColor={colors.text.muted}
                value={gratitudeText}
                onChangeText={setGratitudeText}
                multiline
              />
              <View style={styles.gratitudeInputActions}>
                <TouchableOpacity
                  style={styles.gratitudeCancelButton}
                  onPress={() => {
                    setShowGratitudeInput(false)
                    setGratitudeText('')
                  }}
                >
                  <Text style={styles.gratitudeCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.gratitudeAddButton}
                  onPress={handleAddGratitude}
                >
                  <Check size={16} color="#FFFFFF" />
                  <Text style={styles.gratitudeAddText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addGratitudeButton}
              onPress={() => setShowGratitudeInput(true)}
            >
              <Plus size={18} color={colors.warning} />
              <Text style={styles.addGratitudeText}>Ajouter une gratitude</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Insights from RAG */}
        {analysisResult?.insights && analysisResult.insights.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Insights</Text>
            {analysisResult.insights.map((insight, index) => (
              <Card key={index} style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <TrendingUp size={16} color={
                    insight.trend === 'improving' ? colors.success :
                    insight.trend === 'declining' ? colors.error :
                    colors.text.secondary
                  } />
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                </View>
                <Text style={styles.insightMessage}>{insight.message}</Text>
                {insight.sources.length > 0 && (
                  <Text style={styles.insightSource}>Source: {insight.sources.join(', ')}</Text>
                )}
              </Card>
            ))}
          </>
        )}

        {/* Daily Recommendations */}
        {analysisResult?.recommendations && analysisResult.recommendations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recommandations</Text>
            {analysisResult.recommendations.slice(0, 3).map((rec, index) => (
              <Card key={index} style={styles.recommendationCard}>
                <View style={styles.recommendationHeader}>
                  <View style={[
                    styles.recommendationIcon,
                    { backgroundColor: rec.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }
                  ]}>
                    {rec.type === 'meditation' ? <Brain size={16} color={colors.secondary.primary} /> :
                     rec.type === 'breathing' ? <Wind size={16} color={colors.accent.primary} /> :
                     rec.type === 'sleep' ? <Moon size={16} color={colors.info} /> :
                     <Heart size={16} color={colors.error} />}
                  </View>
                  <View style={styles.recommendationInfo}>
                    <Text style={styles.recommendationTitle}>{rec.title}</Text>
                    {rec.duration && <Text style={styles.recommendationDuration}>{rec.duration} min</Text>}
                  </View>
                </View>
                <Text style={styles.recommendationDescription}>{rec.description}</Text>
                <Text style={styles.recommendationScience}>{rec.scientificBasis}</Text>
              </Card>
            ))}
          </>
        )}

        {/* Phase Techniques */}
        <Text style={styles.sectionTitle}>Techniques de la phase</Text>
        <Card style={styles.techniquesCard}>
          {phaseConfig.techniques.map((technique, index) => (
            <View key={index} style={styles.techniqueRow}>
              <Check size={14} color={colors.success} />
              <Text style={styles.techniqueText}>{technique}</Text>
            </View>
          ))}
        </Card>

        {/* Unenroll */}
        <TouchableOpacity style={styles.unenrollButton} onPress={handleUnenroll}>
          <Text style={styles.unenrollButtonText}>Se desinscrire du programme</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  notEnrolledContent: {
    padding: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerCenter: {
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    fontFamily: fonts.serif.bold,
  },
  subtitle: {
    ...typography.small,
    color: colors.text.secondary,
  },
  // Quote card
  quoteCard: {
    marginBottom: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  quoteText: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  quoteSource: {
    ...typography.caption,
    color: colors.text.muted,
  },
  // Hero section
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  heroIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontFamily: fonts.serif.bold,
  },
  heroSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  // Phase overview
  phaseOverview: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  phaseCard: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  phaseIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  phaseInfo: {
    flex: 1,
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  phaseName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  phaseDescription: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  phaseFocus: {
    ...typography.caption,
    color: colors.secondary.primary,
    marginTop: 2,
  },
  // Features
  features: {
    marginBottom: spacing.xl,
  },
  featuresList: {
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary.primary,
  },
  enrollButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  // Phase progress
  phaseProgressCard: {
    marginBottom: spacing.md,
  },
  phaseProgressHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  currentPhaseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  phaseProgressInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  currentPhaseName: {
    ...typography.h4,
    color: colors.text.primary,
  },
  currentPhaseDesc: {
    ...typography.small,
    color: colors.text.secondary,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  progressValue: {
    ...typography.smallMedium,
    color: colors.text.primary,
  },
  progressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  progressButtonText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  progressHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  progressHintText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  // Streaks
  streaksRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  streakCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  streakValue: {
    ...typography.h3,
    color: colors.secondary.primary,
  },
  streakLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  // Practice cards
  practiceCard: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  practiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  practiceIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  practiceInfo: {
    flex: 1,
  },
  practiceTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  practiceGoal: {
    ...typography.caption,
    color: colors.text.muted,
  },
  practiceValue: {
    alignItems: 'flex-end',
  },
  practiceValueText: {
    ...typography.h4,
    color: colors.text.primary,
  },
  practiceValueComplete: {
    color: colors.success,
  },
  practiceButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  practiceButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
  },
  practiceButtonActive: {
    backgroundColor: colors.secondary.primary,
  },
  practiceButtonText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  practiceButtonTextActive: {
    color: '#FFFFFF',
  },
  // Breathing
  breathingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  breathingCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.secondary,
  },
  breathingInhale: {
    backgroundColor: 'rgba(0, 119, 182, 0.2)',
    transform: [{ scale: 1.1 }],
  },
  breathingHold: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  breathingExhale: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    transform: [{ scale: 0.9 }],
  },
  breathingPhaseText: {
    ...typography.h4,
    color: colors.text.primary,
  },
  breathingCountText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  stopBreathingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.error,
    borderRadius: radius.full,
  },
  stopBreathingText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  breathingOptions: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  breathingStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.accent.primary,
    borderRadius: radius.full,
  },
  breathingStartText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  breathingHint: {
    ...typography.caption,
    color: colors.text.muted,
  },
  // Sleep
  sleepInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
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
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepHoursText: {
    ...typography.h4,
    color: colors.text.primary,
    minWidth: 50,
    textAlign: 'center',
  },
  sleepQualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sleepQualityLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginRight: spacing.xs,
  },
  qualityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qualityButtonActive: {
    backgroundColor: colors.info,
  },
  qualityButtonText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  // Checkin
  checkinCard: {
    marginBottom: spacing.lg,
  },
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  checkinDivider: {
    height: 1,
    backgroundColor: colors.border.light,
  },
  checkinLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  checkinOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  checkinOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinOptionActive: {
    backgroundColor: colors.accent.light,
    borderWidth: 2,
    borderColor: colors.accent.primary,
  },
  checkinEmoji: {
    fontSize: 20,
  },
  // Gratitude
  gratitudeCard: {
    marginBottom: spacing.lg,
  },
  gratitudeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  gratitudeTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  gratitudeEntry: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
  },
  gratitudeEntryText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
  },
  addGratitudeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  addGratitudeText: {
    ...typography.smallMedium,
    color: colors.warning,
  },
  gratitudeInputContainer: {
    marginTop: spacing.sm,
  },
  gratitudeInput: {
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  gratitudeInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  gratitudeCancelButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  gratitudeCancelText: {
    ...typography.smallMedium,
    color: colors.text.muted,
  },
  gratitudeAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.warning,
    borderRadius: radius.md,
  },
  gratitudeAddText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  // Insights
  insightCard: {
    marginBottom: spacing.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  insightTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  insightMessage: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  insightSource: {
    ...typography.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  // Recommendations
  recommendationCard: {
    marginBottom: spacing.sm,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recommendationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  recommendationInfo: {
    flex: 1,
  },
  recommendationTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  recommendationDuration: {
    ...typography.caption,
    color: colors.text.muted,
  },
  recommendationDescription: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  recommendationScience: {
    ...typography.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  // Techniques
  techniquesCard: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  techniqueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  techniqueText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
  },
  // Unenroll
  unenrollButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
  },
  unenrollButtonText: {
    ...typography.small,
    color: colors.error,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
  // Oral Meditation Widget
  oralMeditationCard: {
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  oralMeditationGradient: {
    padding: spacing.lg,
  },
  oralMeditationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  oralMeditationIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  oralMeditationInfo: {
    flex: 1,
  },
  oralMeditationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  oralMeditationSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  oralMeditationStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  oralMeditationStat: {
    alignItems: 'center',
    flex: 1,
  },
  oralMeditationStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  oralMeditationStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  oralMeditationStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  oralMeditationProgress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  oralMeditationDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oralMeditationDotCompleted: {
    backgroundColor: '#10B981',
  },
  oralMeditationDotCurrent: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
})
