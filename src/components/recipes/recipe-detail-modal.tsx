'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Clock,
  Users,
  ChefHat,
  Star,
  Flame,
  Dumbbell,
  ExternalLink,
  Plus,
  Check,
  Calendar,
  ChevronDown,
  Heart,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/utils'
import { useRecipesStore, type FavoriteRecipe } from '@/stores/recipes-store'
import type { Recipe } from '@/hooks/use-recipes-search'

interface RecipeDetailModalProps {
  recipe: Recipe | null
  isOpen: boolean
  onClose: () => void
  onAddToMeal?: (recipe: Recipe, mealType: string, date: string) => void
}

const mealTypes = [
  { id: 'breakfast', label: 'Petit-déjeuner', icon: '🌅' },
  { id: 'lunch', label: 'Déjeuner', icon: '☀️' },
  { id: 'snack', label: 'Collation', icon: '🍎' },
  { id: 'dinner', label: 'Dîner', icon: '🌙' },
]

const difficultyLabels = {
  easy: { label: 'Facile', color: 'var(--success)' },
  medium: { label: 'Moyen', color: 'var(--warning)' },
  hard: { label: 'Difficile', color: 'var(--error)' },
}

// Generate next 7 days for date picker
function getNextDays(count: number) {
  const days = []
  const today = new Date()
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

  for (let i = 0; i < count; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    days.push({
      date: date.toISOString().split('T')[0],
      dayName: i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : dayNames[date.getDay()],
      dayNumber: date.getDate(),
    })
  }
  return days
}

