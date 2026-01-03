/**
 * Recommendations Service - LYM Health Module
 *
 * Interface to the existing recommendation engine (LymIA Brain).
 * Generates contextual advice based on user goals, priorities, and data.
 *
 * Integrates with:
 * - LymIA Brain for AI-powered advice
 * - RAG knowledge base for scientific grounding
 * - DSPy for enhanced retrieval
 */

import type { AdviceContext, AdviceCard, HealthPriority, AdviceType } from '../types'
import { LymIABrain, type UserContext, type CoachingAdvice } from '../../../services/lymia-brain'
import type { UserProfile } from '../../../types'

// =============================================================================
// MOCK DATA FOR DEVELOPMENT
// =============================================================================

const MOCK_ADVICE_CARDS: Record<string, AdviceCard[]> = {
  better_eating: [
    {
      id: 'better_eating_1',
      type: 'better_eating',
      title: 'Variete des couleurs',
      content: 'Essaie d\'avoir au moins 3 couleurs differentes dans ton assiette. Chaque couleur apporte des nutriments differents.',
      priority: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'better_eating_2',
      type: 'better_eating',
      title: 'Legumineuses',
      content: 'Les lentilles, pois chiches et haricots sont excellents pour les fibres et les proteines vegetales. Une a deux fois par semaine, c\'est deja bien.',
      priority: 2,
      createdAt: new Date().toISOString(),
    },
  ],
  more_energy: [
    {
      id: 'energy_1',
      type: 'more_energy',
      title: 'Proteines au petit-dejeuner',
      content: 'Commencer la journee avec des proteines (oeufs, yaourt, fromage) aide a maintenir l\'energie stable jusqu\'au dejeuner.',
      priority: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'energy_2',
      type: 'more_energy',
      title: 'Hydratation reguliere',
      content: 'La fatigue peut venir d\'un manque d\'eau. Un verre d\'eau toutes les 2h aide a garder l\'energie.',
      priority: 2,
      createdAt: new Date().toISOString(),
    },
  ],
  stress: [
    {
      id: 'stress_1',
      type: 'stress',
      title: 'Magnesium',
      content: 'Les aliments riches en magnesium (chocolat noir, amandes, bananes) peuvent aider en periode de stress.',
      priority: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'stress_2',
      type: 'stress',
      title: 'Eviter les sucres rapides',
      content: 'Les pics de glycemie peuvent amplifier le stress. Prefere les sucres lents (cereales completes, legumineuses).',
      priority: 2,
      createdAt: new Date().toISOString(),
    },
  ],
  supplementation_info: [
    {
      id: 'supp_vitd',
      type: 'supplementation_info',
      title: 'Repere : Vitamine D',
      content: 'En France, beaucoup de personnes manquent de vitamine D, surtout en hiver. L\'exposition au soleil et certains aliments (poissons gras) en apportent.',
      disclaimer: 'Reperes generaux, pas un avis medical. Si les symptomes persistent, demande l\'avis d\'un professionnel.',
      priority: 3,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'supp_mag',
      type: 'supplementation_info',
      title: 'Repere : Magnesium',
      content: 'Le magnesium est souvent evoque en periode de fatigue ou de stress. On le trouve dans le chocolat noir, les oleagineux, les legumineuses.',
      disclaimer: 'Pas de dosage ici. Si tu as un doute, demande a un professionnel.',
      priority: 3,
      createdAt: new Date().toISOString(),
    },
  ],
  diversity: [
    {
      id: 'diversity_1',
      type: 'diversity',
      title: 'Poissons',
      content: 'Les poissons, surtout les gras (saumon, maquereau, sardines), apportent des omega-3 et des proteines. Une a deux fois par semaine, c\'est ideal.',
      priority: 2,
      createdAt: new Date().toISOString(),
    },
  ],
  general: [
    {
      id: 'general_1',
      type: 'general',
      title: 'Ecoute ton corps',
      content: 'Les reperes nutritionnels sont des guides, pas des regles absolues. Ton corps te dit souvent ce dont il a besoin.',
      priority: 4,
      createdAt: new Date().toISOString(),
    },
  ],
}

