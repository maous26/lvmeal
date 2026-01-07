/**
 * DSPy HTTP Client
 *
 * Client to communicate with the DSPy Python backend.
 * Handles all API calls with error handling and timeout.
 */

import type {
  DSPyUserContext,
  DSPyPassage,
  RewriteQueryRequest,
  RewriteQueryResponse,
  SelectEvidenceRequest,
  SelectEvidenceResponse,
  GenerateAnswerRequest,
  GenerateAnswerResponse,
  VerifyAnswerRequest,
  VerifyAnswerResponse,
  FullPipelineRequest,
  FullPipelineResponse,
  HealthCheckResponse,
} from './types'

// ============= CONFIGURATION =============

// DSPy backend URL - configure via environment or fallback
const DSPY_BACKEND_URL = process.env.EXPO_PUBLIC_DSPY_URL || 'http://localhost:8000'

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 30000 // 30 seconds

// ============= HTTP HELPERS =============

interface FetchOptions {
  method: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  timeout?: number
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions
): Promise<Response> {
  const { method, body, timeout = REQUEST_TIMEOUT } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

async function apiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const url = `${DSPY_BACKEND_URL}${endpoint}`

  try {
    const response = await fetchWithTimeout(url, { method, body })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`[DSPy Client] ${method} ${endpoint} failed:`, error)
    throw error
  }
}

// ============= CLIENT CLASS =============

class DSPyClient {
  private isAvailable: boolean | null = null
  private lastHealthCheck: number = 0
  private healthCheckInterval = 60000 // 1 minute

  /**
   * Check if DSPy backend is available
   */
  async checkHealth(): Promise<HealthCheckResponse | null> {
    const now = Date.now()

    // Use cached result if recent
    if (this.isAvailable !== null && now - this.lastHealthCheck < this.healthCheckInterval) {
      console.log('[DSPy Client] Using cached health check')
      return this.isAvailable
        ? { status: 'healthy', pipeline_ready: true, cache_size: 0 }
        : null
    }

    console.log('[DSPy Client] Making health check request to:', DSPY_BACKEND_URL)
    // Use shorter timeout (3s) for health check to avoid blocking meal generation
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

    try {
      const response = await fetch(`${DSPY_BACKEND_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json() as HealthCheckResponse
      this.isAvailable = result.status === 'healthy' && result.pipeline_ready
      this.lastHealthCheck = now
      console.log('[DSPy Client] Health check success:', result)
      return result
    } catch (error) {
      clearTimeout(timeoutId)
      console.log('[DSPy Client] Health check failed (expected if no backend):', error)
      this.isAvailable = false
      this.lastHealthCheck = Date.now()
      return null
    }
  }

  /**
   * Check if DSPy is enabled and available
   */
  async isEnabled(): Promise<boolean> {
    console.log('[DSPy Client] isEnabled() called')
    // Quick check without full health request
    if (this.isAvailable !== null && Date.now() - this.lastHealthCheck < this.healthCheckInterval) {
      console.log('[DSPy Client] Using cached availability:', this.isAvailable)
      return this.isAvailable
    }

    console.log('[DSPy Client] Checking health...')
    const health = await this.checkHealth()
    const result = health !== null && health.pipeline_ready
    console.log('[DSPy Client] isEnabled result:', result)
    return result
  }

  /**
   * Rewrite user question into optimized search queries
   */
  async rewriteQuery(
    question: string,
    userContext?: DSPyUserContext
  ): Promise<RewriteQueryResponse | null> {
    if (!(await this.isEnabled())) {
      return null
    }

    try {
      const request: RewriteQueryRequest = {
        question,
        user_context: userContext,
      }

      return await apiCall<RewriteQueryResponse>('/rewrite-query', 'POST', request)
    } catch (error) {
      console.error('[DSPy] Query rewriting failed:', error)
      return null
    }
  }

  /**
   * Select and rerank the most relevant passages
   */
  async selectEvidence(
    question: string,
    passages: DSPyPassage[],
    userContext?: DSPyUserContext
  ): Promise<SelectEvidenceResponse | null> {
    if (!(await this.isEnabled())) {
      return null
    }

    try {
      const request: SelectEvidenceRequest = {
        question,
        passages,
        user_context: userContext,
      }

      return await apiCall<SelectEvidenceResponse>('/select-evidence', 'POST', request)
    } catch (error) {
      console.error('[DSPy] Evidence selection failed:', error)
      return null
    }
  }

  /**
   * Generate a grounded answer with citations
   */
  async generateAnswer(
    question: string,
    evidence: DSPyPassage[],
    userContext?: DSPyUserContext
  ): Promise<GenerateAnswerResponse | null> {
    if (!(await this.isEnabled())) {
      return null
    }

    try {
      const request: GenerateAnswerRequest = {
        question,
        evidence,
        user_context: userContext,
      }

      return await apiCall<GenerateAnswerResponse>('/generate-answer', 'POST', request)
    } catch (error) {
      console.error('[DSPy] Answer generation failed:', error)
      return null
    }
  }

  /**
   * Verify that an answer is grounded in evidence
   */
  async verifyAnswer(
    answer: string,
    evidence: DSPyPassage[]
  ): Promise<VerifyAnswerResponse | null> {
    if (!(await this.isEnabled())) {
      return null
    }

    try {
      const request: VerifyAnswerRequest = {
        answer,
        evidence,
      }

      return await apiCall<VerifyAnswerResponse>('/verify-answer', 'POST', request)
    } catch (error) {
      console.error('[DSPy] Answer verification failed:', error)
      return null
    }
  }

  /**
   * Execute full RAG pipeline in one call
   *
   * This is the main method for production use.
   * Combines: rewrite -> select -> generate -> verify
   */
  async runPipeline(
    question: string,
    passages: DSPyPassage[],
    userContext?: DSPyUserContext,
    skipVerification = false
  ): Promise<FullPipelineResponse | null> {
    if (!(await this.isEnabled())) {
      return null
    }

    try {
      const request: FullPipelineRequest = {
        question,
        passages,
        user_context: userContext,
        skip_verification: skipVerification,
      }

      return await apiCall<FullPipelineResponse>('/pipeline', 'POST', request)
    } catch (error) {
      console.error('[DSPy] Full pipeline failed:', error)
      return null
    }
  }

  /**
   * Clear the backend cache
   */
  async clearCache(): Promise<boolean> {
    try {
      await apiCall('/cache', 'DELETE')
      return true
    } catch {
      return false
    }
  }
}

// ============= SINGLETON EXPORT =============

export const dspyClient = new DSPyClient()

export default dspyClient
