/**
 * Health Service - Unified interface for HealthKit (iOS) and Health Connect (Android)
 *
 * Provides access to:
 * - Steps (from phone's accelerometer)
 * - Sleep data (estimated from phone usage on Android, HealthKit on iOS)
 * - Active calories
 *
 * Note: Phone step counting is as accurate as watch for steps,
 * but less reliable for sleep (watch has heart rate monitoring)
 */

import { Platform } from 'react-native'
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
  HealthInputOptions,
} from 'react-native-health'
import {
  initialize as initializeHealthConnect,
  requestPermission as requestHealthConnectPermission,
  readRecords as readHealthConnectRecords,
  getSdkStatus,
  SdkAvailabilityStatus,
} from 'react-native-health-connect'

// Types
export interface HealthData {
  steps: number
  sleepHours: number | null
  activeCalories: number | null
  lastSync: string
  source: 'healthkit' | 'health_connect' | 'manual'
}

export interface HealthPermissionStatus {
  steps: boolean
  sleep: boolean
  calories: boolean
  isAvailable: boolean
}

// HealthKit permissions (iOS)
const healthKitPermissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [],
  },
}

// Health Connect permissions (Android)
const healthConnectPermissions = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
] as const

/**
 * Check if health services are available on this device
 */
export async function isHealthAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      AppleHealthKit.isAvailable((error, available) => {
        resolve(!error && available)
      })
    })
  } else if (Platform.OS === 'android') {
    try {
      const status = await getSdkStatus()
      return status === SdkAvailabilityStatus.SDK_AVAILABLE
    } catch {
      return false
    }
  }
  return false
}

/**
 * Request health permissions
 */
export async function requestHealthPermissions(): Promise<HealthPermissionStatus> {
  const result: HealthPermissionStatus = {
    steps: false,
    sleep: false,
    calories: false,
    isAvailable: false,
  }

  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(healthKitPermissions, (error) => {
        if (error) {
          console.log('[HealthService] HealthKit init error:', error)
          resolve(result)
          return
        }

        // HealthKit doesn't tell us which specific permissions were granted
        // We assume all were granted if init succeeded
        resolve({
          steps: true,
          sleep: true,
          calories: true,
          isAvailable: true,
        })
      })
    })
  } else if (Platform.OS === 'android') {
    try {
      const isInitialized = await initializeHealthConnect()
      if (!isInitialized) {
        return result
      }

      const grantedPermissions = await requestHealthConnectPermission(healthConnectPermissions as any)

      result.isAvailable = true
      result.steps = grantedPermissions.some((p: any) => p.recordType === 'Steps')
      result.sleep = grantedPermissions.some((p: any) => p.recordType === 'SleepSession')
      result.calories = grantedPermissions.some((p: any) => p.recordType === 'ActiveCaloriesBurned')

      return result
    } catch (error) {
      console.log('[HealthService] Health Connect error:', error)
      return result
    }
  }

  return result
}

/**
 * Get today's health data
 */
export async function getTodayHealthData(): Promise<HealthData | null> {
  const isAvailable = await isHealthAvailable()
  if (!isAvailable) {
    return null
  }

  if (Platform.OS === 'ios') {
    return getTodayHealthDataIOS()
  } else if (Platform.OS === 'android') {
    return getTodayHealthDataAndroid()
  }

  return null
}

/**
 * iOS: Get today's health data from HealthKit
 */
