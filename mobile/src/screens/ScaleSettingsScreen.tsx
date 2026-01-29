import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native'
import { useToast } from '../components/ui/Toast'
import { useNavigation } from '@react-navigation/native'
import {
  ArrowLeft,
  Scale,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  Info,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'

import { Card } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import {
  isHealthAvailable,
  getHealthModuleDiagnostics,
  requestHealthPermissions,
  getWeightDataFromScale,
  getCompatibleScales,
  getScaleSetupInstructions,
  type HealthPermissionStatus,
} from '../services/health-service'

export default function ScaleSettingsScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const toast = useToast()
  const { profile, addWeightEntry, lastHealthSyncDate, setLastHealthSyncDate, weightHistory } = useUserStore()

  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [permissions, setPermissions] = useState<HealthPermissionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncedCount, setSyncedCount] = useState(0)

  // Check availability and auto-sync if already connected
  useEffect(() => {
    checkAndAutoSync()
  }, [])

  const checkAndAutoSync = async () => {
    const available = await isHealthAvailable()
    setIsAvailable(available)

    // If health is available, try to sync automatically
    // This also implicitly checks if we have permissions
    if (available) {
      await handleAutoSync()
    }
  }

  // Auto-sync without user feedback (silent)
  // Uses lastHealthSyncDate to avoid re-syncing already imported data
  const handleAutoSync = async () => {
    setIsSyncing(true)
    try {
      // Determine start date: use last sync date if available, otherwise 30 days ago
      let startDate: Date
      if (lastHealthSyncDate) {
        // Start from the day after last sync to avoid duplicates
        startDate = new Date(lastHealthSyncDate)
        startDate.setDate(startDate.getDate() + 1)
        console.log('[ScaleSettings] Syncing from last sync date:', startDate.toISOString())
      } else {
        // First sync: get last 30 days
        startDate = new Date()
        startDate.setDate(startDate.getDate() - 30)
        console.log('[ScaleSettings] First sync, getting last 30 days from:', startDate.toISOString())
      }

      // Don't sync if start date is in the future (already synced today)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (startDate > today) {
        console.log('[ScaleSettings] Already synced today, skipping')
        setPermissions({ steps: false, sleep: false, calories: false, weight: true, bodyFat: false, isAvailable: true })
        setIsSyncing(false)
        return
      }

      const weightData = await getWeightDataFromScale(startDate)

      if (weightData.length > 0) {
        let imported = 0
        // Get existing dates in weight history to avoid duplicates
        const existingDates = new Set(weightHistory.map(e => e.date.split('T')[0]))

        for (const data of weightData) {
          const dataDate = data.date.split('T')[0]

          // Skip if we already have an entry for this date
          if (existingDates.has(dataDate)) {
            console.log(`[ScaleSettings] Skipping ${dataDate} - already exists in history`)
            continue
          }

          const heightInMeters = profile?.height ? profile.height / 100 : null
          const bmi = heightInMeters ? data.weight / (heightInMeters * heightInMeters) : undefined

          addWeightEntry({
            id: `scale-${dataDate}-${data.weight}`,
            date: data.date,
            weight: data.weight,
            source: 'scale',
            bodyFatPercent: data.bodyFatPercent,
            bmi: bmi ? Math.round(bmi * 10) / 10 : undefined,
          })
          imported++
          existingDates.add(dataDate) // Track newly added dates
        }

        if (imported > 0) {
          setSyncedCount(imported)
          setLastSync(new Date())
          // Update last sync date to today
          setLastHealthSyncDate(new Date().toISOString().split('T')[0])
          console.log(`[ScaleSettings] Imported ${imported} new weight entries`)
        }
        setPermissions({ steps: false, sleep: false, calories: false, weight: true, bodyFat: false, isAvailable: true })
      } else {
        // No new data but permissions might still be granted
        // Update last sync date anyway to avoid re-querying
        setLastHealthSyncDate(new Date().toISOString().split('T')[0])
        setPermissions({ steps: false, sleep: false, calories: false, weight: true, bodyFat: false, isAvailable: true })
      }
    } catch (error) {
      console.log('[ScaleSettings] Auto-sync failed (probably no permissions yet):', error)
    } finally {
      setIsSyncing(false)
    }
  }

  const showHealthDiagnostics = async () => {
    const diag = getHealthModuleDiagnostics()
    const available = await isHealthAvailable()
    Alert.alert(
      'Diagnostic Santé',
      [
        `Plateforme: ${diag.platform}`,
        `Modules natifs dispo: ${diag.nativeModulesAvailable}`,
        `HealthKit module: ${diag.hasAppleHealthKit}`,
        `initHealthKit: ${diag.hasInitHealthKit}`,
        `Constants: ${diag.hasHealthKitConstants}`,
        `Permissions constants: ${diag.hasHealthKitPermissionsConstants}`,
        `Health disponible (runtime): ${available}`,
      ].join('\n'),
      [{ text: 'OK' }]
    )
  }

  const handleConnect = async () => {
    setIsLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      // Check availability first
      const available = await isHealthAvailable()
      if (!available) {
        Alert.alert(
          'Apple Santé non disponible',
          "LYM ne peut pas accéder à Santé dans cette build (souvent: build sans HealthKit / Expo Go / entitlement manquant).\n\nAppuie sur 'Diagnostic' pour voir la cause.",
          [
            { text: 'Diagnostic', onPress: showHealthDiagnostics },
            { text: 'OK' },
          ]
        )
        setIsLoading(false)
        return
      }

      const result = await requestHealthPermissions()
      console.log('[ScaleSettings] Permission result:', JSON.stringify(result))
      setPermissions(result)

      if (result.weight) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        toast.success('Connexion réussie !')
        // Auto-sync after connecting
        await handleSync()
      } else if (!result.isAvailable) {
        Alert.alert(
          'Connexion impossible',
          'La connexion à Apple Santé a échoué. Réessaie ou vérifie les paramètres de ton iPhone.',
          [{ text: 'OK' }]
        )
      } else {
        Alert.alert(
          'Permissions requises',
          'Pour synchroniser ton poids, va dans Réglages > Santé > Accès aux données > LYM et active "Poids".',
          [
            { text: 'Diagnostic', onPress: showHealthDiagnostics },
            { text: 'OK' },
          ]
        )
      }
    } catch (error) {
      console.error('Connection error:', error)
      toast.error('Erreur de connexion. Réessaie.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    try {
      // Fetch weight data from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const weightData = await getWeightDataFromScale(thirtyDaysAgo)

      if (weightData.length > 0) {
        // Import new weight entries
        let imported = 0
        for (const data of weightData) {
          // Calculate BMI if we have height
          const heightInMeters = profile?.height ? profile.height / 100 : null
          const bmi = heightInMeters ? data.weight / (heightInMeters * heightInMeters) : undefined

          addWeightEntry({
            id: `scale-${Date.now()}-${imported}`,
            date: data.date,
            weight: data.weight,
            source: 'scale',
            bodyFatPercent: data.bodyFatPercent,
            bmi: bmi ? Math.round(bmi * 10) / 10 : undefined,
          })
          imported++
        }

        setSyncedCount(imported)
        setLastSync(new Date())
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        toast.success(`${imported} mesure${imported > 1 ? 's' : ''} importee${imported > 1 ? 's' : ''}`)
      } else {
        toast.info('Aucune mesure trouvee')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Erreur de synchronisation')
    } finally {
      setIsSyncing(false)
    }
  }

  const isConnected = permissions?.weight || false
  const instructions = getScaleSetupInstructions()
  const compatibleScales = getCompatibleScales()
  const platformName = Platform.OS === 'ios' ? 'Apple Santé' : 'Health Connect'

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: colors.bg.secondary }]}
        >
          <ArrowLeft size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>Balance connectée</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <Card padding="none" style={{ backgroundColor: colors.bg.elevated, overflow: 'hidden' }}>
          <LinearGradient
            colors={isConnected
              ? [colors.success + '20', colors.bg.elevated]
              : [colors.accent.primary + '20', colors.bg.elevated]
            }
            style={styles.statusGradient}
          >
            <View style={styles.statusContent}>
              <View style={[
                styles.statusIcon,
                { backgroundColor: isConnected ? colors.success + '20' : colors.accent.light }
              ]}>
                {isConnected ? (
                  <CheckCircle2 size={32} color={colors.success} />
                ) : (
                  <Scale size={32} color={colors.accent.primary} />
                )}
              </View>

              <Text style={[styles.statusTitle, { color: colors.text.primary }]}>
                {isConnected ? 'Connecté' : 'Non connecté'}
              </Text>

              <Text style={[styles.statusDescription, { color: colors.text.secondary }]}>
                {isConnected
                  ? `Tes données sont synchronisées automatiquement`
                  : `Connecte-toi à ${platformName} pour importer tes mesures`
                }
              </Text>

              {!isConnected ? (
                <TouchableOpacity
                  style={[
                    styles.connectButton,
                    { backgroundColor: isAvailable === false ? colors.text.muted : colors.accent.primary }
                  ]}
                  onPress={handleConnect}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Smartphone size={20} color="#FFFFFF" />
                      <Text style={styles.connectButtonText}>
                        Connecter à {platformName}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.syncButton, { backgroundColor: colors.bg.secondary }]}
                  onPress={handleSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator color={colors.accent.primary} size="small" />
                  ) : (
                    <>
                      <RefreshCw size={20} color={colors.accent.primary} />
                      <Text style={[styles.syncButtonText, { color: colors.accent.primary }]}>
                        Actualiser
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {isAvailable === false && (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[styles.infoDisclaimer, { color: colors.text.tertiary, textAlign: 'center' }]}> 
                    Santé n'est pas disponible dans cette build. Utilise une build TestFlight/EAS avec HealthKit activé.
                  </Text>
                  <TouchableOpacity onPress={showHealthDiagnostics} style={{ marginTop: spacing.sm }}>
                    <Text style={{ color: colors.accent.primary, textAlign: 'center', fontWeight: '600' }}>
                      Voir le diagnostic
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {lastSync && (
                <Text style={[styles.lastSyncText, { color: colors.text.tertiary }]}>
                  Dernière sync: {lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {syncedCount > 0 && ` • ${syncedCount} mesure${syncedCount > 1 ? 's' : ''}`}
                </Text>
              )}
            </View>
          </LinearGradient>
        </Card>


        {/* Setup Instructions */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
          Comment ça marche
        </Text>

        <Card style={{ backgroundColor: colors.bg.elevated }}>
          {instructions.map((instruction, index) => (
            <View key={index} style={styles.instructionRow}>
              <View style={[styles.instructionNumber, { backgroundColor: colors.accent.light }]}>
                <Text style={[styles.instructionNumberText, { color: colors.accent.primary }]}>
                  {index + 1}
                </Text>
              </View>
              <Text style={[styles.instructionText, { color: colors.text.primary }]}>
                {instruction.replace(/^\d+\.\s*/, '')}
              </Text>
            </View>
          ))}
        </Card>

        {/* Data Info */}
        <Card style={[styles.infoCard, { backgroundColor: colors.bg.secondary }]}>
          <View style={styles.infoHeader}>
            <Info size={20} color={colors.accent.primary} />
            <Text style={[styles.infoTitle, { color: colors.text.primary }]}>
              Données importées
            </Text>
          </View>
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            Nous importons uniquement les <Text style={{ fontWeight: '600' }}>données fiables</Text> :
          </Text>
          <View style={styles.dataList}>
            <View style={styles.dataItem}>
              <CheckCircle2 size={16} color={colors.success} />
              <Text style={[styles.dataItemText, { color: colors.text.primary }]}>
                Poids (mesure directe)
              </Text>
            </View>
            <View style={styles.dataItem}>
              <CheckCircle2 size={16} color={colors.success} />
              <Text style={[styles.dataItemText, { color: colors.text.primary }]}>
                IMC (calcul automatique)
              </Text>
            </View>
            <View style={styles.dataItem}>
              <Info size={16} color={colors.warning} />
              <Text style={[styles.dataItemText, { color: colors.text.secondary }]}>
                Graisse corporelle % (estimation bio-impédance)
              </Text>
            </View>
          </View>
          <Text style={[styles.infoDisclaimer, { color: colors.text.tertiary }]}>
            Les autres métriques (masse musculaire, osseuse, etc.) sont des estimations peu fiables et ne sont pas importées.
          </Text>
        </Card>

        {/* Compatible Scales */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
          Balances compatibles
        </Text>

        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          {compatibleScales.slice(0, 6).map((scale, index) => (
            <View
              key={index}
              style={[
                styles.scaleItem,
                index < 5 && { borderBottomWidth: 1, borderBottomColor: colors.border.light }
              ]}
            >
              <Scale size={20} color={colors.text.tertiary} />
              <View style={styles.scaleInfo}>
                <Text style={[styles.scaleName, { color: colors.text.primary }]}>
                  {scale.name}
                </Text>
                <Text style={[styles.scaleBrand, { color: colors.text.tertiary }]}>
                  {scale.brand}
                </Text>
              </View>
            </View>
          ))}
          <View style={[styles.scaleItem, { backgroundColor: colors.bg.secondary }]}>
            <Text style={[styles.moreScalesText, { color: colors.text.secondary }]}>
              + Toutes les balances qui synchronisent avec {platformName}
            </Text>
          </View>
        </Card>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.default,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...typography.h4,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.default,
    paddingBottom: spacing['3xl'],
  },
  statusGradient: {
    padding: spacing.xl,
  },
  statusContent: {
    alignItems: 'center',
  },
  statusIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  statusDescription: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    minWidth: 200,
  },
  connectButtonText: {
    ...typography.bodySemibold,
    color: '#FFFFFF',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    minWidth: 180,
  },
  syncButtonText: {
    ...typography.bodySemibold,
  },
  lastSyncText: {
    ...typography.small,
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionNumberText: {
    ...typography.bodySemibold,
  },
  instructionText: {
    ...typography.body,
    flex: 1,
    lineHeight: 22,
  },
  infoCard: {
    marginTop: spacing.lg,
    padding: spacing.default,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoTitle: {
    ...typography.bodySemibold,
  },
  infoText: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  dataList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dataItemText: {
    ...typography.body,
  },
  infoDisclaimer: {
    ...typography.small,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  scaleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.default,
  },
  scaleInfo: {
    flex: 1,
  },
  scaleName: {
    ...typography.bodyMedium,
  },
  scaleBrand: {
    ...typography.small,
    marginTop: 2,
  },
  moreScalesText: {
    ...typography.small,
    textAlign: 'center',
    flex: 1,
  },
})
