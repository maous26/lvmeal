/**
 * Sync Enriched Recipes to Railway PostgreSQL
 *
 * This script runs automatically on deployment to sync
 * enriched recipes from the JSON file to the database.
 *
 * Usage: npx ts-node scripts/sync-recipes-to-db.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to enriched recipes JSON
const RECIPES_FILE = path.join(__dirname, '..', 'mobile', 'src', 'data', 'enriched-recipes.json')

interface EnrichedRecipe {
  id: string
  titleFr: string
  descriptionFr: string
  ingredientsFr: Array<{ name: string; amount: number; unit: string }>
  instructionsFr: string[]
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
    sugar?: number
    fiber?: number
    saturatedFat?: number
    sodium?: number
  }
  healthScore?: number
  healthNotes?: string
  imageUrl?: string
  prepTime: number
  cookTime?: number
  totalTime: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  source: string
  sourceUrl?: string
  originalTitle: string
  enrichedAt: string
}

interface RecipesData {
  version: string
  generatedAt: string
  totalRecipes: number
  recipes: EnrichedRecipe[]
}

async function syncRecipesToDatabase() {
  console.log('🔄 Starting recipe sync to Railway PostgreSQL...\n')

  // Check if recipes file exists
  if (!fs.existsSync(RECIPES_FILE)) {
    console.log('⚠️  No enriched recipes file found at:', RECIPES_FILE)
    console.log('   Run the enrich-recipes script first: npm run enrich-recipes')
    return
  }

  // Load recipes from JSON
  const data: RecipesData = JSON.parse(fs.readFileSync(RECIPES_FILE, 'utf-8'))
  console.log(`📦 Loaded ${data.recipes.length} recipes from JSON (v${data.version})`)

  // Get existing recipes from database
  const existingRecipes = await prisma.recipe.findMany({
    where: { source: 'gustar' },
    select: { externalId: true },
  })
  const existingIds = new Set(existingRecipes.map((r) => r.externalId))
  console.log(`📊 Found ${existingRecipes.length} existing Gustar recipes in database`)

  // Filter new recipes
  const newRecipes = data.recipes.filter((r) => !existingIds.has(r.id))
  console.log(`✨ ${newRecipes.length} new recipes to sync\n`)

  if (newRecipes.length === 0) {
    console.log('✅ Database is already up to date!')
    return
  }

  // Sync new recipes
  let successCount = 0
  let errorCount = 0

  for (const recipe of newRecipes) {
    try {
      await prisma.recipe.create({
        data: {
          title: recipe.titleFr,
          description: recipe.descriptionFr,
          imageUrl: recipe.imageUrl,
          servings: recipe.servings,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime || 0,
          totalTime: recipe.totalTime,
          difficulty: recipe.difficulty,
          instructions: recipe.instructionsFr,
          caloriesPerServing: recipe.nutrition.calories,
          proteinsPerServing: recipe.nutrition.proteins,
          carbsPerServing: recipe.nutrition.carbs,
          fatsPerServing: recipe.nutrition.fats,
          fiberPerServing: recipe.nutrition.fiber,
          tags: [recipe.mealType, `health-score-${recipe.healthScore || 70}`],
          cuisineType: 'international',
          dietTypes: [],
          allergens: [],
          source: 'gustar',
          sourceUrl: recipe.sourceUrl,
          externalId: recipe.id,
          rating: recipe.healthScore ? recipe.healthScore / 20 : 3.5, // Convert 0-100 to 0-5 stars
          ingredients: {
            create: recipe.ingredientsFr
              .filter((ing) => typeof ing.amount === 'number' && !isNaN(ing.amount))
              .map((ing) => ({
                name: ing.name,
                quantity: ing.amount,
                unit: ing.unit,
              })),
          },
        },
      })
      successCount++
      process.stdout.write(`\r  Synced: ${successCount}/${newRecipes.length}`)
    } catch (error) {
      errorCount++
      console.error(`\n  ❌ Error syncing "${recipe.titleFr}":`, error)
    }
  }

  console.log(`\n\n✅ Sync complete!`)
  console.log(`   Success: ${successCount}`)
  console.log(`   Errors:  ${errorCount}`)
  console.log(`   Total in DB: ${existingRecipes.length + successCount}`)
}

async function main() {
  try {
    await syncRecipesToDatabase()
  } catch (error) {
    console.error('❌ Sync failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
