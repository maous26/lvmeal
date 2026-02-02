/**
 * AI Error Handler Service
 *
 * Gestion centralisée des erreurs AI avec:
 * - Retry automatique avec backoff exponentiel
 * - Fallback intelligent (modèle alternatif, réponse statique)
 * - Logging structuré pour debug
 * - Circuit breaker pour éviter les appels en cascade
 *
 * Audit recommendation: Améliorer la robustesse des appels AI
 */

import { Alert } from 'react-native'

// Types d'erreurs AI
export type AIErrorType =
  | 'network'        // Erreur réseau
  | 'timeout'        // Timeout
  | 'rate_limit'     // Rate limit API
  | 'invalid_key'    // Clé API invalide
  | 'quota_exceeded' // Quota dépassé
  | 'model_error'    // Erreur du modèle
  | 'parse_error'    // Erreur parsing JSON
  | 'unknown'        // Erreur inconnue

export interface AIError {
  type: AIErrorType
  message: string
  retryable: boolean
  suggestedAction?: string
  originalError?: Error
}

// Configuration du circuit breaker
interface CircuitBreakerState {
  failures: number
  lastFailure: number
  isOpen: boolean
}

// État du circuit breaker par service
const circuitBreakers: Map<string, CircuitBreakerState> = new Map()

const CIRCUIT_BREAKER_CONFIG = {
  maxFailures: 3,           // Nombre d'échecs avant ouverture
  resetTimeout: 60 * 1000,  // 1 minute avant tentative de reset
  halfOpenRequests: 1,      // Nombre de requêtes en half-open
}

// Configuration du retry
export interface RetryConfig {
  maxRetries: number
  initialDelay: number      // ms
  maxDelay: number          // ms
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

/**
 * Parse une erreur OpenAI en AIError typé
 */
export function parseAIError(error: unknown): AIError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Timeout
    if (message.includes('timeout') || message.includes('aborted') || error.name === 'AbortError') {
      return {
        type: 'timeout',
        message: 'La requête a pris trop de temps',
        retryable: true,
        suggestedAction: 'Réessayer dans quelques secondes',
        originalError: error,
      }
    }

    // Network errors
    if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) {
      return {
        type: 'network',
        message: 'Problème de connexion réseau',
        retryable: true,
        suggestedAction: 'Vérifier la connexion internet',
        originalError: error,
      }
    }

    // Rate limit (429)
    if (message.includes('rate limit') || message.includes('429') || message.includes('too many requests')) {
      return {
        type: 'rate_limit',
        message: 'Trop de requêtes, veuillez patienter',
        retryable: true,
        suggestedAction: 'Attendre quelques secondes',
        originalError: error,
      }
    }

    // Invalid API key (401)
    if (message.includes('invalid') && message.includes('key') || message.includes('401') || message.includes('unauthorized')) {
      return {
        type: 'invalid_key',
        message: 'Clé API invalide ou expirée',
        retryable: false,
        suggestedAction: 'Vérifier la configuration API',
        originalError: error,
      }
    }

    // Quota exceeded (402)
    if (message.includes('quota') || message.includes('402') || message.includes('billing')) {
      return {
        type: 'quota_exceeded',
        message: 'Quota API dépassé',
        retryable: false,
        suggestedAction: 'Vérifier le compte OpenAI',
        originalError: error,
      }
    }

    // Model errors (500, 503)
    if (message.includes('model') || message.includes('500') || message.includes('503') || message.includes('service')) {
      return {
        type: 'model_error',
        message: 'Le service IA est temporairement indisponible',
        retryable: true,
        suggestedAction: 'Réessayer plus tard',
        originalError: error,
      }
    }

    // JSON parse errors
    if (message.includes('json') || message.includes('parse') || message.includes('unexpected token')) {
      return {
        type: 'parse_error',
        message: 'Erreur de parsing de la réponse',
        retryable: true,
        suggestedAction: 'Réessayer',
        originalError: error,
      }
    }
  }

  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'Erreur inconnue',
    retryable: true,
    originalError: error instanceof Error ? error : undefined,
  }
}

/**
 * Circuit Breaker - vérifie si le service est disponible
 */
export function isCircuitOpen(serviceName: string): boolean {
  const state = circuitBreakers.get(serviceName)
  if (!state) return false

  if (state.isOpen) {
    // Vérifier si on peut passer en half-open
    const timeSinceLastFailure = Date.now() - state.lastFailure
    if (timeSinceLastFailure > CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      // Passer en half-open
      state.isOpen = false
      return false
    }
    return true
  }
  return false
}

/**
 * Enregistre un échec pour le circuit breaker
 */
