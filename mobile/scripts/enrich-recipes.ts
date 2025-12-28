#!/usr/bin/env npx ts-node
/**
 * Pre-Enrichment Script for Production Database
 *
 * Fetches recipes from Gustar API, enriches them with OpenAI (French translation + full details),
 * and saves to a JSON file that can be bundled with the app.
 *
 * Usage:
 *   npm run enrich-recipes
 *
 * Output:
 *   src/data/enriched-recipes.json
 */

import * as fs from 'fs'
import * as path from 'path'
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
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=')
      if (key && value && !process.env[key]) {
        process.env[key] = value
      }
    }
  }
}

// Configuration
const OPENAI_API_KEY: string = process.env.OPENAI_API_KEY || process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''
const RAPIDAPI_KEY: string = process.env.RAPIDAPI_KEY || process.env.EXPO_PUBLIC_RAPIDAPI_KEY || ''
const RAPIDAPI_HOST = 'gustar-io-deutsche-rezepte.p.rapidapi.com'
const BASE_URL = `https://${RAPIDAPI_HOST}`

// Maximum recipes to enrich per run (to control costs and time)
const MAX_RECIPES = 100

// Meal type categories with German search terms
const MEAL_TYPE_SEARCHES: Record<string, string[]> = {
  // Petit-dejeuner / Breakfast
  breakfast: [
    'frühstück',      // breakfast
    'müsli',          // muesli
    'haferflocken',   // oatmeal
    'pfannkuchen',    // pancakes
    'smoothie',       // smoothie
    'joghurt',        // yogurt
    'eier frühstück', // eggs breakfast
    'toast',          // toast
    'porridge',       // porridge
    'omelett',        // omelet
  ],
  // Dejeuner / Lunch
  lunch: [
    'salat',          // salad
    'sandwich',       // sandwich
    'wrap',           // wrap
    'bowl',           // bowl
    'quiche',         // quiche
    'suppe mittag',   // lunch soup
    'pasta salat',    // pasta salad
    'baguette',       // baguette
    'falafel',        // falafel
    'buddha bowl',    // buddha bowl
  ],
  // Collation / Snack
  snack: [
    'snack',          // snack
    'nüsse',          // nuts
    'energy balls',   // energy balls
    'riegel',         // bars
    'smoothie bowl',  // smoothie bowl
    'hummus',         // hummus
    'chips',          // chips (healthy)
    'müsliriegel',    // granola bar
    'obst snack',     // fruit snack
    'nachtisch',      // dessert/snack
  ],
  // Diner / Dinner
  dinner: [
    'huhn',           // chicken
    'lachs',          // salmon
    'rindfleisch',    // beef
    'fisch',          // fish
    'tofu',           // tofu
    'curry',          // curry
    'pasta',          // pasta
    'risotto',        // risotto
    'eintopf',        // stew
    'braten',         // roast
    'auflauf',        // casserole
    'grill',          // grill
    'suppe abend',    // dinner soup
    'schnitzel',      // schnitzel
    'wok',            // wok/stir-fry
  ],
}

// Get all search terms flattened
const ALL_SEARCH_TERMS = Object.values(MEAL_TYPE_SEARCHES).flat()

// Map to track which meal type each recipe belongs to
const recipeToMealType = new Map<string, string>()

// Types
interface GustarIngredient {
  name: string
  amount: number
  unit: string
}

interface GustarRecipe {
  id: string
  title: string
  description?: string
  image?: string
  prepTime?: number
  cookTime?: number
  servings?: number
  difficulty?: string
  ingredients: GustarIngredient[]
  instructions: string[]
  nutrition?: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
  sourceUrl?: string
}

interface EnrichedRecipe {
  id: string
  // French content
  titleFr: string
  descriptionFr: string
  ingredientsFr: Array<{ name: string; amount: number; unit: string }>
  instructionsFr: string[]
  // Nutrition per serving
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
  // Metadata
  imageUrl?: string
  prepTime: number
  cookTime?: number
  totalTime: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  source: string
  sourceUrl?: string
  // Original data (for reference)
  originalTitle: string
  // Timestamps
  enrichedAt: string
}

