'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Clock, ChefHat, Star, Plus, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'

interface Recipe {
  id: string
  title: string
  imageUrl?: string
  calories: number
  prepTime: number
  difficulty: 'easy' | 'medium' | 'hard'
  rating?: number
  tags?: string[]
}

interface RecipeSuggestionsProps {
  recipes: Recipe[]
  title?: string
  subtitle?: string
  onSeeAll?: () => void
  onAddToMeal?: (recipeId: string) => void
  className?: string
}

const difficultyLabels = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
}

export function RecipeSuggestions({
  recipes,
  title = 'Suggestions pour vous',
  subtitle,
  onSeeAll,
  onAddToMeal,
  className,
}: RecipeSuggestionsProps) {
  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-sm text-[var(--accent-primary)] font-medium flex items-center hover:underline"
          >
            Tout voir
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Horizontal scroll container */}
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {recipes.map((recipe, index) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            index={index}
            onAddToMeal={onAddToMeal}
          />
        ))}
      </div>
    </div>
  )
}

interface RecipeCardProps {
  recipe: Recipe
  index: number
  onAddToMeal?: (recipeId: string) => void
}

function RecipeCard({ recipe, index, onAddToMeal }: RecipeCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex-shrink-0 w-64"
    >
      <Card className="overflow-hidden" padding="none" interactive>
        <Link href={`/recipes/${recipe.id}`}>
          {/* Image */}
          <div className="relative h-36 bg-[var(--bg-secondary)]">
            {recipe.imageUrl ? (
              <Image
                src={recipe.imageUrl}
                alt={recipe.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <ChefHat className="h-10 w-10 text-[var(--text-muted)]" />
              </div>
            )}

            {/* Rating badge */}
            {recipe.rating && (
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm">
                <Star className="h-3 w-3 text-[#FFB347] fill-[#FFB347]" />
                <span className="text-xs font-medium">{recipe.rating.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            <h4 className="font-medium text-[var(--text-primary)] line-clamp-2 mb-2">
              {recipe.title}
            </h4>

            {/* Meta */}
            <div className="flex items-center gap-3 text-sm text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {recipe.prepTime} min
              </span>
              <span>{formatNumber(recipe.calories)} kcal</span>
            </div>

            {/* Tags */}
            {recipe.tags && recipe.tags.length > 0 && (
              <div className="flex gap-1 mt-3">
                <Badge variant="secondary" size="sm">
                  {difficultyLabels[recipe.difficulty]}
                </Badge>
                {recipe.tags.slice(0, 1).map((tag) => (
                  <Badge key={tag} variant="outline" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Link>

        {/* Add button */}
        {onAddToMeal && (
          <div className="px-4 pb-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.preventDefault()
                onAddToMeal(recipe.id)
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter au repas
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

// Featured recipe variant - larger card
interface FeaturedRecipeProps {
  recipe: Recipe
  onAddToMeal?: () => void
  className?: string
}

export function FeaturedRecipe({ recipe, onAddToMeal, className }: FeaturedRecipeProps) {
  return (
    <Card className={cn('overflow-hidden', className)} padding="none">
      <Link href={`/recipes/${recipe.id}`} className="block">
        <div className="relative h-48 bg-[var(--bg-secondary)]">
          {recipe.imageUrl ? (
            <Image
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ChefHat className="h-12 w-12 text-[var(--text-muted)]" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h3 className="text-lg font-semibold mb-1">{recipe.title}</h3>
            <div className="flex items-center gap-4 text-sm text-white/80">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {recipe.prepTime} min
              </span>
              <span>{formatNumber(recipe.calories)} kcal</span>
              {recipe.rating && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-[#FFB347] text-[#FFB347]" />
                  {recipe.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {onAddToMeal && (
        <div className="p-4 pt-3">
          <Button variant="default" className="w-full" onClick={onAddToMeal}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter à mon repas
          </Button>
        </div>
      )}
    </Card>
  )
}
