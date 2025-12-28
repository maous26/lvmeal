import React from 'react'
import { StyleSheet, View, Platform, Text } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  Home,
  Utensils,
  Bot,
  TrendingUp,
  User,
} from 'lucide-react-native'

import HomeScreen from '../screens/HomeScreen'
import MealsScreen from '../screens/MealsScreen'
import CoachScreen from '../screens/CoachScreen'
import ProgressScreen from '../screens/ProgressScreen'
import ProfileScreen from '../screens/ProfileScreen'

import { colors, shadows } from '../constants/theme'
import { useCoachStore } from '../stores/coach-store'

const Tab = createBottomTabNavigator()

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
  const unreadCount = useCoachStore((state) => state.unreadCount)

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
        name="Meals"
        component={MealsScreen}
        options={{
          tabBarLabel: 'Repas',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Utensils} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Coach"
        component={CoachScreen}
        options={{
          tabBarLabel: 'Coach',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={Bot} focused={focused} color={color} badge={unreadCount} />
          ),
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarLabel: 'Progrès',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon Icon={TrendingUp} focused={focused} color={color} />
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
