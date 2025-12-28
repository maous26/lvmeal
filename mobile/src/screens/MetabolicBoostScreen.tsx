/**
 * MetabolicBoostScreen - Écran dédié au programme de relance métabolique
 *
 * Affiche:
 * - Phase actuelle et progression
 * - Objectifs quotidiens/hebdomadaires
 * - Check-in journalier
 * - Connexion aux montres
 * - Conseils personnalisés via RAG
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
} from 'react-native'
import {
  Zap,
  Target,
  Activity,
  Moon,
  Droplets,
  Dumbbell,
  Watch,
  ChevronRight,
  TrendingUp,
  Check,
  Clock,
  Heart,
  Footprints,
  Brain,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'

import { Card, Badge, ProgressBar, CircularProgress, Button } from '../components/ui'
import { colors, spacing, typography, radius } from '../constants/theme'
import { useMetabolicBoostStore, PHASE_CONFIGS, type MetabolicPhase } from '../stores/metabolic-boost-store'
import { useDevicesStore, DEVICE_INFO } from '../stores/devices-store'
import { useUserStore } from '../stores/user-store'
import type { DeviceType } from '../types'

const phaseColors: Record<MetabolicPhase, string> = {
  discovery: colors.accent.primary,
  walking: colors.success,
  resistance: colors.warning,
  full_program: colors.secondary.primary,
}

const phaseIcons: Record<MetabolicPhase, React.ReactNode> = {
  discovery: <Heart size={20} color="#FFFFFF" />,
  walking: <Footprints size={20} color="#FFFFFF" />,
  resistance: <Dumbbell size={20} color="#FFFFFF" />,
  full_program: <Zap size={20} color="#FFFFFF" />,
}

export default function MetabolicBoostScreen() {
  const [refreshing, setRefreshing] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)

  const {
    isEnrolled,
    currentPhase,
    currentWeek,
    phaseStartDate,
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
    syncDeviceSteps,
  } = useMetabolicBoostStore()

  const {
    devices,
    hasConnectedDevices,
    syncAllDevices,
    addDevice,
    getLastSyncData,
  } = useDevicesStore()

  const { profile } = useUserStore()

  const phaseConfig = getCurrentPhaseConfig()
  const todayLog = getTodayLog()
  const progressPercent = getProgressPercentage()
  const { canProgress, reason } = checkPhaseProgression()

  const connectedDevices = devices.filter((d) => d.status === 'connected')
  const hasDevices = connectedDevices.length > 0

  // Sync device data on mount
  useEffect(() => {
    if (hasDevices) {
      syncAllDevices()
    }
  }, [hasDevices, syncAllDevices])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    if (hasDevices) {
      await syncAllDevices()
      // Sync steps to metabolic boost store
      const firstDevice = connectedDevices[0]
      if (firstDevice) {
        const syncData = getLastSyncData(firstDevice.id)
        if (syncData?.steps) {
          syncDeviceSteps(syncData.steps)
        }
      }
    }
    setRefreshing(false)
  }, [hasDevices, syncAllDevices, connectedDevices, getLastSyncData, syncDeviceSteps])

  const handleEnroll = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    enroll()
  }

  const handleUnenroll = () => {
    Alert.alert(
      'Quitter le programme ?',
      'Tu perdras ta progression actuelle. Tu pourras toujours rejoindre plus tard.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            unenroll()
          },
        },
      ]
    )
  }

  const handleQuickLog = (field: string, value: number | boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    logDaily({ [field]: value })
  }

  const handleProgressPhase = () => {
    if (canProgress) {
      Alert.alert(
        'Passer à la phase suivante ?',
        `Tu as complété la phase "${phaseConfig.name}" avec succès ! Prêt(e) pour la suite ?`,
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

  const handleConnectDevice = (type: DeviceType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    // In real app, this would trigger native health kit permissions
    Alert.alert(
      `Connecter ${DEVICE_INFO[type].name}`,
      'Cette fonctionnalité nécessite les permissions de santé. Voulez-vous continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Autoriser',
          onPress: () => {
            addDevice({
              type,
              name: DEVICE_INFO[type].name,
              status: 'connected',
              permissions: {
                steps: true,
                heartRate: true,
                sleep: true,
                workouts: true,
                calories: true,
              },
            })
          },
        },
      ]
    )
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
              <Zap size={48} color={colors.warning} />
            </View>
            <Text style={styles.heroTitle}>Programme Relance Métabolique</Text>
            <Text style={styles.heroSubtitle}>
              9 semaines pour retrouver ton énergie et relancer ton métabolisme en douceur
            </Text>
          </View>

          <View style={styles.phaseOverview}>
            <Text style={styles.sectionTitle}>Les 4 phases</Text>
            {(['discovery', 'walking', 'resistance', 'full_program'] as MetabolicPhase[]).map(
              (phase, index) => {
                const config = PHASE_CONFIGS[phase]
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
                <Activity size={20} color={colors.success} />
                <Text style={styles.featureText}>Suivi quotidien personnalisé</Text>
              </View>
              <View style={styles.featureItem}>
                <Watch size={20} color={colors.accent.primary} />
                <Text style={styles.featureText}>Connexion montre connectée</Text>
              </View>
              <View style={styles.featureItem}>
                <Brain size={20} color={colors.secondary.primary} />
                <Text style={styles.featureText}>Conseils IA adaptés à ton état</Text>
              </View>
              <View style={styles.featureItem}>
                <TrendingUp size={20} color={colors.warning} />
                <Text style={styles.featureText}>Progression sans frustration</Text>
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
            <Zap size={20} color="#FFFFFF" />
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
          <View>
            <Text style={styles.title}>Relance Métabolique</Text>
            <Text style={styles.subtitle}>Semaine {currentWeek}</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleUnenroll}
          >
            <Text style={styles.settingsText}>Quitter</Text>
          </TouchableOpacity>
        </View>

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
              <Text style={styles.currentPhaseDesc}>{phaseConfig.description}</Text>
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
                Passer à la phase suivante
              </Text>
              <ChevronRight size={20} color={colors.success} />
            </TouchableOpacity>
          )}

          {!canProgress && reason && currentPhase !== 'full_program' && (
            <View style={styles.progressHint}>
              <Clock size={16} color={colors.text.muted} />
              <Text style={styles.progressHintText}>{reason}</Text>
            </View>
          )}
        </Card>

        {/* Streaks */}
        <View style={styles.streaksRow}>
          <Card style={styles.streakCard}>
            <Text style={styles.streakValue}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>Jours d'affilée</Text>
          </Card>
          <Card style={styles.streakCard}>
            <Text style={styles.streakValue}>{longestStreak}</Text>
            <Text style={styles.streakLabel}>Record</Text>
          </Card>
          <Card style={styles.streakCard}>
            <Text style={styles.streakValue}>{dailyLogs.length}</Text>
            <Text style={styles.streakLabel}>Jours loggés</Text>
          </Card>
        </View>

        {/* Daily Targets */}
        <Text style={styles.sectionTitle}>Objectifs du jour</Text>
        <Card style={styles.targetsCard}>
          <View style={styles.targetRow}>
            <View style={styles.targetInfo}>
              <Footprints size={20} color={colors.accent.primary} />
              <View style={styles.targetText}>
                <Text style={styles.targetLabel}>Pas</Text>
                <Text style={styles.targetValue}>
                  {todayLog?.steps || 0} / {phaseConfig.dailyTargets.steps}
                </Text>
              </View>
            </View>
            <ProgressBar
              value={todayLog?.steps || 0}
              max={phaseConfig.dailyTargets.steps}
              color={colors.accent.primary}
              size="sm"
              style={styles.targetProgress}
            />
          </View>

          <View style={styles.targetRow}>
            <View style={styles.targetInfo}>
              <Moon size={20} color={colors.secondary.primary} />
              <View style={styles.targetText}>
                <Text style={styles.targetLabel}>Sommeil</Text>
                <Text style={styles.targetValue}>
                  {todayLog?.sleepHours || 0}h / {phaseConfig.dailyTargets.sleepHours}h
                </Text>
              </View>
            </View>
            <ProgressBar
              value={todayLog?.sleepHours || 0}
              max={phaseConfig.dailyTargets.sleepHours}
              color={colors.secondary.primary}
              size="sm"
              style={styles.targetProgress}
            />
          </View>

          <View style={styles.targetRow}>
            <View style={styles.targetInfo}>
              <Droplets size={20} color={colors.info} />
              <View style={styles.targetText}>
                <Text style={styles.targetLabel}>Eau</Text>
                <Text style={styles.targetValue}>
                  {todayLog?.waterLiters || 0}L / {phaseConfig.dailyTargets.waterLiters}L
                </Text>
              </View>
            </View>
            <ProgressBar
              value={(todayLog?.waterLiters || 0) * 100}
              max={phaseConfig.dailyTargets.waterLiters * 100}
              color={colors.info}
              size="sm"
              style={styles.targetProgress}
            />
          </View>
        </Card>

        {/* Quick Check-in */}
        <Text style={styles.sectionTitle}>Check-in rapide</Text>
        <Card style={styles.checkinCard}>
          <Text style={styles.checkinQuestion}>Comment te sens-tu aujourd'hui ?</Text>
          <View style={styles.checkinOptions}>
            {[1, 2, 3, 4, 5].map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.checkinOption,
                  todayLog?.energyLevel === level && styles.checkinOptionActive,
                ]}
                onPress={() => handleQuickLog('energyLevel', level)}
              >
                <Text style={styles.checkinEmoji}>
                  {level === 1 ? '😴' : level === 2 ? '😐' : level === 3 ? '🙂' : level === 4 ? '😊' : '⚡'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.checkinHint}>
            Niveau d'énergie: {todayLog?.energyLevel ? `${todayLog.energyLevel}/5` : 'Non renseigné'}
          </Text>
        </Card>

        {/* Connected Devices */}
        <Text style={styles.sectionTitle}>Montres connectées</Text>
        {hasDevices ? (
          <Card style={styles.devicesCard}>
            {connectedDevices.map((device) => (
              <View key={device.id} style={styles.deviceRow}>
                <Text style={styles.deviceIcon}>{DEVICE_INFO[device.type].icon}</Text>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceStatus}>
                    {device.lastSync
                      ? `Synchro: ${new Date(device.lastSync).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : 'Jamais synchronisé'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.deviceStatusDot,
                    { backgroundColor: device.status === 'connected' ? colors.success : colors.error },
                  ]}
                />
              </View>
            ))}
          </Card>
        ) : (
          <Card style={styles.noDevicesCard}>
            <Watch size={32} color={colors.text.muted} />
            <Text style={styles.noDevicesText}>
              Connecte une montre pour synchroniser automatiquement tes pas et ton sommeil
            </Text>
            <View style={styles.deviceButtons}>
              {(['apple_watch', 'fitbit', 'garmin'] as DeviceType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.deviceButton}
                  onPress={() => handleConnectDevice(type)}
                >
                  <Text style={styles.deviceButtonIcon}>{DEVICE_INFO[type].icon}</Text>
                  <Text style={styles.deviceButtonText}>{DEVICE_INFO[type].name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* Phase Objectives */}
        <Text style={styles.sectionTitle}>Objectifs de la phase</Text>
        <Card style={styles.objectivesCard}>
          {phaseConfig.objectives.map((objective, index) => (
            <View key={index} style={styles.objectiveRow}>
              <View style={styles.objectiveCheck}>
                <Check size={14} color={colors.success} />
              </View>
              <Text style={styles.objectiveText}>{objective}</Text>
            </View>
          ))}
        </Card>

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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  settingsButton: {
    padding: spacing.sm,
  },
  settingsText: {
    ...typography.small,
    color: colors.error,
  },
  // Hero section (not enrolled)
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  heroIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
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
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  enrollButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  // Phase progress card
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
    color: colors.warning,
  },
  streakLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  // Targets
  targetsCard: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  targetRow: {
    gap: spacing.sm,
  },
  targetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  targetText: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  targetValue: {
    ...typography.small,
    color: colors.text.secondary,
  },
  targetProgress: {
    marginLeft: 28,
  },
  // Check-in
  checkinCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  checkinQuestion: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  checkinOptions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  checkinOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 24,
  },
  checkinHint: {
    ...typography.caption,
    color: colors.text.muted,
  },
  // Devices
  devicesCard: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  deviceStatus: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  deviceStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  noDevicesCard: {
    marginBottom: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  noDevicesText: {
    ...typography.small,
    color: colors.text.secondary,
    textAlign: 'center',
    marginVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  deviceButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  deviceButton: {
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    minWidth: 80,
  },
  deviceButtonIcon: {
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  deviceButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  // Objectives
  objectivesCard: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  objectiveCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  objectiveText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
})
