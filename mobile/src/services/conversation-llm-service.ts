/**
 * Conversation LLM Service
 *
 * Handles LLM calls for complex/ambiguous conversation cases.
 * Uses OpenAI API with cost optimization:
 * - Only called for truly ambiguous cases (confidence < 0.6)
 * - Uses compact context to minimize tokens
 * - Caches similar responses
 * - Respects daily limits (1 free, 20 premium)
 *
 * Key principle: "Le LLM ne décide pas. Il rédige et clarifie."
 * The LLM CANNOT invent actions - it can only select from the whitelist.
 */

import { getOpenAIApiKey, hasOpenAIApiKey } from './ai-service'
import {
  UserIntent,
  DetectedIntent,
  ConversationContextCompact,
  ActionType,
  ACTION_PERMISSIONS,
} from '../types/conversation'

// ============================================================================
// TYPES
// ============================================================================

export interface LLMIntentResult {
  intents: DetectedIntent[]
  reasoning: string
  suggestedTone: 'empathetic' | 'encouraging' | 'informative' | 'celebratory' | 'casual' | 'supportive'
  tokensUsed: number
}

export interface LLMResponseResult {
  message: string
  tone: string
  suggestedActions: ActionType[]
  tokensUsed: number
}

// ============================================================================
// PROMPTS
// ============================================================================

const INTENT_DETECTION_SYSTEM_PROMPT = `Tu es l'assistant IA de LYM, une app de suivi nutritionnel et bien-être.
Ton rôle est d'analyser les messages utilisateur et détecter leur intention.

INTENTIONS POSSIBLES (choisir parmi cette liste UNIQUEMENT):
- HUNGER: faim, besoin de manger
- CRAVING: envie spécifique (sucré, salé, etc.)
- FATIGUE: fatigue, manque d'énergie physique
- LOW_ENERGY: coup de barre, besoin de boost
- THIRST: soif, hydratation
- STRESS: stress, pression, journée difficile
- ANXIETY: anxiété, inquiétude
- FRUSTRATION: frustration, agacement
- CELEBRATION: succès, fierté, accomplissement
- SADNESS: tristesse, mal-être
- PROGRESS_CHECK: demande de bilan, progrès
- EXPLAIN_DECISION: demande d'explication
- NUTRITION_QUESTION: question sur un aliment
- MEAL_SUGGESTION: demande de suggestion repas
- PLAN_MODIFICATION: ajustement d'objectifs
- CHALLENGE_START: démarrer un défi
- LOG_MEAL: enregistrer un repas
- PLATEAU: stagnation, pas de progrès
- DOUBT: doute sur l'efficacité
- OVERWHELM: surcharge, trop compliqué
- GREETING: salutation
- HELP: demande d'aide
- FEEDBACK: retour positif/négatif
- UNKNOWN: intention non claire

CONTEXTE UTILISATEUR (format compact):
n = nutrition (cal: calories restantes, lastMeal: heures, trend: D/B/S)
w = wellness (mood, energy 1-10, sleep heures)
c = correlations (stressEat, sleepImpact)
t = temporel (tod: M/D/A/E/N, we: weekend)

RÈGLES:
1. Retourne les 3 intentions les plus probables avec confidence 0-1
2. La confidence doit refléter ta certitude
3. Considère le contexte pour ajuster les confidences
4. Réponds en JSON uniquement`

const RESPONSE_GENERATION_SYSTEM_PROMPT = `Tu es le coach nutritionnel de LYM, bienveillant et jamais culpabilisant.

RÈGLES ABSOLUES:
1. Jamais de jugement négatif ("tu as trop mangé", "c'est mal")
2. Toujours encourageant et compréhensif
3. Messages courts (2-3 phrases max)
4. Utilise le prénom si disponible
5. Adapte le ton à l'émotion détectée

ACTIONS POSSIBLES (tu peux SEULEMENT suggérer celles-ci):
- SUGGEST_MEAL: suggérer un repas
- LOG_MEAL_QUICK: enregistrer un repas
- NAVIGATE_TO: naviguer dans l'app
- SHOW_INSIGHT: montrer un insight
- SHOW_PROGRESS: montrer les progrès
- START_BREATHING: exercice de respiration
- CONTACT_SUPPORT: contacter le support
- START_CHALLENGE: démarrer un défi (Premium)
- ADJUST_CALORIES: ajuster objectifs (Premium)
- SCHEDULE_REMINDER: programmer rappel (Premium)

Tu ne peux PAS inventer d'autres actions.

Réponds en JSON avec: message, tone, suggestedActions (liste de 0-2 actions)`

