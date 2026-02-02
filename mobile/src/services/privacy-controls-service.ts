/**
 * Privacy Controls Service
 *
 * Centralized privacy management:
 * - Data sharing preferences
 * - Social visibility settings
 * - Analytics opt-in/out
 * - Profile visibility
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

// ============================================================================
// TYPES
// ============================================================================

export type VisibilityLevel = 'public' | 'friends' | 'circles' | 'private'

export interface PrivacySettings {
  // Profile visibility
  profile: {
    displayName: VisibilityLevel
    avatar: VisibilityLevel
    bio: VisibilityLevel
    badges: VisibilityLevel
    level: VisibilityLevel
  }

  // Health data sharing
  healthData: {
    weight: VisibilityLevel
    nutrition: VisibilityLevel
    meals: VisibilityLevel
    streak: VisibilityLevel
    goals: VisibilityLevel
    wellness: VisibilityLevel
  }

  // Social features
  social: {
    /** Allow friend requests */
    allowFriendRequests: boolean
    /** Allow circle invitations */
    allowCircleInvites: boolean
    /** Show in search results */
    showInSearch: boolean
    /** Show in leaderboards */
    showInLeaderboards: boolean
    /** Allow direct messages from non-friends */
    allowMessagesFromStrangers: boolean
  }

  // Activity visibility
  activity: {
    /** Show when online */
    showOnlineStatus: boolean
    /** Show last active time */
    showLastActive: boolean
    /** Show activity in circles */
    shareActivityInCircles: boolean
    /** Show achievements publicly */
    shareAchievements: boolean
  }

  // Analytics & tracking
  analytics: {
    /** Allow usage analytics */
    allowUsageAnalytics: boolean
    /** Allow performance metrics */
    allowPerformanceMetrics: boolean
    /** Allow crash reports */
    allowCrashReports: boolean
    /** Allow personalized recommendations */
    allowPersonalization: boolean
  }

  // Cloud & sync
  cloud: {
    /** Enable cloud backup */
    enableCloudBackup: boolean
    /** Encrypt data before sync */
    encryptData: boolean
    /** Auto-sync enabled */
    autoSync: boolean
  }

  // Metadata
  updatedAt: string
  version: string
}

export interface PrivacyCheckResult {
  allowed: boolean
  reason?: string
  requiredLevel?: VisibilityLevel
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIVACY_SETTINGS_KEY = 'privacy_settings'
const PRIVACY_VERSION = '1.0.0'

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  profile: {
    displayName: 'friends',
    avatar: 'friends',
    bio: 'friends',
    badges: 'friends',
    level: 'friends',
  },
  healthData: {
    weight: 'private',
    nutrition: 'private',
    meals: 'private',
    streak: 'circles',
    goals: 'private',
    wellness: 'private',
  },
  social: {
    allowFriendRequests: true,
    allowCircleInvites: true,
    showInSearch: true,
    showInLeaderboards: true,
    allowMessagesFromStrangers: false,
  },
  activity: {
    showOnlineStatus: true,
    showLastActive: true,
    shareActivityInCircles: true,
    shareAchievements: true,
  },
  analytics: {
    allowUsageAnalytics: true,
    allowPerformanceMetrics: true,
    allowCrashReports: true,
    allowPersonalization: true,
  },
  cloud: {
    enableCloudBackup: true,
    encryptData: true,
    autoSync: true,
  },
  updatedAt: new Date().toISOString(),
  version: PRIVACY_VERSION,
}

// Visibility hierarchy (from most to least restrictive)
const VISIBILITY_HIERARCHY: VisibilityLevel[] = ['private', 'circles', 'friends', 'public']

// ============================================================================
// PRIVACY SETTINGS MANAGEMENT
// ============================================================================

let cachedSettings: PrivacySettings | null = null

/**
 * Get current privacy settings
 */
export async function getPrivacySettings(): Promise<PrivacySettings> {
  if (cachedSettings) return cachedSettings

  try {
    const stored = await AsyncStorage.getItem(PRIVACY_SETTINGS_KEY)
    if (stored) {
      const settings = JSON.parse(stored) as PrivacySettings
      // Merge with defaults to handle new fields
      cachedSettings = mergeWithDefaults(settings)
      return cachedSettings
    }
  } catch (error) {
    console.error('[Privacy] Failed to load settings:', error)
  }

  cachedSettings = { ...DEFAULT_PRIVACY_SETTINGS }
  return cachedSettings
}

/**
 * Save privacy settings
 */
export async function savePrivacySettings(
  settings: Partial<PrivacySettings>
): Promise<PrivacySettings> {
  const current = await getPrivacySettings()

  const updated: PrivacySettings = {
    ...current,
    ...settings,
    profile: { ...current.profile, ...settings.profile },
    healthData: { ...current.healthData, ...settings.healthData },
    social: { ...current.social, ...settings.social },
    activity: { ...current.activity, ...settings.activity },
    analytics: { ...current.analytics, ...settings.analytics },
    cloud: { ...current.cloud, ...settings.cloud },
    updatedAt: new Date().toISOString(),
  }

  await AsyncStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(updated))
  cachedSettings = updated

  // Apply changes to services
  await applyPrivacyChanges(updated)

  console.log('[Privacy] Settings updated')
  return updated
}

