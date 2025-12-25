import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Save an external recipe to the database
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }

    const data = await request.json()

    const {
      title,
      titleOriginal,
      description,
      image,
      prepTime,
      cookTime,
      servings,
      difficulty,
      ingredients,
      instructions,
      nutrition,
      sourceUrl,
      sourceName,
    } = data

    // Check if recipe already exists with same source URL
    if (sourceUrl) {
      const existingRecipe = await prisma.recipe.findFirst({
        where: { videoUrl: sourceUrl },
      })

      if (existingRecipe) {
        return NextResponse.json({ recipe: existingRecipe })
      }
    }

    // Create the recipe
    const recipe = await prisma.recipe.create({
      data: {
        title: title || titleOriginal || 'Sans titre',
        description: description || '',
        imageUrl: image || null,
        prepTime: prepTime || 30,
        cookTime: cookTime || null,
        servings: servings || 4,
        difficulty: difficulty || 'medium',
        calories: nutrition?.calories || 0,
        proteins: nutrition?.proteins || 0,
        carbs: nutrition?.carbs || 0,
        fats: nutrition?.fats || 0,
        ingredients: JSON.stringify(ingredients || []),
        instructions: JSON.stringify(instructions || []),
        tags: JSON.stringify([]),
        source: 'external',
        generatedBy: sourceName || 'gustar.io',
        videoUrl: sourceUrl || null,
        status: 'approved',
      },
    })

    return NextResponse.json({ recipe })
  } catch (error) {
    console.error('Error saving external recipe:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// Get a saved external recipe by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID requis' },
        { status: 400 }
      )
    }

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ratings: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recette non trouvée' },
        { status: 404 }
      )
    }

    return NextResponse.json({ recipe })
  } catch (error) {
    console.error('Error fetching recipe:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
