#!/usr/bin/env npx ts-node
/**
 * Migration des images de recettes vers Cloudflare R2
 *
 * Ce script :
 * 1. Lit toutes les recettes depuis enriched-recipes.json
 * 2. Télécharge chaque image depuis lecker.de
 * 3. Upload sur Cloudflare R2
 * 4. Met à jour les URLs dans enriched-recipes.json
 *
 * Usage:
 *   cd mobile && npx ts-node scripts/migrate-images-to-r2.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { fileURLToPath } from 'url'

// ESM compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env file
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=["']?(.+?)["']?$/)
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2]
      }
    }
  }
}

// R2 Configuration
const R2_ACCOUNT_ID = process.env.EXPO_PUBLIC_R2_ACCOUNT_ID || ''
const R2_ACCESS_KEY_ID = process.env.EXPO_PUBLIC_R2_ACCESS_KEY_ID || ''
const R2_SECRET_ACCESS_KEY = process.env.EXPO_PUBLIC_R2_SECRET_ACCESS_KEY || ''
const R2_BUCKET_NAME = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || 'lym-photos'
const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL || ''

// R2 endpoint
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

// File paths
const RECIPES_FILE = path.join(__dirname, '..', 'src', 'data', 'enriched-recipes.json')

// Types
interface EnrichedRecipe {
  id: string
  titleFr: string
  imageUrl?: string
  [key: string]: unknown
}

interface RecipesData {
  version: string
  generatedAt: string
  totalRecipes: number
  recipes: EnrichedRecipe[]
}

/**
 * Generate AWS Signature V4 for R2 API
 */
function signRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  payload: Buffer | string,
  region = 'auto'
): Record<string, string> {
  const service = 's3'
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  // Create canonical request
  const canonicalUri = path
  const canonicalQuerystring = ''

  const payloadHash = crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex')

  headers['x-amz-date'] = amzDate
  headers['x-amz-content-sha256'] = payloadHash

  const sortedHeaders = Object.keys(headers).sort()
  const canonicalHeaders = sortedHeaders
    .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
    .join('\n') + '\n'
  const signedHeaders = sortedHeaders.map(key => key.toLowerCase()).join(';')

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  // Calculate signature
  const getSignatureKey = (key: string, date: string, region: string, service: string) => {
    const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(date).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest()
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()
    return kSigning
  }

  const signingKey = getSignatureKey(R2_SECRET_ACCESS_KEY, dateStamp, region, service)
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  // Create authorization header
  const authorization = `${algorithm} Credential=${R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return {
    ...headers,
    Authorization: authorization,
  }
}

/**
 * Upload file to R2
 */
async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<string> {
  const path = `/${R2_BUCKET_NAME}/${key}`
  const url = `${R2_ENDPOINT}${path}`

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Content-Length': data.length.toString(),
    'Host': `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  }

  const signedHeaders = signRequest('PUT', path, headers, data)

  const response = await fetch(url, {
    method: 'PUT',
    headers: signedHeaders,
    body: new Uint8Array(data),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`R2 upload failed: ${response.status} - ${errorText}`)
  }

  // Return public URL
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`
  }
  // Without public URL, return the R2 path (you'll need to enable public access)
  return `https://pub-${R2_ACCOUNT_ID}.r2.dev/${key}`
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LYM Recipe Bot/1.0)',
      },
    })

    if (!response.ok) {
      console.warn(`  ⚠️  Failed to download: ${response.status}`)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()
    const data = Buffer.from(arrayBuffer)

    return { data, contentType }
  } catch (error) {
    console.warn(`  ⚠️  Download error: ${error}`)
    return null
  }
}

/**
 * Generate a unique filename from URL
 */
function generateFilename(url: string, recipeId: string): string {
  // Extract extension from URL or default to jpg
  const urlMatch = url.match(/\.(jpg|jpeg|png|gif|webp)/i)
  const ext = urlMatch ? urlMatch[1].toLowerCase() : 'jpg'

  // Create a hash of the URL for uniqueness
  const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 8)

  // Clean recipe ID for filename
  const cleanId = recipeId
    .replace(/https?:\/\//g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 50)

  return `recipes/${cleanId}_${hash}.${ext}`
}

/**
 * Check if image already exists on R2
 */
