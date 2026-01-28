/**
 * Coach Messages Service
 *
 * Centralizes coach message generation logic.
 * Rules:
 * - Messages are contextual and based on real user data
 * - CTAs are ONLY added when they lead to actionable screens
 * - No CTA is better than a broken/useless CTA
 * - Silence is a feature (no message if nothing meaningful)
 */

import type { UserProfile, NutritionalNeeds } from '../types'

// ============= TYPES =============

export type CoachMessageType =
  | 'encouragement'
  | 'tip'
  | 'warning'
  | 'celebration'
  | 'adaptive'
  | 'nutrition'
  | 'sport'
  | 'plaisir'

export type CoachMessageIcon =
  | 'sparkles'
  | 'heart'
  | 'moon'
  | 'droplets'
  | 'activity'
  | 'trending-up'
  | 'utensils'
  | 'target'
  | 'flame'
  | 'award'
  | 'scale'

export interface CoachMessageAction {
  label: string
  route: string
  params?: Record<string, string | number>
}

export interface CoachMessage {
  id: string
  type: CoachMessageType
  icon: CoachMessageIcon
  title: string
  message: string
  action?: CoachMessageAction
  priority: number // Higher = more important (0-100)
}

export interface CoachContext {
  // User profile
  profile: UserProfile
  isAdaptive: boolean

  // Today's data
  todayNutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
  todayMealsCount: number

  // Wellness data (optional - may not be filled)
  wellness?: {
    sleepHours?: number
    stressLevel?: number // 1-5
    energyLevel?: number // 1-5
    waterLiters?: number
  }

  // Targets
  targets: {
    calories: number
    proteins: number
    waterLiters: number
  }

  // Streaks & progress
  streak: number
  sportSessionsCompleted: number

  // Caloric bank (plaisir system)
  caloricBank?: {
    balance: number
    canHavePlaisir: boolean
    maxPerMeal: number
    needsSplit: boolean
    remainingPlaisirMeals: number
  }

  // Time context
  currentHour: number
}

// ============= ADAPTIVE METABOLISM MESSAGES =============

const ADAPTIVE_MESSAGES = {
  maintenance: {
    title: 'Phase de stabilisation',
    message: "On consolide tes acquis avant d'aller plus loin. C'est la clé pour des résultats durables.",
  },
  protein: {
    title: 'Priorité aux protéines',
    message: "Les protéines t'aident à maintenir ta masse musculaire et à relancer ton métabolisme.",
  },
  sleep: {
    title: 'Le sommeil, ton allié secret',
    message: 'Un bon sommeil aide à réguler tes hormones de faim. Prends soin de tes nuits !',
  },
  stress: {
    title: 'Gère ton stress',
    message: 'Le stress impacte ton métabolisme. Accorde-toi des moments de détente.',
  },
  celebration: {
    title: 'Tu es sur la bonne voie !',
    message: 'Chaque jour où tu prends soin de toi est une victoire. Continue comme ça !',
  },
}

// ============= MESSAGE GENERATORS =============

/**
 * Generate all relevant coach messages based on context
 * Returns messages sorted by priority (highest first)
 */
export function generateCoachMessages(ctx: CoachContext): CoachMessage[] {
  const messages: CoachMessage[] = []

  // === ADAPTIVE METABOLISM MESSAGES ===
  if (ctx.isAdaptive) {
    messages.push(...generateAdaptiveMessages(ctx))
  }

  // === WELLNESS MESSAGES ===
  messages.push(...generateWellnessMessages(ctx))

  // === NUTRITION MESSAGES ===
  messages.push(...generateNutritionMessages(ctx))

  // === STREAK & CELEBRATION MESSAGES ===
  messages.push(...generateCelebrationMessages(ctx))

  // === PLAISIR MESSAGES ===
  messages.push(...generatePlaisirMessages(ctx))

  // === SPORT MESSAGES ===
  messages.push(...generateSportMessages(ctx))

  // Sort by priority (highest first) and return top messages
  return messages.sort((a, b) => b.priority - a.priority)
}

/**
 * Get top N messages for display
 */
export function getTopMessages(ctx: CoachContext, limit: number = 2): CoachMessage[] {
  const all = generateCoachMessages(ctx)
  return all.slice(0, limit)
}

// ============= CATEGORY GENERATORS =============

