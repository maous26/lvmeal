'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Clock, ChefHat, Loader2, Globe, ExternalLink, Flame, Dumbbell, Sparkles, Wand2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PillTabs } from '@/components/ui/tabs'
import { formatNumber } from '@/lib/utils'
import { useRecipesSearch, type Recipe } from '@/hooks/use-recipes-search'
import { useMealsStore } from '@/stores/meals-store'

const mealTypeOptions = [
  { id: 'breakfast', label: 'Petit-déj', icon: '🌅' },
  { id: 'lunch', label: 'Déjeuner', icon: '☀️' },
  { id: 'snack', label: 'Collation', icon: '🍎' },
  { id: 'dinner', label: 'Dîner', icon: '🌙' },
]

const dietFilters = [
  { id: '', label: 'Tout' },
  { id: 'vegetarian', label: 'Végétarien' },
  { id: 'vegan', label: 'Végan' },
  { id: 'glutenfree', label: 'Sans gluten' },
  { id: 'keto', label: 'Keto' },
  { id: 'lowcarb', label: 'Low carb' },
]

const difficultyLabels = {
  easy: { label: 'Facile', color: 'var(--success)' },
  medium: { label: 'Moyen', color: 'var(--warning)' },
  hard: { label: 'Difficile', color: 'var(--error)' },
}

interface RecipeSearchExternalProps {
  onSelectRecipe?: (recipe: Recipe) => void
}

