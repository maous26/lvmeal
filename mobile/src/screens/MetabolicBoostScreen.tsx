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
  ChevronLeft,
  Plus,
  Minus,
  RefreshCw,
  X,
} from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'

import { Card, Badge, ProgressBar, CircularProgress, Button } from '../components/ui'
import { colors, spacing, typography, radius, fonts } from '../constants/theme'
import { useMetabolicBoostStore, PHASE_CONFIGS, type MetabolicPhase } from '../stores/metabolic-boost-store'
import { useDevicesStore, DEVICE_INFO } from '../stores/devices-store'
import { useUserStore } from '../stores/user-store'
import type { DeviceType } from '../types'

// iOS-style phase colors
const phaseColors: Record<MetabolicPhase, string> = {
  discovery: '#FF9500',    // iOS Orange
  walking: '#34C759',      // iOS Green
  resistance: '#FF3B30',   // iOS Red
  full_program: '#007AFF', // iOS Blue
}

const phaseIcons: Record<MetabolicPhase, React.ReactNode> = {
  discovery: <Heart size={20} color="#FFFFFF" />,
  walking: <Footprints size={20} color="#FFFFFF" />,
  resistance: <Dumbbell size={20} color="#FFFFFF" />,
  full_program: <Zap size={20} color="#FFFFFF" />,
}

