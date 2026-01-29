/**
 * Health Service - Unified interface for HealthKit (iOS) and Health Connect (Android)
 *
 * Provides access to:
 * - Steps (from phone's accelerometer)
 * - Sleep data (estimated from phone usage on Android, HealthKit on iOS)
 * - Active calories
 * - Weight data from smart scales
 *
 * Note: Phone step counting is as accurate as watch for steps,
 * but less reliable for sleep (watch has heart rate monitoring)
 *
 * IMPORTANT: Native modules (react-native-health, react-native-health-connect)
 * are only available in development builds, NOT in Expo Go.
 */

import { Platform } from 'react-native'

// Types for native modules (imported dynamically to avoid crashes in Expo Go)
type HealthValue = { value: number; startDate: string; endDate: string }
type HealthKitPermissions = { permissions: { read: string[]; write: string[] } }
type HealthInputOptions = { startDate: string; endDate: string; ascending?: boolean; limit?: number }

// Try to import native modules, but gracefully handle if they're not available
let AppleHealthKit: any = null
let initializeHealthConnect: any = null
let requestHealthConnectPermission: any = null
let readHealthConnectRecords: any = null
let getSdkStatus: any = null
let SdkAvailabilityStatus: any = { SDK_AVAILABLE: 1 }

// Flag to track if native modules are available
let nativeModulesAvailable = false

export interface HealthModuleDiagnostics {
  platform: 'ios' | 'android' | 'other'
  nativeModulesAvailable: boolean
  hasAppleHealthKit: boolean
  hasInitHealthKit: boolean
  hasHealthKitConstants: boolean
  hasHealthKitPermissionsConstants: boolean
  hasHealthConnect: boolean
}

try {
  // Dynamic imports to prevent crashes when modules aren't linked
  if (Platform.OS === 'ios') {
    const healthModule = require('react-native-health')
    // Some RN modules export either as default or as the module object depending on bundler interop.
    AppleHealthKit = healthModule?.default ?? healthModule
    nativeModulesAvailable = !!AppleHealthKit?.initHealthKit
  } else if (Platform.OS === 'android') {
    const healthConnectModule = require('react-native-health-connect')
    const hc = healthConnectModule?.default ?? healthConnectModule
    initializeHealthConnect = hc.initialize
    requestHealthConnectPermission = hc.requestPermission
    readHealthConnectRecords = hc.readRecords
    getSdkStatus = hc.getSdkStatus
    SdkAvailabilityStatus = hc.SdkAvailabilityStatus
    nativeModulesAvailable = !!initializeHealthConnect
  }
} catch (error) {
  console.log('[HealthService] Native health modules not available (expected in Expo Go)')
  nativeModulesAvailable = false
}

export function getHealthModuleDiagnostics(): HealthModuleDiagnostics {
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other'
  return {
    platform,
    nativeModulesAvailable,
    hasAppleHealthKit: !!AppleHealthKit,
    hasInitHealthKit: !!AppleHealthKit?.initHealthKit,
    hasHealthKitConstants: !!AppleHealthKit?.Constants,
    hasHealthKitPermissionsConstants: !!AppleHealthKit?.Constants?.Permissions,
    hasHealthConnect: !!initializeHealthConnect,
  }
}

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
  weight: boolean
  bodyFat: boolean
  isAvailable: boolean
}

// Weight data from smart scale via Health platforms
export interface ScaleWeightData {
  weight: number // kg
  bodyFatPercent?: number // Bio-impedance estimation
  bmi?: number // Calculated or from scale
  date: string
  sourceName?: string // e.g., "Withings", "Xiaomi Mi Fit"
}

// HealthKit permissions (iOS) - built dynamically to avoid accessing undefined Constants
function getHealthKitPermissions(): HealthKitPermissions {
  if (!AppleHealthKit?.Constants?.Permissions) {
    return { permissions: { read: [], write: [] } }
  }
  return {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.Steps,
        AppleHealthKit.Constants.Permissions.SleepAnalysis,
        AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
        AppleHealthKit.Constants.Permissions.Weight,
        AppleHealthKit.Constants.Permissions.BodyFatPercentage,
      ],
      write: [],
    },
  }
}