// ============================================================================
// SERVICE
// ============================================================================

class ConversationLLMService {
  private cache: Map<string, { result: LLMIntentResult; timestamp: number }> = new Map()
  private readonly CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

  /**
   * Check if LLM is available
   */
  async isAvailable(): Promise<boolean> {
    return await hasOpenAIApiKey()
  }

  /**
   * Detect intent using LLM for ambiguous cases
   */
  async detectIntentWithLLM(
    message: string,
    compactContext: ConversationContextCompact
  ): Promise<LLMIntentResult | null> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(message, compactContext)
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        console.log('[LLMService] Cache hit for intent detection')
        return cached.result
      }

      const apiKey = await getOpenAIApiKey()
      if (!apiKey) {
        console.log('[LLMService] No API key available')
        return null
      }

      const userPrompt = `Message utilisateur: "${message}"

Contexte:
${JSON.stringify(compactContext, null, 2)}

Analyse l'intention et retourne un JSON avec:
{
  "intents": [
    {"intent": "INTENT_NAME", "confidence": 0.X},
    {"intent": "INTENT_NAME", "confidence": 0.X},
    {"intent": "INTENT_NAME", "confidence": 0.X}
  ],
  "reasoning": "Brève explication",
  "suggestedTone": "empathetic|encouraging|informative|celebratory|casual|supportive"
}`

      const response = await this.callOpenAI(
        INTENT_DETECTION_SYSTEM_PROMPT,
        userPrompt,
        apiKey
      )

      if (!response) return null

      const parsed = this.parseJSONResponse<{
        intents: DetectedIntent[]
        reasoning: string
        suggestedTone: string
      }>(response.content)

      if (!parsed || !parsed.intents) return null

      // Validate intents against allowed list
      const validIntents = this.validateIntents(parsed.intents)

      const result: LLMIntentResult = {
        intents: validIntents,
        reasoning: parsed.reasoning || '',
        suggestedTone: this.validateTone(parsed.suggestedTone),
        tokensUsed: response.tokensUsed,
      }

      // Cache result
      this.cache.set(cacheKey, { result, timestamp: Date.now() })

      console.log('[LLMService] Intent detected via LLM:', result.intents[0])
      return result
    } catch (error) {
      console.error('[LLMService] Intent detection error:', error)
      return null
    }
  }

  /**
   * Generate response using LLM for complex cases
   */
  async generateResponseWithLLM(
    intent: UserIntent,
    message: string,
    compactContext: ConversationContextCompact,
    isPremium: boolean
  ): Promise<LLMResponseResult | null> {
    try {
      const apiKey = await getOpenAIApiKey()
      if (!apiKey) return null

      const userPrompt = `Intention détectée: ${intent}
Message utilisateur: "${message}"
Premium: ${isPremium}

Contexte:
${JSON.stringify(compactContext, null, 2)}

Génère une réponse empathique et utile. Retourne un JSON:
{
  "message": "Ta réponse ici (2-3 phrases max)",
  "tone": "empathetic|encouraging|informative|celebratory|casual|supportive",
  "suggestedActions": ["ACTION_TYPE", "ACTION_TYPE"] // 0 à 2 actions max
}`

      const response = await this.callOpenAI(
        RESPONSE_GENERATION_SYSTEM_PROMPT,
        userPrompt,
        apiKey
      )

      if (!response) return null

      const parsed = this.parseJSONResponse<{
        message: string
        tone: string
        suggestedActions: string[]
      }>(response.content)

      if (!parsed || !parsed.message) return null

      // Validate actions against whitelist
      const validActions = this.validateActions(parsed.suggestedActions || [], isPremium)

      return {
        message: parsed.message,
        tone: parsed.tone || 'empathetic',
        suggestedActions: validActions,
        tokensUsed: response.tokensUsed,
      }
    } catch (error) {
      console.error('[LLMService] Response generation error:', error)
      return null
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string
  ): Promise<{ content: string; tokensUsed: number } | null> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Cost-effective model for intent detection
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 500,
          temperature: 0.3, // Low temperature for consistent intent detection
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[LLMService] OpenAI API error:', error)
        return null
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content || ''
      const tokensUsed = data.usage?.total_tokens || 0

      return { content, tokensUsed }
    } catch (error) {
      console.error('[LLMService] API call error:', error)
      return null
    }
  }

  private parseJSONResponse<T>(content: string): T | null {
    try {
      return JSON.parse(content) as T
    } catch {
      // Try to extract JSON from markdown code blocks
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) {
        try {
          return JSON.parse(match[1]) as T
        } catch {
          return null
        }
      }
      return null
    }
  }

  private validateIntents(intents: DetectedIntent[]): DetectedIntent[] {
    const validIntentNames: UserIntent[] = [
      'HUNGER', 'CRAVING', 'FATIGUE', 'LOW_ENERGY', 'THIRST',
      'STRESS', 'ANXIETY', 'FRUSTRATION', 'CELEBRATION', 'SADNESS',
      'PROGRESS_CHECK', 'EXPLAIN_DECISION', 'NUTRITION_QUESTION',
      'MEAL_SUGGESTION', 'PLAN_MODIFICATION', 'CHALLENGE_START',
      'PHASE_QUESTION', 'LOG_MEAL', 'OVERWHELM', 'DOUBT', 'PLATEAU',
      'GREETING', 'FEEDBACK', 'HELP', 'UNKNOWN',
    ]

    return intents
      .filter(i => validIntentNames.includes(i.intent as UserIntent))
      .map(i => ({
        intent: i.intent as UserIntent,
        confidence: Math.min(1, Math.max(0, i.confidence)),
      }))
      .slice(0, 3) // Max 3 intents
  }

  private validateTone(
    tone: string
  ): 'empathetic' | 'encouraging' | 'informative' | 'celebratory' | 'casual' | 'supportive' {
    const validTones = ['empathetic', 'encouraging', 'informative', 'celebratory', 'casual', 'supportive']
    if (validTones.includes(tone)) {
      return tone as 'empathetic' | 'encouraging' | 'informative' | 'celebratory' | 'casual' | 'supportive'
    }
    return 'empathetic'
  }

  private validateActions(actions: string[], isPremium: boolean): ActionType[] {
    const validActions: ActionType[] = []

    for (const action of actions) {
      const actionType = action as ActionType
      const permission = ACTION_PERMISSIONS[actionType]

      if (!permission) continue // Unknown action, skip

      // Check if action is allowed for user's tier
      const tier = isPremium ? 'premium' : 'free'
      if (permission.allowedTiers.includes(tier)) {
        validActions.push(actionType)
      }
    }

    return validActions.slice(0, 2) // Max 2 actions
  }

  private getCacheKey(message: string, context: ConversationContextCompact): string {
    // Create contextual cache key with buckets to avoid stale responses
    // Buckets: calories (500 increments), time, wellness state

    const today = new Date().toISOString().split('T')[0] // Date changes = cache miss
    const caloriesBucket = Math.floor(context.n.cal / 500) * 500 // 0, 500, 1000, 1500...
    const lastMealBucket = context.n.lastMeal // Already bucketed ("3h", "5h")
    const stressBucket = context.w.energy ? (context.w.energy > 5 ? 'high' : 'low') : 'unk'
    const sleepBucket = context.w.sleep ? (context.w.sleep >= 7 ? 'good' : 'poor') : 'unk'

    const contextKey = [
      today,
      `cal${caloriesBucket}`,
      `meal${lastMealBucket}`,
      context.n.trend,
      context.t.tod,
      context.w.mood || 'null',
      `e${stressBucket}`,
      `s${sleepBucket}`,
      context.c.stressEat ? 'SE' : '',
    ].filter(Boolean).join('_')

    const messageKey = message.toLowerCase().trim().substring(0, 50)
    return `${messageKey}_${contextKey}`
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// Export singleton
export const conversationLLMService = new ConversationLLMService()
