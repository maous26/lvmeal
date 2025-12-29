import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ConnectedDevice, DeviceType, DeviceStatus, DeviceSyncData } from '../types'
import { useWellnessStore } from './wellness-store'
import { useGamificationStore, XP_REWARDS } from './gamification-store'
import HealthService from '../services/health-service'

function generateId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export const DEVICE_INFO: Record<DeviceType, { name: string; icon: string; color: string }> = {
  apple_watch: { name: 'Apple Watch', icon: '⌚', color: '#FF2D55' },
  fitbit: { name: 'Fitbit', icon: '💪', color: '#00B0B9' },
  garmin: { name: 'Garmin', icon: '🏃', color: '#007CC3' },
  samsung_health: { name: 'Samsung Health', icon: '❤️', color: '#1428A0' },
  google_fit: { name: 'Google Fit', icon: '🏋️', color: '#4285F4' },
  phone: { name: 'Téléphone', icon: '📱', color: '#34C759' },
}

interface DevicesState {
  devices: ConnectedDevice[]
  lastSyncData: Record<string, DeviceSyncData>
  isConnecting: boolean
  syncInProgress: boolean

  // Actions
  addDevice: (device: Omit<ConnectedDevice, 'id' | 'connectedAt' | 'lastSync'>) => void
  removeDevice: (deviceId: string) => void
  updateDeviceStatus: (deviceId: string, status: DeviceStatus) => void
  updateDevicePermissions: (deviceId: string, permissions: Partial<ConnectedDevice['permissions']>) => void
  syncDevice: (deviceId: string) => Promise<void>
  syncAllDevices: () => Promise<void>
  setConnecting: (isConnecting: boolean) => void

  // Phone health data
  connectPhone: () => Promise<boolean>
  syncPhoneHealth: () => Promise<void>
  hasPhoneConnected: () => boolean
  isPhoneHealthAvailable: () => Promise<boolean>

  // Getters
  getDeviceById: (deviceId: string) => ConnectedDevice | undefined
  getDevicesByType: (type: DeviceType) => ConnectedDevice[]
  hasConnectedDevices: () => boolean
  getLastSyncData: (deviceId: string) => DeviceSyncData | null
}

