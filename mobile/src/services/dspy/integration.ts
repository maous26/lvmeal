/**
 * DSPy Integration for LymIA Brain
 *
 * This module provides integration hooks between the DSPy backend
 * and the existing lymia-brain.ts RAG system.
 *
 * It acts as a middleware that:
 * 1. Intercepts queries before they go to Supabase
 * 2. Reranks results after retrieval
 * 3. Generates grounded answers with citations
 */

import { dspyClient } from './client'
import type {
  DSPyUserContext,
  DSPyPassage,
  FullPipelineResponse,
  RewriteQueryResponse,
  SelectEvidenceResponse,
} from './types'
import type { KnowledgeBaseEntry } from '../supabase-client'
import type { UserProfile } from '../../types'

// ============= CONTEXT CONVERSION =============

/**
 * Convert UserProfile to DSPyUserContext
 */
export function profileToDSPyContext(
  profile: Partial<UserProfile>,
  additionalContext?: {
    sleepHours?: number
    stressLevel?: number
    caloriesToday?: number
    targetCalories?: number
    recentPatterns?: string[]
  }
): DSPyUserContext {
  return {
    goal: (profile.goal as DSPyUserContext['goal']) || 'maintain',
    age: profile.age,
    weight: profile.weight,
    activity_level: profile.activityLevel,
    sleep_hours: additionalContext?.sleepHours,
    stress_level: additionalContext?.stressLevel,
    calories_today: additionalContext?.caloriesToday,
    target_calories: additionalContext?.targetCalories,
    recent_patterns: additionalContext?.recentPatterns,
  }
}

/**
 * Convert KnowledgeBaseEntry to DSPyPassage
 */
export function kbEntryToPassage(entry: KnowledgeBaseEntry, similarity?: number): DSPyPassage {
  return {
    id: entry.id,
    content: entry.content,
    source: entry.source,
    similarity: similarity ?? entry.metadata?.relevance_score ?? 0,
  }
}

/**
 * Convert KnowledgeBaseEntry array to DSPyPassage array
 */
export function kbEntriesToPassages(entries: KnowledgeBaseEntry[]): DSPyPassage[] {
  return entries.map(kbEntryToPassage)
}

// ============= INTEGRATION HOOKS =============

/**
 * Hook: Rewrite query before sending to Supabase
 *
 * Transforms naive user questions into optimized search queries.
 *
 * @param question - Original user question
 * @param profile - User profile for context
 * @returns Rewritten queries or original if DSPy unavailable
 */
export async function hookRewriteQuery(
  question: string,
  profile?: Partial<UserProfile>,
  additionalContext?: Parameters<typeof profileToDSPyContext>[1]
): Promise<{
  queries: string[]
  categoryFilter?: string
  sourcePriority?: string[]
  enhanced: boolean
}> {
  // Try DSPy rewriting
  const context = profile ? profileToDSPyContext(profile, additionalContext) : undefined
  const result = await dspyClient.rewriteQuery(question, context)

  if (result) {
    console.log('[DSPy] Query rewritten:', {
      original: question,
      rewritten: result.search_queries,
      category: result.category_filter,
    })

    return {
      queries: result.search_queries,
      categoryFilter: result.category_filter,
      sourcePriority: result.source_priority,
      enhanced: true,
    }
  }

  // Fallback: return original query
  return {
    queries: [question],
    enhanced: false,
  }
}

/**
 * Hook: Rerank passages after Supabase retrieval
 *
 * Selects the most relevant passages using Chain-of-Thought reasoning.
 *
 * @param question - User question
 * @param entries - Retrieved KB entries from Supabase
 * @param profile - User profile for context
 * @returns Reranked entries or original if DSPy unavailable
 */
export async function hookSelectEvidence(
  question: string,
  entries: KnowledgeBaseEntry[],
  profile?: Partial<UserProfile>,
  additionalContext?: Parameters<typeof profileToDSPyContext>[1]
): Promise<{
  entries: KnowledgeBaseEntry[]
  rationale?: string
  reranked: boolean
}> {
  if (entries.length === 0) {
    return { entries, reranked: false }
  }

  // Try DSPy selection
  const passages = kbEntriesToPassages(entries)
  const context = profile ? profileToDSPyContext(profile, additionalContext) : undefined
  const result = await dspyClient.selectEvidence(question, passages, context)

  if (result && result.selected_ids.length > 0) {
    // Reorder entries based on DSPy selection
    const selectedEntries: KnowledgeBaseEntry[] = []
    for (const id of result.selected_ids) {
      const entry = entries.find(e => e.id === id)
      if (entry) {
        selectedEntries.push(entry)
      }
    }

    console.log('[DSPy] Evidence selected:', {
      original: entries.length,
      selected: selectedEntries.length,
      rationale: result.rationale.slice(0, 100),
    })

    return {
      entries: selectedEntries,
      rationale: result.rationale,
      reranked: true,
    }
  }

  // Fallback: return original entries
  return { entries, reranked: false }
}

