/**
 * Backup & Sync Settings Screen
 *
 * Allows users to:
 * - Sign in with Google for cloud sync
 * - Enable/disable cloud synchronization
 * - Create and restore local backups
 * - View sync status and history
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Share,
  Image,
} from 'react-native'
import { useToast } from '../components/ui/Toast'
import { useNavigation } from '@react-navigation/native'
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Upload,
  Shield,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Clock,
  ChevronRight,
  LogOut,
  User,
  Lock,
  Mail,
} from 'lucide-react-native'
import * as Haptics from 'expo-haptics'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'

import { Card } from '../components/ui'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, typography, radius } from '../constants/theme'
import { useAuthStore } from '../stores/auth-store'
import { signInWithGoogle, signInWithGoogleToken, isGoogleAuthConfigured as checkGoogleConfigured } from '../services/google-auth-service'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/RootNavigator'

export default function BackupSettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { colors } = useTheme()
  const toast = useToast()

  // Auth store
  const {
    isAuthenticated,
    authMethod,
    email,
    displayName,
    avatarUrl,
    syncEnabled,
    syncStatus,
    lastSyncAt,
    autoBackupEnabled,
    backupFrequency,
    lastBackupAt,
    lastError,
    signInWithGoogleToken,
    signOut,
    enableSync,
    disableSync,
    triggerSync,
    createBackup,
    restoreBackup,
    setAutoBackup,
    clearError,
    isGoogleConfigured,
  } = useAuthStore()

  // Local state
  const [isLoading, setIsLoading] = useState(false)
  const [showBackupOptions, setShowBackupOptions] = useState(false)

  // Handle Google Sign-In button press
  const handleGoogleSignInPress = async () => {
    setIsLoading(true)
    try {
      console.log('[BackupSettings] Starting Google Sign-In...')
      const result = await signInWithGoogle()
      console.log('[BackupSettings] Result:', JSON.stringify(result))

      // STRICT CHECK: Must have success=true AND user with email AND (accessToken OR idToken)
      if (result.success && result.user?.email && (result.accessToken || result.idToken)) {
        console.log('[BackupSettings] Auth successful, user:', result.user.email)
        
        // Pass both tokens to store
        const storeResult = await signInWithGoogleToken(result.accessToken || '', result.idToken)
        
        if (storeResult.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          toast.success('Connexion réussie')
        } else {
          console.log('[BackupSettings] Store sync failed:', storeResult.error)
          toast.error(storeResult.error || 'Erreur de synchronisation')
        }
      } else {
        console.log('[BackupSettings] Auth failed or incomplete:', result.error)
        toast.error(result.error || 'Authentification incomplète')
      }
    } catch (error: any) {
      console.error('[BackupSettings] Error:', error)
      toast.error(error?.message || 'Erreur de connexion Google')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = () => {
    Alert.alert(
      'Se déconnecter',
      'Tes données locales seront conservées. Veux-tu continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            await signOut()
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          },
        },
      ]
    )
  }

  const handleToggleSync = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (value) {
      await enableSync()
    } else {
      disableSync()
    }
  }

  const handleManualSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsLoading(true)
    try {
      const result = await triggerSync()
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        toast.success('Synchronisation terminee')
      } else {
        toast.error(result.error || 'Erreur de sync, reessayez')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateBackup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setIsLoading(true)
    try {
      const result = await createBackup()
      if (result.success && result.backup) {
        // Propose to share the backup
        await Share.share({
          message: result.backup,
          title: 'LYM Backup',
        })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        toast.success('Sauvegarde creee')
      } else {
        toast.error(result.error || 'Impossible de creer la sauvegarde')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestoreBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      })

      if (result.canceled) return

      const file = result.assets[0]
      if (!file.uri) return

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      setIsLoading(true)

      const content = await FileSystem.readAsStringAsync(file.uri)
      const restoreResult = await restoreBackup(content)

      if (restoreResult.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        toast.success('Donnees restaurees')
      } else {
        toast.error(restoreResult.error || 'Fichier invalide')
      }
    } catch (error) {
      toast.error('Impossible de lire le fichier')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case 'success':
        return colors.success
      case 'error':
        return colors.error
      case 'syncing':
        return colors.accent.primary
      default:
        return colors.text.tertiary
    }
  }

  const getSyncStatusText = () => {
    switch (syncStatus) {
      case 'success':
        return 'Synchronisé'
      case 'error':
        return 'Erreur'
      case 'syncing':
        return 'En cours...'
      case 'offline':
        return 'Hors ligne'
      default:
        return 'Inactif'
    }
  }

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
        <Text style={[styles.title, { color: colors.text.primary }]}>Sauvegarde Cloud</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>
          COMPTE
        </Text>

        {isAuthenticated && authMethod !== 'anonymous' ? (
          <>
            <Card style={{ backgroundColor: colors.bg.elevated }}>
              <View style={styles.accountInfo}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent.light }]}>
                    <User size={24} color={colors.accent.primary} />
                  </View>
                )}
                <View style={styles.accountDetails}>
                  <Text style={[styles.accountName, { color: colors.text.primary }]}>
                    {displayName || 'Utilisateur'}
                  </Text>
                  <Text style={[styles.accountEmail, { color: colors.text.tertiary }]}>
                    {email}
                  </Text>
                  <View style={styles.accountBadge}>
                    {authMethod === 'google' && (
                      <Text style={[styles.badgeText, { color: colors.accent.primary }]}>
                        Google
                      </Text>
                    )}
                    {authMethod === 'email' && (
                      <View style={styles.emailBadge}>
                        <Mail size={12} color={colors.accent.primary} />
                        <Text style={[styles.badgeText, { color: colors.accent.primary }]}>
                          Email
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleSignOut}
                  style={[styles.signOutButton, { backgroundColor: colors.bg.secondary }]}
                >
                  <LogOut size={18} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </Card>

            {/* Change Password Option (Email users only) */}
            {authMethod === 'email' && (
              <Card padding="none" style={{ backgroundColor: colors.bg.elevated, marginTop: spacing.md }}>
                <TouchableOpacity
                  style={styles.settingItem}
                  onPress={() => navigation.navigate('ChangePassword')}
                >
                  <View style={[styles.settingIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                    <Lock size={22} color="#8B5CF6" />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                      Modifier le mot de passe
                    </Text>
                    <Text style={[styles.settingDescription, { color: colors.text.tertiary }]}>
                      Changer ton mot de passe
                    </Text>
                  </View>
                  <ChevronRight size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              </Card>
            )}
          </>
        ) : (
          <Card style={{ backgroundColor: colors.bg.elevated }}>
            <View style={styles.signInPrompt}>
              <Cloud size={40} color={colors.accent.primary} />
              <Text style={[styles.signInTitle, { color: colors.text.primary }]}>
                Connecte-toi pour synchroniser
              </Text>
              <Text style={[styles.signInDescription, { color: colors.text.tertiary }]}>
                Tes données seront sauvegardées automatiquement et accessibles sur tous tes appareils.
              </Text>

              {isGoogleConfigured() ? (
                <TouchableOpacity
                  style={[styles.googleButton, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DADCE0' }]}
                  onPress={handleGoogleSignInPress}
                  disabled={isLoading || !checkGoogleConfigured()}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#4285F4" />
                  ) : (
                    <>
                      <Image
                        source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                        style={styles.googleIcon}
                      />
                      <Text style={styles.googleButtonTextDark}>Continuer avec Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.notConfiguredBanner, { backgroundColor: colors.bg.secondary }]}>
                  <AlertCircle size={20} color={colors.warning} />
                  <Text style={[styles.notConfiguredText, { color: colors.text.secondary }]}>
                    Google OAuth non configuré. Ajoutez les variables d'environnement.
                  </Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Sync Section */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary, marginTop: spacing.xl }]}>
          SYNCHRONISATION
        </Text>

        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          {/* Sync Toggle */}
          <View style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
              {syncEnabled ? (
                <Cloud size={22} color={colors.accent.primary} />
              ) : (
                <CloudOff size={22} color={colors.text.tertiary} />
              )}
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                Sync cloud
              </Text>
              <Text style={[styles.settingDescription, { color: colors.text.tertiary }]}>
                Synchronisation automatique
              </Text>
            </View>
            <Switch
              value={syncEnabled}
              onValueChange={handleToggleSync}
              trackColor={{ false: colors.bg.tertiary, true: colors.accent.light }}
              thumbColor={syncEnabled ? colors.accent.primary : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
              disabled={!isAuthenticated || authMethod === 'anonymous'}
            />
          </View>

          {/* Sync Status */}
          <View style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.settingIcon, { backgroundColor: `${getSyncStatusColor()}20` }]}>
              {syncStatus === 'syncing' ? (
                <ActivityIndicator size="small" color={colors.accent.primary} />
              ) : syncStatus === 'success' ? (
                <CheckCircle size={22} color={colors.success} />
              ) : syncStatus === 'error' ? (
                <AlertCircle size={22} color={colors.error} />
              ) : (
                <Clock size={22} color={colors.text.tertiary} />
              )}
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                Statut
              </Text>
              <Text style={[styles.settingDescription, { color: getSyncStatusColor() }]}>
                {getSyncStatusText()}
              </Text>
            </View>
            <Text style={[styles.lastSyncText, { color: colors.text.tertiary }]}>
              {formatDate(lastSyncAt)}
            </Text>
          </View>

          {/* Manual Sync */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleManualSync}
            disabled={!syncEnabled || syncStatus === 'syncing'}
          >
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <RefreshCw size={22} color={syncEnabled ? colors.success : colors.text.tertiary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[
                styles.settingLabel,
                { color: syncEnabled ? colors.text.primary : colors.text.tertiary }
              ]}>
                Synchroniser maintenant
              </Text>
            </View>
            <ChevronRight size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Card>

        {/* Error Banner */}
        {lastError && (
          <TouchableOpacity
            style={[styles.errorBanner, { backgroundColor: colors.error + '20' }]}
            onPress={clearError}
          >
            <AlertCircle size={18} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{lastError}</Text>
          </TouchableOpacity>
        )}

        {/* Local Backup Section */}
        <Text style={[styles.sectionTitle, { color: colors.text.secondary, marginTop: spacing.xl }]}>
          SAUVEGARDE LOCALE
        </Text>

        <Card padding="none" style={{ backgroundColor: colors.bg.elevated }}>
          {/* Auto Backup */}
          <View style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Shield size={22} color={colors.warning} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                Backup automatique
              </Text>
              <Text style={[styles.settingDescription, { color: colors.text.tertiary }]}>
                Dernière : {formatDate(lastBackupAt)}
              </Text>
            </View>
            <Switch
              value={autoBackupEnabled}
              onValueChange={(value) => setAutoBackup(value)}
              trackColor={{ false: colors.bg.tertiary, true: 'rgba(245, 158, 11, 0.3)' }}
              thumbColor={autoBackupEnabled ? colors.warning : colors.text.tertiary}
              ios_backgroundColor={colors.bg.tertiary}
            />
          </View>

          {/* Export Backup */}
          <TouchableOpacity
            style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: colors.border.light }]}
            onPress={handleCreateBackup}
            disabled={isLoading}
          >
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <Upload size={22} color="#3B82F6" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                Exporter mes données
              </Text>
              <Text style={[styles.settingDescription, { color: colors.text.tertiary }]}>
                Créer un fichier de sauvegarde
              </Text>
            </View>
            <ChevronRight size={20} color={colors.text.tertiary} />
          </TouchableOpacity>

          {/* Import Backup */}
          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleRestoreBackup}
            disabled={isLoading}
          >
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
              <Download size={22} color="#8B5CF6" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.text.primary }]}>
                Importer une sauvegarde
              </Text>
              <Text style={[styles.settingDescription, { color: colors.text.tertiary }]}>
                Restaurer depuis un fichier
              </Text>
            </View>
            <ChevronRight size={20} color={colors.text.tertiary} />
          </TouchableOpacity>
        </Card>

        {/* Info Card */}
        <Card style={[styles.infoCard, { backgroundColor: colors.bg.secondary }]}>
          <Smartphone size={20} color={colors.text.secondary} />
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            Tes données sont stockées localement sur ton appareil. La synchronisation cloud te permet de les retrouver sur un autre appareil.
          </Text>
        </Card>
      </ScrollView>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
        </View>
      )}
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
  sectionTitle: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  // Account Section
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    ...typography.bodySemibold,
  },
  accountEmail: {
    ...typography.small,
    marginTop: 2,
  },
  accountBadge: {
    flexDirection: 'row',
    marginTop: 4,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '600',
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  signOutButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Sign In Prompt
  signInPrompt: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  signInTitle: {
    ...typography.h4,
    textAlign: 'center',
  },
  signInDescription: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
    minWidth: 220,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  googleButtonTextDark: {
    ...typography.bodyMedium,
    color: '#3C4043',
  },
  notConfiguredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  notConfiguredText: {
    ...typography.small,
    flex: 1,
  },

  // Settings
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.default,
    gap: spacing.md,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    ...typography.bodyMedium,
  },
  settingDescription: {
    ...typography.small,
    marginTop: 2,
  },
  lastSyncText: {
    ...typography.small,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.small,
    flex: 1,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xl,
    padding: spacing.default,
    gap: spacing.md,
  },
  infoText: {
    ...typography.small,
    flex: 1,
    lineHeight: 20,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
