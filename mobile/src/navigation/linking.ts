/**
 * Deep Linking Configuration for React Navigation
 *
 * Handles URL schemes:
 * - presence://auth/reset-password - Password reset
 * - presence://auth/callback - Email verification
 */

import { LinkingOptions } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import type { RootStackParamList } from './RootNavigator'

// App URL scheme prefix
const prefix = Linking.createURL('/')

/**
 * Linking configuration for React Navigation
 */
export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: [
    prefix,
    'presence://',
    // Also handle web URLs from Railway backend
    'https://lym1-production.up.railway.app',
  ],
  config: {
    screens: {
      // Auth deep links handled specially via getStateFromPath
      Auth: 'auth',
      // Main app screens (for future deep linking)
      Main: {
        screens: {
          Home: 'home',
          Progress: 'progress',
          Settings: 'settings',
        },
      },
      // Password change after reset
      ChangePassword: 'auth/change-password',
    },
  },
  // Custom function to handle special auth deep links
  async getInitialURL() {
    // Check if app was opened via deep link
    const url = await Linking.getInitialURL()
    console.log('[Linking] Initial URL:', url)
    return url
  },
  // Listen for deep links while app is open
  subscribe(listener) {
    // Listen to incoming links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[Linking] URL received:', url)
      listener(url)
    })

    return () => {
      subscription.remove()
    }
  },
}

/**
 * Check if URL is an auth deep link that needs special handling
 */
export function isAuthDeepLink(url: string | null): boolean {
  if (!url) return false
  return url.includes('auth/reset-password') ||
         url.includes('auth/callback') ||
         url.includes('access_token=') ||
         url.includes('type=recovery')
}

/**
 * Extract the auth action from a deep link URL
 */
export function getAuthAction(url: string): 'reset-password' | 'callback' | null {
  if (url.includes('reset-password') || url.includes('type=recovery')) {
    return 'reset-password'
  }
  if (url.includes('callback') || url.includes('type=signup')) {
    return 'callback'
  }
  return null
}

export default linkingConfig
