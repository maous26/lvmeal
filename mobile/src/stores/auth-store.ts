/**
 * Auth Store - Cloud Sync & Authentication State
 *
 * Manages user authentication state and cloud synchronization.
 * Supports both anonymous sync (device-linked) and authenticated users.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../services/supabase-client'
import {
  initCloudSync,
  getCloudUserId,
  signInWithEmail,
  signUpWithEmail,
  restoreFromCloud,
  createLocalBackup,
  restoreLocalBackup,
  checkTrialStatus,
  startTrialInCloud,
  type CloudRestoreData,
} from '../services/cloud-sync-service'
import {
  checkDeviceTrialStatus,
  registerDeviceForUser,
} from '../services/device-fingerprint-service'
import {
  signInWithGoogle,
  signInWithGoogleToken as signInWithGoogleTokenService,
  signOutGoogle,
  getCachedGoogleUser,
  isGoogleAuthConfigured,
  type GoogleAuthResult,
} from '../services/google-auth-service'
import {
  signInWithApple as signInWithAppleService,
  signInWithAppleToken as signInWithAppleTokenService,
  signOutApple,
  getCachedAppleUser,
  isAppleAuthAvailable,
  type AppleAuthResult,
} from '../services/apple-auth-service'
import { useUserStore } from './user-store'

// ============================================================================
// Types
// ============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline'
export type AuthMethod = 'anonymous' | 'email' | 'apple' | 'google'

export interface SyncStats {
  lastSyncAt: string | null
  totalSyncs: number
  failedSyncs: number
  dataSize: number // KB
}

export interface AuthState {
  // Auth status
  isAuthenticated: boolean
  authMethod: AuthMethod
  userId: string | null
  email: string | null
  displayName: string | null
  avatarUrl: string | null

  // Sync status
  syncEnabled: boolean
  syncStatus: SyncStatus
  lastSyncAt: string | null
  syncStats: SyncStats

  // Backup
  autoBackupEnabled: boolean
  lastBackupAt: string | null
  backupFrequency: 'daily' | 'weekly' | 'manual'

  // Errors
  lastError: string | null

  // Actions
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signInWithGoogleToken: (accessToken: string, idToken?: string) => Promise<{ success: boolean; error?: string }>
  signInWithAppleToken: (identityToken: string) => Promise<{ success: boolean; error?: string }>
  isAppleAvailable: () => Promise<boolean>
  signOut: () => Promise<void>
  enableSync: () => Promise<void>
  disableSync: () => void
  triggerSync: () => Promise<{ success: boolean; error?: string }>
  restoreData: () => Promise<{ success: boolean; data?: CloudRestoreData; error?: string }>
  createBackup: () => Promise<{ success: boolean; backup?: string; error?: string }>
  restoreBackup: (backupJson: string) => Promise<{ success: boolean; error?: string }>
  setSyncStatus: (status: SyncStatus) => void
  updateSyncStats: (updates: Partial<SyncStats>) => void
  setAutoBackup: (enabled: boolean, frequency?: 'daily' | 'weekly' | 'manual') => void
  clearError: () => void
  isGoogleConfigured: () => boolean
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      authMethod: 'anonymous',
      userId: null,
      email: null,
      displayName: null,
      avatarUrl: null,
      syncEnabled: false,
      syncStatus: 'idle',
      lastSyncAt: null,
      syncStats: {
        lastSyncAt: null,
        totalSyncs: 0,
        failedSyncs: 0,
        dataSize: 0,
      },
      autoBackupEnabled: true,
      lastBackupAt: null,
      backupFrequency: 'daily',
      lastError: null,

      // ========================================
      // Initialize auth state
      // ========================================
      initialize: async () => {
        try {
          // Check for existing Supabase session
          const { data: { session } } = await supabase.auth.getSession()

          if (session?.user) {
            // Determine auth method from provider
            const provider = session.user.app_metadata?.provider
            const authMethod: AuthMethod = provider === 'google' ? 'google' : 'email'

            set({
              isAuthenticated: true,
              authMethod,
              userId: session.user.id,
              email: session.user.email || null,
              displayName: session.user.user_metadata?.full_name || null,
              avatarUrl: session.user.user_metadata?.avatar_url || null,
            })
          } else {
            // Check for cached Google user
            const cachedGoogle = await getCachedGoogleUser()
            if (cachedGoogle) {
              set({
                isAuthenticated: true,
                authMethod: 'google',
                userId: cachedGoogle.id,
                email: cachedGoogle.email,
                displayName: cachedGoogle.name || null,
                avatarUrl: cachedGoogle.avatar || null,
              })
            } else {
              // Check for cached Apple user
              const cachedApple = await getCachedAppleUser()
              if (cachedApple) {
                set({
                  isAuthenticated: true,
                  authMethod: 'apple',
                  userId: cachedApple.id,
                  email: cachedApple.email || null,
                  displayName: cachedApple.name || null,
                  avatarUrl: null,
                })
              } else {
                // Check for anonymous user ID
                const anonId = await getCloudUserId()
                if (anonId) {
                  set({
                    userId: anonId,
                    authMethod: 'anonymous',
                  })
                }
              }
            }
          }

          // Initialize cloud sync if enabled
          if (get().syncEnabled) {
            await initCloudSync()
          }
        } catch (error) {
          console.error('[AuthStore] Initialize error:', error)
          set({ lastError: 'Erreur d\'initialisation' })
        }
      },

      // ========================================
      // Sign in with email
      // ========================================
      signIn: async (email: string, password: string) => {
        set({ syncStatus: 'syncing', lastError: null })

        try {
          const result = await signInWithEmail(email, password)

          if (result.success && result.user) {
            set({
              isAuthenticated: true,
              authMethod: 'email',
              userId: result.user.id,
              email: result.user.email || null,
              syncStatus: 'success',
              syncEnabled: true,
            })

            // Check and restore trial status from cloud (prevent abuse)
            const trialStatus = await checkTrialStatus()
            if (trialStatus.trialStartDate) {
              console.log('[AuthStore] Restoring trial date from cloud:', trialStatus.trialStartDate)
              const { useGamificationStore } = await import('./gamification-store')
              useGamificationStore.getState().setTrialStartDate(trialStatus.trialStartDate)
            }

            // Auto-restore from cloud on first sign-in
            await get().restoreData()

            return { success: true }
          } else {
            set({
              syncStatus: 'error',
              lastError: result.error || 'Erreur de connexion',
            })
            return { success: false, error: result.error }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue'
          set({ syncStatus: 'error', lastError: message })
          return { success: false, error: message }
        }
      },

      // ========================================
      // Sign up with email
      // ========================================
      signUp: async (email: string, password: string) => {
        set({ syncStatus: 'syncing', lastError: null })

        try {
          const result = await signUpWithEmail(email, password)

          if (result.success && result.user) {
            set({
              isAuthenticated: true,
              authMethod: 'email',
              userId: result.user.id,
              email: result.user.email || null,
              syncStatus: 'success',
              syncEnabled: true,
            })

            // ANTI-ABUSE: Double verification - account AND device
            // 1. Check if this account already used trial
            const accountTrialStatus = await checkTrialStatus()
            // 2. Check if this device already used trial (different account)
            const deviceTrialStatus = await checkDeviceTrialStatus()

            const { useGamificationStore } = await import('./gamification-store')

            if (accountTrialStatus.hasUsedTrial && accountTrialStatus.trialStartDate) {
              // Account already used trial - restore original date
              console.log('[AuthStore] Account already used trial:', accountTrialStatus.trialStartDate)
              useGamificationStore.getState().setTrialStartDate(accountTrialStatus.trialStartDate)
              // Still register device for this user
              await registerDeviceForUser(result.user.id, false)
            } else if (deviceTrialStatus.hasUsedTrial && deviceTrialStatus.trialStartDate) {
              // Device already used trial with different account - use device's trial date
              console.log('[AuthStore] Device already used trial:', deviceTrialStatus.trialStartDate)
              useGamificationStore.getState().setTrialStartDate(deviceTrialStatus.trialStartDate)
              // Sync this to the account too
              await startTrialInCloud() // Will use existing date
              await registerDeviceForUser(result.user.id, false)
            } else {
              // New user AND new device - start fresh trial
              const deviceResult = await registerDeviceForUser(result.user.id, true)
              if (deviceResult.success && deviceResult.trialStartDate) {
                console.log('[AuthStore] Started new trial:', deviceResult.trialStartDate)
                useGamificationStore.getState().setTrialStartDate(deviceResult.trialStartDate)
                // Also sync to account
                await startTrialInCloud()
              } else if (deviceResult.error) {
                // Device blocked (too many accounts) - no trial
                console.warn('[AuthStore] Device blocked:', deviceResult.error)
                // Set trial as already expired (start date in the past)
                const expiredDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                useGamificationStore.getState().setTrialStartDate(expiredDate)
              }
            }

            // Sync current local data to cloud
            await get().triggerSync()

            return { success: true }
          } else {
            set({
              syncStatus: 'error',
              lastError: result.error || 'Erreur d\'inscription',
            })
            return { success: false, error: result.error }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue'
          set({ syncStatus: 'error', lastError: message })
          return { success: false, error: message }
        }
      },

      // ========================================
      // Sign in with Google OAuth token
      // ========================================
      signInWithGoogleToken: async (accessToken: string, idToken?: string) => {
        set({ syncStatus: 'syncing', lastError: null })

        try {
          // Call the service with BOTH tokens
          const result = await signInWithGoogleTokenService(accessToken, idToken)

          if (result.success && result.user) {
            set({
              isAuthenticated: true,
              authMethod: 'google',
              userId: result.user.id,
              email: result.user.email,
              displayName: result.user.name || null,
              avatarUrl: result.user.avatar || null,
              syncStatus: 'success',
              syncEnabled: true,
            })

            // ANTI-ABUSE: Double verification - account AND device
            const accountTrialStatus = await checkTrialStatus()
            const deviceTrialStatus = await checkDeviceTrialStatus()
            const { useGamificationStore } = await import('./gamification-store')

            if (accountTrialStatus.hasUsedTrial && accountTrialStatus.trialStartDate) {
              // Account already used trial
              console.log('[AuthStore] Google account already used trial:', accountTrialStatus.trialStartDate)
              useGamificationStore.getState().setTrialStartDate(accountTrialStatus.trialStartDate)
              await registerDeviceForUser(result.user.id, false)
            } else if (deviceTrialStatus.hasUsedTrial && deviceTrialStatus.trialStartDate) {
              // Device already used trial with different account
              console.log('[AuthStore] Device already used trial:', deviceTrialStatus.trialStartDate)
              useGamificationStore.getState().setTrialStartDate(deviceTrialStatus.trialStartDate)
              await startTrialInCloud()
              await registerDeviceForUser(result.user.id, false)
            } else {
              // New user AND new device - start fresh trial
              const deviceResult = await registerDeviceForUser(result.user.id, true)
              if (deviceResult.success && deviceResult.trialStartDate) {
                console.log('[AuthStore] Started new Google trial:', deviceResult.trialStartDate)
                useGamificationStore.getState().setTrialStartDate(deviceResult.trialStartDate)
                await startTrialInCloud()
              } else if (deviceResult.error) {
                console.warn('[AuthStore] Device blocked:', deviceResult.error)
                const expiredDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                useGamificationStore.getState().setTrialStartDate(expiredDate)
              }
            }

            // Auto-restore from cloud on first sign-in
            await get().restoreData()

            return { success: true }
          } else {
            set({
              syncStatus: 'error',
              lastError: result.error || 'Erreur de connexion Google',
            })
            return { success: false, error: result.error }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue'
          set({ syncStatus: 'error', lastError: message })
          return { success: false, error: message }
        }
      },

      // ========================================
      // Sign in with Apple identity token
      // ========================================
      signInWithAppleToken: async (identityToken: string) => {
        set({ syncStatus: 'syncing', lastError: null })

        try {
          const result = await signInWithAppleTokenService(identityToken)

          if (result.success && result.user) {
            set({
              isAuthenticated: true,
              authMethod: 'apple',
              userId: result.user.id,
              email: result.user.email || null,
              displayName: result.user.name || null,
              avatarUrl: null,
              syncStatus: 'success',
              syncEnabled: true,
            })

            // ANTI-ABUSE: Double verification - account AND device
            const accountTrialStatus = await checkTrialStatus()
            const deviceTrialStatus = await checkDeviceTrialStatus()
            const { useGamificationStore } = await import('./gamification-store')

            if (accountTrialStatus.hasUsedTrial && accountTrialStatus.trialStartDate) {
              // Account already used trial
              console.log('[AuthStore] Apple account already used trial:', accountTrialStatus.trialStartDate)
              useGamificationStore.getState().setTrialStartDate(accountTrialStatus.trialStartDate)
              await registerDeviceForUser(result.user.id, false)
            } else if (deviceTrialStatus.hasUsedTrial && deviceTrialStatus.trialStartDate) {
              // Device already used trial with different account
              console.log('[AuthStore] Device already used trial:', deviceTrialStatus.trialStartDate)
              useGamificationStore.getState().setTrialStartDate(deviceTrialStatus.trialStartDate)
              await startTrialInCloud()
              await registerDeviceForUser(result.user.id, false)
            } else {
              // New user AND new device - start fresh trial
              const deviceResult = await registerDeviceForUser(result.user.id, true)
              if (deviceResult.success && deviceResult.trialStartDate) {
                console.log('[AuthStore] Started new Apple trial:', deviceResult.trialStartDate)
                useGamificationStore.getState().setTrialStartDate(deviceResult.trialStartDate)
                await startTrialInCloud()
              } else if (deviceResult.error) {
                console.warn('[AuthStore] Device blocked:', deviceResult.error)
                const expiredDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                useGamificationStore.getState().setTrialStartDate(expiredDate)
              }
            }

            // Auto-restore from cloud on first sign-in
            await get().restoreData()

            return { success: true }
          } else {
            set({
              syncStatus: 'error',
              lastError: result.error || 'Erreur de connexion Apple',
            })
            return { success: false, error: result.error }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur inconnue'
          set({ syncStatus: 'error', lastError: message })
          return { success: false, error: message }
        }
      },

      // ========================================
      // Check if Apple Sign-In is available
      // ========================================
      isAppleAvailable: async () => {
        return await isAppleAuthAvailable()
      },

      // ========================================
      // Sign out
      // ========================================
      signOut: async () => {
        try {
          const { authMethod } = get()

          // Sign out from appropriate service
          if (authMethod === 'google') {
            await signOutGoogle()
          } else if (authMethod === 'apple') {
            await signOutApple()
          } else {
            await supabase.auth.signOut()
          }

          // Generate new anonymous ID
          const newAnonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
          await AsyncStorage.setItem('lym_anonymous_user_id', newAnonId)

          set({
            isAuthenticated: false,
            authMethod: 'anonymous',
            userId: newAnonId,
            email: null,
            displayName: null,
            avatarUrl: null,
            syncStatus: 'idle',
            lastError: null,
          })
        } catch (error) {
          console.error('[AuthStore] Sign out error:', error)
        }
      },

      // ========================================
      // Enable cloud sync
      // ========================================
      enableSync: async () => {
        set({ syncEnabled: true, syncStatus: 'syncing' })

        try {
          await initCloudSync()
          set({ syncStatus: 'success' })
        } catch (error) {
          console.error('[AuthStore] Enable sync error:', error)
          set({
            syncStatus: 'error',
            lastError: 'Impossible d\'activer la synchronisation',
          })
        }
      },

      // ========================================
      // Disable cloud sync
      // ========================================
      disableSync: () => {
        set({
          syncEnabled: false,
          syncStatus: 'idle',
        })
      },

      // ========================================
      // Trigger manual sync
      // ========================================
      triggerSync: async () => {
        const { syncEnabled, syncStatus } = get()

        if (!syncEnabled) {
          return { success: false, error: 'Synchronisation désactivée' }
        }

        if (syncStatus === 'syncing') {
          return { success: false, error: 'Synchronisation en cours' }
        }

        set({ syncStatus: 'syncing', lastError: null })

        try {
          await initCloudSync()

          const now = new Date().toISOString()
          const stats = get().syncStats

          set({
            syncStatus: 'success',
            lastSyncAt: now,
            syncStats: {
              ...stats,
              lastSyncAt: now,
              totalSyncs: stats.totalSyncs + 1,
            },
          })

          return { success: true }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur de synchronisation'
          const stats = get().syncStats

          set({
            syncStatus: 'error',
            lastError: message,
            syncStats: {
              ...stats,
              failedSyncs: stats.failedSyncs + 1,
            },
          })

          return { success: false, error: message }
        }
      },

      // ========================================
      // Restore data from cloud
      // ========================================
      restoreData: async () => {
        set({ syncStatus: 'syncing', lastError: null })

        try {
          // Wait for user-store to be hydrated before restoring cloud data
          // This prevents race condition where cloud data overwrites local data
          const userStore = useUserStore.getState()
          if (!userStore._hasHydrated) {
            console.log('[AuthStore] ⏳ Waiting for user-store hydration...')
            await new Promise<void>((resolve) => {
              const unsubscribe = useUserStore.subscribe((state) => {
                if (state._hasHydrated) {
                  unsubscribe()
                  resolve()
                }
              })
              // Timeout after 5 seconds to avoid infinite wait
              setTimeout(() => {
                unsubscribe()
                resolve()
              }, 5000)
            })
            console.log('[AuthStore] ✅ User-store hydrated, proceeding with restore')
          }

          const data = await restoreFromCloud()

          if (data && data.profile) {
            console.log('[AuthStore] 📥 Restoring profile from cloud...')

            // Apply profile data to user-store (refresh reference after waiting)
            const currentUserStore = useUserStore.getState()
            const cloudProfile = data.profile.profile
            const cloudGoals = data.profile.nutrition_goals

            // Preserve hasSeenCoachWelcome: use cloud value if true, or local value
            const localHasSeenCoachWelcome = currentUserStore.hasSeenCoachWelcome
            const cloudHasSeenCoachWelcome = data.profile.has_seen_coach_welcome

            if (cloudProfile && Object.keys(cloudProfile).length > 0) {
              console.log('[AuthStore] Applying cloud profile:', Object.keys(cloudProfile))

              // Set profile (this will also recalculate nutritionGoals)
              currentUserStore.setProfile({
                ...cloudProfile,
                onboardingCompleted: true,
              })

              // Restore hasSeenCoachWelcome: true if either local or cloud says true
              if (localHasSeenCoachWelcome || cloudHasSeenCoachWelcome) {
                currentUserStore.setHasSeenCoachWelcome(true)
              }

              // If cloud has specific goals that differ from calculated ones, apply them
              if (cloudGoals && Object.keys(cloudGoals).length > 0) {
                console.log('[AuthStore] Applying cloud nutrition goals:', cloudGoals)
                currentUserStore.setNutritionGoals(cloudGoals)
              }

              currentUserStore.setOnboarded(true)
              console.log('[AuthStore] ✅ Profile restored from cloud')
            }

            set({ syncStatus: 'success' })
            return { success: true, data }
          } else {
            console.log('[AuthStore] No cloud data to restore')
            set({ syncStatus: 'idle' })
            return { success: true, data: undefined }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur de restauration'
          console.error('[AuthStore] Restore failed:', message)
          set({ syncStatus: 'error', lastError: message })
          return { success: false, error: message }
        }
      },

      // ========================================
      // Create local backup
      // ========================================
      createBackup: async () => {
        try {
          const backup = await createLocalBackup()
          const now = new Date().toISOString()

          set({ lastBackupAt: now })

          return { success: true, backup }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur de sauvegarde'
          return { success: false, error: message }
        }
      },

      // ========================================
      // Restore from local backup
      // ========================================
      restoreBackup: async (backupJson: string) => {
        try {
          await restoreLocalBackup(backupJson)
          return { success: true }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erreur de restauration'
          return { success: false, error: message }
        }
      },

      // ========================================
      // Helper actions
      // ========================================
      setSyncStatus: (status: SyncStatus) => {
        set({ syncStatus: status })
      },

      updateSyncStats: (updates: Partial<SyncStats>) => {
        set((state) => ({
          syncStats: { ...state.syncStats, ...updates },
        }))
      },

      setAutoBackup: (enabled: boolean, frequency?: 'daily' | 'weekly' | 'manual') => {
        set({
          autoBackupEnabled: enabled,
          backupFrequency: frequency || get().backupFrequency,
        })
      },

      clearError: () => {
        set({ lastError: null })
      },

      isGoogleConfigured: () => {
        return isGoogleAuthConfigured()
      },
    }),
    {
      name: 'presence-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        authMethod: state.authMethod,
        userId: state.userId,
        email: state.email,
        displayName: state.displayName,
        avatarUrl: state.avatarUrl,
        syncEnabled: state.syncEnabled,
        lastSyncAt: state.lastSyncAt,
        syncStats: state.syncStats,
        autoBackupEnabled: state.autoBackupEnabled,
        lastBackupAt: state.lastBackupAt,
        backupFrequency: state.backupFrequency,
      }),
    }
  )
)

export default useAuthStore