function generateAdaptiveMessages(ctx: CoachContext): CoachMessage[] {
  const messages: CoachMessage[] = []
  const { profile, todayNutrition, targets, currentHour } = ctx

  // Maintenance phase message
  if (profile.nutritionalStrategy?.currentPhase === 'maintenance') {
    messages.push({
      id: 'adaptive-maintenance',
      type: 'adaptive',
      icon: 'trending-up',
      title: ADAPTIVE_MESSAGES.maintenance.title,
      message: `Semaine ${profile.nutritionalStrategy.weekInPhase} de stabilisation. ${ADAPTIVE_MESSAGES.maintenance.message}`,
      priority: 80,
      // No CTA - informational only
    })
  }

  // Protein reminder (only if data exists and it's afternoon+)
  const proteinPercent = targets.proteins > 0
    ? (todayNutrition.proteins / targets.proteins) * 100
    : 0

  if (proteinPercent < 50 && currentHour >= 14 && todayNutrition.calories > 0) {
    messages.push({
      id: 'adaptive-protein',
      type: 'tip',
      icon: 'sparkles',
      title: ADAPTIVE_MESSAGES.protein.title,
      message: `Tu es à ${Math.round(proteinPercent)}% de ton objectif protéines. Pense à en ajouter à ton prochain repas.`,
      priority: 70,
      action: {
        label: 'Ajouter un repas',
        route: 'AddMeal',
      },
    })
  }

  return messages
}

function generateWellnessMessages(ctx: CoachContext): CoachMessage[] {
  const messages: CoachMessage[] = []
  const { wellness, isAdaptive, currentHour, targets } = ctx

  if (!wellness) return messages

  // Sleep warning
  if (wellness.sleepHours !== undefined && wellness.sleepHours < 6) {
    messages.push({
      id: 'sleep-warning',
      type: 'warning',
      icon: 'moon',
      title: 'Sommeil insuffisant',
      message: isAdaptive
        ? `${wellness.sleepHours}h de sommeil seulement. Pour ton métabolisme, vise 7-8h.`
        : `Tu n'as dormi que ${wellness.sleepHours}h. Le manque de sommeil peut affecter tes objectifs.`,
      priority: 75,
      // No CTA - we don't have a sleep tracking screen to link to
    })
  } else if (wellness.sleepHours !== undefined && wellness.sleepHours >= 7) {
    messages.push({
      id: 'sleep-good',
      type: 'celebration',
      icon: 'moon',
      title: 'Belle nuit de sommeil !',
      message: `${wellness.sleepHours}h de repos. Ton corps te remercie !`,
      priority: 30,
    })
  }

  // Stress check
  if (wellness.stressLevel !== undefined && wellness.stressLevel >= 4) {
    messages.push({
      id: 'stress-high',
      type: 'tip',
      icon: 'heart',
      title: isAdaptive ? ADAPTIVE_MESSAGES.stress.title : 'Niveau de stress élevé',
      message: isAdaptive
        ? ADAPTIVE_MESSAGES.stress.message
        : 'Le stress peut impacter ta faim et ta digestion. Prends un moment pour toi.',
      priority: 65,
      // No CTA - wellness check-in is contextual, not a standalone screen
    })
  }

  // Hydration reminder (only if we have data AND it's past noon)
  if (wellness.waterLiters !== undefined && targets.waterLiters > 0) {
    const waterPercent = (wellness.waterLiters / targets.waterLiters) * 100
    if (waterPercent < 40 && currentHour >= 12) {
      messages.push({
        id: 'hydration-reminder',
        type: 'tip',
        icon: 'droplets',
        title: "Pense à t'hydrater",
        message: `Tu es à ${Math.round(waterPercent)}% de ton objectif d'eau. L'hydratation aide ton métabolisme !`,
        priority: 50,
        // No CTA - hydration is tracked via WellnessWidget on dashboard, not a separate screen
      })
    }
  }

  return messages
}

function generateNutritionMessages(ctx: CoachContext): CoachMessage[] {
  const messages: CoachMessage[] = []
  const { todayMealsCount, currentHour } = ctx

  // No meals logged reminder (gentle, not pushy)
  if (todayMealsCount === 0 && currentHour >= 10) {
    messages.push({
      id: 'no-meals-logged',
      type: 'tip',
      icon: 'utensils',
      title: 'Suivi du jour',
      message: "Pas de repas noté pour l'instant — même une estimation rapide suffit !",
      priority: 45,
      action: {
        label: 'Ajouter un repas',
        route: 'AddMeal',
      },
    })
  }

  return messages
}

