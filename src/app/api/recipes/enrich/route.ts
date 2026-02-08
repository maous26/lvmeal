import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limiter'

// Lazy initialization to avoid build-time errors
let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

interface RecipeToEnrich {
  id: string
  title: string
  description?: string
  ingredients: { name: string; amount: number; unit: string }[]
  instructions?: string[]
  servings: number
  nutrition?: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  } | null
}

interface EnrichedRecipe {
  id: string
  titleFr: string
  descriptionFr: string
  ingredientsFr: { name: string; amount: number; unit: string }[]
  instructionsFr: string[]
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
}

export async function POST(request: NextRequest) {
  // Rate limit AI endpoint
  const clientId = getClientIdentifier(request)
  const rateLimit = checkRateLimit(`ai:${clientId}`, RATE_LIMITS.ai)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    )
  }

  try {
    const { recipe } = await request.json() as { recipe: RecipeToEnrich }

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe data is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured')
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    const needsNutrition = !recipe.nutrition ||
      recipe.nutrition.calories === 0 ||
      recipe.nutrition.proteins === 0

    const ingredientsList = recipe.ingredients
      .map(ing => `${ing.amount} ${ing.unit} ${ing.name}`)
      .join('\n')

    const instructionsList = recipe.instructions?.length
      ? recipe.instructions.join('\n')
      : 'Aucune instruction fournie'

    const prompt = `Tu es un expert en nutrition et en traduction culinaire.

Voici une recette en allemand à enrichir et traduire complètement en français:

**Titre:** ${recipe.title}
**Description:** ${recipe.description || 'Aucune description'}
**Portions:** ${recipe.servings}
**Ingrédients:**
${ingredientsList}
**Instructions:**
${instructionsList}

${needsNutrition ? `Les données nutritionnelles sont manquantes ou incomplètes.` : `Données nutritionnelles existantes: ${JSON.stringify(recipe.nutrition)}`}

Réponds UNIQUEMENT avec un JSON valide (sans markdown, sans \`\`\`) contenant:
{
  "titleFr": "Titre traduit en français (naturel et appétissant)",
  "descriptionFr": "Description traduite en français (2-3 phrases, donne envie)",
  "ingredientsFr": [
    { "name": "nom de l'ingrédient en français", "amount": quantité, "unit": "unité en français" },
    ...
  ],
  "instructionsFr": [
    "Étape 1 en français...",
    "Étape 2 en français...",
    ...
  ],
  "nutrition": {
    "calories": <nombre estimé de kcal par portion>,
    "proteins": <grammes de protéines par portion>,
    "carbs": <grammes de glucides par portion>,
    "fats": <grammes de lipides par portion>
  }
}

Instructions importantes:
- Traduis TOUS les ingrédients en français avec les bonnes unités (g, ml, c. à soupe, etc.)
- ${recipe.instructions?.length ? 'Traduis les instructions en français, étape par étape, de façon claire et détaillée.' : 'Génère des instructions de préparation logiques et détaillées en français basées sur le titre et les ingrédients (4-8 étapes).'}
- ${needsNutrition ? 'Estime les valeurs nutritionnelles par portion.' : 'Garde les valeurs nutritionnelles si correctes.'}

Réponds UNIQUEMENT avec le JSON, rien d'autre.`

    const openai = getOpenAI()
    if (!openai) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    const responseText = completion.choices[0]?.message?.content || ''

    // Parse the JSON response
    let enrichedData: Omit<EnrichedRecipe, 'id'>
    try {
      // Clean up potential markdown formatting
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      enrichedData = JSON.parse(cleanJson)
    } catch {
      console.error('Failed to parse AI response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    const enrichedRecipe: EnrichedRecipe = {
      id: recipe.id,
      titleFr: enrichedData.titleFr,
      descriptionFr: enrichedData.descriptionFr,
      ingredientsFr: enrichedData.ingredientsFr || recipe.ingredients,
      instructionsFr: enrichedData.instructionsFr || [],
      nutrition: enrichedData.nutrition,
    }

    return NextResponse.json({ recipe: enrichedRecipe })
  } catch (error) {
    console.error('Recipe enrichment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Batch enrichment for multiple recipes
export async function PUT(request: NextRequest) {
  // Rate limit AI endpoint
  const clientId = getClientIdentifier(request)
  const rateLimit = checkRateLimit(`ai:${clientId}`, RATE_LIMITS.ai)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    )
  }

  try {
    const { recipes } = await request.json() as { recipes: RecipeToEnrich[] }

    if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
      return NextResponse.json(
        { error: 'Recipes array is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    // Limit batch size to avoid timeout (reduced to 3 for more complete enrichment)
    const batch = recipes.slice(0, 3)

    const recipesInfo = batch.map((r, i) => {
      const needsNutrition = !r.nutrition || r.nutrition.calories === 0
      const ingredientsList = r.ingredients
        .map(ing => `${ing.amount} ${ing.unit} ${ing.name}`)
        .join(', ')
      const instructionsList = r.instructions?.length
        ? r.instructions.join(' | ')
        : 'Aucune'

      return `
[Recette ${i + 1}]
ID: ${r.id}
Titre: ${r.title}
Description: ${r.description || 'Aucune'}
Portions: ${r.servings}
Ingrédients: ${ingredientsList}
Instructions: ${instructionsList}
Nutrition existante: ${needsNutrition ? 'MANQUANTE' : JSON.stringify(r.nutrition)}`
    }).join('\n\n')

    const prompt = `Tu es un expert en nutrition et traduction culinaire.

Voici ${batch.length} recettes en allemand à enrichir et traduire COMPLÈTEMENT en français:

${recipesInfo}

Réponds UNIQUEMENT avec un JSON valide (sans markdown) contenant un tableau:
[
  {
    "id": "id_de_la_recette",
    "titleFr": "Titre en français",
    "descriptionFr": "Description appétissante en français (2-3 phrases)",
    "ingredientsFr": [
      { "name": "ingrédient en français", "amount": quantité, "unit": "unité" },
      ...
    ],
    "instructionsFr": [
      "Étape 1...",
      "Étape 2...",
      ...
    ],
    "nutrition": { "calories": X, "proteins": X, "carbs": X, "fats": X }
  },
  ...
]

Pour chaque recette:
- Traduis le titre et la description en français
- Traduis TOUS les ingrédients en français avec les bonnes unités
- Traduis ou génère 4-8 étapes de préparation claires et détaillées en français
- Estime ou corrige les valeurs nutritionnelles par portion

Important: Réponds UNIQUEMENT avec le JSON, rien d'autre.`

    const openai = getOpenAI()
    if (!openai) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    const responseText = completion.choices[0]?.message?.content || ''

    let enrichedRecipes: EnrichedRecipe[]
    try {
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      enrichedRecipes = JSON.parse(cleanJson)
    } catch {
      console.error('Failed to parse batch AI response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    return NextResponse.json({ recipes: enrichedRecipes })
  } catch (error) {
    console.error('Batch enrichment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
