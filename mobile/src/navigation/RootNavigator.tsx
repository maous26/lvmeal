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
import ChangePasswordScreen from '../screens/ChangePasswordScreen'
import AddCustomRecipeScreen from '../screens/AddCustomRecipeScreen'
import CustomRecipesScreen from '../screens/CustomRecipesScreen'
import { useUserStore } from '../stores/user-store'
import { useAuthStore } from '../stores/auth-store'
import { isGoogleSignedIn, getCachedGoogleUser } from '../services/google-auth-service'
import { isEmailSignedIn, getCachedEmailUser } from '../services/email-auth-service'
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
  ChangePassword: { fromDeepLink?: boolean } | undefined
  AddCustomRecipe: undefined
  CustomRecipes: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  const { isOnboarded, profile, setOnboarded, clearProfile } = useUserStore()
  const { isAuthenticated } = useAuthStore()
  const [showAuth, setShowAuth] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isReturningUser, setIsReturningUser] = useState(false) // True when user clicked "J'ai déjà un compte"

  // Check if user has cached auth (Google or Email) on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      try {
        // Check if user has cached Google or Email credentials
        const cachedGoogleUser = await getCachedGoogleUser()
        const googleSignedIn = await isGoogleSignedIn()
        const cachedEmailUser = await getCachedEmailUser()
        const emailSignedIn = await isEmailSignedIn()

        const hasAuth = cachedGoogleUser || googleSignedIn || cachedEmailUser || emailSignedIn
        const hasCompletedOnboarding = profile?.onboardingCompleted || isOnboarded

        // CRITICAL: Check for inconsistent state - onboarded but no profile data
        // This can happen if AsyncStorage was partially cleared or corrupted
        const hasProfileData = profile && profile.weight && profile.goal
        const isInconsistentState = hasCompletedOnboarding && !hasProfileData

        console.log('[RootNavigator] Auth check:', {
          hasAuth,
          hasCompletedOnboarding,
          isOnboarded,
          hasProfileData,
          isInconsistentState,
          profileWeight: profile?.weight,
          profileGoal: profile?.goal,
        })

        if (isInconsistentState) {
          // Inconsistent state: user is marked as onboarded but profile data is missing
          // Force re-onboarding to restore profile data
          console.warn('[RootNavigator] Inconsistent state detected! Profile data missing. Forcing re-onboarding.')
          clearProfile() // This will set isOnboarded to false
          setShowAuth(false)
        } else if (hasCompletedOnboarding) {
          // User has completed onboarding previously
          if (hasAuth) {
            // Returning user with auth - go straight to app
            setOnboarded(true)
            setShowAuth(false)
          } else {
            // Has completed onboarding but no auth (logged out) - show auth screen
            setShowAuth(true)
          }
        } else {
          // New user - show onboarding (auth is handled in StepCloudSync at the end)
          setShowAuth(false)
        }
      } catch (error) {
        console.error('[RootNavigator] Auth check error:', error)
        // On error, default to onboarding for new users
        setShowAuth(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkExistingAuth()
  }, [])

  // Handle auth completion (for returning users who need to re-authenticate)
  const handleAuthenticated = (isNewUser: boolean) => {
    // After auth, returning users go straight to main (they already did onboarding)
    setOnboarded(true)
    setShowAuth(false)
    setIsReturningUser(false) // Reset for next time
  }

  // Show nothing while checking auth state
  if (isCheckingAuth) {
    return null
  }

  // Determine initial route:
  // 1. If already onboarded -> Main
  // 2. If onboarded but needs auth (logged out returning user) -> Auth
  // 3. If not onboarded (new user) -> Onboarding (auth is at the end via StepCloudSync)
  const getInitialRoute = () => {
    if (isOnboarded && !showAuth) return 'Main'
    if (showAuth) return 'Auth'
    return 'Onboarding'
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName={getInitialRoute()}
    >
      {showAuth ? (
        <Stack.Screen name="Auth">
          {(props) => (
            <AuthScreen
              {...props}
              onAuthenticated={handleAuthenticated}
              isReturningUser={isReturningUser}
              onRestartOnboarding={() => {
                // Reset returning-user auth flow back to onboarding
                clearProfile()
                setShowAuth(false)
                setIsReturningUser(false)
              }}
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
              onHaveAccount={() => {
                // User claims to have an account - show auth screen in sign-in mode
                setIsReturningUser(true)
                setShowAuth(true)
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
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="AddCustomRecipe"
            component={AddCustomRecipeScreen}
            options={{
              animation: 'slide_from_bottom',
              presentation: 'modal',
            }}
          />
          <Stack.Screen
            name="CustomRecipes"
            component={CustomRecipesScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  )
}
