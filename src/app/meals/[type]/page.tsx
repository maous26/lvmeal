'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Clock, Pencil, Trash2, Plus, X, ChevronRight, ChefHat, Check } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import { useMealsStore } from '@/stores/meals-store'
import type { MealType, Meal } from '@/types'

const mealConfig: Record<MealType, { label: string; icon: string }> = {
  breakfast: { label: 'Petit-déjeuner', icon: '☀️' },
  lunch: { label: 'Déjeuner', icon: '🍽️' },
  snack: { label: 'Collation', icon: '🍎' },
  dinner: { label: 'Dîner', icon: '🌙' },
}

export default function MealDetailPage() {
  const router = useRouter()
  const params = useParams()
  const mealType = params.type as MealType

  const [isEditing, setIsEditing] = React.useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
  const [selectedMealId, setSelectedMealId] = React.useState<string | null>(null)

  const { currentDate, getMealsByType, deleteMeal, removeItemFromMeal } = useMealsStore()

  // Get meals of this type for current date
  const mealsOfType = getMealsByType(currentDate, mealType)
  const meal = selectedMealId
    ? mealsOfType.find(m => m.id === selectedMealId)
    : mealsOfType[0]

  const isValidMealType = !!mealConfig[mealType]
  const config = isValidMealType ? mealConfig[mealType] : null

  // Handle redirects in useEffect to avoid setState during render
  React.useEffect(() => {
    if (!isValidMealType) {
      router.push('/meals')
    } else if (!meal) {
      router.push(`/meals/add?type=${mealType}`)
    }
  }, [isValidMealType, meal, mealType, router])

  // Show loading state while redirecting
  if (!isValidMealType || !meal || !config) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  // Get time from meal
  const mealTime = new Date(meal.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Use pre-calculated totals from store
  const totals = meal.totalNutrition

  const handleDelete = () => {
    deleteMeal(meal.id, currentDate)
    router.push('/meals')
  }

  const handleRemoveItem = (itemId: string) => {
    removeItemFromMeal(meal.id, itemId)
    // If this was the last item, the meal is auto-deleted and we redirect
    const updatedMeals = getMealsByType(currentDate, mealType)
    if (updatedMeals.length === 0) {
      router.push('/meals')
    }
  }

  const handleItemClick = (item: typeof meal.items[0]) => {
    // Si c'est une recette, naviguer vers la page de recette
    if (item.food.isRecipe && item.food.recipeId) {
      router.push(`/recipes/${item.food.recipeId}`)
    }
  }

  return (
    <>
      <Header
        title={config.label}
        showBack
        backHref="/meals"
        rightContent={
          <div className="flex gap-2">
            <Button
              variant={isEditing ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => setIsEditing(!isEditing)}
              className={isEditing ? "bg-[var(--accent-primary)]" : ""}
            >
              {isEditing ? <Check className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[var(--error)]"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        }
      />

      <PageContainer>
        {/* Edit mode banner */}
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded-xl p-3 mb-4 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
              <Pencil className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-[var(--text-primary)]">Mode édition</p>
              <p className="text-sm text-[var(--text-secondary)]">Appuyez sur X pour supprimer un aliment</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(false)}
            >
              Terminer
            </Button>
          </motion.div>
        )}

        {/* Meal header */}
        <Section>
          <Card padding="lg">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{config.icon}</div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">{config.label}</h2>
                <div className="flex items-center gap-2 text-[var(--text-secondary)] mt-1">
                  <Clock className="h-4 w-4" />
                  <span>{mealTime}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--calories)]">
                  {formatNumber(totals.calories)}
                </p>
                <p className="text-sm text-[var(--text-tertiary)]">kcal</p>
              </div>
            </div>
          </Card>
        </Section>

        {/* Nutrition summary */}
        <Section title="Nutrition">
          <Card padding="lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-[var(--proteins)] tabular-nums">
                  {totals.proteins}g
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">Protéines</p>
              </div>
              <div>
                <p className="text-xl font-bold text-[var(--carbs)] tabular-nums">
                  {totals.carbs}g
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">Glucides</p>
              </div>
              <div>
                <p className="text-xl font-bold text-[var(--fats)] tabular-nums">
                  {totals.fats}g
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">Lipides</p>
              </div>
            </div>
          </Card>
        </Section>

        {/* Food items */}
        <Section title={`Aliments (${meal.items.length})`}>
          <div className="space-y-2">
            {meal.items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  padding="default"
                  interactive={!isEditing && item.food.isRecipe}
                  onClick={() => !isEditing && handleItemClick(item)}
                >
                  <div className="flex items-center gap-3">
                    {isEditing && (
                      <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveItem(item.id)
                        }}
                        className="p-2 text-white bg-[var(--error)] hover:bg-[var(--error)]/80 rounded-full shadow-sm"
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    )}

                    {item.food.isRecipe && (
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
                        <ChefHat className="h-4 w-4 text-[var(--accent-primary)]" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--text-primary)]">{item.food.name}</p>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        {item.quantity} {item.food.unit || 'portion'}
                        {item.food.isRecipe && ' · Recette'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-[var(--text-primary)]">
                        {formatNumber(Math.round(item.food.nutrition.calories * item.quantity))} kcal
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        P {Math.round(item.food.nutrition.proteins * item.quantity)}g · G {Math.round(item.food.nutrition.carbs * item.quantity)}g · L {Math.round(item.food.nutrition.fats * item.quantity)}g
                      </p>
                    </div>

                    {!isEditing && item.food.isRecipe && (
                      <ChevronRight className="h-5 w-5 text-[var(--text-tertiary)]" />
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Add more items button */}
          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={() => router.push(`/meals/add?type=${mealType}`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un aliment
          </Button>
        </Section>

        {/* Delete confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[var(--bg-elevated)] rounded-2xl p-6 max-w-sm w-full"
            >
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Supprimer ce repas ?
              </h3>
              <p className="text-[var(--text-secondary)] mb-6">
                Cette action est irréversible. Toutes les données de ce repas seront supprimées.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Annuler
                </Button>
                <Button
                  variant="default"
                  className="flex-1 bg-[var(--error)] hover:bg-[var(--error)]/90"
                  onClick={handleDelete}
                >
                  Supprimer
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </PageContainer>
    </>
  )
}
