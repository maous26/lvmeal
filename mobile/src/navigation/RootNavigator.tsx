import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import TabNavigator from './TabNavigator'
import { OnboardingScreen } from '../screens/OnboardingScreen'
import AddMealScreen from '../screens/AddMealScreen'
import WeeklyPlanScreen from '../screens/WeeklyPlanScreen'
import { useUserStore } from '../stores/user-store'

export type RootStackParamList = {
  Onboarding: undefined
  Main: undefined
  AddMeal: { type?: string }
  MealDetail: { mealId: string }
  RecipeDetail: { recipeId: string }
  Achievements: undefined
  Settings: undefined
  WeightHistory: undefined
  WellnessCheckin: undefined
  SportSession: { sessionId?: string }
  Plan: undefined
  WeeklyPlan: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function RootNavigator() {
  const { isOnboarded } = useUserStore()

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName={isOnboarded ? 'Main' : 'Onboarding'}
    >
      {!isOnboarded ? (
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
        </>
      )}
    </Stack.Navigator>
  )
}