export function RecipeSearchExternal({ onSelectRecipe }: RecipeSearchExternalProps) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedDiet, setSelectedDiet] = React.useState('')
  const [selectedMealType, setSelectedMealType] = React.useState<string>('lunch')
  const [isSuggesting, setIsSuggesting] = React.useState(false)
  const [suggestError, setSuggestError] = React.useState<string | null>(null)
  const { recipes, isLoading, isEnriching, error, total, search, clearResults } = useRecipesSearch()
  const { getDailyNutrition, currentDate } = useMealsStore()

  const handleSearch = React.useCallback(() => {
    if (searchQuery.trim()) {
      search({ query: searchQuery, diet: selectedDiet || undefined, limit: 12 })
    }
  }, [searchQuery, selectedDiet, search])

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }, [handleSearch])

  // Re-search when diet changes if there's a query
  React.useEffect(() => {
    if (searchQuery.trim() && recipes.length > 0) {
      handleSearch()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiet])

  // Handle AI suggestion
  const handleAISuggest = React.useCallback(async () => {
    setIsSuggesting(true)
    setSuggestError(null)

    try {
      // Get user profile from localStorage
      const profileStr = localStorage.getItem('presence-profile')
      if (!profileStr) {
        setSuggestError('Profil non configuré. Configurez votre profil dans les paramètres.')
        setIsSuggesting(false)
        return
      }

      const profile = JSON.parse(profileStr)

      // Get consumed nutrition for today
      const consumed = getDailyNutrition(currentDate)

      const response = await fetch('/api/recipes/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          mealType: selectedMealType,
          consumed: {
            calories: consumed.calories,
            proteins: consumed.proteins,
            carbs: consumed.carbs,
            fats: consumed.fats,
          },
          date: currentDate,
        }),
      })

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('Service IA non configuré')
        }
        throw new Error('Erreur lors de la suggestion')
      }

      const data = await response.json()

      if (data.recipe && onSelectRecipe) {
        // Convert to Recipe format
        const suggestedRecipe: Recipe = {
          id: data.recipe.id,
          title: data.recipe.title,
          description: data.recipe.description + (data.recipe.whyThisRecipe ? `\n\n✨ ${data.recipe.whyThisRecipe}` : ''),
          image: null,
          prepTime: data.recipe.prepTime,
          cookTime: data.recipe.cookTime,
          servings: data.recipe.servings,
          difficulty: data.recipe.difficulty,
          ingredients: data.recipe.ingredients,
          instructions: data.recipe.instructions,
          nutrition: data.recipe.nutrition,
          sourceUrl: null,
          sourceName: 'Présence IA',
          isEnriched: true,
        }
        onSelectRecipe(suggestedRecipe)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue'
      setSuggestError(message)
    } finally {
      setIsSuggesting(false)
    }
  }, [selectedMealType, getDailyNutrition, currentDate, onSelectRecipe])

  return (
    <div className="space-y-4">
      {/* AI Suggestion Card */}
      <Card className="p-4 bg-gradient-to-r from-[var(--accent-primary)]/10 to-[var(--accent-secondary)]/10 border-[var(--accent-primary)]/20">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="h-5 w-5 text-[var(--accent-primary)]" />
          <h2 className="font-semibold text-[var(--text-primary)]">Suggestion intelligente</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          L'IA vous suggère une recette adaptée à votre profil et votre solde calorique restant.
        </p>

        {/* Meal Type Selector */}
        <div className="flex flex-wrap gap-2 mb-3">
          {mealTypeOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelectedMealType(option.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedMealType === option.id
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>

        {/* Suggest Button */}
        <Button
          onClick={handleAISuggest}
          disabled={isSuggesting}
          className="w-full"
          variant="gradient"
        >
          {isSuggesting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Génération en cours...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Suggérer une recette
            </>
          )}
        </Button>

        {/* Suggest Error */}
        {suggestError && (
          <p className="text-sm text-[var(--error)] mt-2">{suggestError}</p>
        )}
      </Card>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[var(--border-primary)]" />
        <span className="text-xs text-[var(--text-tertiary)]">ou recherchez</span>
        <div className="flex-1 h-px bg-[var(--border-primary)]" />
      </div>

      {/* Search Header */}
      <div className="flex items-center gap-2 mb-2">
        <Globe className="h-5 w-5 text-[var(--accent-primary)]" />
        <h2 className="font-semibold text-[var(--text-primary)]">Découvrir des recettes</h2>
      </div>

      {/* Search Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Rechercher (ex: poulet, pasta, salade...)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          leftIcon={Search}
          className="flex-1"
        />
        <Button
          onClick={handleSearch}
          disabled={isLoading || !searchQuery.trim()}
          className="px-4"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Chercher'
          )}
        </Button>
      </div>

      {/* Diet Filters */}
      <PillTabs
        tabs={dietFilters}
        value={selectedDiet}
        onChange={setSelectedDiet}
      />

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/20">
          <p className="text-sm text-[var(--error)]">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" />
            <p className="text-sm text-[var(--text-secondary)]">Recherche en cours...</p>
          </div>
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="popLayout">
        {!isLoading && recipes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Results count */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  {total} recette{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
                </p>
                {isEnriching && (
                  <div className="flex items-center gap-1 text-xs text-[var(--accent-primary)]">
                    <Sparkles className="h-3 w-3 animate-pulse" />
                    <span>Traduction...</span>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearResults}
                className="text-xs"
              >
                Effacer
              </Button>
            </div>

            {/* Recipe Grid */}
            <div className="grid grid-cols-1 gap-3">
              {recipes.map((recipe, index) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  index={index}
                  onSelect={onSelectRecipe}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State - after search with no results */}
      {!isLoading && !error && searchQuery && recipes.length === 0 && total === 0 && (
        <div className="text-center py-8">
          <ChefHat className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">Aucune recette trouvée</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Essayez avec d'autres mots-clés
          </p>
        </div>
      )}

      {/* Initial State - before any search */}
      {!isLoading && !error && !searchQuery && recipes.length === 0 && (
        <div className="text-center py-8">
          <div className="p-3 rounded-full bg-[var(--accent-primary)]/10 w-fit mx-auto mb-3">
            <Search className="h-6 w-6 text-[var(--accent-primary)]" />
          </div>
          <p className="text-[var(--text-secondary)]">Cherchez parmi des milliers de recettes</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Trouvez l'inspiration pour votre prochain repas
          </p>
        </div>
      )}
    </div>
  )
}

interface RecipeCardProps {
  recipe: Recipe
  index: number
  onSelect?: (recipe: Recipe) => void
}

function RecipeCard({ recipe, index, onSelect }: RecipeCardProps) {
  const difficulty = difficultyLabels[recipe.difficulty]
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        interactive
        padding="none"
        onClick={() => onSelect?.(recipe)}
        className="overflow-hidden"
      >
        <div className="flex">
          {/* Image */}
          <div className="relative w-28 h-28 flex-shrink-0">
            {recipe.image ? (
              <Image
                src={recipe.image}
                alt={recipe.title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20 flex items-center justify-center">
                <ChefHat className="h-8 w-8 text-[var(--accent-primary)]" />
              </div>
            )}
            {/* Source badge */}
            <div className="absolute bottom-1 left-1">
              <Badge variant="default" size="sm" className="text-[10px] bg-black/60 backdrop-blur-sm">
                <Globe className="h-2.5 w-2.5 mr-0.5" />
                {recipe.sourceName || 'Web'}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-3 min-w-0">
            <h3 className="font-semibold text-[var(--text-primary)] line-clamp-2 text-sm mb-1">
              {recipe.title}
            </h3>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mb-2">
              {totalTime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {totalTime} min
                </span>
              )}
              {recipe.nutrition && (
                <>
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    {formatNumber(recipe.nutrition.calories)} kcal
                  </span>
                  <span className="flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" />
                    {recipe.nutrition.proteins}g
                  </span>
                </>
              )}
            </div>

            {/* Difficulty & servings */}
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                size="sm"
                style={{ borderColor: difficulty.color, color: difficulty.color }}
              >
                {difficulty.label}
              </Badge>
              <span className="text-xs text-[var(--text-tertiary)]">
                {recipe.servings} pers.
              </span>
              {recipe.sourceUrl && (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto p-1 rounded hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                </a>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
