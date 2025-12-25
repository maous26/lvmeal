// Generate user profile context for AI prompts

import type { UserProfile } from '@/types/user'

export function generateUserProfileContext(profile: UserProfile): string {
  const parts: string[] = ['PROFIL UTILISATEUR:']

  // Basic info
  if (profile.firstName) {
    parts.push(`- Prénom: ${profile.firstName}`)
  }

  // Physical
  if (profile.age) {
    parts.push(`- Âge: ${profile.age} ans`)
  }
  if (profile.gender) {
    const genderLabels: Record<string, string> = {
      male: 'Homme',
      female: 'Femme',
      other: 'Autre'
    }
    parts.push(`- Genre: ${genderLabels[profile.gender] || profile.gender}`)
  }
  if (profile.weight) {
    parts.push(`- Poids actuel: ${profile.weight} kg`)
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
    const activityLabels: Record<string, string> = {
      sedentary: 'Sédentaire',
      light: 'Légèrement actif',
      moderate: 'Modérément actif',
      active: 'Très actif',
      athlete: 'Athlète'
    }
    parts.push(`- Niveau d'activité: ${activityLabels[profile.activityLevel] || profile.activityLevel}`)
  }

  // Goals
  if (profile.goal) {
    const goalLabels: Record<string, string> = {
      weight_loss: 'Perte de poids',
      muscle_gain: 'Prise de muscle',
      maintenance: 'Maintien du poids',
      health: 'Améliorer sa santé',
      energy: 'Plus d\'énergie'
    }
    parts.push(`- Objectif: ${goalLabels[profile.goal] || profile.goal}`)
  }

  // Diet
  if (profile.dietType) {
    const dietLabels: Record<string, string> = {
      omnivore: 'Omnivore',
      vegetarian: 'Végétarien',
      vegan: 'Végan',
      pescatarian: 'Pescétarien',
      keto: 'Cétogène',
      paleo: 'Paléo'
    }
    parts.push(`- Régime: ${dietLabels[profile.dietType] || profile.dietType}`)
  }

  // Allergies
  if (profile.allergies && profile.allergies.length > 0) {
    parts.push(`- ALLERGIES (ÉVITER ABSOLUMENT): ${profile.allergies.join(', ')}`)
  }

  // Intolerances
  if (profile.intolerances && profile.intolerances.length > 0) {
    parts.push(`- Intolérances: ${profile.intolerances.join(', ')}`)
  }

  // Disliked foods
  if (profile.dislikedFoods && profile.dislikedFoods.length > 0) {
    parts.push(`- N'aime pas: ${profile.dislikedFoods.join(', ')}`)
  }

  // Cooking
  if (profile.cookingSkillLevel) {
    const skillLabels: Record<string, string> = {
      beginner: 'Débutant',
      intermediate: 'Intermédiaire',
      advanced: 'Avancé'
    }
    parts.push(`- Niveau en cuisine: ${skillLabels[profile.cookingSkillLevel] || profile.cookingSkillLevel}`)
  }

  if (profile.cookingTimeWeekday) {
    parts.push(`- Temps disponible en semaine: ${profile.cookingTimeWeekday} min`)
  }
  if (profile.cookingTimeWeekend) {
    parts.push(`- Temps disponible le week-end: ${profile.cookingTimeWeekend} min`)
  }

  // Budget
  if (profile.weeklyBudget) {
    parts.push(`- Budget hebdomadaire: ${profile.weeklyBudget}€`)
  }

  // Fasting
  if (profile.fastingSchedule && profile.fastingSchedule.type !== 'none') {
    const fasting = profile.fastingSchedule
    parts.push(`- Jeûne intermittent: ${fasting.type.replace('_', ':')}`)
    if (fasting.eatingWindowStart && fasting.eatingWindowEnd) {
      parts.push(`  Fenêtre alimentaire: ${fasting.eatingWindowStart} - ${fasting.eatingWindowEnd}`)
    }
  }

  // Nutritional needs
  if (profile.nutritionalNeeds) {
    const needs = profile.nutritionalNeeds
    parts.push(`\nOBJECTIFS NUTRITIONNELS QUOTIDIENS:`)
    parts.push(`- Calories: ${needs.calories} kcal`)
    parts.push(`- Protéines: ${needs.proteins}g`)
    parts.push(`- Glucides: ${needs.carbs}g`)
    parts.push(`- Lipides: ${needs.fats}g`)
  }

  return parts.join('\n')
}
