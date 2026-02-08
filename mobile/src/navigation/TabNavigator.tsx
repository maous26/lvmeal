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

import { useTheme } from '../contexts/ThemeContext'
import { shadows, radius, typography, fonts } from '../constants/theme'
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
        <View style={{ flex: 1, backgroundColor: '#FBF3F1', padding: 20, paddingTop: 60 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#C87863', marginBottom: 10 }}>
            Erreur Coach Screen
          </Text>
          <Text style={{ fontSize: 14, color: '#5C5550', marginBottom: 10 }}>
            {this.state.error?.message}
          </Text>
          <ScrollView style={{ flex: 1, backgroundColor: '#F7E6E3', borderRadius: 12, padding: 10 }}>
            <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#5C5550' }}>
              {this.state.error?.stack}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#5C5550', marginTop: 10 }}>
              {this.state.errorInfo?.componentStack}
            </Text>
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}

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
    <Icon size={22} color={color} strokeWidth={focused ? 2.5 : 1.8} />
    {badge !== undefined && badge > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
      </View>
    )}
  </View>
)

export default function TabNavigator() {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const healthPermissionsRequested = useRef(false)

  const messages = useMessageCenter((state) => state.messages)
  const coachBadgeCount = messages.filter((m) => !m.read && !m.dismissed && (!m.expiresAt || new Date(m.expiresAt) > new Date())).length

  useEffect(() => {
    const requestHealthPermissionsOnce = async () => {
      if (healthPermissionsRequested.current) return
      healthPermissionsRequested.current = true

      try {
        const alreadyRequested = await AsyncStorage.getItem(HEALTH_PERMISSIONS_REQUESTED_KEY)
        if (alreadyRequested === 'true') return

        const available = await isHealthAvailable()
        if (!available) return

        const result = await requestHealthPermissions()
        if (result.isAvailable) {
          await AsyncStorage.setItem(HEALTH_PERMISSIONS_REQUESTED_KEY, 'true')
        }
      } catch (error) {
        console.log('[TabNavigator] Error requesting health permissions:', error)
      }
    }

    const timer = setTimeout(requestHealthPermissionsOnce, 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: [
          {
            backgroundColor: colors.bg.elevated,
            borderTopWidth: 1,
            borderTopColor: colors.border.light,
            paddingTop: 8,
            height: 56 + (Platform.OS === 'ios' ? insets.bottom : 10),
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 10,
            ...shadows.xs,
          },
        ],
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          fontFamily: fonts.sans.medium,
          marginTop: 2,
        },
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
  iconContainer: {
    padding: 4,
    borderRadius: radius.sm,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(122, 158, 126, 0.1)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#C87863',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
})
