import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import TabNavigator from './TabNavigator'
import { OnboardingScreen } from '../screens/OnboardingScreen'
import AddMealScreen from '../screens/AddMealScreen'
import WeeklyPlanScreen from '../screens/WeeklyPlanScreen'
import MetabolicBoostScreen from '../screens/MetabolicBoostScreen'
import RecipeDetailScreen from '../screens/RecipeDetailScreen'
import SportInitiationScreen from '../screens/SportInitiationScreen'
import EditProfileScreen from '../screens/EditProfileScreen'
import { useUserStore } from '../stores/user-store'
import type { MealType, Recipe } from '../types'

export type RootStackParamList = {
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
  WellnessCheckin: undefined
  SportSession: { sessionId?: string }
  Plan: undefined
  WeeklyPlan: undefined
  MetabolicBoost: undefined
  SportInitiation: undefined
  EditProfile: undefined
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
            name="SportInitiation"
            component={SportInitiationScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
        </>
      )}
    </Stack.Navigator>
  )
}