async function checkImageExists(key: string): Promise<boolean> {
  const path = `/${R2_BUCKET_NAME}/${key}`
  const url = `${R2_ENDPOINT}${path}`

  const headers: Record<string, string> = {
    'Host': `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  }

  const signedHeaders = signRequest('HEAD', path, headers, '')

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: signedHeaders,
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🖼️  Migration des images de recettes vers Cloudflare R2')
  console.log('========================================================\n')

  // Verify config
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error('❌ Configuration R2 manquante dans .env')
    console.error('   Requis: EXPO_PUBLIC_R2_ACCOUNT_ID, EXPO_PUBLIC_R2_ACCESS_KEY_ID, EXPO_PUBLIC_R2_SECRET_ACCESS_KEY')
    process.exit(1)
  }

  console.log(`📦 Bucket: ${R2_BUCKET_NAME}`)
  console.log(`🌐 Endpoint: ${R2_ENDPOINT}\n`)

  // Load recipes
  if (!fs.existsSync(RECIPES_FILE)) {
    console.error(`❌ Fichier recettes non trouvé: ${RECIPES_FILE}`)
    process.exit(1)
  }

  const recipesData: RecipesData = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf-8'))
  console.log(`📋 ${recipesData.recipes.length} recettes chargées\n`)

  // Filter recipes with external images (not already on R2)
  const recipesToMigrate = recipesData.recipes.filter(r =>
    r.imageUrl &&
    !r.imageUrl.includes('r2.dev') &&
    !r.imageUrl.includes('cloudflare')
  )

  console.log(`🔄 ${recipesToMigrate.length} images à migrer\n`)

  if (recipesToMigrate.length === 0) {
    console.log('✅ Toutes les images sont déjà sur R2!')
    process.exit(0)
  }

  // Migration stats
  let migrated = 0
  let skipped = 0
  let failed = 0

  // Process in batches
  const batchSize = 5
  for (let i = 0; i < recipesToMigrate.length; i += batchSize) {
    const batch = recipesToMigrate.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(recipesToMigrate.length / batchSize)

    console.log(`\n📦 Batch ${batchNum}/${totalBatches}`)

    await Promise.all(batch.map(async (recipe) => {
      const originalUrl = recipe.imageUrl!
      const filename = generateFilename(originalUrl, recipe.id)

      process.stdout.write(`  🖼️  ${recipe.titleFr.slice(0, 40)}... `)

      // Check if already migrated
      const exists = await checkImageExists(filename)
      if (exists) {
        const newUrl = R2_PUBLIC_URL
          ? `${R2_PUBLIC_URL}/${filename}`
          : `https://pub-${R2_ACCOUNT_ID}.r2.dev/${filename}`
        recipe.imageUrl = newUrl
        console.log('⏭️  existe déjà')
        skipped++
        return
      }

      // Download image
      const imageData = await downloadImage(originalUrl)
      if (!imageData) {
        console.log('❌ échec téléchargement')
        failed++
        return
      }

      // Upload to R2
      try {
        const newUrl = await uploadToR2(filename, imageData.data, imageData.contentType)
        recipe.imageUrl = newUrl
        console.log(`✅ ${(imageData.data.length / 1024).toFixed(0)}KB`)
        migrated++
      } catch (error) {
        console.log(`❌ échec upload: ${error}`)
        failed++
      }
    }))

    // Small delay between batches
    if (i + batchSize < recipesToMigrate.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // Save updated recipes
  console.log('\n\n💾 Sauvegarde des recettes mises à jour...')
  recipesData.generatedAt = new Date().toISOString()
  fs.writeFileSync(RECIPES_FILE, JSON.stringify(recipesData, null, 2), 'utf-8')

  // Summary
  console.log('\n\n📊 RÉSUMÉ')
  console.log('=========')
  console.log(`✅ Migrées:  ${migrated}`)
  console.log(`⏭️  Existantes: ${skipped}`)
  console.log(`❌ Échouées: ${failed}`)
  console.log(`📋 Total:    ${recipesToMigrate.length}`)

  if (failed > 0) {
    console.log('\n⚠️  Certaines images n\'ont pas pu être migrées.')
    console.log('   Relancez le script pour réessayer.')
  }

  console.log('\n✅ Migration terminée!')
  console.log(`\n💡 Note: Assurez-vous que l'accès public est activé sur le bucket R2`)
  console.log(`   Dashboard Cloudflare > R2 > ${R2_BUCKET_NAME} > Settings > Public Access`)
}

main().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
