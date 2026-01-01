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

// ============= EMBEDDING CACHE =============
// Cache embeddings for 24 hours to avoid redundant OpenAI calls
interface EmbeddingCacheEntry {
  embedding: number[]
  timestamp: number
}

const embeddingCache = new Map<string, EmbeddingCacheEntry>()
const EMBEDDING_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Get cached embedding or null if expired/not found
 */
function getCachedEmbedding(text: string): number[] | null {
  const cacheKey = text.toLowerCase().trim()
  const cached = embeddingCache.get(cacheKey)

  if (!cached) return null

  // Check if expired
  if (Date.now() - cached.timestamp > EMBEDDING_CACHE_TTL) {
    embeddingCache.delete(cacheKey)
    return null
  }

  return cached.embedding
}

/**
 * Cache an embedding
 */
function cacheEmbedding(text: string, embedding: number[]): void {
  const cacheKey = text.toLowerCase().trim()
  embeddingCache.set(cacheKey, {
    embedding,
    timestamp: Date.now(),
  })

  // Limit cache size to 500 entries
  if (embeddingCache.size > 500) {
    const oldestKey = embeddingCache.keys().next().value
    if (oldestKey) embeddingCache.delete(oldestKey)
  }
}

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
 * Generate embedding using OpenAI API (with caching)
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured')
    return null
  }

  // Check cache first
  const cached = getCachedEmbedding(text)
  if (cached) {
    return cached
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
    const embedding = data.data[0].embedding

    // Cache the embedding
    cacheEmbedding(text, embedding)

    return embedding
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    return null
  }
}

/**
 * Batch query knowledge base with a SINGLE embedding for multiple categories
 * This is 3-5x faster than calling queryKnowledgeBase for each category separately
 */
export async function queryKnowledgeBaseBatch(
  query: string,
  categories: Array<KnowledgeBaseEntry['category']>,
  options?: {
    limit?: number
    threshold?: number
  }
): Promise<RAGQueryResult | null> {
  const client = getSupabaseClient()
  if (!client) return null

  try {
    // Generate ONE embedding for ALL categories (major optimization)
    const embedding = await generateEmbedding(query)
    if (!embedding) {
      console.warn('Could not generate embedding for batch query')
      return null
    }

    // Query all categories in parallel with the SAME embedding
    const results = await Promise.all(
      categories.map(category =>
        client.rpc('search_knowledge_base', {
          query_embedding: embedding,
          match_threshold: options?.threshold || 0.7,
          match_count: options?.limit || 3,
          filter_category: category,
          filter_source: null,
        })
      )
    )

    const entries: KnowledgeBaseEntry[] = []
    const similarity_scores: number[] = []

    for (const result of results) {
      if (result.error) {
        console.warn('Batch RAG query partial error:', result.error)
        continue
      }

      if (result.data) {
        for (const row of result.data as Record<string, unknown>[]) {
          entries.push({
            id: row.id as string,
            content: row.content as string,
            category: row.category as KnowledgeBaseEntry['category'],
            source: row.source as KnowledgeBaseEntry['source'],
            source_url: row.source_url as string | undefined,
            metadata: row.metadata as KnowledgeBaseEntry['metadata'],
            language: 'fr',
            created_at: new Date().toISOString(),
          })
          similarity_scores.push(row.similarity as number)
        }
      }
    }

    // Sort by similarity score (best first)
    const sorted = entries
      .map((entry, i) => ({ entry, score: similarity_scores[i] }))
      .sort((a, b) => b.score - a.score)

    return {
      entries: sorted.map(s => s.entry),
      similarity_scores: sorted.map(s => s.score),
    }
  } catch (error) {
    console.error('Failed to batch query knowledge base:', error)
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

// ============================================================================
// STORAGE - Meditation Audio Files
// ============================================================================

const MEDITATION_BUCKET = 'meditations'

/**
 * Get public URL for a meditation audio file
 */
export function getMeditationAudioUrl(sessionId: string): string | null {
  const client = getSupabaseClient()
  if (!client) return null

  const { data } = client.storage
    .from(MEDITATION_BUCKET)
    .getPublicUrl(`${sessionId}.wav`)

  return data.publicUrl
}

/**
 * Check if meditation audio exists in storage
 */
export async function checkMeditationAudioExists(sessionId: string): Promise<boolean> {
  const client = getSupabaseClient()
  if (!client) return false

  try {
    const { data, error } = await client.storage
      .from(MEDITATION_BUCKET)
      .list('', {
        search: `${sessionId}.wav`,
      })

    if (error) {
      console.error('Error checking meditation audio:', error)
      return false
    }

    return data?.some(file => file.name === `${sessionId}.wav`) || false
  } catch (error) {
    console.error('Error checking meditation audio:', error)
    return false
  }
}

/**
 * Download meditation audio as blob
 */
export async function downloadMeditationAudio(sessionId: string): Promise<Blob | null> {
  const client = getSupabaseClient()
  if (!client) return null

  try {
    const { data, error } = await client.storage
      .from(MEDITATION_BUCKET)
      .download(`${sessionId}.wav`)

    if (error) {
      console.error('Error downloading meditation audio:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error downloading meditation audio:', error)
    return null
  }
}

/**
 * Upload meditation audio (for pre-generation script)
 */
export async function uploadMeditationAudio(
  sessionId: string,
  audioData: Blob | ArrayBuffer,
  contentType: string = 'audio/wav'
): Promise<string | null> {
  const client = getSupabaseClient()
  if (!client) return null

  try {
    const { error } = await client.storage
      .from(MEDITATION_BUCKET)
      .upload(`${sessionId}.wav`, audioData, {
        contentType,
        upsert: true,
      })

    if (error) {
      console.error('Error uploading meditation audio:', error)
      return null
    }

    return getMeditationAudioUrl(sessionId)
  } catch (error) {
    console.error('Error uploading meditation audio:', error)
    return null
  }
}

/**
 * List all meditation audio files
 */
export async function listMeditationAudios(): Promise<string[]> {
  const client = getSupabaseClient()
  if (!client) return []

  try {
    const { data, error } = await client.storage
      .from(MEDITATION_BUCKET)
      .list('')

    if (error) {
      console.error('Error listing meditation audios:', error)
      return []
    }

    return data?.map(file => file.name.replace('.wav', '')) || []
  } catch (error) {
    console.error('Error listing meditation audios:', error)
    return []
  }
}

// ============================================================================
// SUPABASE CLIENT - Direct Access for Auth
// ============================================================================

/**
 * Get Supabase client with guaranteed non-null return
 * Use this for auth operations where client must exist
 */
export function getSupabaseClientRequired(): SupabaseClient {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase client not configured')
  }
  return client
}

/**
 * Lazy-initialized supabase client for auth
 * Returns a proxy that safely handles unconfigured state
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseClient()
    if (!client) {
      // Return a mock that returns failed promises for auth operations
      if (prop === 'auth') {
        return {
          getSession: () => Promise.resolve({ data: { session: null }, error: null }),
          signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase non configuré' } }),
          signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase non configuré' } }),
          signOut: () => Promise.resolve({ error: null }),
          getUser: () => Promise.resolve({ data: { user: null }, error: null }),
          updateUser: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase non configuré' } }),
          signInWithIdToken: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase non configuré' } }),
        }
      }
      console.warn('Supabase not configured - operation skipped')
      return undefined
    }
    // Use unknown first to allow dynamic property access
    return (client as unknown as Record<string, unknown>)[prop as string]
  },
})
