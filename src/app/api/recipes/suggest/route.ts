import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Lazy initialization to avoid build-time errors
let openai: OpenAI | null = null

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openai
}

interface UserProfile {
  firstName?: string
  gender?: string
  age?: number
  weight?: number
  height?: number
  targetWeight?: number
  activityLevel?: string
  goal?: string
  dietType?: string
  allergies?: string[]
  intolerances?: string[]
  dislikedFoods?: string[]
  likedFoods?: string[]
  cookingSkillLevel?: string
  cookingTimeWeekday?: number
  cookingTimeWeekend?: number
  preferredCuisines?: string[]
  nutritionalNeeds?: {
    calories: number
    proteins: number
    carbs: number
    fats: number
  }
}

interface NutritionConsumed {
  calories: number
  proteins: number
  carbs: number
  fats: number
}

interface SuggestRequest {
  profile: UserProfile
  mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner'
  consumed: NutritionConsumed
  date: string
}

const mealTypeLabels: Record<string, string> = {
  breakfast: 'petit-déjeuner',
  lunch: 'déjeuner',
  snack: 'collation',
  dinner: 'dîner',
}

export async function POST(request: NextRequest) {
  try {
    const { profile, mealType, consumed, date } = await request.json() as SuggestRequest

    // Calculate remaining calories and macros
    const targets = profile.nutritionalNeeds || {
      calories: 2000,
      proteins: 100,
      carbs: 250,
      fats: 70,
    }

    const remaining = {
      calories: Math.max(0, targets.calories - consumed.calories),
      proteins: Math.max(0, targets.proteins - consumed.proteins),
      carbs: Math.max(0, targets.carbs - consumed.carbs),
      fats: Math.max(0, targets.fats - consumed.fats),
    }

    // Estimate portion for this meal type
    const mealPortions: Record<string, number> = {
      breakfast: 0.25,
      lunch: 0.35,
      snack: 0.10,
      dinner: 0.30,
    }

    const mealPortion = mealPortions[mealType] || 0.25
    const targetForMeal = {
      calories: Math.round(Math.min(remaining.calories, targets.calories * mealPortion)),
      proteins: Math.round(Math.min(remaining.proteins, targets.proteins * mealPortion)),
      carbs: Math.round(Math.min(remaining.carbs, targets.carbs * mealPortion)),
      fats: Math.round(Math.min(remaining.fats, targets.fats * mealPortion)),
    }

    // Check if weekend
    const dayOfWeek = new Date(date).getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const cookingTime = isWeekend
      ? (profile.cookingTimeWeekend || 45)
      : (profile.cookingTimeWeekday || 20)

    // Build constraints
    const constraints: string[] = []

    if (profile.dietType && profile.dietType !== 'omnivore') {
      constraints.push(`Régime: ${profile.dietType}`)
    }

    if (profile.allergies?.length) {
      constraints.push(`Allergies (EXCLURE): ${profile.allergies.join(', ')}`)
    }

    if (profile.intolerances?.length) {
      constraints.push(`Intolérances (EXCLURE): ${profile.intolerances.join(', ')}`)
    }

    if (profile.dislikedFoods?.length) {
      constraints.push(`Aliments à éviter: ${profile.dislikedFoods.join(', ')}`)
    }

    if (profile.likedFoods?.length) {
      constraints.push(`Aliments préférés (à privilégier): ${profile.likedFoods.join(', ')}`)
    }

    if (profile.preferredCuisines?.length) {
      constraints.push(`Cuisines préférées: ${profile.preferredCuisines.join(', ')}`)
    }

    const goalLabels: Record<string, string> = {
      weight_loss: 'perte de poids (privilégier protéines, réduire glucides)',
      muscle_gain: 'prise de muscle (protéines élevées)',
      maintenance: 'maintien du poids',
      health: 'santé générale (équilibré)',
      energy: 'énergie (glucides complexes)',
    }

    const skillLabels: Record<string, string> = {
      beginner: 'débutant (recettes simples, peu d\'ingrédients)',
      intermediate: 'intermédiaire',
      advanced: 'avancé (peut gérer des recettes complexes)',
    }

    const prompt = `Tu es un nutritionniste expert et chef cuisinier.

Je dois trouver une recette pour le ${mealTypeLabels[mealType]} de l'utilisateur.

**Profil utilisateur:**
- Objectif: ${goalLabels[profile.goal || 'health'] || 'équilibré'}
- Niveau en cuisine: ${skillLabels[profile.cookingSkillLevel || 'intermediate'] || 'intermédiaire'}
- Temps de préparation disponible: ${cookingTime} minutes max

${constraints.length > 0 ? `**Contraintes alimentaires:**\n${constraints.map(c => `- ${c}`).join('\n')}` : ''}

**Budget calorique pour ce repas:**
- Calories: environ ${targetForMeal.calories} kcal
- Protéines: environ ${targetForMeal.proteins}g
- Glucides: environ ${targetForMeal.carbs}g
- Lipides: environ ${targetForMeal.fats}g

**Solde restant pour la journée:**
- Calories restantes: ${remaining.calories} kcal
- Protéines restantes: ${remaining.proteins}g

Propose UNE recette parfaitement adaptée. Réponds UNIQUEMENT avec un JSON valide (sans markdown):

{
  "id": "suggest-${Date.now()}",
  "title": "Titre de la recette en français",
  "description": "Description appétissante (2-3 phrases)",
  "prepTime": <minutes de préparation>,
  "cookTime": <minutes de cuisson>,
  "servings": <nombre de portions>,
  "difficulty": "easy|medium|hard",
  "ingredients": [
    { "name": "ingrédient", "amount": quantité, "unit": "unité" },
    ...
  ],
  "instructions": [
    "Étape 1...",
    "Étape 2...",
    ...
  ],
  "nutrition": {
    "calories": <kcal par portion>,
    "proteins": <g par portion>,
    "carbs": <g par portion>,
    "fats": <g par portion>
  },
  "tags": ["tag1", "tag2", ...],
  "whyThisRecipe": "Explication courte pourquoi cette recette est parfaite pour l'utilisateur"
}

La recette DOIT:
1. Respecter le budget calorique indiqué (${targetForMeal.calories} kcal ± 50)
2. Respecter toutes les contraintes alimentaires
3. Être réalisable en ${cookingTime} minutes max
4. Être adaptée au niveau ${profile.cookingSkillLevel || 'intermediate'}
5. Avoir des valeurs nutritionnelles réalistes et précises`

    const client = getOpenAI()
    if (!client) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    const responseText = completion.choices[0]?.message?.content || ''

    let recipe
    try {
      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      recipe = JSON.parse(cleanJson)
    } catch {
      console.error('Failed to parse AI response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse recipe' },
        { status: 500 }
      )
    }

    // Add metadata
    recipe.source = 'ai'
    recipe.sourceName = 'Présence IA'
    recipe.isEnriched = true
    recipe.image = null

    return NextResponse.json({
      recipe,
      context: {
        mealType,
        targetNutrition: targetForMeal,
        remainingNutrition: remaining,
        constraints,
      }
    })
  } catch (error) {
    console.error('Recipe suggestion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
