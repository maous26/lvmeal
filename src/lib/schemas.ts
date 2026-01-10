/**
 * Zod Schemas for Backend API Validation
 *
 * Validates incoming request bodies before processing.
 */

import { z } from 'zod'

// ============================================================================
// Recipe Suggest API
// ============================================================================

export const NutritionalNeedsSchema = z.object({
  calories: z.number().min(0).max(10000),
  proteins: z.number().min(0).max(500),
  carbs: z.number().min(0).max(1000),
  fats: z.number().min(0).max(500),
})

export const UserProfileSchema = z.object({
  firstName: z.string().max(100).optional(),
  gender: z.string().optional(),
  age: z.number().min(1).max(150).optional(),
  weight: z.number().min(20).max(500).optional(),
  height: z.number().min(50).max(300).optional(),
  targetWeight: z.number().min(20).max(500).optional(),
  activityLevel: z.string().optional(),
  goal: z.string().optional(),
  dietType: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  intolerances: z.array(z.string()).optional(),
  dislikedFoods: z.array(z.string()).optional(),
  likedFoods: z.array(z.string()).optional(),
  cookingSkillLevel: z.string().optional(),
  cookingTimeWeekday: z.number().min(0).max(300).optional(),
  cookingTimeWeekend: z.number().min(0).max(300).optional(),
  preferredCuisines: z.array(z.string()).optional(),
  nutritionalNeeds: NutritionalNeedsSchema.optional(),
})

export const NutritionConsumedSchema = z.object({
  calories: z.number().min(0).max(20000),
  proteins: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(2000),
  fats: z.number().min(0).max(1000),
})

export const SuggestRequestSchema = z.object({
  profile: UserProfileSchema,
  mealType: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
  consumed: NutritionConsumedSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
})

// ============================================================================
// Storage API
// ============================================================================

export const PresignRequestSchema = z.object({
  method: z.enum(['PUT', 'GET']),
  key: z.string()
    .min(1)
    .max(500)
    .refine((key) => !key.includes('..'), 'Path traversal not allowed')
    .refine((key) => !key.startsWith('/'), 'Key cannot start with /'),
  contentType: z.string().max(100).optional(),
})

export const DeleteRequestSchema = z.object({
  key: z.string()
    .min(1)
    .max(500)
    .refine((key) => !key.includes('..'), 'Path traversal not allowed')
    .refine((key) => !key.startsWith('/'), 'Key cannot start with /'),
})

// ============================================================================
// Validation Helper
// ============================================================================

export function validateRequest<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errorMessages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
  return { success: false, error: errorMessages }
}