// Helper: Fetch from Gustar API
async function fetchGustarRecipes(query: string, limit: number = 5): Promise<GustarRecipe[]> {
  const url = `${BASE_URL}/search_api?text=${encodeURIComponent(query)}&limit=${limit}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Host': RAPIDAPI_HOST,
        'X-RapidAPI-Key': RAPIDAPI_KEY,
      },
    })

    if (!response.ok) {
      console.warn(`Gustar API error for "${query}": ${response.status}`)
      return []
    }

    const data = await response.json()
    const recipes = Array.isArray(data) ? data : []

    return recipes.map((item: Record<string, unknown>) => {
      const imageUrls = item.image_urls as string[] | undefined
      const totalTimeSeconds = item.totalTime as number | undefined

      return {
        id: String(item.id || item._id || item.source || Math.random().toString(36).slice(2)),
        title: String(item.title || item.name || 'Untitled'),
        description: item.keywords as string | undefined,
        image: imageUrls?.[0],
        prepTime: totalTimeSeconds ? Math.round(totalTimeSeconds / 60) : undefined,
        servings: item.portions as number | undefined,
        difficulty: item.difficulty as string | undefined,
        ingredients: transformIngredients(item.ingredients),
        instructions: transformInstructions(item.instructions || item.steps),
        nutrition: item.nutrition ? {
          calories: Number((item.nutrition as Record<string, unknown>).calories || 0),
          proteins: Number((item.nutrition as Record<string, unknown>).proteins || 0),
          carbs: Number((item.nutrition as Record<string, unknown>).carbs || 0),
          fats: Number((item.nutrition as Record<string, unknown>).fats || 0),
        } : undefined,
        sourceUrl: item.source as string | undefined,
      }
    })
  } catch (error) {
    console.error(`Error fetching recipes for "${query}":`, error)
    return []
  }
}

function transformIngredients(ingredients: unknown): GustarIngredient[] {
  if (!Array.isArray(ingredients)) return []
  return ingredients.map((ing: unknown) => {
    if (typeof ing === 'string') {
      return { name: ing, amount: 1, unit: '' }
    }
    const i = ing as Record<string, unknown>
    return {
      name: String(i.name || i.ingredient || ''),
      amount: Number(i.amount || i.quantity || 1),
      unit: String(i.unit || ''),
    }
  })
}

function transformInstructions(instructions: unknown): string[] {
  if (!instructions) return []
  if (typeof instructions === 'string') return [instructions]
  if (Array.isArray(instructions)) {
    return instructions.map((step: unknown) =>
      typeof step === 'string' ? step : String((step as Record<string, unknown>).text || step)
    )
  }
  return []
}

// Helper: Enrich recipe with OpenAI
async function enrichRecipeWithAI(recipe: GustarRecipe, mealType: string): Promise<EnrichedRecipe | null> {
  if (!OPENAI_API_KEY) {
    console.error('No OpenAI API key provided')
    return null
  }

  const ingredientsList = recipe.ingredients
    .map(ing => `${ing.amount} ${ing.unit} ${ing.name}`.trim())
    .join('\n')

  const instructionsList = recipe.instructions.length > 0
    ? recipe.instructions.join('\n')
    : 'Aucune instruction fournie'

  const needsNutrition = !recipe.nutrition || recipe.nutrition.calories === 0

  const prompt = `Tu es un chef cuisinier et nutritionniste francais expert.

Voici une recette allemande a traduire et enrichir completement en francais:

**Titre:** ${recipe.title}
**Description:** ${recipe.description || 'Aucune description'}
**Portions:** ${recipe.servings || 2}
**Ingredients:**
${ingredientsList || 'Non specifies'}
**Instructions:**
${instructionsList}
${recipe.nutrition ? `**Nutrition existante:** ${JSON.stringify(recipe.nutrition)}` : ''}

Reponds UNIQUEMENT avec un JSON valide (sans markdown, sans \`\`\`) contenant:
{
  "titleFr": "Titre traduit en francais (naturel, appetissant, comme dans un livre de cuisine francais)",
  "descriptionFr": "Description en francais (2-3 phrases qui donnent envie de cuisiner ce plat)",
  "ingredientsFr": [
    { "name": "nom en francais", "amount": quantite_numerique, "unit": "unite en francais (g, ml, c. a soupe, etc.)" }
  ],
  "instructionsFr": [
    "Etape 1: ...",
    "Etape 2: ...",
    "Etape 3: ...",
    "Etape 4: ...",
    "Etape 5: ..."
  ],
  "nutrition": {
    "calories": ${needsNutrition ? 'estimation_kcal' : recipe.nutrition?.calories || 300},
    "proteins": ${needsNutrition ? 'estimation_g' : recipe.nutrition?.proteins || 20},
    "carbs": ${needsNutrition ? 'estimation_g' : recipe.nutrition?.carbs || 30},
    "fats": ${needsNutrition ? 'estimation_g' : recipe.nutrition?.fats || 15}
  },
  "difficulty": "easy" ou "medium" ou "hard",
  "prepTime": nombre_en_minutes
}

REGLES IMPORTANTES:
1. Traduis TOUS les ingredients en francais avec des unites francaises standard
2. ${recipe.instructions.length > 0 ? 'Traduis et ameliore les instructions existantes' : 'Genere 5-8 etapes de preparation detaillees et claires basees sur le titre et les ingredients'}
3. Les instructions doivent etre pratiques, precises et faciles a suivre
4. ${needsNutrition ? 'Estime les valeurs nutritionnelles par portion' : 'Garde les valeurs nutritionnelles existantes'}
5. Evalue la difficulte realiste de la recette

Reponds UNIQUEMENT avec le JSON, rien d'autre.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error(`OpenAI error for "${recipe.title}":`, error)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error(`No response for "${recipe.title}"`)
      return null
    }

    // Parse JSON response
    const cleanJson = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const enriched = JSON.parse(cleanJson)

    const prepTime = enriched.prepTime || recipe.prepTime || 20
    const cookTime = recipe.cookTime || Math.round(prepTime * 0.5)

    return {
      id: recipe.id,
      titleFr: enriched.titleFr,
      descriptionFr: enriched.descriptionFr,
      ingredientsFr: enriched.ingredientsFr || [],
      instructionsFr: enriched.instructionsFr || [],
      nutrition: enriched.nutrition,
      imageUrl: recipe.image,
      prepTime,
      cookTime,
      totalTime: prepTime + cookTime,
      servings: recipe.servings || 2,
      difficulty: enriched.difficulty || 'medium',
      mealType: mealType as 'breakfast' | 'lunch' | 'snack' | 'dinner',
      source: 'Gustar.io',
      sourceUrl: recipe.sourceUrl,
      originalTitle: recipe.title,
      enrichedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error(`Error enriching "${recipe.title}":`, error)
    return null
  }
}

// Main function
async function main() {
  console.log('=== Recipe Pre-Enrichment Script ===\n')

  if (!OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY environment variable is required')
    console.log('Usage: OPENAI_API_KEY=sk-xxx npx ts-node scripts/enrich-recipes.ts')
    process.exit(1)
  }

  console.log('Step 1: Fetching recipes from Gustar API for all meal types...\n')

  const allRecipes: GustarRecipe[] = []
  const seenIds = new Set<string>()

  // Track recipes per meal type for balanced distribution
  const recipesPerMealType: Record<string, number> = {
    breakfast: 0,
    lunch: 0,
    snack: 0,
    dinner: 0,
  }

  // Target recipes per meal type (balanced distribution)
  const targetPerMealType = Math.ceil(MAX_RECIPES / 4)

  // Fetch recipes for each meal type
  for (const [mealType, searchTerms] of Object.entries(MEAL_TYPE_SEARCHES)) {
    console.log(`\n📋 ${mealType.toUpperCase()} recipes:`)

    for (const term of searchTerms) {
      // Skip if we already have enough for this meal type
      if (recipesPerMealType[mealType] >= targetPerMealType) {
        break
      }

      console.log(`  Searching: "${term}"...`)
      const recipes = await fetchGustarRecipes(term, 5)

      // Add unique recipes only
      for (const recipe of recipes) {
        if (!seenIds.has(recipe.id) && recipesPerMealType[mealType] < targetPerMealType) {
          seenIds.add(recipe.id)
          allRecipes.push(recipe)
          recipeToMealType.set(recipe.id, mealType)
          recipesPerMealType[mealType]++
        }
      }

      console.log(`    Found ${recipes.length} recipes (${mealType}: ${recipesPerMealType[mealType]}/${targetPerMealType})`)

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  // Summary of fetched recipes
  console.log(`\n=== Fetch Summary ===`)
  console.log(`  Breakfast: ${recipesPerMealType.breakfast} recipes`)
  console.log(`  Lunch:     ${recipesPerMealType.lunch} recipes`)
  console.log(`  Snack:     ${recipesPerMealType.snack} recipes`)
  console.log(`  Dinner:    ${recipesPerMealType.dinner} recipes`)
  console.log(`  TOTAL:     ${allRecipes.length} unique recipes\n`)

  // Limit to MAX_RECIPES
  const recipesToEnrich = allRecipes.slice(0, MAX_RECIPES)
  console.log(`Recipes to enrich: ${recipesToEnrich.length}\n`)

  if (recipesToEnrich.length === 0) {
    console.error('No recipes fetched. Check your RapidAPI key.')
    process.exit(1)
  }

  console.log('Step 2: Enriching recipes with OpenAI...\n')

  const enrichedRecipes: EnrichedRecipe[] = []
  const batchSize = 3

  for (let i = 0; i < recipesToEnrich.length; i += batchSize) {
    const batch = recipesToEnrich.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(recipesToEnrich.length / batchSize)

    console.log(`  Batch ${batchNum}/${totalBatches}: Enriching ${batch.length} recipes...`)

    const results = await Promise.all(
      batch.map(recipe => {
        const mealType = recipeToMealType.get(recipe.id) || 'dinner'
        return enrichRecipeWithAI(recipe, mealType)
      })
    )

    for (const result of results) {
      if (result) {
        enrichedRecipes.push(result)
        console.log(`    ✓ [${result.mealType}] ${result.titleFr}`)
      } else {
        console.log(`    ✗ Failed`)
      }
    }

    // Delay between batches to avoid rate limiting
    if (i + batchSize < allRecipes.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log(`\nEnriched ${enrichedRecipes.length}/${allRecipes.length} recipes\n`)

  if (enrichedRecipes.length === 0) {
    console.error('No recipes were enriched. Check your OpenAI key.')
    process.exit(1)
  }

  // Step 3: Save to JSON file
  console.log('Step 3: Saving to JSON file...\n')

  const outputDir = path.join(__dirname, '..', 'src', 'data')
  const outputFile = path.join(outputDir, 'enriched-recipes.json')

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const output = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalRecipes: enrichedRecipes.length,
    recipes: enrichedRecipes,
  }

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf-8')

  console.log(`✓ Saved ${enrichedRecipes.length} enriched recipes to:`)
  console.log(`  ${outputFile}\n`)

  // Count enriched recipes per meal type
  const enrichedPerMealType: Record<string, number> = {
    breakfast: 0,
    lunch: 0,
    snack: 0,
    dinner: 0,
  }
  for (const recipe of enrichedRecipes) {
    enrichedPerMealType[recipe.mealType]++
  }

  // Print summary
  console.log('=== Summary ===')
  console.log(`  Total fetched:  ${allRecipes.length}`)
  console.log(`  Total enriched: ${enrichedRecipes.length}`)
  console.log(`  Success rate:   ${Math.round((enrichedRecipes.length / allRecipes.length) * 100)}%`)
  console.log('\n  Enriched by meal type:')
  console.log(`    🌅 Breakfast: ${enrichedPerMealType.breakfast}`)
  console.log(`    ☀️ Lunch:     ${enrichedPerMealType.lunch}`)
  console.log(`    🍎 Snack:     ${enrichedPerMealType.snack}`)
  console.log(`    🌙 Dinner:    ${enrichedPerMealType.dinner}`)

  // Sample recipe from each meal type
  console.log('\n=== Sample Recipes by Meal Type ===')
  for (const mealType of ['breakfast', 'lunch', 'snack', 'dinner']) {
    const sample = enrichedRecipes.find(r => r.mealType === mealType)
    if (sample) {
      const emoji = { breakfast: '🌅', lunch: '☀️', snack: '🍎', dinner: '🌙' }[mealType]
      console.log(`\n  ${emoji} ${mealType.toUpperCase()}: ${sample.titleFr}`)
      console.log(`     ${sample.nutrition.calories} kcal | ${sample.nutrition.proteins}g protein | ${sample.instructionsFr.length} steps`)
    }
  }
}

main().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
