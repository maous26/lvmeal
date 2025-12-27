/**
 * Generate user profile context for AI prompts
 * Ported from web app for mobile use
 */

import type { UserProfile, NutritionalNeeds } from '../../types'

// Label mappings for French output
const GENDER_LABELS: Record<string, string> = {
  male: 'Homme',
  female: 'Femme',
  other: 'Autre',
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentaire',
  light: 'Legerement actif',
  moderate: 'Moderement actif',
  active: 'Tres actif',
  athlete: 'Athlete',
}

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Perte de poids',
  muscle_gain: 'Prise de muscle',
  maintenance: 'Maintien du poids',
  health: 'Ameliorer sa sante',
  energy: "Plus d'energie",
}

const DIET_LABELS: Record<string, string> = {
  omnivore: 'Omnivore',
  vegetarian: 'Vegetarien',
  vegan: 'Vegan',
  pescatarian: 'Pescetarien',
  keto: 'Cetogene',
  paleo: 'Paleo',
}

const SKILL_LABELS: Record<string, string> = {
  beginner: 'Debutant',
  intermediate: 'Intermediaire',
  advanced: 'Avance',
}

/**
 * Generate a comprehensive user profile context string for AI prompts
 */
export function generateUserProfileContext(profile: UserProfile): string {
  const parts: string[] = ['PROFIL UTILISATEUR:']

  // Basic info
  if (profile.firstName) {
    parts.push(`- Prenom: ${profile.firstName}`)
  }

  // Physical
  if (profile.age) {
    parts.push(`- Age: ${profile.age} ans`)
  }

  if (profile.gender) {
    parts.push(`- Genre: ${GENDER_LABELS[profile.gender] || profile.gender}`)
  }

  if (profile.weight) {
    parts.push(`- Poids actuel: ${profile.weight} kg`)
  }

  if (profile.height) {
    parts.push(`- Taille: ${profile.height} cm`)
  }

  if (profile.targetWeight && profile.weight) {
    const diff = profile.targetWeight - profile.weight
    if (diff < 0) {
      parts.push(`- Objectif: perdre ${Math.abs(diff)} kg`)
    } else if (diff > 0) {
      parts.push(`- Objectif: prendre ${diff} kg`)
    }
  }

  // Activity
  if (profile.activityLevel) {
    parts.push(`- Niveau d'activite: ${ACTIVITY_LABELS[profile.activityLevel] || profile.activityLevel}`)
  }

  // Goals
  if (profile.goal) {
    parts.push(`- Objectif: ${GOAL_LABELS[profile.goal] || profile.goal}`)
  }

  // Diet
  if (profile.dietType) {
    parts.push(`- Regime: ${DIET_LABELS[profile.dietType] || profile.dietType}`)
  }

  // Religious diet
  if (profile.religiousDiet) {
    parts.push(`- Regime religieux: ${profile.religiousDiet}`)
  }

  // Allergies (CRITICAL)
  if (profile.allergies && profile.allergies.length > 0) {
    parts.push(`- ALLERGIES (EVITER ABSOLUMENT): ${profile.allergies.join(', ')}`)
  }

  // Nutritional needs
  if (profile.nutritionalNeeds) {
    const needs = profile.nutritionalNeeds
    parts.push(`\nOBJECTIFS NUTRITIONNELS QUOTIDIENS:`)
    parts.push(`- Calories: ${needs.calories} kcal`)
    parts.push(`- Proteines: ${needs.proteins}g`)
    parts.push(`- Glucides: ${needs.carbs}g`)
    parts.push(`- Lipides: ${needs.fats}g`)
    if (needs.fiber) {
      parts.push(`- Fibres: ${needs.fiber}g`)
    }
  }

  return parts.join('\n')
}

/**
 * Generate a short context for quick AI calls
 */
export function generateShortContext(profile: UserProfile): string {
  const parts: string[] = []

  if (profile.goal) {
    parts.push(GOAL_LABELS[profile.goal] || profile.goal)
  }

  if (profile.dietType && profile.dietType !== 'omnivore') {
    parts.push(DIET_LABELS[profile.dietType] || profile.dietType)
  }

  if (profile.allergies && profile.allergies.length > 0) {
    parts.push(`Allergies: ${profile.allergies.join(', ')}`)
  }

  if (profile.nutritionalNeeds) {
    parts.push(`${profile.nutritionalNeeds.calories} kcal/jour`)
  }

  return parts.join(' | ')
}

/**
 * Generate remaining nutrition context for meal suggestions
 */
export function generateRemainingNutritionContext(
  dailyNeeds: NutritionalNeeds,
  consumed: { calories: number; proteins: number; carbs: number; fats: number }
): string {
  const remaining = {
    calories: Math.max(0, dailyNeeds.calories - consumed.calories),
    proteins: Math.max(0, dailyNeeds.proteins - consumed.proteins),
    carbs: Math.max(0, dailyNeeds.carbs - consumed.carbs),
    fats: Math.max(0, dailyNeeds.fats - consumed.fats),
  }

  return `BUDGET NUTRITIONNEL RESTANT POUR LA JOURNEE:
- Calories: ${remaining.calories} kcal
- Proteines: ${remaining.proteins}g
- Glucides: ${remaining.carbs}g
- Lipides: ${remaining.fats}g`
}

/**
 * Generate meal distribution suggestion based on time of day
 */
export function getMealDistribution(mealType: string): { ratio: number; description: string } {
  const distributions: Record<string, { ratio: number; description: string }> = {
    breakfast: { ratio: 0.25, description: '25% des apports journaliers' },
    lunch: { ratio: 0.35, description: '35% des apports journaliers (repas principal)' },
    snack: { ratio: 0.1, description: '10% des apports journaliers (collation legere)' },
    dinner: { ratio: 0.3, description: '30% des apports journaliers' },
  }

  return distributions[mealType] || { ratio: 0.25, description: '25% des apports journaliers' }
}
