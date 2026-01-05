/**
 * WeightScreen - Suivi du poids avec saisie manuelle et balance connectée
 *
 * Fonctionnalités:
 * - Affichage poids actuel avec tendance
 * - Progression vers objectif
 * - Graphique 30 jours
 * - Saisie manuelle (modal avec +/-)
 * - Connection balance Bluetooth (BLE)
 * - Historique des pesées
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from 'react-native'
import { useToast } from '../components/ui/Toast'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Scale,
  Plus,
  Minus,
  Bluetooth,
  Calendar,
  X,
  Check,
  Info,
} from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
// Animations temporarily disabled - Worklets version mismatch in Expo Go
import * as Haptics from 'expo-haptics'

import { useUserStore } from '../stores/user-store'
import { useDevicesStore, DEVICE_INFO } from '../stores/devices-store'
import { useGamificationStore, XP_REWARDS } from '../stores/gamification-store'
import { useTheme } from '../contexts/ThemeContext'
import type { WeightEntry, DeviceType } from '../types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// Types de balances supportées (using existing DeviceTypes)
const SUPPORTED_SCALES: { id: string; type: DeviceType; name: string; icon: string }[] = [
  { id: 'withings', type: 'fitbit', name: 'Withings', icon: '⚖️' },
  { id: 'xiaomi', type: 'fitbit', name: 'Xiaomi Mi Scale', icon: '⚖️' },
  { id: 'eufy', type: 'fitbit', name: 'Eufy Smart Scale', icon: '⚖️' },
  { id: 'renpho', type: 'fitbit', name: 'Renpho', icon: '⚖️' },
  { id: 'apple_watch', type: 'apple_watch', name: 'Apple Health', icon: '❤️' },
  { id: 'google_fit', type: 'google_fit', name: 'Google Fit', icon: '🏋️' },
]

export default function WeightScreen() {
  const navigation = useNavigation()
  const { colors, isDark } = useTheme()
  const toast = useToast()

  // Stores
  const { profile, weightHistory, addWeightEntry } = useUserStore()
  const { devices, addDevice, setConnecting } = useDevicesStore()
  const { addXP } = useGamificationStore()

  // State
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDevicesModal, setShowDevicesModal] = useState(false)
  const [newWeight, setNewWeight] = useState('')
  const [connectingDevice, setConnectingDevice] = useState<string | null>(null)

  // Derived values
  const currentWeight = profile?.weight || weightHistory[weightHistory.length - 1]?.weight || 0
  const targetWeight = profile?.targetWeight || 0
  const startWeight = weightHistory[0]?.weight || currentWeight

  // Calculate trend (last 7 days)
  const trend = useMemo(() => {
    const recentEntries = weightHistory.slice(-7)
    if (recentEntries.length < 2) return 0
    return recentEntries[recentEntries.length - 1].weight - recentEntries[0].weight
  }, [weightHistory])

  // Calculate progress
  const progress = useMemo(() => {
    if (!startWeight || !targetWeight || startWeight === targetWeight) return 0
    return Math.abs(((startWeight - currentWeight) / (startWeight - targetWeight)) * 100)
  }, [startWeight, currentWeight, targetWeight])

  const remaining = Math.abs(currentWeight - targetWeight)
  const isLosingWeight = targetWeight < startWeight

  // Generate chart data (last 30 days)
  const chartData = useMemo(() => {
    const today = new Date()
    const data: { date: string; weight: number | null; label: string }[] = []

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const entry = weightHistory.find(e => e.date === dateStr)

      data.push({
        date: dateStr,
        weight: entry?.weight || null,
        label: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      })
    }
    return data
  }, [weightHistory])

  const minWeight = useMemo(() => {
    const weights = chartData.filter(d => d.weight).map(d => d.weight!)
    if (weights.length === 0) return currentWeight - 5
    return Math.min(...weights, targetWeight || Infinity) - 2
  }, [chartData, targetWeight, currentWeight])

  const maxWeight = useMemo(() => {
    const weights = chartData.filter(d => d.weight).map(d => d.weight!)
    if (weights.length === 0) return currentWeight + 5
    return Math.max(...weights, startWeight || 0) + 2
  }, [chartData, startWeight, currentWeight])

  // Connected scales
  const connectedScales = devices.filter(d =>
    d.type === 'apple_watch' || d.type === 'google_fit' || d.name.toLowerCase().includes('scale')
  )

  // Handlers
  const handleAddWeight = useCallback(() => {
    const weight = parseFloat(newWeight)
    if (isNaN(weight) || weight <= 0) {
      toast.error('Veuillez entrer un poids valide')
      return
    }

    const entry: WeightEntry = {
      id: `weight_${Date.now()}`,
      weight,
      date: new Date().toISOString().split('T')[0],
      source: 'manual',
    }

    addWeightEntry(entry)
    addXP(XP_REWARDS.WEIGHT_LOGGED, 'Poids enregistré')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    setNewWeight('')
    setShowAddModal(false)
  }, [newWeight, addWeightEntry, addXP])

  const adjustWeight = useCallback((delta: number) => {
    setNewWeight(prev => {
      const val = parseFloat(prev) || currentWeight
      return (val + delta).toFixed(1)
    })
    Haptics.selectionAsync()
  }, [currentWeight])

  const handleConnectDevice = useCallback(async (deviceId: string, deviceType: DeviceType, deviceName: string) => {
    setConnectingDevice(deviceId)
    setConnecting(true)

    try {
      // Simulate BLE connection (in real app, use react-native-ble-plx)
      await new Promise(resolve => setTimeout(resolve, 2500))

      addDevice({
        type: deviceType,
        name: deviceName,
        status: 'connected',
        permissions: {
          steps: false,
          heartRate: false,
          sleep: false,
          workouts: false,
          calories: false,
        },
      })

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      toast.success(`${deviceName} connecte`)
    } catch (error) {
      toast.error('Impossible de connecter l\'appareil')
    } finally {
      setConnectingDevice(null)
      setConnecting(false)
    }
  }, [addDevice, setConnecting])

  // Initialize weight input with current weight
  useEffect(() => {
    if (showAddModal && !newWeight) {
      setNewWeight(currentWeight.toFixed(1))
    }
  }, [showAddModal, currentWeight, newWeight])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          Suivi du poids
        </Text>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Weight Card */}
        <View
          
          style={[styles.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}
        >
          <View style={styles.weightHeader}>
            <View>
              <Text style={[styles.labelText, { color: colors.text.tertiary }]}>
                Poids actuel
              </Text>
              <View style={styles.weightRow}>
                <Text style={[styles.weightValue, { color: colors.text.primary }]}>
                  {currentWeight || '--'}
                </Text>
                <Text style={[styles.weightUnit, { color: colors.text.secondary }]}>
                  kg
                </Text>
              </View>

              {trend !== 0 && (
                <View style={styles.trendRow}>
                  {trend < 0 ? (
                    <TrendingDown
                      size={18}
                      color={(isLosingWeight && trend < 0) || (!isLosingWeight && trend > 0)
                        ? colors.success
                        : colors.warning}
                    />
                  ) : (
                    <TrendingUp
                      size={18}
                      color={(isLosingWeight && trend < 0) || (!isLosingWeight && trend > 0)
                        ? colors.success
                        : colors.warning}
                    />
                  )}
                  <Text style={[styles.trendText, {
                    color: (isLosingWeight && trend < 0) || (!isLosingWeight && trend > 0)
                      ? colors.success
                      : colors.warning,
                  }]}>
                    {trend > 0 ? '+' : ''}{trend.toFixed(1)} kg cette semaine
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.iconBox, { backgroundColor: colors.accent.primary }]}>
              <Scale size={28} color="#FFF" />
            </View>
          </View>

          {/* Progress bar */}
          {targetWeight > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.progressLabels}>
                <Text style={[styles.progressLabel, { color: colors.text.tertiary }]}>
                  Départ: {startWeight} kg
                </Text>
                <Text style={[styles.progressLabel, { color: colors.text.tertiary }]}>
                  Objectif: {targetWeight} kg
                </Text>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: colors.border.light }]}>
                <View
                  style={[styles.progressBar, {
                    width: `${Math.min(progress, 100)}%`,
                    backgroundColor: colors.accent.primary,
                  }]}
                />
              </View>

              <View style={styles.progressFooter}>
                <Text style={[styles.progressPercent, { color: colors.text.primary }]}>
                  {Math.round(progress)}% accompli
                </Text>
                <View style={[styles.badge, {
                  backgroundColor: remaining <= 1 ? colors.successLight : colors.accent.light,
                }]}>
                  <Text style={[styles.badgeText, {
                    color: remaining <= 1 ? colors.success : colors.accent.primary,
                  }]}>
                    {remaining.toFixed(1)} kg restants
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View
          
          style={styles.actionsRow}
        >
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={[styles.primaryButton, { backgroundColor: colors.accent.primary }]}
          >
            <Plus size={22} color="#FFF" />
            <Text style={styles.primaryButtonText}>
              Ajouter une pesée
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowDevicesModal(true)}
            style={[styles.iconButton, { backgroundColor: colors.bg.secondary, borderColor: colors.border.light }]}
          >
            <Bluetooth size={24} color={colors.accent.primary} />
          </TouchableOpacity>
        </View>

        {/* Chart */}
        <View
          
          style={[styles.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}
        >
          <View style={styles.sectionHeader}>
            <Calendar size={20} color={colors.accent.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Évolution (30 jours)
            </Text>
          </View>

          {weightHistory.length > 0 ? (
            <View style={styles.chartContainer}>
              {/* Y-axis labels */}
              <View style={styles.yAxis}>
                <Text style={[styles.axisLabel, { color: colors.text.tertiary }]}>{maxWeight.toFixed(0)}</Text>
                <Text style={[styles.axisLabel, { color: colors.text.tertiary }]}>{((maxWeight + minWeight) / 2).toFixed(0)}</Text>
                <Text style={[styles.axisLabel, { color: colors.text.tertiary }]}>{minWeight.toFixed(0)}</Text>
              </View>

              {/* Chart area */}
              <View style={styles.chartArea}>
                {/* Target line */}
                {targetWeight > 0 && targetWeight >= minWeight && targetWeight <= maxWeight && (
                  <View
                    style={[styles.targetLine, {
                      bottom: `${((targetWeight - minWeight) / (maxWeight - minWeight)) * 100}%`,
                      borderColor: colors.success + '60',
                    }]}
                  />
                )}

                {/* Bars */}
                <View style={styles.barsContainer}>
                  {chartData.map((point, index) => {
                    if (!point.weight) {
                      return (
                        <View key={index} style={styles.barWrapper}>
                          <View style={[styles.emptyBar, { backgroundColor: colors.border.light }]} />
                        </View>
                      )
                    }

                    const height = Math.max(4, ((point.weight - minWeight) / (maxWeight - minWeight)) * 100)

                    return (
                      <View key={index} style={styles.barWrapper}>
                        <View
                          style={[styles.bar, {
                            height: `${height}%`,
                            backgroundColor: colors.accent.primary,
                          }]}
                        />
                      </View>
                    )
                  })}
                </View>
              </View>

              {/* X-axis labels */}
              <View style={styles.xAxis}>
                <Text style={[styles.axisLabel, { color: colors.text.tertiary }]}>{chartData[0]?.label}</Text>
                <Text style={[styles.axisLabel, { color: colors.text.tertiary }]}>{chartData[Math.floor(chartData.length / 2)]?.label}</Text>
                <Text style={[styles.axisLabel, { color: colors.text.tertiary }]}>{chartData[chartData.length - 1]?.label}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Scale size={48} color={colors.text.muted} />
              <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                Aucune pesée enregistrée
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.text.tertiary }]}>
                Ajoutez votre première pesée pour suivre votre progression
              </Text>
            </View>
          )}
        </View>

        {/* Connected Devices */}
        <View
          
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            Appareils connectés
          </Text>

          <View style={[styles.listCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}>
            {connectedScales.length === 0 ? (
              <View style={styles.emptyDevices}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.border.light }]}>
                  <Bluetooth size={24} color={colors.text.tertiary} />
                </View>
                <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                  Aucun appareil connecté
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDevicesModal(true)}
                  style={[styles.smallButton, { backgroundColor: colors.accent.light }]}
                >
                  <Plus size={18} color={colors.accent.primary} />
                  <Text style={[styles.smallButtonText, { color: colors.accent.primary }]}>
                    Connecter un appareil
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              connectedScales.map((device, index) => (
                <View
                  key={device.id}
                  style={[styles.deviceRow, {
                    borderBottomWidth: index < connectedScales.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border.light,
                  }]}
                >
                  <View style={[styles.deviceIcon, { backgroundColor: colors.successLight }]}>
                    <Text style={{ fontSize: 20 }}>
                      {DEVICE_INFO[device.type]?.icon || '⚖️'}
                    </Text>
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text style={[styles.deviceName, { color: colors.text.primary }]}>
                      {device.name}
                    </Text>
                    <Text style={[styles.deviceSync, { color: colors.text.tertiary }]}>
                      {device.lastSync
                        ? `Synchro: ${new Date(device.lastSync).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'Jamais synchronisé'}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
                    <Text style={[styles.badgeText, { color: colors.success }]}>
                      Connecté
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Recent Entries */}
        {weightHistory.length > 0 && (
          <View
            
            style={styles.section}
          >
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              Historique récent
            </Text>

            <View style={[styles.listCard, { backgroundColor: colors.bg.elevated, borderColor: colors.border.light }]}>
              {weightHistory.slice(-5).reverse().map((entry, index) => {
                const prevEntry = weightHistory[weightHistory.length - 2 - index]
                const diff = prevEntry ? entry.weight - prevEntry.weight : 0

                return (
                  <View
                    key={entry.id}
                    style={[styles.entryRow, {
                      borderBottomWidth: index < 4 ? 1 : 0,
                      borderBottomColor: colors.border.light,
                    }]}
                  >
                    <View style={[styles.entryIcon, { backgroundColor: colors.border.light }]}>
                      <Scale size={18} color={colors.text.tertiary} />
                    </View>
                    <View style={styles.entryInfo}>
                      <Text style={[styles.entryWeight, { color: colors.text.primary }]}>
                        {entry.weight} kg
                      </Text>
                      <Text style={[styles.entryDate, { color: colors.text.tertiary }]}>
                        {new Date(entry.date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </Text>
                    </View>
                    {diff !== 0 && (
                      <Text style={[styles.entryDiff, {
                        color: (isLosingWeight && diff < 0) || (!isLosingWeight && diff > 0)
                          ? colors.success
                          : colors.warning,
                      }]}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)} kg
                      </Text>
                    )}
                    <View style={[styles.sourceBadge, { backgroundColor: colors.border.light }]}>
                      <Text style={[styles.sourceText, { color: colors.text.tertiary }]}>
                        {entry.source === 'manual' ? 'Manuel' : entry.source}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Weight Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.bg.primary }]}>
            {/* Handle */}
            <View style={styles.modalHandle}>
              <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
            </View>

            <View style={styles.modalBody}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                  Nouvelle pesée
                </Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <X size={24} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>

              {/* Weight Input */}
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, { color: colors.text.tertiary }]}>
                  Entrez votre poids actuel
                </Text>

                <View style={styles.inputRow}>
                  <TouchableOpacity
                    onPress={() => adjustWeight(-0.1)}
                    style={[styles.adjustButton, { backgroundColor: colors.bg.secondary }]}
                  >
                    <Minus size={24} color={colors.text.primary} />
                  </TouchableOpacity>

                  <View style={styles.inputWrapper}>
                    <TextInput
                      value={newWeight}
                      onChangeText={setNewWeight}
                      keyboardType="decimal-pad"
                      style={[styles.weightInput, {
                        color: colors.text.primary,
                        borderBottomColor: colors.accent.primary,
                      }]}
                      placeholder={currentWeight.toString()}
                      placeholderTextColor={colors.text.muted}
                    />
                    <Text style={[styles.inputUnit, { color: colors.text.secondary }]}>
                      kg
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => adjustWeight(0.1)}
                    style={[styles.adjustButton, { backgroundColor: colors.bg.secondary }]}
                  >
                    <Plus size={24} color={colors.text.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleAddWeight}
                disabled={!newWeight || parseFloat(newWeight) <= 0}
                style={[styles.saveButton, {
                  backgroundColor: (!newWeight || parseFloat(newWeight) <= 0)
                    ? colors.border.default
                    : colors.accent.primary,
                }]}
              >
                <Check size={22} color="#FFF" />
                <Text style={styles.saveButtonText}>
                  Enregistrer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Devices Modal */}
      <Modal
        visible={showDevicesModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDevicesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowDevicesModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.bg.primary, maxHeight: '80%' }]}>
            {/* Handle */}
            <View style={styles.modalHandle}>
              <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
            </View>

            <View style={styles.modalBody}>
              {/* Header */}
              <View style={styles.devicesHeader}>
                <View style={[styles.devicesIcon, { backgroundColor: colors.accent.primary }]}>
                  <Bluetooth size={24} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                    Appareils
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowDevicesModal(false)}>
                  <X size={24} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>

              {/* Info */}
              <View style={[styles.infoBox, { backgroundColor: colors.infoLight }]}>
                <Info size={20} color={colors.info} />
                <Text style={[styles.infoText, { color: colors.text.secondary }]}>
                  Connectez vos appareils pour synchroniser automatiquement votre poids.
                </Text>
              </View>

              {/* Devices List */}
              <ScrollView style={{ maxHeight: 400 }}>
                {SUPPORTED_SCALES.map((scale) => {
                  const isConnected = devices.some(d =>
                    d.name.toLowerCase().includes(scale.name.toLowerCase().split(' ')[0])
                  )
                  const isConnectingThis = connectingDevice === scale.id

                  return (
                    <TouchableOpacity
                      key={scale.id}
                      onPress={() => !isConnected && !isConnectingThis && handleConnectDevice(scale.id, scale.type, scale.name)}
                      disabled={isConnected || isConnectingThis}
                      style={[styles.scaleRow, {
                        backgroundColor: isConnected ? colors.successLight : colors.bg.secondary,
                        borderColor: isConnected ? colors.success + '30' : colors.border.light,
                      }]}
                    >
                      <View style={[styles.scaleIcon, {
                        backgroundColor: isConnected ? colors.success + '20' : colors.border.light,
                      }]}>
                        <Text style={{ fontSize: 20 }}>{scale.icon}</Text>
                      </View>
                      <Text style={[styles.scaleName, { color: colors.text.primary }]}>
                        {scale.name}
                      </Text>
                      {isConnectingThis ? (
                        <ActivityIndicator size="small" color={colors.accent.primary} />
                      ) : isConnected ? (
                        <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
                          <Text style={[styles.badgeText, { color: colors.success }]}>
                            Connecté
                          </Text>
                        </View>
                      ) : (
                        <ChevronRight size={20} color={colors.text.tertiary} />
                      )}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>

              {/* Done Button */}
              <TouchableOpacity
                onPress={() => setShowDevicesModal(false)}
                style={[styles.doneButton, { backgroundColor: colors.accent.primary }]}
              >
                <Text style={styles.doneButtonText}>
                  Terminé
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  labelText: {
    fontSize: 14,
    marginBottom: 4,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  weightValue: {
    fontSize: 42,
    fontWeight: '700',
  },
  weightUnit: {
    fontSize: 18,
    marginLeft: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    marginTop: 20,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 5,
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  iconButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  section: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    marginBottom: 12,
  },
  chartContainer: {
    height: 160,
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 20,
    width: 35,
    justifyContent: 'space-between',
  },
  chartArea: {
    marginLeft: 40,
    height: 140,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    gap: 1,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  bar: {
    width: '80%',
    borderRadius: 2,
    minHeight: 4,
  },
  emptyBar: {
    width: '80%',
    height: 2,
    borderRadius: 1,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 40,
    marginTop: 8,
  },
  axisLabel: {
    fontSize: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  listCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyDevices: {
    padding: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  smallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  smallButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
  },
  deviceSync: {
    fontSize: 12,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  entryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  entryWeight: {
    fontSize: 16,
    fontWeight: '600',
  },
  entryDate: {
    fontSize: 12,
  },
  entryDiff: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
  },
  sourceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  inputSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    marginHorizontal: 20,
    alignItems: 'center',
  },
  weightInput: {
    fontSize: 48,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 120,
    borderBottomWidth: 2,
    paddingVertical: 8,
  },
  inputUnit: {
    fontSize: 18,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginLeft: 8,
  },
  devicesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  devicesIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
  },
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  scaleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 12,
  },
  doneButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
})
