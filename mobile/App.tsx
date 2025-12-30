import "./global.css"

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

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync()

export default function App() {
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
        // Clear food search cache to get fresh results with nutriscore
        await clearFoodSearchCache()

        // Initialize notifications
        const notificationsEnabled = await requestNotificationPermissions()
        console.log('[App] Notifications enabled:', notificationsEnabled)

        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (e) {
        console.warn(e)
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
}
