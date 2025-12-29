/**
 * Phase Context Service
 *
 * Provides phase-aware messaging and context for MetabolicBoost program.
 * Adapts all coaching messages based on the current phase.
 *
 * Phase 1 (Discovery): "Mange a ta faim, sans restriction"
 * - No calorie deficit warnings
 * - Encourage eating to satiety
 * - Focus on habits, not weight loss
 *
 * Phase 2 (Walking): Gentle activity increase
 * Phase 3 (Resistance): Building muscle
 * Phase 4 (Full Program): Maintenance
 */

import { PHASE_CONFIGS, type MetabolicPhase } from '../stores/metabolic-boost-store'

export interface PhaseContext {
  phase: MetabolicPhase
  phaseName: string
  weekInPhase: number
  isNoRestrictionPhase: boolean
  coachingTone: 'nurturing' | 'encouraging' | 'challenging' | 'maintaining'
  primaryFocus: string[]
  avoidTopics: string[]
  keyMessages: string[]
}

/**
 * Get comprehensive phase context for coaching adaptation
 */
export function getPhaseContext(
  phase: MetabolicPhase,
  weekInPhase: number = 1
): PhaseContext {
  const config = PHASE_CONFIGS[phase]

  switch (phase) {
    case 'discovery':
      return {
        phase,
        phaseName: config.name,
        weekInPhase,
        isNoRestrictionPhase: true, // KEY: Phase 1 has no calorie restrictions
        coachingTone: 'nurturing',
        primaryFocus: [
          'Ecouter ses signaux de faim et satiete',
          'Etablir des habitudes de sommeil',
          'Marche quotidienne 20-30 min',
          'Hydratation 2L/jour',
          'Proteines a chaque repas (1.6g/kg)',
        ],
        avoidTopics: [
          'deficit_calorique',
          'perte_poids_rapide',
          'restriction',
          'compter_calories_strict',
          'culpabilite_alimentaire',
        ],
        keyMessages: [
          'Mange a ta faim, c\'est la priorite',
          'Pas de restriction, on stabilise d\'abord',
          'Ton corps a besoin de se sentir en securite',
          'Les calories sont secondaires, les habitudes sont primaires',
          'Prends soin de toi sans pression',
        ],
      }

    case 'walking':
      return {
        phase,
        phaseName: config.name,
        weekInPhase,
        isNoRestrictionPhase: false,
        coachingTone: 'encouraging',
        primaryFocus: [
          'Augmenter progressivement la marche (30-45 min)',
          'Introduire mobilite 2x/semaine',
          'Augmenter calories de 100/semaine si energie OK',
          'Proteines 1.8g/kg',
        ],
        avoidTopics: [
          'deficit_agressif',
          'perte_poids_rapide',
        ],
        keyMessages: [
          'Tu progresses, continue comme ca',
          'L\'activite augmente doucement, c\'est parfait',
          'Ton metabolisme se reveille',
        ],
      }

    case 'resistance':
      return {
        phase,
        phaseName: config.name,
        weekInPhase,
        isNoRestrictionPhase: false,
        coachingTone: 'challenging',
        primaryFocus: [
          'Renforcement musculaire 2-3x/semaine',
          'Proteines elevees (2g/kg)',
          'Recuperation prioritaire',
          'Progression lente et securisee',
        ],
        avoidTopics: [
          'deficit_agressif',
        ],
        keyMessages: [
          'Tu construis du muscle, c\'est la cle',
          'La resistance change ton metabolisme',
          'Recupere bien entre les seances',
        ],
      }

    case 'full_program':
      return {
        phase,
        phaseName: config.name,
        weekInPhase,
        isNoRestrictionPhase: false,
        coachingTone: 'maintaining',
        primaryFocus: [
          'Mix cardio et musculation',
          'Maintenir les acquis',
          'NEAT optimise',
          'Gestion stress et sommeil',
        ],
        avoidTopics: [],
        keyMessages: [
          'Tu as relance ton metabolisme, bravo !',
          'Maintiens tes bonnes habitudes',
          'Tu es autonome maintenant',
        ],
      }

    default:
      return {
        phase: 'discovery',
        phaseName: 'Decouverte',
        weekInPhase: 1,
        isNoRestrictionPhase: true,
        coachingTone: 'nurturing',
        primaryFocus: [],
        avoidTopics: [],
        keyMessages: [],
      }
  }
}