// =============================================================================
// LYMIA BRAIN INTEGRATION
// =============================================================================

/**
 * Convert AdviceContext to LymIA UserContext
 */
function buildLymIAContext(context: AdviceContext, userProfile?: UserProfile): UserContext {
  // Build a minimal profile if not provided
  const profile: UserProfile = userProfile || {
    id: 'temp',
    name: '',
    firstName: '',
    goal: context.objective === 'weight_loss' ? 'weight_loss'
      : context.objective === 'muscle_gain' ? 'muscle_gain'
      : 'maintenance',
    gender: 'male',
    age: 30,
    height: 175,
    weight: 75,
    activityLevel: 'moderate',
    dietType: 'omnivore',
  }

  return {
    profile,
    todayNutrition: {
      calories: context.weekSummary?.avgCalories || 0,
      proteins: context.weekSummary?.avgProteins || 0,
      carbs: context.weekSummary?.avgCarbs || 0,
      fats: context.weekSummary?.avgFats || 0,
    },
    weeklyAverage: {
      calories: context.weekSummary?.avgCalories || 0,
      proteins: context.weekSummary?.avgProteins || 0,
      carbs: context.weekSummary?.avgCarbs || 0,
      fats: context.weekSummary?.avgFats || 0,
    },
    currentStreak: 0, // Not used in health module (no streaks)
    lastMeals: [],
    wellnessData: {
      sleepHours: context.checkin?.sleepHours,
      stressLevel: context.checkin?.stressLevel ? context.checkin.stressLevel * 2 : undefined,
      energyLevel: context.checkin?.energyLevel,
    },
  }
}

/**
 * Convert CoachingAdvice to AdviceCard
 */
function coachingAdviceToCard(advice: CoachingAdvice, index: number): AdviceCard {
  // Map category to AdviceType
  const typeMap: Record<string, AdviceType> = {
    nutrition: 'better_eating',
    wellness: 'more_energy',
    sport: 'general',
    motivation: 'general',
    alert: 'general',
  }

  return {
    id: `lymia_${Date.now()}_${index}`,
    type: typeMap[advice.category] || 'general',
    title: advice.message.split('.')[0].slice(0, 50), // First sentence as title
    content: advice.message,
    priority: advice.priority === 'high' ? 1 : advice.priority === 'medium' ? 2 : 3,
    createdAt: new Date().toISOString(),
    actionItems: advice.actionItems,
  }
}

/**
 * Build health-specific prompt topic based on context
 */
