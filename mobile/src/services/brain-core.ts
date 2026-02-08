/**
 * Brain Core - Shared AI infrastructure for LymIA modules
 * 
 * Centralized OpenAI client, rate-limited execution, and knowledge base queries.
 * All brain modules depend on this for AI interactions.
 */

import OpenAI from 'openai'
import { queryKnowledgeBase, isSupabaseConfigured, type KnowledgeBaseEntry } from './supabase-client'
import { aiRateLimiter, type AIRequestType } from './ai-rate-limiter'
import { withRetry, parseAIError, type AIError } from './ai-error-handler'

// Lazy initialization of OpenAI client
let _openai: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
    })
  }
  return _openai
}

/**
 * Query knowledge base with semantic search across categories
 */
export async function queryKB(
  query: string,
  categories: string[] = ['nutrition', 'metabolism', 'wellness', 'sport', 'guidelines']
): Promise<KnowledgeBaseEntry[]> {
  if (!isSupabaseConfigured()) {
    console.warn('LymIA Brain: Supabase not configured, using AI-only mode')
    return []
  }

  const results = await Promise.all(
    categories.map(cat => queryKnowledgeBase(query, { category: cat as KnowledgeBaseEntry['category'], limit: 3 }))
  )

  const entries: KnowledgeBaseEntry[] = []
  for (const result of results) {
    if (result?.entries) {
      entries.push(...result.entries)
    }
  }

  return entries
}

/**
 * Build context string from knowledge base entries
 */
export function buildKBContext(entries: KnowledgeBaseEntry[]): string {
  if (entries.length === 0) return ''
  return entries.map(e => `[${e.source}] ${e.content}`).join('\n\n')
}

/**
 * Execute OpenAI call with rate limiting, retry, and model selection
 */
export async function executeAICall(
  requestType: AIRequestType,
  messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>,
  options: {
    temperature?: number
    responseFormat?: { type: 'json_object' | 'text' }
    context?: Record<string, unknown>
    maxRetries?: number
  } = {}
): Promise<{ content: string; model: string; fromCache: boolean } | null> {
  const { temperature = 0.7, responseFormat, context = {}, maxRetries = 2 } = options

  const rateCheck = aiRateLimiter.checkRateLimit(requestType, context)

  if (rateCheck.cached) {
    console.log(`[LymIABrain] Cache hit for ${requestType}`)
    return { content: rateCheck.cached, model: 'cache', fromCache: true }
  }

  if (!rateCheck.allowed) {
    console.warn(`[LymIABrain] Rate limit: ${rateCheck.reason}`)
    return null
  }

  try {
    const result = await withRetry(
      async () => {
        const response = await getOpenAI().chat.completions.create({
          model: rateCheck.model,
          messages,
          temperature,
          ...(responseFormat && { response_format: responseFormat }),
        })

        const content = response.choices[0].message.content || ''
        if (!content) {
          throw new Error('Empty response from AI')
        }
        return content
      },
      {
        serviceName: `lymia_${requestType}`,
        config: {
          maxRetries,
          initialDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 2,
        },
        onRetry: (attempt, error) => {
          console.warn(`[LymIABrain] Retry ${attempt} for ${requestType}:`, error.message)
        },
        shouldRetry: (error) => {
          return error.type !== 'quota_exceeded' && error.type !== 'invalid_key'
        },
      }
    )

    aiRateLimiter.consumeCredits(requestType)

    if (Object.keys(context).length > 0) {
      aiRateLimiter.cacheResponse(requestType, context, result)
    }

    return { content: result, model: rateCheck.model, fromCache: false }
  } catch (error) {
    const aiError = parseAIError(error)
    console.error(`[LymIABrain] ${requestType} failed after retries:`, {
      type: aiError.type,
      message: aiError.message,
      retryable: aiError.retryable,
    })
    throw error
  }
}

export type { KnowledgeBaseEntry, AIRequestType }