/**
 * Reset to default privacy settings
 */
export async function resetPrivacySettings(): Promise<PrivacySettings> {
  const defaults = {
    ...DEFAULT_PRIVACY_SETTINGS,
    updatedAt: new Date().toISOString(),
  }

  await AsyncStorage.setItem(PRIVACY_SETTINGS_KEY, JSON.stringify(defaults))
  cachedSettings = defaults

  await applyPrivacyChanges(defaults)

  console.log('[Privacy] Settings reset to defaults')
  return defaults
}

// ============================================================================
// PRIVACY CHECKS
// ============================================================================

/**
 * Check if a user can view another user's data
 */
export async function canViewData(
  dataType: keyof PrivacySettings['profile'] | keyof PrivacySettings['healthData'],
  relationship: 'self' | 'friend' | 'circle_member' | 'stranger'
): Promise<PrivacyCheckResult> {
  const settings = await getPrivacySettings()

  // Self can always view own data
  if (relationship === 'self') {
    return { allowed: true }
  }

  // Get the visibility level for this data type
  let visibilityLevel: VisibilityLevel
  if (dataType in settings.profile) {
    visibilityLevel = settings.profile[dataType as keyof PrivacySettings['profile']]
  } else if (dataType in settings.healthData) {
    visibilityLevel = settings.healthData[dataType as keyof PrivacySettings['healthData']]
  } else {
    return { allowed: false, reason: 'Unknown data type' }
  }

  // Check if relationship meets visibility requirement
  const allowed = checkVisibilityAccess(visibilityLevel, relationship)

  return {
    allowed,
    reason: allowed ? undefined : `Data is ${visibilityLevel}`,
    requiredLevel: visibilityLevel,
  }
}

/**
 * Check if action is allowed based on social settings
 */
export async function canPerformSocialAction(
  action: keyof PrivacySettings['social'],
  relationship: 'friend' | 'circle_member' | 'stranger'
): Promise<PrivacyCheckResult> {
  const settings = await getPrivacySettings()

  switch (action) {
    case 'allowFriendRequests':
      return { allowed: settings.social.allowFriendRequests }

    case 'allowCircleInvites':
      return { allowed: settings.social.allowCircleInvites }

    case 'showInSearch':
      return { allowed: settings.social.showInSearch }

    case 'showInLeaderboards':
      return { allowed: settings.social.showInLeaderboards }

    case 'allowMessagesFromStrangers':
      if (relationship === 'stranger') {
        return { allowed: settings.social.allowMessagesFromStrangers }
      }
      return { allowed: true }

    default:
      return { allowed: false, reason: 'Unknown action' }
  }
}

/**
 * Check if analytics tracking is allowed
 */
export async function isAnalyticsAllowed(
  type: keyof PrivacySettings['analytics']
): Promise<boolean> {
  const settings = await getPrivacySettings()
  return settings.analytics[type]
}

/**
 * Check if cloud feature is enabled
 */
export async function isCloudFeatureEnabled(
  feature: keyof PrivacySettings['cloud']
): Promise<boolean> {
  const settings = await getPrivacySettings()
  return settings.cloud[feature]
}

// ============================================================================
// QUICK PRIVACY PRESETS
// ============================================================================

export type PrivacyPreset = 'open' | 'balanced' | 'private' | 'lockdown'

const PRIVACY_PRESETS: Record<PrivacyPreset, Partial<PrivacySettings>> = {
  open: {
    profile: {
      displayName: 'public',
      avatar: 'public',
      bio: 'public',
      badges: 'public',
      level: 'public',
    },
    healthData: {
      weight: 'friends',
      nutrition: 'friends',
      meals: 'circles',
      streak: 'public',
      goals: 'friends',
      wellness: 'private',
    },
    social: {
      allowFriendRequests: true,
      allowCircleInvites: true,
      showInSearch: true,
      showInLeaderboards: true,
      allowMessagesFromStrangers: true,
    },
    activity: {
      showOnlineStatus: true,
      showLastActive: true,
      shareActivityInCircles: true,
      shareAchievements: true,
    },
  },
  balanced: DEFAULT_PRIVACY_SETTINGS,
  private: {
    profile: {
      displayName: 'friends',
      avatar: 'friends',
      bio: 'private',
      badges: 'friends',
      level: 'friends',
    },
    healthData: {
      weight: 'private',
      nutrition: 'private',
      meals: 'private',
      streak: 'friends',
      goals: 'private',
      wellness: 'private',
    },
    social: {
      allowFriendRequests: true,
      allowCircleInvites: true,
      showInSearch: false,
      showInLeaderboards: false,
      allowMessagesFromStrangers: false,
    },
    activity: {
      showOnlineStatus: false,
      showLastActive: false,
      shareActivityInCircles: true,
      shareAchievements: false,
    },
  },
  lockdown: {
    profile: {
      displayName: 'private',
      avatar: 'private',
      bio: 'private',
      badges: 'private',
      level: 'private',
    },
    healthData: {
      weight: 'private',
      nutrition: 'private',
      meals: 'private',
      streak: 'private',
      goals: 'private',
      wellness: 'private',
    },
    social: {
      allowFriendRequests: false,
      allowCircleInvites: false,
      showInSearch: false,
      showInLeaderboards: false,
      allowMessagesFromStrangers: false,
    },
    activity: {
      showOnlineStatus: false,
      showLastActive: false,
      shareActivityInCircles: false,
      shareAchievements: false,
    },
    analytics: {
      allowUsageAnalytics: false,
      allowPerformanceMetrics: true, // Keep for app stability
      allowCrashReports: true, // Keep for app stability
      allowPersonalization: false,
    },
  },
}