// Health Connect permissions (Android)
const healthConnectPermissions = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'Weight' },
  { accessType: 'read', recordType: 'BodyFat' },
] as const

// Track if HealthKit has been initialized this session
let healthKitInitialized = false

/**
 * Check if health services are available on this device
 */
export async function isHealthAvailable(): Promise<boolean> {
  // First check if native modules are available
  if (!nativeModulesAvailable) {
    console.log('[HealthService] Native modules not available')
    return false
  }

  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      try {
        AppleHealthKit.isAvailable((error: any, available: boolean) => {
          resolve(!error && available)
        })
      } catch (e) {
        console.log('[HealthService] isAvailable error:', e)
        resolve(false)
      }
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
 * Ensure HealthKit is initialized before reading data
 * This must be called before any data fetch operations
 */
async function ensureHealthKitInitialized(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !nativeModulesAvailable) {
    return false
  }

  // Already initialized this session
  if (healthKitInitialized) {
    console.log('[HealthService] HealthKit already initialized')
    return true
  }

  return new Promise((resolve) => {
    try {
      const permissions = getHealthKitPermissions()
      console.log('[HealthService] Initializing HealthKit with permissions...')

      if (!AppleHealthKit?.initHealthKit) {
        console.log('[HealthService] initHealthKit not available')
        resolve(false)
        return
      }

      AppleHealthKit.initHealthKit(permissions, (error: any) => {
        if (error) {
          console.log('[HealthService] HealthKit init error:', error)
          resolve(false)
          return
        }

        console.log('[HealthService] HealthKit initialized successfully')
        healthKitInitialized = true
        resolve(true)
      })
    } catch (e) {
      console.log('[HealthService] ensureHealthKitInitialized exception:', e)
      resolve(false)
    }
  })
}

/**
 * Request health permissions
 */
