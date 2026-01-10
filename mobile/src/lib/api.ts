/**
 * API Client for Presence Mobile App
 *
 * Connects to Railway backend with:
 * - Retry logic with exponential backoff
 * - Proper error handling
 * - Request/response interceptors
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://lym1-production.up.railway.app'

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // 1 second
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504]

// Custom config type with retry tracking
interface RetryConfig extends InternalAxiosRequestConfig {
  _retryCount?: number
}

/**
 * Sleep for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate backoff delay with jitter
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = Math.pow(2, attempt) * RETRY_DELAY_BASE
  const jitter = Math.random() * 500
  return Math.min(exponentialDelay + jitter, 30000) // Max 30s
}

/**
 * Check if error is retryable
 */
function isRetryable(error: AxiosError): boolean {
  // Network errors are retryable
  if (!error.response) {
    return true
  }

  // Check status code
  const status = error.response.status
  return RETRYABLE_STATUS_CODES.includes(status)
}

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15s timeout
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging (dev only)
api.interceptors.request.use(
  (config) => {
    if (__DEV__) {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor with retry logic
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined

    if (!config) {
      return Promise.reject(error)
    }

    // Initialize retry count
    config._retryCount = config._retryCount ?? 0

    // Check if we should retry
    if (config._retryCount < MAX_RETRIES && isRetryable(error)) {
      config._retryCount++

      const delay = getBackoffDelay(config._retryCount)

      if (__DEV__) {
        console.log(`[API] Retry ${config._retryCount}/${MAX_RETRIES} in ${delay}ms: ${config.url}`)
      }

      await sleep(delay)

      return api(config)
    }

    // Format error message for user
    const errorMessage = getErrorMessage(error)

    if (__DEV__) {
      console.error('[API] Error:', errorMessage, error.response?.status)
    }

    // Re-throw with user-friendly message
    const enhancedError = new Error(errorMessage) as Error & { status?: number; originalError?: AxiosError }
    enhancedError.status = error.response?.status
    enhancedError.originalError = error

    return Promise.reject(enhancedError)
  }
)

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: AxiosError): string {
  if (!error.response) {
    return 'Erreur réseau. Vérifie ta connexion internet.'
  }

  const status = error.response.status

  switch (status) {
    case 400:
      return 'Requête invalide.'
    case 401:
      return 'Non autorisé. Reconnecte-toi.'
    case 403:
      return 'Accès refusé.'
    case 404:
      return 'Ressource non trouvée.'
    case 408:
      return 'Délai d\'attente dépassé.'
    case 429:
      return 'Trop de requêtes. Réessaie dans quelques instants.'
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Erreur serveur. Réessaie plus tard.'
    default:
      return `Erreur inattendue (${status}).`
  }
}

// ============================================================================
// API Functions
// ============================================================================

// Food search
export async function searchFood(query: string) {
  const response = await api.get(`/api/food/search?q=${encodeURIComponent(query)}`)
  return response.data
}

// Recipe search
export async function searchRecipes(query: string) {
  const response = await api.get(`/api/recipes/search?q=${encodeURIComponent(query)}`)
  return response.data
}

// Get recipe by ID
export async function getRecipe(id: string) {
  const response = await api.get(`/api/recipes/${id}`)
  return response.data
}

// Recipe suggestions
export async function getRecipeSuggestions(params: {
  goal?: string
  diet?: string
  calories?: number
  mealType?: string
}) {
  const searchParams = new URLSearchParams()
  if (params.goal) searchParams.set('goal', params.goal)
  if (params.diet) searchParams.set('diet', params.diet)
  if (params.calories) searchParams.set('calories', params.calories.toString())
  if (params.mealType) searchParams.set('mealType', params.mealType)

  const response = await api.get(`/api/recipes/suggestions?${searchParams.toString()}`)
  return response.data
}

// External recipes
export async function searchExternalRecipes(query: string) {
  const response = await api.get(`/api/recipes/external?q=${encodeURIComponent(query)}`)
  return response.data
}

// Enrich recipe with AI
export async function enrichRecipe(recipeId: string) {
  const response = await api.post('/api/recipes/enrich', { recipeId })
  return response.data
}

// Rate recipe
export async function rateRecipe(id: string, rating: number) {
  const response = await api.post(`/api/recipes/${id}/rate`, { rating })
  return response.data
}

// Sport program generation
export async function generateSportProgram(context: unknown) {
  const response = await api.post('/api/sport/generate-week', context)
  return response.data
}

export default {
  searchFood,
  searchRecipes,
  getRecipe,
  getRecipeSuggestions,
  searchExternalRecipes,
  enrichRecipe,
  rateRecipe,
  generateSportProgram,
}
