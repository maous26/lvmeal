// Meal Types for PRESENCE Nutrition App

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'
export type MealSource = 'manual' | 'photo' | 'voice' | 'barcode' | 'recipe' | 'ai'
export type ServingUnitType = 'g' | 'ml' | 'unit' | 'portion'

// Nutritional info
export interface NutritionInfo {
  calories: number
  proteins: number // g
  carbs: number // g
  fats: number // g
  fiber?: number // g
  sugar?: number // g
  sodium?: number // mg
  saturatedFat?: number // g
}

// Micronutrients (detailed tracking)
export interface Micronutrients {
  calcium?: number // mg
  iron?: number // mg
  vitaminD?: number // UI
  vitaminC?: number // mg
  vitaminB12?: number // µg
  zinc?: number // mg
  magnesium?: number // mg
  potassium?: number // mg
  omega3?: number // g
}

// Food item
export interface FoodItem {
  id: string
  name: string
  brand?: string
  barcode?: string
  serving: number // grams or ml
  servingUnit: string
  unit?: string // display unit (e.g., "g", "ml", "portion")
  nutrition: NutritionInfo
  micronutrients?: Micronutrients
  imageUrl?: string
  source: 'openfoodfacts' | 'ciqual' | 'local' | 'manual' | 'recipe' | 'ai'
  // Recipe linking
  isRecipe?: boolean
  recipeId?: string
  // Recipe-specific fields (for AI/recipe sources)
  description?: string
  ingredients?: { name: string; quantity: string; unit: string }[]
  instructions?: string[]
  prepTime?: number
  cookTime?: number
}

// Meal item (food with quantity)
export interface MealItem {
  id: string
  food: FoodItem
  quantity: number // multiplier of serving
  customServing?: number // override serving size
  notes?: string
}

// Complete meal
export interface Meal {
  id: string
  type: MealType
  date: string // YYYY-MM-DD
  time: string // HH:mm
  items: MealItem[]
  totalNutrition: NutritionInfo
  source: MealSource
  photoUrl?: string
  notes?: string
  location?: 'home' | 'restaurant' | 'work' | 'other'
  isPlanned: boolean
  feedback?: MealSatisfactionFeedback
  createdAt: string
  updatedAt: string
}

export interface MealSatisfactionFeedback {
  rating: 1 | 2 | 3 | 4 | 5
  satisfaction?: 'hungry' | 'satisfied' | 'full' | 'too_full'
  notes?: string
}

// Daily meals
export interface DailyMeals {
  date: string
  breakfast?: Meal
  lunch?: Meal
  snack?: Meal
  dinner?: Meal
  totalNutrition: NutritionInfo
  caloriesGoal: number
  proteinsGoal: number
  carbsGoal: number
  fatsGoal: number
}

// Daily nutrition summary
export interface DailyNutrition {
  date: string
  consumed: NutritionInfo
  target: NutritionInfo
  remaining: NutritionInfo
  percentage: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
}

// Recipe
export interface Recipe {
  id: string
  title: string
  description?: string
  imageUrl?: string
  servings: number
  prepTime: number // minutes
  cookTime: number // minutes
  totalTime: number // minutes
  difficulty: 'easy' | 'medium' | 'hard'
  ingredients: RecipeIngredient[]
  instructions: string[]
  nutritionPerServing: NutritionInfo
  tags: string[]
  cuisineType?: string
  dietTypes: string[] // vegetarian, vegan, keto, etc.
  allergens: string[]
  source: 'ai' | 'user' | 'community' | 'import'
  sourceUrl?: string
  rating?: number
  ratingCount?: number
  authorId?: string
  authorName?: string
  isFavorite?: boolean
  createdAt: string
  updatedAt: string
}

export interface RecipeIngredient {
  id: string
  name: string
  quantity: number
  unit: string
  optional?: boolean
  preparation?: string // e.g., "diced", "minced"
  foodId?: string // link to FoodItem
}

// Meal plan
export interface MealPlan {
  id: string
  name?: string
  startDate: string
  endDate: string
  days: MealPlanDay[]
  status: 'draft' | 'active' | 'completed' | 'archived'
  generatedBy: 'ai' | 'manual' | 'template'
  preferences?: MealPlanPreferences
  shoppingList?: ShoppingListItem[]
  feedback?: MealPlanFeedback
  createdAt: string
  updatedAt: string
}

export interface MealPlanDay {
  date: string
  breakfast?: PlannedMeal
  lunch?: PlannedMeal
  snack?: PlannedMeal
  dinner?: PlannedMeal
  totalNutrition: NutritionInfo
}

export interface PlannedMeal {
  id: string
  type: MealType
  recipe?: Recipe
  customName?: string
  nutrition: NutritionInfo
  isCompleted: boolean
  actualMealId?: string // link to logged meal
}

export interface MealPlanPreferences {
  cuisineTypes?: string[]
  maxPrepTime?: number
  budgetPerDay?: number
  avoidIngredients?: string[]
  preferIngredients?: string[]
  variety: 'low' | 'medium' | 'high'
}

export interface MealPlanFeedback {
  variety: 1 | 2 | 3 | 4 | 5
  practicality: 1 | 2 | 3 | 4 | 5
  satisfaction: 1 | 2 | 3 | 4 | 5
  wouldRepeat: boolean
  suggestions?: string
}

// Shopping list
export interface ShoppingListItem {
  id: string
  name: string
  quantity: number
  unit: string
  category: ShoppingCategory
  estimatedPrice?: number
  actualPrice?: number
  isChecked: boolean
  checkedAt?: string
  checkedBy?: string
  assignedTo?: string
  notes?: string
}

export type ShoppingCategory =
  | 'produce' // fruits & vegetables
  | 'meat'
  | 'fish'
  | 'dairy'
  | 'bakery'
  | 'grains'
  | 'canned'
  | 'frozen'
  | 'beverages'
  | 'snacks'
  | 'condiments'
  | 'other'

// Food search result
export interface FoodSearchResult {
  id: string
  name: string
  brand?: string
  imageUrl?: string
  nutrition: NutritionInfo
  serving: number
  servingUnit: string
  source: 'openfoodfacts' | 'ciqual' | 'recipe'
  score?: number // relevance score
}
