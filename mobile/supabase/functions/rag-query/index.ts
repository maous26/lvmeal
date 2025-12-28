/**
 * Supabase Edge Function: RAG Query
 *
 * Performs semantic search on the knowledge base and generates
 * contextual responses for LymIA coach.
 *
 * Endpoint: POST /functions/v1/rag-query
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types
interface RAGQueryRequest {
  query: string
  userId: string
  conversationId?: string
  userContext?: {
    profile?: Record<string, unknown>
    nutritionToday?: Record<string, unknown>
    wellness?: Record<string, unknown>
  }
  options?: {
    category?: string
    maxResults?: number
    threshold?: number
    includeHistory?: boolean
  }
}

interface RAGQueryResponse {
  answer: string
  sources: Array<{
    content: string
    source: string
    sourceUrl?: string
    similarity: number
  }>
  conversationId: string
  tokensUsed?: number
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Initialize OpenAI
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
const OPENAI_CHAT_MODEL = 'gpt-4o-mini'

// Initialize Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * Generate embedding for a text query
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Embedding Error: ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

/**
 * Search knowledge base with vector similarity
 */
async function searchKnowledgeBase(
  supabase: ReturnType<typeof createClient>,
  embedding: number[],
  options: {
    category?: string
    maxResults?: number
    threshold?: number
  }
): Promise<Array<{
  content: string
  source: string
  sourceUrl?: string
  similarity: number
}>> {
  const { data, error } = await supabase.rpc('search_knowledge_base', {
    query_embedding: embedding,
    match_threshold: options.threshold || 0.7,
    match_count: options.maxResults || 5,
    filter_category: options.category || null,
    filter_source: null,
  })

  if (error) {
    console.error('Knowledge base search error:', error)
    return []
  }

  return data.map((item: Record<string, unknown>) => ({
    content: item.content as string,
    source: item.source as string,
    sourceUrl: item.source_url as string | undefined,
    similarity: item.similarity as number,
  }))
}

/**
 * Get recent conversation history
 */
async function getConversationHistory(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  limit: number = 10
): Promise<Array<{ role: string; content: string }>> {
  const { data, error } = await supabase
    .from('chat_history')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Conversation history error:', error)
    return []
  }

  return data || []
}

/**
 * Generate response with OpenAI
 */
async function generateResponse(
  query: string,
  context: string,
  userContext: string,
  history: Array<{ role: string; content: string }>
): Promise<{ answer: string; tokensUsed: number }> {
  const systemPrompt = `Tu es LymIA, coach IA personnel specialise en nutrition, bien-etre et remise en forme.
Tu accompagnes des utilisateurs francophones (France/Europe) dans leur parcours sante.

Tes domaines d'expertise:
- Nutrition equilibree et personnalisee
- Relance metabolique et gestion du poids
- Bien-etre (sommeil, stress, energie)
- Activite physique adaptee
- Motivation et suivi des habitudes

Principes:
- Conseils bases sur des sources fiables (ANSES, INSERM, HAS)
- Adaptation au contexte personnel de l'utilisateur
- Ton bienveillant, encourageant mais honnete
- Reponses concises et actionnables
- Pas de diagnostic medical, orienter vers professionnels si besoin

CONTEXTE UTILISATEUR:
${userContext}

SOURCES DE CONNAISSANCES PERTINENTES:
${context}

Utilise ces informations pour personnaliser ta reponse.`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: query },
  ]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_CHAT_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Chat Error: ${error}`)
  }

  const data = await response.json()
  return {
    answer: data.choices[0].message.content,
    tokensUsed: data.usage?.total_tokens || 0,
  }
}

/**
 * Save message to chat history
 */
async function saveChatMessage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata?: {
    contextUsed?: unknown
    sourcesCited?: string[]
    tokensUsed?: number
    responseTimeMs?: number
  }
): Promise<void> {
  const { error } = await supabase.from('chat_history').insert({
    user_id: userId,
    conversation_id: conversationId,
    role,
    content,
    context_used: metadata?.contextUsed || null,
    sources_cited: metadata?.sourcesCited || [],
    tokens_used: metadata?.tokensUsed || 0,
    response_time_ms: metadata?.responseTimeMs || 0,
  })

  if (error) {
    console.error('Save chat message error:', error)
  }
}

/**
 * Format user context for prompt
 */
function formatUserContext(context?: RAGQueryRequest['userContext']): string {
  if (!context) return 'Aucun contexte utilisateur disponible.'

  const parts: string[] = []

  if (context.profile) {
    const p = context.profile
    parts.push(`Profil: ${p.firstName || 'Utilisateur'}, ${p.age || '?'} ans, ${p.gender || '?'}`)
    if (p.weight) parts.push(`Poids: ${p.weight} kg`)
    if (p.goal) parts.push(`Objectif: ${p.goal}`)
    if (p.allergies && Array.isArray(p.allergies) && p.allergies.length > 0) {
      parts.push(`ALLERGIES: ${p.allergies.join(', ')}`)
    }
  }

  if (context.nutritionToday) {
    const n = context.nutritionToday
    parts.push(`Nutrition aujourd'hui: ${n.calories || 0}/${n.targetCalories || 2000} kcal`)
  }

  if (context.wellness) {
    const w = context.wellness
    if (w.sleepHours) parts.push(`Sommeil: ${w.sleepHours}h`)
    if (w.stressLevel) parts.push(`Stress: ${w.stressLevel}/10`)
    if (w.streak) parts.push(`Streak: ${w.streak} jours`)
  }

  return parts.join('\n') || 'Contexte minimal disponible.'
}

/**
 * Main handler
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startTime = Date.now()

    // Parse request
    const body: RAGQueryRequest = await req.json()
    const {
      query,
      userId,
      conversationId = crypto.randomUUID(),
      userContext,
      options = {},
    } = body

    if (!query || !userId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: query, userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Save user message
    await saveChatMessage(supabase, userId, conversationId, 'user', query)

    // Generate embedding for query
    const embedding = await generateEmbedding(query)

    // Search knowledge base
    const sources = await searchKnowledgeBase(supabase, embedding, {
      category: options.category,
      maxResults: options.maxResults || 5,
      threshold: options.threshold || 0.7,
    })

    // Get conversation history if enabled
    let history: Array<{ role: string; content: string }> = []
    if (options.includeHistory !== false) {
      history = await getConversationHistory(supabase, conversationId, 6)
    }

    // Format context from sources
    const contextText = sources.length > 0
      ? sources.map((s, i) => `[${i + 1}] (${s.source}) ${s.content}`).join('\n\n')
      : 'Aucune source specifique trouvee. Reponse basee sur les connaissances generales.'

    // Format user context
    const userContextText = formatUserContext(userContext)

    // Generate response
    const { answer, tokensUsed } = await generateResponse(
      query,
      contextText,
      userContextText,
      history
    )

    const responseTimeMs = Date.now() - startTime

    // Save assistant response
    await saveChatMessage(supabase, userId, conversationId, 'assistant', answer, {
      contextUsed: { sources: sources.map(s => s.source), userContext },
      sourcesCited: sources.map(s => s.source),
      tokensUsed,
      responseTimeMs,
    })

    // Return response
    const response: RAGQueryResponse = {
      answer,
      sources: sources.map(s => ({
        content: s.content.substring(0, 200) + (s.content.length > 200 ? '...' : ''),
        source: s.source,
        sourceUrl: s.sourceUrl,
        similarity: Math.round(s.similarity * 100) / 100,
      })),
      conversationId,
      tokensUsed,
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('RAG Query Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
