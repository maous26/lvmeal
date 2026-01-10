/**
 * Fetch Utilities with Timeout and Retry
 *
 * Provides robust fetch operations with:
 * - Configurable timeouts (prevents app freeze)
 * - Exponential backoff retry logic
 * - Error categorization
 */

export interface FetchOptions extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
  onRetry?: (attempt: number, error: Error) => void
}

export type FetchError = {
  type: 'timeout' | 'network' | 'http' | 'unknown'
  message: string
  status?: number
  originalError?: Error
}

/**
 * Default timeouts (in ms)
 */
export const TIMEOUTS = {
  DEFAULT: 10000,      // 10s for normal requests
  OPENAI: 30000,       // 30s for OpenAI (can be slow)
  UPLOAD: 60000,       // 60s for file uploads
  EMBEDDING: 20000,    // 20s for embeddings
} as const

/**
 * Fetch with timeout support
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = TIMEOUTS.DEFAULT, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
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
function getBackoffDelay(attempt: number, baseDelay: number = 1000): number {
  const exponentialDelay = Math.pow(2, attempt) * baseDelay
  const jitter = Math.random() * 1000
  return Math.min(exponentialDelay + jitter, 30000) // Max 30s
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error, status?: number): boolean {
  // Network errors are retryable
  if (error.name === 'TypeError' && error.message.includes('network')) {
    return true
  }

  // Timeout errors are retryable
  if (error.name === 'AbortError') {
    return true
  }

  // Server errors (5xx) are retryable
  if (status && status >= 500 && status < 600) {
    return true
  }

  // Rate limit (429) is retryable
  if (status === 429) {
    return true
  }

  return false
}

/**
 * Fetch with timeout and retry support
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = TIMEOUTS.DEFAULT,
    retries = 3,
    retryDelay = 1000,
    onRetry,
    ...fetchOptions
  } = options

  let lastError: Error | undefined
  let lastStatus: number | undefined

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        ...fetchOptions,
        timeout,
      })

      // If response is OK or non-retryable error, return
      if (response.ok || !isRetryableError(new Error(), response.status)) {
        return response
      }

      lastStatus = response.status
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      lastStatus = undefined

      // Check if we should retry
      if (attempt < retries && isRetryableError(lastError, lastStatus)) {
        const delay = getBackoffDelay(attempt, retryDelay)

        if (onRetry) {
          onRetry(attempt + 1, lastError)
        }

        if (__DEV__) {
          console.log(`[Fetch] Retry ${attempt + 1}/${retries} after ${delay}ms: ${url}`)
        }

        await sleep(delay)
        continue
      }

      throw lastError
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

/**
 * Parse fetch error into categorized error
 */
export function parseFetchError(error: unknown, status?: number): FetchError {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return {
        type: 'timeout',
        message: 'La requête a expiré. Vérifie ta connexion.',
        originalError: error,
      }
    }

    if (error.message.includes('network') || error.message.includes('Network')) {
      return {
        type: 'network',
        message: 'Erreur réseau. Vérifie ta connexion internet.',
        originalError: error,
      }
    }

    if (status) {
      return {
        type: 'http',
        message: `Erreur serveur (${status})`,
        status,
        originalError: error,
      }
    }

    return {
      type: 'unknown',
      message: error.message,
      originalError: error,
    }
  }

  return {
    type: 'unknown',
    message: 'Une erreur inattendue est survenue.',
  }
}

/**
 * Wrapper for OpenAI API calls with proper timeout
 */
export async function fetchOpenAI(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetchWithRetry(url, {
    ...options,
    timeout: TIMEOUTS.OPENAI,
    retries: 2,
    onRetry: (attempt, error) => {
      console.warn(`[OpenAI] Retry ${attempt}: ${error.message}`)
    },
  })
}

export default {
  fetchWithTimeout,
  fetchWithRetry,
  fetchOpenAI,
  parseFetchError,
  TIMEOUTS,
}
