import "./global.css"

import * as Sentry from '@sentry/react-native'
import React, { useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter'
import { PlayfairDisplay_400Regular, PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display'
import { Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora'
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display'
import { NunitoSans_400Regular, NunitoSans_500Medium, NunitoSans_600SemiBold, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans'

import { RootNavigator } from './src/navigation'
import { linkingConfig, isAuthDeepLink, getAuthAction } from './src/navigation/linking'
import { SplashScreen } from './src/components/SplashScreen'
import { handleDeepLink } from './src/services/deep-link-handler'
import { ThemeProvider } from './src/contexts/ThemeContext'
import { AgentTriggersProvider } from './src/components/AgentTriggersProvider'
import { ToastProvider } from './src/components/ui/Toast'
import { FeedbackProvider } from './src/components/feedback'
import { RewardAnimationProvider } from './src/components/RewardAnimationProvider'
import { clearFoodSearchCache } from './src/services/food-search'
import {
  requestNotificationPermissions,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from './src/services/notification-service'
import { useMessageCenter } from './src/services/message-center'
import {
  markOnboardingDayNotified,
  ensureOnboardingNotificationsScheduled,
} from './src/services/onboarding-notifications-service'
import { useOnboardingStore } from './src/stores/onboarding-store'
import {
  checkAndScheduleReminders,
} from './src/services/meal-reminder-service'
import {
  initializeCoachProactiveService,
} from './src/services/coach-proactive-service'
import { useUserStore } from './src/stores/user-store'
import { initializeDailyInsightService } from './src/services/daily-insight-service'
import { loadStaticRecipes } from './src/services/static-recipes'
import { analytics } from './src/services/analytics-service'
import { errorReporting } from './src/services/error-reporting-service'
import { lymInsights } from './src/services/lym-insights-service'
import { configureGoogleSignIn } from './src/services/google-auth-service'
import { requestHealthPermissions, isHealthAvailable, syncWeightToProfile } from './src/services/health-service'

// Initialize Sentry
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: __DEV__,
  environment: __DEV__ ? 'development' : 'production',
  enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',
})


export default Sentry.wrap(function App() {
  const [appIsReady, setAppIsReady] = useState(false)
  const [splashFinished, setSplashFinished] = useState(false)
  const [pendingDeepLink, setPendingDeepLink] = useState<{
    action: 'reset-password' | 'callback'
    url: string
  } | null>(null)
  const navigationRef = React.useRef<any>(null)

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
    Lora_700Bold,
    DMSerifDisplay_400Regular,
    NunitoSans_400Regular,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  })

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize error reporting first (to catch init errors)
        errorReporting.initialize()

        // Initialize analytics
        await analytics.initialize()
        analytics.track('app_opened')

        // Initialize LYM Insights (Supabase-based, bienveillant analytics)
        await lymInsights.initialize()

        // Configure Google Sign-In for native builds
        configureGoogleSignIn()

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

        // Request HealthKit permissions early (Apple recommends this)
        // This ensures the permission popup appears reliably
        const healthAvailable = await isHealthAvailable()
        if (healthAvailable) {
          console.log('[App] HealthKit available, requesting permissions...')
          const healthPerms = await requestHealthPermissions()
          console.log('[App] HealthKit permissions:', JSON.stringify(healthPerms))

          // Sync weight from Apple Health to profile
          const syncedWeight = await syncWeightToProfile()
          if (syncedWeight) {
            console.log('[App] Weight synced from Health:', syncedWeight, 'kg')
          }
        } else {
          console.log('[App] HealthKit not available on this device')
        }

        // Initialize Super Agent daily insight service
        if (notificationsEnabled) {
          await initializeDailyInsightService()
          console.log('[App] Super Agent daily insights initialized')

          // Schedule meal reminders based on user profile and fasting preferences
          const profile = useUserStore.getState().profile
          if (profile) {
            await checkAndScheduleReminders(profile as any)
            console.log('[App] Meal reminders scheduled')

            // Initialize Coach proactive notifications
            await initializeCoachProactiveService(profile as any)
            console.log('[App] Coach proactive service initialized')
          }

          // Ensure onboarding notifications are scheduled (recover from failures)
          const onboardingState = useOnboardingStore.getState()
          await ensureOnboardingNotificationsScheduled(
            onboardingState.signupDate,
            onboardingState.isSubscribed
          )
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

  // Handle notifications RECEIVED (sync to MessageCenter for Coach screen)
  useEffect(() => {
    const subscription = addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content
      console.log('[App] Notification received:', title)

      // Skip if already added to MessageCenter by the sender
      // (notifications sent via sendNotification already add to MessageCenter)
      // Only sync scheduled notifications that fire when app is in foreground
      if (data?.type === 'coach_proactive' || data?.type === 'daily_insight_trigger') {
        const messageCenter = useMessageCenter.getState()
        const emoji = data?.type === 'coach_proactive' ? '📊' : '💡'
        messageCenter.addMessage({
          priority: 'P3',
          type: 'insight',
          category: 'wellness',
          title: title?.replace(/^[^\s]+\s/, '') || 'Coach LYM', // Remove emoji prefix
          message: body || '',
          emoji,
          reason: `Notification reçue: ${data?.type}`,
          confidence: 0.7,
          dedupKey: `notif-received-${data?.type}-${new Date().toDateString()}`,
          actionRoute: 'Coach',
        })
        console.log('[App] Synced notification to MessageCenter')
      }
    })

    return () => subscription.remove()
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

      // Handle onboarding notifications
      if (data?.type === 'onboarding' && data?.day) {
        const day = data.day as number
        markOnboardingDayNotified(day).catch(console.error)
        console.log('[App] Onboarding day', day, 'notification acknowledged')

        // Navigate to appropriate screen based on feature
        if (navigationRef.current?.isReady() && data?.deepLink) {
          const deepLink = data.deepLink as string
          // Handle LYM deep links
          if (deepLink.startsWith('lym://')) {
            const route = deepLink.replace('lym://', '')
            switch (route) {
              case 'home':
                navigationRef.current.navigate('Main', { screen: 'Home' })
                break
              case 'suggestions':
              case 'planning':
                navigationRef.current.navigate('WeeklyPlan')
                break
              case 'coach':
                // Coach is available via home screen actions
                navigationRef.current.navigate('Main', { screen: 'Home' })
                break
              case 'wellness':
                navigationRef.current.navigate('WellnessProgram')
                break
              case 'premium':
                navigationRef.current.navigate('Paywall')
                break
            }
          }
        }
      }

      // Handle meal reminder notifications
      if (data?.type === 'meal_reminder' && data?.mealType) {
        console.log('[App] Meal reminder tapped:', data.mealType)
        if (navigationRef.current?.isReady()) {
          // Navigate to add meal screen with pre-selected meal type
          navigationRef.current.navigate('AddMeal', { mealType: data.mealType })
        }
      }

      // Handle Coach proactive notifications
      if (data?.type === 'coach_proactive') {
        console.log('[App] Coach notification tapped:', data.subtype)
        if (navigationRef.current?.isReady()) {
          // Navigate to home to see the coach widget
          navigationRef.current.navigate('Main', { screen: 'Home' })
        }
      }

      // Handle deep links from notifications
      if (data?.deepLink && data?.type !== 'onboarding' && data?.type !== 'meal_reminder' && data?.type !== 'coach_proactive') {
        // Navigation will be handled by the NavigationContainer
        console.log('[App] Deep link:', data.deepLink)
      }
    })

    return () => subscription.remove()
  }, [])

  // Handle deep links for auth
  useEffect(() => {
    // Process pending deep link after navigation is ready
    if (pendingDeepLink && navigationRef.current?.isReady()) {
      console.log('[App] Processing pending deep link:', pendingDeepLink.action)

      const processDeepLink = async () => {
        const result = await handleDeepLink(pendingDeepLink.url)

        if (result.success && result.type === 'reset-password') {
          // Navigate to change password screen
          navigationRef.current?.navigate('ChangePassword', { fromDeepLink: true })
        } else if (result.success && result.type === 'email-verified') {
          // Email verified - the auth state will update automatically
          console.log('[App] Email verified via deep link')
        } else if (!result.success) {
          console.error('[App] Deep link error:', result.error)
          // Could show an alert here if needed
        }

        setPendingDeepLink(null)
      }

      processDeepLink()
    }
  }, [pendingDeepLink])

  
  // Wait for fonts to load
  if (!fontsLoaded) {
    return null
  }

  // Show custom splash screen while app initializes
  if (!appIsReady || !splashFinished) {
    return (
      <SplashScreen
        duration={2500}
        onFinish={() => setSplashFinished(true)}
      />
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <AgentTriggersProvider>
              <FeedbackProvider bottomOffset={90}>
              <RewardAnimationProvider>
              <NavigationContainer
                ref={navigationRef}
                linking={{
                  ...linkingConfig,
                  // Custom handler for auth deep links
                  async getInitialURL() {
                    const url = await linkingConfig.getInitialURL?.()
                    if (url && isAuthDeepLink(url)) {
                      const action = getAuthAction(url)
                      if (action) {
                        console.log('[App] Auth deep link on launch:', action)
                        setPendingDeepLink({ action, url })
                        return null // Don't let React Navigation handle it directly
                      }
                    }
                    return url
                  },
                  subscribe(listener) {
                    // Wrap the listener to intercept auth deep links
                    const wrappedListener = (url: string) => {
                      if (isAuthDeepLink(url)) {
                        const action = getAuthAction(url)
                        if (action) {
                          console.log('[App] Auth deep link while open:', action)
                          setPendingDeepLink({ action, url })
                          return // Don't pass to React Navigation
                        }
                      }
                      listener(url)
                    }
                    return linkingConfig.subscribe?.(wrappedListener) || (() => {})
                  },
                }}
              >
                <RootNavigator />
              </NavigationContainer>
              </RewardAnimationProvider>
              </FeedbackProvider>
            </AgentTriggersProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
});