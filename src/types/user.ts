// User Types for PRESENCE Nutrition App

// Basic enums
export type Gender = 'male' | 'female' | 'other'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type Goal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'health' | 'energy'
export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo'
export type CookingSkillLevel = 'beginner' | 'intermediate' | 'advanced'
export type FastingType = 'none' | '16_8' | '18_6' | '20_4' | '5_2' | 'eat_stop_eat'
export type SubscriptionPlan = 'free' | 'premium' | 'family'
export type AppMode = 'solo' | 'family'

// Fasting schedule
export interface FastingSchedule {
  type: FastingType
  eatingWindowStart?: string // HH:mm format
  eatingWindowEnd?: string
  fastingDays?: number[] // 0-6 for weekly fasting
}

// Child profile for family mode
export interface ChildProfile {
  id: string
  firstName: string
  birthDate: string
  gender: Gender
  allergies: string[]
  preferences: string[]
}

// Meal feedback
export interface MealFeedback {
  rating: 1 | 2 | 3 | 4 | 5
  taste?: 1 | 2 | 3 | 4 | 5
  difficulty?: 1 | 2 | 3 | 4 | 5
  wouldMakeAgain?: boolean
  tags?: string[]
  comment?: string
}

// Complete user profile
export interface UserProfile {
  // Identity
  id?: string
  email?: string
  firstName: string
  lastName?: string
  avatarUrl?: string

  // Physical
  birthDate?: string
  age?: number // calculated from birthDate or set directly
  gender?: Gender
  height?: number // cm
  weight?: number // kg
  targetWeight?: number // kg

  // Activity
  activityLevel?: ActivityLevel
  sportsFrequency?: number // sessions per week
  sportsTypes?: string[]

  // Nutrition goals
  goal?: Goal
  dailyCaloriesTarget?: number
  proteinTarget?: number
  carbsTarget?: number
  fatTarget?: number

  // Diet
  dietType?: DietType
  allergies?: string[]
  intolerances?: string[]
  dislikedFoods?: string[]
  likedFoods?: string[]

  // Cooking
  cookingSkillLevel?: CookingSkillLevel
  cookingTimeAvailable?: number // minutes (deprecated, use weekday/weekend)
  cookingTimeWeekday?: number // minutes available on weekdays
  cookingTimeWeekend?: number // minutes available on weekends
  kitchenEquipment?: string[]

  // Fasting
  fastingSchedule?: FastingSchedule

  // Family
  children?: ChildProfile[]

  // Preferences
  preferredCuisines?: string[]
  weeklyBudget?: number // euros per week
  pricePreference?: 'economy' | 'balanced' | 'premium'

  // Onboarding
  onboardingCompleted?: boolean
  onboardingStep?: number

  // Subscription
  subscriptionPlan?: SubscriptionPlan
  subscriptionExpiresAt?: string

  // Calculated nutritional needs (from profile)
  nutritionalNeeds?: NutritionalNeeds

  // Timestamps
  createdAt?: string
  updatedAt?: string
}

// Nutritional needs (calculated)
export interface NutritionalNeeds {
  calories: number
  proteins: number // g
  carbs: number // g
  fats: number // g
  fiber: number // g
  water: number // L

  // Micronutrients (ANSES standards)
  calcium: number // mg
  iron: number // mg
  vitaminD: number // UI
  vitaminC: number // mg
  vitaminB12: number // µg
  zinc: number // mg
  magnesium: number // mg
  potassium: number // mg
  omega3: number // g
}

// User stats
export interface UserStats {
  currentWeight: number
  startWeight: number
  targetWeight: number
  weightChange: number
  streakDays: number
  totalMealsLogged: number
  averageCalories: number
  achievements: string[]
}

// User ranking (gamification)
export interface UserRanking {
  level: number
  xp: number
  xpToNextLevel: number
  rank: string
  badges: Badge[]
  weeklyPoints: number
  monthlyPoints: number
  totalPoints: number
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt?: string
  category: 'nutrition' | 'streak' | 'community' | 'achievement'
}

// Weight entry
export interface WeightEntry {
  id: string
  weight: number // kg
  bodyFat?: number // %
  muscleMass?: number // %
  waterPercentage?: number // %
  bmi?: number
  date: string
  source: 'manual' | 'smart_scale' | 'apple_health' | 'google_fit'
  note?: string
}

// Connected device
export interface ConnectedDevice {
  id: string
  type: 'apple_health' | 'google_fit' | 'withings' | 'fitbit' | 'garmin'
  name: string
  isConnected: boolean
  lastSyncAt?: string
}
