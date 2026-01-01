import "./global.css"

import * as Sentry from '@sentry/react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'

import { RootNavigator } from './src/navigation'
import { ThemeProvider } from './src/contexts/ThemeContext'
import { AgentTriggersProvider } from './src/components/AgentTriggersProvider'
import { clearFoodSearchCache } from './src/services/food-search'
import {
  requestNotificationPermissions,
  addNotificationResponseListener,
} from './src/services/notification-service'
import { initializeDailyInsightService } from './src/services/daily-insight-service'
import { loadStaticRecipes } from './src/services/static-recipes'
import { analytics } from './src/services/analytics-service'
import { errorReporting } from './src/services/error-reporting-service'

// Initialize Sentry
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: __DEV__,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',
})

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync()

export default Sentry.wrap(function App() {
  const [appIsReady, setAppIsReady] = useState(false)

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  })

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize error reporting first (to catch init errors)
        errorReporting.initialize()

        // Initialize analytics
        await analytics.initialize()
        analytics.track('app_opened')

        // OPTIMIZATION: Pre-load static recipes in parallel with other init tasks
        // This prevents latency during meal plan generation
        const preloadPromises = [
          clearFoodSearchCache(),
          loadStaticRecipes().then(recipes => {
            console.log(`[App] Pre-loaded ${recipes.length} static recipes`)
          }),
        ]

        // Initialize notifications
        const notificationsEnabled = await requestNotificationPermissions()
        console.log('[App] Notifications enabled:', notificationsEnabled)

        // Initialize Super Agent daily insight service
        if (notificationsEnabled) {
          await initializeDailyInsightService()
          console.log('[App] Super Agent daily insights initialized')
        }

        // Wait for preload tasks to complete
        await Promise.all(preloadPromises)

        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (e) {
        console.warn(e)
        errorReporting.captureException(e, { feature: 'app_init' })
      } finally {
        setAppIsReady(true)
      }
    }

    prepare()
  }, [])

  // Handle notification taps
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data
      console.log('[App] Notification tapped:', data)

      // Track notification tap
      analytics.track('notification_tapped', {
        type: data?.type as string,
        deepLink: data?.deepLink as string,
      })

      // Handle deep links from notifications
      if (data?.deepLink) {
        // Navigation will be handled by the NavigationContainer
        console.log('[App] Deep link:', data.deepLink)
      }
    })

    return () => subscription.remove()
  }, [])

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && fontsLoaded) {
      await SplashScreen.hideAsync()
    }
  }, [appIsReady, fontsLoaded])

  if (!appIsReady || !fontsLoaded) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AgentTriggersProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </AgentTriggersProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
});