export default function MetabolicBoostScreen() {
  const navigation = useNavigation()
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
    removeDevice,
    getLastSyncData,
  } = useDevicesStore()

  const { profile } = useUserStore()

  const phaseConfig = getCurrentPhaseConfig()
  const todayLog = getTodayLog()
  const progressPercent = getProgressPercentage()
  const { canProgress, reason } = checkPhaseProgression()

  const connectedDevices = devices.filter((d) => d.status === 'connected')
  const hasDevices = connectedDevices.length > 0
  const phoneDevice = connectedDevices.find((d) => d.type === 'phone')
  const watchDevice = connectedDevices.find((d) => d.type !== 'phone')

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

  const handleGoBack = () => {
    navigation.goBack()
  }

  const handleUnenroll = () => {
    Alert.alert(
      'Se désinscrire du programme ?',
      'Tu perdras ta progression actuelle (semaine, série, logs). Tu pourras rejoindre à nouveau plus tard mais tu recommenceras à zéro.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Me désinscrire',
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
      'Cette fonctionnalité nécessite les permissions de santé. Veux-tu continuer ?',
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

  const handleDisconnectDevice = (deviceId: string, deviceName: string) => {
    Alert.alert(
      `Déconnecter ${deviceName} ?`,
      'Les données déjà synchronisées seront conservées, mais les nouvelles données ne seront plus récupérées automatiquement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            removeDevice(deviceId)
          },
        },
      ]
    )
  }

  // Helper function to get data source label
  const getDataSourceLabel = (field: 'steps' | 'sleep') => {
    if (watchDevice) {
      return `🧪 ${DEVICE_INFO[watchDevice.type].name} (démo)`
    }
    if (phoneDevice) {
      return `🧪 Téléphone (démo)`
    }
    return '✏️ Saisie manuelle'
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
          >
            <ChevronLeft size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Relance Métabolique</Text>
            <Text style={styles.subtitle}>Phase {phaseConfig.name} - Semaine {currentWeek}</Text>
          </View>
          <View style={styles.headerSpacer} />
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

        {/* Daily Targets - Interactive */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Objectifs du jour</Text>
          {hasDevices && (
            <TouchableOpacity style={styles.syncButton} onPress={onRefresh}>
              <RefreshCw size={16} color={colors.accent.primary} />
              <Text style={styles.syncButtonText}>Sync</Text>
            </TouchableOpacity>
          )}
        </View>

        <Card style={styles.targetsCard}>
          {/* Steps - synced from watch or manual */}
          <View style={styles.targetRow}>
            <View style={styles.targetHeader}>
              <View style={styles.targetInfo}>
                <View style={[styles.targetIconBg, { backgroundColor: 'rgba(0, 119, 182, 0.1)' }]}>
                  <Footprints size={18} color={colors.accent.primary} />
                </View>
                <View>
                  <Text style={styles.targetLabel}>Pas</Text>
                  <Text style={styles.targetSource}>
                    {getDataSourceLabel('steps')}
                  </Text>
                </View>
              </View>
              <View style={styles.targetValueContainer}>
                <Text style={[
                  styles.targetValueBig,
                  (todayLog?.steps || 0) >= phaseConfig.dailyTargets.steps && styles.targetValueComplete
                ]}>
                  {todayLog?.steps?.toLocaleString() || 0}
                </Text>
                <Text style={styles.targetGoal}>/ {phaseConfig.dailyTargets.steps.toLocaleString()}</Text>
              </View>
            </View>
            <ProgressBar
              value={todayLog?.steps || 0}
              max={phaseConfig.dailyTargets.steps}
              color={(todayLog?.steps || 0) >= phaseConfig.dailyTargets.steps ? colors.success : colors.accent.primary}
              size="sm"
            />
            {!hasDevices && (
              <View style={styles.manualInputRow}>
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => handleQuickLog('steps', Math.max(0, (todayLog?.steps || 0) - 1000))}
                >
                  <Minus size={16} color={colors.text.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepButtonPrimary}
                  onPress={() => handleQuickLog('steps', (todayLog?.steps || 0) + 1000)}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.stepButtonText}>+1000</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepButtonPrimary}
                  onPress={() => handleQuickLog('steps', (todayLog?.steps || 0) + 5000)}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.stepButtonText}>+5000</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Sleep */}
          <View style={styles.targetDivider} />
          <View style={styles.targetRow}>
            <View style={styles.targetHeader}>
              <View style={styles.targetInfo}>
                <View style={[styles.targetIconBg, { backgroundColor: 'rgba(255, 107, 91, 0.1)' }]}>
                  <Moon size={18} color={colors.secondary.primary} />
                </View>
                <View>
                  <Text style={styles.targetLabel}>Sommeil</Text>
                  <Text style={styles.targetSource}>
                    {getDataSourceLabel('sleep')}
                  </Text>
                </View>
              </View>
              <View style={styles.targetValueContainer}>
                <Text style={[
                  styles.targetValueBig,
                  (todayLog?.sleepHours || 0) >= phaseConfig.dailyTargets.sleepHours && styles.targetValueComplete
                ]}>
                  {todayLog?.sleepHours || 0}h
                </Text>
                <Text style={styles.targetGoal}>/ {phaseConfig.dailyTargets.sleepHours}h</Text>
              </View>
            </View>
            <ProgressBar
              value={todayLog?.sleepHours || 0}
              max={phaseConfig.dailyTargets.sleepHours}
              color={(todayLog?.sleepHours || 0) >= phaseConfig.dailyTargets.sleepHours ? colors.success : colors.secondary.primary}
              size="sm"
            />
            {!hasDevices && (
              <View style={styles.manualInputRow}>
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => handleQuickLog('sleepHours', Math.max(0, (todayLog?.sleepHours || 0) - 0.5))}
                >
                  <Minus size={16} color={colors.text.secondary} />
                </TouchableOpacity>
                {[5, 6, 7, 8].map(hours => (
                  <TouchableOpacity
                    key={hours}
                    style={[
                      styles.hourButton,
                      todayLog?.sleepHours === hours && styles.hourButtonActive
                    ]}
                    onPress={() => handleQuickLog('sleepHours', hours)}
                  >
                    <Text style={[
                      styles.hourButtonText,
                      todayLog?.sleepHours === hours && styles.hourButtonTextActive
                    ]}>{hours}h</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => handleQuickLog('sleepHours', (todayLog?.sleepHours || 0) + 0.5)}
                >
                  <Plus size={16} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Water */}
          <View style={styles.targetDivider} />
          <View style={styles.targetRow}>
            <View style={styles.targetHeader}>
              <View style={styles.targetInfo}>
                <View style={[styles.targetIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Droplets size={18} color={colors.info} />
                </View>
                <View>
                  <Text style={styles.targetLabel}>Hydratation</Text>
                  <Text style={styles.targetSource}>✏️ Saisie manuelle</Text>
                </View>
              </View>
              <View style={styles.targetValueContainer}>
                <Text style={[
                  styles.targetValueBig,
                  (todayLog?.waterLiters || 0) >= phaseConfig.dailyTargets.waterLiters && styles.targetValueComplete
                ]}>
                  {todayLog?.waterLiters || 0}L
                </Text>
                <Text style={styles.targetGoal}>/ {phaseConfig.dailyTargets.waterLiters}L</Text>
              </View>
            </View>
            <ProgressBar
              value={(todayLog?.waterLiters || 0) * 100}
              max={phaseConfig.dailyTargets.waterLiters * 100}
              color={(todayLog?.waterLiters || 0) >= phaseConfig.dailyTargets.waterLiters ? colors.success : colors.info}
              size="sm"
            />
            <View style={styles.manualInputRow}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => handleQuickLog('waterLiters', Math.max(0, (todayLog?.waterLiters || 0) - 0.25))}
              >
                <Minus size={16} color={colors.text.secondary} />
              </TouchableOpacity>
              {[0.5, 1, 1.5, 2].map(liters => (
                <TouchableOpacity
                  key={liters}
                  style={[
                    styles.hourButton,
                    todayLog?.waterLiters === liters && styles.hourButtonActive
                  ]}
                  onPress={() => handleQuickLog('waterLiters', liters)}
                >
                  <Text style={[
                    styles.hourButtonText,
                    todayLog?.waterLiters === liters && styles.hourButtonTextActive
                  ]}>{liters}L</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => handleQuickLog('waterLiters', (todayLog?.waterLiters || 0) + 0.25)}
              >
                <Plus size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Walking minutes - Phase objective */}
          <View style={styles.targetDivider} />
          <View style={styles.targetRow}>
            <View style={styles.targetHeader}>
              <View style={styles.targetInfo}>
                <View style={[styles.targetIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Activity size={18} color={colors.success} />
                </View>
                <View>
                  <Text style={styles.targetLabel}>Marche</Text>
                  <Text style={styles.targetSource}>✏️ Saisie manuelle</Text>
                </View>
              </View>
              <View style={styles.targetValueContainer}>
                <Text style={[
                  styles.targetValueBig,
                  (todayLog?.walkingMinutes || 0) >= 30 && styles.targetValueComplete
                ]}>
                  {todayLog?.walkingMinutes || 0} min
                </Text>
                <Text style={styles.targetGoal}>/ 30 min</Text>
              </View>
            </View>
            <ProgressBar
              value={todayLog?.walkingMinutes || 0}
              max={30}
              color={(todayLog?.walkingMinutes || 0) >= 30 ? colors.success : colors.success}
              size="sm"
            />
            <View style={styles.manualInputRow}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => handleQuickLog('walkingMinutes', Math.max(0, (todayLog?.walkingMinutes || 0) - 10))}
              >
                <Minus size={16} color={colors.text.secondary} />
              </TouchableOpacity>
              {[10, 20, 30, 45].map(mins => (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.hourButton,
                    todayLog?.walkingMinutes === mins && styles.hourButtonActive
                  ]}
                  onPress={() => handleQuickLog('walkingMinutes', mins)}
                >
                  <Text style={[
                    styles.hourButtonText,
                    todayLog?.walkingMinutes === mins && styles.hourButtonTextActive
                  ]}>{mins}m</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => handleQuickLog('walkingMinutes', (todayLog?.walkingMinutes || 0) + 10)}
              >
                <Plus size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
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
        <Text style={styles.sectionTitle}>Sources de données</Text>
        <Card style={styles.devicesCard}>
          {/* Demo mode banner */}
          <View style={styles.demoBanner}>
            <Text style={styles.demoBannerIcon}>🧪</Text>
            <View style={styles.demoBannerContent}>
              <Text style={styles.demoBannerTitle}>Mode démonstration</Text>
              <Text style={styles.demoBannerText}>
                Les données des appareils sont simulées. En production, elles seront synchronisées automatiquement.
              </Text>
            </View>
          </View>

          {/* Show connected devices with disconnect option */}
          {connectedDevices.length > 0 && (
            <>
              <View style={styles.deviceDivider} />
              {connectedDevices.map((device) => (
                <View key={device.id} style={styles.deviceRow}>
                  <Text style={styles.deviceIcon}>{DEVICE_INFO[device.type].icon}</Text>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceStatusDemo}>
                      Données de démo
                    </Text>
                  </View>
                  <View style={styles.deviceActions}>
                    <Badge variant="outline" size="sm">Démo</Badge>
                    <TouchableOpacity
                      style={styles.disconnectButton}
                      onPress={() => handleDisconnectDevice(device.id, device.name)}
                    >
                      <X size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Watch connection options - show if no watch connected */}
          {!watchDevice && (
            <>
              <View style={styles.deviceDivider} />
              <Text style={styles.connectLabel}>Connecter un appareil (démo)</Text>
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
            </>
          )}
        </Card>

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

        {/* Unenroll button at bottom */}
        <TouchableOpacity style={styles.unenrollButton} onPress={handleUnenroll}>
          <Text style={styles.unenrollButtonText}>Se désinscrire du programme</Text>
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
    fontFamily: fonts.sans.bold,
  },
  subtitle: {
    ...typography.small,
    color: colors.text.secondary,
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
    fontFamily: fonts.sans.bold,
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
    color: '#FF9500', // iOS Orange
  },
  streakLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  // Section header with action
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.accent.light,
    borderRadius: radius.full,
  },
  syncButtonText: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '500',
  },
  // Targets
  targetsCard: {
    marginBottom: spacing.lg,
  },
  targetRow: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  targetDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  targetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  targetIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  targetSource: {
    ...typography.caption,
    color: colors.text.muted,
  },
  targetValueContainer: {
    alignItems: 'flex-end',
  },
  targetValueBig: {
    ...typography.h4,
    color: colors.text.primary,
  },
  targetValueComplete: {
    color: colors.success,
  },
  targetGoal: {
    ...typography.caption,
    color: colors.text.muted,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accent.primary,
    borderRadius: radius.full,
  },
  stepButtonText: {
    ...typography.smallMedium,
    color: '#FFFFFF',
  },
  hourButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
  },
  hourButtonActive: {
    backgroundColor: colors.accent.primary,
  },
  hourButtonText: {
    ...typography.smallMedium,
    color: colors.text.secondary,
  },
  hourButtonTextActive: {
    color: '#FFFFFF',
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
    gap: spacing.sm,
  },
  demoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  demoBannerIcon: {
    fontSize: 20,
  },
  demoBannerContent: {
    flex: 1,
  },
  demoBannerTitle: {
    ...typography.smallMedium,
    color: colors.warning,
    marginBottom: 2,
  },
  demoBannerText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
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
  deviceStatusDemo: {
    ...typography.caption,
    color: colors.warning,
    fontStyle: 'italic',
  },
  deviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  disconnectButton: {
    padding: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deviceDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.sm,
  },
  connectLabel: {
    ...typography.small,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
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
})
