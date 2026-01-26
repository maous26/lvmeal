import React, { Component, ErrorInfo, ReactNode, useEffect, useRef } from 'react'
import { StyleSheet, View, Platform, Text, ScrollView } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Home,
  Sparkles,
  Layers,
  User,
  BookOpen,
} from 'lucide-react-native'

import HomeScreen from '../screens/HomeScreen'
import RecipesScreen from '../screens/RecipesScreen'
import CoachScreen from '../screens/CoachScreen'
import ProgramsScreen from '../screens/ProgramsScreen'
import ProfileScreen from '../screens/ProfileScreen'

import { colors, shadows } from '../constants/theme'
import { useMessageCenter } from '../services/message-center'
import { requestHealthPermissions, isHealthAvailable } from '../services/health-service'

const Tab = createBottomTabNavigator()
const HEALTH_PERMISSIONS_REQUESTED_KEY = 'lym_health_permissions_requested'

// Error Boundary to catch and display crashes
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class CoachErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CoachErrorBoundary] Crash caught:', error.message)
    console.error('[CoachErrorBoundary] Stack:', error.stack)
    console.error('[CoachErrorBoundary] Component stack:', errorInfo.componentStack)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#FFF5F5', padding: 20, paddingTop: 60 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#C53030', marginBottom: 10 }}>
            Erreur Coach Screen
          </Text>
          <Text style={{ fontSize: 14, color: '#742A2A', marginBottom: 10 }}>
            {this.state.error?.message}
          </Text>
          <ScrollView style={{ flex: 1, backgroundColor: '#FED7D7', borderRadius: 8, padding: 10 }}>
            <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#742A2A' }}>
              {this.state.error?.stack}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#742A2A', marginTop: 10 }}>
              {this.state.errorInfo?.componentStack}
            </Text>
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}

// Wrap CoachScreen with error boundary
const CoachScreenWithErrorBoundary = () => (
  <CoachErrorBoundary>
    <CoachScreen />
  </CoachErrorBoundary>
)

const TabIcon = ({
  Icon,
  focused,
  color,
  badge,
}: {
  Icon: typeof Home
  focused: boolean
  color: string
  badge?: number
}) => (
  <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
    <Icon size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
    {badge !== undefined && badge > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
      </View>
    )}
  </View>
)

export default function TabNavigator() {
  const insets = useSafeAreaInsets()
  const healthPermissionsRequested = useRef(false)

  // Le CoachScreen n'affiche QUE les messages du MessageCenter
  // Donc le badge doit refléter uniquement ces messages (pas le vieux CoachStore)
  const messages = useMessageCenter((state) => state.messages)
  const coachBadgeCount = messages.filter((m) => !m.read && !m.dismissed && (!m.expiresAt || new Date(m.expiresAt) > new Date())).length

  // Request HealthKit/Health Connect permissions once on first app launch
  // This makes LYM appear in iOS Health settings automatically
  useEffect(() => {
    const requestHealthPermissionsOnce = async () => {
      // Prevent multiple requests in the same session
      if (healthPermissionsRequested.current) return
      healthPermissionsRequested.current = true

      try {
        // Check if we've already requested permissions
        const alreadyRequested = await AsyncStorage.getItem(HEALTH_PERMISSIONS_REQUESTED_KEY)
        if (alreadyRequested === 'true') {
          console.log('[TabNavigator] Health permissions already requested previously')
          return
        }

        // Check if health services are available
        const available = await isHealthAvailable()
        if (!available) {
          console.log('[TabNavigator] Health services not available on this device')
          return
        }

        // Request permissions - this will show the HealthKit prompt on iOS
        console.log('[TabNavigator] Requesting health permissions...')
        const result = await requestHealthPermissions()
        console.log('[TabNavigator] Health permissions result:', result)

        // Mark as requested only after a successful init.
        // If we mark it too early, we might never prompt (e.g. native module missing, user cancelled, init error).
        if (result.isAvailable) {
          await AsyncStorage.setItem(HEALTH_PERMISSIONS_REQUESTED_KEY, 'true')
        } else {
          console.log('[TabNavigator] Not marking permissions as requested (init failed)')
        }
      } catch (error) {
        console.log('[TabNavigator] Error requesting health permissions:', error)
      }
    }

    // Small delay to let the app fully load before showing the permission dialog
    const timer = setTimeout(requestHealthPermissionsOnce, 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 60 + (Platform.OS === 'ios' ? insets.bottom : 10),
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 10,
          },
        ],
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Accueil',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Home} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Coach"
        component={CoachScreenWithErrorBoundary}
        options={{
          tabBarLabel: 'Coach',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Sparkles} focused={focused} color={color} badge={coachBadgeCount} />
          ),
        }}
      />
      <Tab.Screen
        name="Recipes"
        component={RecipesScreen}
        options={{
          tabBarLabel: 'Recettes',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={BookOpen} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Programs"
        component={ProgramsScreen}
        options={{
          tabBarLabel: 'Programmes',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Layers} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={User} focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg.elevated,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: 8,
    ...shadows.sm,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  iconContainer: {
    padding: 4,
  },
  iconContainerActive: {
    backgroundColor: colors.accent.light,
    borderRadius: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
})
