/**
 * Script pour générer les embeddings OpenAI
 * Usage: SUPABASE_URL=xxx SUPABASE_ANON_KEY=xxx OPENAI_API_KEY=xxx node supabase/scripts/generate-embeddings.js
 */

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

async function generateEmbedding(text) {
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
    const error = await response.text()
    throw new Error(`OpenAI Error: ${error}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

async function updateKnowledgeBase() {
  if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
    console.error('Missing environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, OPENAI_API_KEY')
    process.exit(1)
  }

  console.log('Fetching entries without embeddings...')

  // Fetch entries without embeddings
  const response = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?embedding=is.null&select=id,content`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase fetch error: ${await response.text()}`)
  }

  const entries = await response.json()
  console.log(`Found ${entries.length} entries to process`)

  for (const entry of entries) {
    try {
      console.log(`Processing entry ${entry.id}...`)
      const embedding = await generateEmbedding(entry.content)

      // Update entry with embedding
      const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${entry.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ embedding }),
      })

      if (!updateResponse.ok) {
        console.error(`Failed to update entry ${entry.id}:`, await updateResponse.text())
      } else {
        console.log(`Updated entry ${entry.id}`)
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    } catch (error) {
      console.error(`Error processing entry ${entry.id}:`, error.message)
    }
  }

  console.log('Done!')
}

updateKnowledgeBase().catch(console.error)