/**
 * Phase-specific coaching message generators
 */
export const PhaseMessages = {
  /**
   * Get calorie-related message adapted to phase
   */
  getCalorieMessage(
    phase: MetabolicPhase,
    consumed: number,
    target: number
  ): { message: string; priority: 'low' | 'medium' | 'high'; showAlert: boolean } {
    const ratio = consumed / target
    const phaseContext = getPhaseContext(phase)

    // Phase 1: No restrictions - different messaging
    if (phaseContext.isNoRestrictionPhase) {
      if (ratio < 0.5) {
        return {
          message: 'N\'hesite pas a manger si tu as faim. En phase Decouverte, l\'objectif est de manger a ta faim pour stabiliser ton metabolisme.',
          priority: 'medium',
          showAlert: false, // Not an alert in Phase 1
        }
      }
      if (ratio > 1.3) {
        return {
          message: 'Tu as bien mange aujourd\'hui ! En phase Decouverte, c\'est normal - ton corps reapprend la satiete. Continue d\'ecouter tes sensations.',
          priority: 'low',
          showAlert: false, // No guilt in Phase 1
        }
      }
      return {
        message: 'Tu manges bien et a ta faim. Continue comme ca !',
        priority: 'low',
        showAlert: false,
      }
    }

    // Other phases: Standard messaging with adaptations
    if (ratio < 0.25 && new Date().getHours() >= 16) {
      return {
        message: `Tu n'as consomme que ${consumed} kcal. Un deficit trop important peut ralentir ton metabolisme. Prends un repas equilibre ce soir.`,
        priority: 'high',
        showAlert: true,
      }
    }
    if (ratio > 1.3) {
      return {
        message: `Tu as depasse ton objectif de ${Math.round((ratio - 1) * 100)}%. Pas de panique, un ecart occasionnel ne change rien sur le long terme.`,
        priority: 'medium',
        showAlert: false,
      }
    }
    return {
      message: 'Tes apports caloriques sont dans la bonne fourchette.',
      priority: 'low',
      showAlert: false,
    }
  },

  /**
   * Get protein-related message adapted to phase
   */
  getProteinMessage(
    phase: MetabolicPhase,
    consumed: number,
    target: number
  ): { message: string; priority: 'low' | 'medium' } {
    const ratio = consumed / target
    const phaseContext = getPhaseContext(phase)
    const config = PHASE_CONFIGS[phase]

    if (ratio < 0.5 && new Date().getHours() >= 18) {
      return {
        message: phaseContext.isNoRestrictionPhase
          ? `Pense a inclure des proteines ce soir (${config.dailyTargets.proteinPerKg}g/kg recommande). Oeufs, poisson, poulet ou legumineuses sont d'excellentes options.`
          : `Tes proteines sont basses (${consumed}g/${target}g). Les proteines sont essentielles pour preserver ta masse musculaire.`,
        priority: 'medium',
      }
    }

    if (ratio >= 1) {
      return {
        message: `Excellent ! Tu as atteint ${consumed}g de proteines. C'est parfait pour ${phaseContext.coachingTone === 'challenging' ? 'construire du muscle' : 'maintenir ton metabolisme'}.`,
        priority: 'low',
      }
    }

    return {
      message: 'Continue d\'inclure des proteines a chaque repas.',
      priority: 'low',
    }
  },

  /**
   * Get daily summary message adapted to phase
   */
  getDailySummaryMessage(
    phase: MetabolicPhase,
    data: {
      caloriesRatio: number
      proteinRatio: number
      sleepHours?: number
      waterLiters?: number
      steps?: number
    }
  ): string {
    const phaseContext = getPhaseContext(phase)
    const config = PHASE_CONFIGS[phase]
    const parts: string[] = []

    // Phase-specific opening
    if (phaseContext.isNoRestrictionPhase) {
      parts.push('En phase Decouverte, ton objectif principal est de manger a ta faim et d\'etablir de bonnes habitudes.')
    } else {
      parts.push(`En phase ${config.name}, on ${phaseContext.primaryFocus[0]?.toLowerCase() || 'continue sur notre lancee'}.`)
    }

    // Sleep feedback
    if (data.sleepHours !== undefined) {
      if (data.sleepHours < config.dailyTargets.sleepHours) {
        parts.push(`Sommeil: ${data.sleepHours}h (objectif ${config.dailyTargets.sleepHours}h). Le sommeil est crucial pour ton metabolisme.`)
      } else {
        parts.push('Ton sommeil est bon, ca aide beaucoup.')
      }
    }

    // Activity feedback
    if (data.steps !== undefined) {
      if (data.steps < config.dailyTargets.steps) {
        parts.push(`Pas: ${data.steps} (objectif ${config.dailyTargets.steps}). Une petite marche t'aiderait.`)
      } else {
        parts.push('Excellente activite aujourd\'hui !')
      }
    }

    // Water feedback
    if (data.waterLiters !== undefined && data.waterLiters < config.dailyTargets.waterLiters) {
      parts.push('Pense a t\'hydrater un peu plus.')
    }

    return parts.join(' ')
  },

  /**
   * Get phase transition message
   */
  getPhaseTransitionMessage(
    fromPhase: MetabolicPhase,
    toPhase: MetabolicPhase
  ): { title: string; message: string; tips: string[] } {
    const toConfig = PHASE_CONFIGS[toPhase]

    if (fromPhase === 'discovery' && toPhase === 'walking') {
      return {
        title: 'Bravo ! Tu passes en Phase Marche Active',
        message: 'Tu as bien stabilise tes habitudes. Maintenant on augmente doucement l\'activite pour reveiller ton metabolisme.',
        tips: [
          'Passe de 20-30 min a 30-45 min de marche',
          'Ajoute 2 seances de mobilite par semaine',
          'Tu peux commencer un leger deficit si ton energie est bonne',
        ],
      }
    }

    if (fromPhase === 'walking' && toPhase === 'resistance') {
      return {
        title: 'Phase Resistance - Construis du muscle !',
        message: 'Ton metabolisme est pret. On ajoute maintenant du renforcement musculaire pour le booster.',
        tips: [
          '2-3 seances de renforcement par semaine',
          'Exercices au poids du corps d\'abord',
          'Augmente les proteines a 2g/kg',
        ],
      }
    }

    if (toPhase === 'full_program') {
      return {
        title: 'Programme Complet - Tu es autonome !',
        message: 'Felicitations ! Tu as relance ton metabolisme. Maintenant tu maintiens tes acquis.',
        tips: toConfig.objectives,
      }
    }

    return {
      title: `Phase ${toConfig.name}`,
      message: toConfig.description,
      tips: toConfig.objectives,
    }
  },
}

