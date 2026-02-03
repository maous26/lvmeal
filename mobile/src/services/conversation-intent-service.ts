/**
 * Conversation Intent Detection Service (Recommendation #2)
 *
 * Pipeline: Rules → Context Boost → Reclassify → LLM (if needed)
 *
 * Key improvements:
 * - Returns top-3 intents instead of single
 * - Context enrichment with reclassification
 * - LLM only for truly ambiguous cases
 */

import {
  UserIntent,
  IntentDetectionResult,
  DetectedIntent,
  ExtractedEntity,
  SafetyFlag,
  ConversationContextFull,
  ConversationContextCompact,
} from '../types/conversation'
import { conversationSafetyService } from './conversation-safety-service'

// ============================================================================
// INTENT PATTERNS (Rules-based, cost: $0)
// ============================================================================

interface IntentPattern {
  intent: UserIntent
  patterns: RegExp[]
  baseConfidence: number
}

const INTENT_PATTERNS: IntentPattern[] = [
  // HUNGER - Très haute confiance
  {
    intent: 'HUNGER',
    patterns: [
      /\b(j'?ai|j'?aurais)\s*faim\b/i,
      /\bqu['']?est[- ]ce que je (mange|prends|peux manger)\b/i,
      /\b(propose|suggère|donne)[- ]moi (un|quelque chose à) (repas|manger|truc)\b/i,
      /\bje (veux|voudrais) manger\b/i,
      /\bquoi (manger|bouffer)\b/i,
      /\bpas encore mangé\b/i,
      /\ble ventre (qui gargouille|vide)\b/i,
    ],
    baseConfidence: 0.92,
  },

  // CRAVING - Haute confiance
  {
    intent: 'CRAVING',
    patterns: [
      /\b(envie|besoin) (de|d')\s*(sucré|salé|chocolat|gras|pizza|burger|frites|glace|gâteau)\b/i,
      /\bje (craquerais|craque) (bien )?(pour|sur)\b/i,
      /\bça me (ferait|fait) (trop )?envie\b/i,
      /\bune petite (envie|folie)\b/i,
    ],
    baseConfidence: 0.88,
  },

  // FATIGUE
  {
    intent: 'FATIGUE',
    patterns: [
      /\b(je suis|jsuis|chuis) (fatigu|crev|épuis|naze|hs|mort|ko)\b/i,
      /\bpas (la |en )forme\b/i,
      /\b(mal|pas (bien|assez)) dormi\b/i,
      /\bnuit (blanche|courte|difficile)\b/i,
      /\b(épuisé|lessivé|vidé|claqué)\b/i,
      /\bbesoin (de |d')?(dormir|repos|sieste)\b/i,
    ],
    baseConfidence: 0.87,
  },

  // LOW_ENERGY
  {
    intent: 'LOW_ENERGY',
    patterns: [
      /\bpas d['']?énergie\b/i,
      /\bmanque (de |d')énergie\b/i,
      /\bà plat\b/i,
      /\bplus de jus\b/i,
      /\bcoup de (barre|mou|pompe)\b/i,
    ],
    baseConfidence: 0.85,
  },

  // STRESS
  {
    intent: 'STRESS',
    patterns: [
      /\b(je suis|jsuis|chuis) (stressé|angoissé|tendu|nerveux)\b/i,
      /\bjournée (difficile|dure|compliquée|de merde)\b/i,
      /\bbeaucoup (de )?(stress|pression)\b/i,
      /\bje (stresse|panique|flippe)\b/i,
      /\btrop (de boulot|de travail|à faire)\b/i,
    ],
    baseConfidence: 0.86,
  },

  // ANXIETY
  {
    intent: 'ANXIETY',
    patterns: [
      /\bje (m'?inquiète|m'?angoisse)\b/i,
      /\banxieux|anxieuse|anxiété\b/i,
      /\bboule (au ventre|à l'estomac)\b/i,
      /\bj'?ai peur (de|que)\b/i,
    ],
    baseConfidence: 0.84,
  },

  // FRUSTRATION
  {
    intent: 'FRUSTRATION',
    patterns: [
      /\b(ça (marche|fonctionne) pas|ça va pas)\b/i,
      /\b(j'?en ai|j'?ai) marre\b/i,
      /\bc'?est (nul|chiant|relou)\b/i,
      /\bje (galère|rame|n'y arrive pas)\b/i,
      /\b(frustré|énervé|agacé)\b/i,
    ],
    baseConfidence: 0.83,
  },

  // CELEBRATION
  {
    intent: 'CELEBRATION',
    patterns: [
      /\b(j'?ai|on a) (réussi|gagné|atteint)\b/i,
      /\btrop (content|fier|happy)\b/i,
      /\b(victoire|yes|youpi|génial|super|bravo)\b/i,
      /\bje (kiffe|suis fier)\b/i,
      /\bça y est\b/i,
    ],
    baseConfidence: 0.85,
  },

  // PROGRESS_CHECK
  {
    intent: 'PROGRESS_CHECK',
    patterns: [
      /\boù (j'?en suis|on en est)\b/i,
      /\b(mes |mon )?(progrès|avancement|évolution|résultats?)\b/i,
      /\bça (avance|marche|va|donne quoi)\b/i,
      /\bcomment je (m'?en sors|vais)\b/i,
      /\b(bilan|point|récap)\b/i,
    ],
    baseConfidence: 0.90,
  },

  // EXPLAIN_DECISION
  {
    intent: 'EXPLAIN_DECISION',
    patterns: [
      /\bpourquoi (tu|vous) (me |m')?(dis|proposes?|conseilles?|suggères?)\b/i,
      /\bcomment (ça se fait|tu sais)\b/i,
      /\b(explique|expliques?)[- ]moi\b/i,
      /\bje (comprends|pige) pas\b/i,
      /\bc'?est quoi (la |le )?(raison|logique)\b/i,
    ],
    baseConfidence: 0.88,
  },

  // NUTRITION_QUESTION
  {
    intent: 'NUTRITION_QUESTION',
    patterns: [
      /\bc'?est (bon|bien|sain|healthy|mauvais) (les?|la |le |de )?\w+\s*\?/i,
      /\bcombien (de |d')?(calories?|kcal|protéines?|glucides?)\b/i,
      /\best[- ]ce que (je peux|c'?est ok|c'?est bien)\b/i,
      /\bça fait (grossir|maigrir)\b/i,
    ],
    baseConfidence: 0.85,
  },

  // MEAL_SUGGESTION
  {
    intent: 'MEAL_SUGGESTION',
    patterns: [
      /\b(propose|suggère|donne)[- ]moi (un |une |quelque chose|des idées?)\b/i,
      /\b(idée|suggestion) (de |pour le )?(repas|petit[- ]déj|déjeuner|dîner|goûter)\b/i,
      /\bqu'?est[- ]ce que je (pourrais?|peux) (manger|prendre|cuisiner)\b/i,
      /\binspiration\b/i,
    ],
    baseConfidence: 0.89,
  },

  // LOG_MEAL
  {
    intent: 'LOG_MEAL',
    patterns: [
      /\bj'?ai (mangé|pris|bouffé)\b/i,
      /\bje (viens de |)manger\b/i,
      /\b(enregistre|note|ajoute)[- ](moi )?(ça|ce repas|mon repas)\b/i,
    ],
    baseConfidence: 0.87,
  },

  // CHALLENGE_START
  {
    intent: 'CHALLENGE_START',
    patterns: [
      /\b(lance|propose|donne)[- ]moi un (défi|challenge)\b/i,
      /\bje veux un (défi|challenge)\b/i,
      /\bun (nouveau |petit )?(défi|challenge)\b/i,
      /\bmotive[- ]moi\b/i,
    ],
    baseConfidence: 0.88,
  },

  // PLATEAU
  {
    intent: 'PLATEAU',
    patterns: [
      /\bje (stagne|bloque|piétine)\b/i,
      /\bça (bouge|avance) (pas|plus)\b/i,
      /\bplateau\b/i,
      /\b(plus de |pas de )résultats?\b/i,
      /\b(toujours |encore )le même poids\b/i,
    ],
    baseConfidence: 0.84,
  },

  // DOUBT
  {
    intent: 'DOUBT',
    patterns: [
      /\bça (sert|vaut) (à |le coup|vraiment)\b/i,
      /\best[- ]ce que ça (marche|fonctionne|vaut)\b/i,
      /\bje (doute|me demande si)\b/i,
      /\bà quoi (bon|ça sert)\b/i,
      /\bpas (sûr|convaincu)\b/i,
    ],
    baseConfidence: 0.82,
  },

  // OVERWHELM
  {
    intent: 'OVERWHELM',
    patterns: [
      /\bc'?est (trop |)(compliqué|difficile|dur|chiant)\b/i,
      /\bje (m'?y |n'?y )(retrouve|comprends?) (pas|plus|rien)\b/i,
      /\bj'?abandonne\b/i,
      /\btrop (d'?infos?|à (gérer|penser|faire))\b/i,
    ],
    baseConfidence: 0.83,
  },

  // GREETING
  {
    intent: 'GREETING',
    patterns: [
      /^(salut|hello|hey|coucou|bonjour|bonsoir|yo)\s*[!.]?$/i,
      /^(ça va|cv|comment (ça va|tu vas))\s*\??$/i,
      /^(wesh|slt|bjr)\s*[!.]?$/i,
    ],
    baseConfidence: 0.95,
  },

  // HELP
  {
    intent: 'HELP',
    patterns: [
      /\bcomment (ça |)(marche|fonctionne)\b/i,
      /\b(aide|aider|help)[- ]moi\b/i,
      /\bje (sais|comprends) pas (comment|quoi)\b/i,
      /\btu (peux|fais) quoi\b/i,
    ],
    baseConfidence: 0.87,
  },

  // FEEDBACK
  {
    intent: 'FEEDBACK',
    patterns: [
      /\b(j'?aime (bien|pas)|j'?adore|j'?apprécie|c'?est (cool|top|nul|bof))\b/i,
      /\bbravo|merci|super\b/i,
      /\b(pas (terrible|top|ouf)|bof|mouais)\b/i,
    ],
    baseConfidence: 0.80,
  },

  // THIRST
  {
    intent: 'THIRST',
    patterns: [
      /\bj'?ai soif\b/i,
      /\bje (bois|dois boire) (combien|assez)\b/i,
      /\bhydratation\b/i,
    ],
    baseConfidence: 0.88,
  },
]

// ============================================================================
// ENTITY EXTRACTION
// ============================================================================

interface EntityPattern {
  type: ExtractedEntity['type']
  patterns: { regex: RegExp; normalizer?: (match: string) => string | number }[]
}

const ENTITY_PATTERNS: EntityPattern[] = [
  {
    type: 'food',
    patterns: [
      { regex: /\b(pizza|burger|salade|pâtes|riz|poulet|poisson|œufs?|fromage|pain|fruits?|légumes?|chocolat|gâteau|glace|café|thé)\b/gi },
    ],
  },
  {
    type: 'meal_type',
    patterns: [
      {
        regex: /\b(petit[- ]déj(?:euner)?|déjeuner|dîner|goûter|snack|collation|brunch)\b/gi,
        normalizer: (m) => m.toLowerCase().replace('petit-déj', 'breakfast')
          .replace('petit déj', 'breakfast')
          .replace('déjeuner', 'lunch')
          .replace('dîner', 'dinner')
          .replace('goûter', 'snack')
          .replace('collation', 'snack'),
      },
    ],
  },
  {
    type: 'time',
    patterns: [
      {
        regex: /\b(ce matin|cet après[- ]midi|ce soir|cette nuit|hier|aujourd'hui|demain|midi|minuit|\d{1,2}h(?:\d{2})?)\b/gi,
        normalizer: (m) => {
          if (/midi/i.test(m)) return 12
          if (/minuit/i.test(m)) return 0
          const hourMatch = m.match(/(\d{1,2})h/)
          if (hourMatch) return parseInt(hourMatch[1])
          return m.toLowerCase()
        },
      },
    ],
  },
  {
    type: 'quantity',
    patterns: [
      { regex: /\b(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|cal|kcal|grammes?|kilos?|litres?|calories?)\b/gi },
      { regex: /\b(un|une|deux|trois|quatre|cinq|quelques|plusieurs|beaucoup)\b/gi },
    ],
  },
  {
    type: 'emotion',
    patterns: [
      { regex: /\b(content|triste|stressé|fatigué|motivé|démotivé|heureux|anxieux|calme|énervé|frustré)\b/gi },
    ],
  },
  {
    type: 'goal',
    patterns: [
      {
        regex: /\b(perdre|prendre|maintenir|stabiliser)\s+(\d+)?\s*(kilos?|kg|poids)\b/gi,
        normalizer: (m) => m.includes('perdre') ? 'weight_loss' : m.includes('prendre') ? 'weight_gain' : 'weight_maintain',
      },
      { regex: /\b(maigrir|grossir|mincir|muscler)\b/gi },
    ],
  },
]

// ============================================================================
// INTENT DETECTION SERVICE
// ============================================================================

class ConversationIntentService {
  /**
   * Main detection pipeline (Recommendation #2)
   * Rules → Context Boost → Reclassify → LLM (if needed)
   */
  async detectIntent(
    message: string,
    context: ConversationContextFull,
    isPremium: boolean,
    llmCallsToday: number
  ): Promise<IntentDetectionResult> {
    const startTime = Date.now()

    // 1. Safety check first
    const safetyCheck = conversationSafetyService.checkInput(message, context)
    const safetyFlags: SafetyFlag[] = safetyCheck.flags

    // 2. Extract entities
    const entities = this.extractEntities(message)

    // 3. Analyze sentiment
    const sentiment = this.analyzeSentiment(message)

    // 4. Rules-based detection (cost: $0)
    let intents = this.detectByRules(message)

    // 5. Context boost & reclassify (Recommendation #2 fix)
    intents = this.boostWithContext(intents, context, entities)

    // 6. Calculate urgency
    const urgency = this.calculateUrgency(intents, sentiment, context)

    // 7. If still ambiguous and Premium with LLM budget, use LLM
    const topConfidence = intents[0]?.confidence || 0
    const canUseLLM = isPremium && llmCallsToday < 20
    const needsLLM = topConfidence < 0.6 && canUseLLM

    if (needsLLM) {
      // LLM would be called here - for now return enhanced rules
      console.log('[IntentService] Would use LLM for ambiguous case:', message.substring(0, 50))
    }

    // 8. Ensure we have top 3
    while (intents.length < 3) {
      intents.push({ intent: 'UNKNOWN', confidence: 0 })
    }

    const result: IntentDetectionResult = {
      topIntents: [intents[0], intents[1], intents[2]] as [DetectedIntent, DetectedIntent?, DetectedIntent?],
      entities,
      sentiment,
      urgency,
      safetyFlags,
    }

    console.log(`[IntentService] Detected in ${Date.now() - startTime}ms:`, result.topIntents[0])

    return result
  }

  /**
   * Rules-based detection
   */
  private detectByRules(message: string): DetectedIntent[] {
    const results: DetectedIntent[] = []

    for (const { intent, patterns, baseConfidence } of INTENT_PATTERNS) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          // Check if already detected with higher confidence
          const existing = results.find(r => r.intent === intent)
          if (!existing) {
            results.push({ intent, confidence: baseConfidence })
          } else if (existing.confidence < baseConfidence) {
            existing.confidence = baseConfidence
          }
          break // Found match for this intent, move to next
        }
      }
    }

    // Sort by confidence
    results.sort((a, b) => b.confidence - a.confidence)

    // If no matches, add UNKNOWN
    if (results.length === 0) {
      results.push({ intent: 'UNKNOWN', confidence: 0.3 })
    }

    return results
  }

  /**
   * Boost intents with context and RECLASSIFY (Recommendation #2 fix)
   */
  private boostWithContext(
    intents: DetectedIntent[],
    context: ConversationContextFull,
    entities: ExtractedEntity[]
  ): DetectedIntent[] {
    const boosted = [...intents]

    // Get primary intent for context rules
    const primary = boosted[0]
    if (!primary) return boosted

    // Rule: FATIGUE + long time since meal → boost HUNGER
    if (primary.intent === 'FATIGUE' && context.temporal.hoursSinceLastMeal > 4) {
      this.addOrBoostIntent(boosted, 'HUNGER', 0.65)
      // Also slightly reduce FATIGUE confidence as it might be hunger
      primary.confidence = Math.max(0.5, primary.confidence - 0.1)
    }

    // Rule: LOW_ENERGY + morning → might be breakfast needed
    if (primary.intent === 'LOW_ENERGY' && context.temporal.timeOfDay === 'morning') {
      this.addOrBoostIntent(boosted, 'HUNGER', 0.6)
    }

    // Rule: STRESS + known stress-eating pattern → add CRAVING
    if (primary.intent === 'STRESS' && context.correlations.stressEating.length > 0) {
      this.addOrBoostIntent(boosted, 'CRAVING', 0.55)
    }

    // Rule: PROGRESS_CHECK + plateau situation → add PLATEAU concern
    if (primary.intent === 'PROGRESS_CHECK' &&
        context.wellness.weightTrend === 'stable' &&
        context.program.dayInPhase > 7) {
      this.addOrBoostIntent(boosted, 'PLATEAU', 0.5)
    }

    // Rule: CRAVING at night → higher emotional eating risk
    if (primary.intent === 'CRAVING' && context.temporal.timeOfDay === 'night') {
      this.addOrBoostIntent(boosted, 'STRESS', 0.4)
    }

    // Rule: DOUBT + early in program → normal onboarding doubt
    if (primary.intent === 'DOUBT' && context.program.totalDaysInProgram < 7) {
      // Keep DOUBT but lower urgency - this is expected
      primary.confidence = Math.max(0.6, primary.confidence - 0.15)
    }

    // Rule: Food entity mentioned → likely meal-related
    const hasFoodEntity = entities.some(e => e.type === 'food')
    if (hasFoodEntity && !['HUNGER', 'CRAVING', 'MEAL_SUGGESTION', 'LOG_MEAL'].includes(primary.intent)) {
      this.addOrBoostIntent(boosted, 'LOG_MEAL', 0.5)
    }

    // Re-sort after boosting
    boosted.sort((a, b) => b.confidence - a.confidence)

    return boosted
  }

  private addOrBoostIntent(intents: DetectedIntent[], intent: UserIntent, confidence: number): void {
    const existing = intents.find(i => i.intent === intent)
    if (existing) {
      existing.confidence = Math.max(existing.confidence, confidence)
    } else {
      intents.push({ intent, confidence })
    }
  }

  /**
   * Extract entities from message
   */
  private extractEntities(message: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = []

    for (const { type, patterns } of ENTITY_PATTERNS) {
      for (const { regex, normalizer } of patterns) {
        let match: RegExpExecArray | null
        const regexCopy = new RegExp(regex.source, regex.flags)

        while ((match = regexCopy.exec(message)) !== null) {
          const value = match[0]
          const normalized = normalizer ? normalizer(value) : value.toLowerCase()

          // Avoid duplicates
          if (!entities.some(e => e.type === type && e.value.toLowerCase() === value.toLowerCase())) {
            entities.push({
              type,
              value,
              normalized,
              position: [match.index, match.index + value.length],
            })
          }
        }
      }
    }

    return entities
  }

  /**
   * Analyze sentiment
   */
  private analyzeSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    const positive = /\b(super|génial|cool|top|content|heureux|fier|bravo|merci|j'adore|parfait|yes|youpi)\b/i
    const negative = /\b(nul|chiant|marre|galère|difficile|dur|triste|frustré|énervé|merde|pff|bof|argh)\b/i

    const positiveCount = (message.match(positive) || []).length
    const negativeCount = (message.match(negative) || []).length

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  /**
   * Calculate urgency
   */
  private calculateUrgency(
    intents: DetectedIntent[],
    sentiment: 'positive' | 'neutral' | 'negative',
    context: ConversationContextFull
  ): 'low' | 'medium' | 'high' {
    const primary = intents[0]?.intent

    // High urgency intents
    if (['STRESS', 'ANXIETY', 'OVERWHELM'].includes(primary || '')) {
      return sentiment === 'negative' ? 'high' : 'medium'
    }

    // Hunger with long fasting
    if (primary === 'HUNGER' && context.temporal.hoursSinceLastMeal > 6) {
      return 'high'
    }

    // Low energy situations
    if (['FATIGUE', 'LOW_ENERGY'].includes(primary || '')) {
      return 'medium'
    }

    // Positive intents
    if (['CELEBRATION', 'GREETING', 'FEEDBACK'].includes(primary || '')) {
      return 'low'
    }

    return sentiment === 'negative' ? 'medium' : 'low'
  }
}

// Export singleton
export const conversationIntentService = new ConversationIntentService()
