/**
 * Script pour générer les embeddings OpenAI
 * Usage: node supabase/scripts/generate-embeddings.js
 */

const SUPABASE_URL = 'https://ymuwxjidwnkgnrziryrm.supabase.co'
const SUPABASE_KEY = 'sb_publishable_ajR70WwnkVJzhIA45-d9tw_kvOO-Tml'
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

async function getEntriesWithoutEmbeddings() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/knowledge_base?embedding=is.null&select=id,content,category`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Supabase Error: ${await response.text()}`)
  }

  return response.json()
}

async function updateEmbedding(id, embedding) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ embedding }),
    }
  )

  if (!response.ok) {
    throw new Error(`Update Error: ${await response.text()}`)
  }
}

async function main() {
  console.log('=== Génération des embeddings LymIA ===\n')

  try {
    const entries = await getEntriesWithoutEmbeddings()
    console.log(`${entries.length} documents sans embedding\n`)

    if (entries.length === 0) {
      console.log('Tous les documents ont déjà des embeddings!')
      return
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      console.log(`[${i + 1}/${entries.length}] ${entry.category}: ${entry.content.substring(0, 50)}...`)

      try {
        const embedding = await generateEmbedding(entry.content)
        await updateEmbedding(entry.id, embedding)
        console.log(`  ✓ Embedding généré (${embedding.length} dimensions)`)
      } catch (error) {
        console.error(`  ✗ Erreur: ${error.message}`)
      }

      // Pause pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log('\n✓ Terminé!')
  } catch (error) {
    console.error('Erreur:', error.message)
  }
}

main()