/**
 * Hook: Generate grounded answer with citations
 *
 * Generates an answer that cites evidence passages inline.
 *
 * @param question - User question
 * @param entries - Selected KB entries
 * @param profile - User profile for personalization
 * @returns Grounded answer with citations or null if DSPy unavailable
 */
export async function hookGenerateGroundedAnswer(
  question: string,
  entries: KnowledgeBaseEntry[],
  profile?: Partial<UserProfile>,
  additionalContext?: Parameters<typeof profileToDSPyContext>[1]
): Promise<{
  answer: string
  citations: string[]
  confidence: number
  isGrounded?: boolean
  disclaimer?: string | null
} | null> {
  if (entries.length === 0) {
    return null
  }

  // Try DSPy generation
  const passages = kbEntriesToPassages(entries)
  const context = profile ? profileToDSPyContext(profile, additionalContext) : undefined
  const result = await dspyClient.generateAnswer(question, passages, context)

  if (result) {
    console.log('[DSPy] Answer generated:', {
      citations: result.citations_used.length,
      confidence: result.confidence,
    })

    return {
      answer: result.answer,
      citations: result.citations_used,
      confidence: result.confidence,
    }
  }

  return null
}

/**
 * Full DSPy-enhanced RAG pipeline
 *
 * Combines all hooks into a single call for efficiency.
 * Use this for main chat/ask functionality.
 *
 * @param question - User question
 * @param entries - Retrieved KB entries
 * @param profile - User profile
 * @returns Enhanced response or null if DSPy unavailable
 */
export async function runEnhancedRAG(
  question: string,
  entries: KnowledgeBaseEntry[],
  profile?: Partial<UserProfile>,
  additionalContext?: Parameters<typeof profileToDSPyContext>[1],
  skipVerification = false
): Promise<FullPipelineResponse | null> {
  if (entries.length === 0) {
    return null
  }

  const passages = kbEntriesToPassages(entries)
  const context = profile ? profileToDSPyContext(profile, additionalContext) : undefined

  const result = await dspyClient.runPipeline(
    question,
    passages,
    context,
    skipVerification
  )

  if (result) {
    console.log('[DSPy] Full pipeline completed:', {
      rewrittenQueries: result.rewritten_queries.length,
      selectedPassages: result.selected_passage_ids.length,
      citations: result.citations.length,
      confidence: result.confidence,
      isGrounded: result.is_grounded,
      cached: result.cached,
    })
  }

  return result
}

// ============= UTILITY FUNCTIONS =============

/**
 * Check if DSPy is available and enabled
 */
export async function isDSPyEnabled(): Promise<boolean> {
  return await dspyClient.isEnabled()
}

/**
 * Format citations in answer for display
 *
 * Converts [source_id] references to clickable/displayable format.
 */
export function formatCitationsForDisplay(
  answer: string,
  entries: KnowledgeBaseEntry[]
): string {
  // Create a map of id -> source name
  const sourceMap = new Map<string, string>()
  entries.forEach(e => {
    sourceMap.set(e.id, e.source)
  })

  // Replace [id] with [Source Name]
  return answer.replace(/\[([^\]]+)\]/g, (match, id) => {
    const sourceName = sourceMap.get(id)
    return sourceName ? `[${sourceName}]` : match
  })
}

/**
 * Extract unique sources from citations
 */
export function extractSourcesFromCitations(
  citations: string[],
  entries: KnowledgeBaseEntry[]
): string[] {
  const sourceMap = new Map<string, string>()
  entries.forEach(e => {
    sourceMap.set(e.id, e.source)
  })

  const sources = new Set<string>()
  citations.forEach(id => {
    const source = sourceMap.get(id)
    if (source) {
      sources.add(source)
    }
  })

  return Array.from(sources)
}
