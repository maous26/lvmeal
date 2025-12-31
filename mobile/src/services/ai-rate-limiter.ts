/**
 * AI Rate Limiter Service
 *
 * Centralise le controle des appels IA avec:
 * - Rate limiting base sur les credits utilisateur (tier)
 * - Caching des reponses similaires
 * - Downgrade automatique des modeles si credits epuises
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useGamificationStore } from '../stores/gamification-store'

// Types de requetes IA avec leur cout en credits
export type AIRequestType =
  | 'coach_insight'      // Coach quotidien - 1 credit
  | 'behavior_analysis'  // Analyse RAG - 2 credits
  | 'meal_plan'          // Generation plan repas - 1 credit
  | 'photo_analysis'     // Analyse photo - 1 credit
  | 'wellness_advice'    // Conseil wellness - 1 credit
  | 'chat'               // Chat libre - 1 credit

// Cout en credits par type de requete
const CREDIT_COSTS: Record<AIRequestType, number> = {
  coach_insight: 1,
  behavior_analysis: 2,
  meal_plan: 1,
  photo_analysis: 1,
  wellness_advice: 1,
  chat: 1,
}

// Modele recommande par type (economique vs premium)
export const MODEL_CONFIG: Record<AIRequestType, { default: string; fallback: string }> = {
  coach_insight: { default: 'gpt-4o-mini', fallback: 'gpt-4o-mini' },
  behavior_analysis: { default: 'gpt-4o', fallback: 'gpt-4o-mini' },
  meal_plan: { default: 'gpt-4o-mini', fallback: 'gpt-4o-mini' },
  photo_analysis: { default: 'gpt-4o', fallback: 'gpt-4o-mini' },
  wellness_advice: { default: 'gpt-4o-mini', fallback: 'gpt-4o-mini' },
  chat: { default: 'gpt-4o-mini', fallback: 'gpt-4o-mini' },
}

// Cache TTL par type (en ms)
const CACHE_TTL: Record<AIRequestType, number> = {
  coach_insight: 4 * 60 * 60 * 1000,    // 4 heures
  behavior_analysis: 24 * 60 * 60 * 1000, // 24 heures
  meal_plan: 1 * 60 * 60 * 1000,        // 1 heure
  photo_analysis: 0,                     // Pas de cache
  wellness_advice: 4 * 60 * 60 * 1000,  // 4 heures
  chat: 0,                               // Pas de cache
}

interface CacheEntry {
  response: string
  timestamp: number
  contextHash: string
}

interface RateLimitResult {
  allowed: boolean
  reason?: string
  model: string
  remainingCredits: number
  cached?: string
}

class AIRateLimiter {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly CACHE_KEY = 'ai_response_cache'

  constructor() {
    this.loadCache()
  }

  /**
   * Charge le cache depuis AsyncStorage
   */
  private async loadCache(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(this.CACHE_KEY)
      if (cached) {
        const entries = JSON.parse(cached) as [string, CacheEntry][]
        this.cache = new Map(entries)
        // Nettoyer les entrees expirees
        this.cleanExpiredCache()
      }
    } catch (error) {
      console.error('Erreur chargement cache IA:', error)
    }
  }

  /**
   * Sauvegarde le cache dans AsyncStorage
   */
  private async saveCache(): Promise<void> {
    try {
      const entries = Array.from(this.cache.entries())
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(entries))
    } catch (error) {
      console.error('Erreur sauvegarde cache IA:', error)
    }
  }

  /**
   * Nettoie les entrees de cache expirees
   */
  private cleanExpiredCache(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      const type = key.split('_')[0] as AIRequestType
      const ttl = CACHE_TTL[type] || 0
      if (ttl > 0 && now - entry.timestamp > ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Genere un hash simple pour le contexte
   */
  private hashContext(context: Record<string, unknown>): string {
    const str = JSON.stringify(context)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  /**
   * Verifie si une requete peut etre effectuee
   * et retourne le modele a utiliser
   */
  checkRateLimit(
    requestType: AIRequestType,
    context?: Record<string, unknown>
  ): RateLimitResult {
    const gamification = useGamificationStore.getState()
    const remainingCredits = gamification.getAICreditsRemaining()
    const isPremium = gamification.isPremium
    const cost = CREDIT_COSTS[requestType]

    // Verifier le cache si applicable
    if (context && CACHE_TTL[requestType] > 0) {
      const contextHash = this.hashContext(context)
      const cacheKey = `${requestType}_${contextHash}`
      const cached = this.cache.get(cacheKey)

      if (cached) {
        const ttl = CACHE_TTL[requestType]
        if (Date.now() - cached.timestamp < ttl) {
          return {
            allowed: true,
            model: MODEL_CONFIG[requestType].default,
            remainingCredits,
            cached: cached.response,
          }
        }
      }
    }

    // Premium = unlimited AI with best models
    if (isPremium) {
      return {
        allowed: true,
        model: MODEL_CONFIG[requestType].default,
        remainingCredits: 999,
      }
    }

    // Free users: check credits
    if (remainingCredits < cost) {
      // Not enough credits - block expensive requests, suggest Premium
      if (requestType === 'behavior_analysis' || requestType === 'photo_analysis') {
        return {
          allowed: false,
          reason: `Credits epuises. Passe a Premium pour un acces illimite a l'IA.`,
          model: MODEL_CONFIG[requestType].fallback,
          remainingCredits,
        }
      }

      // For cheaper requests, allow with fallback model
      return {
        allowed: true,
        reason: 'Mode economique (credits faibles). Passe a Premium pour plus.',
        model: MODEL_CONFIG[requestType].fallback,
        remainingCredits,
      }
    }

    // Free user with credits: use fallback model to save costs
    return {
      allowed: true,
      model: MODEL_CONFIG[requestType].fallback,  // Free users always get mini model
      remainingCredits,
    }
  }

  /**
   * Consomme les credits apres une requete reussie
   */
  consumeCredits(requestType: AIRequestType): boolean {
    const gamification = useGamificationStore.getState()
    const cost = CREDIT_COSTS[requestType]

    // Consommer les credits
    for (let i = 0; i < cost; i++) {
      if (!gamification.useAICredit()) {
        return false
      }
    }
    return true
  }

  /**
   * Met en cache une reponse
   */
  cacheResponse(
    requestType: AIRequestType,
    context: Record<string, unknown>,
    response: string
  ): void {
    if (CACHE_TTL[requestType] === 0) return

    const contextHash = this.hashContext(context)
    const cacheKey = `${requestType}_${contextHash}`

    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      contextHash,
    })

    // Limiter la taille du cache a 50 entrees
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.saveCache()
  }

  /**
   * Efface tout le cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear()
    await AsyncStorage.removeItem(this.CACHE_KEY)
  }

  /**
   * Retourne les stats du rate limiter
   */
  getStats(): {
    cacheSize: number
    creditsRemaining: number
    tier: string
  } {
    const gamification = useGamificationStore.getState()
    return {
      cacheSize: this.cache.size,
      creditsRemaining: gamification.getAICreditsRemaining(),
      tier: gamification.getTier().id,
    }
  }
}

// Export singleton
export const aiRateLimiter = new AIRateLimiter()

// Helper pour wrapper les appels IA
export async function withRateLimit<T>(
  requestType: AIRequestType,
  context: Record<string, unknown>,
  aiCall: (model: string) => Promise<T>
): Promise<{ result: T; fromCache: boolean } | { error: string }> {
  const check = aiRateLimiter.checkRateLimit(requestType, context)

  // Retourner le cache si disponible
  if (check.cached) {
    return {
      result: JSON.parse(check.cached) as T,
      fromCache: true,
    }
  }

  // Verifier si autorise
  if (!check.allowed) {
    return { error: check.reason || 'Rate limit atteint' }
  }

  try {
    // Effectuer l'appel avec le modele recommande
    const result = await aiCall(check.model)

    // Consommer les credits
    aiRateLimiter.consumeCredits(requestType)

    // Mettre en cache si applicable
    if (CACHE_TTL[requestType] > 0) {
      aiRateLimiter.cacheResponse(requestType, context, JSON.stringify(result))
    }

    return { result, fromCache: false }
  } catch (error) {
    throw error
  }
}

export default aiRateLimiter
