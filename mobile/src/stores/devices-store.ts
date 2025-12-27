import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ConnectedDevice, DeviceType, DeviceStatus, DeviceSyncData } from '../types'
import { useWellnessStore } from './wellness-store'
import { useGamificationStore, XP_REWARDS } from './gamification-store'

function generateId(): string {
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export const DEVICE_INFO: Record<DeviceType, { name: string; icon: string; color: string }> = {
  apple_watch: { name: 'Apple Watch', icon: '⌚', color: '#FF2D55' },
  fitbit: { name: 'Fitbit', icon: '💪', color: '#00B0B9' },
  garmin: { name: 'Garmin', icon: '🏃', color: '#007CC3' },
  samsung_health: { name: 'Samsung Health', icon: '❤️', color: '#1428A0' },
  google_fit: { name: 'Google Fit', icon: '🏋️', color: '#4285F4' },
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
          // Simulate sync delay (in real app, this would call HealthKit/Google Fit APIs)
          await new Promise((resolve) => setTimeout(resolve, 2000))

          // Generate mock sync data
          const mockData: DeviceSyncData = {
            steps: Math.floor(Math.random() * 5000) + 3000,
            heartRate: Math.floor(Math.random() * 30) + 60,
            sleepHours: Math.random() * 2 + 6,
            activeCalories: Math.floor(Math.random() * 300) + 100,
            workoutMinutes: Math.floor(Math.random() * 60),
            lastUpdated: new Date().toISOString(),
          }

          // Sync data to wellness store
          const wellnessStore = useWellnessStore.getState()
          if (device.permissions.steps && mockData.steps) {
            wellnessStore.logSteps(mockData.steps)
          }
          if (device.permissions.sleep && mockData.sleepHours) {
            const quality = mockData.sleepHours >= 7 ? 4 : mockData.sleepHours >= 6 ? 3 : 2
            wellnessStore.logSleep(mockData.sleepHours, quality as 1 | 2 | 3 | 4 | 5)
          }

          set((state) => ({
            devices: state.devices.map((d) =>
              d.id === deviceId
                ? { ...d, status: 'connected', lastSync: new Date().toISOString() }
                : d
            ),
            lastSyncData: {
              ...state.lastSyncData,
              [deviceId]: mockData,
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
