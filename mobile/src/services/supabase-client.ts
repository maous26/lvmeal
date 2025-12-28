/**
 * Supabase Client Configuration
 *
 * Client for RAG knowledge base and chat history.
 * Uses pgvector for semantic search.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY || ''

// Database types for RAG
export interface KnowledgeBaseEntry {
  id: string
  content: string
  embedding?: number[]
  category: 'nutrition' | 'metabolism' | 'wellness' | 'sport' | 'health' | 'guidelines' | 'recipes'
  source: 'anses' | 'ciqual' | 'inserm' | 'has' | 'pubmed' | 'expert' | 'gustar'
  source_url?: string
  metadata: {
    title?: string
    keywords?: string[]
    relevance_score?: number
    language?: string
    [key: string]: unknown
  }
  language: string
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  context_used?: {
    sources: string[]
    knowledge_ids: string[]
    meal_source?: 'gustar' | 'ciqual' | 'off' | 'ai'
  }
  created_at: string
}

export interface RAGQueryResult {
  entries: KnowledgeBaseEntry[]
  query_embedding?: number[]
  similarity_scores: number[]
}

// Singleton client instance
let supabaseClient: SupabaseClient | null = null

/**
 * Get or create Supabase client instance
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || SUPABASE_URL === 'xxx' || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'xxx') {
    console.warn('Supabase not configured - RAG features disabled')
    return null
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }

  return supabaseClient
}

/**
 * Check if Supabase is configured and available
 */
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_URL !== 'xxx' && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'xxx')
}

/**
 * Generate embedding using OpenAI API
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured')
    return null
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    })

    if (!response.ok) {
      console.error('OpenAI embedding error:', await response.text())
      return null
    }

    const data = await response.json()
    return data.data[0].embedding
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    return null
  }
}

/**
 * Query knowledge base using semantic search (direct via Supabase RPC)
 */
export async function queryKnowledgeBase(
  query: string,
  options?: {
    category?: KnowledgeBaseEntry['category']
    source?: KnowledgeBaseEntry['source']
    limit?: number
    threshold?: number
  }
): Promise<RAGQueryResult | null> {
  const client = getSupabaseClient()
  if (!client) return null

  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query)
    if (!embedding) {
      console.warn('Could not generate embedding, falling back to text search')
      return null
    }

    // Call the search_knowledge_base function via RPC
    const { data, error } = await client.rpc('search_knowledge_base', {
      query_embedding: embedding,
      match_threshold: options?.threshold || 0.7,
      match_count: options?.limit || 5,
      filter_category: options?.category || null,
      filter_source: options?.source || null,
    })

    if (error) {
      console.error('RAG query error:', error)
      return null
    }

    if (!data || data.length === 0) {
      return { entries: [], similarity_scores: [] }
    }

    const entries: KnowledgeBaseEntry[] = data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      content: row.content as string,
      category: row.category as KnowledgeBaseEntry['category'],
      source: row.source as KnowledgeBaseEntry['source'],
      source_url: row.source_url as string | undefined,
      metadata: row.metadata as KnowledgeBaseEntry['metadata'],
      language: 'fr',
      created_at: new Date().toISOString(),
    }))

    const similarity_scores = data.map((row: Record<string, unknown>) => row.similarity as number)

    return { entries, similarity_scores }
  } catch (error) {
    console.error('Failed to query knowledge base:', error)
    return null
  }
}

/**
 * Save chat message to history
 */
export async function saveChatMessage(
  userId: string,
  role: ChatMessage['role'],
  content: string,
  contextUsed?: ChatMessage['context_used']
): Promise<ChatMessage | null> {
  const client = getSupabaseClient()
  if (!client) return null

  try {
    const { data, error } = await client
      .from('chat_history')
      .insert({
        user_id: userId,
        role,
        content,
        context_used: contextUsed,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save chat message:', error)
      return null
    }

    return data as ChatMessage
  } catch (error) {
    console.error('Error saving chat message:', error)
    return null
  }
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(
  userId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const client = getSupabaseClient()
  if (!client) return []

  try {
    const { data, error } = await client
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Failed to get chat history:', error)
      return []
    }

    return (data as ChatMessage[]).reverse()
  } catch (error) {
    console.error('Error getting chat history:', error)
    return []
  }
}

/**
 * Clear chat history for a user
 */
export async function clearChatHistory(userId: string): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) return false

  try {
    const { error } = await client
      .from('chat_history')
      .delete()
      .eq('user_id', userId)

    if (error) {
      console.error('Failed to clear chat history:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error clearing chat history:', error)
    return false
  }
}

/**
 * Get knowledge base statistics
 */
export async function getKnowledgeBaseStats(): Promise<{
  total: number
  byCategory: Record<string, number>
  bySource: Record<string, number>
} | null> {
  const client = getSupabaseClient()
  if (!client) return null

  try {
    const { data, error } = await client
      .from('knowledge_base')
      .select('category, source')

    if (error) {
      console.error('Failed to get KB stats:', error)
      return null
    }

    const entries = data as Pick<KnowledgeBaseEntry, 'category' | 'source'>[]

    const byCategory: Record<string, number> = {}
    const bySource: Record<string, number> = {}

    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1
      bySource[entry.source] = (bySource[entry.source] || 0) + 1
    }

    return {
      total: entries.length,
      byCategory,
      bySource,
    }
  } catch (error) {
    console.error('Error getting KB stats:', error)
    return null
  }
}
