/**
 * Script d'ingestion des embeddings
 *
 * Genere les embeddings OpenAI pour les documents de la knowledge base
 * et les insere dans Supabase avec pgvector.
 *
 * Usage:
 * npx ts-node supabase/scripts/ingest-embeddings.ts
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

const EMBEDDING_MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 10

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

interface KnowledgeEntry {
  id: string
  content: string
  category: string
  source: string
}

/**
 * Generate embedding for a single text
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  })
  return response.data[0].embedding
}

/**
 * Generate embeddings for multiple texts in batch
 */
async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  })
  return response.data.map(d => d.embedding)
}

/**
 * Get entries without embeddings
 */
async function getEntriesWithoutEmbeddings(): Promise<KnowledgeEntry[]> {
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id, content, category, source')
    .is('embedding', null)

  if (error) {
    throw new Error(`Error fetching entries: ${error.message}`)
  }

  return data || []
}

/**
 * Update entry with embedding
 */
async function updateEmbedding(id: string, embedding: number[]): Promise<void> {
  const { error } = await supabase
    .from('knowledge_base')
    .update({ embedding })
    .eq('id', id)

  if (error) {
    throw new Error(`Error updating embedding for ${id}: ${error.message}`)
  }
}

/**
 * Process entries in batches
 */
async function processEntries(entries: KnowledgeEntry[]): Promise<void> {
  console.log(`Processing ${entries.length} entries...`)

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)}`)

    try {
      const texts = batch.map(e => e.content)
      const embeddings = await generateEmbeddingsBatch(texts)

      for (let j = 0; j < batch.length; j++) {
        await updateEmbedding(batch[j].id, embeddings[j])
        console.log(`  ✓ ${batch[j].category}/${batch[j].source}: ${batch[j].content.substring(0, 50)}...`)
      }
    } catch (error) {
      console.error(`Error processing batch:`, error)
    }

    // Rate limiting pause
    await new Promise(resolve => setTimeout(resolve, 500))
  }
}

/**
 * Add a new document to the knowledge base
 */
async function addDocument(doc: {
  content: string
  category: string
  source: string
  sourceUrl?: string
  sourceTitle?: string
  metadata?: Record<string, unknown>
}): Promise<string> {
  // Generate embedding
  const embedding = await generateEmbedding(doc.content)

  // Insert with embedding
  const { data, error } = await supabase
    .from('knowledge_base')
    .insert({
      content: doc.content,
      category: doc.category,
      source: doc.source,
      source_url: doc.sourceUrl,
      source_title: doc.sourceTitle,
      metadata: doc.metadata || {},
      embedding,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`Error adding document: ${error.message}`)
  }

  return data.id
}

/**
 * Main function
 */
async function main() {
  console.log('=== LymIA Knowledge Base Embedding Ingestion ===\n')

  // Check configuration
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
    process.exit(1)
  }

  if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY must be set')
    process.exit(1)
  }

  console.log(`Supabase URL: ${SUPABASE_URL}`)
  console.log(`OpenAI Model: ${EMBEDDING_MODEL}\n`)

  try {
    // Get entries without embeddings
    const entries = await getEntriesWithoutEmbeddings()

    if (entries.length === 0) {
      console.log('All entries already have embeddings!')
      return
    }

    console.log(`Found ${entries.length} entries without embeddings\n`)

    // Process entries
    await processEntries(entries)

    console.log('\n✓ Embedding ingestion complete!')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

// Export for use as module
export { addDocument, generateEmbedding }

// Run if called directly
main()