export function recordFailure(serviceName: string): void {
  let state = circuitBreakers.get(serviceName)
  if (!state) {
    state = { failures: 0, lastFailure: 0, isOpen: false }
    circuitBreakers.set(serviceName, state)
  }

  state.failures++
  state.lastFailure = Date.now()

  if (state.failures >= CIRCUIT_BREAKER_CONFIG.maxFailures) {
    state.isOpen = true
    console.warn(`[AIErrorHandler] Circuit breaker OPEN for ${serviceName}`)
  }
}

/**
 * Enregistre un succès pour le circuit breaker
 */
export function recordSuccess(serviceName: string): void {
  const state = circuitBreakers.get(serviceName)
  if (state) {
    state.failures = 0
    state.isOpen = false
  }
}

/**
 * Wrapper avec retry automatique et gestion d'erreurs
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    serviceName: string
    config?: Partial<RetryConfig>
    onRetry?: (attempt: number, error: AIError) => void
    shouldRetry?: (error: AIError) => boolean
  }
): Promise<T> {
  const { serviceName, config = {}, onRetry, shouldRetry } = options
  const retryConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }

  // Vérifier le circuit breaker
  if (isCircuitOpen(serviceName)) {
    throw new Error(`Service ${serviceName} temporairement indisponible (circuit breaker open)`)
  }

  let lastError: AIError | null = null
  let delay = retryConfig.initialDelay

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const result = await operation()
      recordSuccess(serviceName)
      return result
    } catch (err) {
      lastError = parseAIError(err)

      console.warn(`[AIErrorHandler] ${serviceName} attempt ${attempt + 1} failed:`, lastError.message)

      // Vérifier si on doit retry
      const canRetry = lastError.retryable && (shouldRetry?.(lastError) ?? true)

      if (!canRetry || attempt === retryConfig.maxRetries) {
        recordFailure(serviceName)
        throw lastError.originalError || new Error(lastError.message)
      }

      // Callback onRetry
      onRetry?.(attempt + 1, lastError)

      // Attendre avec backoff exponentiel
      await sleep(delay)
      delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelay)
    }
  }

  // Ne devrait jamais arriver
  throw lastError?.originalError || new Error('Unexpected retry loop exit')
}

/**
 * Helper sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wrapper avec fallback statique
 */
export async function withFallback<T>(
  operation: () => Promise<T>,
  fallback: T | (() => T),
  options?: {
    serviceName?: string
    logError?: boolean
    showAlert?: boolean
  }
): Promise<{ result: T; fromFallback: boolean }> {
  const { serviceName = 'unknown', logError = true, showAlert = false } = options || {}

  try {
    const result = await operation()
    return { result, fromFallback: false }
  } catch (err) {
    const error = parseAIError(err)

    if (logError) {
      console.error(`[AIErrorHandler] ${serviceName} error, using fallback:`, error.message)
    }

    if (showAlert) {
      Alert.alert(
        'Service temporairement indisponible',
        error.suggestedAction || 'Réessayez plus tard',
        [{ text: 'OK' }]
      )
    }

    const fallbackResult = typeof fallback === 'function' ? (fallback as () => T)() : fallback
    return { result: fallbackResult, fromFallback: true }
  }
}

/**
 * Wrapper combinant retry ET fallback
 */
export async function withRetryAndFallback<T>(
  operation: () => Promise<T>,
  fallback: T | (() => T),
  options?: {
    serviceName?: string
    retryConfig?: Partial<RetryConfig>
    logError?: boolean
  }
): Promise<{ result: T; fromFallback: boolean; attempts: number }> {
  const { serviceName = 'unknown', retryConfig, logError = true } = options || {}

  let attempts = 0

  try {
    const result = await withRetry(operation, {
      serviceName,
      config: retryConfig,
      onRetry: () => { attempts++ },
    })
    return { result, fromFallback: false, attempts: attempts + 1 }
  } catch (err) {
    if (logError) {
      const error = parseAIError(err)
      console.error(`[AIErrorHandler] ${serviceName} failed after ${attempts + 1} attempts, using fallback:`, error.message)
    }

    const fallbackResult = typeof fallback === 'function' ? (fallback as () => T)() : fallback
    return { result: fallbackResult, fromFallback: true, attempts: attempts + 1 }
  }
}

/**
 * Réinitialise tous les circuit breakers (pour debug/testing)
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.clear()
}

/**
 * Obtenir l'état des circuit breakers (pour debug)
 */
export function getCircuitBreakerStatus(): Record<string, { open: boolean; failures: number }> {
  const status: Record<string, { open: boolean; failures: number }> = {}
  for (const [name, state] of circuitBreakers) {
    status[name] = { open: state.isOpen, failures: state.failures }
  }
  return status
}

// Export par défaut
const aiErrorHandler = {
  parseAIError,
  withRetry,
  withFallback,
  withRetryAndFallback,
  isCircuitOpen,
  recordFailure,
  recordSuccess,
  resetAllCircuitBreakers,
  getCircuitBreakerStatus,
}

export default aiErrorHandler
