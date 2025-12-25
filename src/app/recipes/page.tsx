'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Search, Filter, Clock, ChefHat, Star, Heart, Globe, BookOpen, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PillTabs } from '@/components/ui/tabs'
import { formatNumber } from '@/lib/utils'
import { useRecipesStore } from '@/stores/recipes-store'
import { RecipeSearchExternal } from '@/components/recipes/recipe-search-external'
import { RecipeDetailModal } from '@/components/recipes/recipe-detail-modal'
import type { Recipe as ExternalRecipe } from '@/hooks/use-recipes-search'

const categories = [
  { id: 'all', label: 'Tout' },
  { id: 'quick', label: 'Express' },
  { id: 'healthy', label: 'Healthy' },
  { id: 'protein', label: 'Protéiné' },
  { id: 'vegetarian', label: 'Végétarien' },
]

const difficultyLabels: Record<string, { label: string; color: string }> = {
  easy: { label: 'Facile', color: 'var(--success)' },
  medium: { label: 'Moyen', color: 'var(--warning)' },
  hard: { label: 'Difficile', color: 'var(--error)' },
}

const viewTabs = [
  { id: 'local', label: 'Mes favoris', icon: Heart },
  { id: 'discover', label: 'Découvrir', icon: Globe },
]

export default function RecipesPage() {
  const router = useRouter()
  const [activeView, setActiveView] = React.useState<'local' | 'discover'>('local')
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCategory, setSelectedCategory] = React.useState('all')
  const [selectedRecipe, setSelectedRecipe] = React.useState<ExternalRecipe | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  const { favorites, removeFromFavorites, searchFavorites, getFavoritesByTag } = useRecipesStore()

  // Filter favorites based on search and category
  const filteredRecipes = React.useMemo(() => {
    let result = favorites

    // Search filter
    if (searchQuery) {
      result = searchFavorites(searchQuery)
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((recipe) =>
        recipe.tags.some((tag) => tag.toLowerCase().includes(selectedCategory.toLowerCase()))
      )
    }

    return result
  }, [favorites, searchQuery, selectedCategory, searchFavorites])

  const handleExternalRecipeSelect = (recipe: ExternalRecipe) => {
    setSelectedRecipe(recipe)
    setIsModalOpen(true)
  }

  const handleAddToMeal = async (recipe: ExternalRecipe, mealType: string, date: string) => {
    try {
      // Create meal entry with recipe data
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mealType,
          date,
          calories: recipe.nutrition?.calories || 0,
          proteins: recipe.nutrition?.proteins || 0,
          carbs: recipe.nutrition?.carbs || 0,
          fats: recipe.nutrition?.fats || 0,
          source: 'recipe',
          items: [{
            name: recipe.title,
            quantity: recipe.servings || 1,
            unit: 'portion',
            calories: recipe.nutrition?.calories || 0,
            proteins: recipe.nutrition?.proteins || 0,
            carbs: recipe.nutrition?.carbs || 0,
            fats: recipe.nutrition?.fats || 0,
            imageUrl: recipe.image,
            source: 'recipe',
          }],
        }),
      })

      if (response.ok) {
        setIsModalOpen(false)
        // Optionally navigate to meals page
        router.push('/meals')
      }
    } catch (error) {
      console.error('Error adding recipe to meal:', error)
    }
  }

  return (
    <>
      <Header
        title="Recettes"
        rightContent={
          <button className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-colors">
            <Filter className="h-5 w-5 text-[var(--text-secondary)]" />
          </button>
        }
      />

      <PageContainer>
        {/* View Toggle Tabs */}
        <Section>
          <div className="flex gap-2 p-1 bg-[var(--bg-secondary)] rounded-xl">
            {viewTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeView === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as 'local' | 'discover')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[var(--bg-primary)] text-[var(--accent-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Local Recipes View */}
        {activeView === 'local' && (
          <>
            {/* Search */}
            <Section>
              <Input
                placeholder="Rechercher une recette..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={Search}
              />
            </Section>

            {/* Categories */}
            <Section>
              <PillTabs
                tabs={categories}
                value={selectedCategory}
                onChange={setSelectedCategory}
              />
            </Section>

            {/* Recipes grid */}
            {filteredRecipes.length > 0 ? (
              <Section>
                <div className="grid grid-cols-1 gap-4">
                  {filteredRecipes.map((recipe, index) => {
                    const difficulty = difficultyLabels[recipe.difficulty] || difficultyLabels.medium

                    return (
                      <motion.div
                        key={recipe.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card
                          padding="none"
                          className="overflow-hidden"
                        >
                          <div className="flex">
                            {/* Image */}
                            <div className="relative w-28 h-28 flex-shrink-0">
                              {recipe.imageUrl ? (
                                <Image
                                  src={recipe.imageUrl}
                                  alt={recipe.title}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center">
                                  <ChefHat className="h-8 w-8 text-[var(--text-muted)]" />
                                </div>
                              )}
                              <div className="absolute top-2 left-2 p-1.5 rounded-full bg-white/90">
                                <Heart className="h-3.5 w-3.5 text-[var(--error)] fill-[var(--error)]" />
                              </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-3 min-w-0">
                              <h3 className="font-semibold text-[var(--text-primary)] line-clamp-2 text-sm mb-1">
                                {recipe.title}
                              </h3>

                              {/* Meta row */}
                              <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mb-2">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {recipe.totalTime} min
                                </span>
                                <span>{formatNumber(recipe.nutrition.calories)} kcal</span>
                                <span>{recipe.nutrition.proteins}g prot.</span>
                              </div>

                              {/* Rating & difficulty */}
                              <div className="flex items-center gap-2">
                                {recipe.rating && (
                                  <span className="flex items-center gap-1 text-xs">
                                    <Star className="h-3 w-3 text-[#FFB347] fill-[#FFB347]" />
                                    <span className="font-medium">{recipe.rating.toFixed(1)}</span>
                                  </span>
                                )}
                                <Badge
                                  variant="outline"
                                  size="sm"
                                  style={{ borderColor: difficulty.color, color: difficulty.color }}
                                >
                                  {difficulty.label}
                                </Badge>
                              </div>
                            </div>

                            {/* Remove button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFromFavorites(recipe.id)
                              }}
                              className="p-3 self-center text-[var(--text-tertiary)] hover:text-[var(--error)] transition-colors"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
              </Section>
            ) : (
              <div className="text-center py-12">
                <Heart className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  Aucune recette favorite
                </h3>
                <p className="text-[var(--text-secondary)] mb-4">
                  Explorez l'onglet "Découvrir" pour trouver des recettes et les ajouter à vos favoris.
                </p>
                <Button
                  variant="default"
                  onClick={() => setActiveView('discover')}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Découvrir des recettes
                </Button>
              </div>
            )}
          </>
        )}

        {/* Discover View - External API Search */}
        {activeView === 'discover' && (
          <Section>
            <RecipeSearchExternal onSelectRecipe={handleExternalRecipeSelect} />
          </Section>
        )}
      </PageContainer>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedRecipe(null)
        }}
        onAddToMeal={handleAddToMeal}
      />
    </>
  )
}
