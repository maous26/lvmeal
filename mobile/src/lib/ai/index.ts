/**
 * AI Library exports for mobile
 */

// Prompts
export {
  MEAL_PLANNER_SYSTEM_PROMPT,
  SIMPLE_RECIPE_GUIDELINES,
  MEAL_TYPE_GUIDELINES,
  FOOD_ANALYSIS_PROMPT,
  FOOD_DESCRIPTION_PROMPT,
  RECIPE_GENERATION_PROMPT,
  RECIPE_TRANSLATION_PROMPT,
  QUICK_RECIPE_PROMPTS,
} from './prompts'

// Themes
export {
  CUISINE_THEMES,
  SEASONAL_THEMES,
  DAY_THEMES,
  getCurrentSeason,
  getRandomTheme,
  getSeasonalTheme,
  getThemedPrompt,
  getDayTheme,
  type CuisineTheme,
  type Season,
} from './themes'

// User context
export {
  generateUserProfileContext,
  generateShortContext,
  generateRemainingNutritionContext,
  getMealDistribution,
} from './user-context'
