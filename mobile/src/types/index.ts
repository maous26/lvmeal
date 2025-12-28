// =============================================================================
// PRESENCE MOBILE - Complete Types (Ported from Web App)
// =============================================================================

// =============================================================================
// BASIC TYPES
// =============================================================================

export type Gender = 'male' | 'female' | 'other'

export type Goal = 'weight_loss' | 'muscle_gain' | 'maintenance' | 'health' | 'energy'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'

export type DietType = 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo'

export type ReligiousDiet = 'halal' | 'casher' | null

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export type CookingLevel = 'beginner' | 'intermediate' | 'advanced'

export interface CookingPreferences {
  level: CookingLevel
  weekdayTime: number // minutes available per meal on weekdays
  weekendTime: number // minutes available per meal on weekends
  batchCooking: boolean // willing to meal prep
  quickMealsOnly: boolean // prefers <20min recipes
}

export type MealSource = 'manual' | 'photo' | 'voice' | 'barcode' | 'ai' | 'recipe' | 'plan'

// =============================================================================
// LIFESTYLE & METABOLISM
// =============================================================================

export interface LifestyleHabits {
  averageSleepHours: number
  sleepQualityPerception: 'poor' | 'average' | 'good' | 'excellent'
  stressLevelDaily: 'low' | 'moderate' | 'high' | 'very_high'
  waterIntakeDaily: number // in liters
}

export interface MetabolismFactors {
  restrictiveDietsHistory: boolean
  eatsLessThanHunger: boolean
  restrictionCrashCycle: boolean
  metabolicSymptoms: boolean
}

export type MetabolismProfile = 'standard' | 'adaptive'

export interface NutritionalStrategy {
  approach: 'standard' | 'progressive' | 'metabolic_repair'
  currentPhase?: string
  weekInPhase?: number
  deficitAmount?: number
  proteinPriority?: boolean
  focusMetabolicHealth?: boolean
}

// =============================================================================
// NUTRITION
// =============================================================================

export interface NutritionInfo {
  calories: number
  proteins: number
  carbs: number
  fats: number
  fiber?: number
  sugar?: number
  sodium?: number
  saturatedFat?: number
}

export interface NutritionalNeeds {
  calories: number
  proteins: number
  carbs: number
  fats: number
  fiber: number
  water: number
  calcium?: number
  iron?: number
  vitaminD?: number
  vitaminC?: number
  vitaminB12?: number
  zinc?: number
  magnesium?: number
  potassium?: number
  omega3?: number
}

// =============================================================================
// USER PROFILE
// =============================================================================

