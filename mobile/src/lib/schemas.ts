/**
 * Zod Schemas for Input Validation
 *
 * Validates external data (API responses, user inputs) before use.
 * Prevents crashes from malformed data.
 */

import { z } from 'zod'

// ============================================================================
// Food & Nutrition
// ============================================================================

export const NutritionInfoSchema = z.object({
  calories: z.number().min(0).max(10000),
  proteins: z.number().min(0).max(500),
  carbs: z.number().min(0).max(1000),
  fats: z.number().min(0).max(500),
  fiber: z.number().min(0).max(100).optional(),
  sugar: z.number().min(0).max(500).optional(),
  sodium: z.number().min(0).max(10000).optional(),
  saturatedFat: z.number().min(0).max(200).optional(),
})

export const FoodProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(500),
  brand: z.string().max(200).optional(),
  imageUrl: z.string().url().nullable().optional(),
  nutrition: NutritionInfoSchema,
  servingSize: z.number().min(0).max(10000).optional(),
  servingUnit: z.enum(['g', 'ml', 'unit']).optional(),
  category: z.string().max(200).optional(),
  source: z.enum(['openfoodfacts', 'ciqual', 'local', 'custom']).optional(),
  isGeneric: z.boolean().optional(),
})

export const FoodSearchResponseSchema = z.object({
  products: z.array(FoodProductSchema),
  total: z.number().optional(),
  sources: z.array(z.string()).optional(),
})

// ============================================================================
// Recipes
// ============================================================================

export const RecipeIngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.number().min(0),
  unit: z.string().min(1),
})

export const RecipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  prepTime: z.number().min(0).max(1440).optional(),
  cookTime: z.number().min(0).max(1440).optional(),
  servings: z.number().min(1).max(100).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  ingredients: z.array(RecipeIngredientSchema).optional(),
  instructions: z.array(z.string()).optional(),
  nutrition: NutritionInfoSchema.optional(),
  image: z.string().url().nullable().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
})

// ============================================================================
// User Profile
// ============================================================================

export const UserProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  age: z.number().min(1).max(150).optional(),
  weight: z.number().min(20).max(500).optional(),
  height: z.number().min(50).max(300).optional(),
  targetWeight: z.number().min(20).max(500).optional(),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']).optional(),
  goal: z.enum(['weight_loss', 'muscle_gain', 'maintenance', 'health', 'energy']).optional(),
  dietType: z.enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo']).optional(),
  allergies: z.array(z.string()).optional(),
  intolerances: z.array(z.string()).optional(),
})

// ============================================================================
// Open Food Facts API
// ============================================================================

export const OpenFoodFactsNutrimentsSchema = z.object({
  'energy-kcal_100g': z.number().optional(),
  proteins_100g: z.number().optional(),
  carbohydrates_100g: z.number().optional(),
  fat_100g: z.number().optional(),
  fiber_100g: z.number().optional(),
  sugars_100g: z.number().optional(),
  sodium_100g: z.number().optional(),
  'saturated-fat_100g': z.number().optional(),
}).passthrough()

export const OpenFoodFactsProductSchema = z.object({
  code: z.string(),
  product_name: z.string().optional(),
  product_name_fr: z.string().optional(),
  brands: z.string().optional(),
  image_url: z.string().optional(),
  image_front_small_url: z.string().optional(),
  nutriments: OpenFoodFactsNutrimentsSchema.optional(),
  serving_size: z.string().optional(),
  categories_tags: z.array(z.string()).optional(),
  nutriscore_grade: z.string().optional(),
}).passthrough()

export const OpenFoodFactsSearchResponseSchema = z.object({
  count: z.number().optional(),
  page: z.number().optional(),
  page_size: z.number().optional(),
  products: z.array(OpenFoodFactsProductSchema).default([]),
}).passthrough()

export const OpenFoodFactsBarcodeResponseSchema = z.object({
  status: z.number(),
  product: OpenFoodFactsProductSchema.optional(),
}).passthrough()

// ============================================================================
// API Responses
// ============================================================================

export const R2PresignResponseSchema = z.object({
  url: z.string().url(),
  publicUrl: z.string().url(),
  expiresIn: z.number().optional(),
})

export const APIErrorSchema = z.object({
  error: z.string(),
  status: z.number().optional(),
  code: z.string().optional(),
})

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Safely parse data with a Zod schema
 * Returns null if validation fails instead of throwing
 */
export function safeParse<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data)
  if (result.success) {
    return result.data
  }
  if (__DEV__) {
    console.warn('[Zod] Validation failed:', result.error.issues)
  }
  return null
}

/**
 * Parse with fallback value
 */
export function parseWithFallback<T>(schema: z.ZodType<T>, data: unknown, fallback: T): T {
  return safeParse(schema, data) ?? fallback
}

export type NutritionInfo = z.infer<typeof NutritionInfoSchema>
export type FoodProduct = z.infer<typeof FoodProductSchema>
export type Recipe = z.infer<typeof RecipeSchema>
export type UserProfile = z.infer<typeof UserProfileSchema>
