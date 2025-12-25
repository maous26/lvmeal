import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params {
  params: Promise<{ id: string }>
}

// Rate a recipe
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      )
    }

    const { id: recipeId } = await params
    const { rating, comment, cooked } = await request.json()

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Note invalide (1-5)' },
        { status: 400 }
      )
    }

    // Check if recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
    })

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recette non trouvée' },
        { status: 404 }
      )
    }

    // Create or update rating
    const existingRating = await prisma.recipeRating.findUnique({
      where: {
        recipeId_userId: {
          recipeId,
          userId: session.user.id,
        },
      },
    })

    let recipeRating

    if (existingRating) {
      recipeRating = await prisma.recipeRating.update({
        where: { id: existingRating.id },
        data: {
          rating,
          comment: comment || null,
          cooked: cooked ?? existingRating.cooked,
        },
      })
    } else {
      recipeRating = await prisma.recipeRating.create({
        data: {
          recipeId,
          userId: session.user.id,
          rating,
          comment: comment || null,
          cooked: cooked ?? false,
        },
      })
    }

    // Update recipe average rating
    const allRatings = await prisma.recipeRating.findMany({
      where: { recipeId },
      select: { rating: true },
    })

    const averageRating =
      allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length

    await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        averageRating: Math.round(averageRating * 10) / 10,
        ratingsCount: allRatings.length,
      },
    })

    return NextResponse.json({
      rating: recipeRating,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingsCount: allRatings.length,
    })
  } catch (error) {
    console.error('Error rating recipe:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// Get ratings for a recipe
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: recipeId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    const ratings = await prisma.recipeRating.findMany({
      where: { recipeId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ ratings })
  } catch (error) {
    console.error('Error fetching ratings:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
