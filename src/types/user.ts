// User Types for PRESENCE Nutrition App

// Basic enums
export type Gender = 'male' | 'female' | 'other'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type Goal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'health' | 'energy'
export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo'

// Meal source preference (RAG/IA style)
export type MealSourcePreference = 'fresh' | 'recipes' | 'quick' | 'balanced'

// Religious dietary restrictions (can be combined with DietType)
export type ReligiousDiet = 'halal' | 'casher' | null
export type CookingSkillLevel = 'beginner' | 'intermediate' | 'advanced'
export type FastingType = 'none' | '16_8' | '18_6' | '20_4' | '5_2' | 'eat_stop_eat'
export type SubscriptionPlan = 'free' | 'premium' | 'family'
export type AppMode = 'solo' | 'family'

// Metabolism profile (internal - never show "slow" to user)
export type MetabolismProfile = 'standard' | 'adaptive'

// Metabolism diagnostic factors
export interface MetabolismFactors {
  restrictiveDietsHistory: boolean    // "Tu as déjà fait plusieurs régimes restrictifs ?"
  eatsLessThanHunger: boolean         // "Tu manges souvent beaucoup moins que ta faim réelle ?"
  restrictionCrashCycle: boolean      // "Tu as des périodes où tu manges très peu puis craquage ?"
  metabolicSymptoms: boolean          // "Fatigue, froid, difficultés à perdre malgré peu de calories ?"
}

// Sport program phases (LymIA program - no NEAT, focus on real workouts)
export type ActivityPhase = 'discovery' | 'walking_program' | 'resistance_intro' | 'full_program'

// Sport program for LymIA
export interface SportProgram {
  currentPhase: ActivityPhase
  weekInPhase: number
  weeklyWalkingMinutes: number
  resistanceSessionsPerWeek: number
  cardioSessionsPerWeek: number
  restDaysPerWeek: number
}

// Nutritional approach for adaptive metabolism
export type NutritionalApproach = 'standard' | 'gentle' | 'reverse_dieting'

export interface NutritionalStrategy {
  approach: NutritionalApproach
  currentPhase: 'maintenance' | 'gentle_deficit' | 'reverse'
  weekInPhase: number
  deficitAmount: number  // 0, 100, or 200 kcal max for adaptive
  proteinPriority: boolean
  focusMetabolicHealth: boolean
}

// Daily wellness tracking
export interface DailyWellness {
  date: string
  // Sleep
  sleepHours: number
  sleepQuality: 1 | 2 | 3 | 4 | 5  // 1=poor, 5=excellent
  // Nutrition metrics
  fiberGrams: number
  proteinGrams: number
  waterLiters: number
  // Activity
  steps: number
  neatMinutes: number
  // Wellbeing
  stressLevel: 1 | 2 | 3 | 4 | 5  // 1=zen, 5=stressed
  energyLevel: 1 | 2 | 3 | 4 | 5
  // Women specific
  menstrualPhase?: 'follicular' | 'ovulation' | 'luteal' | 'menstrual'
}

// Lifestyle habits (from onboarding)
export interface LifestyleHabits {
  averageSleepHours: number
  sleepQualityPerception: 'poor' | 'average' | 'good' | 'excellent'
  stressLevelDaily: 'low' | 'moderate' | 'high' | 'very_high'
  waterIntakeDaily: number  // liters
  sedentaryHoursDaily: number
}

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
  religiousDiet?: ReligiousDiet  // Halal or Casher (can be combined with dietType)
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
  mealSourcePreference?: MealSourcePreference

  // Metabolism & Wellness (NEW)
  metabolismProfile?: MetabolismProfile
  metabolismFactors?: MetabolismFactors
  lifestyleHabits?: LifestyleHabits
  sportProgram?: SportProgram
  nutritionalStrategy?: NutritionalStrategy
  sportTrackingEnabled?: boolean  // Toggle for non-adaptive users

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