export const useDevicesStore = create<DevicesState>()(
  persist(
    (set, get) => ({
      devices: [],
      lastSyncData: {},
      isConnecting: false,
      syncInProgress: false,

      addDevice: (deviceData) => {
        const newDevice: ConnectedDevice = {
          ...deviceData,
          id: generateId(),
          connectedAt: new Date().toISOString(),
          lastSync: null,
        }

        set((state) => ({
          devices: [...state.devices, newDevice],
        }))

        // Gamification
        const gamification = useGamificationStore.getState()
        gamification.addXP(XP_REWARDS.CONNECT_WEARABLE, 'Appareil connecte')
      },

      removeDevice: (deviceId) => {
        set((state) => ({
          devices: state.devices.filter((d) => d.id !== deviceId),
          lastSyncData: Object.fromEntries(
            Object.entries(state.lastSyncData).filter(([id]) => id !== deviceId)
          ),
        }))
      },

      updateDeviceStatus: (deviceId, status) => {
        set((state) => ({
          devices: state.devices.map((d) =>
            d.id === deviceId ? { ...d, status } : d
          ),
        }))
      },

      updateDevicePermissions: (deviceId, permissions) => {
        set((state) => ({
          devices: state.devices.map((d) =>
            d.id === deviceId
              ? { ...d, permissions: { ...d.permissions, ...permissions } }
              : d
          ),
        }))
      },

      syncDevice: async (deviceId) => {
        const device = get().devices.find((d) => d.id === deviceId)
        if (!device) return

        set((state) => ({
          devices: state.devices.map((d) =>
            d.id === deviceId ? { ...d, status: 'syncing' } : d
          ),
        }))

        try {
          let syncData: DeviceSyncData

          // Use real health data for phone device
          if (device.type === 'phone') {
            const healthData = await HealthService.getTodayHealthData()
            if (healthData) {
              syncData = {
                steps: healthData.steps,
                sleepHours: healthData.sleepHours ?? undefined,
                activeCalories: healthData.activeCalories ?? undefined,
                lastUpdated: healthData.lastSync,
              }
            } else {
              throw new Error('Unable to fetch health data')
            }
          } else {
            // Mock data for other devices (in real app, these would use their respective SDKs)
            await new Promise((resolve) => setTimeout(resolve, 2000))
            syncData = {
              steps: Math.floor(Math.random() * 5000) + 3000,
              heartRate: Math.floor(Math.random() * 30) + 60,
              sleepHours: Math.random() * 2 + 6,
              activeCalories: Math.floor(Math.random() * 300) + 100,
              workoutMinutes: Math.floor(Math.random() * 60),
              lastUpdated: new Date().toISOString(),
            }
          }

          // Sync data to wellness store
          const wellnessStore = useWellnessStore.getState()
          if (device.permissions.steps && syncData.steps) {
            wellnessStore.logSteps(syncData.steps)
          }
          if (device.permissions.sleep && syncData.sleepHours) {
            const quality = syncData.sleepHours >= 7 ? 4 : syncData.sleepHours >= 6 ? 3 : 2
            wellnessStore.logSleep(syncData.sleepHours, quality as 1 | 2 | 3 | 4 | 5)
          }

          set((state) => ({
            devices: state.devices.map((d) =>
              d.id === deviceId
                ? { ...d, status: 'connected', lastSync: new Date().toISOString() }
                : d
            ),
            lastSyncData: {
              ...state.lastSyncData,
              [deviceId]: syncData,
            },
          }))

          // Gamification
          const gamification = useGamificationStore.getState()
          gamification.addXP(XP_REWARDS.SYNC_WEARABLE, 'Donnees synchronisees')
        } catch {
          set((state) => ({
            devices: state.devices.map((d) =>
              d.id === deviceId ? { ...d, status: 'error' } : d
            ),
          }))
        }
      },

      syncAllDevices: async () => {
        set({ syncInProgress: true })
        const devices = get().devices.filter((d) => d.status === 'connected')

        for (const device of devices) {
          await get().syncDevice(device.id)
        }

        set({ syncInProgress: false })
      },

      setConnecting: (isConnecting) => {
        set({ isConnecting })
      },

      getDeviceById: (deviceId) => {
        return get().devices.find((d) => d.id === deviceId)
      },

      getDevicesByType: (type) => {
        return get().devices.filter((d) => d.type === type)
      },

      hasConnectedDevices: () => {
        return get().devices.some((d) => d.status === 'connected')
      },

      getLastSyncData: (deviceId) => {
        return get().lastSyncData[deviceId] || null
      },

      // Check if phone health services are available
      isPhoneHealthAvailable: async () => {
        return await HealthService.isHealthAvailable()
      },

      // Check if phone is already connected
      hasPhoneConnected: () => {
        return get().devices.some((d) => d.type === 'phone' && d.status === 'connected')
      },

      // Connect phone as a health data source
      connectPhone: async () => {
        // Check if already connected
        if (get().hasPhoneConnected()) {
          return true
        }

        set({ isConnecting: true })

        try {
          // Check availability
          const isAvailable = await HealthService.isHealthAvailable()
          if (!isAvailable) {
            set({ isConnecting: false })
            return false
          }

          // Request permissions
          const permissions = await HealthService.requestHealthPermissions()
          if (!permissions.isAvailable || !permissions.steps) {
            set({ isConnecting: false })
            return false
          }

          // Add phone as device
          const phoneDevice: ConnectedDevice = {
            id: generateId(),
            type: 'phone',
            name: 'Téléphone',
            status: 'connected',
            connectedAt: new Date().toISOString(),
            lastSync: null,
            permissions: {
              steps: permissions.steps,
              heartRate: false, // Phone doesn't have HR
              sleep: permissions.sleep,
              workouts: false,
              calories: permissions.calories,
            },
          }

          set((state) => ({
            devices: [...state.devices, phoneDevice],
            isConnecting: false,
          }))

          // Gamification
          const gamification = useGamificationStore.getState()
          gamification.addXP(XP_REWARDS.CONNECT_WEARABLE, 'Telephone connecte')

          // Initial sync
          await get().syncDevice(phoneDevice.id)

          return true
        } catch (error) {
          console.log('[DevicesStore] Phone connect error:', error)
          set({ isConnecting: false })
          return false
        }
      },

      // Sync phone health data
      syncPhoneHealth: async () => {
        const phoneDevice = get().devices.find((d) => d.type === 'phone')
        if (phoneDevice) {
          await get().syncDevice(phoneDevice.id)
        }
      },
    }),
    {
      name: 'presence-devices',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        devices: state.devices,
        lastSyncData: state.lastSyncData,
      }),
    }
  )
)

export default useDevicesStore
