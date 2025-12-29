import express from 'express'
import cors from 'cors'
import { Pool } from 'pg'
import OpenAI from 'openai'
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// OpenAI client (lazy init)
let openai: OpenAI | null = null
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openai
}

// ============================================
// Health Check
// ============================================
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    })
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// ============================================
// RAG - Search Knowledge Base
// ============================================
app.post('/api/rag/search', async (req, res) => {
  try {
    const { query, category, limit = 5 } = req.body

    if (!query) {
      return res.status(400).json({ error: 'Query is required' })
    }

    const ai = getOpenAI()
    if (!ai) {
      return res.status(503).json({ error: 'AI service not configured' })
    }

    // Generate embedding for query
    const embeddingResponse = await ai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    })
    const embedding = embeddingResponse.data[0].embedding

    // Search knowledge base
    const result = await pool.query(
      `SELECT * FROM search_knowledge_base($1::vector, 0.7, $2, $3, NULL)`,
      [`[${embedding.join(',')}]`, limit, category || null]
    )

    res.json({ results: result.rows })
  } catch (error) {
    console.error('RAG search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================
// Chat - LymIA Coach
// ============================================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId, conversationId, context } = req.body

    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and userId are required' })
    }

    const ai = getOpenAI()
    if (!ai) {
      return res.status(503).json({ error: 'AI service not configured' })
    }

    // Get RAG context
    const embeddingResponse = await ai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message
    })
    const embedding = embeddingResponse.data[0].embedding

    const ragResult = await pool.query(
      `SELECT content, category, source FROM search_knowledge_base($1::vector, 0.7, 3, NULL, NULL)`,
      [`[${embedding.join(',')}]`]
    )

    const ragContext = ragResult.rows.map(r => r.content).join('\n\n')

    // Build system prompt
    const systemPrompt = `Tu es LymIA, un coach nutrition et bien-être bienveillant et expert.
Tu utilises les recommandations françaises (ANSES, PNNS) et tu parles en français.

Contexte de la base de connaissances:
${ragContext}

Règles:
- Réponds de manière concise et actionnable
- Cite tes sources quand pertinent
- Sois encourageant mais honnête
- Si tu ne sais pas, dis-le`

    // Generate response
    const completion = await ai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...(context?.messages || []),
        { role: 'user', content: message }
      ],
      max_tokens: 500
    })

    const response = completion.choices[0]?.message?.content || ''

    // Save to chat history
    const convId = conversationId || crypto.randomUUID()

    await pool.query(
      `INSERT INTO chat_history (user_id, conversation_id, role, content) VALUES ($1, $2, 'user', $3)`,
      [userId, convId, message]
    )

    await pool.query(
      `INSERT INTO chat_history (user_id, conversation_id, role, content, context_used, tokens_used)
       VALUES ($1, $2, 'assistant', $3, $4, $5)`,
      [userId, convId, response, JSON.stringify(ragResult.rows), completion.usage?.total_tokens || 0]
    )

    res.json({
      response,
      conversationId: convId,
      sources: ragResult.rows.map(r => ({ category: r.category, source: r.source }))
    })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================
// Chat History
// ============================================
app.get('/api/chat/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { limit = 10 } = req.query

    const result = await pool.query(
      `SELECT * FROM get_user_conversations($1, $2)`,
      [userId, Number(limit)]
    )

    res.json({ conversations: result.rows })
  } catch (error) {
    console.error('History error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/chat/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params

    const result = await pool.query(
      `SELECT * FROM get_conversation_messages($1, 50)`,
      [conversationId]
    )

    res.json({ messages: result.rows })
  } catch (error) {
    console.error('Conversation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Lym API running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
})