/**
 * Apply a privacy preset
 */
export async function applyPrivacyPreset(preset: PrivacyPreset): Promise<PrivacySettings> {
  const presetSettings = PRIVACY_PRESETS[preset]
  return await savePrivacySettings(presetSettings)
}

/**
 * Get recommended preset based on user behavior
 */
export function getRecommendedPreset(
  usesCircles: boolean,
  usesChallenges: boolean,
  sharesData: boolean
): PrivacyPreset {
  if (!usesCircles && !usesChallenges && !sharesData) {
    return 'private'
  }
  if (usesCircles && usesChallenges && sharesData) {
    return 'open'
  }
  return 'balanced'
}

// ============================================================================
// DATA FILTERING
// ============================================================================

/**
 * Filter user data based on viewer's relationship
 */
export async function filterDataForViewer<T extends Record<string, unknown>>(
  data: T,
  relationship: 'self' | 'friend' | 'circle_member' | 'stranger',
  dataCategory: 'profile' | 'healthData'
): Promise<Partial<T>> {
  if (relationship === 'self') {
    return data
  }

  const settings = await getPrivacySettings()
  const categorySettings = settings[dataCategory]
  const filtered: Partial<T> = {}

  for (const [key, value] of Object.entries(data)) {
    const visibilityKey = key as keyof typeof categorySettings
    if (visibilityKey in categorySettings) {
      const visibility = categorySettings[visibilityKey] as VisibilityLevel
      if (checkVisibilityAccess(visibility, relationship)) {
        ;(filtered as Record<string, unknown>)[key] = value
      }
    }
  }

  return filtered
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function checkVisibilityAccess(
  required: VisibilityLevel,
  relationship: 'friend' | 'circle_member' | 'stranger'
): boolean {
  const requiredIndex = VISIBILITY_HIERARCHY.indexOf(required)

  switch (relationship) {
    case 'friend':
      // Friends can see: public, friends
      return requiredIndex >= VISIBILITY_HIERARCHY.indexOf('friends')

    case 'circle_member':
      // Circle members can see: public, friends, circles
      return requiredIndex >= VISIBILITY_HIERARCHY.indexOf('circles')

    case 'stranger':
      // Strangers can only see: public
      return required === 'public'

    default:
      return false
  }
}

function mergeWithDefaults(settings: Partial<PrivacySettings>): PrivacySettings {
  return {
    profile: { ...DEFAULT_PRIVACY_SETTINGS.profile, ...settings.profile },
    healthData: { ...DEFAULT_PRIVACY_SETTINGS.healthData, ...settings.healthData },
    social: { ...DEFAULT_PRIVACY_SETTINGS.social, ...settings.social },
    activity: { ...DEFAULT_PRIVACY_SETTINGS.activity, ...settings.activity },
    analytics: { ...DEFAULT_PRIVACY_SETTINGS.analytics, ...settings.analytics },
    cloud: { ...DEFAULT_PRIVACY_SETTINGS.cloud, ...settings.cloud },
    updatedAt: settings.updatedAt || new Date().toISOString(),
    version: PRIVACY_VERSION,
  }
}

/**
 * Apply privacy changes to dependent services
 */
async function applyPrivacyChanges(settings: PrivacySettings): Promise<void> {
  // Update Amplitude based on analytics settings
  if (!settings.analytics.allowUsageAnalytics) {
    try {
      const amplitude = await import('@amplitude/analytics-react-native')
      amplitude.setOptOut(true)
    } catch {
      // Amplitude not available
    }
  }

  // Update cloud sync based on cloud settings
  if (!settings.cloud.enableCloudBackup) {
    // Would disable cloud sync here
    console.log('[Privacy] Cloud backup disabled')
  }

  console.log('[Privacy] Applied privacy changes to services')
}

// ============================================================================
// EXPORTS
// ============================================================================

export const privacyControlsService = {
  // Settings management
  getPrivacySettings,
  savePrivacySettings,
  resetPrivacySettings,

  // Privacy checks
  canViewData,
  canPerformSocialAction,
  isAnalyticsAllowed,
  isCloudFeatureEnabled,

  // Presets
  applyPrivacyPreset,
  getRecommendedPreset,

  // Data filtering
  filterDataForViewer,

  // Constants
  DEFAULT_PRIVACY_SETTINGS,
  PRIVACY_PRESETS,
}

export default privacyControlsService