/**
 * Build LymIA prompt modifier based on phase
 * This modifies the coaching prompts to be phase-appropriate
 */
export function buildPhasePromptModifier(phase: MetabolicPhase, weekInPhase: number): string {
  const context = getPhaseContext(phase, weekInPhase)

  const lines = [
    `\n\nCONTEXTE PROGRAMME METABOLIQUE - PHASE ${context.phaseName.toUpperCase()} (Semaine ${weekInPhase}):`,
  ]

  if (context.isNoRestrictionPhase) {
    lines.push(`
IMPORTANT - PHASE SANS RESTRICTION:
- L'utilisateur est en phase de STABILISATION metabolique
- JAMAIS de culpabilisation sur les calories
- JAMAIS de mention de deficit calorique
- Encourage a manger A SA FAIM
- Les calories sont SECONDAIRES, les HABITUDES sont PRIMAIRES
- Si l'utilisateur depasse ses calories, c'est NORMAL et OK`)
  }

  lines.push(`
TON FOCUS POUR CETTE PHASE:
${context.primaryFocus.map(f => `- ${f}`).join('\n')}

MESSAGES CLES A TRANSMETTRE:
${context.keyMessages.map(m => `- "${m}"`).join('\n')}

SUJETS A EVITER:
${context.avoidTopics.length > 0 ? context.avoidTopics.map(t => `- ${t}`).join('\n') : '- Aucun sujet interdit'}

TONALITE: ${context.coachingTone}`)

  return lines.join('\n')
}

export default {
  getPhaseContext,
  PhaseMessages,
  buildPhasePromptModifier,
}