export function RecipeDetailModal({
  recipe,
  isOpen,
  onClose,
  onAddToMeal,
}: RecipeDetailModalProps) {
  const [userRating, setUserRating] = React.useState(0)
  const [showAddToMeal, setShowAddToMeal] = React.useState(false)
  const [selectedMealType, setSelectedMealType] = React.useState('lunch')
  const [selectedDate, setSelectedDate] = React.useState(
    new Date().toISOString().split('T')[0]
  )
  const [isAdding, setIsAdding] = React.useState(false)
  const [expandedIngredients, setExpandedIngredients] = React.useState(true)
  const [expandedInstructions, setExpandedInstructions] = React.useState(false)
  const [enrichedRecipe, setEnrichedRecipe] = React.useState<Recipe | null>(null)
  const [isEnrichingRecipe, setIsEnrichingRecipe] = React.useState(false)

  const { addToFavorites, removeFromFavorites, isFavorite } = useRecipesStore()

  const days = React.useMemo(() => getNextDays(7), [])

  // Enrich recipe when modal opens if not already enriched
  React.useEffect(() => {
    async function enrichIfNeeded() {
      if (!recipe || !isOpen) {
        setEnrichedRecipe(null)
        return
      }

      // If already enriched, use as-is
      if (recipe.isEnriched) {
        setEnrichedRecipe(recipe)
        return
      }

      // Check if we have nutrition and instructions - if not, enrich
      const needsEnrichment = !recipe.nutrition?.calories ||
        !recipe.instructions?.length ||
        recipe.instructions.length === 0

      if (!needsEnrichment) {
        setEnrichedRecipe(recipe)
        return
      }

      setIsEnrichingRecipe(true)
      try {
        const response = await fetch('/api/recipes/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe }),
        })

        if (response.ok) {
          const data = await response.json()
          const enriched = data.recipe
          setEnrichedRecipe({
            ...recipe,
            title: enriched.titleFr || recipe.title,
            description: enriched.descriptionFr || recipe.description,
            ingredients: enriched.ingredientsFr || recipe.ingredients,
            instructions: enriched.instructionsFr || recipe.instructions,
            nutrition: enriched.nutrition || recipe.nutrition,
            isEnriched: true,
          })
        } else {
          setEnrichedRecipe(recipe)
        }
      } catch (err) {
        console.error('Failed to enrich recipe:', err)
        setEnrichedRecipe(recipe)
      } finally {
        setIsEnrichingRecipe(false)
      }
    }

    enrichIfNeeded()
  }, [recipe, isOpen])

  // Use enriched recipe or original
  const displayRecipe = enrichedRecipe || recipe

  // Check if this recipe is in favorites
  const recipeIsFavorite = displayRecipe ? isFavorite(displayRecipe.id) : false

  // Convert external recipe to FavoriteRecipe format
  const convertToFavorite = (r: Recipe): Omit<FavoriteRecipe, 'addedAt'> => ({
    id: r.id,
    title: r.title,
    description: r.description,
    imageUrl: r.image,
    prepTime: r.prepTime || 0,
    cookTime: r.cookTime || 0,
    totalTime: (r.prepTime || 0) + (r.cookTime || 0),
    servings: r.servings || 2,
    difficulty: r.difficulty || 'medium',
    nutrition: {
      calories: r.nutrition?.calories || 0,
      proteins: r.nutrition?.proteins || 0,
      carbs: r.nutrition?.carbs || 0,
      fats: r.nutrition?.fats || 0,
    },
    ingredients: (r.ingredients || []).map((ing, idx) => ({
      id: `ing-${idx}`,
      name: ing.name,
      quantity: typeof ing.amount === 'number' ? ing.amount : parseFloat(ing.amount) || 1,
      unit: ing.unit || '',
    })),
    instructions: r.instructions || [],
    tags: r.tags || [],
    allergens: r.allergens || [],
    source: 'gustar',
    sourceUrl: r.sourceUrl,
    externalId: r.id,
    rating: r.rating,
    ratingCount: r.ratingCount,
  })

  const handleToggleFavorite = () => {
    if (!displayRecipe) return

    if (recipeIsFavorite) {
      removeFromFavorites(displayRecipe.id)
    } else {
      addToFavorites(convertToFavorite(displayRecipe))
    }
  }

  const handleRate = async (rating: number) => {
    setUserRating(rating)
    // TODO: Save rating to API
    // await fetch(`/api/recipes/${recipe?.id}/rate`, {
    //   method: 'POST',
    //   body: JSON.stringify({ rating }),
    // })
  }

  const handleAddToMeal = async () => {
    if (!displayRecipe) return

    setIsAdding(true)
    try {
      if (onAddToMeal) {
        onAddToMeal(displayRecipe, selectedMealType, selectedDate)
      }
      setShowAddToMeal(false)
      onClose()
    } finally {
      setIsAdding(false)
    }
  }

  if (!displayRecipe) return null

  const difficulty = difficultyLabels[displayRecipe.difficulty]
  const totalTime = (displayRecipe.prepTime || 0) + (displayRecipe.cookTime || 0)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-hidden rounded-t-3xl bg-[var(--bg-primary)]"
          >
            {/* Handle */}
            <div className="sticky top-0 z-10 flex justify-center py-2 bg-[var(--bg-primary)]">
              <div className="w-10 h-1 rounded-full bg-[var(--border-default)]" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-4 p-2 rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors z-20"
            >
              <X className="h-5 w-5 text-[var(--text-secondary)]" />
            </button>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-60px)] pb-safe">
              {/* Loading overlay when enriching */}
              {isEnrichingRecipe && (
                <div className="absolute inset-0 bg-[var(--bg-primary)]/80 backdrop-blur-sm z-30 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
                    <p className="text-sm text-[var(--text-secondary)]">Traduction en cours...</p>
                  </div>
                </div>
              )}

              {/* Image */}
              <div className="relative h-48 bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20">
                {displayRecipe.image ? (
                  <Image
                    src={displayRecipe.image}
                    alt={displayRecipe.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ChefHat className="h-16 w-16 text-[var(--accent-primary)]/50" />
                  </div>
                )}

                {/* Source badge */}
                {displayRecipe.sourceUrl && (
                  <a
                    href={displayRecipe.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {displayRecipe.sourceName || 'Source'}
                  </a>
                )}
              </div>

              <div className="px-4 py-4 space-y-5">
                {/* Title & description */}
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
                    {displayRecipe.title}
                  </h2>
                  {displayRecipe.description && (
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                      {displayRecipe.description}
                    </p>
                  )}
                </div>

                {/* Quick info */}
                <div className="flex items-center gap-4 flex-wrap">
                  {totalTime > 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                      <Clock className="h-4 w-4 text-[var(--accent-primary)]" />
                      <span>{totalTime} min</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                    <Users className="h-4 w-4 text-[var(--accent-primary)]" />
                    <span>{displayRecipe.servings} pers.</span>
                  </div>
                  <Badge
                    variant="outline"
                    size="sm"
                    style={{ borderColor: difficulty.color, color: difficulty.color }}
                  >
                    {difficulty.label}
                  </Badge>
                </div>

                {/* Nutrition */}
                <Card padding="sm" className="bg-[var(--bg-secondary)]">
                  {displayRecipe.nutrition && displayRecipe.nutrition.calories > 0 ? (
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div>
                        <Flame className="h-4 w-4 mx-auto mb-1 text-[var(--calories)]" />
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {formatNumber(displayRecipe.nutrition.calories)}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">kcal</p>
                      </div>
                      <div>
                        <Dumbbell className="h-4 w-4 mx-auto mb-1 text-[var(--proteins)]" />
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {displayRecipe.nutrition.proteins}g
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">prot.</p>
                      </div>
                      <div>
                        <div className="h-4 w-4 mx-auto mb-1 rounded-full bg-[var(--carbs)]" />
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {displayRecipe.nutrition.carbs}g
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">gluc.</p>
                      </div>
                      <div>
                        <div className="h-4 w-4 mx-auto mb-1 rounded-full bg-[var(--fats)]" />
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {displayRecipe.nutrition.fats}g
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">lip.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-2">
                      {isEnrichingRecipe ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-primary)]" />
                          <span className="text-sm text-[var(--text-secondary)]">Calcul des macros...</span>
                        </>
                      ) : (
                        <span className="text-sm text-[var(--text-tertiary)]">Macros non disponibles</span>
                      )}
                    </div>
                  )}
                </Card>

                {/* User Rating */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">
                    Notez cette recette
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(star)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-6 w-6 transition-colors ${
                            star <= userRating
                              ? 'fill-[#FFB347] text-[#FFB347]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ingredients */}
                {displayRecipe.ingredients && displayRecipe.ingredients.length > 0 && (
                  <div>
                    <button
                      onClick={() => setExpandedIngredients(!expandedIngredients)}
                      className="w-full flex items-center justify-between py-2"
                    >
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        Ingrédients ({displayRecipe.ingredients.length})
                      </h3>
                      <ChevronDown
                        className={`h-5 w-5 text-[var(--text-tertiary)] transition-transform ${
                          expandedIngredients ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {expandedIngredients && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="space-y-2 mt-2"
                      >
                        {displayRecipe.ingredients.map((ing, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
                          >
                            <span className="text-[var(--accent-primary)]">•</span>
                            <span>
                              {ing.amount} {ing.unit} {ing.name}
                            </span>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </div>
                )}

                {/* Instructions */}
                {displayRecipe.instructions && displayRecipe.instructions.length > 0 && (
                  <div>
                    <button
                      onClick={() => setExpandedInstructions(!expandedInstructions)}
                      className="w-full flex items-center justify-between py-2"
                    >
                      <h3 className="font-semibold text-[var(--text-primary)]">
                        Préparation ({displayRecipe.instructions.length} étapes)
                      </h3>
                      <ChevronDown
                        className={`h-5 w-5 text-[var(--text-tertiary)] transition-transform ${
                          expandedInstructions ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {expandedInstructions && (
                      <motion.ol
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="space-y-4 mt-2"
                      >
                        {displayRecipe.instructions.map((step, idx) => (
                          <li key={idx} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-sm font-semibold text-[var(--accent-primary)]">
                              {idx + 1}
                            </span>
                            <p className="text-sm text-[var(--text-secondary)] leading-relaxed pt-0.5">
                              {step}
                            </p>
                          </li>
                        ))}
                      </motion.ol>
                    )}
                  </div>
                )}

                {/* Add to Meal Section */}
                <AnimatePresence>
                  {showAddToMeal && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <Card padding="default" className="bg-[var(--bg-secondary)]">
                        {/* Date picker */}
                        <div className="mb-4">
                          <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">
                            <Calendar className="h-4 w-4 inline mr-1" />
                            Choisir le jour
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {days.map((day) => (
                              <button
                                key={day.date}
                                onClick={() => setSelectedDate(day.date)}
                                className={`flex-shrink-0 px-3 py-2 rounded-xl text-center transition-all ${
                                  selectedDate === day.date
                                    ? 'bg-[var(--accent-primary)] text-white'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                }`}
                              >
                                <p className="text-xs">{day.dayName}</p>
                                <p className="text-lg font-semibold">{day.dayNumber}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Meal type picker */}
                        <div>
                          <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">
                            Choisir le repas
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {mealTypes.map((meal) => (
                              <button
                                key={meal.id}
                                onClick={() => setSelectedMealType(meal.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                                  selectedMealType === meal.id
                                    ? 'bg-[var(--accent-primary)] text-white'
                                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                }`}
                              >
                                <span>{meal.icon}</span>
                                <span className="text-sm font-medium">{meal.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <Button
                          variant="default"
                          size="lg"
                          className="w-full mt-4"
                          onClick={handleAddToMeal}
                          disabled={isAdding}
                        >
                          {isAdding ? (
                            'Ajout en cours...'
                          ) : (
                            <>
                              <Check className="h-5 w-5 mr-2" />
                              Confirmer
                            </>
                          )}
                        </Button>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2 pb-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleToggleFavorite}
                    className={recipeIsFavorite ? 'text-[var(--error)] border-[var(--error)]' : ''}
                  >
                    <Heart
                      className={`h-5 w-5 ${recipeIsFavorite ? 'fill-[var(--error)]' : ''}`}
                    />
                  </Button>
                  <Button
                    variant={showAddToMeal ? 'outline' : 'default'}
                    size="lg"
                    className="flex-1"
                    onClick={() => setShowAddToMeal(!showAddToMeal)}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    {showAddToMeal ? 'Annuler' : 'Ajouter au journal'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
