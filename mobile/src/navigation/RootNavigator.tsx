import React, { useState, useEffect } from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import TabNavigator from './TabNavigator'
import { OnboardingScreen } from '../screens/OnboardingScreen'
import AuthScreen from '../screens/AuthScreen'
import AddMealScreen from '../screens/AddMealScreen'
import WeeklyPlanScreen from '../screens/WeeklyPlanScreen'
import MetabolicBoostScreen from '../screens/MetabolicBoostScreen'
import RecipeDetailScreen from '../screens/RecipeDetailScreen'
import WellnessProgramScreen from '../screens/WellnessProgramScreen'
import MeditationListScreen from '../screens/MeditationListScreen'
import MeditationPlayerScreen from '../screens/MeditationPlayerScreen'
import EditProfileScreen from '../screens/EditProfileScreen'
import CalendarScreen from '../screens/CalendarScreen'
import WeightScreen from '../screens/WeightScreen'
import ProgressScreen from '../screens/ProgressScreen'
import PaywallScreen from '../screens/PaywallScreen'
import MealSourceSettingsScreen from '../screens/MealSourceSettingsScreen'
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen'
import MealInputSettingsScreen from '../screens/MealInputSettingsScreen'
import ScaleSettingsScreen from '../screens/ScaleSettingsScreen'
import BackupSettingsScreen from '../screens/BackupSettingsScreen'
import { useUserStore } from '../stores/user-store'
import { useAuthStore } from '../stores/auth-store'
import { isGoogleSignedIn, getCachedGoogleUser } from '../services/google-auth-service'
import type { MealType, Recipe } from '../types'
import type { RecipeComplexity } from '../components/dashboard/QuickActionsWidget'

export type RootStackParamList = {
  Auth: undefined
  Onboarding: undefined
  Main: undefined
  AddMeal: { type?: string }
  MealDetail: { mealId: string }
  RecipeDetail: {
    recipe?: Recipe
    suggestion?: {
      id: string
      name: string
      calories: number
      proteins: number
      carbs: number
      fats: number
      prepTime: number
      mealType: MealType
      imageUrl?: string
      isAI?: boolean
      isGustar?: boolean
      source?: string
    }
    mealType?: MealType
  }
  Achievements: undefined
  Settings: undefined
  WeightHistory: undefined
  Progress: undefined
  WellnessCheckin: undefined
  SportSession: { sessionId?: string }
  Plan: undefined
  WeeklyPlan: { duration?: 1 | 3 | 7; calorieReduction?: boolean; complexity?: RecipeComplexity } | undefined
  MetabolicBoost: undefined
  WellnessProgram: undefined
  MeditationList: undefined
  MeditationPlayer: { sessionId: string }
  EditProfile: undefined
  Calendar: undefined
  Paywall: undefined
  MealSourceSettings: undefined
  NotificationSettings: undefined
  MealInputSettings: undefined
  ScaleSettings: undefined
  BackupSettings: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  const { isOnboarded, profile, setOnboarded } = useUserStore()
  const { isAuthenticated } = useAuthStore()
  const [showAuth, setShowAuth] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Check if user has cached Google auth on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        // Check if user has cached Google credentials
        const cachedUser = await getCachedGoogleUser()
        const signedIn = await isGoogleSignedIn()

        if (cachedUser || signedIn) {
          // User has previous auth, check if they completed onboarding
          if (profile?.onboardingCompleted || isOnboarded) {
            // Returning user with completed profile - go straight to app
            setOnboarded(true)
          } else {
            // Has auth but no profile - show auth then onboarding
            setShowAuth(true)
          }
        } else {
          // No cached auth - show auth screen for new users
          setShowAuth(!isOnboarded)
        }
      } catch (error) {
        console.error('[RootNavigator] Auth check error:', error)
        setShowAuth(!isOnboarded)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkExistingAuth()
  }, [])

  // Handle auth completion
  const handleAuthenticated = (isNewUser: boolean) => {
    if (isNewUser) {
      // New user - go to onboarding
      setShowAuth(false)
    } else {
      // Returning user - go straight to main
      setOnboarded(true)
      setShowAuth(false)
    }
  }

  // Show nothing while checking auth state
  if (isCheckingAuth) {
    return null
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName={isOnboarded ? 'Main' : showAuth ? 'Auth' : 'Onboarding'}
    >
      {showAuth && !isOnboarded ? (
        <Stack.Screen name="Auth">
          {(props) => (
            <AuthScreen
              {...props}
              onAuthenticated={handleAuthenticated}
            />
          )}
        </Stack.Screen>
      ) : !isOnboarded ? (
        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen
              {...props}
              onComplete={() => {
                // Navigation will happen automatically due to isOnboarded change
              }}
            />
          )}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen
            name="AddMeal"
            component={AddMealScreen}
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="WeeklyPlan"
            component={WeeklyPlanScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="MetabolicBoost"
            component={MetabolicBoostScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="RecipeDetail"
            component={RecipeDetailScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="WellnessProgram"
            component={WellnessProgramScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="MeditationList"
            component={MeditationListScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="MeditationPlayer"
            component={MeditationPlayerScreen}
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="Calendar"
            component={CalendarScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="WeightHistory"
            component={WeightScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="Progress"
            component={ProgressScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="MealSourceSettings"
            component={MealSourceSettingsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="NotificationSettings"
            component={NotificationSettingsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="MealInputSettings"
            component={MealInputSettingsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="ScaleSettings"
            component={ScaleSettingsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="BackupSettings"
            component={BackupSettingsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  )
}