function buildHealthTopic(context: AdviceContext): string {
  const topics: string[] = []

  // Add priority-based topics
  if (context.healthPriorities?.includes('better_eating')) {
    topics.push('diversite alimentaire')
  }
  if (context.healthPriorities?.includes('more_energy')) {
    topics.push('energie vitalite fatigue')
  }
  if (context.healthPriorities?.includes('stress')) {
    topics.push('gestion stress alimentation anti-stress')
  }

  // Add signal-based topics
  if (context.energySignals.lowProtein3Days) {
    topics.push('proteines satiete')
  }
  if (context.energySignals.lowFiber3Days) {
    topics.push('fibres digestion')
  }
  if (context.energySignals.highUltraProcessed) {
    topics.push('aliments ultra-transformes NOVA')
  }

  // Add diversity-based topics
  if (context.diversity.level === 'low') {
    const missing = context.diversity.missingGroups.slice(0, 2).join(' ')
    topics.push(`groupes alimentaires manquants ${missing}`)
  }

  return topics.join(' ') || 'conseil sante alimentation equilibree'
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Request advice from the recommendations engine
 *
 * Uses LymIA Brain for AI-powered personalized advice.
 * Falls back to mock data if AI is unavailable.
 *
 * @param context - Full context for personalized advice
 * @param userProfile - Optional user profile for better personalization
 * @returns Array of advice cards sorted by priority
 */
export async function requestAdvice(
  context: AdviceContext,
  userProfile?: UserProfile
): Promise<AdviceCard[]> {
  try {
    // Build LymIA context from health module context
    const lymiaContext = buildLymIAContext(context, userProfile)
    const topic = buildHealthTopic(context)

    // Call LymIA Brain for personalized coaching advice
    const advices = await LymIABrain.getCoachingAdvice(lymiaContext, topic)

    if (advices && advices.length > 0) {
      // Convert coaching advices to advice cards
      const cards = advices.map((advice, index) => coachingAdviceToCard(advice, index))

      // Add specific cards for active energy signals (these are important)
      if (context.energySignals.lowProtein3Days && !cards.some(c => c.content.toLowerCase().includes('proteine'))) {
        cards.push({
          id: 'energy_protein',
          type: 'more_energy',
          title: 'Proteines',
          content: 'Tes proteines sont un peu basses ces derniers jours. Elles aident a maintenir l\'energie et la satiete.',
          priority: 1,
          createdAt: new Date().toISOString(),
        })
      }

      if (context.energySignals.lowFiber3Days && !cards.some(c => c.content.toLowerCase().includes('fibre'))) {
        cards.push({
          id: 'energy_fiber',
          type: 'more_energy',
          title: 'Fibres',
          content: 'Les fibres sont un peu basses. Legumes, fruits, cereales completes en apportent naturellement.',
          priority: 1,
          createdAt: new Date().toISOString(),
        })
      }

      // Sort by priority and return (max 5 cards)
      return cards.sort((a, b) => a.priority - b.priority).slice(0, 5)
    }
  } catch (error) {
    console.warn('LymIA Brain advice request failed, using fallback:', error)
  }

  // Fallback to mock data if AI is unavailable
  return requestAdviceFallback(context)
}

/**
 * Fallback advice generation when AI is unavailable
 */
function requestAdviceFallback(context: AdviceContext): AdviceCard[] {
  const cards: AdviceCard[] = []

  // Add advice based on health priorities
  if (context.healthPriorities) {
    for (const priority of context.healthPriorities) {
      const priorityCards = MOCK_ADVICE_CARDS[priority] || []
      cards.push(...priorityCards.slice(0, 2)) // Max 2 per priority
    }
  }

  // Add diversity advice if diversity is low
  if (context.diversity.level === 'low') {
    const missingGroup = context.diversity.missingGroups[0]
    if (missingGroup) {
      cards.push({
        id: `diversity_${missingGroup}`,
        type: 'diversity',
        title: `Ajoute des ${missingGroup}`,
        content: `Tu n'as pas eu de ${missingGroup} cette semaine. Essaie d'en ajouter quelques-uns !`,
        priority: 2,
        createdAt: new Date().toISOString(),
      })
    }
  }

  // Add energy advice if signals are active
  if (context.energySignals.lowProtein3Days) {
    cards.push({
      id: 'energy_protein',
      type: 'more_energy',
      title: 'Proteines',
      content: 'Tes proteines sont un peu basses ces derniers jours. Elles aident a maintenir l\'energie et la satiete.',
      priority: 1,
      createdAt: new Date().toISOString(),
    })
  }

  if (context.energySignals.lowFiber3Days) {
    cards.push({
      id: 'energy_fiber',
      type: 'more_energy',
      title: 'Fibres',
      content: 'Les fibres sont un peu basses. Legumes, fruits, cereales completes en apportent naturellement.',
      priority: 1,
      createdAt: new Date().toISOString(),
    })
  }

  // Add supplementation info if stress priority + check-in shows stress
  if (
    context.healthPriorities?.includes('stress') &&
    context.checkin?.stressLevel &&
    context.checkin.stressLevel >= 4
  ) {
    const suppCards = MOCK_ADVICE_CARDS.supplementation_info || []
    if (suppCards[1]) {
      cards.push(suppCards[1]) // Magnesium advice
    }
  }

  // Add general advice if no specific advice
  if (cards.length === 0) {
    cards.push(...(MOCK_ADVICE_CARDS.general || []))
  }

  // Sort by priority and return
  return cards.sort((a, b) => a.priority - b.priority).slice(0, 5) // Max 5 cards
}

/**
 * Get supplementation info for a specific nutrient
 * Returns info card with disclaimer
 */
export function getSupplementationInfo(
  nutrient: 'vitamine_d' | 'magnesium' | 'fer' | 'b12' | 'omega3'
): AdviceCard | null {
  const infoMap: Record<string, AdviceCard> = {
    vitamine_d: {
      id: 'supp_vitd',
      type: 'supplementation_info',
      title: 'Repere : Vitamine D',
      content: 'La vitamine D est synthetisee par la peau lors de l\'exposition au soleil. En France, les reserves peuvent etre faibles en hiver. Poissons gras, jaune d\'oeuf, et produits enrichis en contiennent.',
      disclaimer: 'Reperes generaux, pas un avis medical. Un dosage sanguin peut etre prescrit par un medecin.',
      priority: 3,
      createdAt: new Date().toISOString(),
    },
    magnesium: {
      id: 'supp_mag',
      type: 'supplementation_info',
      title: 'Repere : Magnesium',
      content: 'Le magnesium participe a des centaines de reactions dans le corps. Fatigue, stress, crampes peuvent etre des signes de manque. Chocolat noir, oleagineux, legumineuses, cereales completes en sont de bonnes sources.',
      disclaimer: 'Pas de dosage ici. Si tu as un doute, demande a un professionnel.',
      priority: 3,
      createdAt: new Date().toISOString(),
    },
    fer: {
      id: 'supp_fer',
      type: 'supplementation_info',
      title: 'Repere : Fer',
      content: 'Le fer est essentiel pour le transport de l\'oxygene. Les femmes en age de procreer ont des besoins plus eleves. Viandes rouges, legumineuses, tofu en contiennent. Le fer vegetal est mieux absorbe avec de la vitamine C.',
      disclaimer: 'Attention : un exces de fer peut etre nocif. Ne te supplemente pas sans avis medical et bilan sanguin.',
      priority: 3,
      createdAt: new Date().toISOString(),
    },
    b12: {
      id: 'supp_b12',
      type: 'supplementation_info',
      title: 'Repere : Vitamine B12',
      content: 'La B12 est presente uniquement dans les produits animaux. Si tu es vegetalien ou vegetarien strict, une supplementation est souvent necessaire. Les produits enrichis peuvent aider.',
      disclaimer: 'Si tu suis un regime sans produits animaux, parle-en a un professionnel de sante.',
      priority: 3,
      createdAt: new Date().toISOString(),
    },
    omega3: {
      id: 'supp_omega3',
      type: 'supplementation_info',
      title: 'Repere : Omega-3',
      content: 'Les omega-3 (EPA, DHA) sont importants pour le cerveau et le coeur. Les poissons gras (saumon, maquereau, sardines) en sont la meilleure source. Les omega-3 vegetaux (lin, noix) sont moins bien convertis.',
      disclaimer: 'Reperes generaux. Si tu ne manges pas de poisson, demande conseil a un professionnel.',
      priority: 3,
      createdAt: new Date().toISOString(),
    },
  }

  return infoMap[nutrient] || null
}

/**
 * Build advice context from current app state
 * Helper function to gather all context data
 */
export function buildAdviceContext(params: {
  objective: AdviceContext['objective']
  healthPriorities?: HealthPriority[]
  weekSummary: AdviceContext['weekSummary']
  diversity: AdviceContext['diversity']
  energySignals: AdviceContext['energySignals']
  checkin?: AdviceContext['checkin']
  userPrefs?: AdviceContext['userPrefs']
}): AdviceContext {
  return {
    objective: params.objective,
    healthPriorities: params.healthPriorities,
    weekSummary: params.weekSummary,
    diversity: params.diversity,
    energySignals: params.energySignals,
    checkin: params.checkin,
    userPrefs: params.userPrefs,
  }
}

export default requestAdvice