function generateCelebrationMessages(ctx: CoachContext): CoachMessage[] {
  const messages: CoachMessage[] = []
  const { streak, isAdaptive } = ctx

  // Weekly streak milestone
  if (streak >= 7 && streak % 7 === 0) {
    messages.push({
      id: `streak-${streak}`,
      type: 'celebration',
      icon: 'sparkles',
      title: `${streak} jours de suite !`,
      message: isAdaptive
        ? ADAPTIVE_MESSAGES.celebration.message
        : 'Ta régularité paie ! Continue sur cette lancée.',
      priority: 85,
      // No CTA - celebration is standalone
    })
  }

  return messages
}

function generatePlaisirMessages(ctx: CoachContext): CoachMessage[] {
  const messages: CoachMessage[] = []
  const { caloricBank } = ctx

  if (!caloricBank) return messages

  // Plaisir available
  if (caloricBank.canHavePlaisir) {
    let title: string
    let message: string

    if (caloricBank.needsSplit) {
      if (caloricBank.remainingPlaisirMeals === 2) {
        title = 'Tes repas plaisir de la semaine !'
        message = `+${caloricBank.maxPerMeal} kcal bonus par repas. Choisis quelque chose qui te fait vraiment envie.`
      } else {
        title = 'Ton dernier repas plaisir !'
        message = `+${caloricBank.maxPerMeal} kcal bonus. L'idée ? Un moment différent, pas une version XXL de ton quotidien.`
      }
    } else {
      title = 'Ton repas plaisir de la semaine !'
      message = `+${caloricBank.maxPerMeal} kcal bonus. Choisis quelque chose qui te fait vraiment envie.`
    }

    messages.push({
      id: 'plaisir-available',
      type: 'plaisir',
      icon: 'sparkles',
      title,
      message,
      priority: 75,
      action: {
        label: 'Voir les recettes',
        route: 'Recipes',
      },
    })
  } else if (caloricBank.balance > 0 && caloricBank.remainingPlaisirMeals === 0) {
    // Plaisir already used
    messages.push({
      id: 'plaisir-used',
      type: 'tip',
      icon: 'sparkles',
      title: 'Repas plaisir utilisés',
      message: 'Tu as déjà profité de tes repas plaisir cette semaine. Nouvelle semaine, nouveaux plaisirs !',
      priority: 40,
      // No CTA - just informational
    })
  }

  return messages
}

function generateSportMessages(ctx: CoachContext): CoachMessage[] {
  const messages: CoachMessage[] = []
  const { sportSessionsCompleted } = ctx

  // Sport is only available for metabolic program (adaptive) users
  if (!ctx.isAdaptive) return messages

  // Sport milestone - only if user has actually completed sessions
  if (sportSessionsCompleted > 0 && sportSessionsCompleted % 5 === 0) {
    messages.push({
      id: `sessions-${sportSessionsCompleted}`,
      type: 'celebration',
      icon: 'activity',
      title: `${sportSessionsCompleted} séances complétées !`,
      message: 'Ta régularité paie ! Continue à progresser.',
      priority: 55,
      // No CTA - celebration only, user knows where sport is
    })
  }

  return messages
}

// ============= UTILITIES =============

/**
 * Check if a message should be shown based on dismissal state
 */
export function filterDismissedMessages(
  messages: CoachMessage[],
  dismissedIds: string[]
): CoachMessage[] {
  return messages.filter(m => !dismissedIds.includes(m.id))
}

/**
 * Get icon component name for a message
 * (The component will map this to actual icon)
 */
export function getIconForMessage(icon: CoachMessageIcon): string {
  const iconMap: Record<CoachMessageIcon, string> = {
    sparkles: 'Sparkles',
    heart: 'Heart',
    moon: 'Moon',
    droplets: 'Droplets',
    activity: 'Activity',
    'trending-up': 'TrendingUp',
    utensils: 'Utensils',
    target: 'Target',
    flame: 'Flame',
    award: 'Award',
    scale: 'Scale',
  }
  return iconMap[icon] || 'Sparkles'
}

/**
 * Get style config for message type
 */
export function getMessageStyle(type: CoachMessageType): {
  backgroundColor: string
  borderColor: string
} {
  const styles: Record<CoachMessageType, { backgroundColor: string; borderColor: string }> = {
    adaptive: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' },
    celebration: { backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.3)' },
    plaisir: { backgroundColor: 'rgba(217, 70, 239, 0.1)', borderColor: 'rgba(217, 70, 239, 0.3)' },
    warning: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' },
    tip: { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' },
    encouragement: { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' },
    nutrition: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' },
    sport: { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' },
  }
  return styles[type] || styles.tip
}

export default {
  generateCoachMessages,
  getTopMessages,
  filterDismissedMessages,
  getIconForMessage,
  getMessageStyle,
}
