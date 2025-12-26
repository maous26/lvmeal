// Types for Presence Mobile App

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export type GoalType = 'lose' | 'maintain' | 'gain' | 'muscle'

export type DietType = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'halal' | 'casher'

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

export type Gender = 'male' | 'female' | 'other'

export interface NutritionInfo {
  calories: number
  proteins: number
  carbs: number
  fats: number
  fiber?: number
  sugar?: number
  sodium?: number
}

export interface FoodItem {
  id: string
  name: string
  brand?: string
  nutrition: NutritionInfo
  servingSize: number
  servingUnit: 'g' | 'ml' | 'unit'
  category?: string
  imageUrl?: string
  isRecipe?: boolean
  recipeId?: string
}

export interface MealItem {
  id: string
  food: FoodItem
  quantity: number
  addedAt: string
}

export interface Meal {
  id: string
  type: MealType
  items: MealItem[]
  totalNutrition: NutritionInfo
  createdAt: string
}

export interface DailyData {
  date: string
  meals: Meal[]
  waterIntake: number
  totalNutrition: NutritionInfo
}

export interface UserProfile {
  id: string
  name: string
  email?: string
  gender: Gender
  birthDate?: string
  height: number // cm
  weight: number // kg
  targetWeight?: number
  activityLevel: ActivityLevel
  goal: GoalType
  diet: DietType
  onboardingCompleted: boolean
  createdAt: string
}

export interface NutritionGoals {
  calories: number
  proteins: number
  carbs: number
  fats: number
  fiber?: number
  water?: number
}

export interface WeightEntry {
  id: string
  date: string
  weight: number
  note?: string
}

export interface Recipe {
  id: string
  title: string
  description?: string
  imageUrl?: string
  servings: number
  prepTime: number
  cookTime: number
  totalTime: number
  difficulty: 'easy' | 'medium' | 'hard'
  ingredients: RecipeIngredient[]
  instructions: string[]
  nutritionPerServing: NutritionInfo
  tags: string[]
  cuisineType?: string
  dietTypes: string[]
  allergens: string[]
  source?: string
  rating?: number
  ratingCount?: number
  isFavorite?: boolean
}

export interface RecipeIngredient {
  id: string
  name: string
  quantity: number
  unit: string
  preparation?: string
}

// Gamification
export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  unlockedAt?: string
  progress?: number
  maxProgress?: number
}

export interface GamificationState {
  xp: number
  level: number
  streak: number
  badges: Badge[]
  lastActivityDate?: string
}