export async function requestHealthPermissions(): Promise<HealthPermissionStatus> {
  const result: HealthPermissionStatus = {
    steps: false,
    sleep: false,
    calories: false,
    weight: false,
    bodyFat: false,
    isAvailable: false,
  }

  // Check if native modules are available
  if (!nativeModulesAvailable) {
    console.log('[HealthService] Cannot request permissions - native modules not available')
    return result
  }

  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      try {
        const permissions = getHealthKitPermissions()
        console.log('[HealthService] Requesting HealthKit permissions:', JSON.stringify(permissions))
        console.log('[HealthService] AppleHealthKit available:', !!AppleHealthKit)
        console.log('[HealthService] initHealthKit function:', !!AppleHealthKit?.initHealthKit)

        if (!AppleHealthKit?.initHealthKit) {
          console.log('[HealthService] initHealthKit not available')
          resolve(result)
          return
        }

        AppleHealthKit.initHealthKit(permissions, (error: any) => {
          if (error) {
            console.log('[HealthService] HealthKit init error:', error)
            resolve(result)
            return
          }

          console.log('[HealthService] HealthKit init SUCCESS - permissions granted')
          // HealthKit doesn't tell us which specific permissions were granted
          // We assume all were granted if init succeeded
          resolve({
            steps: true,
            sleep: true,
            calories: true,
            weight: true,
            bodyFat: true,
            isAvailable: true,
          })
        })
      } catch (e) {
        console.log('[HealthService] initHealthKit exception:', e)
        resolve(result)
      }
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
      result.weight = grantedPermissions.some((p: any) => p.recordType === 'Weight')
      result.bodyFat = grantedPermissions.some((p: any) => p.recordType === 'BodyFat')

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
      AppleHealthKit.getStepCount(options, (error: any, results: any) => {
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
      AppleHealthKit.getSleepSamples(sleepOptions, (error: any, results: any) => {
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
      AppleHealthKit.getActiveEnergyBurned(options, (error: any, results: any) => {
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
        (error: any, results: any) => {
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

/**
 * Get weight data from connected smart scale (via Health platform)
 * Fetches weight and body fat % for a date range
 */
export async function getWeightDataFromScale(
  startDate: Date,
  endDate: Date = new Date()
): Promise<ScaleWeightData[]> {
  const isAvailable = await isHealthAvailable()
  if (!isAvailable) {
    console.log('[HealthService] getWeightDataFromScale: Health not available')
    return []
  }

  if (Platform.OS === 'ios') {
    // Ensure HealthKit is initialized before reading
    const initialized = await ensureHealthKitInitialized()
    if (!initialized) {
      console.log('[HealthService] getWeightDataFromScale: Failed to initialize HealthKit')
      return []
    }
    return getWeightDataIOS(startDate, endDate)
  } else if (Platform.OS === 'android') {
    return getWeightDataAndroid(startDate, endDate)
  }

  return []
}

/**
 * Convert pounds to kg if needed
 * HealthKit sometimes returns pounds even when kg is requested
 */
function normalizeWeightToKg(value: number): number {
  // If value is > 150, it's likely in pounds (no human weighs 150+ kg normally)
  // 150 kg = 330 lbs, so if we get 150+, assume it's pounds
  // Typical adult range: 40-150 kg or 88-330 lbs
  if (value > 150) {
    // Convert pounds to kg
    const kg = value / 2.20462
    console.log(`[HealthService] Converted ${value} lbs to ${kg.toFixed(1)} kg`)
    return Math.round(kg * 10) / 10
  }
  return Math.round(value * 10) / 10
}

/**
 * iOS: Get weight data from HealthKit
 */
async function getWeightDataIOS(startDate: Date, endDate: Date): Promise<ScaleWeightData[]> {
  try {
    // Get weight samples - specify unit as kilogram to avoid pounds
    const weightSamples = await new Promise<any[]>((resolve) => {
      AppleHealthKit.getWeightSamples(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          ascending: false,
          limit: 100,
          unit: 'kilogram',
        },
        (error: any, results: any) => {
          if (error || !results) {
            console.log('[HealthService] Weight samples error:', error)
            resolve([])
            return
          }
          console.log('[HealthService] Raw weight samples:', JSON.stringify(results.slice(0, 3)))
          resolve(results)
        }
      )
    })

    // Get body fat samples
    const bodyFatSamples = await new Promise<any[]>((resolve) => {
      AppleHealthKit.getBodyFatPercentageSamples(
        {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          ascending: false,
          limit: 100,
        },
        (error: any, results: any) => {
          if (error || !results) {
            resolve([])
            return
          }
          resolve(results)
        }
      )
    })

    // Combine weight with body fat data (match by date)
    const weightData: ScaleWeightData[] = weightSamples.map((sample) => {
      const sampleDate = new Date(sample.startDate).toISOString().split('T')[0]

      // Find matching body fat sample for same day
      const matchingBodyFat = bodyFatSamples.find((bf) => {
        const bfDate = new Date(bf.startDate).toISOString().split('T')[0]
        return bfDate === sampleDate
      })

      // Normalize weight to kg (HealthKit may return pounds despite unit setting)
      const normalizedWeight = normalizeWeightToKg(sample.value)

      return {
        weight: normalizedWeight,
        bodyFatPercent: matchingBodyFat?.value,
        date: sample.startDate,
        sourceName: sample.sourceName || 'Apple Health',
      }
    })

    // Filter out any remaining aberrant values (outside 30-200 kg range)
    const validWeightData = weightData.filter(d => d.weight >= 30 && d.weight <= 200)

    if (validWeightData.length !== weightData.length) {
      console.log(`[HealthService] Filtered out ${weightData.length - validWeightData.length} aberrant weight entries`)
    }

    return validWeightData
  } catch (error) {
    console.log('[HealthService] iOS weight error:', error)
    return []
  }
}

/**
 * Android: Get weight data from Health Connect
 */
async function getWeightDataAndroid(startDate: Date, endDate: Date): Promise<ScaleWeightData[]> {
  try {
    // Get weight records
    let weightRecords: any[] = []
    try {
      const result = await readHealthConnectRecords('Weight', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      })
      weightRecords = result.records || []
    } catch (e) {
      console.log('[HealthService] Weight read error:', e)
    }

    // Get body fat records
    let bodyFatRecords: any[] = []
    try {
      const result = await readHealthConnectRecords('BodyFat', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
        },
      })
      bodyFatRecords = result.records || []
    } catch (e) {
      console.log('[HealthService] Body fat read error:', e)
    }

    // Combine weight with body fat data
    const weightData: ScaleWeightData[] = weightRecords.map((record) => {
      const recordDate = new Date(record.time).toISOString().split('T')[0]

      // Find matching body fat record for same day
      const matchingBodyFat = bodyFatRecords.find((bf) => {
        const bfDate = new Date(bf.time).toISOString().split('T')[0]
        return bfDate === recordDate
      })

      return {
        weight: record.weight?.inKilograms || record.mass?.inKilograms || 0,
        bodyFatPercent: matchingBodyFat?.percentage,
        date: record.time,
        sourceName: record.metadata?.dataOrigin || 'Health Connect',
      }
    })

    return weightData
  } catch (error) {
    console.log('[HealthService] Android weight error:', error)
    return []
  }
}

/**
 * Get the latest weight entry from connected scale
 */
export async function getLatestWeightFromScale(): Promise<ScaleWeightData | null> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const data = await getWeightDataFromScale(thirtyDaysAgo)
  return data.length > 0 ? data[0] : null
}

/**
 * Get list of popular compatible smart scales
 */
export function getCompatibleScales(): Array<{ name: string; brand: string }> {
  return [
    { name: 'Body+', brand: 'Withings' },
    { name: 'Body Cardio', brand: 'Withings' },
    { name: 'Body Scan', brand: 'Withings' },
    { name: 'Mi Body Composition Scale 2', brand: 'Xiaomi' },
    { name: 'Smart Scale P2 Pro', brand: 'eufy' },
    { name: 'ES-CS20M', brand: 'Renpho' },
    { name: 'Elis Solar', brand: 'Renpho' },
    { name: 'Aria Air', brand: 'Fitbit' },
    { name: 'Index S2', brand: 'Garmin' },
    { name: 'Body Analysis Scale', brand: 'Omron' },
    { name: 'Smart Body Analyzer', brand: 'QardioBase' },
  ]
}

/**
 * Get platform-specific setup instructions
 */
export function getScaleSetupInstructions(): string[] {
  if (Platform.OS === 'ios') {
    return [
      "1. Configure ta balance avec l'app du fabricant (Withings, Mi Fit, etc.)",
      "2. Dans l'app de la balance, active la synchronisation avec Apple Santé",
      '3. Pèse-toi - les données seront envoyées automatiquement',
      '4. Reviens ici et appuie sur Synchroniser',
    ]
  } else if (Platform.OS === 'android') {
    return [
      '1. Installe Google Health Connect depuis le Play Store',
      "2. Configure ta balance avec l'app du fabricant",
      "3. Dans l'app de la balance, active Health Connect",
      '4. Pèse-toi et reviens ici pour synchroniser',
    ]
  }
  return ["L'intégration santé n'est pas disponible sur cette plateforme."]
}

/**
 * Get weekly health summary (7 days average for steps and sleep)
 */
export interface WeeklyHealthSummary {
  avgSteps: number
  avgSleepHours: number | null
  daysWithSteps: number
  daysWithSleep: number
}

export async function getWeeklyHealthSummary(): Promise<WeeklyHealthSummary | null> {
  console.log('[HealthService] getWeeklyHealthSummary called')
  const isAvailable = await isHealthAvailable()
  console.log('[HealthService] isHealthAvailable:', isAvailable)
  if (!isAvailable) {
    console.log('[HealthService] Health not available, returning null')
    return null
  }

  // Ensure HealthKit is initialized before reading data
  if (Platform.OS === 'ios') {
    const initialized = await ensureHealthKitInitialized()
    console.log('[HealthService] HealthKit initialized:', initialized)
    if (!initialized) {
      console.log('[HealthService] Failed to initialize HealthKit, returning null')
      return null
    }
  }

  const now = new Date()
  const summary: WeeklyHealthSummary = {
    avgSteps: 0,
    avgSleepHours: null,
    daysWithSteps: 0,
    daysWithSleep: 0,
  }

  // Collect daily data for past 7 days
  const stepsData: number[] = []
  const sleepData: number[] = []

  console.log('[HealthService] Starting to fetch 7 days of data...')
  for (let i = 0; i < 7; i++) {
    const dayEnd = new Date(now)
    dayEnd.setDate(dayEnd.getDate() - i)
    dayEnd.setHours(23, 59, 59, 999)

    const dayStart = new Date(dayEnd)
    dayStart.setHours(0, 0, 0, 0)

    // Get steps for this day
    const steps = await getStepsForDateRange(dayStart, dayEnd)
    console.log(`[HealthService] Day ${i}: steps = ${steps}`)
    if (steps > 0) {
      stepsData.push(steps)
    }

    // Get sleep for the night before this day
    if (Platform.OS === 'ios' && AppleHealthKit) {
      const sleepStartDate = new Date(dayStart)
      sleepStartDate.setDate(sleepStartDate.getDate() - 1)
      sleepStartDate.setHours(20, 0, 0, 0)

      const sleepHours = await new Promise<number | null>((resolve) => {
        try {
          AppleHealthKit.getSleepSamples(
            {
              startDate: sleepStartDate.toISOString(),
              endDate: dayStart.toISOString(),
            },
            (error: any, results: any) => {
              if (error || !results || results.length === 0) {
                resolve(null)
                return
              }

              let totalMinutes = 0
              results.forEach((sample: any) => {
                if (sample.value === 'ASLEEP' || sample.value === 'INBED') {
                  const start = new Date(sample.startDate)
                  const end = new Date(sample.endDate)
                  totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60)
                }
              })

              resolve(totalMinutes > 0 ? Math.round(totalMinutes / 60 * 10) / 10 : null)
            }
          )
        } catch {
          resolve(null)
        }
      })

      if (sleepHours !== null && sleepHours > 0) {
        sleepData.push(sleepHours)
      }
    }
  }

  // Calculate averages
  console.log(`[HealthService] Collected ${stepsData.length} days with steps, ${sleepData.length} days with sleep`)
  if (stepsData.length > 0) {
    summary.avgSteps = Math.round(stepsData.reduce((a, b) => a + b, 0) / stepsData.length)
    summary.daysWithSteps = stepsData.length
  }

  if (sleepData.length > 0) {
    summary.avgSleepHours = Math.round(sleepData.reduce((a, b) => a + b, 0) / sleepData.length * 10) / 10
    summary.daysWithSleep = sleepData.length
  }

  console.log('[HealthService] Final summary:', JSON.stringify(summary))
  return summary
}

/**
 * Sync latest weight from Apple Health/Health Connect to user profile
 * This should be called at app startup and when viewing profile
 * Returns the synced weight if successful, null otherwise
 */
export async function syncWeightToProfile(): Promise<number | null> {
  try {
    const latestWeight = await getLatestWeightFromScale()
    if (!latestWeight) {
      console.log('[HealthService] No weight data found in Health')
      return null
    }

    console.log('[HealthService] Latest weight from Health:', latestWeight.weight, 'kg')

    // Import user store dynamically to avoid circular dependency
    const { useUserStore } = await import('../stores/user-store')
    const store = useUserStore.getState()

    // Only update if we have a profile and the weight is different
    if (store.profile) {
      const currentWeight = store.profile.weight
      const healthWeight = latestWeight.weight

      // Only update if difference is > 0.1 kg (avoid unnecessary updates)
      if (!currentWeight || Math.abs(currentWeight - healthWeight) > 0.1) {
        console.log(`[HealthService] Updating profile weight: ${currentWeight} → ${healthWeight} kg`)

        // Add weight entry to history
        store.addWeightEntry({
          id: `health-${Date.now()}`,
          weight: healthWeight,
          date: latestWeight.date,
          source: 'health_app',
        })

        return healthWeight
      } else {
        console.log('[HealthService] Profile weight already in sync')
      }
    }

    return latestWeight.weight
  } catch (error) {
    console.error('[HealthService] syncWeightToProfile error:', error)
    return null
  }
}

export default {
  isHealthAvailable,
  requestHealthPermissions,
  getTodayHealthData,
  getStepsForDateRange,
  getWeightDataFromScale,
  getLatestWeightFromScale,
  getCompatibleScales,
  getScaleSetupInstructions,
  getWeeklyHealthSummary,
  syncWeightToProfile,
}
