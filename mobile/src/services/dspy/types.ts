/**
 * DSPy Client Types
 *
 * TypeScript types for the DSPy backend API responses.
 */

// ============= USER CONTEXT =============

export interface DSPyUserContext {
  goal: 'weight_loss' | 'maintain' | 'maintenance' | 'muscle_gain' | 'health' | 'energy'
  age?: number
  weight?: number
  activity_level?: string
  sleep_hours?: number
  stress_level?: number
  calories_today?: number
  target_calories?: number
  recent_patterns?: string[]
  // Macro targets for goal-specific meal selection
  macro_targets?: {
    proteins: number   // Daily target in grams
    carbs: number      // Daily target in grams
    fats: number       // Daily target in grams
  }
}

// ============= PASSAGES =============

export interface DSPyPassage {
  id: string
  content: string
  source: string
  similarity: number
}

// ============= QUERY REWRITING =============

export interface RewriteQueryRequest {
  question: string
  user_context?: DSPyUserContext
}

export interface RewriteQueryResponse {
  search_queries: string[]
  category_filter: 'nutrition' | 'wellness' | 'metabolism' | 'sport' | 'health'
  source_priority: string[]
  cached: boolean
}

// ============= EVIDENCE SELECTION =============

export interface SelectEvidenceRequest {
  question: string
  passages: DSPyPassage[]
  user_context?: DSPyUserContext
}

export interface SelectEvidenceResponse {
  selected_ids: string[]
  relevance_scores: number[]
  rationale: string
  cached: boolean
}

// ============= ANSWER GENERATION =============

export interface GenerateAnswerRequest {
  question: string
  evidence: DSPyPassage[]
  user_context?: DSPyUserContext
}

export interface GenerateAnswerResponse {
  answer: string
  citations_used: string[]
  confidence: number
  cached: boolean
}

// ============= VERIFICATION =============

export interface VerifyAnswerRequest {
  answer: string
  evidence: DSPyPassage[]
}

export interface VerifyAnswerResponse {
  is_grounded: boolean
  unsupported_claims: string[]
  suggested_disclaimer: string | null
  cached: boolean
}

// ============= FULL PIPELINE =============

export interface FullPipelineRequest {
  question: string
  passages: DSPyPassage[]
  user_context?: DSPyUserContext
  skip_verification?: boolean
}

export interface FullPipelineResponse {
  // Query rewriting
  rewritten_queries: string[]
  category: string
  source_priority: string[]

  // Evidence selection
  selected_passage_ids: string[]
  selection_rationale: string

  // Answer generation
  answer: string
  citations: string[]
  confidence: number

  // Verification (optional)
  is_grounded?: boolean
  unsupported_claims?: string[]
  disclaimer?: string | null

  // Meta
  cached: boolean
}

// ============= HEALTH CHECK =============

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy'
  pipeline_ready: boolean
  cache_size: number
}