async function getTodayHealthDataIOS(): Promise<HealthData | null> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const options: HealthInputOptions = {
    startDate: startOfDay.toISOString(),
    endDate: now.toISOString(),
  }

  try {
    // Get steps
    const steps = await new Promise<number>((resolve) => {
      AppleHealthKit.getStepCount(options, (error, results) => {
        if (error || !results) {
          resolve(0)
          return
        }
        resolve(Math.round(results.value))
      })
    })

    // Get sleep (last night)
    const sleepStartDate = new Date(startOfDay)
    sleepStartDate.setDate(sleepStartDate.getDate() - 1)
    sleepStartDate.setHours(20, 0, 0, 0) // 8 PM yesterday

    const sleepOptions: HealthInputOptions = {
      startDate: sleepStartDate.toISOString(),
      endDate: startOfDay.toISOString(),
    }

    const sleepHours = await new Promise<number | null>((resolve) => {
      AppleHealthKit.getSleepSamples(sleepOptions, (error, results) => {
        if (error || !results || results.length === 0) {
          resolve(null)
          return
        }

        // Calculate total sleep time from samples
        let totalMinutes = 0
        results.forEach((sample: any) => {
          if (sample.value === 'ASLEEP' || sample.value === 'INBED') {
            const start = new Date(sample.startDate)
            const end = new Date(sample.endDate)
            totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60)
          }
        })

        resolve(Math.round(totalMinutes / 60 * 10) / 10) // Round to 1 decimal
      })
    })

    // Get active calories
    const activeCalories = await new Promise<number | null>((resolve) => {
      AppleHealthKit.getActiveEnergyBurned(options, (error, results) => {
        if (error || !results || results.length === 0) {
          resolve(null)
          return
        }

        const total = results.reduce((sum: number, r: HealthValue) => sum + r.value, 0)
        resolve(Math.round(total))
      })
    })

    return {
      steps,
      sleepHours,
      activeCalories,
      lastSync: now.toISOString(),
      source: 'healthkit',
    }
  } catch (error) {
    console.log('[HealthService] iOS error:', error)
    return null
  }
}

/**
 * Android: Get today's health data from Health Connect
 */
async function getTodayHealthDataAndroid(): Promise<HealthData | null> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  try {
    // Get steps
    let steps = 0
    try {
      const stepsRecords = await readHealthConnectRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: now.toISOString(),
        },
      })

      steps = stepsRecords.records.reduce((sum: number, r: any) => sum + (r.count || 0), 0)
    } catch (e) {
      console.log('[HealthService] Steps read error:', e)
    }

    // Get sleep (last night)
    let sleepHours: number | null = null
    try {
      const sleepStartDate = new Date(startOfDay)
      sleepStartDate.setDate(sleepStartDate.getDate() - 1)
      sleepStartDate.setHours(20, 0, 0, 0)

      const sleepRecords = await readHealthConnectRecords('SleepSession', {
        timeRangeFilter: {
          operator: 'between',
          startTime: sleepStartDate.toISOString(),
          endTime: startOfDay.toISOString(),
        },
      })

      if (sleepRecords.records.length > 0) {
        let totalMinutes = 0
        sleepRecords.records.forEach((session: any) => {
          const start = new Date(session.startTime)
          const end = new Date(session.endTime)
          totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60)
        })
        sleepHours = Math.round(totalMinutes / 60 * 10) / 10
      }
    } catch (e) {
      console.log('[HealthService] Sleep read error:', e)
    }

    // Get active calories
    let activeCalories: number | null = null
    try {
      const caloriesRecords = await readHealthConnectRecords('ActiveCaloriesBurned', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: now.toISOString(),
        },
      })

      if (caloriesRecords.records.length > 0) {
        activeCalories = Math.round(
          caloriesRecords.records.reduce((sum: number, r: any) => sum + (r.energy?.inKilocalories || 0), 0)
        )
      }
    } catch (e) {
      console.log('[HealthService] Calories read error:', e)
    }

    return {
      steps,
      sleepHours,
      activeCalories,
      lastSync: now.toISOString(),
      source: 'health_connect',
    }
  } catch (error) {
    console.log('[HealthService] Android error:', error)
    return null
  }
}

/**
 * Get step count for a specific date range
 */
export async function getStepsForDateRange(
  startDate: Date,
  endDate: Date
): Promise<number> {
  const isAvailable = await isHealthAvailable()
  if (!isAvailable) return 0

  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      AppleHealthKit.getStepCount(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        (error, results) => {
          if (error || !results) {
            resolve(0)
            return
          }
          resolve(Math.round(results.value))
        }
      )
    })
  } else if (Platform.OS === 'android') {
    try {
      const records = await readHealthConnectRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      })
      return records.records.reduce((sum: number, r: any) => sum + (r.count || 0), 0)
    } catch {
      return 0
    }
  }

  return 0
}

export default {
  isHealthAvailable,
  requestHealthPermissions,
  getTodayHealthData,
  getStepsForDateRange,
}