export interface UserProfile {
  id?: string
  name?: string // Display name (can be firstName or combined)
  firstName: string
  lastName?: string
  email?: string
  gender: Gender
  age: number
  height: number // in cm
  weight: number // in kg
  targetWeight?: number
  activityLevel: ActivityLevel
  goal: Goal
  diet?: DietType // Alias for dietType
  dietType: DietType
  religiousDiet?: ReligiousDiet
  allergies?: string[]
  lifestyleHabits?: LifestyleHabits
  metabolismFactors?: MetabolismFactors
  metabolismProfile?: MetabolismProfile
  nutritionalNeeds?: NutritionalNeeds
  nutritionalStrategy?: NutritionalStrategy // For adaptive metabolism
  sportTrackingEnabled?: boolean
  sportProgram?: WeeklyProgram | null
  cookingPreferences?: CookingPreferences
  onboardingCompleted?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface WeightEntry {
  id: string
  date: string
  weight: number
  note?: string
  source?: 'manual' | 'device'
}

// =============================================================================
// FOOD & MEALS
// =============================================================================

export interface FoodItem {
  id: string
  name: string
  brand?: string
  category?: string
  nutrition: NutritionInfo
  servingSize: number
  servingUnit: string
  barcode?: string
  imageUrl?: string
  source?: 'ciqual' | 'openfoodfacts' | 'manual' | 'ai' | 'recipe' | 'photo' | 'voice' | 'barcode'
  isRecipe?: boolean
  recipeId?: string
}

export interface MealItem {
  id: string
  food: FoodItem
  quantity: number // multiplier for servingSize
  servingUnit?: string
}

export interface Meal {
  id: string
  type: MealType
  date: string
  time: string
  items: MealItem[]
  totalNutrition: NutritionInfo
  source: MealSource
  isPlanned: boolean
  notes?: string
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

export interface DailyMeals {
  date: string
  meals: Meal[]
  totalNutrition: NutritionInfo
  hydration: number // in ml
}

// Alias for DailyMeals (used in some stores)
export type DailyData = DailyMeals

export interface NutritionGoals {
  calories: number
  proteins: number
  carbs: number
  fats: number
  fiber?: number
  water?: number
}

// =============================================================================
// RECIPES
// =============================================================================

export interface RecipeIngredient {
  id: string
  name: string
  amount: number
  unit: string
  calories?: number
  notes?: string
}

export interface Recipe {
  id: string
  title: string
  description?: string
  imageUrl?: string
  prepTime: number // in minutes
  cookTime?: number
  totalTime?: number // prepTime + cookTime
  servings: number
  difficulty?: 'easy' | 'medium' | 'hard'
  category?: string
  ingredients: RecipeIngredient[]
  instructions: string[]
  nutrition: NutritionInfo
  nutritionPerServing?: NutritionInfo // Per-serving nutrition
  dietTypes?: string[]
  tags?: string[]
  allergens?: string[]
  source?: string
  sourceUrl?: string
  rating?: number
  ratingCount?: number
  isFavorite?: boolean
  createdAt?: string
}

// =============================================================================
// MEAL PLANNING
// =============================================================================

export interface PlannedMeal {
  id: string
  type: MealType
  recipe?: Recipe
  customName?: string
  nutrition: NutritionInfo
  isCompleted?: boolean
}

export interface DayPlan {
  date: string
  dayOfWeek: string
  meals: PlannedMeal[]
  totalNutrition: NutritionInfo
  isCheatDay?: boolean
}

export interface MealPlan {
  id: string
  weekStartDate: string
  days: DayPlan[]
  totalCalories: number
  avgDailyCalories: number
  createdAt: string
  isActive: boolean
}

export interface ShoppingItem {
  name: string
  quantity: number
  unit: string
  category: string
  checked?: boolean
}

export interface ShoppingList {
  id: string
  planId: string
  items: ShoppingItem[]
  createdAt: string
}

// =============================================================================
// GAMIFICATION
// =============================================================================

export type BadgeCategory = 'streak' | 'nutrition' | 'planning' | 'milestone' | 'special' | 'wellness' | 'sport'

export interface BadgeDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: BadgeCategory
  xpReward: number
  condition: {
    type: 'streak' | 'count' | 'milestone' | 'special'
    target: number
    metric?: string
  }
}

export interface EarnedBadge {
  badgeId: string
  earnedAt: string
  notified: boolean
}

export interface LevelInfo {
  level: number
  title: string
  xpRequired: number
  xpForNext: number
}

export interface PendingReward {
  id: string
  type: 'xp' | 'badge' | 'level_up'
  amount?: number
  badgeId?: string
  newLevel?: number
  timestamp: string
}

// =============================================================================
// WELLNESS
// =============================================================================

export interface WellnessEntry {
  id: string
  date: string
  sleepHours?: number
  sleepQuality?: 1 | 2 | 3 | 4 | 5
  energyLevel?: 1 | 2 | 3 | 4 | 5
  stressLevel?: 1 | 2 | 3 | 4 | 5
  mood?: 1 | 2 | 3 | 4 | 5
  digestion?: 1 | 2 | 3 | 4 | 5
  steps?: number
  waterLiters?: number // Hydration tracking
  notes?: string
  createdAt: string
}

export interface WellnessTargets {
  sleepHours: number
  steps: number
  waterMl: number
  waterLiters: number // Convenience property
  fiberG: number
}

export interface WellnessStreaks {
  sleep7h: number
  hydration: number
  steps: number
  fiber: number
}

// =============================================================================
// SPORT PROGRAM (LymIA)
// =============================================================================

export type SportPhase = 'discovery' | 'walking' | 'resistance_intro' | 'full_program'

export type ExerciseType =
  | 'warmup'
  | 'cardio'
  | 'strength'
  | 'flexibility'
  | 'breathing'
  | 'cooldown'
  | 'walking'
  | 'resistance'
  | 'core'

export interface Exercise {
  id: string
  name: string
  type: ExerciseType
  duration?: number // in seconds
  reps?: number
  sets?: number
  restBetweenSets?: number
  description: string
  tips?: string[]
  videoUrl?: string
  imageUrl?: string
  difficulty: 'easy' | 'medium' | 'hard'
  equipment?: string[]
  targetMuscles?: string[]
}

export interface SessionFeedback {
  sessionId: string
  date: string
  completed: boolean
  difficulty: 'too_easy' | 'just_right' | 'too_hard'
  energyBefore?: 1 | 2 | 3 | 4 | 5
  energyAfter?: 1 | 2 | 3 | 4 | 5
  notes?: string
  painAreas?: string[]
  enjoyment?: 1 | 2 | 3 | 4 | 5
}

export interface GeneratedSession {
  id: string
  date: string
  phase: SportPhase
  weekNumber: number
  dayOfWeek: number
  title: string
  description: string
  duration: number // total in minutes
  exercises: Exercise[]
  warmup?: Exercise[]
  cooldown?: Exercise[]
  isCompleted: boolean
  feedback?: SessionFeedback
  adaptations?: string[]
}

export interface WeeklyProgram {
  id: string
  weekNumber: number
  phase: SportPhase
  startDate: string
  endDate: string
  sessions: GeneratedSession[]
  goals: string[]
  tips: string[]
  isCompleted: boolean
  completionRate: number
}

export interface SportProgramState {
  currentPhase: SportPhase
  currentWeek: number
  totalWeeks: number
  startDate: string
  programs: WeeklyProgram[]
  completedSessions: number
  totalSessions: number
  streak: number
  lastSessionDate?: string
}

// =============================================================================
// CALORIC BANK
// =============================================================================

export interface DailyBalance {
  date: string
  targetCalories: number
  consumedCalories: number
  balance: number // positive = saved, negative = exceeded
  isCheatDay: boolean
}

export interface CaloricBankState {
  weeklyBalance: DailyBalance[]
  totalSaved: number
  cheatMealBudget: number
  lastCheatMeal?: string
  cheatMealFrequency: 'weekly' | 'biweekly' | 'monthly'
}

// =============================================================================
// DEVICES
// =============================================================================

export type DeviceType = 'apple_watch' | 'fitbit' | 'garmin' | 'samsung_health' | 'google_fit'

export type DeviceStatus = 'connected' | 'disconnected' | 'syncing' | 'error'

export interface ConnectedDevice {
  id: string
  type: DeviceType
  name: string
  status: DeviceStatus
  lastSync: string | null
  connectedAt: string
  permissions: {
    steps: boolean
    heartRate: boolean
    sleep: boolean
    workouts: boolean
    calories: boolean
  }
  metadata?: {
    model?: string
    firmwareVersion?: string
    batteryLevel?: number
  }
}

export interface DeviceSyncData {
  steps?: number
  heartRate?: number
  sleepHours?: number
  activeCalories?: number
  workoutMinutes?: number
  lastUpdated: string
}

// =============================================================================
// AI TYPES
// =============================================================================

export interface AnalyzedFood {
  name: string
  estimatedWeight: number
  confidence: number
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
    fiber?: number
  }
}

export interface FoodAnalysisResult {
  success: boolean
  foods: AnalyzedFood[]
  totalNutrition: NutritionInfo
  description?: string
  error?: string
}

export interface AIRecipeResult {
  success: boolean
  recipe?: Recipe
  error?: string
}

// =============================================================================
// NAVIGATION TYPES
// =============================================================================

export type RootStackParamList = {
  Onboarding: undefined
  Main: undefined
  MealAdd: { type: MealType; date?: string }
  MealDetail: { mealId: string; date: string }
  RecipeDetail: { recipeId: string }
  FoodSearch: { mealType: MealType; date?: string }
  PhotoScanner: { mealType: MealType }
  VoiceInput: { mealType: MealType }
  BarcodeScanner: { mealType: MealType }
  WeeklyPlan: undefined
  SportSession: { sessionId: string }
  WellnessCheckin: undefined
  Achievements: undefined
  Settings: undefined
}

export type TabParamList = {
  Dashboard: undefined
  Meals: undefined
  Plan: undefined
  Recipes: undefined
  Profile: undefined
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
