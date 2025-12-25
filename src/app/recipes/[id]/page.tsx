'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Clock,
  Users,
  ChefHat,
  Heart,
  Share2,
  Plus,
  Check,
  Flame,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ProgressBar } from '@/components/ui/progress-bar'
import { cn, formatNumber } from '@/lib/utils'
import { getRecipeById } from '@/lib/mock-recipes'
import type { Recipe } from '@/types'

export default function RecipeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const recipeId = params.id as string

  const [recipe, setRecipe] = React.useState<Recipe | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isFavorite, setIsFavorite] = React.useState(false)
  const [servings, setServings] = React.useState(2)
  const [checkedIngredients, setCheckedIngredients] = React.useState<string[]>([])
  const [expandedInstructions, setExpandedInstructions] = React.useState(true)

  React.useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const foundRecipe = getRecipeById(recipeId)
      if (foundRecipe) {
        setRecipe(foundRecipe)
        setServings(foundRecipe.servings)
      }
      setIsLoading(false)
    }, 300)
  }, [recipeId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  if (!recipe) {
    return (
      <>
        <Header title="Recette introuvable" showBack backHref="/recipes" />
        <PageContainer>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-6xl mb-4">🍽️</span>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Recette non trouvée
            </h2>
            <p className="text-[var(--text-secondary)] mb-6">
              Cette recette n'existe pas ou a été supprimée.
            </p>
            <Button onClick={() => router.push('/recipes')}>
              Voir toutes les recettes
            </Button>
          </div>
        </PageContainer>
      </>
    )
  }

  const servingMultiplier = servings / recipe.servings
  const adjustedNutrition = {
    calories: Math.round(recipe.nutritionPerServing.calories * servingMultiplier),
    proteins: Math.round(recipe.nutritionPerServing.proteins * servingMultiplier),
    carbs: Math.round(recipe.nutritionPerServing.carbs * servingMultiplier),
    fats: Math.round(recipe.nutritionPerServing.fats * servingMultiplier),
  }

  const difficultyLabel = {
    easy: 'Facile',
    medium: 'Moyen',
    hard: 'Difficile',
  }

  const toggleIngredient = (id: string) => {
    setCheckedIngredients((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const addToMealPlan = () => {
    // TODO: Implement add to meal plan
    router.push('/meals/add?type=lunch&recipe=' + recipe.id)
  }

  return (
    <>
      <Header
        title={recipe.title}
        showBack
        backHref="/recipes"
        rightContent={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsFavorite(!isFavorite)}
            >
              <Heart
                className={cn(
                  'h-5 w-5',
                  isFavorite ? 'fill-[var(--error)] text-[var(--error)]' : ''
                )}
              />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        }
      />

      <PageContainer className="pb-24">
        {/* Hero image placeholder */}
        <div className="relative h-48 -mx-4 -mt-4 mb-4 bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 flex items-center justify-center">
          <span className="text-6xl">🍽️</span>
          {/* Rating badge */}
          {recipe.rating && (
            <div className="absolute bottom-4 right-4 flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--bg-primary)]/90 backdrop-blur-sm">
              <span className="text-[var(--warning)]">★</span>
              <span className="text-sm font-semibold">{recipe.rating}</span>
              <span className="text-xs text-[var(--text-tertiary)]">({recipe.ratingCount})</span>
            </div>
          )}
        </div>

        {/* Title and description */}
        <Section>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            {recipe.title}
          </h1>
          {recipe.description && (
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {recipe.description}
            </p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="secondary" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        </Section>

        {/* Quick info */}
        <Section>
          <div className="grid grid-cols-4 gap-3">
            <Card padding="sm" className="text-center">
              <Clock className="h-5 w-5 mx-auto mb-1 text-[var(--accent-primary)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">{recipe.totalTime}</p>
              <p className="text-xs text-[var(--text-tertiary)]">minutes</p>
            </Card>
            <Card padding="sm" className="text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-[var(--accent-primary)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">{recipe.servings}</p>
              <p className="text-xs text-[var(--text-tertiary)]">portions</p>
            </Card>
            <Card padding="sm" className="text-center">
              <ChefHat className="h-5 w-5 mx-auto mb-1 text-[var(--accent-primary)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">{difficultyLabel[recipe.difficulty]}</p>
              <p className="text-xs text-[var(--text-tertiary)]">niveau</p>
            </Card>
            <Card padding="sm" className="text-center">
              <Flame className="h-5 w-5 mx-auto mb-1 text-[var(--calories)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">{recipe.nutritionPerServing.calories}</p>
              <p className="text-xs text-[var(--text-tertiary)]">kcal/part</p>
            </Card>
          </div>
        </Section>

        {/* Nutrition per serving */}
        <Section title="Valeurs nutritionnelles">
          <Card padding="default">
            {/* Serving adjuster */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[var(--text-secondary)]">Portions</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setServings(Math.max(1, servings - 1))}
                  className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center"
                >
                  <span className="text-lg">−</span>
                </button>
                <span className="w-6 text-center font-semibold tabular-nums">{servings}</span>
                <button
                  onClick={() => setServings(servings + 1)}
                  className="w-8 h-8 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center"
                >
                  <span className="text-lg">+</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--text-secondary)]">Calories</span>
                  <span className="font-semibold text-[var(--calories)]">{adjustedNutrition.calories} kcal</span>
                </div>
                <ProgressBar value={adjustedNutrition.calories} max={800} color="var(--calories)" size="sm" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--text-secondary)]">Protéines</span>
                  <span className="font-semibold text-[var(--proteins)]">{adjustedNutrition.proteins}g</span>
                </div>
                <ProgressBar value={adjustedNutrition.proteins} max={50} color="var(--proteins)" size="sm" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--text-secondary)]">Glucides</span>
                  <span className="font-semibold text-[var(--carbs)]">{adjustedNutrition.carbs}g</span>
                </div>
                <ProgressBar value={adjustedNutrition.carbs} max={100} color="var(--carbs)" size="sm" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[var(--text-secondary)]">Lipides</span>
                  <span className="font-semibold text-[var(--fats)]">{adjustedNutrition.fats}g</span>
                </div>
                <ProgressBar value={adjustedNutrition.fats} max={50} color="var(--fats)" size="sm" />
              </div>
            </div>
          </Card>
        </Section>

        {/* Ingredients */}
        <Section title={`Ingrédients (${recipe.ingredients.length})`}>
          <Card padding="none">
            {recipe.ingredients.map((ingredient, index) => {
              const isChecked = checkedIngredients.includes(ingredient.id)
              const adjustedQuantity = Math.round(ingredient.quantity * servingMultiplier * 10) / 10

              return (
                <motion.button
                  key={ingredient.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  onClick={() => toggleIngredient(ingredient.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 text-left transition-colors',
                    'border-b border-[var(--border-light)] last:border-b-0',
                    isChecked ? 'bg-[var(--success)]/5' : 'hover:bg-[var(--bg-secondary)]'
                  )}
                >
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      isChecked
                        ? 'border-[var(--success)] bg-[var(--success)]'
                        : 'border-[var(--border-default)]'
                    )}
                  >
                    {isChecked && <Check className="h-4 w-4 text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'font-medium',
                        isChecked
                          ? 'text-[var(--text-tertiary)] line-through'
                          : 'text-[var(--text-primary)]'
                      )}
                    >
                      {ingredient.name}
                    </p>
                    {ingredient.preparation && (
                      <p className="text-sm text-[var(--text-tertiary)]">
                        {ingredient.preparation}
                      </p>
                    )}
                  </div>

                  <span
                    className={cn(
                      'text-sm font-medium tabular-nums',
                      isChecked ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]'
                    )}
                  >
                    {adjustedQuantity} {ingredient.unit}
                  </span>
                </motion.button>
              )
            })}
          </Card>

          <Button variant="outline" className="w-full mt-3">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Ajouter à la liste de courses
          </Button>
        </Section>

        {/* Instructions */}
        <Section>
          <button
            onClick={() => setExpandedInstructions(!expandedInstructions)}
            className="w-full flex items-center justify-between py-2"
          >
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Préparation ({recipe.instructions.length} étapes)
            </h2>
            {expandedInstructions ? (
              <ChevronUp className="h-5 w-5 text-[var(--text-tertiary)]" />
            ) : (
              <ChevronDown className="h-5 w-5 text-[var(--text-tertiary)]" />
            )}
          </button>

          {expandedInstructions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="space-y-4 mt-2"
            >
              {recipe.instructions.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
                    <span className="text-sm font-semibold text-[var(--accent-primary)]">
                      {index + 1}
                    </span>
                  </div>
                  <p className="flex-1 text-[var(--text-secondary)] leading-relaxed pt-1">
                    {step}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </Section>

        {/* Allergens */}
        {recipe.allergens.length > 0 && (
          <Section title="Allergènes">
            <div className="flex flex-wrap gap-2">
              {recipe.allergens.map((allergen) => (
                <Badge key={allergen} variant="warning" size="sm">
                  {allergen}
                </Badge>
              ))}
            </div>
          </Section>
        )}
      </PageContainer>

      {/* Fixed bottom action */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 p-4 bg-[var(--bg-primary)] border-t border-[var(--border-light)] safe-area-inset"
      >
        <Button variant="default" size="lg" className="w-full" onClick={addToMealPlan}>
          <Plus className="h-5 w-5 mr-2" />
          Ajouter au journal
        </Button>
      </motion.div>
    </>
  )
}
