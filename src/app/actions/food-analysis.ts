'use server'

import Anthropic from '@anthropic-ai/sdk'

// Types for food analysis
export interface AnalyzedFood {
  name: string
  estimatedWeight: number // in grams
  confidence: number // 0-1
  nutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
    fiber?: number
  }
}

export interface FoodAnalysisResult {
  success: boolean
  foods: AnalyzedFood[]
  totalNutrition: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
  description?: string
  error?: string
}

export interface AIRecipeResult {
  success: boolean
  recipe?: {
    title: string
    description: string
    ingredients: { name: string; amount: string; calories: number }[]
    instructions: string[]
    nutrition: {
      calories: number
      proteins: number
      carbs: number
      fats: number
    }
    prepTime: number
    servings: number
  }
  error?: string
}

// Anthropic client (initialized lazily)
let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured')
    }
    anthropicClient = new Anthropic({ apiKey })
  }
  return anthropicClient
}

/**
 * Analyze a food image using Claude Vision
 */
export async function analyzeFood(imageBase64: string): Promise<FoodAnalysisResult> {
  try {
    const client = getAnthropicClient()

    // Determine media type from base64 header
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
    if (imageBase64.startsWith('data:image/png')) {
      mediaType = 'image/png'
    } else if (imageBase64.startsWith('data:image/webp')) {
      mediaType = 'image/webp'
    }

    // Remove data URL prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: `Analyse cette image de nourriture et identifie tous les aliments visibles.

Pour chaque aliment, estime:
1. Le nom en français
2. Le poids approximatif en grammes
3. Les valeurs nutritionnelles pour ce poids (calories, protéines, glucides, lipides, fibres)
4. Un score de confiance entre 0 et 1

Réponds UNIQUEMENT en JSON avec ce format exact:
{
  "foods": [
    {
      "name": "nom de l'aliment",
      "estimatedWeight": 150,
      "confidence": 0.85,
      "nutrition": {
        "calories": 250,
        "proteins": 12,
        "carbs": 30,
        "fats": 8,
        "fiber": 3
      }
    }
  ],
  "description": "Description courte du repas"
}

Si tu ne vois pas de nourriture, réponds avec un tableau vide et une description expliquant pourquoi.`
            }
          ],
        },
      ],
    })

    // Extract text content from response
    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse AI response')
    }

    const result = JSON.parse(jsonMatch[0])
    const foods: AnalyzedFood[] = result.foods || []

    // Calculate totals
    const totalNutrition = foods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.nutrition.calories,
        proteins: acc.proteins + food.nutrition.proteins,
        carbs: acc.carbs + food.nutrition.carbs,
        fats: acc.fats + food.nutrition.fats,
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    )

    return {
      success: true,
      foods,
      totalNutrition,
      description: result.description,
    }
  } catch (error) {
    console.error('Food analysis error:', error)
    return {
      success: false,
      foods: [],
      totalNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
      error: error instanceof Error ? error.message : 'Erreur lors de l\'analyse',
    }
  }
}

/**
 * Analyze food from voice/text description
 */
export async function analyzeFoodDescription(description: string): Promise<FoodAnalysisResult> {
  try {
    const client = getAnthropicClient()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `L'utilisateur décrit son repas: "${description}"

Identifie tous les aliments mentionnés et estime leurs valeurs nutritionnelles.

Pour chaque aliment:
1. Le nom en français
2. Le poids approximatif en grammes (estime selon les portions typiques)
3. Les valeurs nutritionnelles pour ce poids
4. Un score de confiance entre 0 et 1

Réponds UNIQUEMENT en JSON:
{
  "foods": [
    {
      "name": "nom de l'aliment",
      "estimatedWeight": 150,
      "confidence": 0.85,
      "nutrition": {
        "calories": 250,
        "proteins": 12,
        "carbs": 30,
        "fats": 8,
        "fiber": 3
      }
    }
  ],
  "description": "Résumé du repas analysé"
}`
        }
      ],
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI')
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse AI response')
    }

    const result = JSON.parse(jsonMatch[0])
    const foods: AnalyzedFood[] = result.foods || []

    const totalNutrition = foods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.nutrition.calories,
        proteins: acc.proteins + food.nutrition.proteins,
        carbs: acc.carbs + food.nutrition.carbs,
        fats: acc.fats + food.nutrition.fats,
      }),
      { calories: 0, proteins: 0, carbs: 0, fats: 0 }
    )

    return {
      success: true,
      foods,
      totalNutrition,
      description: result.description,
    }
  } catch (error) {
    console.error('Food description analysis error:', error)
    return {
      success: false,
      foods: [],
      totalNutrition: { calories: 0, proteins: 0, carbs: 0, fats: 0 },
      error: error instanceof Error ? error.message : 'Erreur lors de l\'analyse',
    }
  }
}

/**
 * Generate a recipe based on user preferences
 */
export async function generateRecipe(params: {
  mealType: string
  description?: string
  maxCalories?: number
  dietType?: string
  restrictions?: string[]
}): Promise<AIRecipeResult> {
  try {
    const client = getAnthropicClient()

    const { mealType, description, maxCalories, dietType, restrictions } = params

    let prompt = `Génère une recette pour un ${mealType} français.`

    if (description) {
      prompt += `\n\nL'utilisateur souhaite: ${description}`
    }

    if (maxCalories) {
      prompt += `\n\nLe repas ne doit pas dépasser ${maxCalories} calories.`
    }

    if (dietType) {
      prompt += `\n\nRégime alimentaire: ${dietType}`
    }

    if (restrictions && restrictions.length > 0) {
      prompt += `\n\nRestrictions: ${restrictions.join(', ')}`
    }

    prompt += `\n\nRéponds UNIQUEMENT en JSON avec ce format:
{
  "title": "Nom de la recette",
  "description": "Description courte et appétissante",
  "ingredients": [
    { "name": "ingrédient", "amount": "quantité", "calories": 50 }
  ],
  "instructions": ["étape 1", "étape 2"],
  "nutrition": {
    "calories": 450,
    "proteins": 25,
    "carbs": 40,
    "fats": 15
  },
  "prepTime": 30,
  "servings": 2
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI')
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse AI response')
    }

    const recipe = JSON.parse(jsonMatch[0])

    return {
      success: true,
      recipe,
    }
  } catch (error) {
    console.error('Recipe generation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la génération',
    }
  }
}

/**
 * Lookup product by barcode using Open Food Facts
 */
export async function lookupBarcode(barcode: string): Promise<{
  success: boolean
  product?: {
    name: string
    brand?: string
    imageUrl?: string
    serving: number
    nutrition: {
      calories: number
      proteins: number
      carbs: number
      fats: number
      fiber?: number
      sugar?: number
      sodium?: number
    }
  }
  error?: string
}> {
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    )

    if (!response.ok) {
      throw new Error('Product not found')
    }

    const data = await response.json()

    if (data.status !== 1 || !data.product) {
      return {
        success: false,
        error: 'Produit non trouvé',
      }
    }

    const p = data.product
    const nutriments = p.nutriments || {}

    return {
      success: true,
      product: {
        name: p.product_name_fr || p.product_name || 'Produit inconnu',
        brand: p.brands,
        imageUrl: p.image_front_small_url || p.image_url,
        serving: p.serving_quantity || 100,
        nutrition: {
          calories: Math.round(nutriments['energy-kcal_100g'] || nutriments.energy_100g / 4.184 || 0),
          proteins: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
          carbs: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
          fats: Math.round((nutriments.fat_100g || 0) * 10) / 10,
          fiber: nutriments.fiber_100g ? Math.round(nutriments.fiber_100g * 10) / 10 : undefined,
          sugar: nutriments.sugars_100g ? Math.round(nutriments.sugars_100g * 10) / 10 : undefined,
          sodium: nutriments.sodium_100g ? Math.round(nutriments.sodium_100g * 1000) : undefined,
        },
      },
    }
  } catch (error) {
    console.error('Barcode lookup error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la recherche',
    }
  }
}
