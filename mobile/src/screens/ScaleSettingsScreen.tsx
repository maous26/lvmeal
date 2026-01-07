import React, { useEffect, useState, useCallback } from 'react'
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
  XCircle,
  Info,
  ChevronRight,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'

import { Card } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { useUserStore } from '../stores/user-store'
import {
  isHealthAvailable,
  requestHealthPermissions,
  getWeightDataFromScale,
  getLatestWeightFromScale,
  getCompatibleScales,
  getScaleSetupInstructions,
  type HealthPermissionStatus,
  type ScaleWeightData,
} from '../services/health-service'

export default function ScaleSettingsScreen() {
  const navigation = useNavigation()
  const { colors } = useTheme()
  const toast = useToast()
  const { profile, addWeightEntry } = useUserStore()

  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [permissions, setPermissions] = useState<HealthPermissionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [syncedCount, setSyncedCount] = useState(0)

  // Check availability on mount
  useEffect(() => {
    checkAvailability()
  }, [])

  const checkAvailability = async () => {
    const available = await isHealthAvailable()
    setIsAvailable(available)
  }

  const handleConnect = async () => {
    setIsLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      const result = await requestHealthPermissions()
      setPermissions(result)

      if (result.weight) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        // Auto-sync after connecting
        await handleSync()
      } else {
        Alert.alert(
          'Permissions requises',
          'Autorise l\'accès au poids dans les paramètres de ton téléphone.',
          [{ text: 'OK' }]
        )
      }
    } catch (error) {
      console.error('Connection error:', error)
      toast.error('Impossible de se connecter. Reessayez.')
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
                  ? `Synchronisé avec ${platformName}`
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
                        Synchroniser
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
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

        {/* Availability Warning */}
        {isAvailable === false && (
          <Card style={[styles.warningCard, { backgroundColor: colors.warning + '15' }]}>
            <XCircle size={24} color={colors.warning} />
            <View style={styles.warningContent}>
              <Text style={[styles.warningTitle, { color: colors.warning }]}>
                Non disponible en mode développement
              </Text>
              <Text style={[styles.warningText, { color: colors.text.secondary }]}>
                {Platform.OS === 'ios'
                  ? 'HealthKit nécessite un build de production. Cette fonctionnalité sera disponible dans l\'app publiée.'
                  : 'Health Connect nécessite un build de production. Cette fonctionnalité sera disponible dans l\'app publiée.'}
              </Text>
              <Text style={[styles.warningHint, { color: colors.text.tertiary }]}>
                En attendant, tu peux ajouter tes mesures manuellement dans l'onglet Progrès.
              </Text>
            </View>
          </Card>
        )}

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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.default,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    ...typography.bodySemibold,
    marginBottom: 4,
  },
  warningText: {
    ...typography.small,
    lineHeight: 18,
  },
  warningHint: {
    ...typography.small,
    lineHeight: 18,
    marginTop: spacing.sm,
    fontStyle: 'italic',
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
